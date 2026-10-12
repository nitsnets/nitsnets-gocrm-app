import SwiftUI

struct AgendaView: View {
    @EnvironmentObject var session: Session
    @State private var event = false
    @State private var task = false
    var body: some View {
        List {
            Section { ForEach(session.events) { event in NavigationLink { EventDetail(event: event) } label: { EventRow(event: event) } }; if session.events.isEmpty { CRMQuietRow(title: "Tu próximo encuentro", detail: "Añade un evento y las personas que quieres recordar.", icon: "calendar.badge.plus") } } header: { CRMSectionTitle(title: "Encuentros") }
            Section { ForEach(session.tasks) { task in TaskRow(task: task) }; if session.tasks.isEmpty { CRMQuietRow(title: "Todo al día", detail: "Los seguimientos de tu equipo aparecerán aquí.", icon: "checkmark.circle") } } header: { CRMSectionTitle(title: "Seguimientos del equipo") }
        }.crmScreen().navigationTitle("Agenda").navigationBarTitleDisplayMode(.large).toolbar { Menu { Button("Crear evento", systemImage: "calendar.badge.plus") { event = true }; Button("Añadir seguimiento", systemImage: "checkmark.circle") { task = true } } label: { Image(systemName: "plus") }.accessibilityLabel("Añadir a la agenda") }.sheet(isPresented: $event) { EventComposer() }.sheet(isPresented: $task) { TaskComposer() }.refreshable { await session.refresh() }
    }
}
struct EventRow: View {
    let event: CRMEvent
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "calendar").font(.title3)
                .frame(width: 44, height: 48)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 5) {
                Text(event.name).font(.body.weight(.medium))
                Text(readableDate(event.startsAt)).font(.caption).foregroundStyle(.secondary)
                if let location = event.location, !location.isEmpty {
                    Text(location).font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }.padding(.vertical, 6)
            .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 8, trailing: 20))
    }
}
struct EventDetail: View {
    @EnvironmentObject var session: Session
    let event: CRMEvent
    @State private var rehearse = false
    var people: [Contact] { event.contacts ?? session.contacts.filter { (event.contactIds ?? []).contains($0.id) } }
    var body: some View {
        List {
            Section { EventRow(event: event); if let notes = event.notes, !notes.isEmpty { Text(notes) } }
            Section("Personas que quieres recordar") {
                if people.isEmpty { Text("Este evento todavía no tiene personas asociadas.").foregroundStyle(.secondary) }
                else { Button { rehearse = true } label: { Label("Repasar nombres", systemImage: "rectangle.on.rectangle") } }
                ForEach(people) { person in NavigationLink { ContactDetail(contact: person) } label: { ContactRow(contact: person) } }
            }
            Section { Text("Después de cada encuentro, abre la ficha y dicta una nota. Confirma la persona antes de guardarla.").font(.footnote).foregroundStyle(.secondary) }
        }.crmScreen().navigationTitle("Prepara el encuentro").navigationBarTitleDisplayMode(.inline).sheet(isPresented: $rehearse) { MemoryCards(contacts: people) }
    }
}
struct MemoryCards: View {
    let contacts: [Contact]
    @Environment(\.dismiss) var dismiss
    var body: some View {
        NavigationStack {
            TabView { ForEach(contacts) { contact in MemoryCard(contact: contact).padding(26) } }.tabViewStyle(.page(indexDisplayMode: .always)).background(Color(.systemBackground)).navigationTitle("Repasar contactos").navigationBarTitleDisplayMode(.inline).toolbar { Button("Listo") { dismiss() } }
        }
    }
}
struct MemoryCard: View {
    @EnvironmentObject var session: Session
    let contact: Contact
    @State private var reveal = false
    var body: some View {
        VStack(spacing: 16) {
            Avatar(contact: contact, size: 64)
            Text(reveal ? contact.displayName : "¿Recuerdas su nombre?").font(.title2.weight(.semibold)).multilineTextAlignment(.center)
            Text(contact.jobTitle ?? "Contacto").foregroundStyle(.secondary)
            if let current = contact.affiliations?.first(where: { $0.endedOn == nil }) { Label(current.companyLabel, systemImage: "building.2").font(.subheadline) }
            if reveal {
                if let note = session.notes.first(where: { $0.contactId == contact.id }) { Text(note.body).font(.body).lineLimit(5).multilineTextAlignment(.center) }
                Text("Desliza para repasar la siguiente persona").font(.caption).foregroundStyle(.secondary)
            }
            Button(reveal ? "Ocultar nombre" : "Ver nombre y contexto") { reveal.toggle() }.crmAction(prominent: true).controlSize(.large)
        }.frame(maxWidth: 500, maxHeight: .infinity).padding(20).background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 28))
    }
}
struct EventComposer: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) var dismiss
    @State private var name = ""; @State private var location = ""; @State private var date = Date(); @State private var notes = ""; @State private var attendees = Set<String>(); @State private var saving = false
    var body: some View {
        NavigationStack { Form {
            Section("Encuentro") { TextField("Nombre del evento", text: $name); TextField("Lugar", text: $location); DatePicker("Fecha", selection: $date); TextField("Qué quieres conseguir", text: $notes, axis: .vertical).lineLimit(3...5) }
            Section("Personas que esperas encontrar") { ForEach(session.contacts) { contact in Button { if attendees.contains(contact.id) { attendees.remove(contact.id) } else { attendees.insert(contact.id) } } label: { HStack { ContactRow(contact: contact); Spacer(); Image(systemName: attendees.contains(contact.id) ? "checkmark.circle.fill" : "circle").foregroundStyle(Color.crmAccent) }.foregroundStyle(.primary) } } }
        }.crmScreen().navigationTitle("Nuevo encuentro").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() }.disabled(saving) }; ToolbarItem(placement: .confirmationAction) { Button("Guardar") { Task {
            saving = true; defer { saving = false }
            do { let event: CRMEvent = try await session.request("/events", method: "POST", body: ["name": name.trimmingCharacters(in: .whitespacesAndNewlines), "location": location, "starts_at": ISO8601DateFormatter().string(from: date), "notes": notes, "contact_ids": Array(attendees)]); session.events.append(event); dismiss() } catch { session.report(error) }
        } }.disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving) } } }.interactiveDismissDisabled(saving)
    }
}
