# Especificación funcional de gocrm

Versión 0.3 — 10 de octubre de 2026.

gocrm centraliza clientes, contactos y seguimiento comercial con conversaciones privadas por defecto. La web y la aplicación iOS consumen una API común. La primera empresa es NitsNets; una persona puede pertenecer a varias empresas usuarias y seleccionar una sola empresa activa en cada sesión. Esta especificación recoge las decisiones aceptadas y distingue el producto inicial de las ampliaciones.

## Decisiones aceptadas

| Tema | Decisión |
| --- | --- |
| Servidor | Laravel con PostgreSQL, organizado en módulos dentro de una aplicación |
| Web | Next.js y TypeScript; API como única fuente de reglas y datos |
| Móvil | SwiftUI nativo en iOS; API común |
| Organización | Un repositorio con apps/api, apps/web, apps/ios, contracts y docs |
| Empresas usuarias | Varias disponibles, una activa por sesión; aislamiento obligatorio |
| Acceso | Contraseña o Google OpenID Connect; usuarios previamente autorizados |
| Correo | Gmail mediante OAuth individual, con credenciales propias de Google |
| Privacidad | Acceso al mensaje independiente del acceso al contacto y al cliente |
| LinkedIn | Enlace de perfil y datos introducidos por el usuario; sincronización condicionada a APIs autorizadas |
| WhatsApp | Fuera de la primera versión |
| Presupuestos | Editor y cálculo explícito; generación con IA en fase posterior |
| Diseño | Componentes y estilos de Sites/gtt-gadd-ux y Sites/hundrev-cms-ux, confirmados por el usuario; tokens neutros y navegación compacta. Inter en web; controles y tipografía del sistema en iOS |
| Cloud Design | No es un requisito ni una integración |

## Navegación web y referencia visual

GTT GADD UX es la referencia principal de composición. Los listados abren fichas como páginas completas con URL propia, cabecera, breadcrumb, acciones y secciones. Altas, edición y afiliaciones también tienen páginas propias; no se usan popups para estos flujos. Recargar una ficha, abrir su enlace en otra pestaña y utilizar Atrás conserva una navegación coherente. La vuelta al listado conserva búsqueda, filtros y página en la URL. Los permisos se resuelven de nuevo en la API al abrir un enlace directo.

Configuración sigue la estructura de preferencias de GTT: navegación específica y filas agrupadas para perfil, empresa activa, Gmail y privacidad. La adaptación móvil conserva páginas completas y usa un panel desplegable únicamente para la navegación.

## Usuarios y empresas

Un workspace representa una empresa que utiliza el CRM. Una company representa una cuenta comercial o cliente de esa empresa. Son conceptos diferentes y no se intercambian en la API.

La identidad de usuario es global; su pertenencia y rol se definen por workspace. Un contacto o cliente pertenece exactamente a un workspace. Que dos empresas tengan una persona con el mismo correo no permite compartir fichas, correos o notas entre ellas.

Al iniciar sesión se selecciona una empresa accesible. Cambiar de empresa exige comprobar la pertenencia, actualizar la sesión y vaciar el estado del cliente. Las peticiones de dominio incluyen X-Workspace-ID; si no coincide con la empresa activa del token, se rechazan. La selección se conserva por sesión, sin modificar las sesiones abiertas en otros dispositivos. Nunca se combinan métricas o resultados de búsqueda de empresas distintas.

Una empresa activa por sesión no implica impedir que una persona tenga otra sesión en otro dispositivo. La primera versión no ofrece una vista consolidada multiempresa.

### Acceso mediante Google

Web e iOS ofrecen contraseña y acceso mediante Google. Este acceso usa OpenID Connect con openid, email y profile, independientemente de la conexión del buzón Gmail. Iniciar sesión no concede lectura de correos ni conecta un buzón.

El servidor verifica firma, emisor, audiencia, caducidad y nonce del ID token. Solo enlaza una cuenta Google con un usuario existente y con acceso a una empresa. El primer enlace por email exige correo verificado y autoridad de Google sobre esa dirección (Gmail o dominio Workspace declarado y coincidente). Las siguientes sesiones usan el identificador estable sub; no basta con pertenecer a un dominio para entrar.

Los estados OAuth y códigos de entrega son temporales y de un solo uso. El código que recibe el cliente está ligado a su verificador PKCE; el token de sesión nunca viaja en la URL. Web guarda la sesión en cookies HttpOnly e iOS en Keychain. Sin credenciales del proyecto Google el acceso se muestra sin configurar y permanece disponible la contraseña.

## Contactos, clientes e historial

