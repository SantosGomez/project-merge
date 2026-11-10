# MEMORY.md — DelGrow Estado Contadores

Memoria entre sesiones (máx. ~50 líneas). El detalle de cada cambio está en su commit.

## Estado actual

- Ramas: `main` = Docker/producción; `revision-ui` = revisión de UI completa (rebanadas 0–9), aún sin unir a `main`. **La memoria de `main` (migración de auditorías y bases, 2026-11-09) está en `git stash` «main: MEMORY.md sin commit…»: reponerla al volver a `main`.**
- Docker: sesión persistente + SSE (latido 25 s), PWA para contadores, túnel cloudflared (URL cambia en cada reinicio: `docker compose logs tunnel`). Tras cada reinicio hay que agregar la URL nueva a `CORS_ORIGENES` del `.env` y `docker compose up -d backend`; si no, el login por el túnel da 403 y la app dice «No se pudo conectar con el servidor». `.wslconfig` limita WSL a 4 GB (2026-11-10).
- **Frontend en Docker = `revision-ui` ac0aa10 (2026-11-10), no `main`.** La imagen anterior traía `baseURL` «C:/Program Files/Git/api» (compilada desde Git Bash) y el login no salía del navegador. Construir imágenes siempre desde PowerShell. `main` ya compila tras la rebanada 7: se corrigieron `session`/`class` duplicados, `watch`/`contadorId` sin uso y el prop `contadorId` pasó a `contadorDuenioId`.
- Auxiliares (rebanadas 1–8 en `main`): tabla `contador_auxiliar`; rutas `/contadores/:id/auxiliares…` (solo el dueño); el dueño recibe aviso por SSE al editar o crear. El store del frontend usa el servicio real y carga `disponibles`.
- **Casos en equipo (decisión del usuario, 2026-11-10):** el dueño ve los casos de su auxiliar y los edita completos; el auxiliar ve los del dueño y solo cambia el estado; el admin ve en el detalle de un contador solo sus casos. El backend manda `solo_estado` en `mis-casos` y `checkCaseOwnership` deja `req.soloEstado`; la UI no decide el permiso. Pruebas: `Backend/test/misCasosEnEquipo.test.js`.
- Campana (2026-11-10): `destinoDeAviso` (`utils/avisos.js`) lleva al contador a «Mis casos» con `?casoId=`; `ubicarCaso` (`filtrosCasos.js`) ajusta filtro y página; la fila se resalta 4 s y se quita `casoId` de la URL. Solo los contadores reciben avisos. El foco del teclado vuelve a la campana al cerrar el menú (no a la fila).
- «Registrar caso para» (2026-11-10): la acción `listarContadoresQueMeTienenComoAuxiliar` nunca existió en el store (desde la rebanada 6 el selector no cargaba); ya está y devuelve `{ ok, contadores }`. Tras registrar para otro contador, `alRegistrar` hace `refrescarEnSilencio()`. Probado en navegador con XAMPP.
- Pendiente menor sin aprobar: el error de carga de disponibles no se ve en `ContadorAuxiliaresPage`.
- Nada de lo del 2026-11-10 (equipo, campana, «Registrar caso para») tiene commit ni está publicado.
- Desde 2026-11-09 se trabaja en la base de producción (Docker, puerto 3307); la de XAMPP (3306) es de pruebas. Antes de cambiar datos: confirmar la base y sacar respaldo (`mariadb-dump --single-transaction --routines --triggers --events`). Los respaldos `.sql` tienen hashes: nunca versionarlos.
- Casos: el vencimiento lo captura el contador (≥ inicio). Auditorías: tablas `auditorias`, `auditoria_dtl`, `aud_conta`, `fases_aud`, `auditoria_mensajes`; semáforo y plazos se calculan (`utils/seguimientoAuditoria.js`), no se guardan.
- Chat por auditoría (en `main`): SSE `mensaje-auditoria`; avisos solo a los contadores asignados. `session.id` es texto: comparar con `Number(session.id)`.

## Revisión de UI (rama `revision-ui`, 2026-11-05 → 2026-11-09)

