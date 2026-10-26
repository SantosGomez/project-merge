# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Metodología: rebanadas verticales con skill `tdd` (rojo-verde-refactor, código mínimo); verificar con `node --test` en `Backend` y en `Seguimiento-proyectos`.
- **Casos y fechas, rebanadas 1-7: TERMINADAS (2026-10-26).**
  - 1-4 (`6147b07`): fecha de inicio y vencimiento por días hábiles, descripción/observaciones opcionales al registrar, serializador `casoConFechasLocales`, `CaseModel.updatePatch` en un solo UPDATE, `checkCaseOwnership` valida el id con `parseCounterId` y deja `req.caso`.
  - 5 (`0267146`): `helmet`, sin `x-powered-by`, límite de 10 intentos fallidos de login por IP cada 15 min, `obtenerSecretoJwt` sin secreto fijo.
  - 6 (`36f9bed`): `MyCasesPage.vue` con una sola `guardarCambio(id, cambios)`. (El aviso fijo «Cambio guardado.» se cambió después por `$q.notify`.)
  - 7 (`11979d5`): salidas `build-*/dev-*/lint-*.txt`, `test-*-output.txt` y `echo` fuera del repo (`git rm --cached` + `.gitignore` del frontend; siguen en disco). Reglas permanentes movidas a `AGENTS.md`.
- **Formulario de caso en 2 columnas: TERMINADO y verde, sin commit (2026-10-26).** `CaseFormDialog.vue` mide `min(860px, 100vw - 32px)` (`max-width: none !important` quita el tope de 560 px de Quasar); desde 700 px es una cuadrícula: Cliente | Prioridad, Fecha de inicio | Estado, Descripción | Observaciones, y el bloque informativo a lo ancho. En móvil, una columna. Al registrar, el estado se muestra fijo («Pendiente») en la fila 2.
- **Migración de fechas: TERMINADA, commit `97bb8cc`.** `migrarCasos()` corre siempre al arrancar: sin inicio → día de `creado_en`; sin vencimiento → `calcularFechaVencimiento` desde el inicio; casos completos intactos; idempotente. Solo pone `NOT NULL` si las columnas aceptan vacío y no queda ninguna vacía (MariaDB sin modo estricto convertiría NULL en 0000-00-00). Base local migrada como aprobó el usuario (Cliente Test 2 recalculado a 03-11-2026). 3 pruebas en `seed.test.js`.
- **Editar caso: TERMINADA, commit `025a9a5`.** Decisiones del usuario: reutilizar `CaseFormDialog.vue` (prop `caso`), mantener los selectores rápidos, el cliente SÍ se edita, el admin ve Inicio/Vence/descripción sin botón. Backend: `updateCase` acepta cliente, estado, prioridad, fecha_inicio, descripción y observaciones; valida todo antes de guardar; vacío → null en textos; fecha vacía → 400; sin campos editables → 400 «Nada que actualizar»; recalcula vencimiento si cambia prioridad o fecha. `createCase` y `updateCase` comparten `MENSAJES_ENTRADA_CASO`/`validarTextoDelCaso`. `updatePatch` con `COLUMNAS_EDITABLES`. Frontend: `cambiosDelCaso` (caseRules) envía solo lo cambiado; `fechaParaFormulario` (fechasCaso); `casoAFila` con `startDate`/`dueDate`/`description`; botón «Editar» en la fila. Verificado en el navegador (escritorio y 375 px).
- Pruebas: backend 234 pass, frontend 454 pass. `verificarPruebas.js` falla por `userModel.test.js` (5 de 9 mínimas), preexistente desde `bb05516`.
- Directorio de usuarios: rebanadas 1-5 subidas; correcciones de la revisión en `ef35980` (sin push). Sin aplicar: CSS y `MENSAJES` duplicados en los diálogos, recarga con loader tras el alta, contraseña en memoria tras cerrar, tablas `PANTALLA_PRINCIPAL*` paralelas, pruebas estáticas de los diálogos, tooltip «directorio de contadores» en `AdminDashboardPage.vue`.
- Git: commits sin push en `main`. Push solo si el usuario lo pide.

## Pendiente