Una ficha de contacto contiene identidad, correo, teléfono, cargo orientativo, enlace de LinkedIn y notas descriptivas compartidas de ficha. Las anotaciones personales se crean como notas privadas separadas. La primera interfaz admite un correo principal; múltiples identidades de correo con vigencia forman parte de la evolución del modelo y no deben resolverse sobrescribiendo historial.

Una afiliación relaciona un contacto con una empresa cliente mediante cargo, fecha de inicio y fecha final opcional. Pueden coexistir afiliaciones. Al cambiar de empresa se cierra una afiliación y se crea otra; nunca se reasigna automáticamente el historial comercial anterior.

Ejemplo: Bernardo es asesor de Cliente A desde enero y director de Cliente B desde marzo. Ambas relaciones están activas. Un correo sobre Cliente A permanece asociado a esa cuenta, aunque en octubre Bernardo deje de asesorarla.

Las coincidencias de nombre sugieren revisión, no una fusión automática. Las referencias cruzadas solo pueden apuntar a registros del mismo workspace. Las bajas de registros deben preservar o resolver explícitamente las relaciones dependientes; no deben eliminar silenciosamente conversaciones o propuestas.

## Seguimiento comercial

Las oportunidades tienen título, cliente y contacto opcionales, importe en unidades menores, moneda, fecha estimada y fase: nueva, cualificada, propuesta, ganada o perdida. El importe de cartera suma oportunidades abiertas, sin mezclar monedas. La primera configuración comercial utiliza EUR.

Las tareas incluyen título, vencimiento opcional, responsable y estado pendiente/completada. Pueden asociarse a contacto o cliente. Completar una tarea conserva su registro. El escritorio muestra tareas próximas y actividad que el usuario tiene permiso para consultar.

Las notas contienen texto, autor y asociaciones opcionales. Son privadas por defecto; compartir una nota con toda la empresa requiere elegirlo explícitamente. Ser administrador no concede lectura de notas privadas.

Los eventos permiten preparar encuentros con nombre, lugar, fecha, notas y contactos asociados. Se orientan a recordar relaciones y seguimiento, no a sustituir una agenda corporativa completa.

## Privacidad de correo

### Regla de acceso

Un mensaje solo es visible para participantes internos cuya identidad esté verificada y usuarios a quienes un participante original haya concedido acceso. Ser dueño del contacto, comercial del cliente o administrador del workspace no otorga acceso implícito.

| Situación | Acceso |
| --- | --- |
| Bernardo escribe a Eladio | Eladio |
| Bernardo escribe a Eladio y José Antonio | Eladio y José Antonio |
| Alberto consulta la ficha de Bernardo | No obtiene acceso al mensaje |
| Eladio comparte un mensaje con Alberto | Alberto puede leer ese mensaje |
| Alberto intenta compartir ese mensaje | Denegado si solo tiene un permiso compartido |
| Alberto aparece en una nueva respuesta | Acceso a esa respuesta, no al histórico completo |
| Cambia la empresa donde trabaja Bernardo | No cambia el acceso a mensajes anteriores |

Compartir es una operación explícita por mensaje. En iOS, «Permisos del email» muestra participantes originales y un selector por persona para dar o revocar lectura, con confirmación de cada cambio. Los participantes originales conservan su acceso; una persona invitada solo puede consultar y no gestionar permisos. La interfaz muestra quién puede leer y si el usuario actual puede compartir. Un permiso compartido puede revocarse por un participante original; la revocación afecta a futuras lecturas, sin prometer borrar copias que el destinatario ya haya exportado o recibido fuera del CRM.

Los mensajes se autorizan antes de serializar asunto, cuerpo, remitentes, participantes o cualquier otro dato. Listados, detalle, buscador, métricas, exportaciones futuras y resúmenes aplican la misma regla. Un identificador ajeno al workspace o un mensaje no visible responde como recurso inexistente.

### Hilos, copias y deduplicación

El hilo agrupa mensajes para presentar una conversación, pero no es una unidad de autorización. La vista solo incluye los mensajes permitidos. El texto citado incluido en una respuesta forma parte de esa respuesta y puede contener historia que el remitente ya ha reenviado.

No se muestra la lista de destinatarios ocultos a otros participantes. La copia recibida en un buzón puede demostrar acceso de su dueño aunque no aparezca en To o Cc. No se infiere pertenencia a listas de distribución ni acceso a buzones compartidos: requieren soporte específico.

La sincronización debe ser idempotente por conexión e identificador del proveedor. Cualquier deduplicación entre buzones deberá combinar solo evidencias verificadas y conservar restricciones de BCC y copias con contenido distinto. Un Message-ID de Internet o una cabecera manipulable no basta para conceder acceso ni fusionar contenido privado.

## Gmail

