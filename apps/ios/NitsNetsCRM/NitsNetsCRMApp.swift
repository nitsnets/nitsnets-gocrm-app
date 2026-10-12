import SwiftUI

// Native adaptation of the neutral primary/muted/border tokens in GTT GADD UX
// and Hundrev CMS UX. See README.md for the exact read-only source paths.
extension Color { static let crmAccent = Color.primary }

@main struct NitsNetsCRMApp: App {
    @StateObject private var session = Session()
    @StateObject private var drafts = DraftStore()
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            ZStack {
                Group {
                    if session.busy && session.credentials != nil { ProgressView("Preparando tu espacio…") }
                    else if session.credentials != nil { MainTabs().id(session.identityKey) }
                    else { LoginView() }
                }
                if scenePhase != .active { Color(.systemBackground).ignoresSafeArea().overlay { Image(systemName: "lock.shield.fill").font(.largeTitle).foregroundStyle(Color.crmAccent) } }
            }
            .environmentObject(session).environmentObject(drafts).environment(\.locale, Locale(identifier: "es_ES")).tint(.crmAccent)
            .alert("gocrm", isPresented: Binding(get: { session.alert != nil }, set: { if !$0 { session.alert = nil } })) { Button("Entendido", role: .cancel) {} } message: { Text(session.alert ?? "") }
        }
    }
}

struct LoginView: View {
    @EnvironmentObject var session: Session
    @State private var server = Session.initialServer
#if DEBUG && CRM_DEMO_LOGIN
    // Explicit local demo build; Release never pre-fills credentials.
    @State private var email = "eladio@nitsnets.demo"
    @State private var password = "DemoCRM!2026"
#else
    @State private var email = ""
    @State private var password = ""
#endif
    @StateObject private var googleAuthentication = GoogleAuthentication()
    @State private var googleConfigured = false
    @State private var checkingGoogle = false
    @State private var googleWorking = false
    @State private var googleStatus = ""
    @State private var serverExpanded = Session.initialServer.isEmpty
    @State private var connectionStatus = "Comprobando conexión…"
    @State private var connectionDetail = ""
    @State private var connectionRetry = 0
    private var validServer: Bool { (try? Session.validatedServer(server)) != nil }
    private var authenticating: Bool { googleWorking || session.busy }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(spacing: 12) {
                        CRMBrand(size: 76)
                        Text("gocrm").font(.largeTitle.weight(.bold))
                    }.frame(maxWidth: .infinity).padding(.top, 24).padding(.bottom, 8)