- «Cliente Test 1» (id 10) está asignado a `admin_seed`, un administrador: dato raro, revisar con el usuario.
- `userModel.test.js` por debajo de su mínimo en `verificarPruebas.js`.
- **Importante / En proceso: TERMINADO, commit `0d61d47` (sin push).** El usuario agregó a mano `Importante` (sin default) y `en_proceso_at TIMESTAMP ON UPDATE` (cambiaba con cualquier edición). `migrarImportanteYEnProceso()` (seed.js) las deja `importante TINYINT(1) NOT NULL DEFAULT 0` y `en_proceso_en DATETIME NULL` (también en el CREATE TABLE); al renombrar, los casos «En proceso» tomaron su `actualizado_en`, el resto NULL (respaldo previo en el scratchpad de la sesión). `updatePatch` pone `en_proceso_en = COALESCE(en_proceso_en, ahora)` solo la primera vez que pasa a «En proceso». API: `importante` opcional, solo booleano (si no, 400); el serializador lo entrega como booleano. Frontend: interruptor «Caso importante» en `CaseFormDialog`. Backend 232; verificado en navegador.
- **Mis casos rediseñada: TERMINADO, commit `0d61d47` (sin push).** Decisiones del usuario: filtros solo de estado (chips Abiertos/Pendiente/En proceso/Finalizado/Todos) + «Solo importantes» + «Solo vencidos» (sin búsqueda ni prioridad); al entrar, Abiertos ordenados por vencimiento más cercano; 10 por página con selector 10/20/50 (`QPagination`); `QIntersection` solo para la entrada con desvanecido; en la fila solo estrella, estado y «Editar» (la prioridad se cambia en Editar). Lógica pura en `utils/filtrosCasos.js` (`filtrarCasos`, `esCasoVencido`, `paginar`, `hoyLocal`, 9 pruebas). Componentes nuevos `CasoItem.vue` (QItem) y `FiltrosCasos.vue`; `CaseRow.vue` volvió a su versión del commit y solo lo usa el admin (no ve importante). Se adaptaron 2 pruebas estáticas de `t9Pages.test.js` a la fila nueva. Frontend 450. Ojo: con el panel del navegador oculto, QIntersection no pinta las filas (capturas en blanco).
- **Dashboard del admin reorganizado: TERMINADO, sin commit (2026-10-26).** Decisión del usuario: la lista de contadores y el detalle muestran **solo casos importantes** (las tarjetas KPI y la dona siguen con todo el equipo). API: `GET /contadores/:id/conteos` y `/:id/casos` aceptan `?importantes=true` (sin él, igual que antes); `counterService` recibe `{ soloImportantes }` y el store `counters` siempre lo envía. Búsqueda de contador al escribir (`filtrarContadores`, sin mayúsculas ni acentos; fija arriba al desplazar). En `CounterCountsRow` los conteos son botones (`filtrar`): seleccionan al contador y filtran por ese estado; tocar otra vez el activo quita el filtro; sincronizados con los chips del detalle (Todos/Pendiente/En proceso/Finalizado, `FiltrosCasos` con `estados` y `:con-interruptores="false"`). Detalle con `CasoItem solo-lectura` (sin estrella, selector, Editar, «Importante», «Vencido» ni «En proceso desde»: el usuario dijo «no por ahora») y `QPagination` de 10. `CaseRow.vue` borrado. En celular baja al detalle después de cargar (el `smooth` no corre en el panel emulado). Backend 234.
- **Avisos con `$q.notify`: TERMINADO, sin commit (2026-10-26).** El usuario cambió el aviso fijo de `MyCasesPage.vue` y `CountersDirectoryPage.vue` por notificaciones de Quasar (éxito `positive`, error `negative` en Mis casos). Se habilitó `plugins: ['Notify']` en `quasar.config.js` (sin él, `$q.notify` falla al guardar) y hay una prueba que lo exige; las pruebas viejas del aviso se adaptaron. El error de ESLint de `alRestablecer` ya lo había corregido el usuario. Verificado en navegador.
- Renombrar «Finalizado» a «Completado» (pedido original) y resaltar casos vencidos: no hechos.
- Rediseño del dashboard (definido con el usuario 2026-10-26): 3 tarjetas KPI de todo el equipo, solo informativas con tooltip (Vencidos = vencimiento antes de hoy y no finalizado; Abiertos = Pendiente + En proceso con desglose; Prioridad Alta abierta) + dona «Casos por estado», sin librería (SVG/Quasar); lista y detalle se conservan debajo. **Rebanada 1 hecha (commit 676da9c, sin push):** `GET /contadores/resumen` (solo admin) → `{ equipo, por_contador }` de una consulta (`CaseModel.resumenPorContador(hoy)`, LEFT JOIN de contadores con ceros; solo rol contador). Se eligió devolver `por_contador` para probar exacto con la base compartida en paralelo (el total es la suma de las filas) y para sustituir más adelante las 1 + N peticiones de conteos. Frontend: `getResumenEquipo` (counterService), `tarjetasResumen` (filasVista), `components/ResumenEquipo.vue`; la página lo carga aparte de la lista (su error no la oculta). Backend 225, frontend 430; verificado en navegador con datos `zz_test_` (ya borrados). **Rebanada 2 hecha (commit f044ad8, sin push):** `components/DonaEstados.vue` (SVG con `pathLength="100"`, total al centro, leyenda con número y %, `role="img"` con resumen en texto, «Sin casos registrados» si el total es 0) dentro de `ResumenEquipo.vue`, junto a las tarjetas (debajo en celular); geometría en `segmentosDona` (filasVista, porcentajes por mayor residuo para que sumen 100); colores `COLOR_ESTADO` ámbar #b45309 / azul #1f5f99 / verde #2f855a. Frontend 437; verificado en navegador. Ojo: Vite cargó la versión vieja del componente hasta recargar la página.

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
