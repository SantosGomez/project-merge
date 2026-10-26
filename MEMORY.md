# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Metodología: rebanadas verticales con skill `tdd` (rojo-verde-refactor, código mínimo); verificar con `node --test` en `Backend` y en `Seguimiento-proyectos`.
- **Casos y fechas, rebanadas 1-7: TERMINADAS (2026-10-26).**
  - 1-4 (`6147b07`): fecha de inicio y vencimiento por días hábiles, descripción/observaciones opcionales al registrar, serializador `casoConFechasLocales`, `CaseModel.updatePatch` en un solo UPDATE, `checkCaseOwnership` valida el id con `parseCounterId` y deja `req.caso`.
  - 5 (`0267146`): `helmet`, sin `x-powered-by`, límite de 10 intentos fallidos de login por IP cada 15 min, `obtenerSecretoJwt` sin secreto fijo.
  - 6 (`36f9bed`): `MyCasesPage.vue` con una sola `guardarCambio(id, cambios)`; el aviso «Cambio guardado.» se borra al empezar otro cambio (decisión del usuario: sin temporizador).
  - 7 (`11979d5`): salidas `build-*/dev-*/lint-*.txt`, `test-*-output.txt` y `echo` fuera del repo (`git rm --cached` + `.gitignore` del frontend; siguen en disco). Reglas permanentes movidas a `AGENTS.md`.
- **Formulario de caso en 2 columnas: TERMINADO y verde, sin commit (2026-10-26).** `CaseFormDialog.vue` mide `min(860px, 100vw - 32px)` (`max-width: none !important` quita el tope de 560 px de Quasar); desde 700 px es una cuadrícula: Cliente | Prioridad, Fecha de inicio | Estado, Descripción | Observaciones, y el bloque informativo a lo ancho. En móvil, una columna. Al registrar, el estado se muestra fijo («Pendiente») en la fila 2.
- **Migración de fechas: TERMINADA, commit `97bb8cc`.** `migrarCasos()` corre siempre al arrancar: sin inicio → día de `creado_en`; sin vencimiento → `calcularFechaVencimiento` desde el inicio; casos completos intactos; idempotente. Solo pone `NOT NULL` si las columnas aceptan vacío y no queda ninguna vacía (MariaDB sin modo estricto convertiría NULL en 0000-00-00). Base local migrada como aprobó el usuario (Cliente Test 2 recalculado a 03-11-2026). 3 pruebas en `seed.test.js`.
- **Editar caso: TERMINADA, commit `025a9a5`.** Decisiones del usuario: reutilizar `CaseFormDialog.vue` (prop `caso`), mantener los selectores rápidos, el cliente SÍ se edita, el admin ve Inicio/Vence/descripción sin botón. Backend: `updateCase` acepta cliente, estado, prioridad, fecha_inicio, descripción y observaciones; valida todo antes de guardar; vacío → null en textos; fecha vacía → 400; sin campos editables → 400 «Nada que actualizar»; recalcula vencimiento si cambia prioridad o fecha. `createCase` y `updateCase` comparten `MENSAJES_ENTRADA_CASO`/`validarTextoDelCaso`. `updatePatch` con `COLUMNAS_EDITABLES`. Frontend: `cambiosDelCaso` (caseRules) envía solo lo cambiado; `fechaParaFormulario` (fechasCaso); `casoAFila` con `startDate`/`dueDate`/`description`; botón «Editar» en la fila. Verificado en el navegador (escritorio y 375 px).
- Pruebas: backend 223 pass, frontend 422 pass. `verificarPruebas.js` falla por `userModel.test.js` (5 de 9 mínimas), preexistente desde `bb05516`.
- Directorio de usuarios: rebanadas 1-5 subidas; correcciones de la revisión en `ef35980` (sin push). Sin aplicar: CSS y `MENSAJES` duplicados en los diálogos, recarga con loader tras el alta, contraseña en memoria tras cerrar, tablas `PANTALLA_PRINCIPAL*` paralelas, pruebas estáticas de los diálogos, tooltip «directorio de contadores» en `AdminDashboardPage.vue`.
- Git: commits sin push en `main`. Push solo si el usuario lo pide.

## Pendiente

- «Cliente Test 1» (id 10) está asignado a `admin_seed`, un administrador: dato raro, revisar con el usuario.
- `userModel.test.js` por debajo de su mínimo en `verificarPruebas.js`.
- Renombrar «Finalizado» a «Completado» (pedido original) y resaltar casos vencidos: no hechos.

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
- No dar por terminada una rebanada por lo que diga otro agente: comprobarlo en la base real (la rebanada 3 decía «terminada» y la migración no rellenaba nada).
- Las pruebas del backend usan la base local real: correrlas ya ejecuta `seedDatabase` y sus migraciones sobre los datos de verdad.
- Una prueba que pasa sin el cambio no prueba nada: fijar la fecha exacta esperada (p. ej. `^2027-01-21`), no solo el año.
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación.

Nada sensible en esta memoria.
