# Tareas 003 — Frontend funcional conectado al backend

Máximo 10 tareas, en orden de dependencia. Cada una con sus RF y comprobación verificable. Formato: `node --test` desde `Seguimiento-proyectos/`.

**Leyenda:** ⚠️ = modifica archivos existentes que ya funcionan en la spec 001. Debajo de cada tarea ⚠️ se listan los archivos existentes tocados y qué cambia; el usuario resolverá esas dudas antes de implementar.

---

- [ ] **T1. Tests de utilidades puras nuevas (en rojo).** RF-03, RF-07, RF-13, RF-21, RF-22, RF-23, RF-28, RF-36, RNF-01, RNF-06
  - Hecho cuando: `node --test test/validators.test.js test/inactividad.test.js test/formateadores.test.js test/mensajes.test.js` falla (tests en rojo) para `validarCredenciales`, `validarCliente`, `validarPrioridad`, `calcularMinutosInactividad`, `estaInactivo`, `formatearEstado`, `formatearPrioridad`, `construirError`.

- [ ] **T2. Implementar utilidades puras nuevas.** RF-03, RF-07, RF-13, RF-21, RF-22, RF-23, RF-28, RF-36, RNF-01, RNF-06
  - Hecho cuando: `node --test test/validators.test.js test/inactividad.test.js test/formateadores.test.js test/mensajes.test.js` pasa en verde; las funciones son síncronas, deterministas con `hoy` inyectado, y devuelven los valores esperados (campos faltantes, booleano de inactividad, texto/color/tooltip, tres partes del error).
  - Archivos creados: `src/utils/validators.js`, `src/utils/inactividad.js`, `src/utils/formateadores.js`, `src/utils/mensajes.js`.

- [ ] **T3. Servicios de API, auth, contadores y casos.** RF-01, RF-02, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-24, RF-25, RF-27, RF-28, RF-29, RF-30, RF-32, RF-33, RF-34, RF-36, RF-42, RF-43, RF-44
  - Hecho cuando: `src/services/api.js` envía `Authorization: Bearer <token>` desde `sessionStorage`; `authService.login`, `logout`, `getToken`, `setToken`, `getRol`, `getUsuario`, `limpiarSesion` leen/escriben `sessionStorage`; `counterService` y `caseService` consumen los endpoints del backend; el token se elimina al cerrar sesión o caducar; pruebas manuales confirman que sessionStorage es independiente por pestaña.
  - Archivos creados: `src/services/api.js`, `src/services/authService.js`, `src/services/counterService.js`, `src/services/caseService.js`.

- [ ] **T4. Stores de sesión, contadores y casos.** RF-01, RF-02, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-27, RF-28, RF-29, RF-30, RF-32, RF-33, RF-42, RF-43, RF-44
  - Hecho cuando: `src/stores/session.js`, `src/stores/counters.js` y `src/stores/cases.js` están registrados en `src/stores/index.js` y exponen el estado reactivo esperado; `src/stores/maqueta.js` ya no alimenta las pantallas (se conserva como referencia de la maqueta 001).
  - Archivos creados: `src/stores/session.js`, `src/stores/counters.js`, `src/stores/cases.js`.
  - Archivos existentes tocados: `src/stores/index.js` (se agregan los nuevos stores).

