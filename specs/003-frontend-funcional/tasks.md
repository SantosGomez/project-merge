# Tareas 003 — Frontend funcional conectado al backend

Máximo 10 tareas, en orden de dependencia. Cada una con sus RF y comprobación verificable. Formato: `node --test` desde `Seguimiento-proyectos/`.

**Leyenda:** ⚠️ = modifica archivos existentes que ya funcionan en la spec 001. Debajo de cada tarea ⚠️ se listan los archivos existentes tocados y qué cambia; el usuario resolverá esas dudas antes de implementar.

---

## Puertas de verificación (valen para todas las tareas)

1. Desde `Seguimiento-proyectos/`: `node --test` completo en verde, sin ningún test fallando (excepción `T1`: debe quedar en rojo solo en los 4 archivos nuevos de utilidades y el resto en verde).
2. `npm run build` en verde en toda tarea que toce archivos `.vue`, `router`, `layouts` o `stores` (`T4` a `T9` y `T10`). Confirmado: `package.json` tiene `"build": "quasar build"`.
3. **NO usar `npm run lint`** como puerta porque en este proyecto ejecuta `prettier --write` y `eslint --fix` y reescribe archivos existentes.
4. El backend no se toca; no hay puertas del backend.
5. Cada tarea reporta el resultado literal de cada puerta (`node --test`: nº pruebas / pass/fail; `npm run build`: pass/fail) y se marca `[x]` solo con las puertas en verde.

---

- [x] **T1. Tests de utilidades puras nuevas (en rojo).** RF-03, RF-07, RF-13, RF-21, RF-22, RF-23, RF-28, RF-36, RNF-01, RNF-06
  - Hecho cuando: `node --test test/validators.test.js test/inactividad.test.js test/formateadores.test.js test/mensajes.test.js` falla (tests en rojo) para `validarCredenciales`, `validarCliente`, `validarPrioridad`, `calcularMinutosInactividad`, `estaInactivo`, `formatearEstado`, `formatearPrioridad`, `construirError`.

- [x] **T2. Implementar utilidades puras nuevas.** RF-03, RF-07, RF-13, RF-21, RF-22, RF-23, RF-28, RF-36, RNF-01, RNF-06
  - Hecho cuando: `node --test test/validators.test.js test/inactividad.test.js test/formateadores.test.js test/mensajes.test.js` pasa en verde; las funciones son síncronas, deterministas con `hoy` inyectado, y devuelven los valores esperados (campos faltantes, booleano de inactividad, texto/color/tooltip, tres partes del error).
  - Archivos creados: `src/utils/validators.js`, `src/utils/inactividad.js`, `src/utils/formateadores.js`, `src/utils/mensajes.js`, `src/utils/traduccionBackend.js`. `test/traduccionBackend.test.js` se escribe dentro de T2 (primero rojo, luego verde) junto al código del archivo; T1 sigue cerrado ([x]) con sus 4 archivos.

- [x] **T3. Servicios de API, auth, contadores y casos.** RF-01, RF-02, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-24, RF-25, RF-27, RF-28, RF-29, RF-30, RF-32, RF-33, RF-34, RF-36, RF-42, RF-43, RF-44, **RF-45, RF-46, RF-47**
  - Hecho cuando: `src/services/api.js` es una instancia de axios (`axios.create` con `baseURL: 'http://localhost:3000'` y `timeout: 15000`) cuyo interceptor de petición envía `Authorization: Bearer <token>` leído de `sessionStorage` y cuyo interceptor de respuesta trata toda petición sin respuesta en 15 s (`ECONNABORTED`) o sin conexión como error de red de tres partes; cualquier `5xx` (hoy `500`, `503` tras la spec 004) se trata igual; `authService.login` guarda token/rol/usuario; `authService.getToken()` lee `sessionStorage`; `authService.logout()` hace `POST /auth/logout` con el token; lo consumen: (a) cierre voluntario confirmado (`RF-45`/`RF-46`; si falla `RF-47`, cierre local igual), y (b) reemplazo de sesión por otra cuenta (`RF-10`, best-effort, sin diálogo); caducidad por inactividad (`RF-07`) y cierre de pestaña (`RF-44`) NO llaman al backend; `getToken()` y validación de `exp` permiten la comprobación local sin petición; `counterService.listCounters()` consume `GET /contadores`; `counterService.getConteosPorEstado(id)` consume `GET /contadores/:id/conteos`; `getCasosPorContador(id)` consume `GET /contadores/:id/casos`; `getMisCasos()` consume `GET /casos/mis-casos`; `crearCaso` consume `POST /casos`; `actualizarCaso(id, {...})` consume `PATCH /casos/:id`; los errores del backend (`{ mensaje: "..." }`) se interpretan como mensajes de 3 partes para RNF-01; si no llega respuesta (red/error) se usa `construirError` de `mensajes.js`; `sessionStorage` es independiente por pestaña.
  - Archivos creados: `src/services/api.js`, `src/services/authService.js`, `src/services/counterService.js`, `src/services/caseService.js`.
  - Dependencia: `axios` (`^1.20.0`) ya está instalada en `package.json` (aprobada por el usuario, decisión 13 del plan); T3 no toca `package.json`, `quasar.config.js` ni crea `src/boot/axios.js`.
  - Puertas: `node --test` verde; sin `.vue`/layout → no requiere `npm run build`.

