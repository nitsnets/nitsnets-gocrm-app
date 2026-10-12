import SwiftUI

enum ConnectionFeedback {
    static func message(for error: URLError) -> String {
        switch error.code {
        case .timedOut:
            return "El servidor no respondió a tiempo. Si usas el servidor local, comprueba que el Mac esté encendido, que la API esté en marcha y que ambos dispositivos estén en la misma Wi-Fi. Después, reintenta la conexión."
        case .notConnectedToInternet, .dataNotAllowed, .internationalRoamingOff:
            return "No hay conexión disponible. Revisa la Wi-Fi y el permiso Red local de gocrm en Ajustes. Para el servidor local, el iPhone y el Mac deben estar en la misma red."
        case .cannotFindHost, .dnsLookupFailed:
            return "No se encuentra el servidor. Comprueba la dirección. Si termina en .local, conecta el iPhone a la misma Wi-Fi que el Mac y mantén el Mac encendido."
        case .cannotConnectToHost, .networkConnectionLost:
            return "No se puede conectar con el servidor. Comprueba que la API esté en marcha, que el Mac esté encendido y que ambos estén en la misma Wi-Fi. Revisa también el permiso Red local de gocrm en Ajustes."
        case .appTransportSecurityRequiresSecureConnection:
            return "Esta dirección necesita HTTPS. Para desarrollo en la red local, usa el nombre .local del Mac."
        case .secureConnectionFailed, .serverCertificateHasBadDate, .serverCertificateUntrusted, .serverCertificateHasUnknownRoot, .serverCertificateNotYetValid:
            return "No se pudo verificar la conexión segura del servidor. Revisa su dirección y certificado HTTPS."
        default:
            return "No se pudo completar la conexión con el servidor. Comprueba la red y vuelve a intentarlo."
        }
    }
}