                    VStack(alignment: .leading, spacing: 20) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Iniciar sesión").font(.title2.weight(.bold))
                            Text("Accede a tu empresa.").font(.subheadline).foregroundStyle(.secondary)
                        }
                        VStack(spacing: 0) {
                            TextField("Correo de trabajo", text: $email)
                                .textContentType(.username).keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never).autocorrectionDisabled()
                                .accessibilityIdentifier("login.email").accessibilityLabel("Correo de trabajo")
                                .padding(18)
                            Divider().padding(.horizontal, 18)
                            SecureField("Contraseña", text: $password).textContentType(.password)
                                .accessibilityIdentifier("login.password").padding(18)
                        }.background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 22))
                            .disabled(authenticating)

                        Button { Task { await session.login(server: server, email: email, password: password) } } label: {
                            HStack(spacing: 10) {
                                if session.busy { ProgressView().tint(Color(.systemBackground)) }
                                Text(session.busy ? "Iniciando sesión…" : "Iniciar sesión")
                                if !session.busy { Image(systemName: "arrow.right") }
                            }.font(.body.weight(.semibold))
                                .frame(maxWidth: .infinity).padding(.vertical, 8)
                        }.crmAction(prominent: true).controlSize(.large)
                            .disabled(email.isEmpty || password.isEmpty || !validServer || authenticating)
                            .accessibilityIdentifier("login.submit")

                        HStack(spacing: 16) {
                            Rectangle().fill(Color(.separator)).frame(height: 0.5)
                            Text("o").font(.caption).foregroundStyle(.secondary)
                            Rectangle().fill(Color(.separator)).frame(height: 0.5)
                        }
                        VStack(spacing: 12) {
                            Button { Task { await loginWithGoogle() } } label: {
                                HStack(spacing: 10) {
                                    if googleWorking || checkingGoogle { ProgressView() }
                                    Text(googleWorking ? "Conectando con Google…" : "Continuar con Google")
                                }.font(.body.weight(.medium)).frame(maxWidth: .infinity).padding(.vertical, 8)
                            }.crmAction().controlSize(.large)
                                .disabled(!validServer || !googleConfigured || authenticating || checkingGoogle)
                                .accessibilityIdentifier("login.google")
                            if !googleStatus.isEmpty {
                                Text(googleStatus).font(.footnote).foregroundStyle(.secondary)
                            }
                        }
                    }
                    if Session.demoAvailable { LocalDemoEntry().disabled(authenticating) }
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            if checkingGoogle { ProgressView().controlSize(.small) }
                            else { Image(systemName: connectionStatus == "Servidor conectado" ? "checkmark.circle" : "network").foregroundStyle(.secondary) }
                            Text(connectionStatus).font(.footnote.weight(.medium)).accessibilityIdentifier("login.connectionStatus")
                            Spacer()
                            Button { connectionRetry += 1 } label: { Image(systemName: "arrow.clockwise").frame(minWidth: 44, minHeight: 44) }
                                .accessibilityLabel("Reintentar conexión").accessibilityIdentifier("login.retryConnection")
                                .disabled(!validServer || checkingGoogle || authenticating)
                        }
                        DisclosureGroup("Servidor API", isExpanded: $serverExpanded) {
                            VStack(alignment: .leading, spacing: 12) {
                                TextField("https://…/api/v1", text: $server).keyboardType(.URL)
                                    .textInputAutocapitalization(.never).autocorrectionDisabled()
                                    .disabled(authenticating).accessibilityIdentifier("login.server")
                                if !connectionDetail.isEmpty { Text(connectionDetail).foregroundStyle(.secondary) }
                                Text("En desarrollo, usa la dirección .local del Mac y la misma Wi-Fi. En producción, usa HTTPS.").foregroundStyle(.secondary)
                            }.font(.footnote).padding(.top, 12)
                        }.font(.footnote)
                    }
                    Label("Tus conversaciones, solo para las personas autorizadas.", systemImage: "lock.shield")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding(.horizontal, 28).padding(.bottom, 32).frame(maxWidth: 460)
                    .frame(maxWidth: .infinity)
            }.background(Color(.systemBackground)).scrollDismissesKeyboard(.interactively)
                .toolbar(.hidden, for: .navigationBar)
        }.task(id: "\(server)|\(connectionRetry)") { await checkGoogleAvailability() }
    }
    private func checkGoogleAvailability() async {
        googleConfigured = false; checkingGoogle = false
        googleStatus = "Conecta con el servidor para comprobar la disponibilidad de Google."
        connectionDetail = ""
        guard validServer else {
            serverExpanded = true
            connectionStatus = "Servidor sin configurar"
            connectionDetail = "Introduce una dirección válida para iniciar sesión."
            return
        }
        checkingGoogle = true
        connectionStatus = "Comprobando conexión…"
        do {
            try await Task.sleep(for: .milliseconds(350))
            let availability: GoogleAvailability = try await session.publicRequest(server: server, path: "/auth/google")
            try Task.checkCancellation()
            connectionStatus = "Servidor conectado"
            googleConfigured = availability.configured
            googleStatus = availability.configured ? "Iniciar sesión con Google no conecta tu buzón de Gmail." : "Google aún no está configurado. Entra con tu correo y contraseña."
        } catch {
            if Task.isCancelled { return }
            connectionStatus = "Servidor no alcanzable"
            connectionDetail = error.localizedDescription
            googleStatus = "No se ha podido comprobar Google porque la conexión con el servidor ha fallado."
            serverExpanded = true
        }
        checkingGoogle = false
    }
    private func loginWithGoogle() async {
        guard !googleWorking else { return }
        googleWorking = true; defer { googleWorking = false }
        do {
            let base = try Session.validatedServer(server)
            let pkce = try PKCE()
            let authorization: GoogleAuthorization = try await session.publicRequest(server: base, path: "/auth/google/start", method: "POST", body: ["client": "ios", "code_challenge": pkce.challenge])
            guard let url = URL(string: authorization.authorizationUrl), !authorization.state.isEmpty else { throw APIError(message: "El servidor no ha podido preparar el acceso con Google.") }
            let callback = try await googleAuthentication.authenticate(url: url)
            let code = try GoogleCallback.code(from: callback, expectedState: authorization.state)
            try await session.exchangeGoogleCode(server: base, code: code, verifier: pkce.verifier)
        } catch { session.report(error) }
    }
}

