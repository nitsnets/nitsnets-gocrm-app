# Guía de integración con la API

La API REST de NitsNets CRM sirve a la web, a iOS y a futuros consumidores externos. La definición verificable está en [OpenAPI](../contracts/openapi.json). Esta guía explica el contexto de empresa, la privacidad y los flujos de uso; no sustituye los esquemas.

## Entornos y autenticación

La dirección local es http://127.0.0.1:8000/api/v1. En producción se requiere HTTPS. La primera versión utiliza sesiones de usuario mediante un token opaco bearer; no ofrece todavía credenciales máquina a máquina ni permisos de aplicación independientes.

POST /auth/login recibe email y password. Devuelve token, user, workspace y workspaces. Cada token representa una sesión independiente. GET /me recupera su contexto. POST /auth/logout revoca la sesión actual.

Guardar el token en Keychain en iOS o en una sesión de servidor/cookie HttpOnly en web. No incluirlo en URLs, logs, eventos analíticos o repositorios. No se debe poner un token de integración permanente en el código del frontend.

### Acceso Google

GET /auth/google devuelve configured. El acceso usa únicamente openid email profile y no sustituye el consentimiento separado para Gmail.

1. El cliente genera al menos 32 bytes aleatorios y conserva el verificador en base64url. Calcula code_challenge como base64url(SHA-256(verificador)), sin padding.
2. POST /auth/google/start recibe client (web o ios) y code_challenge. Devuelve authorization_url y state. El cliente guarda state junto al verificador durante un máximo de diez minutos y abre la URL.
3. Google regresa al callback del servidor. Laravel comprueba estado, PKCE del proveedor y firma/claims del ID token. Resuelve una identidad autorizada y redirige a la URL fija de ese cliente con code y state, o error y state. Los retornos no se reciben del usuario ni se incluyen como parámetros del inicio.
4. El cliente verifica el retorno exacto y su state; después POST /auth/google/exchange envía code y code_verifier. El código dura sesenta segundos y se consume una sola vez. La respuesta coincide con POST /auth/login.

La web implementa este intercambio en rutas de servidor Next; el navegador no recibe el bearer en JSON. El state y el verificador transitorios viven en cookies HttpOnly. iOS utiliza ASWebAuthenticationSession, valida el callback com.nitsnets.crm://oauth/google y guarda el bearer en Keychain. Un error o cancelación elimina el intento local; se inicia otro flujo si se quiere reintentar.

No hay registro público automático. El usuario debe existir y tener al menos una membresía. Las cuentas demo .demo no pueden utilizar Google. Un primer enlace por correo exige email_verified y autoridad de Google sobre ese correo; después se utiliza la identidad estable sub. La configuración y los retornos exactos están en el [README del servidor](../apps/api/README.md).

## Selección de empresa

POST /session/workspace recibe workspace_id y comprueba que el usuario sea miembro. La empresa seleccionada es la activa de ese token. Las demás sesiones del usuario no cambian.

Todas las peticiones de dominio llevan Authorization y X-Workspace-ID. El header de empresa confirma que la petición se originó bajo el contexto correcto; no sirve para acceder libremente a otra empresa. Si una petición antigua llega después del cambio, el servidor devuelve 409. El cliente debe cancelar lecturas pendientes y borrar datos en pantalla y caché antes de cargar la nueva empresa.

No ejecutar escrituras concurrentes durante el cambio. Una operación que ya se haya autorizado y confirmado antes del cambio puede haber tenido efecto en la empresa anterior; no debe repetirse bajo la empresa nueva.

## Respuestas y errores

Una respuesta individual tiene data. Las listas paginadas tienen data y meta con total, page y per_page. Las listas pequeñas no paginadas, cuando estén definidas así en OpenAPI, solo tienen data. El máximo de página es 100.

Los errores incluyen error.code, error.message y opcionalmente error.details. Los consumidores deben decidir por status/code, no interpretar el texto español. 401 indica sesión inválida; 403 una operación no permitida; 404 un recurso inexistente o no visible; 409 un contexto obsoleto o conflicto; 422 un payload inválido; 429 límite de solicitudes; 503 una integración no configurada o no disponible.