- [x] **T4. Stores de sesión, contadores y casos.** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-01, RF-02, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-27, RF-28, RF-29, RF-30, RF-32, RF-33, RF-42, RF-43, RF-44, **RF-45, RF-46, RF-47**
  - Hecho cuando: `session.js` guarda token/rol/usuario, exp, **`avisoSesion`** (aviso persistente de cierre `RF-46`/`RF-47`) y acciones para fijarlo/limpiarlo; al arrancar valida `exp` localmente y, si vigente, hace petición protegida según rol (recarga protegida con petición según rol y lectura protegida, 4.3, RF-42/44); `counters.js` guarda lista (`GET /contadores`) y mapa de conteos por `id` (las N peticiones paralelas `GET /contadores/:id/conteos`); `cases.js` guarda casos propios (`GET /casos/mis-casos`); `maqueta.js` ya no alimenta las pantallas; `index.js` registra los nuevos; `node --test` pasa.
  - Archivos creados: `src/stores/session.js`, `src/stores/counters.js`, `src/stores/cases.js`.
  - Archivos existentes tocados: `src/stores/index.js` (se agregan los nuevos stores).
  - Puertas: `node --test` verde; `npm run build` (toca registro, se recomienda verificar).

- [x] **T5. Pantalla P-1 Login, layout de login, router con guards y aviso persistente.** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-01, RF-03, RF-04, RF-05, RF-06, RF-08, RF-09, RF-10, RF-38, RNF-04, **RF-45, RF-46, RF-47**
  - Hecho cuando: P-1 muestra título distinto; login con campos vacíos señala faltantes; credenciales inválidas muestran mensaje genérico sin indicar cuál falló; login válido guarda token en `sessionStorage`; si había sesión viva previa se revoca con `authService.logout()` (reemplazo de cuenta activa por otra cuenta, best-effort, `RF-10`) antes de reemplazar; al abrir pantalla interna sin token → `/login` con aviso (`RF-05`); perfil incorrecto → acceso denegado (`RF-06`); perfil no se elige manualmente; P-1 usa `LoginLayout.vue`; arranque con token vigente valida con petición protegida según rol (recarga protegida con petición según rol y lectura protegida, `4.3`, `RF-42`/`RF-44`); **aviso persistente de cierre (`RF-46`/`RF-47`) se muestra en `LoginPage.vue` (`q-banner` u propio) y se limpia al escribir o enviar el formulario**.
  - Archivos existentes tocados:
    - `src/pages/LoginPage.vue`: se sustituye el login en memoria (datos de `exampleData.js` / `maqueta.js`) por `authService.login`; se cambia su layout a `LoginLayout.vue`.
    - `src/router/index.js`: se cambian los guards para usar `sessionStorage` y el backend en lugar de `maqueta.js`; se añade `LoginLayout.vue` para la ruta `/login`.
    - `src/router/accessState.js`: se mantiene `accessDenied` pero se alimenta del guard actualizado.
    - `src/utils/accessRules.js`: `resolveProfile` recibe las cuentas/rol desde `authService` en lugar de importarlas de `exampleData.js`.
    - `test/accessRules.test.js`: puede requerir ajuste si `resolveProfile` cambia su firma para recibir las cuentas como argumento; las pruebas de `validateLoginForm` y `normalizeCredential` se mantienen sin cambios.
  - Archivo nuevo: `src/layouts/LoginLayout.vue` (layout propio para P-1, sin menú interno).
  - Dudas resueltas: `src/pages/index.vue` y `src/pages/[...path].vue` no se tocan (redirección raíz sigue funcionando); `resolveProfile` recibe `(username, password, accounts)` como argumentos (líneas 42-52 de `accessRules.js`); `test/accessRules.test.js` no se rompe porque pasa `accounts` explícito en los tests; `LoginLayout.vue` es el layout de P-1.
  - Puertas: `node --test` verde; `npm run build` verde (`LoginPage.vue`, `router/index.js`).