- [ ] **T5. Pantalla P-1 Login, layout de login y router con guards.** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-01, RF-03, RF-04, RF-05, RF-06, RF-08, RF-09, RF-10, RF-38, RNF-04
  - Hecho cuando: P-1 muestra título distinto; login con campos vacíos o solo espacios señala los faltantes y no avanza; credenciales inválidas muestran mensaje genérico sin indicar cuál falló; login válido de administrador abre `/admin/dashboard` y de contador abre `/contador/casos`; sin sesión, acceder a pantallas internas lleva a `/login` con aviso; perfil incorrecto muestra acceso denegado con vuelta a la pantalla principal del perfil; el perfil no se elige manualmente; P-1 usa un layout propio sin menú interno.
  - Archivos existentes tocados:
    - `src/pages/LoginPage.vue`: se sustituye el login en memoria (datos de `exampleData.js` / `maqueta.js`) por `authService.login`; se cambia su layout a `LoginLayout.vue`.
    - `src/router/index.js`: se cambian los guards para usar `sessionStorage` y el backend en lugar de `maqueta.js`; se añade `LoginLayout.vue` para la ruta `/login`.
    - `src/router/accessState.js`: se mantiene `accessDenied` pero se alimenta del guard actualizado.
    - `src/utils/constants.js`: se quita `SIMULATION` (controles de simulación eliminados).
    - `src/utils/accessRules.js`: `resolveProfile` recibe las cuentas/rol desde `authService` en lugar de importarlas de `exampleData.js`.
    - `test/accessRules.test.js`: puede requerir ajuste si `resolveProfile` cambia su firma para recibir las cuentas como argumento; las pruebas de `validateLoginForm` y `normalizeCredential` se mantienen sin cambios.
  - Archivo nuevo: `src/layouts/LoginLayout.vue` (layout propio para P-1, sin menú interno).
  - Dudas para el usuario: ¿se conservan `src/pages/index.vue` y `src/pages/[...path].vue` sin cambios? ¿el redireccionamiento del login desde raíz sigue funcionando con el nuevo layout?

- [ ] **T6. Pantalla P-2 Dashboard (administrador).** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-11, RF-12, RF-13, RF-14, RF-15, RF-38, RF-39, RNF-02, RNF-03, RNF-05, RNF-08, RNF-09
  - Hecho cuando: P-2 muestra lista de contadores con conteos por estado (ceros incluidos), detalle de contador seleccionado con cliente/estado/prioridad (texto + color), mensaje de vacío si no tiene casos, control "Ver directorio" abre P-3, control de regreso vuelve a P-3; indicador de carga mientras se obtienen datos; mensaje de error con tres partes y reintentar si falla; responsivo y con tooltips.
  - Archivos existentes tocados:
    - `src/pages/AdminDashboardPage.vue`: se sustituyen datos en memoria por `counterService`.
    - `src/components/PriorityTag.vue`: se verifica que tenga tooltip y contraste ≥ 4.5:1.
    - `src/components/CaseRow.vue`: se reusa para mostrar filas de caso.
    - `src/components/CounterCountsRow.vue`: se reusa para mostrar conteos.
    - `src/components/AccessDenied.vue`: se verifica que muestre el botón de vuelta al perfil.
    - `src/components/ErrorState.vue`: se verifica que tenga las tres partes y botón Reintentar.
    - `src/components/EmptyState.vue`: se reusa para mensajes de vacío.
    - `src/components/ScreenLoader.vue`: se reusa para indicador de carga.
    - `src/components/EssentialLink.vue`: se reusa para enlaces de navegación.
  - Dudas para el usuario: ¿`ErrorState.vue` ya cubre el rol de "Mensaje de error con tres partes + reintentar"? ¿`EmptyState.vue` ya cubre el rol de "Mensaje de vacío"?

- [ ] **T7. Pantalla P-3 Directorio + eliminación de SimulationControls + limpieza de MaquetaLayout.** ⚠️ **Modifica y elimina archivos existentes que ya funcionan.** RF-16, RF-17, RF-38
  - Hecho cuando: P-3 muestra solo nombres de contadores; al elegir uno abre P-2 con ese contador seleccionado; control de regreso vuelve a P-3; `SimulationControls.vue` se elimina físicamente junto con sus importaciones en `MaquetaLayout.vue`; `MaquetaLayout.vue` deja de renderizar controles de simulación y está listo para integrar `AvisoSesionCaducada.vue` en T9.
  - Archivos existentes tocados:
    - `src/pages/CountersDirectoryPage.vue`: se sustituyen datos en memoria por `counterService`.
    - `src/components/SimulationControls.vue`: **ELIMINA** el archivo y sus importaciones (en `src/layouts/MaquetaLayout.vue`).
    - `src/layouts/MaquetaLayout.vue`: se quita la importación y el uso de `SimulationControls.vue`.
  - Dudas para el usuario: ¿ningún test de `test/` menciona `SimulationControls.vue` (verificado: solo se importa en `MaquetaLayout.vue`)? Si el usuario considera que algún test de build/lint depende de él, debe aprobar la eliminación antes de proceder.

