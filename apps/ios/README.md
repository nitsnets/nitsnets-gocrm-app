# gocrm · iOS

Aplicación **nativa SwiftUI**, iOS 17 o posterior, iPhone/iPad. Consume la misma API Laravel `/api/v1` que la web. No incrusta tokens. El modo conectado usa exclusivamente la API; las compilaciones Debug ofrecen además una demo local explícita, aislada y en memoria para probar sin servidor.

## Referencias visuales y adaptación nativa

La interfaz sigue los neutros, la densidad y la jerarquía de las referencias confirmadas por el usuario. Fuentes leídas directamente, sin modificarlas:

| Fuente | Aplicación en SwiftUI |
| --- | --- |
| `/Users/eladrodriguez/Sites/gtt-gadd-ux/app/globals.css` | Primary y textos neutros mediante `.primary` / `.secondary`; fondos semánticos de iOS. |
| `/Users/eladrodriguez/Sites/gtt-gadd-ux/.agents/playbooks/visual-language.md` | Jerarquía contenida y espaciado de 8/12/16/24 puntos; resumen y listas compactos. |
| `/Users/eladrodriguez/Sites/gtt-gadd-ux/components/ui/card.tsx` | Secciones de contenido sobrias, títulos medios y separación consistente. |
| `/Users/eladrodriguez/Sites/hundrev-cms-ux/app/globals.css` | Superficies neutras y contraste adaptable claro/oscuro. |
| `/Users/eladrodriguez/Sites/hundrev-cms-ux/components/ui/button.tsx` | Acción principal neutra, secundaria discreta y radios contenidos de 8 puntos donde corresponde. |
| `../web/app/globals.css` | Consistencia con los tokens finales de la aplicación web del CRM. |

La web usa Inter y componentes shadcn. La aplicación utiliza **SF con Dynamic Type**, `NavigationStack`, `TabView`, `List`, `Form` y SF Symbols para adaptar esa misma jerarquía a iOS. Los controles conservan dimensiones táctiles nativas. Hoy muestra empresa, semana seleccionable, tareas por fecha, encuentros y Nueva nota en el menú +; el acceso se presenta como formulario. Los botones prominentes usan un primer plano semántico que mantiene contraste en modo oscuro.

La app se muestra como **gocrm**. La revisión iOS usa una G circular con dos nodos de vidrio sobre grafito, desde `../../assets/brand/gocrm-ios-liquid-glass-connected-g.png`; `scripts/generate-icon.swift` exporta el icono iOS desde ese recurso. El master web anterior se conserva. Véase [la revisión Liquid Glass](../../docs/design-ios-liquid-glass.md) para composición, compatibilidad, procedencia y prompt del icono. En iOS 26 las barras usan el material nativo y las acciones estilos `glass` / `glassProminent`, con fallback para iOS 17 y Reducir transparencia. Se conserva el bundle `com.nitsnets.crm` para mantener la continuidad de las instalaciones y Keychain.

## Abrir y ejecutar

Abre `NitsNetsCRM.xcodeproj`, selecciona el esquema **NitsNetsCRM** y un simulador iPhone. El proyecto generado está incluido; **XcodeGen solo se necesita cuando modificas `project.yml`**, no para abrirlo.

Requisitos comprobados: Xcode 26.3, SDK iOS 26.2, simulador iPhone 17 con iOS 26.3, arquitectura arm64. También se ha compilado y firmado un binario ARM64 para iPhone físico. El deployment target es iOS 17; el funcionamiento en iPhone físico e iOS 17 todavía no se ha probado.

1. Arranca el servidor siguiendo `../api/README.md`.
2. En la pantalla de acceso, comprueba el estado **Servidor conectado**. **Servidor API** permite editar la dirección y se despliega automáticamente cuando está vacía o falla la conexión. Por defecto: `http://127.0.0.1:8000/api/v1`, para el simulador de este Mac.
3. Entra con una cuenta del servidor. En la instalación demo local: `eladio@nitsnets.demo` / `DemoCRM!2026`.
4. Para un iPhone real, las compilaciones incluyen por defecto `https://nitsnets-gocrm-app.servidoralfa.com/api/v1` (develop). Requiere una cuenta provisionada en ese servidor; las credenciales demo locales no se crean allí. El proyecto selecciona firma automática de **Nitsnets SL**, equipo **T5922VMWM7**, conservando el bundle **com.nitsnets.crm**. No se ha publicado en App Store ni TestFlight.

