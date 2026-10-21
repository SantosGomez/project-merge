# Tareas 001 — Maqueta navegable de las vistas

Spec: `specs/001-vistas-de-frontend/spec.md` (aprobada) · Plan: `specs/001-vistas-de-frontend/plan.md`

Reglas de esta lista: una tarea cada vez; los tests de la lógica primero y `node --test` en verde antes de pasar a la siguiente (constitución, Principio 2); no se instalan paquetes nuevos; ningún archivo existente se modifica o elimina sin permiso del usuario.

- [x] **T1. Constantes del dominio, datos de ejemplo y semilla verificable.** RF-45, RF-12, RF-14, RF-34, RF-2
- Hecho cuando: existen `src/utils/constants.js` con estados, prioridades, etiquetas, colores, perfiles y textos de simulación, y `src/services/exampleData.js` con las cuentas `admin`/`admin123` y `contador`/`contador123` y los casos de ejemplo; `test/exampleData.test.js` comprueba con `node --test` que la semilla incluye la cuenta `contador` sin casos, un contador con casos en los tres estados, un contador de nombre largo con caracteres especiales, un cliente de nombre largo y filas suficientes para que P-2, P-3 y el detalle de un contador con muchos casos desborden una ventana de 1024 × 768 px, manteniendo la cuenta `contador` sin casos, y el test queda en verde.

- [x] **T2. Lógica pura de los casos.** RF-12, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-30, RF-31, RF-32, RF-33
- Hecho cuando: `src/utils/caseRules.js` expone validación del registro, alta con estado Pendiente, conteos por estado con ceros, filtrado por contador y cambios de estado y prioridad sin mutar el arreglo original; `test/caseRules.test.js` cubre cliente vacío, con solo espacios, de 80 caracteres (válido) y 81 (inválido), prioridad sin elegir, cambio de estado desde Finalizado y ambos cambios reflejados en los conteos; `node --test` en verde.

- [x] **T3. Lógica pura de acceso y de estados de pantalla.** RF-2, RF-3, RF-4, RF-8, RF-35, RF-36, RF-37
- Hecho cuando: `src/utils/accessRules.js` resuelve campos faltantes, espacios extremos como vacío, credenciales inválidas y perfil por cuenta distinguiendo mayúsculas y minúsculas; `src/utils/screenState.js` devuelve carga, error, vacío o contenido con la prioridad correcta; `test/accessRules.test.js` y `test/screenState.test.js` pasan con `node --test`.

- [x] **T4. Store de la maqueta en memoria.** RF-7, RF-9, RF-21, RF-25, RF-30, RF-31, RF-38, RF-41
- Hecho cuando: `src/stores/maqueta.js` guarda sesión, casos, contador seleccionado y estado de cada pantalla; reinicia todo a la semilla desde `exampleData.js`; ofrece iniciar sesión, cerrar sesión, registrar caso, cambiar estado o prioridad y activar las dos simulaciones; ninguna decisión de negocio se resuelve dentro del store (todo delega en `utils/`); la maqueta levanta con `npm run dev` sin errores de consola.

- [x] **T5. Rutas, guard y layout común.** RF-1, RF-5, RF-6, RF-8, RF-10, RF-40, RF-42, RF-43, RF-44, RNF-5
- Hecho cuando: `src/router/index.js` define `/login`, `/admin/dashboard`, `/admin/directorio`, `/contador/registro` y `/contador/casos` con su meta de sesión y perfil, y sin la ruta comodín de la plantilla; sin sesión, cualquier dirección interna lleva a P-1 con el aviso de que debe iniciar sesión; con sesión de un perfil, la dirección de otro perfil muestra el acceso denegado con botón de vuelta (los cuatro cruces); `src/layouts/MaquetaLayout.vue` muestra el título de la pantalla, el control de regreso y los dos controles de simulación etiquetados como tales.

- [x] **T6. P-1 inicio de sesión.** RF-1, RF-2, RF-3, RF-4, RF-8, RF-9, RNF-8
- Hecho cuando: `/login` muestra usuario y contraseña con etiquetas y ayuda contextual; enviar con un campo vacío o solo espacios señala cada campo faltante sin avanzar; `Admin`/`admin123` muestra el mensaje genérico de credenciales no válidas sin revelar el dato errado; `admin`/`admin123` abre P-2 y `contador`/`contador123` abre P-5; sin sesión no se ve ningún dato de contadores ni de casos.

