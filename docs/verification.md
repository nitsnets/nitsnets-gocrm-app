# Verificación del CRM

Verificación realizada el 10 de octubre de 2026 con datos ficticios locales. Web e iOS se conectaron al mismo servidor Laravel y a PostgreSQL; no se usaron buzones ni datos de clientes reales.

## Entorno comprobado

| Componente | Entorno |
| --- | --- |
| Servidor | Laravel 13, PHP 8.5.2 |
| Persistencia local | PostgreSQL 16.11, puerto 55439, base nitsnets_crm |
| Pruebas servidor | SQLite en memoria y PostgreSQL dedicado nitsnets_crm_test |
| Web | Next.js 16.2.3, React 19.2.5, TypeScript, Node 25.2.1 |
| iOS | Xcode 26.3; simulador iPhone 17/iOS 26.3; binario ARM64 firmado Nitsnets SL, T5922VMWM7 |
| API | http://127.0.0.1:8000/api/v1 |
| Web | http://127.0.0.1:3000 |

## Resultados

| Comprobación | Resultado |
| --- | --- |
| PHPUnit en SQLite | 38 tests y 320 assertions, sin fallos |
| PHPUnit en PostgreSQL separado | Los mismos 38 tests y 320 assertions, sin fallos |
| Composer y formato PHP | Validación de Composer y Pint correctas |
| Contrato OpenAPI | Sintaxis válida; 35 rutas y 58 operaciones |
| Cobertura de rutas | Correspondencia bidireccional entre OpenAPI y Laravel |
| Respuestas API reales | 38 comprobaciones contra esquemas y comportamiento, sin fallos |
| Web | TypeScript y build de producción correctos |
| Pruebas web | 13 pruebas, incluidas integración real Next/Laravel y rutas OAuth Next con API controlada, sin fallos ni omisiones |
| iOS | Build simulador/dispositivo y 14 pruebas unitarias, sin fallos; firma verificada con codesign |
| iOS con API real | Recorrido XCUITest completo y smoke de Google sin configurar + contraseña, sin fallos |
| Scripts locales | Sintaxis Bash comprobada |
| API en red local | Health, login, sesión, contactos y logout comprobados desde el Mac en ambas interfaces privadas; resolución del hostname `.local` comprobada |

## Privacidad y aislamiento

Las pruebas del servidor cubren sesiones independientes, rechazo del contexto de empresa anterior, acceso por IDs ajenos, referencias cruzadas entre empresas, afiliaciones históricas, notas privadas y reintentos idempotentes. Comprueban acceso por mensaje, concesión y revocación, imposibilidad de recompartir para un destinatario de grant y ausencia de privilegio general de administrador.

También comprueban cálculo y conservación de instantáneas de presupuestos, referencias de eventos al eliminar un contacto, OAuth state de un solo uso/caducado y callback vinculado a la empresa original. Las pruebas de Gmail usan respuestas HTTP controladas: importación inicial, cursor incremental y caducado, renovación de token, cifrado, copias ocultas y direcciones incrustadas en nombres de presentación que no deben conceder acceso.

La verificación HTTP externa comprobó autenticación, listas y detalles, altas y bajas de registros de prueba, reintento de notas sin duplicación y conflicto de payload. Cambió la empresa de una sesión, comprobó 409 para su contexto anterior, 404 para el contacto de la primera empresa y que una segunda sesión conservaba su empresa inicial. Los registros temporales se eliminaron al terminar.

La integración web comprobó que el token nunca aparece en la respuesta destinada al JavaScript del navegador y que se guarda en cookie HttpOnly; además verificó CSRF, rechazo de una pestaña con empresa obsoleta antes de crear un registro, CRUD de contactos y cálculo/edición de presupuestos.

## Acceso Google

Las 21 pruebas específicas de servidor comprueban ID tokens firmados con RSA en test, firma/algoritmo/claims, rotación de JWKS, nonce, state caducado o repetido, PKCE, canje único y caducidad del código. Incluyen denegación del proveedor, cuentas desconocidas o sin membresía, autoridad Google sobre el email del primer enlace, identidad posterior por sub y rechazo de otro sub que intente vincular el mismo usuario.

La prueba de rutas web ejecuta una instancia real de Next contra una API HTTP local controlada: inicio, cookies transitorias HttpOnly, PKCE, CSRF, rechazo de state incorrecto sin llamar al canje, éxito con cookie de sesión HttpOnly/SameSite=Strict, borrado de cookies temporales y cancelación. El proxy genérico no permite exponer el canje Google como JSON al navegador. Esta prueba verifica la frontera Next/API; no representa una autorización real del proveedor.

