import XCTest
@testable import NitsNetsCRM

private final class OfflineTransport: URLProtocol {
    static var calls = 0
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.calls += 1
        client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
    }
    override func stopLoading() {}
}

@MainActor final class LocalDemoTests: XCTestCase {
    private func offlineSession(credentials: Credentials? = nil) -> Session {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [OfflineTransport.self]
        return Session(loadSavedSession: false, credentials: credentials, transport: URLSession(configuration: config))
    }
    func testDemoWorksWithoutNetworkAndDiscardsEdits() async throws {
        OfflineTransport.calls = 0
        let session = offlineSession()
        session.enterDemo()
        await session.refresh()
        XCTAssertTrue(session.isDemo)
        XCTAssertEqual(session.contacts.count, 2)
        XCTAssertEqual(session.messages.count, 2)
        let firstScope = session.scope
        let note = try await session.saveNote(body: "Solo demo", contactId: "demo-contact-1")
        XCTAssertEqual(note.visibility, "private")
        let task: CRMTask = try await session.request("/tasks/demo-task-1", method: "PATCH", body: ["status": "completed"])
        XCTAssertEqual(task.status, "completed")
        let search: [Contact] = try await session.request("/contacts?search=Luc%C3%ADa")
        XCTAssertEqual(search.map(\.id), ["demo-contact-1"])
        let avatar = try await session.avatarData("https://example.test/avatar")
        XCTAssertNil(avatar)
        do {
            let _: AuthorizationURL = try await session.publicRequest(server: "https://example.test", path: "/auth/google")
            XCTFail("Demo must block public transport")
        } catch {}
        XCTAssertEqual(OfflineTransport.calls, 0)
        session.exitDemo()
        XCTAssertNil(session.credentials)
        XCTAssertTrue(session.notes.isEmpty)
        session.enterDemo(); await session.refresh()
        XCTAssertFalse(session.notes.contains { $0.body == "Solo demo" })
        XCTAssertNotEqual(session.scope, firstScope)
        XCTAssertEqual(OfflineTransport.calls, 0)
    }
    func testOfflineFailureDoesNotSilentlyReplaceRealSession() async throws {
        let user = User(id: "real-user", name: "Real", email: "real@example.test")
        let workspace = Workspace(id: "real-workspace", name: "Real workspace")
        let credentials = Credentials(token: "test-token", user: user, workspace: workspace, workspaces: [workspace], server: "https://example.test/api/v1")
        let session = offlineSession(credentials: credentials)
        let keychainBefore = SecureSession.load()
        let defaultBefore = UserDefaults.standard.string(forKey: "apiBaseURL")
        await session.refresh()
        XCTAssertTrue(session.connectionUnavailable)
        XCTAssertFalse(session.isDemo)
        XCTAssertTrue(session.contacts.isEmpty)
        XCTAssertEqual(session.credentials?.user.id, user.id)
        session.enterDemo(); await session.refresh()
        XCTAssertNotEqual(session.scope, DraftScope(credentials))
        XCTAssertEqual(SecureSession.load()?.token, keychainBefore?.token)
        XCTAssertEqual(UserDefaults.standard.string(forKey: "apiBaseURL"), defaultBefore)
        session.exitDemo()
        XCTAssertEqual(session.credentials?.token, credentials.token)
        XCTAssertEqual(session.scope, DraftScope(credentials))
        XCTAssertTrue(session.contacts.isEmpty)
        XCTAssertTrue(session.messages.isEmpty)
    }
    func testFictionalMailPermissionsAndUnsupportedActions() throws {
        let demo = LocalDemoStore()
        let shared: MailMessage = try demo.request("/messages/demo-shared-mail", method: "GET", body: nil)
        XCTAssertEqual(shared.canShare, false)
        XCTAssertThrowsError(try demo.request("/messages/demo-shared-mail/grants", method: "POST", body: ["user_id": "demo-colleague"]) as MailMessage)
        let changed: MailMessage = try demo.request("/messages/demo-mail/grants", method: "POST", body: ["user_id": "demo-colleague"])
        XCTAssertEqual(changed.grants?.first?.userId, "demo-colleague")
        let _: EmptyResponse = try demo.request("/messages/demo-mail/grants/\(try XCTUnwrap(changed.grants?.first?.id))", method: "DELETE", body: nil)
        let restored: MailMessage = try demo.request("/messages/demo-mail", method: "GET", body: nil)
        XCTAssertEqual(restored.grants?.count, 0)
        XCTAssertThrowsError(try demo.request("/integrations/gmail/connect", method: "POST", body: nil) as AuthorizationURL)
        XCTAssertThrowsError(try demo.request("/messages/unknown", method: "GET", body: nil) as MailMessage)
        XCTAssertThrowsError(try demo.request("/notes", method: "POST", body: ["body": "Example", "contact_id": "real-contact"]) as CRMNote)
    }
}