- Proceso por rebanada: evaluaciones A (critique + audit) y B (clarify + harden + tabla emil) en paralelo → informe → el usuario elige → TDD → navegador → commit. Pruebas en `test/revision*.test.js`.
- Commits: 1 Acceso (0f851d6…28b4b49), 2 Estructura (77683a0, eb0778f, 89381f6), 3 Mis casos (10016f9, 545dcc7), 4 Mi resumen (844c437), 5 Dashboard admin (361644c), 6 Auditorías (213bb79, e47ba73), 7 Ficha y bitácora (0be290d), 8 Directorio (32a99c9), 9 Conjunto (este).
- Decisiones del usuario: el admin no ve «Vencido»/«Vence pronto» en su detalle; las carreras entre recargas del dashboard admin no se arreglaron (poco probables); se descartó cambiar el estilo de etiquetas del inicio de sesión.
- Rebanada 9: backend en tú (76 textos de `buildError`, sin tocar la parte «sobre …»), servicios del frontend en tú, «Reintentar» en el chat, `.control-touch` global en `app.scss` (las de 48 px del acceso se quedan), `boton-presionable` en acceso/avisos/estados, confirmaciones con `dialogo-entra/sale`, colores de la paleta en campana/filtros/layout/bitácora, menú de la campana en 180 ms.
- Opcional sin hacer: borrar `pages/index/(index).vue` y `second.vue` (plantilla de Quasar sin ruta), `formatearEstado` sin uso, token de sombra en la paleta.

## Patrones acordados (proponer moverlos a AGENTS.md)

- Colores solo de `$dg-colores`; nada de `grey-N`/`white`/hexadecimales sueltos. Un color nuevo va a la paleta y a `paletaColores.test.js`.
- Textos en tú; mensajes de error en tres partes; la parte «sobre X» de `buildError` no se cambia (el frontend la usa en `campoConError`; el alta busca «ya existe»).
- Formularios en diálogo: `hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?»; `erroresCampo` + `enfocarPrimerError`; `label for` + `for`; asterisco `aria-hidden`.
- Diálogos con `dialogo-entra`/`dialogo-sale` (220 ms); selectores y calendarios `jump-down` 180 ms sin `cover`; `.boton-presionable`; `$curva-salida`; `.sr-only`; `.control-touch` (44 px, global).
- Mostrar con `etiquetaSemaforo` («En atención») y `etiquetaEstado` («En proceso»); los valores guardados no cambian.
- Pantallas con plazos recargan en silencio en `visibilitychange`; un fallo al releer no se presenta como fallo del guardado.

## Pendientes

- Boceto de auditorías: Importancia, aviso al Socio Director, días inhábiles SAT, RFC/Unidad/Socio/Multa (no existen en las tablas: proponer esquema antes).
- Preguntas abiertas: nombre de la PWA, logo PNG más liviano, ¿avisos de la campana con enlace?, ¿otro dato en el pie del menú?
- Pruebas del backend: correr todo junto se queda colgado (algún archivo deja conexiones abiertas); por archivo pasan. `authRoutes` «correo en mayúsculas» falla a veces; `verificarPruebas.js` da FALLA por `MINIMOS` desactualizados.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&`/`||`. En Git Bash `API_URL=/api` → `MSYS_NO_PATHCONV=1`.
- Varios `.vue` usan CRLF: editar con Edit o con un script que normalice; `sed` con `\n` falla en bloques de varias líneas. Heredocs y `sed` pierden `\\`: usar `String.raw` o Edit.
- Verificar en navegador con `backend-experimento-3011` + `frontend-experimento-9012` (`launch.json`) y usuarios `zz_test_*` en XAMPP, borrándolos al final. El panel mide ~395 px: la vista de escritorio (≥1024) no se ve ahí.
- El fondo de `q-dialog` responde a `mousedown`, no a `click`. `TransitionGroup` aplica `move-class` aunque `:css` sea false. Un estilo scoped no alcanza los menús de Quasar (se montan en el `body`) ni los botones de un hijo.
- Una prueba que pasa sin el cambio no prueba nada: exigir el comportamiento, no solo que exista una palabra.
- MySQL de XAMPP: si una tabla da «doesn't exist in engine», no borrar tablas sueltas.

---
Nada sensible en esta memoria.
