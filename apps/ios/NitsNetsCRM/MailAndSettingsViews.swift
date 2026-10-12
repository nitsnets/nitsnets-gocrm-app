import SwiftUI

struct MailRow: View {
    let message: MailMessage
    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "envelope").font(.body.weight(.medium))
                .frame(width: 42, height: 42)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 6) {
                Text(message.fromName ?? message.fromEmail ?? "Remitente").font(.subheadline.weight(.semibold))
                Text(message.subject.isEmpty ? "Sin asunto" : message.subject).font(.subheadline).lineLimit(2)
                HStack(spacing: 5) {
                    Image(systemName: "lock").accessibilityLabel("Acceso restringido")
                    Text(readableDate(message.receivedAt))
                }.font(.caption).foregroundStyle(.secondary)
            }
        }.padding(.vertical, 8)
    }
}
struct MessagesView: View {
    @EnvironmentObject var session: Session
    var body: some View {
        List {
            GmailIntegrationSection()
            Section { Label("Solo tus conversaciones autorizadas", systemImage: "lock.shield").font(.footnote).foregroundStyle(.secondary).listRowBackground(Color.clear) }
            Section("Tus conversaciones") {
                ForEach(session.messages) { message in NavigationLink { MessageDetail(messageId: message.id) } label: { MailRow(message: message) } }
                if session.messages.isEmpty { EmptyState(title: "Tu correo, con privacidad", detail: "Conecta tu Gmail. Aquí aparecerán los emails de tus contactos del CRM que puedas consultar.", icon: "envelope.badge.shield.half.filled") }
                if session.messages.count >= 100 { Text("Se muestran los 100 mensajes más recientes.").font(.caption).foregroundStyle(.secondary) }
            }
        }.crmScreen().navigationTitle("Correo").navigationBarTitleDisplayMode(.large).refreshable { do { try await session.refreshMessages() } catch { session.report(error) } }
    }
}
struct MessageDetail: View {
    @EnvironmentObject var session: Session
    @Environment(\.scenePhase) private var scenePhase
    let messageId: String
    @State private var message: MailMessage?
    @State private var loadError: String?
    @State private var permissions = false
    var body: some View {
        Group {
            if let message {
                List {
                    Section {
                        Text(message.subject.isEmpty ? "Sin asunto" : message.subject).font(.title2.weight(.bold)).textSelection(.enabled)
                        LabeledContent("De", value: message.fromName ?? message.fromEmail ?? "")
                        if let email = message.fromEmail { Text(email).font(.footnote).foregroundStyle(.secondary) }
                        Text(readableDate(message.receivedAt)).font(.caption).foregroundStyle(.secondary)
                        Button { permissions = true } label: { Label("Permisos del email", systemImage: "lock.shield") }.crmAction()
                    }
                    Section { Text(message.bodyText?.isEmpty == false ? message.bodyText! : "Este mensaje no tiene cuerpo de texto disponible.").textSelection(.enabled).padding(.vertical, 4) }
                    Section("Quién puede leer este mensaje") {
                        ForEach(message.participants ?? []) { user in Label(user.name, systemImage: "envelope").font(.subheadline) }
                        ForEach(message.grants ?? []) { grant in Label(grant.name ?? "Acceso autorizado", systemImage: "person.crop.circle.badge.checkmark").font(.subheadline) }
                        Text("Los permisos se aplican solo a este mensaje. No se comparten otros mensajes del hilo ni respuestas futuras.").font(.caption).foregroundStyle(.secondary)
                    }
                }
            } else if let loadError {
                VStack(spacing: 18) { EmptyState(title: "Mensaje no disponible", detail: loadError, icon: "lock.envelope"); Button("Volver a comprobar") { Task { await reload() } }.buttonStyle(.bordered) }
            } else { ProgressView("Cargando mensaje…") }
        }.crmScreen().navigationTitle("Conversación").navigationBarTitleDisplayMode(.inline)
            .task(id: scenePhase) { if scenePhase == .active { await reload() } else { message = nil } }
            .refreshable { await reload() }
            .sheet(isPresented: $permissions, onDismiss: { Task { await reload() } }) {
                NavigationStack { MessagePermissionsView(messageId: messageId) }
            }
    }
    private func reload() async {
        message = nil; loadError = nil
        do { message = try await session.request("/messages/\(messageId)") }
        catch { if !(error is CancellationError) { loadError = error.localizedDescription; session.messages.removeAll { $0.id == messageId } } }
    }
}

