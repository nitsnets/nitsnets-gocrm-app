# gocrm

CRM con servidor Laravel/PostgreSQL, web Next.js y aplicación iOS SwiftUI. Las tres partes comparten una API versionada. Admite varias empresas usuarias con una empresa activa por sesión y conversaciones privadas por participantes.

## Documentación

- [Especificación funcional](docs/specification.md): decisiones, modelo, privacidad y criterios de aceptación.
- [Arquitectura](docs/architecture.md): componentes y límites de responsabilidad.
- [Contrato API](contracts/README.md) y [OpenAPI](contracts/openapi.json): 58 operaciones con solicitudes, respuestas, validaciones y errores.
- [Guía de integración](docs/integration-guide.md): autenticación, empresas, reintentos y correo.
- [Servidor](apps/api/README.md), [web](apps/web/README.md), [iOS](apps/ios/README.md).
- [Verificación](docs/verification.md): comprobaciones ejecutadas y límites.

## Estructura

```text
apps/api       Laravel y workers
apps/web       Next.js y proxy de sesión
apps/ios       SwiftUI y proyecto Xcode
contracts      Contrato OpenAPI
scripts        Entorno local y validación del contrato
docs           Especificación, arquitectura e integración
.local         PostgreSQL y logs locales, fuera de Git
```

## Ejecutar en este Mac

Requisitos: PHP 8.5 y extensiones PostgreSQL/SQLite, Composer, Node 22 o posterior, npm, PostgreSQL 16+ y Python 3 para el script de configuración. Para iOS: Xcode con SDK iOS y simulador, y XcodeGen para regenerar el proyecto. Las versiones efectivamente probadas están en el informe de verificación.

Para preparar un checkout nuevo:

```bash
npm run setup:local
npm run dev
```

El script usa PostgreSQL instalado en `/opt/homebrew/opt/postgresql@16/bin`. En otro equipo se puede indicar la ruta con CRM_PG_BIN y el puerto con CRM_PG_PORT. El cluster se crea dentro de `.local/postgres`, escucha solo en 127.0.0.1:55439 y utiliza la base nitsnets_crm y el usuario crm_local. La autenticación trust se limita a este entorno local; no copiar esta configuración a producción.

Si ya existen archivos .env, el script los conserva. En este workspace el entorno ya está preparado. Para reanudar PostgreSQL y arrancar las aplicaciones:

```bash
npm run db:start
npm run dev
```

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:3000/api/v1
- Salud API: http://127.0.0.1:3000/api/v1/health

Web y API comparten el puerto de acceso 3000 en desarrollo local. Next reenvía `/api/v1/*` a Laravel, que sigue ejecutándose internamente en `127.0.0.1:8000`. `CRM_API_URL` conserva ese destino interno; no debe apuntar al propio puerto 3000. La web mantiene sus rutas `/api/backend/*` y `/api/auth/*`. En el simulador iOS también se puede indicar `http://127.0.0.1:3000/api/v1` en **Servidor API**.

La misma regla funciona con `next build` y `next start`: configurar `CRM_API_URL` con la URL del servicio Laravel tanto al construir como al arrancar la web, y `CRM_WEB_ORIGIN` con el origen público de Next. Ambos servicios deben estar desplegados; esta configuración no instala Laravel ni cambia por sí sola el dominio que ya sirve la API. En HTTPS, usar `CRM_COOKIE_SECURE=true` y `NEXT_PUBLIC_CRM_DEMO=false`.

El comando dev arranca API, worker, programador de sincronización y web. Ctrl+C detiene esos procesos. PostgreSQL se detiene por separado con `npm run db:stop`. No uses estos comandos sobre bases reales sin revisar la configuración.

## Datos de demostración

El seed local crea NitsNets y una segunda empresa para comprobar el aislamiento. Crea contactos, relaciones históricas y correos ficticios con permisos diferentes.

| Usuario | Correo | Contraseña local |
| --- | --- | --- |
| Eladio | eladio@nitsnets.demo | DemoCRM!2026 |
| José Antonio | jose@nitsnets.demo | DemoCRM!2026 |
| Alberto | alberto@nitsnets.demo | DemoCRM!2026 |

Estas identidades son exclusivamente de prueba. No son cuentas de Google y no deben existir con estas contraseñas en producción. El seed se ejecuta explícitamente, no con cada arranque.

## Aplicación iOS