struct MainTabs: View {
    @EnvironmentObject var session: Session
    var body: some View {
        VStack(spacing: 0) {
            if session.isDemo {
                HStack {
                    Label("Demo · Datos ficticios", systemImage: "testtube.2").font(.footnote.weight(.medium))
                    Spacer()
                    Button("Salir") { session.exitDemo() }.accessibilityIdentifier("demo.exit")
                }.padding(.horizontal).padding(.vertical, 10).background(.regularMaterial)
            } else if session.connectionUnavailable {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Servidor no disponible").font(.subheadline.weight(.semibold))
                    Button("Reintentar conexión") { Task { await session.refresh() } }.disabled(session.loading)
                    if Session.demoAvailable { LocalDemoEntry() }
                }.padding().frame(maxWidth: .infinity, alignment: .leading).background(.regularMaterial)
            }
            TabView {
                NavigationStack { HomeView() }.tabItem { Label("Hoy", systemImage: "house") }
                NavigationStack { ContactsView() }.tabItem { Label("Personas", systemImage: "person.2") }
                NavigationStack { MessagesView() }.tabItem { Label("Correo", systemImage: "envelope") }
                NavigationStack { AgendaView() }.tabItem { Label("Agenda", systemImage: "calendar") }
                NavigationStack { SettingsView() }.tabItem { Label("Espacio", systemImage: "slider.horizontal.3") }
            }.crmTabBehavior()
        }.task { await session.refresh() }
    }
}

struct LocalDemoEntry: View {
    @EnvironmentObject var session: Session
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button("Abrir demo sin conexión", systemImage: "testtube.2") { session.enterDemo() }
                .accessibilityIdentifier("demo.enter")
            Text("Datos ficticios para probar la app. Los cambios se descartan al salir y nunca se sincronizan.")
                .font(.caption).foregroundStyle(.secondary)
        }
    }
}

struct Avatar: View {
    @EnvironmentObject var session: Session
    @State private var photo: UIImage?
    let contact: Contact
    var size: CGFloat = 44
    var body: some View {
        ZStack {
            Circle().fill(Color(.tertiarySystemFill))
            if let photo { Image(uiImage: photo).resizable().scaledToFill().frame(width: size, height: size).clipShape(Circle()) }
            else { Text(contact.initials).font(.system(size: size * 0.32, weight: .semibold)).foregroundStyle(Color.crmAccent) }
        }.frame(width: size, height: size).accessibilityHidden(true)
        .task(id: contact.avatarUrl) {
            guard let url = contact.avatarUrl else { return }
            if let data = try? await session.avatarData(url) { photo = UIImage(data: data) }
        }
        // Only authenticated images hosted by this CRM are fetched; never third-party trackers.
    }
}
struct ContactRow: View {
    let contact: Contact
    var body: some View {
        HStack(spacing: 12) {
            Avatar(contact: contact)
            VStack(alignment: .leading, spacing: 3) { Text(contact.displayName).font(.body.weight(.medium)); Text(contact.jobTitle ?? contact.email ?? "Contacto").font(.subheadline).foregroundStyle(.secondary) }
        }
    }
}
struct EmptyState: View {
    let title: String; let detail: String; let icon: String
    var body: some View { ContentUnavailableView(title, systemImage: icon, description: Text(detail)) }
}

