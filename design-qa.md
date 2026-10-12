# QA · gocrm iOS blanco

final result: passed

No quedan diferencias P0/P1/P2 accionables en las pantallas y estados comprobados.

## Fuente, implementación y normalización

Fuente visual aprobada: `docs/ios-design-proposals/white-music/01-hoy.png`, `02-personas.png` y `03-contacto.png`. Cada referencia mide 853 × 1844 px; proporción lógica aproximada 390 × 844 pt, sin hardware ni status bar.

Implementación: `apps/ios/verification/white-music/06-hoy.png`, `02-personas.png`, `03-contacto.png`. iPhone 17 / iOS 26.3, viewport 402 × 874 pt, 1206 × 2622 px (@3x). SwiftUI nativo; no viewport CSS.

Comparaciones conjuntas: `qa-01-hoy-final.png`, `qa-02-personas-final.png`, `qa-03-contacto-final.png` en la carpeta de verificación. La fuente se normaliza a 390 × 844; a la app se le recortan los 62 pt de status bar y se escala por ancho a 390 × 788, manteniendo proporción. No se deforma para forzar la altura: las barras nativas y safe areas difieren de la maqueta. Regiones de detalle: `qa-01-hoy-detail.png`, `qa-02-personas-detail.png`, `qa-03-contacto-detail.png`.

Estado: tema claro, tamaño normal, sesión local NitsNets; Bernardo en Contacto. Las referencias usan datos ilustrativos, mientras la app usa exclusivamente el seed existente. Por eso Personas contiene dos registros y Contacto incluye una segunda afiliación histórica; no se falsificó contenido para llenar pantallas. El contexto privado se consulta únicamente desde las respuestas autorizadas de la API.

## Historial de comparación y correcciones

1. `qa-contact-initial.png`: P2 por insets duplicados entre identidad/acciones/secciones, títulos grises y filas de personas de 98 pt. Se ajustaron insets explícitos y se usaron encabezados de fila con color semántico de etiqueta. La captura `qa-03-contacto-2.png` confirma recuperación de densidad y jerarquía; las filas de Personas pasan a aproximadamente 74 pt.
2. La primera prueba UI detectó que borrar la búsqueda mantenía el teclado, ocultando la navegación inferior. Se añadió gestión de foco al borrar y enviar. El recorrido completo posterior navega a Correo, cambia de empresa y vuelve sin fallo.
3. `qa-01-hoy-2.png`: P2 porque el espacio residual desplazaba el primer encuentro detrás de Nueva nota. Se retiró el espaciado automático de secciones y el padding duplicado de filas. `qa-01-hoy-final.png` muestra título, fecha y lugar del encuentro completos por encima de la acción.
4. Primera captura AX XXXL: P2 porque Nueva nota flotante tapaba contenido y Label partía palabras en las acciones. Se integró la captura como primera fila en tamaños de accesibilidad y se eliminaron los iconos de las etiquetas grandes. `11-hoy-accesibilidad.png` y `13-contacto-accesibilidad.png` muestran etiquetas completas y botones accesibles. El recorrido abre ambas acciones con éxito.
5. La captura desplazada de Datos a AX XXXL detectó un icono decorativo de edificio que crecía fuera de su columna. Se fijó su tamaño, sin limitar el texto. `14-datos-accesibilidad.png` confirma alineación sin desbordamiento; la prueba focalizada volvió a pasar.

## Superficies de fidelidad

- Tipografía: SF del sistema, títulos grandes en raíces, nombre destacado y metadata secundaria; Dynamic Type conserva texto, permite varias líneas y apila controles. La maqueta no incluye medidas exactas de SF; se mantienen estilos semánticos nativos.
- Espaciado y composición: márgenes de aproximadamente 16–20 pt, Personas con filas ligeras, ficha centrada y secciones directas sobre blanco; CTA flotante solo en tamaños normales. El contenido largo se desplaza bajo las barras del sistema y puede llevarse íntegro al área de lectura.
- Color: `systemBackground` blanco en claro, texto oscuro, secundario neutro, rojo semántico para vencimientos. Cristal limitado a navegación, selección y acciones. `15-hoy-oscuro.png` verifica fondo negro, etiquetas y acciones blancas al cambiar de apariencia sin reiniciar.
- Imágenes e iconos: no hay imágenes decorativas en los mocks. Iniciales derivadas del contacto y SF Symbols nativos, sin reproducciones rasterizadas de controles. Se conserva el icono de marca existente.
- Contenido: etiquetas españolas; nombre gocrm, empresa activa diferenciada; tareas y personas de API. La nota ficticia del mock no se crea. Se conserva la trayectoria histórica y las conversaciones que la API permite consultar.

## Interacciones y comprobaciones

16 unitarias y 3 recorridos UI sin fallos; repetición focalizada de accesibilidad tras el último ajuste. Búsqueda/consulta persistida al volver, estado sin resultados, apertura y cancelación de notas/seguimientos, selección de día, navegación de cinco pestañas, acceso por contraseña, estado Google no configurado y aislamiento por empresa. Compilación sin errores; único aviso de Xcode: no hay metadata AppIntents porque esta app no declara esa integración.

No hay consola web: es una app SwiftUI. Evidencia ejecutable en `.xcresult`, rutas en `apps/ios/verification/white-music/README.md`.

## Diferencias aceptadas y límites

- Chrome y sombras Liquid Glass son nativos; no se imita la barra de estado ni el botón Atrás de un render. La acción superior de Hoy usa + para conservar crear seguimiento y cuenta. Los textos de la fecha y del resumen van en dos líneas para mantener legibilidad; refinamiento P3 posible en pantallas amplias.
- Distintos datos reales implican diferente altura de lista. La segunda afiliación se conserva y Notas aparece al desplazar, en vez de omitir historial para coincidir con el mock.
- iOS 17 y un iPhone físico no se ejecutaron en esta revisión. Reducir transparencia tiene fallback explícito, pero no se volvió a activar ese ajuste en el simulador en esta pasada. VoiceOver conserva etiquetas/encabezados; no se hizo una sesión manual con lector de pantalla. OAuth real y dictado siguen fuera de esta verificación visual.

## Checklist final

- [x] Fuentes aprobadas resueltas y conservadas.
- [x] Capturas conjuntas y regiones de detalle inspeccionadas.
- [x] Correcciones P2 repetidas con nueva evidencia.
- [x] Claro, oscuro, texto máximo y acciones principales revisados.
- [x] API, permisos, bundle ID y Keychain preservados.
- [x] Sin contenido ficticio añadido a la app conectada.


## Revisión posterior · 12/10/2026

Por petición expresa, Nueva nota se mueve al menú + tanto en texto normal como de accesibilidad. Se elimina el CTA flotante y la fila alternativa. Las referencias anteriores de esta auditoría describen la composición del 11 de octubre. Se sustituye además la silueta del icono por la G circular de dos nodos aportada por el usuario, conservando vidrio sobre grafito.

Dos recorridos UI actualizados pasan sin fallos, incluyendo apertura/cancelación de Nueva nota desde + en ambos tamaños. Evidencia: `apps/ios/verification/home-plus/`; resultado XCTest `apps/ios/.build/home-plus-ui.xcresult`. Icono 1024 px opaco, compilación firmada e instalación en iPhone 18 Pro completadas.