- [x] **T6. Pantalla P-2 Dashboard (administrador).** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-11, RF-12, RF-13, RF-14, RF-15, RF-38, RF-39, RNF-02, RNF-03, RNF-05, RNF-08, RNF-09
  - Hecho cuando: P-2 obtiene primero `GET /contadores` y luego lanza en paralelo `GET /contadores/:id/conteos` para cada contador (N conteos paralelos en P-2 tras lista, contrato 2/4.7, RF-12, RF-36); si cualquiera falla → `ErrorState` con tres partes + reintentar (RF-36), sin mostrar conteos parciales; los conteos se muestran con ceros incluidos (RF-12); indicador de carga mientras se obtienen datos; mensaje de vacío (RF-14); control "Ver directorio" abre P-3 (RF-39); control de regreso (RF-38); responsivo y con tooltips (RNF-03); los datos del detalle se obtienen con `GET /contadores/:id/casos`.
  - Archivos existentes tocados:
    - `src/pages/AdminDashboardPage.vue`: se sustituyen datos en memoria por `counterService`.
    - `src/components/PriorityTag.vue`: se modifica para añadir `title` / tooltip de ayuda contextual (RNF-03) y confirmar contraste ≥ 4.5:1 (ya verificado en CSS); el texto y color se mantienen.
    - `src/components/CaseRow.vue`: se reusa para mostrar filas de caso.
    - `src/components/CounterCountsRow.vue`: se reusa para mostrar conteos.
    - `src/components/AccessDenied.vue`: se verifica que muestre el botón de vuelta al perfil.
    - `src/components/ErrorState.vue`: se verifica que tenga las tres partes y botón Reintentar.
    - `src/components/EmptyState.vue`: se reusa para mensajes de vacío.
    - `src/components/ScreenLoader.vue`: se reusa para indicador de carga.
    - `src/components/EssentialLink.vue`: se reusa para enlaces de navegación.
  - Dudas resueltas: `ErrorState.vue` ya cubre las tres partes (verificado: mensaje con `mensaje` + botón Reintentar); `EmptyState.vue` cubre el vacío con mensaje de qué falta. Ambos componentes existen en `src/components/` y se reutilizan sin cambios funcionales.
  - Puertas: `node --test` verde; `npm run build` verde (`AdminDashboardPage.vue`, componentes).

