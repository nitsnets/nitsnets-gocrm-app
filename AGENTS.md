# gocrm

El producto se llama **gocrm**. NitsNets es la empresa inicial, no el nombre de la aplicación. La marca compartida está en `assets/brand`; conservar los identificadores técnicos existentes de iOS para mantener instalaciones y sesiones.

## Producto y arquitectura

Leer docs/specification.md y contracts/openapi.json antes de modificar comportamiento. Servidor Laravel, PostgreSQL, Next.js web, SwiftUI iOS. Toda regla de negocio y autorización reside en API. Workspace es empresa usuaria, company es cliente. Una empresa activa por sesión. Nunca mezclar datos entre workspaces.

## Privacidad

El acceso a contactos no otorga acceso a mensajes. Solo participantes internos verificados y destinatarios de grants pueden leer un mensaje; solo participantes originales pueden compartir. No bypass por rol administrador. No revelar existencia, metadata, snippets, adjuntos ni resúmenes a quien no tenga permiso. Notas privadas por defecto. Cambiar workspace limpia estado del cliente. No almacenar tokens en logs, URLs propias ni artefactos versionados.

## Trabajo

Mantener schemas, docs y clientes coordinados. No declarar funciones completadas si dependen de credenciales, servicios o despliegue no comprobados. No enviar correos ni propuestas sin acción explícita del usuario. Datos demo solo entornos locales/test con seed explícito. Probar aislamiento, permisos y cálculos cuando cambien; ejecutar checks pertinentes de cada app. No introducir mocks silenciosos en flows conectados.

## Referencias visuales

Las referencias confirmadas por el usuario son /Users/eladrodriguez/Sites/gtt-gadd-ux y /Users/eladrodriguez/Sites/hundrev-cms-ux. Son de solo lectura. Reutilizar sus componentes shadcn, tokens neutros, tipografía Inter, densidad y estructura de navegación. No inventar una identidad visual alternativa. Documentar la procedencia de los componentes adaptados.

La referencia principal para la composición web es GTT GADD UX, según la corrección posterior del usuario. Consultar docs/design-gtt-review.md: menú de 12.25 rem, cabecera de empresa, títulos con icono, acción principal en la cabecera y tablas compactas. No volver a la composición de Hundrev por compartir los mismos componentes base.

Las fichas web, altas y ediciones son páginas con URL propia, breadcrumb, vuelta al listado y secciones según `interesado-ficha.tsx` de GTT. No volver a presentar registros o formularios de negocio en modales. Conservar búsqueda, filtros y página al volver al listado. Configuración sigue las filas de preferencias de GTT.

En iOS adaptar esa jerarquía y paleta a SwiftUI: NavigationStack, TabView, List/Form, SF Symbols, colores semánticos y tipografía del sistema con Dynamic Type. Inter y los componentes shadcn corresponden a la web; la app móvil no incrusta una web ni imita controles HTML. Mantener superficies neutras y contenido funcional, sin héroes publicitarios ni eslóganes.
