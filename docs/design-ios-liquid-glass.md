# gocrm · iOS con Liquid Glass

Revisión del 11 de octubre de 2026. Tras explorar propuestas, el usuario aprobó la dirección **blanca inspirada en Apple Music** y pidió desarrollarla en la app. Referencias definitivas en `docs/ios-design-proposals/white-music/`. Se mantiene **gocrm** como nombre visible y el icono móvil creado previamente.

## Composición y procedencia

La jerarquía y los neutros continúan la referencia GTT GADD UX (`app/globals.css` y `.agents/playbooks/visual-language.md`, de solo lectura). La adaptación móvil emplea controles SwiftUI, tipografía del sistema, colores semánticos y SF Symbols. No reutiliza CSS ni componentes HTML.

- Navegación: `TabView` nativo de cinco destinos, títulos grandes en las raíces y títulos inline en fichas. En iOS 26 la barra flotante se minimiza al desplazar el contenido.
- Hoy: empresa y fecha, resumen de tareas cargadas, semana seleccionable, pendientes/vencidas, mañana, más adelante y próximos encuentros. Se sustituyen las tarjetas de métricas por contenido directo sobre blanco. Nueva nota está en el menú + junto a crear seguimiento y cuenta, sin botón flotante. La selección de otro día muestra sus tareas; las tareas sin fecha permanecen en Hoy. Los límites de día usan Calendar y respetan los cambios de hora. Con tamaños de accesibilidad la semana se sustituye por DatePicker y Nueva nota conserva el mismo acceso desde +.
- Personas: buscador blanco de cristal con consulta real a la API, filas separadas sin tarjetas, iniciales o avatar autenticado y número de resultados cargados. Borrar o enviar búsqueda cierra el teclado. Ficha con identidad y empresas actuales, acciones de nota/seguimiento, datos, trayectoria, notas y conversaciones autorizadas. Las acciones se apilan con Dynamic Type de accesibilidad.
- Correo: jerarquía remitente/asunto/fecha y recordatorio compacto de privacidad. La API sigue decidiendo qué mensajes existen para el usuario.
- Agenda y Espacio: superficies blancas y listas nativas; cuenta, empresa e integraciones accesibles.
- Acceso: marca gocrm, campos agrupados, botones de cápsula y conexión en segundo plano visual. Configuración técnica dentro de un desplegable, que se abre si falla el servidor.

## Material y accesibilidad

Compilada con el SDK de iOS 26, la navegación, barras y presentaciones estándar reciben el material nativo del sistema. Las acciones de contenido usan `glass` blanco; `glassProminent` se reserva para confirmaciones y acceso; no se coloca cristal detrás de todo el contenido ni se fuerzan fondos opacos sobre las barras.

`DesignSystem.swift` contiene el comportamiento compartido. Las APIs nuevas están protegidas por `#available(iOS 26.0, *)`. Se conserva iOS 17 como mínimo, con botones `bordered` / `borderedProminent`. Con Reducir transparencia se elige ese mismo fallback sin material de vidrio para las acciones propias; las barras las adapta el sistema. El buscador y la selección de día usan `glassEffect(.regular)` con fallback opaco. El fondo es `systemBackground`: blanco en modo claro y negro semántico en oscuro. No hay animaciones personalizadas. Se usan colores semánticos para modo oscuro y estilos tipográficos Dynamic Type.

Referencias de Apple consultadas:

- [Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass)
- [Applying Liquid Glass to custom views](https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views)
- [Build a SwiftUI app with the new design](https://developer.apple.com/videos/play/wwdc2025/323/)

## Icono iOS inicial · 11 de octubre

Fuente: `assets/brand/gocrm-ios-liquid-glass.png`. Monograma **g** de vidrio blanco sobre grafito; sin asteriscos. Creado con ImageGen integrado, sin CLI. Se conserva el master anterior compartido con la web para que esta revisión de iOS no reemplace sus recursos accidentalmente.

La fuente generada mide 1254 × 1254 px. El icono exportado es un PNG opaco de 1024 × 1024 con tratamiento visual de vidrio; no es un archivo por capas de Icon Composer ni tiene refracción animada. iOS aplica la máscara exterior. `apps/ios/scripts/generate-icon.swift` reproduce la exportación, y `GocrmMark` usa una copia reducida a 256 px.

Se conserva `com.nitsnets.crm`, el grupo de Keychain, el esquema OAuth y los nombres técnicos del proyecto. El nombre visible sigue siendo **gocrm**; cambiar el diseño no debe borrar instalaciones o sesiones.

Prompt de generación:

> Use case: logo-brand. Asset type: final iOS app icon for gocrm, a native professional CRM. Create ONE square 1024x1024 full bleed opaque production bitmap, no presentation mockup. A single bold lowercase g monogram, beautifully geometric, with a generous open counter and softly rounded terminals, recognizable at 32 pixels. Sculpt the g from softly frosted silver-white glass with restrained polished edges, subtle translucency and physical depth inspired by Apple's Liquid Glass. Background is a calm charcoal/graphite-to-slate gradient, neutral, very subtle soft illumination behind the letter. Strong white-on-dark silhouette. Centered balanced composition with 20% safe margins. Modern, exceptionally simple, premium professional productivity app. No asterisks, no stars, no extra nodes, no other text, no N, no wordmark, no rainbow, no neon, no outer rounded rectangle or border, no transparent margins. The square background must fill every edge; iOS supplies the external rounded mask.


## Ajuste del 12 de octubre de 2026

El usuario aporta `assets/brand/gocrm-g-shape-reference.png` como forma del símbolo. Se adapta la G abierta circular con dos nodos, manteniendo material de vidrio blanco y fondo grafito del icono anterior. Fuente iOS vigente: `assets/brand/gocrm-ios-liquid-glass-connected-g.png`. ImageGen integrado recibió ambas imágenes: conservar acabado y fondo del icono anterior, sustituir únicamente la silueta por la referencia, dos círculos y separación inferior izquierda, sin asteriscos ni descendente. Exportaciones AppIcon y GocrmMark desde la nueva fuente; master web conservado.

Home concentra Nueva nota en el menú +, también con Dynamic Type de accesibilidad. Desaparecen el botón flotante y su alternativa al principio de la lista.

La exportación vigente de AppIcon y GocrmMark es de 1024 px opacos. La revisión del 12 de octubre superó dos recorridos UI: captura desde + y apertura/cancelación de nota con texto normal y AX XXXL. Capturas de Home en `apps/ios/verification/home-plus/`. Compilación firmada instalada sobre gocrm existente en el iPhone 18 Pro; confirmación de Upgrade Complete al 100 %.