En iOS se comprobaron el vector PKCE, generación aleatoria, URL oficial de Google, callback exacto, state, parámetros duplicados y errores del proveedor. La prueba UI consultó el estado real configured=false y confirmó que la contraseña continúa funcionando.

## Revisión visual y recorrido de usuario

La revisión posterior centrada en GTT, con comparación de capturas y correcciones de composición, está en [design-gtt-review.md](design-gtt-review.md). Se validaron nuevamente build y TypeScript, además de búsqueda de contactos, apertura/cancelación del alta, ficha, filtros de tareas y navegación responsive. Sustituye la composición inicial basada principalmente en Hundrev descrita más abajo.

Se revisaron en el navegador la pantalla de acceso, el escritorio, contactos, la ficha de Bernardo con afiliación actual y anterior, notas privadas/equipo, mensajes permitidos y controles de compartir por mensaje. La configuración mostró Gmail sin configurar con el botón de conexión deshabilitado.

El cambio NitsNets → Estudio Norte mostró únicamente a Lucía en contactos; Bernardo dejó de aparecer. Se restauró NitsNets después de la prueba. La lista de contactos se revisó también a 390 × 844: navegación móvil y desplazamiento horizontal de tabla sin desbordamiento de la página.

El recorrido nativo comprobó login/restauración en Keychain, carga real de contactos y mensajes, trayectoria de Bernardo, cambio a Estudio Norte y ausencia de los datos de NitsNets, y vuelta a la empresa inicial. Se inspeccionaron las capturas [inicio](../apps/ios/verification/06-hoy.png), [contacto](../apps/ios/verification/03-contacto.png), [correo](../apps/ios/verification/04-correo-privado.png) y [segunda empresa](../apps/ios/verification/05-otra-empresa.png).

La revisión visual posterior utilizó la referencia Hundrev CMS ejecutada localmente, incluidas su navegación y tabla de Artwork. Se reutilizaron componentes y tokens de los dos repositorios confirmados: Inter, escala neutra, Sidebar/SidebarInset, Button, Input y Table. Se revisaron escritorio, contactos, ficha, configuración, login y navegación móvil a 390 × 844. Se corrigieron estados activos de la barra lateral, etiquetas de creación y encabezados de tareas. GTT se inspeccionó en código; su ejecución visual estaba bloqueada por una dependencia local ausente y no se modificaron sus fuentes.

La aplicación SwiftUI recibió después el mismo ajuste visual: acentos neutros, inicio como lista compacta, formulario de acceso y fichas contenidas. Conserva SF dinámica, TabView y controles nativos. Se ejecutaron de nuevo las 11 pruebas unitarias y los 2 recorridos UI contra la API real, sin fallos, y se recompiló el binario firmado para iPhone. Las capturas nativas 02–07 se actualizaron. Se inspeccionaron inicio y captura de notas en modo oscuro y con tamaño accessibility-medium; al acabar se restauraron modo claro y tamaño large. Esta revisión puntual no sustituye una auditoría completa de accesibilidad.

La firma ARM64 de desarrollo fue comprobada con codesign: bundle com.nitsnets.crm y equipo Nitsnets SL T5922VMWM7. La app está preparada en .build-device, ignorado por Git. El 10 de octubre se instaló en el iPhone 18 Pro elegido por el usuario. devicectl falló al montar la imagen de desarrollo (12040, variante ausente); ideviceinstaller completó la instalación del paquete firmado por USB y una consulta posterior por bundle confirmó NitsNets 1.0, build 1, instalada. El teléfono aún necesita una URL de API alcanzable; no se afirma que login, voz ni depuración física estén validados.

Tras comunicar el usuario que no podía acceder desde el teléfono, se comprobó que el primer binario tenía la URL de API vacía y que el servidor escuchaba únicamente en loopback. Se añadió `npm run dev:iphone`, que publica la API de desarrollo en las interfaces físicas con direcciones privadas, puerto 8001 y debug desactivado. Desde el Mac se verificaron health, login, sesión, contactos y logout por las dos interfaces, además del hostname `Mac-mini-de-Elad-2.local`. Estas comprobaciones no equivalen a una conexión verificada desde el teléfono.

