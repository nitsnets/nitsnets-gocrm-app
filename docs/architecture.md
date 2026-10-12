# Arquitectura del CRM

El servidor es la autoridad de identidad, datos, permisos y cálculos. La web y iOS pueden evolucionar independientemente siempre que respeten el contrato OpenAPI. Un único despliegue lógico de Laravel contiene módulos separados por responsabilidad; PostgreSQL conserva integridad referencial y transacciones.

## Componentes

| Componente | Responsabilidad |
| --- | --- |
| apps/api | Autenticación, selección de workspace, CRM, ACL de mensajes, Gmail, cálculos |
| PostgreSQL | Persistencia relacional, constraints, índices y transacciones |
| Worker Laravel | Sincronización de correo y operaciones de duración variable |
| apps/web | Next.js, proxy de sesión con cookie HttpOnly, interacción web |
| apps/ios | SwiftUI, Keychain, URLSession, captura de voz y notas locales |
| contracts | OpenAPI verificable y ejemplos; contrato para consumidores |
| docs | Reglas funcionales, privacidad, operación y evidencia de validación |

## Decisiones

### Servidor modular

Se utiliza Laravel porque el proyecto requiere políticas de autorización, migraciones, colas y conexiones con terceros además del CRUD. Separar servicios de despliegue no aporta una ventaja inicial. Las tareas largas se procesan en workers; una petición web no espera a descargar un buzón completo.

### Una empresa activa

El token representa una sesión y almacena su workspace activo. El usuario debe pertenecer a la empresa solicitada. X-Workspace-ID es una comprobación de contexto, nunca una autorización suministrada por el cliente. Los endpoints de sesión no requieren ese header; los de dominio sí. Las búsquedas por ID se realizan dentro del workspace, no mediante una consulta global seguida de un filtro tardío.

Los clientes descartan respuestas de solicitudes iniciadas bajo otra sesión/empresa. Esto evita que una respuesta lenta de la empresa anterior rellene una pantalla tras el cambio. La separación por sesión permite que un cambio en web no rompa el trabajo del móvil.

### Privacidad por recurso

Las policies de contacto y mensaje son independientes. Los mensajes tienen participantes y permisos explícitos. Los agregados deben aplicar esos mismos filtros antes de contar o devolver actividad. No existe una excepción de lectura general para administradores.

### Google como proveedor de identidad

Laravel centraliza OpenID Connect para ambos clientes. El estado temporal vincula el tipo de cliente, su challenge PKCE, el nonce y un segundo verificador para el intercambio con Google. Tras validar el ID token, el servidor entrega un código efímero al retorno configurado. El cliente necesita su verificador original para canjearlo por la sesión CRM habitual. No se transmiten tokens Google a Next ni a iOS, ni se conservan para leer correo.

La identidad persistente usa el sub de Google, con vinculación inicial limitada a usuarios existentes. La pertenencia a una empresa se comprueba también al crear la sesión. La conexión Gmail tiene su propio consentimiento, credenciales cifradas y contexto de empresa; es un flujo independiente.

### Contratos y versiones

OpenAPI documenta lo implementado. Las pruebas comprueban sintaxis y esquemas contra respuestas reales. El contrato no promete una integración externa todavía sin diseñar. Los futuros SDKs se pueden generar desde el contrato; la primera versión usa clientes pequeños y tipados.

### Interfaz por plataforma

GTT GADD UX y Hundrev CMS UX aportan la paleta neutra, la jerarquía y la densidad del producto. La web reutiliza componentes y tipografía Inter de esas referencias. iOS interpreta el mismo lenguaje mediante controles SwiftUI: NavigationStack, TabView, List y Form, tipografía del sistema con Dynamic Type y colores semánticos que responden a claro/oscuro. Es una aplicación nativa conectada directamente a la API; no utiliza una WebView para presentar el CRM.

### Datos locales

Los datos de ejemplo solo se cargan con un seed explícito. El cluster PostgreSQL local se guarda en .local, ignorado por Git, y escucha únicamente en loopback en un puerto dedicado. La configuración de producción nunca debe copiar el mecanismo de autenticación local trust.

## Riesgos y controles

| Riesgo | Control |
| --- | --- |
| Fuga entre empresas | Contexto validado, consultas acotadas, FK autorizadas, tests con dos empresas |
| Compartir un correo por asociarlo a una ficha | ACL independiente y prueba de lecturas negativas |
| Robo del token web por JavaScript | Cookie HttpOnly, proxy del servidor, comprobación de origen |
| Tokens de Gmail expuestos | Cifrado servidor, exclusión de serialización y logs |
| Asignación falsa por remitente o nombre | Identidad verificada y confirmación; sin auto-fusión |
| Error de importes | Unidades menores y cálculo servidor con límites |
| Datos obsoletos tras cambio de empresa | Cancelación de peticiones, invalidación de estado y header de contexto |
| Dictado ambiguo | Revisión editable y elección explícita del contacto |

## Ampliaciones previstas

Biblioteca y generación de propuestas con IA, versiones comerciales, PDF, webhooks firmados, integraciones máquina a máquina, identidades múltiples de correo con vigencia, retención automatizada e invitaciones requieren extender el contrato y sus pruebas. LinkedIn y WhatsApp dependen del acceso oficial disponible; no se sustituyen por scraping de sesiones.
