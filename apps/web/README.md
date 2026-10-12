# Web CRM · Next.js

Cliente web real en español de la API Laravel del repositorio. No contiene datos mock ni credenciales de prueba en el bundle. Las cuentas demo se crean exclusivamente con el seeder de la API; consulta el README raíz para acceder a ellas.

## Ejecutar

Requiere Node 22 o posterior y API Laravel funcionando.

```sh
cp .env.example .env.local
npm ci
npm run dev
```

Abrir http://127.0.0.1:3000. `CRM_API_URL` es una variable **solo del servidor** y apunta por defecto a `http://127.0.0.1:8000/api/v1`. Las solicitudes pasan por `/api/backend/*`: no hace falta exponer CORS de Laravel al navegador.

```sh
npm run typecheck
npm test
npm run build
npm start
```

La etiqueta «Datos de demostración» depende de `NEXT_PUBLIC_CRM_DEMO=true`, activado en el ejemplo local. Desactívalo (`false`) antes de construir para producción. En producción HTTPS configura `CRM_COOKIE_SECURE=true` y `CRM_WEB_ORIGIN` con el origen público exacto. El valor false del ejemplo sirve exclusivamente al desarrollo local HTTP. Las cookies duran la sesión del navegador; el vencimiento y revocación del token se aplican en Laravel. No desplegar esta web aisladamente sin configurar su API y las credenciales OAuth del servidor.

## Flujos disponibles

- Login con contraseña y acceso real con Google cuando Laravel tiene OAuth configurado; restauración de sesión, logout y selección de una única empresa activa.
- Resumen con métricas de servidor, tareas y actividad autorizada.
- Contactos: búsqueda/paginación, alta/edición, detalle, email/teléfono/LinkedIn, afiliaciones simultáneas e históricas, notas privadas o visibles en el espacio y correo autorizado.
- Clientes: alta/edición, búsqueda y estado.
- Oportunidades: pipeline, importes en EUR, etapa, cliente/contacto y fecha de cierre.
- Tareas: altas, edición y completar/reabrir; fecha y relaciones.
- Eventos: fecha/lugar/notas y contactos esperados.
- Correo: solo listado/detalle autorizado; participantes, compartir/revocar si `can_share`, contenido como texto sin ejecutar HTML.
- Presupuestos: partidas, cantidad de hasta dos decimales, precio en céntimos, cliente/oportunidad y estados. Muestra el último total **calculado por el servidor**, sin impuestos; no promete envío ni IA.
- Gmail: estado real de configuración, autorización OAuth, sincronización encolada y desconexión. Conectar permanece deshabilitado si el servidor carece de credenciales.
- Carga, errores, vacíos, navegación responsive, formularios con etiquetas y validación, fichas, altas y ediciones como páginas con URL propia.

## Sesión y privacidad

El token permanece en cookie HttpOnly/SameSite=Strict y nunca se devuelve al JavaScript del navegador. Las mutaciones comprueban Origin; el proxy tiene destino fijo, rutas restringidas, timeout y no sigue redirecciones. Se evita caché para toda información de CRM.

Cada petición de dominio lleva el `X-Workspace-ID` de la sesión **visible en esa pestaña**. El proxy comprueba que coincida con la cookie y devuelve 409 antes de llamar al backend si está obsoleta. Evita que un formulario abierto en otra pestaña cree registros en la nueva empresa tras un cambio. Laravel vuelve a verificar la empresa contra el token.

El cambio de empresa desmonta toda la interfaz de datos; las lecturas usan AbortController y descartan resultados antiguos. Ante un 409 por empresa obsoleta se recarga la sesión y se vacía la interfaz previa. Un BroadcastChannel sin datos personales avisa a otras pestañas para limpiar la sesión al salir y recargarla al cambiar de empresa o iniciar sesión. No hay datos de contactos, mensajes ni tokens en localStorage. Los permisos efectivos siempre pertenecen al servidor.

## Interfaz basada en GTT GADD UX

La referencia principal es `/Users/eladrodriguez/Sites/gtt-gadd-ux`. Se compararon visualmente su inicio y su listado de interesados con el CRM a 1280 × 800. La referencia se ejecutó desde una copia aislada en `.local/gtt-reference`; su repositorio original no se modificó. Hundrev permanece como procedencia de los componentes base, pero ya no determina la composición del menú.

| Fuente de GTT | Adaptación al CRM |
| --- | --- |
| `app/globals.css`, `app/layout.tsx` | Inter local, escala tipográfica, tokens neutros, bordes y radios. |
| `components/layout/workspace-shell/workspace-shell.tsx` | Menú de 12.25 rem, panel inset con margen de 4 px, borde suave, cabecera de 48 px y acción principal en ella. |
| `workspace-shell/negociado.tsx`, `sidebar-nav.tsx` | Cabecera de empresa compacta, grupos sin rótulos adicionales, selección gris, búsqueda de secciones, menú plegable y perfil al pie. |
| `components/modules/certiac/ui.tsx` (`PageHeader`) | Título de 24 px con icono de 40 px, jerarquía y separación del buscador. |
| `components/modules/certiac/interesados-lista.tsx` | Lupa dentro del buscador, tabla ligera, avatares circulares de 24 px, columnas separadas, paginación y filtros de estado como botones. |
| Pantalla `/inicio` | Bienvenida centrada, accesos rápidos y módulos de seguimiento en ancho completo, conservando las métricas reales del CRM. |