- [x] **T7. Pantalla P-3 Directorio + eliminación SimulationControls + cierre voluntario en MaquetaLayout.** ⚠️ **Modifica y elimina archivos existentes que ya funcionan.** RF-16, RF-17, RF-38, **RF-45, RF-46, RF-47**
  - Hecho cuando: P-3 muestra solo nombres de contadores; al elegir uno abre P-2 con ese contador seleccionado; control de regreso vuelve a P-3; `SimulationControls.vue` se elimina físicamente junto con sus importaciones en `MaquetaLayout.vue`; `MaquetaLayout.vue` **integra el control "Cerrar sesión" con `QDialog` (confirmar/cancelar, Escape, foco visible, retorno del foco al cancelar, área táctil ≥ 44×44 px, tooltip, `RF-45`)**; cancelar no cambia nada ni la pantalla ni los datos escritos (`RF-45`); confirmar activa revocación con `POST /auth/logout`, borra token, **fija `avisoSesion`** (texto según `RF-46` o `RF-47`), va a P-1 con aviso persistente (`RF-46`); si `POST /auth/logout` falla, cierre local igual con aviso persistente de 3 partes (`RF-47`, `RNF-01`); tras eliminar el componente, la constante y esas aserciones, `node --test` sigue en verde y no queda ninguna referencia a `SIMULATION` ni a `SimulationControls` en `src/` ni en `test/` (comprobable con búsqueda).
  - Archivos existentes tocados:
    - `src/pages/CountersDirectoryPage.vue`: se sustituyen datos en memoria por `counterService`.
    - `src/components/SimulationControls.vue`: **ELIMINA** el archivo y sus importaciones (en `src/layouts/MaquetaLayout.vue`).
    - `src/layouts/MaquetaLayout.vue`: se quita `SimulationControls.vue`; **se integra control "Cerrar sesión" + `QDialog` de confirmación (RF-45/46/47) con foco visible, Escape, retorno del foco, 44×44 px, tooltip (RNF-02/03/07).**
    - `src/utils/constants.js`: se elimina `SIMULATION` (controles de simulación eliminados).
    - `test/exampleData.test.js`: se quitan solo la importación de `SIMULATION` y las aserciones de `SIMULATION`; el resto del test no cambia.
  - Dudas resueltas: verificado en código: `SimulationControls.vue` solo se importa en `MaquetaLayout.vue`; ningún archivo en `test/` lo menciona, así que borrarlo no rompe tests. La constante `SIMULATION`, en cambio, sí se usa: `test/exampleData.test.js` la importa de `src/utils/constants.js` y afirma `SIMULATION.error` y `SIMULATION.expiry` (líneas 10, 46 y 47), y `SimulationControls.vue` también la importa. Por eso `SIMULATION` se quita aquí, en T7, junto con el componente y esas aserciones (en T5 no se toca `constants.js`, porque `SimulationControls.vue` todavía existe). El resto de `test/exampleData.test.js` sigue en verde sin cambios.
  - Puertas: `node --test` verde; `npm run build` verde (`MaquetaLayout.vue` + `QDialog`).

- [x] **T8. Pantallas P-4 Registro de caso y P-5 Mis casos (contador).** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33, RF-37, RF-40, RF-41
  - Hecho cuando: P-4 muestra formulario con cliente y prioridad, estado Pendiente y contador asignado no editables, tres prioridades con texto + color; validaciones (cliente obligatorio, prioridad obligatoria, máximo 80 caracteres) evitan el registro y muestran mensaje identificando el dato; registro válido confirma, vacía el formulario y ofrece "Ver mis casos"; P-5 muestra casos del contador con cliente/estado/prioridad, permite cambiar estado y prioridad en cualquier momento (incluido Finalizado) con confirmación visual, muestra mensaje de vacío con "Registrar caso" cuando no tiene casos, y control de regreso.
  - Archivos existentes tocados:
    - `src/pages/NewCasePage.vue`: se sustituye el registro en memoria por `caseService.crearCaso`.
    - `src/pages/MyCasesPage.vue`: se sustituyen datos en memoria por `caseService` (lectura y actualización de estado/prioridad).
    - `src/components/PriorityTag.vue`: se reusa para mostrar etiquetas de prioridad.
    - `src/components/CaseRow.vue`: se reusa para mostrar filas de caso.
    - `src/components/ErrorState.vue`: se reusa para errores de registro y actualización.
    - `src/components/EmptyState.vue`: se reusa para mensaje de vacío "No tiene casos registrados".
    - `src/layouts/MaquetaLayout.vue`: se verifica que el control de regreso funcione entre P-4 y P-5.
  - Puertas: `node --test` verde; `npm run build` verde (`NewCasePage.vue`, `MyCasesPage.vue`).

