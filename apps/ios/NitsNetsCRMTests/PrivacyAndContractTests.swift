import XCTest
@testable import NitsNetsCRM

@MainActor final class PrivacyAndContractTests: XCTestCase {
    func testDraftsNeverCrossWorkspaceUserOrServer() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let store = DraftStore(url: folder.appendingPathComponent("notes.json"))
        let original = DraftScope(server: "https://crm.example/api/v1", userId: "eladio", workspaceId: "nitsnets")
        let anotherCompany = DraftScope(server: original.server, userId: original.userId, workspaceId: "other")
        let anotherUser = DraftScope(server: original.server, userId: "alberto", workspaceId: original.workspaceId)
        let anotherServer = DraftScope(server: "https://different.example/api/v1", userId: original.userId, workspaceId: original.workspaceId)
        let note = LocalDraft(scope: original, body: "Solo visible para Eladio en NitsNets", contactId: "bernardo")
        try store.add(note)
        XCTAssertEqual(store.visible(to: original).count, 1)
        XCTAssertTrue(store.visible(to: anotherCompany).isEmpty)
        XCTAssertTrue(store.visible(to: anotherUser).isEmpty)
        XCTAssertTrue(store.visible(to: anotherServer).isEmpty)
        try store.remove(note.id, scope: anotherCompany)
        XCTAssertEqual(store.visible(to: original).count, 1, "Another workspace cannot delete the original draft")
        let reloaded = DraftStore(url: folder.appendingPathComponent("notes.json"))
        XCTAssertEqual(reloaded.visible(to: original).first?.id, note.id, "Stable UUID survives restart for safe request replay")
        try reloaded.remove(note.id, scope: original)
        XCTAssertTrue(reloaded.visible(to: original).isEmpty)
    }
    func testCorruptDraftStorageIsNotOverwritten() throws {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let url = folder.appendingPathComponent("notes.json")
        let corrupted = Data("incomplete data".utf8)
        try corrupted.write(to: url)
        let store = DraftStore(url: url)
        XCTAssertNotNil(store.storageError)
        XCTAssertThrowsError(try store.add(LocalDraft(scope: DraftScope(server: "s", userId: "u", workspaceId: "w"), body: "New")))
        XCTAssertEqual(try Data(contentsOf: url), corrupted)
    }
    func testPublicServersRequireHTTPSAndCannotEmbedCredentials() throws {
        XCTAssertEqual(try Session.validatedServer(" https://crm.example/api/v1/ "), "https://crm.example/api/v1")
        XCTAssertThrowsError(try Session.validatedServer("http://crm.example/api/v1"))
        XCTAssertThrowsError(try Session.validatedServer("http://10.evil.example/api/v1"))
        XCTAssertThrowsError(try Session.validatedServer("http://192.168.evil.example/api/v1"))
        XCTAssertThrowsError(try Session.validatedServer("http://10.1.2.3.evil.example/api/v1"))
        XCTAssertThrowsError(try Session.validatedServer("https://user:password@crm.example/api/v1"))
        XCTAssertThrowsError(try Session.validatedServer("https://crm.example/api/v1?token=secret"))
        XCTAssertThrowsError(try Session.validatedServer("file:///private/notes"))
        XCTAssertNoThrow(try Session.validatedServer("http://127.0.0.1:8000/api/v1"))
        XCTAssertNoThrow(try Session.validatedServer("http://192.168.1.10:8000/api/v1"))
    }
    func testContactContractPreservesConcurrentAndHistoricalAffiliations() throws {
        let json = """
        {"data":{"id":"contact-1","first_name":"Bernardo","last_name":"García","email":"bernardo@example.com","affiliations":[{"id":"a1","company_id":"c1","company_name":"Current A","role":"Advisor","started_on":"2024-01-01","ended_on":null},{"id":"a2","company_id":"c2","company_name":"Current B","ended_on":null},{"id":"a3","company_id":"c3","company_name":"Past company","ended_on":"2023-12-31"}]}}
        """
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let contact = try decoder.decode(Envelope<Contact>.self, from: Data(json.utf8)).data
        XCTAssertEqual(contact.displayName, "Bernardo García")
        XCTAssertEqual(contact.affiliations?.filter { $0.endedOn == nil }.count, 2)
        XCTAssertEqual(contact.affiliations?.last?.companyLabel, "Past company")
    }
    func testSharedMailDoesNotInferSharePermission() throws {
        let json = """
        {"data":{"id":"m1","subject":"Private proposal","from_email":"bernardo@example.com","body_text":"Confidential","participants":[{"id":"eladio","name":"Eladio","email":"eladio@example.com"}],"grants":[{"id":"g1","user_id":"alberto","name":"Alberto"}],"can_share":false}}
        """
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let mail = try decoder.decode(Envelope<MailMessage>.self, from: Data(json.utf8)).data
        XCTAssertEqual(mail.canShare, false)
        XCTAssertEqual(mail.grants?.first?.userId, "alberto")
        XCTAssertFalse(mail.participants?.contains { $0.id == "alberto" } ?? true)
    }
    func testEventContactIDsDecode() throws {
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        let event = try decoder.decode(CRMEvent.self, from: Data(#"{"id":"event1","name":"Valencia","contact_ids":["bernardo","marta"]}"#.utf8))
        XCTAssertEqual(event.contactIds, ["bernardo", "marta"])
    }
}

final class DayScheduleTests: XCTestCase {
    private var madrid: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Madrid")!
        return calendar
    }
    func testTodayKeepsAllPendingTasksExactlyOnceAcrossDSTBoundary() throws {
        let now = try XCTUnwrap(crmDate("2026-03-29T12:00:00+02:00"))
        let tasks = [
            CRMTask(id: "overdue", title: "Vencida", dueAt: "2026-03-28T12:00:00+01:00"),
            CRMTask(id: "today", title: "Hoy", dueAt: "2026-03-29T23:59:00+02:00"),
            CRMTask(id: "tomorrow", title: "Mañana", dueAt: "2026-03-30T00:00:00+02:00"),
            CRMTask(id: "later", title: "Después", dueAt: "2026-03-31T00:00:00+02:00"),
            CRMTask(id: "undated", title: "Sin fecha"),
            CRMTask(id: "invalid", title: "Fecha ilegible", dueAt: "invalid"),
            CRMTask(id: "done", title: "Completada", dueAt: "2026-03-28T12:00:00+01:00", status: "completed")
        ]
        let schedule = CRMDaySchedule(tasks: tasks, day: now, now: now, calendar: madrid)
        XCTAssertEqual(Set(schedule.primary.map(\.id)), ["overdue", "today", "undated", "invalid"])
        XCTAssertEqual(schedule.tomorrow.map(\.id), ["tomorrow"])
        XCTAssertEqual(schedule.later.map(\.id), ["later"])
        XCTAssertEqual(schedule.overdueCount, 1)
        let all = schedule.primary + schedule.tomorrow + schedule.later
        XCTAssertEqual(all.count, schedule.pending.count)
        XCTAssertEqual(Set(all.map(\.id)).count, all.count)
    }
    func testSelectedDayDoesNotIncludeOtherDaysOrUndatedTasks() throws {
        let today = try XCTUnwrap(crmDate("2026-10-11T12:00:00+02:00"))
        let selected = try XCTUnwrap(crmDate("2026-10-09T00:00:00+02:00"))
        let tasks = [
            CRMTask(id: "selected", title: "Viernes", dueAt: "2026-10-09T23:59:00+02:00"),
            CRMTask(id: "next", title: "Sábado", dueAt: "2026-10-10T00:00:00+02:00"),
            CRMTask(id: "none", title: "Sin fecha")
        ]
        XCTAssertEqual(CRMDaySchedule(tasks: tasks, day: selected, now: today, calendar: madrid).primary.map(\.id), ["selected"])
    }
}