- [x] **T7. Componentes de interfaz reutilizables.** RF-20, RF-29, RF-35, RF-36, RF-37, RF-39, RNF-1, RNF-3, RNF-7
- Hecho cuando: `PriorityTag.vue` muestra Alta en rojo, Media en ámbar y Baja en verde siempre con el texto y contraste ≥ 4.5:1; `ScreenLoader.vue`, `EmptyState.vue` y `ErrorState.vue` muestran sus mensajes con las tres partes exigidas por RNF-1 y el botón de reintento; `AccessDenied.vue` y `SimulationControls.vue` muestran su ayuda contextual accesible con puntero, teclado y toque.

- [x] **T8. P-2 dashboard del administrador.** RF-11, RF-12, RF-13, RF-14, RF-15, RF-42, RNF-9, RNF-10
- Hecho cuando: `/admin/dashboard` lista todos los contadores con sus tres conteos, con "0" donde no hay casos; seleccionar un contador muestra su detalle (cliente, estado y etiqueta de prioridad) y cambiar de selección reemplaza el detalle; seleccionar al contador `contador` muestra su mensaje de vacío; "Ver directorio" abre P-3; no existe ningún control para cambiar estado o prioridad; los nombres largos se ven completos y la lista se recorre con desplazamiento vertical; el detalle de un contador con muchos casos también se recorre con desplazamiento vertical, sin paginación y sin perder filas de vista en una ventana de 1024 × 768 px.

- [x] **T9. P-3 directorio y P-4 registro de caso.** RF-16, RF-17, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-43
- Hecho cuando: `/admin/directorio` muestra solo nombres (sin conteos ni casos) y al elegir uno abre P-2 con ese contador seleccionado; `/contador/registro` muestra cliente y prioridad con el estado Pendiente y el contador asignado no editables, "Registrar caso" está disponible en P-5 con y sin casos, y al enviar: sin cliente, con solo espacios, con 81 caracteres o sin prioridad no agrega y explica el motivo, mientras que con 80 caracteres y prioridad elegida agrega el caso, confirma, limpia el formulario y el control "Ver mis casos" abre P-5 con el caso nuevo.

- [x] **T10. P-5 mis casos, simulación completa y pasada final de los criterios.** RF-7, RF-25, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33, RF-34, RF-44, RNF-2, RNF-4, RNF-6, RNF-9, RNF-10
- Hecho cuando: `/contador/casos` solo muestra los casos del contador conectado con su etiqueta de prioridad, permite cambiar estado y prioridad en cualquier momento (también desde Finalizado) con confirmación visible y reflejo en los conteos y el detalle de P-2 en la misma sesión, y muestra su estado vacío con el control "Registrar caso"; "Simular error" y "Simular caducidad" se comportan como en el plan (incluido P-5 vacío y el detalle de P-2 sin conservar selección) y la carga de aproximadamente un segundo aparece al abrir cada pantalla con datos; se ejecutan las 29 comprobaciones de "Criterios de finalización" de la spec de principio a fin (incluido teclado, 360 px, contraste y el desbordamiento a 1024 × 768 px de P-2, P-3 y el detalle de un contador con muchos casos, con la cuenta `contador` sin casos) y todas quedan en verde junto con `node --test` y `npm run lint:check`.

## Cobertura y división

- Las 10 tareas cubren la spec completa: RF-1 a RF-45 y RNF-1 a RNF-10, más los 29 criterios manuales en T10.
- No hace falta dividir la spec en bloques: entran en 10 tareas. Si al ejecutar T9 se comprueba que P-3 y P-4 juntas superan los 30 minutos, la división propuesta es **Bloque A (T1–T8, acceso, navegación y dashboard del administrador)** y **Bloque B (T9–T10, pantallas del contador y cierre)**, siempre dentro de esta misma carpeta `specs/001-vistas-de-frontend/`.
- Dependencias: T2, T3 y T4 dependen de T1; T5 depende de T4; T6 depende de T5; T7 no depende de T6 pero sí de T1; T8 depende de T5 y T7; T9 depende de T7 y T8 (reutiliza el detalle de P-2); T10 depende de T9.