- [ ] **T8. Pantallas P-4 Registro de caso y P-5 Mis casos (contador).** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33, RF-37, RF-40, RF-41
  - Hecho cuando: P-4 muestra formulario con cliente y prioridad, estado Pendiente y contador asignado no editables, tres prioridades con texto + color; validaciones (cliente obligatorio, prioridad obligatoria, máximo 80 caracteres) evitan el registro y muestran mensaje identificando el dato; registro válido confirma, vacía el formulario y ofrece "Ver mis casos"; P-5 muestra casos del contador con cliente/estado/prioridad, permite cambiar estado y prioridad en cualquier momento (incluido Finalizado) con confirmación visual, muestra mensaje de vacío con "Registrar caso" cuando no tiene casos, y control de regreso.
  - Archivos existentes tocados:
    - `src/pages/NewCasePage.vue`: se sustituye el registro en memoria por `caseService.crearCaso`.
    - `src/pages/MyCasesPage.vue`: se sustituyen datos en memoria por `caseService` (lectura y actualización de estado/prioridad).
    - `src/components/PriorityTag.vue`: se reusa para mostrar etiquetas de prioridad.
    - `src/components/CaseRow.vue`: se reusa para mostrar filas de caso.
    - `src/components/ErrorState.vue`: se reusa para errores de registro y actualización.
    - `src/components/EmptyState.vue`: se reusa para mensaje de vacío "No tiene casos registrados".
    - `src/layouts/MaquetaLayout.vue`: se verifica que el control de regreso funcione entre P-4 y P-5.

- [ ] **T9. Estados de interfaz transversales y caducidad por inactividad.** RF-07, RF-34, RF-35, RF-36, RF-38, RF-43, RNF-01, RNF-03, RNF-07
  - Hecho cuando: al abrir P-2/P-3/P-4/P-5 aparece indicador de carga y no se muestran datos antes de terminar; errores de red/servidor muestran mensaje con tres partes + reintentar; 30 minutos sin interacción eliminan el token de `sessionStorage` y muestran aviso de sesión caducada con acceso a P-1; tooltips accesibles por puntero, teclado y toque en prioridades, estados, conteos, campos, registro, acceso denegado y sesión caducada; recorrido completo posible solo con teclado y foco visible.
  - Archivo creado: `src/components/AvisoSesionCaducada.vue`.
  - Archivos existentes tocados:
    - `src/layouts/MaquetaLayout.vue`: se integra `AvisoSesionCaducada.vue` y el aviso de acceso denegado.
    - `src/utils/screenState.js`: se reusa para decidir carga/error/vacío/contenido (no se toca si ya funciona).

- [ ] **T10. Recorridos end-to-end y pruebas finales (fusión de verificación).** RF-01 a RF-44 (todos), RNF-01 a RNF-09 (todos), criterios de finalización 1-30
  - Hecho cuando: se verifican los recorridos admin (P-1 → P-2 → detalle → "Ver directorio" → P-3 → nombre → P-2 → regreso) y contador (P-1 → P-5 → "Registrar caso" → P-4 → registrar → "Ver mis casos" → P-5 → regreso); recarga de página mantiene la sesión mientras la pestaña está abierta; cerrar la pestaña cierra la sesión y vuelve a P-1; abrir otra pestaña empieza en P-1 sin sesión; nombres largos y caracteres especiales se muestran completos; listas largas usan desplazamiento vertical sin paginación; no existen controles "Simular caducidad" ni "Simular error" en ninguna pantalla; `node --test` desde `Seguimiento-proyectos/` pasa en verde (100% de tests, ninguno fallando, incluidas las 105 pruebas de la spec 001 y las 4 nuevas suites de utilidades); se recorren los 30 criterios de finalización de la spec sobre la aplicación terminada; la spec queda lista para su aprobación.
  - Archivos existentes tocados: ninguno nuevo; solo verificación sobre la aplicación terminada.