struct HomeView: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var drafts: DraftStore
    @State private var capture = false
    @State private var pending = false
    @State private var createTask = false
    @State private var selectedDay = Calendar.current.startOfDay(for: .now)
    private var schedule: CRMDaySchedule { CRMDaySchedule(tasks: session.tasks, day: selectedDay) }
    private var isToday: Bool { Calendar.current.isDateInToday(selectedDay) }
    private var upcomingEvents: [CRMEvent] {
        session.events.filter { event in
            guard let date = crmDate(event.startsAt) else { return true }
            return date >= Calendar.current.startOfDay(for: selectedDay)
        }.sorted { (crmDate($0.startsAt) ?? .distantFuture) < (crmDate($1.startsAt) ?? .distantFuture) }
    }
    var body: some View {
        List {
            Group {
                VStack(alignment: .leading, spacing: 12) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(selectedDay, format: .dateTime.weekday(.wide).day().month(.wide))
                            .font(.subheadline).foregroundStyle(.secondary)
                        Text("\(schedule.pending.count) \(schedule.pending.count == 1 ? "pendiente" : "pendientes") · \(schedule.overdueCount) \(schedule.overdueCount == 1 ? "vencida" : "vencidas")")
                            .font(.footnote).foregroundStyle(.secondary)
                    }
                    CRMWeekStrip(selection: $selectedDay)
                }.listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 4, trailing: 20))
            }
            Group {
                CRMSectionTitle(title: isToday ? "Pendiente" : "Ese día")
                if schedule.primary.isEmpty {
                    CRMQuietRow(title: isToday ? "Todo al día" : "Sin tareas para este día", detail: "Puedes añadir un seguimiento desde el botón +.", icon: "checkmark.circle")
                }
                ForEach(schedule.primary) { TaskRow(task: $0, showsContact: true) }
            }
            if isToday && !schedule.tomorrow.isEmpty {
                Group { CRMSectionTitle(title: "Mañana"); ForEach(schedule.tomorrow) { TaskRow(task: $0, showsContact: true) } }
            }
            if isToday && !schedule.later.isEmpty {
                Group { CRMSectionTitle(title: "Más adelante"); ForEach(schedule.later) { TaskRow(task: $0, showsContact: true) } }
            }
            Group {
                CRMSectionTitle(title: "Próximos encuentros")
                if upcomingEvents.isEmpty { CRMQuietRow(title: "Agenda despejada", detail: "Añade tu próximo encuentro desde Agenda.", icon: "calendar") }
                ForEach(Array(upcomingEvents.prefix(3))) { event in
                    NavigationLink { EventDetail(event: event) } label: { EventRow(event: event) }
                }
            }
            if let scope = session.scope, !drafts.visible(to: scope).isEmpty {
                Group {
                    Button { pending = true } label: {
                        HStack { Label("Notas en el dispositivo", systemImage: "tray"); Spacer(); Text("\(drafts.visible(to: scope).count)").foregroundStyle(.secondary) }
                    }
                }
            }
            if let error = drafts.storageError { Text(error).font(.footnote).foregroundStyle(.red) }
            if session.loading { ProgressView("Actualizando…").listRowSeparator(.hidden) }
        }.crmScreen().navigationTitle("Hoy").navigationBarTitleDisplayMode(.large)
            .toolbar {
                CRMWorkspaceToolbar()
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Nueva nota", systemImage: "square.and.pencil") { capture = true }.accessibilityIdentifier("home.capture")
                        Button("Añadir seguimiento", systemImage: "checkmark.circle") { createTask = true }
                        NavigationLink { SettingsView() } label: { Label("Tu cuenta y empresa", systemImage: "person.crop.circle") }
                    } label: { Image(systemName: "plus") }.accessibilityLabel("Añadir o gestionar").accessibilityIdentifier("home.add")
                }
            }
            .refreshable { await session.refresh() }
            .sheet(isPresented: $capture) { NoteComposer() }
            .sheet(isPresented: $pending) { NavigationStack { DraftsView() } }
            .sheet(isPresented: $createTask) { TaskComposer() }
    }
}

