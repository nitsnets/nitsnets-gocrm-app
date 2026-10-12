import SwiftUI

struct NoteComposer: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var drafts: DraftStore
    @Environment(\.dismiss) var dismiss
    @Environment(\.scenePhase) var scenePhase
    var contact: Contact? = nil
    @StateObject private var speech = SpeechRecorder()
    @State private var bodyText = ""
    @State private var selectedContact = ""
    @State private var reviewing = false
    @State private var saving = false
    @State private var draftId = UUID()
    @State private var targetScope: DraftScope?
    @State private var textBeforeDictation = ""
    var chosenContact: Contact? { session.contacts.first { $0.id == selectedContact } ?? (contact?.id == selectedContact ? contact : nil) }
    var body: some View {
        NavigationStack {
            Form {
                if reviewing {
                    Section("Comprueba la asociación") { LabeledContent("Empresa", value: session.credentials?.workspace.name ?? ""); LabeledContent("Persona", value: chosenContact?.displayName ?? "Sin asociar"); Label("Solo tú puedes ver esta nota", systemImage: "lock.fill").foregroundStyle(Color.crmAccent) }
                    Section("Texto que guardarás") { Text(bodyText).textSelection(.enabled) }
                    Section {
                        Button { Task { await saveToServer() } } label: { Label(saving ? "Guardando…" : (session.isDemo ? "Guardar en la demo" : "Confirmar y guardar en el CRM"), systemImage: "checkmark.circle") }.disabled(saving)
                        if !session.isDemo {
                        Button { saveLocally() } label: { Label("Guardar solo en este dispositivo", systemImage: "iphone") }.disabled(saving)
                        Text("Las notas locales se sincronizan únicamente cuando tú lo solicitas. Permanecen separadas por usuario, empresa y servidor.").font(.footnote).foregroundStyle(.secondary)
                        } else { Text("Esta nota ficticia se descartará al salir de la demo.").font(.footnote).foregroundStyle(.secondary) }
                    }
                } else {
                    Section {
                        TextEditor(text: $bodyText).frame(minHeight: 190).accessibilityLabel("Texto de la nota").disabled(speech.recording)
                        Button {
                            if speech.recording { speech.stop() }
                            else { textBeforeDictation = bodyText; Task { await speech.start() } }
                        } label: { Label(speech.recording ? "Detener dictado" : "Dictar una nota", systemImage: speech.recording ? "stop.circle.fill" : "mic.circle.fill").foregroundStyle(speech.recording ? .red : Color.crmAccent) }.disabled(speech.preparing)
                        if speech.recording { Label("Escuchando…", systemImage: "waveform").foregroundStyle(.red) }
                        if let error = speech.error { Text(error).font(.footnote).foregroundStyle(.secondary) }
                    } header: { Text("¿Qué quieres recordar?") } footer: { Text("Dictado local en dispositivos compatibles. El audio no se guarda. Revisa siempre el texto antes de continuar.") }
                    Section("Asociar a una persona") {
                        Picker("Contacto", selection: $selectedContact) {
                            Text("Sin asociar por ahora").tag("")
                            if let contact, !session.contacts.contains(where: { $0.id == contact.id }) { Text(contact.displayName).tag(contact.id) }
                            ForEach(session.contacts) { Text($0.displayName).tag($0.id) }
                        }.pickerStyle(.navigationLink)
                        Text("Tú eliges el contacto. No asociamos una nota por una coincidencia de nombre.").font(.footnote).foregroundStyle(.secondary)
                    }
                    Section { Button("Revisar antes de guardar") { speech.stop(); reviewing = true }.disabled(bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || speech.recording) }
                }
            }.crmScreen().navigationTitle(reviewing ? "Revisar nota" : "Captura rápida").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button(reviewing ? "Editar" : "Cancelar") { if reviewing { reviewing = false } else { dismiss() } }.disabled(saving) } }
        }.interactiveDismissDisabled(saving || speech.recording)
            .onAppear { selectedContact = contact?.id ?? ""; targetScope = session.scope }
            .onDisappear { speech.stop() }
            .onChange(of: scenePhase) { _, phase in if phase == .background { speech.stop() } }
            .onChange(of: speech.transcript) { _, value in if !value.isEmpty { bodyText = textBeforeDictation + (textBeforeDictation.isEmpty ? "" : "\n") + value } }
    }
    private func saveToServer() async {
        guard targetScope == session.scope else { session.alert = "La empresa activa ha cambiado. Abre una nueva nota."; return }
        saving = true; defer { saving = false }
        do { _ = try await session.saveNote(body: bodyText.trimmingCharacters(in: .whitespacesAndNewlines), contactId: selectedContact.isEmpty ? nil : selectedContact, draftId: draftId); dismiss() }
        catch { session.report(error) }
    }
    private func saveLocally() {
        guard !session.isDemo else { return }
        guard let scope = targetScope, scope == session.scope else { session.alert = "La empresa activa ha cambiado. Abre una nueva nota."; return }
        do { try drafts.add(LocalDraft(id: draftId, scope: scope, body: bodyText.trimmingCharacters(in: .whitespacesAndNewlines), contactId: selectedContact.isEmpty ? nil : selectedContact, contactName: chosenContact?.displayName)); dismiss() }
        catch { session.report(error) }
    }
}

