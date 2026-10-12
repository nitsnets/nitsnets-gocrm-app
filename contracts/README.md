# Contrato de la API de NitsNets CRM

[openapi.json](openapi.json) es la especificación OpenAPI 3.1 autocontenida, con 58 operaciones implementadas bajo /api/v1. Puede importarse en Swagger Editor, Postman y generadores de clientes compatibles. No contiene credenciales reales.

La [guía de integración](../docs/integration-guide.md) explica las reglas de empresa activa y privacidad. La [especificación funcional](../docs/specification.md) define el comportamiento de producto.

## Validación y cambios

El origen editable del contrato es scripts/generate-contract.mjs. Después de cambiarlo se ejecutan `npm run contract:generate` y `npm run contract:check`. La comprobación valida OpenAPI, IDs únicos y contexto de empresa, y coteja operaciones en ambas direcciones contra las rutas de Laravel. `npm run verify:api` comprueba respuestas reales contra los esquemas, aislamiento e idempotencia en el servidor local.

Las rutas son v1. La versión 0.2.0 incorpora acceso Google además de contraseña; cualquier cambio incompatible para consumidores debe acordarse y versionarse. Los códigos de error y restricciones de payload forman parte del contrato, no solo los nombres de los endpoints.

## Operaciones

Todas requieren bearer y X-Workspace-ID excepto las operaciones de sesión, salud y callback OAuth según indique OpenAPI. Los IDs en las rutas son UUID.

| Método | Ruta | Área |
| --- | --- | --- |
| POST | `/auth/login` | Sesión |
| GET | `/auth/google` | Disponibilidad de acceso Google |
| POST | `/auth/google/start` | Inicio de acceso Google |
| GET | `/auth/google/callback` | Callback de navegador Google |
| POST | `/auth/google/exchange` | Canje de código por sesión |
| POST | `/auth/logout` | Sesión |
| GET | `/me` | Sesión |
| POST | `/session/workspace` | Sesión |
| GET | `/dashboard` | Escritorio |
| GET | `/members` | Empresas usuarias |
| GET | `/health` | Sistema |
| GET | `/contacts` | Contactos |
| POST | `/contacts` | Contactos |
| GET | `/contacts/{id}` | Contactos |
| PATCH | `/contacts/{id}` | Contactos |
| DELETE | `/contacts/{id}` | Contactos |
| GET | `/companies` | Clientes |
| POST | `/companies` | Clientes |
| GET | `/companies/{id}` | Clientes |
| PATCH | `/companies/{id}` | Clientes |
| DELETE | `/companies/{id}` | Clientes |
| GET | `/opportunities` | Oportunidades |
| POST | `/opportunities` | Oportunidades |
| GET | `/opportunities/{id}` | Oportunidades |
| PATCH | `/opportunities/{id}` | Oportunidades |
| DELETE | `/opportunities/{id}` | Oportunidades |
| GET | `/tasks` | Tareas |
| POST | `/tasks` | Tareas |
| GET | `/tasks/{id}` | Tareas |
| PATCH | `/tasks/{id}` | Tareas |
| DELETE | `/tasks/{id}` | Tareas |
| GET | `/notes` | Notas |
| POST | `/notes` | Notas |
| GET | `/notes/{id}` | Notas |
| PATCH | `/notes/{id}` | Notas |
| DELETE | `/notes/{id}` | Notas |
| GET | `/events` | Eventos |
| POST | `/events` | Eventos |
| GET | `/events/{id}` | Eventos |
| PATCH | `/events/{id}` | Eventos |
| DELETE | `/events/{id}` | Eventos |
| GET | `/quotes` | Presupuestos |
| POST | `/quotes` | Presupuestos |
| GET | `/quotes/{id}` | Presupuestos |
| PATCH | `/quotes/{id}` | Presupuestos |
| DELETE | `/quotes/{id}` | Presupuestos |
| GET | `/contacts/{id}/affiliations` | Afiliaciones |
| POST | `/contacts/{id}/affiliations` | Afiliaciones |
| PATCH | `/affiliations/{id}` | Afiliaciones |
| GET | `/messages` | Correo privado |
| GET | `/messages/{id}` | Correo privado |
| POST | `/messages/{id}/grants` | Correo privado |
| DELETE | `/messages/{id}/grants/{grantId}` | Correo privado |
| GET | `/integrations/gmail` | Gmail |
| DELETE | `/integrations/gmail` | Gmail |
| POST | `/integrations/gmail/connect` | Gmail |
| POST | `/integrations/gmail/sync` | Gmail |
| GET | `/integrations/gmail/callback` | Gmail |

## Garantías de esta versión

- Todos los datos de dominio quedan limitados a la empresa activa y a los permisos del usuario.
- Los mensajes y notas privadas filtran contenido y metadatos antes de devolver una respuesta.
- Los cambios de empresa se aplican a la sesión actual; un contexto anterior se rechaza.
- POST /notes tiene reintentos idempotentes con client_request_id. No hay idempotencia genérica para otros POST.
- Las cantidades comerciales se validan y calculan en servidor. Los totales iniciales son sin impuestos y EUR.
- Las operaciones largas de Gmail devuelven encolado; requieren worker y configuración OAuth.

No se ofrecen todavía webhooks, tokens de aplicación, carga de adjuntos, envío de correo ni generación de propuestas con IA. El otro software deberá concretar sus flujos y fuente de verdad antes de ampliar el contrato para sincronización bidireccional.