Se preparó un nuevo binario firmado con `http://Mac-mini-de-Elad-2.local:8001/api/v1` como URL inicial, estado de conexión visible, reintento y errores de red comprensibles. La contraseña continúa disponible cuando Google no está configurado. Las 14 pruebas unitarias y el recorrido UI de acceso afectado pasaron; la captura 07 se actualizó.

Por petición del usuario, se añadió precarga editable de las credenciales demo exclusivamente cuando están activas las condiciones de compilación `DEBUG` y `CRM_DEMO_LOGIN`. Se recompiló y verificó la firma del binario, y se instaló esta actualización por USB en el iPhone 18 Pro: `InstallComplete (100%)`, con consulta posterior del bundle instalado. La URL inicial y las condiciones de compilación se comprobaron en el artefacto/log. La API continuaba respondiendo desde el Mac; la apertura y el login en el teléfono siguen pendientes de comprobación por el usuario.

## Correcciones derivadas de la verificación

- El proxy web comparaba el origen normalizado por Next y rechazaba el login local legítimo; se corrigió la comprobación del origen real y se añadió configuración explícita para producción.
- La empresa enviada por la pestaña debe coincidir con la cookie y con el token de servidor; se añadieron rechazo de contexto antiguo y señales entre pestañas sin datos privados.
- La app de simulador necesitaba firma ad hoc para Keychain; se corrigió la configuración sin recurrir a almacenamiento inseguro.
- La extracción de direcciones de Gmail descarta correos presentes en nombres de presentación para evitar conceder acceso al usuario equivocado.
- Los reintentos de notas se serializan y tienen unicidad en base de datos.

## Límites de lo verificado

No se ha completado un login Google real ni autorizado un buzón Gmail real: faltan las credenciales OAuth del proyecto. No se ha enviado un correo, desplegado la aplicación en producción ni distribuido iOS mediante App Store o TestFlight. La instalación de desarrollo en el iPhone 18 Pro sí está confirmada. La prueba de voz sigue pendiente en el teléfono con reconocimiento local de español y permisos concedidos; no se ha presentado el simulador como validación de audio real.

No se han realizado pruebas de carga, una auditoría de seguridad de producción ni una prueba de restauración de backups. Los listados móviles y selectores web tienen los límites documentados en los README de cada aplicación. La entrega es funcional para revisión local, con los requisitos de producción y ampliaciones señalados en la especificación.

## Repetir comprobaciones

Desde la raíz con API y base local funcionando:

```bash
npm run contract:check
npm run verify:api
```

Servidor, usando una base exclusiva para las pruebas PostgreSQL:

```bash
cd apps/api
php artisan test --compact
DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=55439 DB_DATABASE=nitsnets_crm_test DB_USERNAME=crm_local DB_PASSWORD='' php artisan test --compact
```

Web, con la API y Next arrancados para incluir integración real:

```bash
cd apps/web
npm run typecheck
npm run build
CRM_GOOGLE_ROUTE_TESTS=true CRM_WEB_TEST_URL=http://127.0.0.1:3000 npm test
```

Los comandos de compilación, pruebas unitarias y recorrido real iOS se documentan en [su README](../apps/ios/README.md).


## Demo local iOS — 12/10/2026

Modo explícito en Debug, independiente de la API. La suite unitaria pasó 21 pruebas (0 fallos); las tres nuevas pruebas de demo se repitieron tras reforzar las comprobaciones de generación de sesión y volvieron a pasar. Verifican transporte bloqueado (incluidos OAuth público y avatares), ausencia de sustitución automática al fallar la red, conservación de Keychain/servidor configurado, separación de ámbitos, descarte de cambios, búsqueda, notas privadas, estado de tareas y permisos ficticios de correo. Las rutas no soportadas fallan explícitamente.

El recorrido UI crea una nota, busca un contacto y concede acceso a un email ficticio; no requiere login en una API ni modifica registros reales. Los fixtures del modo demo no equivalen a una cuenta Gmail conectada. Capturas en `apps/ios/verification/local-demo/`. La API local respondió HTTP 200 tanto por localhost:8000 como por el nombre .local del Mac en :8001.

El recorrido UI final pasó sin fallos tras revisar las capturas y corregir la posición de la banda de demo para conservar la cabecera y el botón +. Comprueba también apertura de Nueva nota desde +. La compilación Debug firmada se instaló mediante upgrade USB en el iPhone 18 Pro existente (`com.nitsnets.crm`); el instalador confirmó InstallComplete 100 %. Se conservaron identificadores y almacenamiento de sesión. Esta instalación no acredita una prueba manual en el teléfono ni OAuth real.