- [x] **T9. Estados de interfaz transversales, caducidad por inactividad y cierre voluntario.** ⚠️ **Modifica archivos existentes que ya funcionan.** RF-07, RF-34, RF-35, RF-36, RF-38, RF-43, RF-45, RF-46, RF-47, RNF-01, RNF-03, RNF-07
  - Hecho cuando: al abrir P-2/P-3/P-4/P-5 aparece `ScreenLoader`; errores de red/servidor muestran `ErrorState` con 3 partes + reintentar (RF-36); 30 min sin interacción → eliminar token y `AvisoSesionCaducada`; al recargar con token vigente → petición protegida según rol (recarga protegida con petición según rol y lectura protegida, 4.3, RF-42/44) y navegación a pantalla principal o `AvisoSesionCaducada` si 401/expirado; **verifica que el aviso persistente (`avisoSesion` en `session.js`) funciona en `LoginPage.vue` tras cierre (`RF-46`/`RF-47`) y se limpia con escribir/enviar; el diálogo del cierre (`RF-45`) está ya implementado en T7**; tooltips accesibles; recorrido solo teclado (RNF-02/RNF-03/RNF-07).
  - Archivo creado: `src/components/AvisoSesionCaducada.vue`.
  - Archivos existentes tocados:
    - `src/layouts/MaquetaLayout.vue`: se integra `AvisoSesionCaducada.vue` y el aviso de acceso denegado.
    - `src/utils/screenState.js`: se reusa para decidir carga/error/vacío/contenido (no se toca si ya funciona).
  - Puertas: `node --test` verde; `npm run build` verde (`MaquetaLayout.vue`, `LoginPage.vue` aviso, `AvisoSesionCaducada.vue`).

- [x] **T10. Recorridos end-to-end y pruebas finales (fusión de verificación).** RF-01 a **RF-47** (todos), RNF-01 a RNF-09 (todos), criterios de finalización 1-**31**
  - Hecho cuando: se verifican recorridos admin y contador con navegación real (no datos en memoria); recarga con token vigente → pantalla principal según rol (recarga protegida con petición según rol y lectura protegida, 4.3, RF-42/44) con petición protegida real; recarga con `exp` vencido o tras 401 → `AvisoSesionCaducada`; cierre pestaña limpia `sessionStorage`; abrir otra pestaña empieza sin sesión; reemplazo de cuenta válida revoca token anterior con `POST /auth/logout` (reemplazo de cuenta activa por otra cuenta, best-effort logout, RF-10); **cierre voluntario confirmado con diálogo, cancelar conserva datos, confirmado cierra con revocación y aviso persistente, backend caído cierra local con aviso de 3 partes (criterio 31)**; `node --test` pasa en verde; `MEMORY.md` actualizado; `npm run build` pasa si se tocan vistas. No hay commit/push.
  - Archivos existentes tocados: ninguno nuevo; solo verificación sobre la aplicación terminada.
  - Puertas: `node --test` verde (todos los tests); `npm run build` verde (todas las vistas); recorrido end-to-end de 31 criterios completado.

## Cobertura y división

- Las 10 tareas cubren la spec completa: RF-01 a RF-47, RNF-01 a RNF-09, y los 31 criterios de finalización verificados en T10.
- No hace falta dividir la spec en bloques: entran en 10 tareas.
- T9 y T10 se fusionaron en una sola tarea de verificación (T10) para mantener el máximo de 10 tras dividir T6 en dos (T6 y T7).
- Dependencias: T2 depende de T1; T3 depende de T2; T4 depende de T3; T5 depende de T2, T3 y T4; T6 depende de T3, T4 y T5; T7 depende de T3, T4, T5 y T6; T8 depende de T3, T4, T5, T6 y T7; T9 depende de T3, T4, T5, T6, T7 y T8; T10 depende de T1 a T9.

## Tests de la spec 001 afectados y cómo se mantienen en verde