struct CRMWeekStrip: View {
    @Binding var selection: Date
    @Environment(\.dynamicTypeSize) private var typeSize
    private var days: [Date] {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        let start = calendar.dateInterval(of: .weekOfYear, for: .now)?.start ?? .now
        return (0..<7).compactMap { calendar.date(byAdding: .day, value: $0, to: start) }
    }
    var body: some View {
        if typeSize.isAccessibilitySize {
            DatePicker("Día", selection: $selection, displayedComponents: .date)
        } else {
            HStack(spacing: 2) {
                ForEach(days, id: \.self) { day in
                    Button { selection = day } label: {
                        VStack(spacing: 8) {
                            Text(day, format: .dateTime.weekday(.abbreviated)).font(.caption)
                                .foregroundStyle(Calendar.current.isDate(day, inSameDayAs: selection) ? .primary : .secondary)
                            Text(day, format: .dateTime.day()).font(.title3.weight(.semibold))
                        }.frame(maxWidth: .infinity, minHeight: 64)
                    }.buttonStyle(.plain)
                        .background {
                            if Calendar.current.isDate(day, inSameDayAs: selection) {
                                Color.clear.crmGlassSurface()
                            }
                        }
                        .accessibilityIdentifier("home.day.\(Calendar.current.component(.weekday, from: day))")
                        .accessibilityLabel(day.formatted(.dateTime.locale(Locale(identifier: "es_ES")).weekday(.wide).day().month()))
                        .accessibilityAddTraits(Calendar.current.isDate(day, inSameDayAs: selection) ? [.isSelected] : [])
                }
            }.padding(.vertical, 4)
        }
    }
}

struct ContactsView: View {
    @EnvironmentObject var session: Session
    @State private var search = ""
    @State private var results: [Contact]?
    @State private var searching = false
    @State private var create = false
    var displayed: [Contact] { results ?? session.contacts }
    var body: some View {
        List {
            CRMSearchField(text: $search)
                .listRowSeparator(.hidden).listRowInsets(EdgeInsets(top: 4, leading: 20, bottom: 20, trailing: 20))
            if displayed.isEmpty && !searching { EmptyState(title: search.isEmpty ? "Aún no hay personas" : "Sin resultados", detail: search.isEmpty ? "Añade un contacto para empezar a construir su historia." : "Prueba con otro nombre o correo.", icon: "person.crop.circle.badge.plus") }
            ForEach(displayed) { contact in NavigationLink { ContactDetail(contact: contact) } label: { ContactRow(contact: contact) } }
            if searching { ProgressView().listRowSeparator(.hidden) }
            if !displayed.isEmpty && displayed.count < 100 {
                Text("\(displayed.count) \(displayed.count == 1 ? "persona" : "personas")")
                    .font(.footnote).foregroundStyle(.secondary).frame(maxWidth: .infinity)
                    .padding(.vertical, 20).listRowSeparator(.hidden)
            }
            if displayed.count >= 100 { Text("Mostrando los primeros 100 resultados. Afina la búsqueda para encontrar una persona.").font(.caption).foregroundStyle(.secondary) }
        }.crmScreen().navigationTitle("Personas").navigationBarTitleDisplayMode(.large).scrollDismissesKeyboard(.interactively).toolbar { CRMWorkspaceToolbar(); ToolbarItem(placement: .topBarTrailing) { Button { create = true } label: { Image(systemName: "plus") }.accessibilityLabel("Añadir contacto") } }
            .sheet(isPresented: $create) { ContactComposer() }.refreshable { await session.refresh(); if search.isEmpty { results = nil } }
            .task(id: search) {
                let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !query.isEmpty else { results = nil; searching = false; return }
                searching = true
                do {
                    try await Task.sleep(for: .milliseconds(300))
                    let escaped = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "&+=?#"))) ?? ""
                    let found: [Contact] = try await session.request("/contacts?per_page=100&search=\(escaped)")
                    try Task.checkCancellation(); results = found; searching = false
                } catch { if !(error is CancellationError) { searching = false; session.report(error) } }
            }
    }
}