La app usa Keychain y requiere **firma ad hoc incluso en el simulador**. No uses `CODE_SIGNING_ALLOWED=NO` para ejecutarla: iOS rechazará guardar tokens con el error -34018. No hay almacenamiento alternativo de tokens en preferencias o archivos.

Desde esta carpeta, con un simulador iPhone 17 disponible:

```sh
xcodebuild -project NitsNetsCRM.xcodeproj -scheme NitsNetsCRM \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath .build -parallel-testing-enabled NO \
  test CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-
```

Para regenerar el proyecto tras modificar `project.yml`:

```sh
xcodegen generate
```

## Firma para iPhone real

La identidad verificada es `Apple Development: Elad Rodriguez (ZBUWS2X5S4)`, cuyo certificado indica `O=Nitsnets SL` y `OU=T5922VMWM7`. El otro certificado, aunque muestra `elad@nitsnets.com` en su nombre, pertenece al equipo personal `Y545DRWMV4` y no se usa para firmar esta aplicación.

Compilación para dispositivo, sin instalar:

```sh
xcodebuild -project NitsNetsCRM.xcodeproj -scheme NitsNetsCRM \
  -destination 'generic/platform=iOS' -configuration Debug \
  -derivedDataPath .build-device -allowProvisioningUpdates \
  build CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY='Apple Development'
```

La compilación habitual deja correo y contraseña vacíos. Para una prueba explícita contra la API demo del Mac, se puede sobrescribir `CRM_DEFAULT_API_URL=http://Mac-mini-de-Elad-2.local:8001/api/v1` y añadir `'SWIFT_ACTIVE_COMPILATION_CONDITIONS=$(inherited) DEBUG CRM_DEMO_LOGIN'`. Esa opción precarga las credenciales demo locales, sin iniciar sesión automáticamente; no debe utilizarse con develop. La precarga requiere a la vez `DEBUG` y `CRM_DEMO_LOGIN` y no existe en Release.

El resultado está en `.build-device/Build/Products/Debug-iphoneos/NitsNetsCRM.app`. `codesign -dvv` permite comprobar firma y equipo. El perfil de desarrollo actual incluye el iPhone 18 Pro pareado; el iPhone 13 Pro necesita incorporarse al perfil si se elige ese dispositivo.

El 10 de octubre de 2026 se instaló correctamente en el **iPhone 18 Pro elegido por el usuario**, con nombre NitsNets y bundle com.nitsnets.crm. Xcode/devicectl falló al montar su imagen de desarrollo (12040, variante ausente para este modelo), por lo que se utilizó ideviceinstaller ya instalado en el Mac para transferir el paquete firmado por USB. El dispositivo completó la verificación de firma e instalación al 100 %; una consulta posterior confirmó la app instalada. No fue necesario modificar protecciones del teléfono. La instalación no acredita todavía la depuración, el login ni la conectividad de la API en el dispositivo.

El 22 de octubre de 2026 se actualizó ese iPhone 18 Pro a la compilación **2**, con nombre gocrm y la API HTTPS de develop incorporada. Build y verificación de firma correctos; `ideviceinstaller upgrade` completó la actualización al 100 % después del mismo error 12040 de devicectl. Se verificó la URL en el Info.plist del binario y la salud de la API desde el Mac. No se ha verificado el login desde el teléfono; la actualización conserva cualquier sesión y servidor elegidos anteriormente.

El ajuste `CRM_DEFAULT_API_URL[sdk=iphoneos*]` incorpora la API de develop al binario para dispositivo. Para sobrescribirla, añade `CRM_DEFAULT_API_URL=https://crm.tuempresa.es/api/v1` al comando de compilación. El ajuste no contiene credenciales y puede cambiarse después desde la pantalla de acceso. En un iPhone, `127.0.0.1` apunta al propio teléfono. El simulador mantiene la URL local por defecto.

## Conexión desde el iPhone

La compilación 2 para dispositivo incorpora `https://nitsnets-gocrm-app.servidoralfa.com/api/v1`. Funciona por Internet, sin depender del Mac ni de la misma Wi-Fi. El simulador continúa usando `127.0.0.1:8000` salvo que se sobrescriba el ajuste al compilar.

