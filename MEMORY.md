# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 003 (frontend funcional): implementada y validada — T1-T10 [x] en `specs/003-frontend-funcional/tasks.md` y `Estado: implementada` en la spec.** `node --test`: 277 pruebas (solo frontend, desde `Seguimiento-proyectos/`) y 396 (277 frontend + 119 backend, desde la raíz del repo), 0 fail. `npm run build` en verde. T10 verificó 31 criterios en navegador real (Chrome DevTools) con frontend (9000) y backend (3000) en marcha; MaríaDB arriba.
- **Reviewer: APROBADO** (RF-01 a RF-47, RNF-01 a RNF-09 y los 31 criterios). No queda nada pendiente en la 003; cambios de la 003 commiteados y empujados a `main`.
- **Spec 002 (backend): implementada con salvedades** — T1-T29 [x]; 119 pruebas; verificador OK. Pendientes pasaron a la 004.
- **Spec 004 (correcciones backend):** en curso en worktree `.claude/worktrees/spec-004` (rama `worktree-spec-004`), solo toca `Backend/` y `specs/004`; T1-T3 hechas, sin merge a `main`.

## Lo que se hizo en la 003 (resumen)

- Servicios axios (api/auth/counter/case) con timeout 15 s e interceptores; stores session/counters/cases; P-1 a P-5 con carga/vacío/error/acceso denegado/caducidad; tooltips; responsive; cierre voluntario con diálogo (RF-45/46/47); eliminación de `SimulationControls.vue` y `SIMULATION`. Caducidad 30 min medida en cliente; token en sessionStorage; recarga valida con petición protegida según rol.

## Decisiones (y por qué)

- Token en sessionStorage (sobrevive a recarga, se limpia al cerrar pestaña; independiente por pestaña). Caducidad medida en cliente, 30 min, cada petición válida reinicia.
- Mensajes de error con tres partes (RNF-01); `construirError` solo si no llega respuesta.
- axios `^1.20.0` (instancia en `src/services/api.js`, timeout 15 s, sin boot).
- `validators.js` usa claves `username`/`password` (coinciden con P-1).
- Prioridad de P-4 se traduce con `prioridadABackend` antes de `validarPrioridad`.
- `traduccionBackend.js`: `…DeBackend` = backend→interno; `…ABackend` = interno→backend.
- `session.js` nuevo store de sesión.

## Excepciones aprobadas (T1-T10)

- `test/t9Pages.test.js`: aserción `maqueta.registerCase(` → `cases.crearCaso(` (T8). `test/layout-drawer-check.js`: aserción `ref(true)` → `ref(false)` (T9, arreglo del menú lateral).
- `counters.js` y `cases.js` modificados en T9 (guardia de versión contra respuestas tardías), aunque tasks.md no los listaba.
- `constants.js` perdió `SIMULATION` en T7 junto con su componente y las aserciones de `exampleData.test.js`.
- `CaseRow.vue`, `CounterCountsRow.vue`, `ErrorState.vue`, `PriorityTag.vue` adaptados en T6/T9 (tooltips, foco, texto de error).

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&` ni `||`: usar comandos separados; `npm.cmd` en vez de `npm.ps1` (bloqueado).
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación.
- `node --test`: desde `Seguimiento-proyectos/` son 277 pruebas (solo frontend); desde la raíz del repo son 396 (277 frontend + 119 backend).
- Base `delgrow_contadores`: partida 2 usuarios y 2 casos; limpiar `zz_test_*` al final (script con `pool.end()`). Cerrar backend/frontend y liberar puertos 9000/3000 al terminar.

## Dependencias

- Spec 004: el login no distingue mayúsculas hasta T12-T13 de la 004 (colación `utf8mb4_general_ci`); el frontend envía credenciales tal cual y trata cualquier 401 como inválida.

## Puntos NO verificados en T10 (justificados)

- Cierre de pestaña, otra pestaña sin sesión, recarga con token vigente, caducidad durante carga lenta y formulario P-4 a medio llenar: cubiertos por unit tests/`sessionStorage`/store; no observados.
- Estados vacíos de P-5/detalle sin casos, nombres largos y listas largas con scroll: sin datos en el seed; cubierto por tests de store/`exampleData`/componentes.
- Respuesta tardía tras cierre y reemplazo de sesión (RF-10) y recorrido completo solo con teclado: cubierto por tests de store / verificado estáticamente.

Nada sensible en esta memoria. Los cambios de la 003 quedaron en `main` con commit y push.
