import AuthenticationServices
import CryptoKit
import Foundation
import Security
import UIKit

struct GoogleAvailability: Decodable { let configured: Bool }
struct GoogleAuthorization: Decodable { let authorizationUrl: String; let state: String }

struct PKCE {
    let verifier: String
    var challenge: String { Self.challenge(for: verifier) }
    init() throws {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw APIError(message: "No se pudo preparar un acceso seguro. Vuelve a intentarlo.")
        }
        verifier = Self.base64URL(Data(bytes))
    }
    static func challenge(for verifier: String) -> String { base64URL(Data(SHA256.hash(data: Data(verifier.utf8)))) }
    private static func base64URL(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
}

enum GoogleAuthorizationTarget {
    static func validate(_ url: URL) throws {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.host == "accounts.google.com", parts.path == "/o/oauth2/v2/auth",
              parts.user == nil, parts.password == nil, parts.port == nil, parts.fragment == nil else {
            throw APIError(message: "El servidor no ha proporcionado la dirección oficial de acceso de Google.")
        }
    }
}

enum GoogleCallback {
    static func code(from url: URL, expectedState: String) throws -> String {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "com.nitsnets.crm", parts.host == "oauth", parts.path == "/google",
              parts.port == nil, parts.user == nil, parts.password == nil, parts.fragment == nil,
              !expectedState.isEmpty else { throw APIError(message: "La respuesta de Google no corresponde a esta aplicación.") }
        let states = (parts.queryItems ?? []).filter { $0.name == "state" }
        guard states.count == 1, states.first?.value == expectedState else {
            throw APIError(message: "La respuesta de acceso no corresponde a la solicitud iniciada. Vuelve a intentarlo.")
        }
        let errors = (parts.queryItems ?? []).filter { $0.name == "error" }
        let codes = (parts.queryItems ?? []).filter { $0.name == "code" }
        if !errors.isEmpty {
            guard errors.count == 1, codes.isEmpty else { throw APIError(message: "Respuesta de acceso no válida.") }
            switch errors.first?.value {
            case "access_denied": throw APIError(message: "Has cancelado el acceso con Google.")
            case "not_allowed": throw APIError(message: "Esta cuenta de Google no tiene acceso al CRM. Utiliza una cuenta ya registrada en tu empresa.")
            default: throw APIError(message: "Google no pudo completar el acceso. Vuelve a intentarlo.")
            }
        }
        guard codes.count == 1, let code = codes.first?.value, !code.isEmpty, code.count <= 4096 else {
            throw APIError(message: "Google no ha devuelto un código de acceso válido.")
        }
        return code
    }
}

@MainActor final class GoogleAuthentication: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    private var browserSession: ASWebAuthenticationSession?
    private var anchor: ASPresentationAnchor?
    func authenticate(url: URL) async throws -> URL {
        guard browserSession == nil else { throw APIError(message: "Ya hay un acceso con Google en curso.") }
        try GoogleAuthorizationTarget.validate(url)
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .filter({ $0.activationState == .foregroundActive }).flatMap(\.windows).first(where: \.isKeyWindow) else {
            throw APIError(message: "Vuelve a la aplicación para iniciar sesión con Google.")
        }
        anchor = window
        defer { browserSession = nil; anchor = nil }
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.nitsnets.crm") { callback, error in
                if let callback { continuation.resume(returning: callback) }
                else if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin { continuation.resume(throwing: CancellationError()) }
                else { continuation.resume(throwing: error ?? APIError(message: "No se pudo completar el acceso con Google.")) }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            browserSession = session
            if !session.start() { continuation.resume(throwing: APIError(message: "No se pudo abrir el acceso seguro con Google.")) }
        }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { anchor ?? ASPresentationAnchor() }
}


enum GmailCallback {
    static func validate(_ url: URL, expectedState: String) throws {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "com.nitsnets.crm", parts.host == "oauth", parts.path == "/gmail",
              parts.port == nil, parts.user == nil, parts.password == nil, parts.fragment == nil,
              !expectedState.isEmpty else { throw APIError(message: "La respuesta no corresponde a la conexión de Gmail.") }
        let states = (parts.queryItems ?? []).filter { $0.name == "state" }
        let results = (parts.queryItems ?? []).filter { $0.name == "gmail" }
        guard states.count == 1, states.first?.value == expectedState, results.count == 1 else {
            throw APIError(message: "La respuesta no corresponde a la solicitud de Gmail iniciada.")
        }
        switch results.first?.value {
        case "connected": return
        case "cancelled": throw CancellationError()
        case "account_mismatch": throw APIError(message: "Selecciona la cuenta de Gmail que ya tienes conectada. Para cambiar de buzón, desconéctala primero.")
        default: throw APIError(message: "No se pudo conectar Gmail. Vuelve a intentarlo y acepta el permiso de lectura.")
        }
    }
}