struct MessagePermissionsView: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) private var dismiss
    let messageId: String
    @State private var message: MailMessage?
    @State private var members: [User] = []
    @State private var error: String?
    @State private var saving = false
    @State private var pending: User?
    @State private var search = ""
    private var pendingGrant: Grant? { message?.grants?.first { $0.userId == pending?.id } }
    private var candidates: [User] {
        members.filter { user in
            !(message?.participants ?? []).contains { $0.id == user.id } &&
            (search.isEmpty || user.name.localizedCaseInsensitiveContains(search) || user.email.localizedCaseInsensitiveContains(search))
        }
    }
    var body: some View {
        List {
            Section {
                Label("Solo este email", systemImage: "lock.shield").font(.headline)
                Text("Marca quién puede leer su contenido completo. Este permiso no incluye el resto de la conversación ni permite volver a compartirlo.").font(.footnote).foregroundStyle(.secondary)
            }
            if let message {
                Section("Participantes originales") {
                    ForEach(message.participants ?? []) { user in
                        HStack { VStack(alignment: .leading) { Text(user.name); Text("Participante · puede compartir").font(.caption).foregroundStyle(.secondary) }; Spacer(); Image(systemName: "lock.fill").foregroundStyle(.secondary) }
                    }
                    Text("El acceso de los participantes originales no se puede quitar.").font(.caption).foregroundStyle(.secondary)
                }
                if message.canShare == true {
                    Section("Acceso de lectura") {
                        ForEach(candidates) { user in
                            Toggle(isOn: Binding(get: { (message.grants ?? []).contains { $0.userId == user.id } }, set: { _ in pending = user })) {
                                VStack(alignment: .leading, spacing: 4) { Text(user.name); Text(user.email).font(.caption).foregroundStyle(.secondary) }
                            }.disabled(saving).accessibilityIdentifier("mail-permission-\(user.email)")
                        }
                        if candidates.isEmpty && error == nil { Text(search.isEmpty ? "No hay más personas en esta empresa." : "No hay personas que coincidan.").foregroundStyle(.secondary) }
                    }
                } else {
                    Section("Accesos compartidos") {
                        ForEach(message.grants ?? []) { grant in Label(grant.name ?? "Acceso autorizado", systemImage: "checkmark.circle") }
                        Text("Puedes leer este email. Solo sus participantes originales pueden cambiar los permisos.").font(.footnote).foregroundStyle(.secondary)
                    }
                }
            } else if error == nil { ProgressView("Consultando permisos…") }
            if let error { Section { Text(error).foregroundStyle(.secondary); Button("Reintentar") { Task { await load() } } } }
            if saving { ProgressView("Guardando permiso…") }
        }.crmScreen().navigationTitle("Permisos del email").navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Buscar persona")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Listo") { dismiss() }.disabled(saving) } }
            .interactiveDismissDisabled(saving)
            .task { await load() }
            .confirmationDialog(pendingGrant == nil ? "¿Dar acceso a \(pending?.name ?? "")?" : "¿Quitar el acceso de \(pending?.name ?? "")?", isPresented: Binding(get: { pending != nil }, set: { if !$0 { pending = nil } }), titleVisibility: .visible) {
                if let user = pending {
                    Button(pendingGrant == nil ? "Dar acceso de lectura" : "Revocar acceso", role: pendingGrant == nil ? nil : .destructive) {
                        let grant = pendingGrant
                        Task { await save(user: user, grant: grant) }
                    }
                }
            } message: { Text("El cambio se aplica únicamente a este mensaje.") }
    }
    private func load() async {
        error = nil; message = nil; members = []
        do {
            let loaded: MailMessage = try await session.request("/messages/\(messageId)")
            message = loaded
            if loaded.canShare == true { members = try await session.request("/members") }
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
    private func save(user: User, grant: Grant?) async {
        saving = true; error = nil; defer { saving = false; pending = nil }
        do {
            if let grant { let _: EmptyResponse = try await session.request("/messages/\(messageId)/grants/\(grant.id)", method: "DELETE") }
            else { let _: MailMessage = try await session.request("/messages/\(messageId)/grants", method: "POST", body: ["user_id": user.id]) }
            await load()
            try await session.refreshMessages()
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
}

struct SettingsView: View {
    @EnvironmentObject var session: Session
    @State private var switchTo: Workspace?
    @State private var signOut = false
    var body: some View {
        List {
            if let credentials = session.credentials {
                Section {
                    HStack(spacing: 16) {
                        CRMBrand(size: 52)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(credentials.user.name).font(.headline)
                            Text(credentials.user.email).font(.subheadline).foregroundStyle(.secondary)
                        }
                    }.padding(.vertical, 10)
                }
                Section { ForEach(credentials.workspaces) { workspace in Button { if workspace.id != credentials.workspace.id { switchTo = workspace } } label: { HStack { Text(workspace.name).foregroundStyle(.primary); Spacer(); if workspace.id == credentials.workspace.id { Label("Activa", systemImage: "checkmark.circle.fill").font(.caption).foregroundStyle(Color.crmAccent) } } } } } header: { Text("Empresa activa") } footer: { Text("Trabajas en una sola empresa cada vez. Al cambiar se vacían las vistas; tus notas locales permanecen separadas en su empresa de origen.") }
            }
            GmailIntegrationSection()
            Section("Tus datos") { if !session.isDemo { NavigationLink { DraftsView() } label: { Label("Notas de este dispositivo", systemImage: "tray") } }; Label("Las notas nuevas son privadas", systemImage: "lock"); Text("Los enlaces a LinkedIn son manuales. La aplicación no sincroniza contactos ni mensajes de LinkedIn.").font(.footnote).foregroundStyle(.secondary) }
            if session.isDemo {
                Section("Demo local") { Text("Datos ficticios en memoria. Al salir se descartan todos los cambios."); Button("Salir del modo demo") { session.exitDemo() } }
            } else {
            if Session.demoAvailable { Section { LocalDemoEntry() } }
            Section("Servidor") { Text(session.credentials?.server ?? "").font(.footnote).textSelection(.enabled); Text("Para cambiar de servidor, cierra sesión y configura la nueva dirección antes de entrar.").font(.caption).foregroundStyle(.secondary) }
            Section { Button("Cerrar sesión", role: .destructive) { signOut = true } }
            }
        }.crmScreen().navigationTitle("Espacio").navigationBarTitleDisplayMode(.large)
            .confirmationDialog("¿Cambiar a \(switchTo?.name ?? "")?", isPresented: Binding(get: { switchTo != nil }, set: { if !$0 { switchTo = nil } }), titleVisibility: .visible) { Button("Cambiar empresa") { if let workspace = switchTo { Task { await session.switchWorkspace(workspace.id) } } } }
            .confirmationDialog("¿Cerrar sesión? Las notas locales seguirán protegidas para tu cuenta.", isPresented: $signOut, titleVisibility: .visible) { Button("Cerrar sesión", role: .destructive) { Task { await session.logout() } } }
    }
}

struct GmailIntegrationSection: View {
    @EnvironmentObject var session: Session
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var authentication = GoogleAuthentication()
    @State private var gmail: GmailStatus?
    @State private var working = false
    @State private var disconnect = false
    @State private var error: String?
    @State private var notice: String?
    var body: some View {
        Section {
            if session.isDemo {
                Label("Correo de ejemplo", systemImage: "envelope").font(.headline)
                Text("Gmail no está conectado. Los mensajes y sus permisos son ficticios; puedes probarlos sin enviar ni importar emails.").font(.footnote).foregroundStyle(.secondary)
            } else if let gmail {
                HStack(spacing: 12) {
                    if gmail.isSyncing { ProgressView().accessibilityLabel("Sincronización en curso") }
                    else { Image(systemName: gmail.needsAuthorization || gmail.status == "sync_error" ? "exclamationmark.circle" : "envelope").font(.title3) }
                    VStack(alignment: .leading, spacing: 5) {
                        Text(gmail.label).font(.headline)
                        if let email = gmail.email { Text(email).font(.subheadline).foregroundStyle(.secondary) }
                        if let date = gmail.lastSyncedAt { Text("Última sincronización: \(readableDate(date))").font(.caption).foregroundStyle(.secondary) }
                    }
                }.padding(.vertical, 8)
                if !gmail.configured {
                    Text("Falta configurar Gmail en el servidor. Cuando esté listo podrás conectar tu cuenta aquí.").font(.footnote).foregroundStyle(.secondary)
                } else if !gmail.connected || gmail.needsAuthorization {
                    Button { Task { await connect() } } label: { Label(gmail.needsAuthorization ? "Volver a conectar Gmail" : "Conectar mi Gmail", systemImage: "link") }.disabled(working)
                } else {
                    Button { Task { await sync() } } label: { Label(gmail.status == "sync_error" ? "Reintentar sincronización" : "Sincronizar correo", systemImage: "arrow.triangle.2.circlepath") }.disabled(working || gmail.isSyncing)
                }
                if gmail.isSyncing { Text("El servidor sincroniza en segundo plano. Puedes seguir usando la app; el correo se actualizará al terminar.").font(.footnote).foregroundStyle(.secondary) }
                if gmail.connected { Button("Desconectar Gmail", role: .destructive) { disconnect = true }.disabled(working) }
                Text("Se importan emails vinculados a los contactos de esta empresa. La primera sincronización revisa los últimos 30 días.").font(.caption).foregroundStyle(.secondary)
            } else if error == nil { ProgressView("Consultando Gmail…") }
            if let error { Text(error).font(.footnote).foregroundStyle(.secondary) }
            if let notice { Text(notice).font(.footnote).foregroundStyle(.secondary) }
            if !session.isDemo { Button("Actualizar estado") { Task { await refresh() } }.font(.subheadline).disabled(working) }
        }
        .task(id: "\(session.identityKey)|\(scenePhase)") {
            guard scenePhase == .active, !session.isDemo else { return }
            await refresh(refreshMail: true)
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(5)) } catch { return }
                guard !working else { continue }
                await refresh()
            }
        }
        .confirmationDialog("¿Desconectar tu cuenta de Gmail?", isPresented: $disconnect, titleVisibility: .visible) {
            Button("Desconectar", role: .destructive) { Task { await disconnectGmail() } }
        } message: { Text("Se detendrá la sincronización. Los emails ya importados conservarán sus permisos.") }
    }
    private func refresh(refreshMail: Bool = false) async {
        do {
            let latest: GmailStatus = try await session.request("/integrations/gmail")
            let changed = latest.lastSyncedAt != gmail?.lastSyncedAt
            gmail = latest; error = nil
            if changed || refreshMail { try await session.refreshMessages() }
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
    private func connect() async {
        working = true; error = nil; notice = nil; defer { working = false }
        let identity = session.identityKey
        do {
            let authorization: AuthorizationURL = try await session.request("/integrations/gmail/connect", method: "POST", body: ["client": "ios"])
            guard let url = URL(string: authorization.authorizationUrl), let state = authorization.state, !state.isEmpty else { throw APIError(message: "No se pudo preparar la conexión segura con Gmail.") }
            let callback = try await authentication.authenticate(url: url)
            guard identity == session.identityKey else { throw CancellationError() }
            try GmailCallback.validate(callback, expectedState: state)
            notice = "Gmail conectado. La primera sincronización se ha solicitado."
            await refresh()
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
    private func sync() async {
        working = true; error = nil; notice = nil; defer { working = false }
        do {
            let _: QueuedStatus = try await session.request("/integrations/gmail/sync", method: "POST")
            await refresh()
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
    private func disconnectGmail() async {
        working = true; error = nil; notice = nil; defer { working = false }
        do {
            let _: EmptyResponse = try await session.request("/integrations/gmail", method: "DELETE")
            await refresh()
        } catch { if !(error is CancellationError) { self.error = error.localizedDescription } }
    }
}
