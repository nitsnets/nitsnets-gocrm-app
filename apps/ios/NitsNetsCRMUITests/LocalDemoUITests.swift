import XCTest

/// No API login or server fixtures required. Leaves any saved live session intact.
final class LocalDemoUITests: XCTestCase {
    @MainActor func testExplicitDemoNotesSearchAndMailPermissions() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication(); app.launch()
        if app.tabBars.buttons["Espacio"].waitForExistence(timeout: 3) { tab("Espacio", app) }
        if app.alerts.buttons["Entendido"].exists { app.alerts.buttons["Entendido"].tap() }
        let entry = app.buttons["demo.enter"].firstMatch
        for _ in 0..<5 { if entry.exists && entry.isHittable { break }; app.swipeUp() }
        XCTAssertTrue(entry.waitForExistence(timeout: 5)); entry.tap()
        XCTAssertTrue(app.buttons["demo.exit"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Preparar el próximo encuentro"].waitForExistence(timeout: 5))
        screenshot("demo-01-hoy", app)
        XCTAssertTrue(app.buttons["home.add"].isHittable)
        app.buttons["home.add"].tap()
        XCTAssertTrue(app.buttons["home.capture"].waitForExistence(timeout: 5)); app.buttons["home.capture"].tap()
        XCTAssertTrue(app.navigationBars["Captura rápida"].waitForExistence(timeout: 5)); app.buttons["Cancelar"].tap()
        tab("Personas", app)
        let search = app.textFields["contacts.search"]
        XCTAssertTrue(search.waitForExistence(timeout: 5)); search.tap(); search.typeText("Lucía")
        XCTAssertTrue(app.staticTexts["1 persona"].waitForExistence(timeout: 5))
        app.staticTexts["Lucía Ejemplo"].firstMatch.tap()
        XCTAssertTrue(app.buttons["contact.note"].waitForExistence(timeout: 5)); app.buttons["contact.note"].tap()
        let editor = app.textViews["Texto de la nota"]
        XCTAssertTrue(editor.waitForExistence(timeout: 5)); editor.tap(); editor.typeText("Nota solo de prueba")
        app.swipeUp()
        app.buttons["Revisar antes de guardar"].tap()
        XCTAssertFalse(app.buttons["Guardar solo en este dispositivo"].exists)
        app.buttons["Guardar en la demo"].tap()
        XCTAssertTrue(app.staticTexts["Nota solo de prueba"].waitForExistence(timeout: 5))
        tab("Correo", app)
        XCTAssertTrue(app.staticTexts["Correo de ejemplo"].waitForExistence(timeout: 5))
        screenshot("demo-02-correo", app)
        app.staticTexts["Propuesta para el próximo encuentro"].firstMatch.tap()
        XCTAssertTrue(app.buttons["Permisos del email"].waitForExistence(timeout: 5)); app.buttons["Permisos del email"].tap()
        let permission = app.switches["mail-permission-marina@example.test"]
        XCTAssertTrue(permission.waitForExistence(timeout: 5))
        permission.switches.firstMatch.tap()
        app.buttons["Dar acceso de lectura"].tap()
        expectation(for: NSPredicate(format: "value == '1'"), evaluatedWith: permission)
        waitForExpectations(timeout: 5)
        screenshot("demo-03-permisos", app)
        app.buttons["Listo"].tap()
        app.buttons["demo.exit"].tap()
        XCTAssertFalse(app.buttons["demo.exit"].exists)
        XCTAssertFalse(app.staticTexts["Lucía Ejemplo"].exists)
    }
    @MainActor private func tab(_ name: String, _ app: XCUIApplication) {
        let candidates = app.tabBars.buttons.matching(identifier: name)
        for index in 0..<candidates.count {
            let button = candidates.element(boundBy: index)
            if button.isHittable && app.frame.intersects(button.frame) { button.tap(); return }
        }
        XCTFail("Missing tab: \(name)")
    }
    @MainActor private func screenshot(_ name: String, _ app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot()); attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
