# Evidencia iOS

La revisión vigente del 11 de octubre de 2026 está en [white-music/README.md](white-music/README.md). [Liquid Glass](liquid-glass/README.md) conserva la primera implementación. Las capturas y resultados siguientes corresponden a la revisión anterior.

Capturas del smoke XCUITest del 10 de octubre de 2026, iPhone 17 / iOS 26.3, app real contra API Laravel y PostgreSQL locales. Datos de demostración. No son mockups.

- `02-personas.png`: contactos de NitsNets.
- `03-contacto.png`: Bernardo y su trayectoria.
- `04-correo-privado.png`: mensaje y participantes autorizados.
- `05-otra-empresa.png`: contactos de Estudio Norte, sin los de NitsNets.
- `06-hoy.png`: inicio tras regresar a NitsNets.
- `07-login-google-pendiente.png`: acceso por contraseña y disponibilidad real de Google.

Todas las capturas corresponden a la revisión nativa neutra: colores semánticos, controles SwiftUI y tipografía SF dinámica, sin el acento violeta ni los titulares promocionales de la primera iteración.

Resultado de aquella revisión: **14 pruebas unitarias y 2 recorridos UI, 0 fallos**. Incluyen PKCE, validación estricta del callback y del origen Google, aislamiento entre empresas, recorrido de contactos/correo y acceso por contraseña con Google no disponible. No se simula una autorización OAuth real. Los bundles `.xcresult` completos permanecen en `.build/Logs/Test` y se excluyen del repositorio.

La revisión de conectividad vuelve a ejecutar el recorrido de acceso: verifica servidor conectado, reintento, Google pendiente y contraseña. Las tres nuevas pruebas unitarias comprueban diagnóstico de red, ausencia de datos sensibles en errores y validación de la dirección local para el iPhone.