Se conservan los componentes shadcn compartidos (`Button`, `Input`, `Table`, `Sidebar`, `Sheet`, `Tooltip`) y la API real. Los accesos rápidos navegan a módulos existentes, los filtros consultan Laravel y la cabecera abre los formularios actuales. No se incorporan mocks, contadores de GTT, funciones administrativas ajenas al CRM ni botones sin acción. Las fichas, altas y ediciones ahora son páginas completas inspiradas en `interesado-ficha.tsx`: identidad, acciones en cabecera y secciones. Configuración usa filas agrupadas como `/preferences`. El acceso conserva su formulario de contraseña/Google.

Comprobación: build de producción y TypeScript correctos; navegación, búsqueda real de contactos, ficha, apertura/cancelación del alta, filtros de tareas, menú plegable y navegación móvil revisados. Capturas y notas en `docs/design-gtt-review.md`.

## Rutas de fichas

`/contacts/:id`, `/companies/:id`, `/opportunities/:id`, `/tasks/:id`, `/events/:id`, `/quotes/:id` y `/messages/:id` abren páginas de detalle. `/:seccion/new` y `/:seccion/:id/edit` presentan formularios completos (correo solo lectura). `/contacts/:id/affiliations/new` añade una relación. Los parámetros `q`, `page` y `status` preservan el contexto del listado. El correo abierto desde un contacto permite volver a su pestaña de actividad. Los enlaces antiguos `/?view=...` siguen funcionando.

Las rutas cargan los recursos directamente desde la API y conservan los estados de carga, error y recurso no disponible. No existe una excepción de permisos para enlaces directos. `tests/record-navigation.test.mjs` cubre las rutas, el contexto, las vueltas y los enlaces inválidos.

## Acceso con Google

La web consulta `GET /auth/google` y muestra el acceso deshabilitado si Laravel devuelve `configured:false`. Mantiene el acceso con contraseña. Los secretos OAuth viven exclusivamente en Laravel.

1. Un formulario POST a `/api/auth/google/start` verifica el origen y genera un verificador aleatorio de 256 bits; envía su desafío PKCE S256 a Laravel.
2. Conserva verificador y state en cookies **HttpOnly, SameSite=Lax**, de 10 minutos, restringidas a `/api/auth/google`; redirige únicamente a `https://accounts.google.com`.
3. Google vuelve a Laravel. Laravel valida la identidad y redirige con un código efímero al callback web fijo `/api/auth/google/callback`.
4. Next verifica el state, intercambia código y verificador por servidor, guarda la sesión CRM en cookies HttpOnly/SameSite=Strict, borra las cookies temporales y redirige al resumen. El token nunca aparece en URL ni JSON del navegador.

En producción configura `CRM_WEB_ORIGIN` con el origen público HTTPS. En Laravel, `GOOGLE_LOGIN_WEB_RETURN_URI` debe apuntar a ese origen seguido de `/api/auth/google/callback`; localmente es `http://127.0.0.1:3000/api/auth/google/callback`. El acceso está limitado a usuarios existentes autorizados por Laravel. Iniciar sesión con Google no concede permisos para leer Gmail; la conexión de correo permanece en Configuración.

## Límites actuales

El pipeline se aplica a la página cargada (20 registros); los contadores indican la paginación. Búsqueda y filtros de estado se ejecutan en el servidor. Selectores de relación y listas de notas limitan a 100 registros y deberán ampliarse con búsqueda paginada para volúmenes grandes. Sin arrastrar tarjetas: cambiar etapa desde el editor. Sin adjuntos, envío de emails, exportación PDF, integración LLM ni sincronización LinkedIn. No hay borrado destructivo desde la interfaz por ahora. No existe recuperación de contraseña en esta entrega; el acceso lo provisiona el servidor.

## Verificación

`CRM_WEB_TEST_URL=http://127.0.0.1:3000 npm test` añade una prueba de integración real contra Next y Laravel: login sin token en JavaScript, CRUD contacto, cálculo y edición de presupuesto, CSRF, rechazo de empresa obsoleta y logout. Crea y elimina sus propios registros de prueba. Las credenciales se pueden proporcionar con `CRM_WEB_TEST_EMAIL` y `CRM_WEB_TEST_PASSWORD`; por defecto utiliza el seeder demo local.

`npm test` cubre la frontera de empresa activa del proxy: rechaza la pestaña anterior y las peticiones sin empresa visible, permite la empresa vigente y la recuperación de sesión. `npm run typecheck` y `npm run build` validan el código completo. La integración de permisos y aislamiento se prueba de forma adicional en Laravel y en la revisión de navegador del repositorio.

### Prueba completa del callback web

Después de `npm run build`, ejecutar:

```sh
CRM_GOOGLE_ROUTE_TESTS=true node --test tests/google-routes.integration.test.mjs
```

Arranca un Next de producción temporal en el puerto 3103 y un servidor API controlado en un puerto efímero. Comprueba el flujo real de las rutas: inicio con PKCE y cookies HttpOnly, bloqueo de state inválido sin intercambio, callback válido que crea sesión y borra cookies temporales, y cancelación del proveedor. No modifica la API local real, no requiere credenciales Google y no simula una conexión Google visible para el usuario. `CRM_GOOGLE_ROUTE_TEST_PORT` permite usar otro puerto. La prueba contra el proveedor Google real requiere credenciales y consentimiento del usuario.