No distinguir ante el usuario entre un mensaje inexistente y uno privado. Esa distinción filtraría la existencia de conversaciones.

## Contactos y relaciones

Crear primero la empresa cliente y el contacto cuando proceda. Crear después una afiliación con POST /contacts/{id}/affiliations y company_id, role, started_on y ended_on opcional. Las relaciones simultáneas están permitidas.

Cerrar una afiliación con PATCH /affiliations/{id}, conservando el registro. No modificar las asociaciones históricas de correos, oportunidades o notas al actualizar la afiliación de un contacto.

Todos los IDs asociados deben pertenecer a la empresa activa. No usar una búsqueda global de contactos por correo para compartir una ficha entre empresas.

## Notas y reintentos

POST /notes crea una nota privada por defecto. La visibilidad workspace la comparte con los miembros de la empresa. Una nota privada es distinta del campo notes de una ficha de contacto, que forma parte de los datos comunes del contacto.

Los clientes que puedan perder conexión generan un UUID client_request_id al crear el borrador y lo conservan en cada reintento. Ese identificador se limita al usuario y empresa. Repetir el mismo contenido devuelve la misma nota; reutilizarlo con otro contenido produce 409. Después de un resultado incierto no se debe generar un ID nuevo para la misma operación.

Esta garantía no es una clave de idempotencia genérica para toda la API. No reintentar automáticamente otros POST tras un timeout sin comprobar primero si se completaron. La sincronización Gmail tiene su propia deduplicación por identificadores de proveedor.

## Correo y permisos

GET /messages solo devuelve mensajes permitidos. GET /messages/{id} aplica la misma autorización. can_share indica si el usuario es participante original y puede conceder acceso. El acceso a contactos o clientes nunca concede lectura de mensajes.

POST /messages/{id}/grants recibe user_id de un miembro de la empresa. DELETE /messages/{id}/grants/{grantId} revoca un permiso compartido. Estas operaciones no alteran destinatarios del email original, no envían notificaciones por correo y no comparten mensajes posteriores.

No representar un hilo como accesible porque se vea uno de sus mensajes. Tampoco usar listas de participantes para reconstruir destinatarios ocultos. Los permisos se vuelven a consultar en servidor en cada petición; no confiar en un can_share almacenado como autorización.

## Gmail

GET /integrations/gmail informa si existen credenciales de servidor y si el usuario ha conectado un buzón para esta empresa. POST /integrations/gmail/connect devuelve authorization_url para iniciar OAuth. El callback de navegador lo gestiona Laravel con state temporal.

POST /integrations/gmail/sync devuelve 202 cuando el trabajo queda en cola. Un worker tiene que procesarlo; el estado de conexión permite consultar el resultado. DELETE /integrations/gmail desconecta el buzón sin convertir mensajes privados en públicos.

La aplicación no implementa envío de correos ni sincronización de LinkedIn o WhatsApp. No construir interfaces que afirmen esas capacidades.

## Importes y propuestas

La primera versión utiliza EUR. Los importes value_minor, unit_price_minor, line_total_minor y total_minor son enteros en céntimos. quantity admite hasta dos decimales. Cada partida se redondea half-up al céntimo y el total suma partidas. Los límites exactos están en OpenAPI. Ejemplo: quantity 1.25 por unit_price_minor 101 produce 126 céntimos.

El servidor recalcula el total: el cliente no decide importes finales. El total inicial es sin impuestos. Un presupuesto marcado como enviado registra ese estado; no dispara envío real. Generación con IA, impuestos, descuentos, PDF y firma no forman parte del contrato inicial.

## Evolución del contrato

La especificación tiene versión propia y rutas /api/v1. Los consumidores deben tolerar campos nuevos de respuesta, seguir los enums publicados y no depender de detalles internos de base de datos. Los IDs no tienen significado comercial. Antes de declarar una versión estable para otro proveedor se valida el conjunto de operaciones que utilizará con casos de integración acordados.

Quedan por definir con el software externo: autoridad de cada dato, sincronización bidireccional o unidireccional, identificadores externos, borrado, recuperación tras interrupciones y política de conflictos. Webhooks firmados, scopes de servicio y registro de cambios se incorporarán cuando ese flujo esté identificado.
