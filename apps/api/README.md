# NitsNets CRM API

Servidor funcional Laravel 13 / PHP 8.5 / PostgreSQL 16. API versionada `/api/v1`; contrato compartido en `../../contracts/openapi.json`. No necesita compilar assets web; Next.js vive en `../web`.

## Arranque

Desde esta carpeta:

```sh
composer install
cp .env.example .env
php artisan key:generate
# Configurar credenciales de PostgreSQL en .env.
php artisan migrate
# Únicamente entorno local: datos de demostración.
php artisan db:seed
php artisan serve --host=127.0.0.1 --port=8000
```

El script raíz prepara PostgreSQL local en el puerto 55439. `.env.example` usa el puerto estándar 5432 para otras instalaciones. Nunca ejecutar `migrate:fresh` contra una base que contenga datos reales. Alternativa local sin PostgreSQL: `DB_CONNECTION=sqlite`, `DB_DATABASE=/ruta/absoluta/database.sqlite` y crear el archivo vacío antes de migrar.

La semilla está bloqueada fuera de `APP_ENV=local/testing`. Usuarios **exclusivamente de demostración**: `eladio@nitsnets.demo`, `jose@nitsnets.demo`, `alberto@nitsnets.demo`; contraseña común `DemoCRM!2026`. Eladio pertenece a NitsNets y Estudio Norte; José y Alberto solo a NitsNets. Los tres mensajes semilla reproducen 1, 2 y 3 participantes. Los UUID se obtienen del login, no se codifican en clientes.

Para provisionar cuentas reales desde una consola administrada y de confianza:

```sh
php artisan crm:provision 'Mi organización' 'persona@example.com' 'Nombre Apellido'
```

Solicita contraseña oculta de 12 caracteres mínimo, o la toma de `CRM_ADMIN_PASSWORD` si está definida. El operador debe haber verificado la identidad y el correo de la persona: el comando marca ese correo como verificado. Si ya existe el usuario conserva su contraseña y se añade su membresía. Aún no hay invitaciones, autoservicio de alta, recuperación de contraseña ni MFA. Los roles administrativos no conceden acceso general al correo.

## Contrato y permisos

- JSON snake_case, UUID, importes enteros en céntimos, EUR en esta versión.
- Login devuelve un token aleatorio de 256 bits; solo se guarda SHA-256. Caduca en 7 días. Logout revoca ese token.
- Un workspace activo por token. Los endpoints de dominio requieren `Authorization: Bearer …` y `X-Workspace-ID`; una cabecera antigua devuelve 409. Cambiar empresa afecta solo a esa sesión.
- CRUD valida referencias dentro del workspace. Campos desconocidos en escrituras CRUD, login, cambio de empresa y grants devuelven 422. Campos calculados no se envían de vuelta.
- Listas con `{data, meta:{total,page,per_page}}`, hasta 100 elementos. Miembros devuelve `{data:[...]}` sin paginar. Afiliaciones de un contacto devuelve lista completa con meta.
- Mensajes: solo participantes originales y usuarios con grant. Ni ser administrador ni consultar el contacto/cliente da acceso. Participantes originales gestionan grants; quien recibe un grant no puede volver a compartir. POST grant devuelve el mensaje actualizado (200). Revocación y concesión quedan auditadas en la base.
- No existe herencia de permisos entre mensajes/hilos. BCC no se devuelve; el propietario de una copia recibida en BCC queda oculto a otros en `participants`.
- Notas privadas por defecto. Solo el autor edita o borra; `workspace` permite lectura al equipo. Búsqueda, detalle, listado y dashboard aplican los mismos filtros.
- Notas POST aceptan `client_request_id` UUID opcional. Identificador único por workspace/autor. Un reintento idéntico devuelve la nota existente; contenido diferente devuelve `409 idempotency_conflict`. La base impone unicidad y la inserción se serializa por autor para reintentos concurrentes. Un cambio posterior en la nota no crea otra nota al reintentar el POST inicial.
- Presupuestos: `quantity` positivo, máximo 100000, hasta dos decimales; `unit_price_minor` entero 0–100000000. Cada línea se redondea half-up a céntimos usando aritmética entera. `line_total_minor` y `total_minor` son solo lectura. No incluyen impuestos. Cada modificación conserva una instantánea interna y aumenta `version`; todavía no hay interfaz/API de recuperación de versiones, PDF ni envío.
- Respuestas API usan `Cache-Control: private, no-store`. Tokens nunca deben guardarse en almacenamiento web accesible a JavaScript; la web usa su BFF y iOS Keychain.