struct DraftsView: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var drafts: DraftStore
    @Environment(\.dismiss) var dismiss
    @State private var selected: LocalDraft?
    var body: some View {
        List {
            Section { Text("Estas notas solo existen en este dispositivo. Revisa cada una para enviarla a \(session.credentials?.workspace.name ?? "tu empresa").").font(.footnote).foregroundStyle(.secondary) }
            if let scope = session.scope {
                ForEach(drafts.visible(to: scope)) { draft in Button { selected = draft } label: { VStack(alignment: .leading, spacing: 7) { Text(draft.contactName ?? "Sin asociar").font(.headline); Text(draft.body).lineLimit(3).foregroundStyle(.secondary); Text(draft.createdAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary) }.padding(.vertical, 6) } }
                if drafts.visible(to: scope).isEmpty { EmptyState(title: "Todo al día", detail: "No quedan notas locales para este espacio.", icon: "checkmark.circle") }
            }
        }.crmScreen().navigationTitle("Notas locales").toolbar { Button("Cerrar") { dismiss() } }.sheet(item: $selected) { draft in DraftReview(draft: draft) }
    }
}
struct DraftReview: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var drafts: DraftStore
    @Environment(\.dismiss) var dismiss
    let draft: LocalDraft
    @State private var syncing = false
    @State private var delete = false
    var body: some View {
        NavigationStack { Form {
            Section("Destino") { LabeledContent("Empresa", value: session.credentials?.workspace.name ?? ""); LabeledContent("Persona", value: draft.contactName ?? "Sin asociar"); Label("Privada", systemImage: "lock") }
            Section("Contenido") { Text(draft.body).textSelection(.enabled) }
            Section {
                Button { Task { await sync() } } label: { Label(syncing ? "Sincronizando…" : "Confirmar y sincronizar", systemImage: "tray.and.arrow.up") }.disabled(syncing || draft.scope != session.scope)
                Button("Eliminar nota local", role: .destructive) { delete = true }.disabled(syncing)
            }
        }.crmScreen().navigationTitle("Revisar nota local").navigationBarTitleDisplayMode(.inline).toolbar { Button("Cerrar") { dismiss() }.disabled(syncing) } }
            .interactiveDismissDisabled(syncing).confirmationDialog("¿Eliminar esta nota del dispositivo?", isPresented: $delete, titleVisibility: .visible) { Button("Eliminar", role: .destructive) { do { try drafts.remove(draft.id, scope: draft.scope); dismiss() } catch { session.report(error) } } }
    }
    private func sync() async {
        guard session.scope == draft.scope else { return }
        syncing = true; defer { syncing = false }
        do { _ = try await session.saveNote(body: draft.body, contactId: draft.contactId, draftId: draft.id); try drafts.remove(draft.id, scope: draft.scope); dismiss() }
        catch { session.report(error) }
    }
}

struct TaskRow: View {
    @EnvironmentObject var session: Session
    let task: CRMTask
    var showsContact = false
    @State private var saving = false
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Button { Task {
                saving = true; defer { saving = false }
                do { let changed: CRMTask = try await session.request("/tasks/\(task.id)", method: "PATCH", body: ["status": task.status == "completed" ? "pending" : "completed"]); if let index = session.tasks.firstIndex(where: { $0.id == task.id }) { session.tasks[index] = changed } } catch { session.report(error) }
            } } label: { Image(systemName: task.status == "completed" ? "checkmark.circle.fill" : "circle").font(.system(size: 26, weight: .light)).frame(width: 44, height: 44) }.buttonStyle(.borderless).disabled(saving).accessibilityLabel(task.status == "completed" ? "Marcar pendiente" : "Completar tarea")
            VStack(alignment: .leading, spacing: 7) {
                Text(task.title).font(.body).strikethrough(task.status == "completed")
                if let due = crmDate(task.dueAt) {
                    let overdue = task.status != "completed" && due < .now
                    Text("\(overdue ? "Venció el " : "")\(due.formatted(.dateTime.locale(Locale(identifier: "es_ES")).day().month(.abbreviated)))")
                        .font(.subheadline).foregroundStyle(overdue ? .red : .secondary)
                }
                if showsContact, let contact = session.contacts.first(where: { $0.id == task.contactId }) {
                    Label(contact.displayName, systemImage: "person.fill")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }.padding(.top, 8)
            Spacer(minLength: 0)
        }.padding(.vertical, 4)
            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 20))
    }
}
struct TaskComposer: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) var dismiss
    var contact: Contact? = nil
    @State private var title = ""; @State private var due = Date().addingTimeInterval(86400); @State private var hasDue = true; @State private var saving = false
    var body: some View {
        NavigationStack { Form {
            Section { TextField("Qué quieres hacer", text: $title); if let contact { LabeledContent("Persona", value: contact.displayName) } }
            Section { Toggle("Añadir fecha", isOn: $hasDue); if hasDue { DatePicker("Cuándo", selection: $due) } }
        }.crmScreen().navigationTitle("Seguimiento").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() }.disabled(saving) }; ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task {
            saving = true; defer { saving = false }
            do { var body: [String: Any] = ["title": title.trimmingCharacters(in: .whitespacesAndNewlines), "status": "pending"]; if let contact { body["contact_id"] = contact.id }; if hasDue { body["due_at"] = ISO8601DateFormatter().string(from: due) }; let created: CRMTask = try await session.request("/tasks", method: "POST", body: body); session.tasks.insert(created, at: 0); dismiss() } catch { session.report(error) }
        } }.disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving) } } }.interactiveDismissDisabled(saving)
    }
}
