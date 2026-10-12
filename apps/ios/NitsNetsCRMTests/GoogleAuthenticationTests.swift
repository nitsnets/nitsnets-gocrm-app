import XCTest
@testable import NitsNetsCRM

final class GoogleAuthenticationTests: XCTestCase {
    func testAuthorizationURLRequiresOfficialGoogleEndpoint() throws {
        XCTAssertNoThrow(try GoogleAuthorizationTarget.validate(URL(string: "https://accounts.google.com/o/oauth2/v2/auth?client_id=example&response_type=code")!))
        for value in [
            "http://accounts.google.com/o/oauth2/v2/auth",
            "https://accounts.google.com.attacker.example/o/oauth2/v2/auth",
            "https://attacker.example/o/oauth2/v2/auth",
            "https://accounts.google.com/another/path",
            "https://user:password@accounts.google.com/o/oauth2/v2/auth",
            "https://accounts.google.com:443/o/oauth2/v2/auth",
            "https://accounts.google.com/o/oauth2/v2/auth#fragment"
        ] { XCTAssertThrowsError(try GoogleAuthorizationTarget.validate(URL(string: value)!)) }
    }
    func testPKCES256MatchesRFC7636Vector() {
        XCTAssertEqual(PKCE.challenge(for: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    }
    func testVerifierHasCryptographicEntropyAndURLSafeEncoding() throws {
        let first = try PKCE(); let second = try PKCE()
        XCTAssertEqual(first.verifier.count, 43)
        XCTAssertEqual(first.challenge.count, 43)
        XCTAssertNotEqual(first.verifier, second.verifier)
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
        XCTAssertTrue(first.verifier.unicodeScalars.allSatisfy { allowed.contains($0) })
    }
    func testCallbackRequiresExactRouteAndMatchingState() throws {
        let valid = URL(string: "com.nitsnets.crm://oauth/google?code=one-time-code&state=expected")!
        XCTAssertEqual(try GoogleCallback.code(from: valid, expectedState: "expected"), "one-time-code")
        for value in [
            "other.app://oauth/google?code=code&state=expected",
            "com.nitsnets.crm://other/google?code=code&state=expected",
            "com.nitsnets.crm://oauth/another?code=code&state=expected",
            "com.nitsnets.crm://oauth/google?code=code&state=unexpected",
            "com.nitsnets.crm://oauth/google?code=code&state=expected&state=expected",
            "com.nitsnets.crm://oauth/google?code=code&code=another&state=expected",
            "com.nitsnets.crm://oauth/google?code=code&state=expected#error",
            "com.nitsnets.crm://oauth/google?code=code&state=expected&error=access_denied"
        ] { XCTAssertThrowsError(try GoogleCallback.code(from: URL(string: value)!, expectedState: "expected"), value) }
    }
    func testDeniedAndUnregisteredAccountsNeverBecomeLoginCodes() {
        for reason in ["access_denied", "not_allowed", "provider_error"] {
            XCTAssertThrowsError(try GoogleCallback.code(from: URL(string: "com.nitsnets.crm://oauth/google?error=\(reason)&state=expected")!, expectedState: "expected"))
        }
    }
}

final class ConnectionFeedbackTests: XCTestCase {
    func testLocalNetworkFailuresOfferActionableRecovery() {
        for code: URLError.Code in [.timedOut, .cannotFindHost, .dnsLookupFailed, .cannotConnectToHost, .networkConnectionLost] {
            let message = ConnectionFeedback.message(for: URLError(code))
            XCTAssertTrue(message.contains("Mac"))
            XCTAssertTrue(message.contains("Wi-Fi"))
        }
        XCTAssertTrue(ConnectionFeedback.message(for: URLError(.notConnectedToInternet)).contains("Red local"))
        XCTAssertTrue(ConnectionFeedback.message(for: URLError(.cannotConnectToHost)).contains("API"))
    }
    func testNetworkDiagnosticsNeverIncludeURLOrUnderlyingSensitiveDetails() {
        for code: URLError.Code in [.timedOut, .cannotConnectToHost, .unknown, .serverCertificateUntrusted] {
            let error = URLError(code, userInfo: [NSLocalizedDescriptionKey: "secret-password-token", NSURLErrorFailingURLStringErrorKey: "https://user:secret@example.com/?token=private"])
            let message = ConnectionFeedback.message(for: error)
            XCTAssertFalse(message.contains("secret"))
            XCTAssertFalse(message.contains("private"))
            XCTAssertFalse(message.contains("example.com"))
        }
    }
    @MainActor func testLocalDeviceEndpointAndPublicTransportValidation() throws {
        XCTAssertEqual(try Session.validatedServer("http://Mac-mini-de-Elad-2.local:8001/api/v1"), "http://Mac-mini-de-Elad-2.local:8001/api/v1")
        XCTAssertThrowsError(try Session.validatedServer(""))
        XCTAssertThrowsError(try Session.validatedServer("http://crm.example.com/api/v1"))
        XCTAssertNoThrow(try Session.validatedServer("https://crm.example.com/api/v1"))
        XCTAssertTrue(ConnectionFeedback.message(for: URLError(.appTransportSecurityRequiresSecureConnection)).contains("HTTPS"))
    }
}
