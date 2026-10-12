import Foundation

struct Envelope<T: Decodable>: Decodable { let data: T }
struct Workspace: Codable, Identifiable, Equatable { let id: String; let name: String }
struct User: Codable, Identifiable, Equatable { let id: String; let name: String; let email: String }
struct LoginResponse: Decodable { let token: String; let user: User; let workspace: Workspace; let workspaces: [Workspace] }
struct IdentityResponse: Decodable { let user: User; let workspace: Workspace; let workspaces: [Workspace] }
struct WorkspaceResponse: Decodable { let workspace: Workspace; let workspaces: [Workspace] }
struct Credentials: Codable { var token: String; var user: User; var workspace: Workspace; var workspaces: [Workspace]; let server: String }
struct Company: Decodable, Identifiable { let id: String; let name: String; var domain: String?; var industry: String?; var status: String? }
struct Affiliation: Decodable, Identifiable {
    let id: String; let companyId: String; var company: Company?; var companyName: String?; var role: String?; var startedOn: String?; var endedOn: String?
    var companyLabel: String { company?.name ?? companyName ?? "Empresa" }
}
struct Contact: Decodable, Identifiable {
    let id: String; var firstName: String?; var lastName: String?; var name: String?; var email: String?; var phone: String?; var jobTitle: String?; var linkedinUrl: String?; var notes: String?; var avatarUrl: String?; var affiliations: [Affiliation]?
    var displayName: String { name ?? [firstName, lastName].compactMap { $0 }.joined(separator: " ") }
    var initials: String { displayName.split(separator: " ").prefix(2).compactMap(\.first).map(String.init).joined() }
}
struct CRMNote: Decodable, Identifiable { let id: String; let body: String; var contactId: String?; var companyId: String?; var visibility: String?; var authorName: String?; var createdAt: String? }
struct CRMTask: Decodable, Identifiable { let id: String; let title: String; var contactId: String?; var companyId: String?; var dueAt: String?; var status: String? }
struct Grant: Decodable, Identifiable { let id: String; let userId: String; var name: String? }
struct MailMessage: Decodable, Identifiable {
    let id: String; let subject: String; var fromEmail: String?; var fromName: String?; var receivedAt: String?; var bodyText: String?; var contactId: String?; var participants: [User]?; var grants: [Grant]?; var canShare: Bool?
}
struct CRMEvent: Decodable, Identifiable { let id: String; let name: String; var location: String?; var startsAt: String?; var notes: String?; var contactIds: [String]?; var contacts: [Contact]? }
struct Dashboard: Decodable { let contactsCount: Int; let companiesCount: Int; let openOpportunitiesCount: Int; let pipelineValueMinor: Int; let tasksDueCount: Int }
struct GmailStatus: Decodable { let configured: Bool; let connected: Bool; var email: String?; var lastSyncedAt: String?; let status: String }
struct AuthorizationURL: Decodable { let authorizationUrl: String; var state: String? }
struct QueuedStatus: Decodable { let status: String }
struct EmptyResponse: Decodable {}
struct APIError: LocalizedError { let message: String; var errorDescription: String? { message } }
struct APIErrorEnvelope: Decodable { struct Detail: Decodable { let code: String; let message: String }; let error: Detail }

struct DraftScope: Codable, Equatable {
    let server: String; let userId: String; let workspaceId: String
    init(_ credentials: Credentials) { server = credentials.server; userId = credentials.user.id; workspaceId = credentials.workspace.id }
    init(server: String, userId: String, workspaceId: String) { self.server = server; self.userId = userId; self.workspaceId = workspaceId }
}
struct LocalDraft: Codable, Identifiable {
    var id: UUID = UUID(); let scope: DraftScope; var body: String; var contactId: String?; var contactName: String?; var createdAt: Date = Date()
}
func readableDate(_ value: String?) -> String {
    guard let value else { return "Sin fecha" }
    let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = iso.date(from: value) ?? ISO8601DateFormatter().date(from: value) { return date.formatted(.dateTime.locale(Locale(identifier: "es_ES")).day().month(.abbreviated).year().hour().minute()) }
    return String(value.prefix(10))
}

// Presentation only: all tasks have already been authorized by the API.
func crmDate(_ value: String?) -> Date? {
    guard let value else { return nil }
    let iso = ISO8601DateFormatter()
    iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = iso.date(from: value) ?? ISO8601DateFormatter().date(from: value) { return date }
    let day = DateFormatter()
    day.locale = Locale(identifier: "en_US_POSIX")
    day.dateFormat = "yyyy-MM-dd"
    return day.date(from: value)
}

struct CRMDaySchedule {
    let tasks: [CRMTask]
    let day: Date
    var now: Date = .now
    var calendar: Calendar = .current
    var pending: [CRMTask] {
        tasks.filter { $0.status != "completed" }.sorted {
            (crmDate($0.dueAt) ?? .distantFuture) < (crmDate($1.dueAt) ?? .distantFuture)
        }
    }
    var overdueCount: Int { pending.filter { (crmDate($0.dueAt) ?? .distantFuture) < now }.count }
    private var start: Date { calendar.startOfDay(for: day) }
    private var next: Date { calendar.date(byAdding: .day, value: 1, to: start)! }
    private var afterNext: Date { calendar.date(byAdding: .day, value: 2, to: start)! }
    var primary: [CRMTask] {
        pending.filter {
            if calendar.isDate(day, inSameDayAs: now) { return (crmDate($0.dueAt) ?? start) < next }
            guard let due = crmDate($0.dueAt) else { return false }
            return due >= start && due < next
        }
    }
    var tomorrow: [CRMTask] {
        pending.filter { guard let due = crmDate($0.dueAt) else { return false }; return due >= next && due < afterNext }
    }
    var later: [CRMTask] {
        pending.filter { guard let due = crmDate($0.dueAt) else { return false }; return due >= afterNext }
    }
}

func affiliationDate(_ value: String?) -> String {
    guard let date = crmDate(value) else { return "Sin fecha" }
    return date.formatted(.dateTime.locale(Locale(identifier: "es_ES")).month(.abbreviated).year())
}


extension GmailStatus {
    var isSyncing: Bool { ["queued", "syncing"].contains(status) }
    var needsAuthorization: Bool { status == "reauthorization_required" }
    var label: String {
        switch status {
        case "queued": return "Esperando sincronización"
        case "syncing": return "Sincronizando correo…"
        case "sync_error": return "No se pudo sincronizar"
        case "reauthorization_required": return "Renueva el permiso de Gmail"
        case "connected": return "Gmail conectado"
        case "not_configured": return "Gmail pendiente de configuración"
        default: return "Conecta tu Gmail"
        }
    }
}