Una dirección guardada tras un login anterior tiene prioridad sobre la del binario. La actualización conserva sesiones, Keychain y notas locales, y no traslada tokens entre servidores. Para pasar desde el Mac a develop, cierra sesión en **Espacio**, abre **Servidor API** en el acceso e introduce la URL HTTPS anterior. Pulsa **Reintentar conexión** y entra con una cuenta del servidor de develop. Google requiere su propia configuración en Laravel; comprobar salud no acredita un login ni una sincronización Gmail.

La pantalla de acceso muestra **Servidor conectado**, **Servidor no alcanzable** o **Servidor sin configurar**. **Reintentar conexión** vuelve a consultar la disponibilidad de la API. La contraseña permanece disponible con una URL válida aunque un sondeo anterior haya fallado; el intento de acceso tiene un timeout de 25 segundos. Los errores indican cómo revisar red, dirección, permiso local y servidor, sin incluir tokens, contraseñas ni detalles internos de transporte. El formulario se conserva durante la espera y después de un error.

**Google pendiente de configuración** solo aparece tras una respuesta válida de la API. Una API inaccesible se muestra como un problema de conexión, no como ausencia de credenciales Google. El acceso local por contraseña no exige configurar OAuth. Se mantiene `NSAllowsLocalNetworking`; no se permite HTTP público ni se añade `NSAllowsArbitraryLoads`.

## Demo local sin servidor

En compilaciones **Debug**, pulsa **Abrir demo sin conexión** en el acceso o en **Espacio**. Si falla la conexión de una sesión abierta, también se ofrece junto a **Reintentar conexión**. La app nunca cambia a datos ficticios automáticamente.

La banda **Demo · Datos ficticios** identifica el modo. Incluye contactos, notas privadas, tareas, agenda y emails de ejemplo; permite crear registros y probar concesión/revocación de lectura de un mensaje. Gmail real no se conecta ni se sincroniza en este modo. Las acciones no soportadas muestran un error explícito.

Los datos se generan solo al entrar, viven en memoria y se descartan al salir o cerrar la app. No se escriben en Keychain ni en el almacén de notas locales; no hay transporte HTTP ni envío posterior de cambios. Cada entrada tiene un ámbito independiente. **Salir** restaura la sesión anterior y vuelve a consultar la API. Release no ofrece entrada a la demo.

Para trabajar con datos persistentes, sigue usando PostgreSQL y Laravel en el Mac (`scripts/db.sh start`, `scripts/dev.sh` y `scripts/dev-iphone.sh`, descritos en el README principal). El iPhone necesita la misma red local; la demo funciona incluso con el Mac apagado. Las notas reales guardadas en el dispositivo conservan su sincronización manual independiente.

## Acceso con Google

**Continuar con Google** convive con el acceso por contraseña. `GET /auth/google` comunica si el servidor está configurado; sin credenciales Google, el botón queda desactivado con una explicación.