final class GmailIntegrationTests: XCTestCase {
    func testGmailCallbackRejectsWrongStateHostPathAndDuplicateResults() throws {
        XCTAssertNoThrow(try GmailCallback.validate(URL(string: "com.nitsnets.crm://oauth/gmail?state=expected&gmail=connected")!, expectedState: "expected"))
        for value in [
            "com.nitsnets.crm://oauth/gmail?state=other&gmail=connected",
            "com.nitsnets.crm://evil/gmail?state=expected&gmail=connected",
            "com.nitsnets.crm://oauth/google?state=expected&gmail=connected",
            "https://oauth/gmail?state=expected&gmail=connected",
            "com.nitsnets.crm://oauth/gmail?state=expected&state=expected&gmail=connected",
            "com.nitsnets.crm://oauth/gmail?state=expected&gmail=connected&gmail=error",
            "com.nitsnets.crm://oauth/gmail?state=expected&gmail=connected#fragment"
        ] { XCTAssertThrowsError(try GmailCallback.validate(URL(string: value)!, expectedState: "expected")) }
        XCTAssertThrowsError(try GmailCallback.validate(URL(string: "com.nitsnets.crm://oauth/gmail?state=expected&gmail=cancelled")!, expectedState: "expected")) { XCTAssertTrue($0 is CancellationError) }
        XCTAssertThrowsError(try GmailCallback.validate(URL(string: "com.nitsnets.crm://oauth/gmail?state=expected&gmail=account_mismatch")!, expectedState: "expected"))
    }
    func testGmailStatesDistinguishPendingWorkFromSuccessfulSyncAndExpiredPermission() throws {
        let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
        for state in ["queued", "syncing", "connected", "sync_error", "reauthorization_required"] {
            let data = Data("{\"configured\":true,\"connected\":true,\"status\":\"\(state)\"}".utf8)
            let status = try decoder.decode(GmailStatus.self, from: data)
            XCTAssertEqual(status.isSyncing, ["queued", "syncing"].contains(state))
            XCTAssertEqual(status.needsAuthorization, state == "reauthorization_required")
            XCTAssertNil(status.lastSyncedAt)
        }
    }
}