Abrir `apps/ios/NitsNetsCRM.xcodeproj` y ejecutar el esquema NitsNetsCRM. La firma automática está configurada con el equipo Nitsnets SL (T5922VMWM7), bundle com.nitsnets.crm, y se ha compilado y verificado un binario ARM64 de desarrollo firmado. Instalado y confirmado en el iPhone 18 Pro del usuario el 10 de octubre de 2026. La conexión a la API y el recorrido de uso en ese teléfono todavía no se han verificado.

La URL de API local en el simulador es http://127.0.0.1:8000/api/v1. Un iPhone físico necesita un servidor alcanzable desde el dispositivo; localhost en el teléfono no apunta al Mac. La app pide la URL si no se ha indicado CRM_DEFAULT_API_URL al compilar. El arranque habitual sigue escuchando en loopback. El flujo Google en el teléfono necesita además un callback del servidor alcanzable desde su navegador; para un entorno compartido debe usarse HTTPS. Consultar las instrucciones de firma, red y configuración en el [README de iOS](apps/ios/README.md).

Para probar el iPhone en la misma red local, con PostgreSQL ya iniciado, ejecutar en otra terminal:

```bash
npm run dev:iphone
```

El comando muestra la URL `http://<nombre-del-Mac>.local:8001/api/v1`. En la app se indica en **Servidor API**, o se incorpora mediante CRM_DEFAULT_API_URL al compilar el binario de desarrollo. El script escucha solo en las direcciones IPv4 privadas de las interfaces Ethernet/Wi-Fi activas, con depuración del servidor desactivada. No expone PostgreSQL ni cambia el firewall. Si el Mac está conectado a dos redes, atiende ambas para que el nombre .local funcione en cualquiera de ellas. El Mac debe seguir encendido y este proceso en ejecución. Ctrl+C lo detiene. CRM_IPHONE_PORT y CRM_IPHONE_BIND_ADDRESSES permiten elegir puerto y direcciones privadas explícitas.

La app muestra si el servidor responde, permite reintentar y distingue un problema de red de Google sin configurar. Para los datos de demostración se usa la cuenta de la tabla anterior; una cuenta personal de Gmail no puede iniciar sesión mientras no se configure OAuth y se autorice ese usuario.

La aplicación incluye contactos, seguimiento, correo autorizado, eventos y captura de notas dictadas con revisión. Las notas pendientes se separan por servidor, usuario y empresa. El dictado depende de permisos y disponibilidad de reconocimiento local del dispositivo.

## Gmail

El acceso al CRM admite contraseña y Google. Son permisos distintos: iniciar sesión con Google solicita únicamente identidad; conectar Gmail solicita por separado lectura del buzón. El servidor gestiona ambos flujos y no entrega tokens Google a los clientes. El acceso Google necesita sus variables GOOGLE_LOGIN_* y un usuario real previamente autorizado; no existe registro abierto por dominio.

El conector se configura en apps/api/.env con las credenciales OAuth de vuestra aplicación de Google. Consultar el README del servidor para nombres de variables y redirect URI. Sin esas credenciales, la aplicación muestra Gmail sin configurar y no simula una conexión.

Las pruebas de integración del proveedor utilizan respuestas controladas de Google. La autorización de un buzón real, los requisitos de consentimiento/verificación y la prueba de sincronización con ese buzón siguen pendientes de configuración. No se han leído ni enviado correos reales.

## Verificación

```bash
npm run contract:check
npm run verify:api
cd apps/api && php artisan test
cd ../web && npm test && npm run typecheck && npm run build
```

verify:api necesita API y base local arrancadas. Crea y elimina registros de prueba y valida respuestas contra OpenAPI; no acepta un host remoto sin autorización explícita mediante variable de entorno. La suite del servidor utiliza SQLite en memoria por defecto. Para probar PostgreSQL debe utilizarse una base exclusiva de test, nunca la base demo o de producción: las pruebas reconstruyen el esquema.

Las instrucciones y resultados de iOS están en su README. El contrato se regenera desde scripts/generate-contract.mjs; modificar el generador y volver a ejecutar contract:generate para evitar perder cambios.

## Alcance

La primera versión incluye CRM, permisos de correo, multiempresa, Gmail configurable, presupuestos manuales y móvil nativo. IA para propuestas, biblioteca de referencias, PDF/envío, webhooks, credenciales de servicio, adjuntos Gmail, múltiples correos por contacto y sincronización avanzada LinkedIn/WhatsApp no se presentan como implementados. La especificación conserva esas ampliaciones.

Esta entrega es un entorno de desarrollo verificable. Despliegue de producción, distribución en dispositivos, identidad/invitaciones y operación de datos reales requieren la configuración y validación correspondientes.
