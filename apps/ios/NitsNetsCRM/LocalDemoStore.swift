import Foundation

/// Explicit, ephemeral fixtures for local builds. Never persists or calls a transport.
@MainActor final class LocalDemoStore {
    let credentials: Credentials
    private var rows: [String: [[String: Any]]]
    private let members: [[String: Any]]
    init() {
        let user = User(id: "demo-user", name: "Alex Demo", email: "alex@example.test")
        let workspace = Workspace(id: "demo-workspace", name: "Estudio Demo · Ficticio")
        credentials = Credentials(token: "", user: user, workspace: workspace, workspaces: [workspace], server: "demo://\(UUID().uuidString)")
        members = [
            ["id": user.id, "name": user.name, "email": user.email],
            ["id": "demo-colleague", "name": "Marina Demo", "email": "marina@example.test"]
        ]
        let today = ISO8601DateFormatter().string(from: .now)
        let tomorrow = ISO8601DateFormatter().string(from: Date.now.addingTimeInterval(86400))
        rows = [
            "contacts": [
                ["id": "demo-contact-1", "first_name": "Lucía", "last_name": "Ejemplo", "email": "lucia@example.test", "job_title": "Directora creativa", "affiliations": [["id": "demo-affiliation", "company_id": "demo-company", "company_name": "Estudio Ejemplo", "role": "Directora creativa", "started_on": "2024-01-01"]]],
                ["id": "demo-contact-2", "first_name": "Pablo", "last_name": "Muestra", "email": "pablo@example.test", "job_title": "Responsable de producto"]
            ],
            "tasks": [
                ["id": "demo-task-1", "title": "Preparar el próximo encuentro", "contact_id": "demo-contact-1", "status": "pending", "due_at": today],
                ["id": "demo-task-2", "title": "Revisar necesidades del proyecto", "contact_id": "demo-contact-2", "status": "pending", "due_at": tomorrow]
            ],
            "notes": [["id": "demo-note", "body": "Nota ficticia: le interesa una propuesta sencilla para su equipo.", "contact_id": "demo-contact-1", "visibility": "private", "author_name": user.name, "created_at": today]],
            "events": [["id": "demo-event", "name": "Encuentro de ejemplo", "location": "Estudio Ejemplo", "starts_at": tomorrow, "notes": "Revisar objetivos y siguientes pasos.", "contact_ids": ["demo-contact-1"]]],
            "messages": [
                ["id": "demo-mail", "subject": "Propuesta para el próximo encuentro", "from_email": "lucia@example.test", "from_name": "Lucía Ejemplo", "received_at": today, "body_text": "Este email es ficticio. Podemos revisar los objetivos en nuestro próximo encuentro. Puedes probar quién tendría acceso desde los permisos del mensaje.", "contact_id": "demo-contact-1", "participants": [members[0]], "grants": [], "can_share": true],
                ["id": "demo-shared-mail", "subject": "Mensaje compartido de ejemplo", "from_email": "pablo@example.test", "from_name": "Pablo Muestra", "received_at": today, "body_text": "Mensaje ficticio compartido contigo. Puedes leerlo, pero solo sus participantes originales pueden cambiar los permisos.", "contact_id": "demo-contact-2", "participants": [members[1]], "grants": [["id": "demo-existing-grant", "user_id": user.id, "name": user.name]], "can_share": false]
            ]
        ]
    }

    func request<T: Decodable>(_ path: String, method: String, body: [String: Any]?) throws -> T {
        let components = URLComponents(string: "https://example.test" + path)
        let parts = (components?.path ?? "").split(separator: "/").map(String.init)
        let payload = body ?? [:]
        let response: Any
        if path == "/me", method == "GET" {
            response = ["user": members[0], "workspace": ["id": credentials.workspace.id, "name": credentials.workspace.name], "workspaces": [["id": credentials.workspace.id, "name": credentials.workspace.name]]] as [String: Any]
        } else if path == "/members", method == "GET" {
            response = members
        } else if path == "/dashboard", method == "GET" {
            response = ["contacts_count": rows["contacts"]!.count, "companies_count": 1, "open_opportunities_count": 0, "pipeline_value_minor": 0, "tasks_due_count": rows["tasks"]!.filter { $0["status"] as? String != "completed" }.count]
        } else if parts.count >= 3, parts[0] == "messages", parts[2] == "grants",
                  let index = rows["messages"]?.firstIndex(where: { $0["id"] as? String == parts[1] }) {
            var message = rows["messages"]![index]
            guard message["can_share"] as? Bool == true else { throw APIError(message: "Solo los participantes originales pueden compartir este mensaje de ejemplo.") }
            var grants = message["grants"] as? [[String: Any]] ?? []
            if method == "POST", parts.count == 3, let userId = payload["user_id"] as? String,
               let member = members.first(where: { $0["id"] as? String == userId }), userId != credentials.user.id {
                if !grants.contains(where: { $0["user_id"] as? String == userId }) {
                    grants.append(["id": UUID().uuidString, "user_id": userId, "name": member["name"]!])
                }
            } else if method == "DELETE", parts.count == 4 {
                guard grants.contains(where: { $0["id"] as? String == parts[3] }) else { throw unavailable() }
                grants.removeAll { $0["id"] as? String == parts[3] }
            } else { throw unavailable() }
            message["grants"] = grants
            rows["messages"]![index] = message
            response = method == "DELETE" ? [:] : message
        } else if let collection = parts.first, var items = rows[collection] {
            if method == "GET", parts.count == 1 {
                if collection == "contacts", let search = components?.queryItems?.first(where: { $0.name == "search" })?.value, !search.isEmpty {
                    items = items.filter { item in ["first_name", "last_name", "email"].compactMap { item[$0] as? String }.joined(separator: " ").localizedCaseInsensitiveContains(search) }
                }
                response = items
            } else if method == "GET", parts.count == 2, let item = items.first(where: { $0["id"] as? String == parts[1] }) {
                response = item
            } else if method == "POST", parts.count == 1, ["contacts", "tasks", "notes", "events"].contains(collection) {
                var item = payload
                item["id"] = UUID().uuidString
                if collection == "notes" { item["visibility"] = "private"; item["author_name"] = credentials.user.name; item["created_at"] = ISO8601DateFormatter().string(from: .now) }
                if let contact = item["contact_id"] as? String, !rows["contacts"]!.contains(where: { $0["id"] as? String == contact }) { throw unavailable() }
                items.insert(item, at: 0); rows[collection] = items; response = item
            } else if method == "PATCH", collection == "tasks", parts.count == 2,
                      let index = items.firstIndex(where: { $0["id"] as? String == parts[1] }),
                      let status = payload["status"] as? String, ["pending", "completed"].contains(status) {
                items[index]["status"] = status; rows[collection] = items; response = items[index]
            } else { throw unavailable() }
        } else { throw unavailable() }
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: JSONSerialization.data(withJSONObject: response))
    }
    private func unavailable() -> APIError { APIError(message: "Esta acción no está disponible en la demo local. No se ha enviado nada al servidor.") }
}
