# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Metodología: rebanadas verticales con skill `tdd` (rojo-verde-refactor, código mínimo). TDD por rebanada: pruebas primero (rojo), luego implementación (verde), verificar con `node --test`.
- **Rebanada 1 (fechas/DoS): TERMINADA y verde.** `Backend/src/utils/dateUtils.js` (`parseFechaDDMMYYYY`, `parseFechaInicio`, `formatearFechaISO`, `calcularFechaVencimiento` con tope 400 vueltas); `CaseController.createCase` valida `fecha_inicio` y calcula vencimiento; `CaseModel.create` guarda solo-fecha. Frontend `fechasCaso.js` (`fechaADominioBackend`) y `caseService` convierte DD-MM-AAAA → AAAA-MM-DD y lanza `errorDeFechaInvalida`. Pruebas: `dateUtils.test.js` 11, `caseRoutes.test.js` 11 (incluye fechas sin desplazar), `fechasCaso.test.js`, `caseService.test.js` +3, `validators.test.js` +2.
- **Rebanada 2 (descripción/observaciones): TERMINADA y verde.** Backend: `validarTextoOpcional(valor, campo, maximo)` en `validationUtils.js` (ausente/tipo_invalido/demasiado_largo/valido); `CaseController.createCase` valida descripción (1000) y observaciones (2000) con errores de 3 partes y guarda `null` si vacía; `CaseModel.create` las inserta; `seed.js` añade `descripcion TEXT NULL` y `observaciones TEXT NULL` al `CREATE TABLE` y a `migrarCasos`. Frontend: `validarTextoOpcional` en `validators.js`; `CaseFormDialog.vue` usa `type="textarea"` en ambos campos, `<p>` de error para observaciones, valida antes de `crearCaso`. Pruebas: `validationUtils.test.js` 25, `caseRoutes.test.js` 15 (4 nuevas), `validators.test.js` 27 (+4), `caseService.test.js` (+2).
- **Rebanada 3 (serializador `casoConFechasLocales` en dateUtils): TERMINADA.**
- **Rebanada 4 (updateCase): TERMINADA y verde (2026-10-26).** `CaseModel.updatePatch(id, { estado, prioridad, fecha_vencimiento })` = un solo UPDATE (atómico); se borró `updateVencimiento`. `updateCase` usa `req.caso`, recalcula con `calcularFechaVencimiento` solo si la prioridad cambia y no toca `fecha_inicio`; ya no pasa descripción/observaciones sin validar (RF-22 solo edita estado/prioridad). `checkCaseOwnership` valida el id con `parseCounterId` (404 si no es solo dígitos) y deja `req.caso`. Las 2 pruebas rojas eran por el código (parámetros SQL desordenados), no por las expectativas.
- **Rebanada 6 (limpieza de «Mis casos»): TERMINADA y verde, sin commit.** `MyCasesPage.vue`: `changeStatus`/`changePriority` → una sola `guardarCambio(id, cambios)`, que borra el aviso «Cambio guardado.» al empezar (decisión del usuario: sin temporizador); `retry` repite `guardarCambio` con el último cambio. Pruebas estáticas en `t9Pages.test.js` (+3). Verificado en el navegador con `contador_seed`.
- **Rebanada 5 (endurecimiento): TERMINADA, commit `0267146`.** `helmet` + `app.disable('x-powered-by')`; `express-rate-limit` en `/auth/login`: 10 intentos fallidos por IP cada 15 min (los exitosos no cuentan), 429 con `buildError`. `crearApp({ limitarLogin })` (por defecto `true`); `soporte-pruebas/http.js` arranca con `limitarLogin: false`. `config/jwt.js`: `obtenerSecretoJwt(env)` sin secreto fijo (producción sin `JWT_SECRET` no arranca; desarrollo usa uno aleatorio). Pruebas en `test/seguridadApp.test.js` (7, registrado en `MINIMOS`). Verificado: el frontend en :9000 sigue leyendo la API con helmet.
- Backend `node --test`: 213 pass, 0 fail. Frontend: 401 pass, 0 fail. `verificarPruebas.js` falla por `userModel.test.js` (5 de 9 mínimas), preexistente desde el commit `bb05516`.
- Directorio de usuarios (rebanadas 1-5 subidas): tras `/code-review` (2026-10-26) se corrigió, sin commit aún: el diálogo de restablecer ya no revalida el correo guardado (solo la contraseña; el backend valida el correo), `q-dialog` con `aria-labelledby` y sin `role` en la tarjeta (Quasar ya lo pone), y el menú del admin dice «directorio de usuarios». Sin aplicar: CSS y `MENSAJES` duplicados en los diálogos, recarga con loader tras el alta, contraseña en memoria tras cerrar, tablas `PANTALLA_PRINCIPAL*` paralelas, pruebas estáticas de los diálogos. Detalle y tooltip «directorio de contadores» pendiente en `AdminDashboardPage.vue`.
- Git: rebanadas 1-4 en `6147b07`, rebanada 5 en `0267146` (sin push). Push solo si el usuario lo pide.

## Pendiente

- Slice 7: documentación (`AGENTS.md`/`MEMORY.md`), `build-*.txt`/`dev-*.txt`/`lint-*.txt`/`test-t10-output.txt`/`echo` → `git rm --cached` + `.gitignore`.
- Pregunta pendiente al usuario: ¿mostrar «Inicio»/«Vence» (y descripción) en cada fila de «Mis casos»? (NO implementado).

## Backend (lo esencial)

- Fechas `YYYY-MM-DD HH:mm:ss` en hora local (`conFechasLocales`); columna DATE guarda `YYYY-MM-DD`.
- Errores con tres partes en español (`buildError`); `asyncHandler` + handler global (400/503); `jti` propio por token.
- `parseCounterId` acepta solo dígitos (MariaDB convierte `'2abc'` en `2`).
- MariaDB con mysql2 (pool); seed idempotente; MariaDB no está en modo estricto (los máximos se validan en el controlador).
- `node --test` corre en paralelo: filtrar por datos propios (`zz_test_*`), nunca contar tablas enteras; cerrar servidor y pool en `after`.

## Decisiones (y por qué)

- Contrato de fechas: formulario `DD-MM-AAAA`, API/columna DATE `AAAA-MM-DD`, DATETIME local `YYYY-MM-DD HH:mm:ss`. `new Date('AAAA-MM-DD')` lee como UTC y desplaza un día en zonas negativas → nunca usarlo con fecha sin hora.
- Rate limit de login configurable para no romper los 38 inicios de sesión de las pruebas.
- Textos y comentarios en español.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&` ni `||`; usar `npm.cmd`. Sin `&&` entre comandos.
- `verificarPruebas.js` tiene `MINIMOS` por archivo: actualizar la tabla al añadir archivos de prueba nuevos.
- `npm run lint:check` llama a prettier sin `--check` (preexistente, no falla por formato).
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación.

Nada sensible en esta memoria.