## Cobertura y división

- Las 10 tareas cubren la spec completa: RF-01 a RF-44, RNF-01 a RNF-09, y los 30 criterios de finalización verificados en T10.
- No hace falta dividir la spec en bloques: entran en 10 tareas.
- T9 y T10 se fusionaron en una sola tarea de verificación (T10) para mantener el máximo de 10 tras dividir T6 en dos (T6 y T7).
- Dependencias: T2 depende de T1; T3 depende de T2; T4 depende de T3; T5 depende de T2, T3 y T4; T6 depende de T3, T4 y T5; T7 depende de T3, T4, T5 y T6; T8 depende de T3, T4, T5, T6 y T7; T9 depende de T3, T4, T5, T6, T7 y T8; T10 depende de T1 a T9.

## Tests de la spec 001 afectados y cómo se mantienen en verde

| Test existente | Puede verse afectado por | Cómo se mantiene en verde |
|---|---|---|
| `test/accessRules.test.js` | Cambio en `src/utils/accessRules.js` (`resolveProfile` ahora recibe las cuentas desde `authService`, no de `exampleData.js`) | Las pruebas de `validateLoginForm`, `normalizeCredential` y detección de campos faltantes son puras y no cambian. `resolveProfile` se adapta para recibir las cuentas como argumento; la lógica pura se mantiene. |
| `test/caseRules.test.js` | Cambio en `src/utils/caseRules.js` | No se ven afectadas: son funciones puras que operan sobre arreglos en memoria; se siguen usando para validación local antes de enviar al backend. |
| `test/exampleData.test.js` | `src/services/exampleData.js` deja de ser la fuente de verdad | Se mantienen en verde como documentación de los datos semilla de la maqueta 001; ya no se importan en tiempo de ejecución de las pantallas. |
| `test/maquetaStore.test.js` | `src/stores/maqueta.js` ya no alimenta las pantallas | Se mantienen en verde; el store de maqueta se conserva pero ya no se usa en las vistas P-1 a P-5. |
| `test/screenState.test.js` | Ninguno | `src/utils/screenState.js` se reusa sin cambios funcionales. |
| `test/layout-drawer-check.js` | Ninguno | No se toca el drawer del layout. |
| `test/t9Pages.test.js` | Cambio en nombres de archivo de `src/pages/` | Se mantienen en verde si los nombres de archivo de `pages/` se conservan (`LoginPage.vue`, `AdminDashboardPage.vue`, etc.). |
| **Ningún test de `test/`** | `SimulationControls.vue` | Verificado con grep: ningún archivo en `test/` menciona `SimulationControls`. La única referencia está en `src/layouts/MaquetaLayout.vue` (importación y uso). Al eliminar el archivo y su importación, no hay tests de unidad que fallen. |

## Decisiones pendientes para el usuario

1. **Recuento de tareas**: Tras dividir T6 en T6 (P-2) y T7 (P-3 + eliminación SimulationControls), y fusionar T9+T10 en T10 (verificación final), quedan exactamente 10 tareas. No se necesita dividir la spec en bloques.
2. **Layout de login**: `src/layouts/LoginLayout.vue` se propone como NUEVO. El usuario debe confirmar el nombre y que no se use `MaquetaLayout.vue` para P-1.
3. **`src/pages/index.vue` y `src/pages/[...path].vue`**: No se tocan salvo que el redireccionamiento del login lo exija. El usuario debe confirmar si requiere algún cambio.
4. **`ErrorState.vue` y `EmptyState.vue`**: Se reutilizan tal cual. Si el usuario considera que les falta algo (por ejemplo, las tres partes del error o el botón Reintentar), debe indicarlo antes de T6.