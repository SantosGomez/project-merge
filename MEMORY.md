# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Metodología: rebanadas verticales con skill `tdd` (rojo-verde-refactor, código mínimo); verificar con `node --test` en `Backend` y en `Seguimiento-proyectos`.
- **Casos y fechas, rebanadas 1-7: TERMINADAS (2026-10-26).**
  - 1-4 (`6147b07`): fecha de inicio y vencimiento por días hábiles, descripción/observaciones opcionales al registrar, serializador `casoConFechasLocales`, `CaseModel.updatePatch` en un solo UPDATE, `checkCaseOwnership` valida el id con `parseCounterId` y deja `req.caso`.
  - 5 (`0267146`): `helmet`, sin `x-powered-by`, límite de 10 intentos fallidos de login por IP cada 15 min, `obtenerSecretoJwt` sin secreto fijo.
  - 6 (`36f9bed`): `MyCasesPage.vue` con una sola `guardarCambio(id, cambios)`; el aviso «Cambio guardado.» se borra al empezar otro cambio (decisión del usuario: sin temporizador).
  - 7: salidas `build-*/dev-*/lint-*.txt`, `test-*-output.txt` y `echo` fuera del repo (`git rm --cached` + `.gitignore` del frontend; siguen en disco). Reglas permanentes movidas a `AGENTS.md`.
- Pruebas: backend 213 pass, frontend 401 pass. `verificarPruebas.js` falla por `userModel.test.js` (5 de 9 mínimas), preexistente desde `bb05516`.
- Directorio de usuarios: rebanadas 1-5 subidas; correcciones de la revisión en `ef35980` (sin push). Sin aplicar: CSS y `MENSAJES` duplicados en los diálogos, recarga con loader tras el alta, contraseña en memoria tras cerrar, tablas `PANTALLA_PRINCIPAL*` paralelas, pruebas estáticas de los diálogos, tooltip «directorio de contadores» en `AdminDashboardPage.vue`.
- Git: commits sin push en `main`. Push solo si el usuario lo pide.

## Pendiente

- Pregunta al usuario: ¿mostrar «Inicio»/«Vence» (y descripción) en cada fila de «Mis casos»? (NO implementado).
- `userModel.test.js` por debajo de su mínimo en `verificarPruebas.js`.
- Editar descripción/observaciones de un caso existente no está soportado (RF-22 solo estado/prioridad); sería una rebanada nueva con validación.

## Backend (lo esencial)

- Errores con tres partes en español (`buildError`); `asyncHandler` + handler global (400/503); `jti` propio por token.
- `parseCounterId` acepta solo dígitos (MariaDB convierte `'2abc'` en `2`); se usa también para ids de caso.
- MariaDB con mysql2 (pool); seed idempotente; MariaDB no está en modo estricto (los máximos se validan en el controlador).
- `node --test` corre en paralelo: filtrar por datos propios (`zz_test_*`), nunca contar tablas enteras; cerrar servidor y pool en `after`.
- Cuentas demo (`admin_seed`, `contador_seed`) solo con `SEED_CUENTAS_DEMO=true`.

## Decisiones (y por qué)

- Contrato de fechas y reglas de edición de casos: ver `AGENTS.md` (trampas conocidas).
- Rate limit de login apagable (`crearApp({ limitarLogin: false })`) para no romper los inicios de sesión de las pruebas; los logins exitosos no cuentan.
- Sin secreto JWT por defecto: uno conocido permite falsificar tokens.
- Textos y comentarios en español.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&` ni `||`; usar `npm.cmd`.
- `verificarPruebas.js` tiene `MINIMOS` por archivo: actualizar la tabla al añadir archivos de prueba nuevos.
- `npm run lint:check` llama a prettier sin `--check` (preexistente); varios archivos ya tenían avisos de formato.
- Una prueba que pasa sin el cambio no prueba nada: fijar la fecha exacta esperada (p. ej. `^2027-01-21`), no solo el año.
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación.

Nada sensible en esta memoria.