| Test existente | Puede verse afectado por | Cómo se mantiene en verde |
|---|---|---|
| `test/accessRules.test.js` | Cambio en `src/utils/accessRules.js` (`resolveProfile` ahora recibe las cuentas desde `authService`, no de `exampleData.js`) | Las pruebas de `validateLoginForm`, `normalizeCredential` y detección de campos faltantes son puras y no cambian. `resolveProfile` se adapta para recibir las cuentas como argumento; la lógica pura se mantiene. |
| `test/caseRules.test.js` | Cambio en `src/utils/caseRules.js` | No se ven afectadas: son funciones puras que operan sobre arreglos en memoria; se siguen usando para validación local antes de enviar al backend. |
| `test/exampleData.test.js` | `src/services/exampleData.js` deja de ser la fuente de verdad; además, en `T7` se elimina `SIMULATION` de `src/utils/constants.js` | Se mantienen en verde como documentación de los datos semilla de la maqueta 001; ya no se importan en tiempo de ejecución de las pantallas. En `T7` se ajusta **solo** lo relativo a `SIMULATION`: se quitan la importación y las dos aserciones (`SIMULATION.error`, `SIMULATION.expiry`); el resto del test no cambia y sigue en verde. |
| `test/maquetaStore.test.js` | `src/stores/maqueta.js` ya no alimenta las pantallas | Se mantienen en verde; el store de maqueta se conserva pero ya no se usa en las vistas P-1 a P-5. |
| `test/screenState.test.js` | Ninguno | `src/utils/screenState.js` se reusa sin cambios funcionales. |
| `test/layout-drawer-check.js` | Ninguno | No se toca el drawer del layout. |
| `test/t9Pages.test.js` | Cambio en nombres de archivo de `src/pages/` | Se mantienen en verde si los nombres de archivo de `pages/` se conservan (`LoginPage.vue`, `AdminDashboardPage.vue`, etc.). |
| **Ningún test de `test/`** | `SimulationControls.vue` | Verificado con grep: ningún archivo en `test/` menciona `SimulationControls`; la única referencia está en `src/layouts/MaquetaLayout.vue` (importación y uso). Al eliminar el archivo y su importación no hay tests de unidad que fallen por el componente. Distinto es la constante `SIMULATION` de `constants.js`, que sí se afirma en `test/exampleData.test.js`: se quita en `T7` junto con su importación y sus dos aserciones (ver fila anterior), sin tocar el resto del test. |

## Decisiones ya tomadas / pendiente de confirmación final

1. **Recuento de tareas**: quedan exactamente 10 tareas (`T1` a `T10`); no se divide la spec. **Confirmación final pendiente del usuario.**
2. **Layout de login**: `src/layouts/LoginLayout.vue` como NUEVO (`T5`); `MaquetaLayout.vue` no se usa para P-1. **Confirmación final pendiente del usuario.**
3. **`SimulationControls.vue`**: eliminación aprobada (`T7`); no hay referencias en tests (`T7`). **Confirmación final pendiente del usuario.**
4. **Cierre de sesión voluntario (`T5`/`T7`)**: diálogo de confirmación con `QDialog` (`confirmar`/`cancelar`, `Escape`, foco visible, 44×44 px, tooltip, `RF-45`); cancelar conserva datos escritos; confirmar revoca (`RF-46`); si `POST /auth/logout` falla (`RF-47`) → cierre local igual + aviso persistente de 3 partes (`RNF-01`). **Confirmación final pendiente del usuario.**
5. **Logout best-effort** (`RF-10`): reemplazo de cuenta activa por otra cuenta usa `POST /auth/logout`; si falla no bloquea. Caducidad (`RF-07`) y cierre pestaña (`RF-44`) NO llaman al backend. **Confirmación final pendiente del usuario.**
6. **Aviso persistente en P-1** (`RF-46`/`RF-47`, `T4`/`T5`): `session.js` con campo `avisoSesion`; `LoginPage.vue` muestra aviso persistente (`q-banner`/propio) que se limpia con escribir/enviar el formulario; no reutiliza `AvisoSesionCaducada.vue` porque el texto es distinto (`"Sesión cerrada"` vs `"Sesión caducada"`). **Confirmación final pendiente del usuario.**
7. **Validación del token al recargar (`4.3`, `T4`, `T9`)**: lectura protegida con petición según rol (`RF-42`/`RF-44`); `NO borrar token` al reintentar si es error de red (`4.3`, `RF-36`). **Confirmación final pendiente del usuario.**
8. **N peticiones paralelas en P-2**: `GET /contadores` seguido de `Promise.all` de `GET /contadores/:id/conteos` (`RF-12`, `RF-36`); `T6`. **Confirmación final pendiente del usuario.**
9. **`src/pages/index.vue` y `src/pages/[...path].vue`**: no se tocan (`T5`, `T8`, `T9`). **Confirmación final pendiente del usuario.**
10. **`ErrorState.vue` y `EmptyState.vue`**: reutilizados (`T6`, `T8`, `T9`). **Confirmación final pendiente del usuario.**