@MainActor final class Session: ObservableObject {
    @Published private(set) var credentials: Credentials?
    @Published private(set) var busy = false
    @Published private(set) var isDemo = false
    @Published private(set) var connectionUnavailable = false
    private var demo: LocalDemoStore?
    private var liveCredentials: Credentials?
    static var demoAvailable: Bool {
        #if DEBUG
        return true
        #else
        return false
        #endif
    }
    @Published var alert: String?
    @Published var contacts: [Contact] = []
    @Published var tasks: [CRMTask] = []
    @Published var notes: [CRMNote] = []
    @Published var messages: [MailMessage] = []
    @Published var events: [CRMEvent] = []
    @Published var dashboard: Dashboard?
    @Published var loading = false
    private var generation = UUID()
    private let transport: URLSession
    private static func makeTransport() -> URLSession {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }
    var scope: DraftScope? { credentials.map(DraftScope.init) }
    var identityKey: String { credentials.map { "\($0.server)|\($0.user.id)|\($0.workspace.id)" } ?? "signed-out" }
    init(loadSavedSession: Bool = true, credentials: Credentials? = nil, transport: URLSession? = nil) {
        self.credentials = loadSavedSession ? SecureSession.load() : credentials
        self.transport = transport ?? Self.makeTransport()
    }
    func enterDemo() {
        guard Self.demoAvailable, !isDemo, !busy else { return }
        liveCredentials = credentials
        let store = LocalDemoStore()
        clearData(); alert = nil; demo = store; isDemo = true; credentials = store.credentials
    }
    func exitDemo() {
        guard isDemo else { return }
        clearData(); alert = nil; demo = nil; isDemo = false
        credentials = liveCredentials; liveCredentials = nil
    }
    static var initialServer: String {
        if let saved = UserDefaults.standard.string(forKey: "apiBaseURL"), !saved.isEmpty { return saved }
        if let configured = Bundle.main.object(forInfoDictionaryKey: "CRMDefaultAPIURL") as? String, !configured.isEmpty, !configured.contains("$(") { return configured }
        #if targetEnvironment(simulator)
        return "http://127.0.0.1:8000/api/v1"
        #else
        return ""
        #endif
    }
    static func validatedServer(_ input: String) throws -> String {
        let value = input.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: value), let host = url.host, !host.isEmpty, ["http", "https"].contains(url.scheme), url.user == nil, url.password == nil, url.query == nil, url.fragment == nil else { throw APIError(message: "Introduce la URL del servidor, por ejemplo https://crm.tuempresa.es/api/v1.") }
        let components = host.split(separator: ".", omittingEmptySubsequences: false)
        let octets = components.compactMap { UInt8($0) }
        let privateIPv4 = components.count == 4 && octets.count == 4 && (octets[0] == 10 || (octets[0] == 192 && octets[1] == 168) || (octets[0] == 172 && (16...31).contains(octets[1])))
        let local = ["localhost", "127.0.0.1", "::1"].contains(host) || host.hasSuffix(".local") || privateIPv4
        guard url.scheme == "https" || local else { throw APIError(message: "Usa HTTPS para un servidor público. HTTP solo está permitido en desarrollo local.") }
        return value
    }
    func avatarData(_ value: String) async throws -> Data? {
        guard !isDemo, let current = credentials, let base = URL(string: current.server), let url = URL(string: value, relativeTo: base)?.absoluteURL,
              url.scheme == base.scheme, url.host == base.host, url.port == base.port else { return nil }
        let stamp = generation
        var request = URLRequest(url: url)
        request.setValue("Bearer \(current.token)", forHTTPHeaderField: "Authorization")
        request.setValue(current.workspace.id, forHTTPHeaderField: "X-Workspace-ID")
        let (data, response) = try await transport.data(for: request)
        guard generation == stamp, (response as? HTTPURLResponse)?.statusCode == 200, data.count < 5_000_000 else { return nil }
        return data
    }
    func login(server: String, email: String, password: String) async {
        busy = true; defer { busy = false }
        do {
            let base = try Self.validatedServer(server)
            let login: LoginResponse = try await publicRequest(server: base, path: "/auth/login", method: "POST", body: ["email": email.trimmingCharacters(in: .whitespacesAndNewlines), "password": password])
            try establishSession(login, server: base)
        } catch { report(error) }
    }
    func publicRequest<T: Decodable>(server: String, path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> T {
        guard !isDemo else { throw APIError(message: "La demo no conecta con servicios externos.") }
        let stamp = generation
        let base = try Self.validatedServer(server)
        var request = URLRequest(url: URL(string: base + path)!)
        request.httpMethod = method; request.timeoutInterval = 25
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let result: T = try await send(request)
        guard stamp == generation else { throw CancellationError() }
        return result
    }
    func exchangeGoogleCode(server: String, code: String, verifier: String) async throws {
        busy = true; defer { busy = false }
        let base = try Self.validatedServer(server)
        let login: LoginResponse = try await publicRequest(server: base, path: "/auth/google/exchange", method: "POST", body: ["code": code, "code_verifier": verifier])
        try establishSession(login, server: base)
    }
    private func establishSession(_ login: LoginResponse, server: String) throws {
        let value = Credentials(token: login.token, user: login.user, workspace: login.workspace, workspaces: login.workspaces, server: server)
        try SecureSession.save(value); clearData(); credentials = value
        UserDefaults.standard.set(server, forKey: "apiBaseURL")
    }
    func request<T: Decodable>(_ path: String, method: String = "GET", body: [String: Any]? = nil, workspace: Bool = true) async throws -> T {
        if let demo { return try demo.request(path, method: method, body: body) }
        guard let current = credentials else { throw APIError(message: "Inicia sesión para continuar.") }
        let stamp = generation
        var request = URLRequest(url: URL(string: current.server + path)!)
        request.httpMethod = method; request.timeoutInterval = 25
        request.setValue("Bearer \(current.token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if workspace { request.setValue(current.workspace.id, forHTTPHeaderField: "X-Workspace-ID") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        do {
            let result: T = try await send(request)
            guard stamp == generation else { throw CancellationError() }
            return result
        } catch {
            guard stamp == generation else { throw CancellationError() }
            if error is ConnectionFailure || (error as? HTTPFailure).map({ $0.status >= 500 }) == true { connectionUnavailable = true }
            if let error = error as? HTTPFailure, error.status == 401 { signOutLocally() }
            throw error
        }
    }
    private struct ConnectionFailure: LocalizedError { let message: String; var errorDescription: String? { message } }
    private struct HTTPFailure: LocalizedError { let status: Int; let message: String; var errorDescription: String? { message } }
    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do { (data, response) = try await transport.data(for: request) }
        catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw ConnectionFailure(message: ConnectionFeedback.message(for: error))
        }
        guard let response = response as? HTTPURLResponse else { throw APIError(message: "Respuesta del servidor no válida.") }
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard (200..<300).contains(response.statusCode) else {
            let message = (try? decoder.decode(APIErrorEnvelope.self, from: data))?.error.message
            throw HTTPFailure(status: response.statusCode, message: message ?? "El servidor respondió con el código \(response.statusCode).")
        }
        if response.statusCode == 204, let empty = EmptyResponse() as? T { return empty }
        do { return try decoder.decode(Envelope<T>.self, from: data).data }
        catch { throw APIError(message: "La respuesta del servidor no coincide con el contrato API. \(error.localizedDescription)") }
    }
    func refresh() async {
        guard credentials != nil, !loading else { return }
        let stamp = generation
        loading = true; defer { if stamp == generation { loading = false } }
        do {
            let identity: IdentityResponse = try await request("/me", workspace: false)
            guard stamp == generation, let current = credentials else { return }
            if identity.workspace.id != current.workspace.id {
                clearData()
                credentials = Credentials(token: current.token, user: identity.user, workspace: identity.workspace, workspaces: identity.workspaces, server: current.server)
                try SecureSession.save(credentials!)
                return
            }
            async let loadedContacts: [Contact] = request("/contacts?per_page=100")
            async let loadedTasks: [CRMTask] = request("/tasks?per_page=100")
            async let loadedNotes: [CRMNote] = request("/notes?per_page=100")
            async let loadedMessages: [MailMessage] = request("/messages?per_page=100")
            async let loadedEvents: [CRMEvent] = request("/events?per_page=100")
            async let loadedDashboard: Dashboard = request("/dashboard")
            let result = try await (loadedContacts, loadedTasks, loadedNotes, loadedMessages, loadedEvents, loadedDashboard)
            guard stamp == generation else { return }
            connectionUnavailable = false
            contacts = result.0; tasks = result.1; notes = result.2; messages = result.3; events = result.4; dashboard = result.5
        } catch { report(error) }
    }
    func refreshMessages() async throws {
        let stamp = generation
        do {
            let loaded: [MailMessage] = try await request("/messages?per_page=100")
            guard stamp == generation else { throw CancellationError() }
            messages = loaded
        } catch {
            if stamp == generation { messages = [] }
            throw error
        }
    }
    func switchWorkspace(_ id: String) async {
        guard !isDemo else { return }
        guard let current = credentials, id != current.workspace.id else { return }
        busy = true; clearData()
        defer { busy = false }
        do {
            let result: WorkspaceResponse = try await request("/session/workspace", method: "POST", body: ["workspace_id": id], workspace: false)
            let value = Credentials(token: current.token, user: current.user, workspace: result.workspace, workspaces: result.workspaces, server: current.server)
            credentials = value
            do { try SecureSession.save(value) } catch { signOutLocally(); throw error }
        } catch { report(error) }
    }
    func logout() async {
        if isDemo { exitDemo(); return }
        busy = true
        do { let _: EmptyResponse = try await request("/auth/logout", method: "POST", workspace: false) }
        catch { alert = "La sesión local se ha cerrado. No se pudo confirmar la revocación del token en el servidor; revisa las sesiones desde la web si estabas sin conexión." }
        signOutLocally(); busy = false
    }
    private func signOutLocally() { clearData(); credentials = nil; SecureSession.clear() }
    private func clearData() { generation = UUID(); connectionUnavailable = false; contacts = []; tasks = []; notes = []; messages = []; events = []; dashboard = nil; loading = false }
    func report(_ error: Error) { if !(error is CancellationError) { alert = error.localizedDescription } }
    func saveNote(body: String, contactId: String?, draftId: UUID? = nil) async throws -> CRMNote {
        let stamp = generation
        var payload: [String: Any] = ["body": body, "visibility": "private"]
        if let contactId { payload["contact_id"] = contactId }
        if let draftId { payload["client_request_id"] = draftId.uuidString.lowercased() }
        let note: CRMNote = try await request("/notes", method: "POST", body: payload)
        guard stamp == generation else { throw CancellationError() }
        if let index = notes.firstIndex(where: { $0.id == note.id }) { notes[index] = note }
        else { notes.insert(note, at: 0) }; return note
    }
}