El cliente genera un verificador aleatorio de 256 bits, envía el challenge PKCE S256 a `/auth/google/start` y solo admite la URL oficial `https://accounts.google.com/o/oauth2/v2/auth`, sin credenciales, puerto ni fragmento. Abre esa URL mediante [ASWebAuthenticationSession](https://developer.apple.com/documentation/authenticationservices/aswebauthenticationsession), con sesión de navegador efímera. Conserva verificador y estado solo en memoria durante el intento. El callback registrado es `com.nitsnets.crm://oauth/google`; se comprueban esquema, host, ruta, estado único y ausencia de parámetros de éxito/error contradictorios. El código de un solo uso se canjea en `/auth/google/exchange`; el token de sesión nunca va en la URL y se guarda en Keychain.

El acceso utiliza `openid email profile`; **iniciar sesión no conecta Gmail**. El servidor admite únicamente cuentas verificadas ya vinculadas a un usuario con acceso al CRM. La configuración Google, los dominios y las URI de callback de producción pertenecen al servidor. Para usarlo en un iPhone real, todo el recorrido debe ser alcanzable desde ese teléfono; un callback Google hacia el localhost del Mac no sirve.

No se ha completado OAuth real con Google porque faltan las credenciales del proyecto del propietario. Se ha compilado la integración y probado PKCE y validación del callback, sin simular un acceso autorizado.

## Flujos disponibles

- **Hoy:** resumen real, tareas pendientes, eventos y acceso a captura rápida.
- **Personas:** búsqueda contra API, alta de contactos, ficha, correo/teléfono/LinkedIn manual, afiliaciones simultáneas e históricas, notas privadas, tareas y mensajes autorizados.
- **Correo:** mensajes disponibles para el usuario, lectura de cuerpo en texto, participantes y accesos compartidos. Solo si el servidor confirma `can_share` se permite autorizar o revocar personas. Confirmación antes de compartir; no hay permiso inferido por contacto, empresa o administrador.
- **Agenda:** crear eventos y seleccionar asistentes, repasar nombres y contexto, crear/completar/reabrir seguimientos.
- **Espacio:** una sola empresa activa, cambio de sesión, Gmail OAuth mediante sesión segura del sistema, estado/sincronización/desconexión y cierre de sesión.
- **Captura:** texto o dictado local, elección explícita del contacto, revisión de empresa/persona/contenido y guardado privado. Alternativa local sin conexión y sincronización manual por nota.

Gmail exige configuración OAuth real en el servidor; si falta, la aplicación lo indica y no simula una conexión. Al completar el consentimiento, la sesión segura vuelve automáticamente a la app y consulta el estado. **Actualizar estado** permite reintentarlo manualmente.

## Aislamiento y privacidad

- Credenciales en **Keychain**, `WhenUnlockedThisDeviceOnly`.
- Cada petición de dominio envía Bearer y `X-Workspace-ID`; la API decide la autorización final.
- Al cambiar de empresa se descarta todo el estado remoto y se reconstruye la navegación. Una generación de sesión invalida respuestas de peticiones anteriores.
- Las peticiones usan una sesión URLSession **efímera**, sin caché HTTP en disco. La aplicación no guarda copias offline de correos.
- Los borradores locales se guardan en Application Support con **iOS Data Protection completa**, escritura atómica y exclusión de copias de seguridad. Se filtran por servidor + usuario + empresa. Al salir de sesión permanecen disponibles únicamente al volver a la misma cuenta y empresa. Pueden eliminarse antes de salir desde Notas locales.
- Un archivo local corrupto bloquea nuevos guardados para evitar sobrescribir las notas anteriores.
- Cada borrador mantiene un UUID enviado como `client_request_id`; reintentar el mismo texto vuelve a la misma nota en el servidor. Una respuesta incierta nunca provoca un reintento automático.
- La aplicación oculta su contenido al pasar a segundo plano. Esto protege la vista de cambio de aplicaciones; no pretende impedir capturas realizadas por el propio usuario.
- El reconocimiento de voz exige permiso de micrófono y Speech. Solo se inicia si existe reconocimiento local en español; **no hay fallback que envíe audio a Apple**. No se conserva audio. En dispositivos no compatibles se puede escribir la nota.
- Las imágenes de contacto se solicitan con autenticación solo si `avatar_url` pertenece al origen del servidor. Otros hosts no reciben peticiones automáticas; sin foto se muestran iniciales.

## Validación realizada

La revisión vigente implementa las maquetas blancas aprobadas, inspiradas en Apple Music, en SwiftUI con Liquid Glass nativo en iOS 26. Las capturas actuales están en `verification/white-music/` y el registro de comparación en `../../design-qa.md`. `verification/liquid-glass/` conserva la revisión anterior. El icono móvil se actualiza a la G de dos nodos aportada por el usuario; no se añaden datos ficticios al cliente.

- Compilación correcta del proyecto para simulador iPhone 17, iOS 26.3.
- **16 pruebas unitarias**, sin fallos: aislamiento por empresa/usuario/servidor, persistencia de UUID, integridad ante archivo corrupto, seguridad de URLs, historial de afiliaciones, permisos de correo, decodificación de asistentes, vector RFC7636, aleatoriedad PKCE, rechazo de callbacks manipulados y diagnósticos de red sin datos sensibles y agrupación de tareas por día con cambio horario.
- **3 recorridos XCUITest contra Laravel + PostgreSQL reales**, sin fallos. Incluyen: acceso/restauración de sesión, Bernardo y trayectoria profesional, lectura de correo privado, cambio a Estudio Norte, presencia de Lucía, ausencia de Bernardo y del correo de NitsNets, y regreso a NitsNets.
- Prueba UI adicional: cerrar sesión, comprobar servidor conectado y reintento, verificar Google no disponible y volver a entrar por contraseña; sin fallos. Esta prueba comprueba la conservación del acceso por contraseña, no una autorización Google real.
- UI ampliada: búsqueda real y sin resultados, conservación de la consulta al volver, apertura/cancelación de nota y seguimiento, selección de día y texto de accesibilidad máximo. Las capturas vigentes están en `verification/white-music/`; todos los datos proceden del seed local o de estados reales del servidor.

El esquema de smoke es optativo y necesita el seed demo y el servidor local en el puerto 8000:

```sh
xcodebuild -project NitsNetsCRM.xcodeproj -scheme NitsNetsCRMLiveSmoke \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath .build -parallel-testing-enabled NO \
  test CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-
```

## Alcance pendiente

La primera app móvil prioriza relaciones, correo, captura y encuentros. La gestión completa de empresas/oportunidades/presupuestos corresponde a la web en esta entrega. No incluye reconocimiento facial, importación automática de LinkedIn, WhatsApp, adjuntos de correo, IA generativa de propuestas, notificaciones push ni envío de correo.

Los listados cargan hasta 100 elementos; la búsqueda de personas consulta al servidor. Las fichas muestran notas, tareas y mensajes de ese conjunto cargado. La paginación incremental y una búsqueda avanzada de contexto quedan pendientes para bases grandes. Las fichas de memoria usan fotografías solo si ya están alojadas en el servidor; el alta de imágenes no forma parte de la API inicial.

**El dictado y los permisos de micrófono requieren una prueba en iPhone físico** con el modelo de español local disponible. No se ha afirmado una prueba de reconocimiento de voz en simulador. OAuth real de Google queda pendiente de las credenciales y verificación del proyecto Google del propietario.


## Gmail y permisos por email

Correo y Espacio muestran el buzón, última sincronización y estados reales: en cola, sincronizando, error o renovación de permiso. El consentimiento usa `ASWebAuthenticationSession`; solo abre la URL oficial de Google. El callback `com.nitsnets.crm://oauth/gmail` valida esquema, host, ruta, estado y un único resultado. El cliente no recibe tokens de Gmail. Al completar la sincronización se recarga el correo autorizado; al volver del segundo plano se consultan de nuevo mensajes y permisos.

En cada email, **Permisos del email** muestra los participantes originales y permite marcar personas de la empresa con acceso de lectura. Cada alta/revocación requiere confirmación y se aplica únicamente a ese mensaje; un destinatario de acceso compartido no puede administrar permisos. Todos los cambios pasan por la API.

La configuración OAuth real continúa pendiente: el servidor local no tiene `GOOGLE_CLIENT_ID` ni `GOOGLE_CLIENT_SECRET`. Las pruebas del proveedor usan HTTP simulado y no acreditan lectura de un Gmail real. El proceso de cola y el scheduler deben estar ejecutándose (`scripts/dev.sh` los inicia). El simulador permite verificar el resto de la experiencia con la API y el seed demo explícito.


Verificación local de esta ampliación (11/10/2026): 21 pruebas API con 200 aserciones; 18 pruebas unitarias iOS; dos recorridos UI (permisos con alta/revocación y privacidad al cambiar de empresa); 38 comprobaciones de respuestas API contra OpenAPI; TypeScript y 16 pruebas web superados (dos pruebas web de integración optativas omitidas). Capturas del simulador en `verification/gmail/`. No se ha instalado esta revisión en un iPhone físico ni conectado un buzón real.


Actualización física del 12/10/2026: compilación Debug actual firmada por Nitsnets SL (`T5922VMWM7`), bundle y grupo Keychain `com.nitsnets.crm` conservados. `ideviceinstaller upgrade` completó al 100 % en el iPhone 18 Pro conectado y la consulta posterior confirmó el nombre **gocrm**. Incluye la interfaz blanca y la ampliación Gmail/permisos. Actualización sobre la instalación existente, sin desinstalar. Se verificó la instalación, no una sesión de uso en el teléfono; la autorización real de Gmail sigue pendiente de credenciales OAuth.


### Verificación de demo local (12/10/2026)

21 pruebas unitarias sin fallos; tres pruebas de aislamiento de demo repetidas tras ajustar las comprobaciones de sesión, también correctas. `LocalDemoUITests/testExplicitDemoNotesSearchAndMailPermissions` pasó con búsqueda, nota privada, permisos por email, salida y Nueva nota desde +. Capturas actuales en `verification/local-demo/`. La compilación de desarrollo con este modo se actualizó por USB en el iPhone 18 Pro, con instalación confirmada al 100 %. Los datos de estas capturas son fixtures locales ficticios.
