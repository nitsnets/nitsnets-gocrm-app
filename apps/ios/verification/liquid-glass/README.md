# gocrm · revisión Liquid Glass

11 de octubre de 2026. Aplicación SwiftUI real en iPhone 17 / iOS 26.3, contra la API Laravel y PostgreSQL locales con su seed demo explícito. Las capturas no son maquetas ni usan datos simulados en el cliente.

- `02-personas.png`: listado y búsqueda nativos.
- `03-contacto.png`: nueva cabecera de identidad y acciones de cristal.
- `04-correo-privado.png`: contenido y participantes autorizados.
- `05-otra-empresa.png`: Estudio Norte, sin datos de NitsNets.
- `06-hoy.png`: inicio gocrm, empresa activa, acciones y seguimiento.
- `07-login-google-pendiente.png`: icono nuevo y acceso por contraseña, con Google realmente sin configurar.
- `08-hoy-oscuro.png`: contraste de las acciones en modo oscuro.
- `09-texto-accesible.png`: texto de accesibilidad extra grande, acciones en vertical y contenido desplazable.

Las capturas 02–07 proceden de XCUITest. Las capturas 08–09 son del mismo binario, con la apariencia y el tamaño de texto del simulador modificados para la revisión y restaurados después. También se comprobó la apertura y cancelación de la captura de notas; no se inició el micrófono ni se guardaron notas de prueba.

Validación: compilación para simulador, 14 pruebas unitarias y los dos recorridos UI contra la API real. El cambio de empresa reconstruye la navegación y sigue sin mostrar los contactos ni los correos de otra empresa. Los bundles de resultados quedan en `.build/Logs/Test` y `.build/liquid-glass-verified.xcresult` (no versionados).

El exportador del icono utiliza CoreGraphics/ImageIO; se comprobó visualmente el PNG final, con 1024 × 1024 px y sin canal alfa. Fuente y prompt en [la documentación de diseño](../../../../docs/design-ios-liquid-glass.md).

No se ha instalado esta revisión en un iPhone físico ni se ha ejecutado en iOS 17. La compatibilidad anterior se conserva mediante comprobaciones de disponibilidad; su prueba en dispositivo queda pendiente. Reducir transparencia dispone de un fallback en código, sin prueba manual de ese ajuste en este recorrido. OAuth real y dictado siguen requiriendo las comprobaciones descritas en el README de iOS.