Cada usuario conecta su propio buzón con OAuth. Las credenciales de Google viven en el servidor; los tokens de proveedor se cifran en almacenamiento. El callback valida state de un solo uso, caducidad, usuario y empresa vinculados antes de guardar la conexión.

La primera integración se orienta a lectura y registro. No se envían correos desde el CRM. La sincronización se ejecuta en segundo plano y distingue en cola, sincronizando, completada, error y autorización caducada; pulsar sincronizar no afirma que el trabajo ya haya terminado. Correo y Espacio de iOS permiten conectar, sincronizar, reautorizar y desconectar. Mientras están visibles consultan el estado y recargan los mensajes al terminar. El consentimiento se abre en la sesión segura del sistema y vuelve a un callback iOS fijo validado con el estado del intento.

Solo se incorporan mensajes asociados a contactos conocidos del workspace. Los remitentes desconocidos no crean contactos compartidos automáticamente. Una futura bandeja privada de sugerencias permitirá revisarlos. La sincronización distingue datos recibidos del proveedor de inferencias: no debe asignar una empresa al mensaje porque el contacto haya cambiado de empleo.

Una conexión pertenece a un usuario y workspace. Conectar un buzón en una empresa no lo conecta en otra. La desconexión elimina credenciales y detiene sincronización futura; la política de conservación de mensajes ya registrados se documenta por separado y nunca se interpreta como una revocación retroactiva de correos enviados.

La puesta en producción requiere configurar el proyecto de Google, pantalla de consentimiento, clientes OAuth, redirect URI y requisitos aplicables a scopes. Gmail no implica ausencia de configuración o verificación. Las pruebas locales con respuestas simuladas del proveedor no equivalen a una conexión real.

## Presupuestos

Un presupuesto incluye título, cliente u oportunidad, moneda, partidas y notas comerciales. El servidor calcula importes; no acepta como fiable un total proporcionado por el cliente. Las cantidades y precios deben cumplir límites y precisión definidos por el contrato. El estado distingue borrador, aprobado y enviado. Marcar enviado registra una acción externa y no envía correo por sí mismo.

La primera versión ofrece presupuestos manuales. La fase de IA añade una biblioteca de servicios, tarifas y propuestas aprobadas, recuperación de referencias permitidas, detección de información pendiente y generación de borradores. Falta seleccionar proveedor/modelo, política de envío de datos y formato de documento final.

La IA no podrá leer mensajes o notas fuera de los permisos del usuario solicitante, ni convertir automáticamente su contenido en una propuesta compartida. Las fuentes utilizadas deberán ser visibles en la revisión. Los precios, impuestos y descuentos se calcularán con reglas deterministas. El servidor conserva instantáneas internas al modificar presupuestos. Recuperación pública de versiones, aprobación formal, PDF y envío requieren contratos específicos antes de implementarse.

## Experiencia web

La navegación principal prioriza escritorio, contactos, clientes, oportunidades, tareas, correo, eventos, presupuestos y configuración. La interfaz trabaja con datos reales de la API y presenta estados vacíos, errores y carga. Los datos demo se identifican como tales y proceden de un seed local explícito.

Cambiar empresa cancela operaciones de lectura y limpia la selección y los resultados anteriores. El token de API se mantiene fuera de JavaScript del navegador mediante una capa de servidor Next.js y cookie HttpOnly. Las operaciones de mutación deben verificar origen para proteger frente a solicitudes cruzadas.

El diseño toma patrones de densidad, tipografía, superficies y navegación de los proyectos de referencia. La vista móvil web sigue siendo útil; la aplicación iOS dispone de flujos propios adaptados a encuentros y captura rápida.

## Experiencia iOS y voz

La revisión visual iOS sigue la dirección blanca aprobada por el usuario, inspirada en Apple Music: contenido sobre `systemBackground`, listas sin tarjetas, títulos grandes y Liquid Glass nativo en la navegación y acciones de iOS 26. Hoy muestra una semana seleccionable y grupos de seguimiento por fecha, con Nueva nota dentro del menú +; Personas y Contacto siguen las maquetas guardadas en `docs/ios-design-proposals/white-music/`. Los datos ilustrativos de las maquetas no se insertan en la API. Se conserva compatibilidad desde iOS 17 mediante controles alternativos y colores semánticos, con Dynamic Type y adaptación a Reducir transparencia. El nombre visible es gocrm y el icono móvil usa una G circular con dos nodos de vidrio sobre grafito. Véase `docs/design-ios-liquid-glass.md`.

La aplicación permite consultar y buscar contactos, ver afiliaciones, consultar correo autorizado, gestionar seguimiento y registrar notas. Los tokens se guardan en Keychain. El servidor controla autorización también en móvil.