struct ContactDetail: View {
    @EnvironmentObject var session: Session
    @Environment(\.dynamicTypeSize) private var typeSize
    let contact: Contact
    @State private var loaded: Contact?
    @State private var note = false
    @State private var task = false
    var person: Contact { loaded ?? contact }
    private var notes: [CRMNote] { session.notes.filter { $0.contactId == person.id } }
    private var tasks: [CRMTask] { session.tasks.filter { $0.contactId == person.id } }
    private var messages: [MailMessage] { session.messages.filter { $0.contactId == person.id } }
    private var currentCompanies: String {
        (person.affiliations ?? []).filter { $0.endedOn == nil }.map(\.companyLabel).joined(separator: " · ")
    }
    var body: some View {
        List {
            Group {
                VStack(spacing: 14) {
                    Avatar(contact: person, size: 80)
                    VStack(spacing: 6) {
                        Text(person.displayName).font(.title.weight(.bold))
                        if let title = person.jobTitle { Text(title).font(.body).foregroundStyle(.secondary) }
                        if !currentCompanies.isEmpty { Text(currentCompanies).font(.body).foregroundStyle(.secondary) }
                    }.multilineTextAlignment(.center)
                }.frame(maxWidth: .infinity).padding(.top, 20).padding(.bottom, 12)
                    .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20))
                    .listRowSeparator(.hidden)
                let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 12)) : AnyLayout(HStackLayout(spacing: 12))
                layout { noteButton; taskButton }.padding(.top, 8).padding(.bottom, 8)
                    .listRowInsets(EdgeInsets(top: 0, leading: 20, bottom: 0, trailing: 20)).listRowSeparator(.hidden)
            }
            Group {
                CRMSectionTitle(title: "Datos")
                if let email = person.email, let url = URL(string: "mailto:" + email) {
                    Link(destination: url) { Label(email, systemImage: "envelope").padding(.vertical, 3) }
                }
                if let phone = person.phone, let url = URL(string: "tel:" + phone.filter { $0.isNumber || $0 == "+" }) {
                    Link(destination: url) { Label(phone, systemImage: "phone").padding(.vertical, 3) }
                }
                if let linkedIn = person.linkedinUrl, let url = URL(string: linkedIn), ["http", "https"].contains(url.scheme) {
                    Link(destination: url) { Label("Perfil de LinkedIn", systemImage: "link").padding(.vertical, 3) }
                }
            }
            if let affiliations = person.affiliations, !affiliations.isEmpty {
                Group {
                    CRMSectionTitle(title: "Trayectoria")
                    ForEach(affiliations) { affiliation in
                        HStack(alignment: .top, spacing: 16) {
                            Image(systemName: "building.2").font(.system(size: 20)).frame(width: 28).accessibilityHidden(true)
                            VStack(alignment: .leading, spacing: 5) {
                                Text(affiliation.companyLabel).font(.body.weight(.medium))
                                Text(affiliation.role ?? "Relación profesional").font(.subheadline).foregroundStyle(.secondary)
                                Text("\(affiliationDate(affiliation.startedOn)) · \(affiliation.endedOn.map { affiliationDate($0) } ?? "Actualidad")")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }.padding(.vertical, 6)
                    }
                }
            }
            Group {
                CRMSectionTitle(title: "Notas")
                ForEach(notes) { note in
                    HStack(alignment: .top, spacing: 16) {
                        Image(systemName: note.visibility == "workspace" ? "person.2" : "lock")
                            .font(.system(size: 20)).frame(width: 28).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 7) {
                            Text(note.body)
                            Text(note.visibility == "workspace" ? "Compartida con la empresa" : "Privada · Solo tú")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }.padding(.vertical, 6)
                }
                if notes.isEmpty { Text("Todavía no hay notas disponibles.").font(.subheadline).foregroundStyle(.secondary).padding(.vertical, 8) }
            }
            if !tasks.isEmpty {
                CRMSectionTitle(title: "Seguimientos")
                ForEach(tasks) { TaskRow(task: $0) }
            }
            if !messages.isEmpty {
                Group {
                    CRMSectionTitle(title: "Conversaciones")
                    ForEach(messages) { mail in NavigationLink { MessageDetail(messageId: mail.id) } label: { MailRow(message: mail) } }
                    Text("Solo aparecen los mensajes autorizados para ti.")
                        .font(.caption).foregroundStyle(.secondary).listRowSeparator(.hidden)
                }
            }
        }.crmScreen().environment(\.defaultMinListRowHeight, 44).navigationTitle("Contacto").navigationBarTitleDisplayMode(.inline)
            .task { do { loaded = try await session.request("/contacts/\(contact.id)") } catch { session.report(error) } }
            .sheet(isPresented: $note) { NoteComposer(contact: person) }.sheet(isPresented: $task) { TaskComposer(contact: person) }
    }
    private var noteButton: some View {
        Button { note = true } label: {
            Group {
                if typeSize.isAccessibilitySize { Text("Añadir nota") }
                else { Label("Añadir nota", systemImage: "square.and.pencil") }
            }.font(.subheadline.weight(.medium)).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 36).padding(.vertical, 4)
        }.crmAction().controlSize(.regular).accessibilityIdentifier("contact.note")
    }
    private var taskButton: some View {
        Button { task = true } label: {
            Group {
                if typeSize.isAccessibilitySize { Text("Seguimiento") }
                else { Label("Seguimiento", systemImage: "checkmark.circle") }
            }.font(.subheadline.weight(.medium)).multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, minHeight: 36).padding(.vertical, 4)
        }.crmAction().controlSize(.regular).accessibilityIdentifier("contact.followUp")
    }
}