## Acceso con Google

El login Google es independiente de conectar Gmail. Usa exclusivamente `openid email profile`; no concede permiso para leer correos. Configurar `GOOGLE_LOGIN_CLIENT_ID` y `GOOGLE_LOGIN_CLIENT_SECRET` (si están vacíos se reutilizan `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`). En el cliente OAuth web de Google registrar `GOOGLE_LOGIN_REDIRECT_URI`, por defecto `http://127.0.0.1:8000/api/v1/auth/google/callback`.

Los únicos retornos permitidos son valores fijos de servidor: `GOOGLE_LOGIN_WEB_RETURN_URI` (por defecto `http://127.0.0.1:3000/api/auth/google/callback`) y `GOOGLE_LOGIN_IOS_RETURN_URI` (`com.nitsnets.crm://oauth/google`). Cada frontend genera un verificador PKCE propio, conserva ese verificador y el state de inicio, y verifica el state recibido antes de canjear el código. No existe un parámetro de redirección arbitraria.

1. GET `/auth/google` devuelve `{data:{configured}}`.
2. POST `/auth/google/start` con `{client:"web"|"ios",code_challenge}` devuelve URL Google y state. `code_challenge` es base64url sin padding de SHA-256 del verificador del cliente.
3. El callback valida state de un solo uso (10 minutos), PKCE independiente con Google, nonce y token de identidad firmado RS256 mediante JWKS oficial. Se comprueban issuer, audience, authorized party, expiración, iat, sub y correo verificado. Claves públicas cacheadas con refresco ante rotación; errores del proveedor no registran contenido ni tokens.
4. Se redirige al retorno fijo con un código opaco de 60 segundos y state, jamás con la sesión. Ante error con state válido: `error=access_denied|not_allowed|provider_error` más state. State inválido/caducado/repetido devuelve JSON 400 y no redirige.
5. POST `/auth/google/exchange` con `{code,code_verifier}` valida la prueba PKCE, vuelve a comprobar membresías y consume el código bajo bloqueo transaccional. Devuelve el mismo objeto `data` que login con contraseña: `token,user,workspace,workspaces`.

**No crea usuarios ni empresas.** Primero hay que provisionar la dirección real mediante `crm:provision`. Para el primer enlace por email se exige que Google sea autoridad de esa dirección: Gmail/Googlemail o un claim `hd` que coincida exactamente con el dominio. Una cuenta Google con correo externo sin esa prueba no puede enlazar una cuenta existente por coincidencia de email. Las identidades enlazadas se reconocen por `sub` persistente, no por cambios posteriores de correo; un segundo sub no puede apropiarse de un usuario ya enlazado. Solo usuarios con al menos una membresía activa pueden entrar. Las cuentas demo `.demo` no son cuentas Google reales.

Las tablas guardan hashes de state, nonce y código temporal, además del verificador Google cifrado. No se guardan access/refresh tokens de Google para este login. Aplicar `php artisan migrate` después de actualizar. La implementación está probada con tokens RSA firmados en tests y transporte Google aislado, pero **no se ha completado un login contra una cuenta Google real** sin las credenciales y autorización del usuario.

## Gmail real

Crear un cliente OAuth web en Google Cloud, habilitar Gmail API, configurar consentimiento y usuarios de prueba/verificación según el tipo de aplicación. Registrar exactamente `GOOGLE_REDIRECT_URI` y establecer `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FRONTEND_URL`. No se incluyen credenciales.

Flujo: POST `/integrations/gmail/connect` entrega una URL OAuth y `state`. Acepta `client: web|ios` opcional (web por defecto). iOS vuelve exclusivamente a `com.nitsnets.crm://oauth/gmail?state=…&gmail=connected|cancelled|error|account_mismatch`; no se admiten URLs de retorno arbitrarias ni se devuelven tokens al cliente. La cancelación consume también el estado. Para cambiar de buzón hay que desconectar primero; renovar autorización mantiene la identidad de la conexión. State aleatorio de un solo uso y diez minutos, almacenado como hash; PKCE S256; callback enlazado al usuario/workspace original. Acceso y refresh token cifrados con `APP_KEY`; guardar y respaldar esa clave fuera del repositorio. La identidad del buzón se verifica con Gmail `/users/me/profile`. El único scope solicitado es `gmail.readonly`, necesario para cuerpos de mensajes. No se solicitan permisos de envío.

Ejecutar en procesos separados:

