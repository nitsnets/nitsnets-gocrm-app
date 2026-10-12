import XCTest

/// Opt-in scheme NitsNetsCRMLiveSmoke requires the local seeded API on :8000.
/// It uses only the documented demonstration account, never production credentials.
final class LiveAPISmokeTests: XCTestCase {
    @MainActor func testLoginContactsPrivateMailAndWorkspaceIsolation() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        if app.textFields["login.email"].waitForExistence(timeout: 5) {
            attach("01-login", app)
            app.textFields["login.email"].tap()
            app.textFields["login.email"].typeText("eladio@nitsnets.demo")
            app.secureTextFields["login.password"].tap()
            app.secureTextFields["login.password"].typeText("DemoCRM!2026")
            app.buttons["login.submit"].tap()
        }
        XCTAssertTrue(app.tabBars.buttons["Hoy"].waitForExistence(timeout: 20), "The seeded local API must be running on port 8000")
        tapTab("Espacio", index: 4, app: app)
        if app.buttons["NitsNets"].exists { app.buttons["NitsNets"].tap(); if app.buttons["Cambiar empresa"].waitForExistence(timeout: 1) { app.buttons["Cambiar empresa"].tap() } }
        XCTAssertTrue(app.tabBars.buttons["Personas"].waitForExistence(timeout: 15))
        tapTab("Personas", index: 1, app: app)
        XCTAssertTrue(app.staticTexts["Bernardo García"].firstMatch.waitForExistence(timeout: 20))
        attach("02-personas", app)
        let search = app.textFields["contacts.search"]
        search.tap(); search.typeText("Bernardo")
        XCTAssertTrue(app.staticTexts["1 persona"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["Ana Soler"].exists)
        app.staticTexts["Bernardo García"].firstMatch.tap()
        XCTAssertTrue(app.staticTexts["Trayectoria"].waitForExistence(timeout: 10))
        attach("03-contacto", app)
        app.buttons["contact.note"].tap()
        XCTAssertTrue(app.navigationBars["Captura rápida"].waitForExistence(timeout: 5))
        attach("08-nota", app)
        app.buttons["Cancelar"].tap()
        app.buttons["contact.followUp"].tap()
        XCTAssertTrue(app.navigationBars["Seguimiento"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Bernardo García"].exists)
        app.buttons["Cancelar"].tap()
        app.navigationBars.buttons.firstMatch.tap()
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        XCTAssertEqual(search.value as? String, "Bernardo")
        app.buttons["Borrar búsqueda"].tap()
        search.tap(); search.typeText("zzzzsinresultado")
        XCTAssertTrue(app.staticTexts["Sin resultados"].waitForExistence(timeout: 10))
        attach("09-busqueda-vacia", app)
        app.buttons["Borrar búsqueda"].tap()
        tapTab("Correo", index: 2, app: app)
        XCTAssertTrue(app.staticTexts["Consulta privada sobre el proyecto"].waitForExistence(timeout: 10))
        app.staticTexts["Consulta privada sobre el proyecto"].tap()
        XCTAssertTrue(app.staticTexts["Quién puede leer este mensaje"].waitForExistence(timeout: 10))
        attach("04-correo-privado", app)
        tapTab("Espacio", index: 4, app: app)
        app.buttons["Estudio Norte"].tap()
        app.buttons["Cambiar empresa"].tap()
        XCTAssertTrue(app.tabBars.buttons["Personas"].waitForExistence(timeout: 15))
        tapTab("Personas", index: 1, app: app)
        XCTAssertTrue(app.staticTexts["Lucía Norte"].waitForExistence(timeout: 20))
        XCTAssertFalse(app.staticTexts["Bernardo García"].exists)
        attach("05-otra-empresa", app)
        tapTab("Correo", index: 2, app: app)
        XCTAssertFalse(app.staticTexts["Consulta privada sobre el proyecto"].exists)
        tapTab("Espacio", index: 4, app: app)
        app.buttons["NitsNets"].tap()
        app.buttons["Cambiar empresa"].tap()
        XCTAssertTrue(app.tabBars.buttons["Hoy"].waitForExistence(timeout: 15))
        tapTab("Hoy", index: 0, app: app)
        XCTAssertTrue(app.buttons["home.add"].waitForExistence(timeout: 15))
        attach("06-hoy", app)
        let weekday = Calendar.current.component(.weekday, from: Date())
        let anotherDay = weekday == 1 ? 7 : weekday - 1
        app.buttons["home.day.\(anotherDay)"].tap()
        XCTAssertTrue(app.staticTexts["Ese día"].exists)
        app.buttons["home.day.\(weekday)"].tap()
        XCTAssertTrue(app.staticTexts["Pendiente"].exists)
        app.buttons["home.add"].tap()
        XCTAssertTrue(app.buttons["home.capture"].waitForExistence(timeout: 5))
        app.buttons["home.capture"].tap()
        XCTAssertTrue(app.navigationBars["Captura rápida"].waitForExistence(timeout: 5))
        app.buttons["Cancelar"].tap()
        tapTab("Agenda", index: 3, app: app)
        attach("10-agenda", app)
        tapTab("Hoy", index: 0, app: app)
    }
    @MainActor func testGmailAvailabilityAndPerMessagePermissions() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication(); app.launch()
        if app.textFields["login.email"].waitForExistence(timeout: 3) {
            app.textFields["login.email"].tap(); app.textFields["login.email"].typeText("eladio@nitsnets.demo")
            app.secureTextFields["login.password"].tap(); app.secureTextFields["login.password"].typeText("DemoCRM!2026")
            app.buttons["login.submit"].tap()
        }
        XCTAssertTrue(app.tabBars.buttons["Hoy"].waitForExistence(timeout: 20))
        tapTab("Espacio", index: 4, app: app)
        if app.buttons["NitsNets"].exists { app.buttons["NitsNets"].tap(); if app.buttons["Cambiar empresa"].waitForExistence(timeout: 1) { app.buttons["Cambiar empresa"].tap() } }
        tapTab("Correo", index: 2, app: app)
        XCTAssertTrue(app.staticTexts["Gmail pendiente de configuración"].waitForExistence(timeout: 10))
        attach("gmail-01-correo", app)
        let mail = app.staticTexts["Consulta privada sobre el proyecto"]
        if !mail.isHittable { app.swipeUp() }
        XCTAssertTrue(mail.waitForExistence(timeout: 10)); mail.tap()
        XCTAssertTrue(app.buttons["Permisos del email"].waitForExistence(timeout: 10))
        app.buttons["Permisos del email"].tap()
        let permission = app.switches["mail-permission-alberto@nitsnets.demo"]
        XCTAssertTrue(app.staticTexts["Participantes originales"].waitForExistence(timeout: 10))
        for _ in 0..<3 { if permission.exists && permission.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(permission.waitForExistence(timeout: 10))
        XCTAssertEqual(permission.value as? String, "0")
        attach("gmail-02-permisos", app)
        permission.switches.firstMatch.tap()
        XCTAssertTrue(app.buttons["Dar acceso de lectura"].waitForExistence(timeout: 5))
        app.buttons["Dar acceso de lectura"].tap()
        expectation(for: NSPredicate(format: "value == '1'"), evaluatedWith: permission)
        waitForExpectations(timeout: 10)
        attach("gmail-03-acceso", app)
        permission.switches.firstMatch.tap()
        XCTAssertTrue(app.buttons["Revocar acceso"].waitForExistence(timeout: 5))
        app.buttons["Revocar acceso"].tap()
        expectation(for: NSPredicate(format: "value == '0'"), evaluatedWith: permission)
        waitForExpectations(timeout: 10)
        app.buttons["Listo"].tap()
        XCTAssertTrue(app.buttons["Permisos del email"].waitForExistence(timeout: 5))
    }
    @MainActor func testLoginShowsGoogleAvailabilityAndPasswordStillWorks() throws {
        continueAfterFailure = false
        let app = XCUIApplication(); app.launch()
        if app.tabBars.buttons["Hoy"].waitForExistence(timeout: 4) {
            tapTab("Espacio", index: 4, app: app)
            app.swipeUp()
            let logout = app.buttons["Cerrar sesión"]
            XCTAssertTrue(logout.waitForExistence(timeout: 5)); logout.tap()
            let confirmation = app.sheets.buttons["Cerrar sesión"]
            XCTAssertTrue(confirmation.waitForExistence(timeout: 5)); confirmation.tap()
        }
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 15))
        let connected = NSPredicate(format: "label == %@", "Servidor conectado")
        expectation(for: connected, evaluatedWith: app.staticTexts["login.connectionStatus"])
        waitForExpectations(timeout: 10)
        app.buttons["login.retryConnection"].tap()
        expectation(for: connected, evaluatedWith: app.staticTexts["login.connectionStatus"])
        waitForExpectations(timeout: 10)
        app.swipeUp()
        XCTAssertTrue(app.buttons["login.google"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["login.google"].isEnabled, "This opt-in test expects local Google credentials to remain unconfigured")
        attach("07-login-google-pendiente", app)
        app.textFields["login.email"].tap(); app.textFields["login.email"].typeText("eladio@nitsnets.demo")
        app.secureTextFields["login.password"].tap(); app.secureTextFields["login.password"].typeText("DemoCRM!2026")
        app.buttons["login.submit"].tap()
        XCTAssertTrue(app.tabBars.buttons["Hoy"].waitForExistence(timeout: 15))
    }
    @MainActor func testVisualAccessibility() throws {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = ["-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
        app.launch()
        XCTAssertTrue(app.tabBars.buttons["Hoy"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.buttons["home.add"].waitForExistence(timeout: 10))
        attach("11-hoy-accesibilidad", app)
        app.buttons["home.add"].tap()
        XCTAssertTrue(app.buttons["home.capture"].waitForExistence(timeout: 5))
        app.buttons["home.capture"].tap()
        XCTAssertTrue(app.navigationBars["Captura rápida"].waitForExistence(timeout: 5))
        app.buttons["Cancelar"].tap()
        tapTab("Personas", index: 1, app: app)
        XCTAssertTrue(app.staticTexts["Bernardo García"].firstMatch.waitForExistence(timeout: 10))
        attach("12-personas-accesibilidad", app)
        app.staticTexts["Bernardo García"].firstMatch.tap()
        XCTAssertTrue(app.buttons["contact.note"].waitForExistence(timeout: 10))
        app.buttons["contact.note"].tap()
        XCTAssertTrue(app.navigationBars["Captura rápida"].waitForExistence(timeout: 5))
        app.buttons["Cancelar"].tap()
        attach("13-contacto-accesibilidad", app)
        app.swipeUp()
        attach("14-datos-accesibilidad", app)
        app.buttons["contact.followUp"].tap()
        XCTAssertTrue(app.navigationBars["Seguimiento"].waitForExistence(timeout: 5))
        app.buttons["Cancelar"].tap()
        app.terminate()
        app.launchArguments = []
        app.launch()
    }

    @MainActor private func tapTab(_ label: String, index: Int, app: XCUIApplication) {
        // iOS 26 exposes duplicate offscreen SF Symbol elements inside tab labels.
        // Prefer the visible accessibility element; use the actual tab bar geometry otherwise.
        let candidates = app.tabBars.buttons.allElementsBoundByIndex.filter { $0.label == label && $0.isHittable }
        if let visible = candidates.first { visible.tap() }
        else { app.tabBars.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: (Double(index) + 0.5) / 5.0, dy: 0.5)).tap() }
    }
    @MainActor private func attach(_ name: String, _ app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