struct ContactComposer: View {
    @EnvironmentObject var session: Session
    @Environment(\.dismiss) var dismiss
    @State private var firstName = ""; @State private var lastName = ""; @State private var email = ""; @State private var phone = ""; @State private var title = ""; @State private var saving = false
    var body: some View {
        NavigationStack { Form {
            Section("Persona") { TextField("Nombre", text: $firstName).textContentType(.givenName); TextField("Apellidos", text: $lastName).textContentType(.familyName); TextField("Cargo", text: $title) }
            Section("Contacto") { TextField("Correo", text: $email).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled(); TextField("Teléfono", text: $phone).keyboardType(.phonePad) }
            Section { Text("Crear una persona no comparte sus conversaciones. Los contactos con el mismo nombre no se fusionan automáticamente.").font(.footnote).foregroundStyle(.secondary) }
        }.crmScreen().navigationTitle("Nueva persona").toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() }.disabled(saving) }; ToolbarItem(placement: .confirmationAction) { Button("Crear") { Task {
            saving = true; defer { saving = false }
            do {
                var body: [String: Any] = ["first_name": firstName.trimmingCharacters(in: .whitespacesAndNewlines), "last_name": lastName]
                if !email.isEmpty { body["email"] = email }; if !phone.isEmpty { body["phone"] = phone }; if !title.isEmpty { body["job_title"] = title }
                let contact: Contact = try await session.request("/contacts", method: "POST", body: body); session.contacts.insert(contact, at: 0); dismiss()
            } catch { session.report(error) }
        } }.disabled(firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || saving) } } }.interactiveDismissDisabled(saving)
    }
}