```sh
php artisan queue:work --tries=3 --timeout=300
php artisan schedule:work
```

Polling del servidor cada cinco minutos. El estado consultable distingue `queued`, `syncing`, `connected`, `sync_error` y `reauthorization_required`; en este último caso sincronizar devuelve 409 y hay que repetir OAuth. Los errores de proveedor se devuelven sin payload ni cadenas de excepciones con secretos. iOS consulta el estado cada cinco segundos mientras la vista está activa y actualiza el listado al cambiar la última sincronización; la web hace polling durante trabajos pendientes. `DB_QUEUE_RETRY_AFTER=360` debe superar el timeout de 300 segundos. Los jobs usan unicidad y bloqueo de ejecución por conexión, con expiración. También se puede ejecutar `php artisan gmail:sync` o POST `/integrations/gmail/sync` (202 solo significa encolado).

Primera sincronización: últimos 30 días, excluye spam/papelera. Siguientes: cursor `historyId`, exclusión también de mensajes con etiquetas SPAM/TRASH, paginación, recuperación inicial cuando Gmail responde 404 por cursor caducado. Se procesan solo mensajes cuyos From/To/Cc contienen un contacto existente del workspace. Remitentes desconocidos se omiten; aún no existe bandeja de sugerencias ni importación manual. Un contacto añadido después no recupera automáticamente mensajes antiguos ya saltados.

Cada copia importada pertenece a la conexión y al ID interno de Gmail, **nunca se unen ACL mediante Message-ID externo**. Una misma conversación sincronizada desde dos buzones puede aparecer duplicada; esta es una limitación deliberada de la primera versión. To/Cc se extraen como mailboxes, ignorando correos incrustados en nombres de presentación. Solo direcciones internas previamente verificadas o cuentas Gmail conectadas dan acceso. No se concede acceso por un From que podría estar falsificado; el remitente interno accede como propietario de su conexión. Alias no conectados no se adivinan.

Cuerpo solo texto, con conversión de HTML a texto; no se cargan imágenes remotas, adjuntos ni HTML ejecutable. Los errores de sincronización registran mensajes sanitizados, sin cuerpo de correo ni respuestas OAuth. Al desconectar se eliminan los tokens locales, conservando los mensajes ya importados; para revocar también el permiso en Google, usar la configuración de seguridad de la cuenta de Google. Aún no se propagan eliminaciones/etiquetas desde Gmail ni se envían correos.

Sin credenciales configuradas, `configured=false` y conectar devuelve 503. No se presenta una conexión simulada como real. Las pruebas validan el protocolo con respuestas HTTP aisladas; falta validación extremo a extremo contra una cuenta de Google autorizada.

## Pruebas

```sh
php artisan test --compact
vendor/bin/pint --dirty --format agent
```

Por defecto PHPUnit usa SQLite en memoria. Suite cubre aislamiento por workspace y por sesión, cambios de empresa y cabeceras antiguas, ACL sin bypass admin, grants/revocación, notas privadas e idempotencia, relaciones históricas, integridad de referencias, validación, cálculo/versionado, OAuth state/PKCE y tokens cifrados, Gmail incremental y BCC, falsificación en display names, retorno iOS fijo con cancelación/error, progreso/reautorización, rechazo de cambio silencioso de buzón y exclusión de spam/papelera/conexiones eliminadas. Protocolo de sincronización basado en [la guía oficial de Gmail](https://developers.google.com/workspace/gmail/api/guides/sync).

La misma suite se puede ejecutar con PostgreSQL usando **una base dedicada de pruebas**. `RefreshDatabase` borra/recrea su esquema al comenzar:

```sh
DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=55439 DB_DATABASE=nitsnets_crm_test DB_USERNAME=crm_local DB_PASSWORD='' php artisan test --compact
```

## Límites de esta entrega

Es una primera versión funcional para revisión local. No incluye conectores LinkedIn (solo URL manual), WhatsApp, proveedor LLM, transcripción de audio en servidor, API pública de webhooks, sincronización entre servidores, adjuntos, varias direcciones por contacto, invitaciones, exportaciones ni despliegue de producción. Aprobado/enviado de presupuesto son estados manuales y no envían nada al cliente. No se ha auditado para producción; antes de operar con datos reales hacen falta gestión de usuarios, copias/restauración, política de conservación, observabilidad sin contenido privado y configuración HTTPS/secretos/permisos de Google. El aislamiento se impone en aplicación y pruebas, no con PostgreSQL RLS.
