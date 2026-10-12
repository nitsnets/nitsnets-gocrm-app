import Foundation
import Security

final class SecureSession {
    private static let service = "com.nitsnets.crm.session"
    static func save(_ credentials: Credentials) throws {
        let data = try JSONEncoder().encode(credentials)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "current"]
        SecItemDelete(query as CFDictionary)
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else { throw APIError(message: "No se pudo guardar la sesión de forma segura (\(status)).") }
    }
    static func load() -> Credentials? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "current", kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(Credentials.self, from: data)
    }
    static func clear() { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service] as CFDictionary) }
}

@MainActor final class DraftStore: ObservableObject {
    @Published private(set) var drafts: [LocalDraft] = []
    @Published var storageError: String?
    private let url: URL
    init(url: URL? = nil) {
        self.url = url ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("PrivateDrafts/drafts.json")
        do {
            if FileManager.default.fileExists(atPath: self.url.path) { drafts = try JSONDecoder().decode([LocalDraft].self, from: Data(contentsOf: self.url)) }
        } catch { storageError = "No se pudieron leer las notas locales. No guardes nuevas notas hasta recuperar el archivo." }
    }
    func visible(to scope: DraftScope) -> [LocalDraft] { drafts.filter { $0.scope == scope }.sorted { $0.createdAt > $1.createdAt } }
    func add(_ draft: LocalDraft) throws {
        guard storageError == nil else { throw APIError(message: storageError!) }
        var changed = drafts
        if let index = changed.firstIndex(where: { $0.id == draft.id && $0.scope == draft.scope }) { changed[index] = draft }
        else { changed.append(draft) }
        try persist(changed); drafts = changed
    }
    func remove(_ id: UUID, scope: DraftScope) throws {
        let changed = drafts.filter { !($0.id == id && $0.scope == scope) }; try persist(changed); drafts = changed
    }
    private func persist(_ changed: [LocalDraft]) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(changed).write(to: url, options: [.atomic, .completeFileProtection])
        var resource = url; var values = URLResourceValues(); values.isExcludedFromBackup = true; try resource.setResourceValues(values)
    }
}
