# Verificación · gocrm blanco

11 de octubre de 2026. Aplicación SwiftUI real en iPhone 17 / iOS 26.3, contra Laravel + PostgreSQL locales y el seed de demostración existente. No son mockups; no se añadieron contactos ni notas ficticios.

## Resultado

- 16 pruebas unitarias, 0 fallos: suite de privacidad/contrato/Google y dos pruebas de agrupación temporal (sin fecha, completadas, selección de día y cambio horario en Madrid).
- 3 recorridos XCUITest, 0 fallos: contactos/correo/aislamiento, acceso por contraseña y disponibilidad de Google, y acciones con AX XXXL.
- Búsqueda real y estado sin resultados; la consulta se conserva al volver de una ficha y borrar la consulta cierra el teclado.
- Nota y seguimiento abiertos/cancelados desde la ficha; captura desde Hoy; selección de un día y retorno a hoy.
- Cambio NitsNets → Estudio Norte → NitsNets; contactos y correo del espacio anterior no permanecen en la vista.
- Inspección visual en claro, oscuro y texto de accesibilidad máximo. Las acciones se apilan; Nueva nota entra en el flujo con texto grande. Iconos decorativos no desbordan sus columnas.

Bundles locales ignorados por Git:

- `../../.build/white-unit.xcresult`
- `../../.build/white-verified-ui.xcresult`
- `../../.build/white-accessibility-final.xcresult` (repetición focalizada tras ajustar los iconos decorativos).

Las iteraciones previas detectaron teclado sin cerrar, espaciado duplicado y saltos de palabra en botones a tamaños de accesibilidad. Se corrigieron y volvieron a capturar. El registro completo está en `../../../../design-qa.md`.

## Capturas

- `gocrm-ios-white-preview.png`: Hoy, Personas y Contacto juntos.
- `02-personas.png`, `03-contacto.png`, `06-hoy.png`: pantallas principales.
- `04-correo-privado.png`, `05-otra-empresa.png`: permisos y aislamiento.
- `07-login-google-pendiente.png`, `08-nota.png`, `09-busqueda-vacia.png`, `10-agenda.png`: estados y flujos auxiliares.
- `11-hoy-accesibilidad.png`, `12-personas-accesibilidad.png`, `13-contacto-accesibilidad.png`, `14-datos-accesibilidad.png`: AX XXXL.
- `15-hoy-oscuro.png`: cambio de apariencia con la app abierta.
- `16-hoy-vuelta-claro.png`: regreso a claro sin relanzar la app.
- `qa-*-final.png`: comparación de propuesta y app; `qa-*-detail.png`: regiones de control y contenido.

Las imágenes de referencia contienen seis personas y una nota ilustrativa; el seed real contiene dos personas y otro historial. Se conserva todo el contenido real autorizado y se permite desplazarlo. TabView, botón Atrás, barras de estado y tamaños de texto son del sistema.

## Límites

Esta revisión se ha ejecutado en simulador iOS 26.3; no se ha instalado la nueva versión en el iPhone físico. iOS 17 conserva fallback compilado, pero no se ha ejecutado en ese runtime. Reducir transparencia mantiene fallback explícito para los controles propios; no se ha repetido una prueba de ese ajuste del sistema en esta revisión. Dictado físico y OAuth Google real siguen pendientes de dispositivo/credenciales, como antes de este cambio visual.