El flujo de voz empieza con un dictado voluntario del usuario, solicita los permisos del sistema, muestra una transcripción editable y permite confirmar contacto y contenido antes de guardarlo. No se asocia una nota a una persona solo porque su nombre se parezca.

Las notas pendientes sin conexión se separan por usuario y workspace. Solo se sincronizan en su contexto original. El cambio de empresa no las reasigna. Los datos locales usan las protecciones de almacenamiento de iOS y deben borrarse de acuerdo con las acciones explícitas de usuario. La primera sincronización offline se limita a notas; no promete resolución de conflictos para todo el CRM.

Las compilaciones locales Debug de iOS incluyen un modo demo explícito sin API: se activa desde el acceso, Espacio o el aviso de servidor no disponible. Una banda permanente identifica los datos ficticios. Los fixtures se crean únicamente al entrar y permiten probar contactos, notas, tareas, encuentros y permisos por email. No conectan Gmail ni realizan peticiones de red. Los cambios viven solo en memoria, se descartan al salir y nunca se sincronizan. La sesión real y sus notas locales permanecen separadas; al salir se recupera la sesión anterior y se vacían las vistas antes de consultar de nuevo la API. No hay sustitución automática de respuestas reales ni entrada a la demo en Release. Este modo de prueba no es una caché offline del CRM.

Preparar un evento permite repasar nombres, fotos disponibles, empresa y contexto. Reconocimiento facial automático y grabación de conversaciones de terceros no forman parte de la primera versión.

## Contrato de integración

contracts/openapi.json es el contrato verificable de la API implementada. La ruta base es /api/v1; JSON utiliza snake_case. Los cambios compatibles añaden operaciones o campos opcionales. Cambiar semántica, eliminar campos o hacer obligatorio un campo existente requiere una nueva versión o migración acordada.

Todas las integraciones operan con permisos explícitos y un workspace. La primera versión utiliza sesiones de usuario. OAuth para integraciones máquina a máquina, webhooks firmados, claves idempotentes genéricas y cursores de sincronización externos son ampliaciones: no deben presentarse como disponibles hasta contar con endpoints y pruebas.

Para integrar el software externo todavía no identificado habrá que determinar el sistema responsable de cada dato, identificadores de correspondencia, alcance de escritura, frecuencia, conflictos y reglas de borrado. No se concede acceso global al correo para facilitar una integración.

## Criterios de aceptación

| ID | Comportamiento verificable |
| --- | --- |
| TEN01 | Un ID de otra empresa no se puede leer, editar, asociar o borrar |
| TEN02 | Una petición con empresa anterior después de cambiar sesión responde 409 |
| TEN03 | El cambio de empresa no altera otra sesión del usuario |
| ACL01 | Alberto no obtiene asunto, cuerpo ni existencia de un correo privado por API |
| ACL02 | Un participante original comparte un mensaje; el receptor lo ve y no lo recompartirá |
| ACL03 | Revocar un permiso impide lecturas posteriores |
| ACL04 | Una nota privada no aparece en listados, métricas ni detalles de otros usuarios |
| REL01 | Un contacto tiene dos afiliaciones activas y conserva relaciones cerradas |
| REL02 | Las relaciones entre registros de distintas empresas se rechazan |
| API01 | Las respuestas y errores satisfacen el contrato OpenAPI |
| API02 | Un usuario no autenticado no puede consultar datos de dominio |
| GML01 | OAuth inválido, caducado o repetido se rechaza |
| GML02 | Sin credenciales la interfaz informa que Gmail no está configurado |
| GML03 | Repetir una sincronización no duplica mensajes de una misma conexión |
| QTE01 | El total se calcula en servidor y valores inválidos se rechazan |
| IOS01 | Una nota dictada se revisa antes de enviarla |
| IOS02 | Una nota offline no se envía a otra empresa después de cambiar contexto |
| WEB01 | Altas, modificaciones y errores reflejan la respuesta real de la API |

El resultado de las comprobaciones efectivamente ejecutadas se registra en docs/verification.md. La tabla define criterios; no afirma por sí sola que todos estén verificados.

## Límites de la primera entrega

La ejecución local no acredita preparación para producción. Antes de desplegar deben quedar resueltos HTTPS, gestión de secretos, identidad e invitaciones reales, backups y restauración, límites de retención, métricas operativas, rate limits, revisión de seguridad, distribución iOS y configuración/verificación Google. No se publican datos ni se envían correos como parte del desarrollo local.

## Referencias externas

- [Permisos de correo en HubSpot](https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide).
- [Acceso oficial a APIs de LinkedIn](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access).
- [Verificación de scopes restringidos de Google](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
- [Tareas en segundo plano de Laravel](https://laravel.com/docs/queues).
