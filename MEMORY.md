# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Todo lo de abajo ya está en commits (último: `d0502ec`, 2026-11-02).

## Estado actual

- Publicado en Docker: sesión persistente + SSE («Mantener sesión» 7 días, latido 25s), PWA para contadores, túnel `tunnel` (cloudflared Quick Tunnel → `frontend:80`; la URL cambia en cada reinicio, ver `docker compose logs tunnel`; URL fija = túnel con token + dominio).
- 16 contadores (depurados 2026-10-29 según «Usuarios Sistemas.xlsx»), en la base y en `cuentas.local.json`.
- Casos: el vencimiento lo captura el contador (≥ inicio); `q-date` con máscara DD-MM-YYYY.
- Auditorías (módulo independiente de casos): tablas `auditorias`, `auditoria_dtl` (bitácora), `aud_conta`, `fases_aud`; API `/auditorias` + `/auditorias/:id/eventos`; semáforo, fase actual y próximo plazo se calculan (`utils/seguimientoAuditoria.js`), no se guardan. Ficha `/auditorias/:id` imprimible; tabla en escritorio (≥1024), FAB en móvil.
- Dashboard admin: pestañas Casos | Auditorías (`?tab=`, `?vista=`); tablero con indicadores, gráficas, Kanban imprimible (hoja horizontal). Tarjetas y dona de casos filtran la lista de contadores.
- «Mi resumen» del contador (`contador/dashboard`): calculado en el frontend sobre `/casos/mis-casos`; tarjetas y dona abren `contador/casos?filtro=…`; «Próximos a vencer» (hoy a +3) con `esCasoProximoAVencer`; alertas de auditoría; agenda «Lo que vence pronto» que edita con `CaseFormDialog`.
- «Mi resumen» (2026-11-02, sin commit): tarjeta «Sin movimiento» = abiertos con `actualizado_en` de hace ≥7 días (`esCasoSinMovimiento`, `DIAS_SIN_MOVIMIENTO` en filtrosCasos.js; `?filtro=sinMovimiento` + interruptor en «Mis casos»). Agenda con botón «Empezar» (Pendiente→En proceso) / «Finalizar» (En proceso→Finalizado) vía `accionRapidaEstado` y `cases.actualizarCaso`; `@click.stop` para no abrir «Editar». Verificado en navegador (escritorio y móvil). Con más de 4 tarjetas, `ResumenEquipo` pone `--muchas`: ≤1279 px la dona baja a su fila y de 601 a 840 px van 3 columnas (el admin, con 3 tarjetas, no cambia).
- Casos Finalizados en verde (`CasoItem.vue`): en «Mis casos» (2026-11-02) y, desde 2026-11-05, también en el detalle del dashboard del admin, donde se pinta de verde la etiqueta fija del estado; el selector de prioridad del admin (`caso-item__prioridad`) se queda neutro. Test: `test/casoItemFinalizado.test.js`.
- La barra móvil ya no tiene «Volver» (quitado a propósito en 5d288e4, 2026-10-27). Las pruebas `layout-movil.test.js` y `layout-drawer-check.js` se actualizaron el 2026-11-05 para reflejarlo. Los `volverA` de `router/index.js` quedaron sin uso.
- SSE: `auditoria-actualizada` al admin y a los contadores asignados; `caso-actualizado` solo al admin.
- Colores del semáforo centralizados en `.semaforo--<clase>` (`app.scss`) y `utils/semaforoAuditoria.js`.
- Rediseño UI de inputs y selects (completado, 2026-11-05): Rebanadas 0 a 6 listas (`app.scss`, `CaseFormDialog.vue`, `CasoItem.vue`, `MyCasesPage.vue`, `AdminDashboardPage.vue`, `AuditoriasPage.vue`, `AuditoriaFormDialog.vue`, `BitacoraAuditoria.vue`, `CountersDirectoryPage.vue`, `NewUserDialog.vue`, `ResetPasswordDialog.vue`, `LoginPage.vue`, `CambiarContrasenaPage.vue`). Selectores compactos en línea (`caso-item__estado`, `paginacion__por-pagina`) preservan su ancho en móvil.

## Chat por auditoría (en `main` desde 2026-11-05, aprobado por el contador jefe)

- Hilo por auditoría (admin + contadores asignados, mismos permisos que la bitácora): tabla `auditoria_mensajes` (en `seed.js`, se crea sola al arrancar), `MensajeAuditoriaModel`/`MensajeAuditoriaController`, `GET`/`POST /auditorias/:id/mensajes` (máx. 1000). Panel `components/ChatAuditoria.vue` (`q-dialog` a la derecha, `q-chat-message`, Enter envía), botón «Mensajes» en `AuditoriaItem` y la ficha (FAB en celular). Tiempo real por SSE `mensaje-auditoria` `{ auditoriaId, cliente, mensaje }`.
- Avisos: solo a los contadores asignados (nunca a quien escribe ni al admin): notificación en la campana + emergente con «Ver mensajes» → ficha `?chat=1` (`utils/avisosChat.js`, `MaquetaLayout.vue`). Sin emergente si ese chat está abierto.
- `session.id` es texto: comparar con `Number(session.id)`. Ideas pendientes: no leídos, botón en `AuditoriasTabla`, editar/borrar, adjuntos.

## Revisión de UI con skills (rama `revision-ui`, desde `main`, 2026-11-05)

- Ramas: `main` = Docker/producción; `experimento` = chat por auditoría (unido a `main` el 2026-11-05, commit 70b311f; `main` se trajo a `revision-ui` el 2026-11-09); `revision-ui` = revisión de todo el frontend con las skills `impeccable` y `emil-design-eng`.
- Rebanada 0 lista: `PRODUCT.md` (entrevista: contadores en escritorio en oficina; éxito = que no se venzan plazos y ver la carga del equipo; WCAG AA) y `DESIGN.md` (modo scan; North Star «El expediente ordenado», componentes modernos y suaves, sombras suaves en azul marino ≤12 %). Encabezados en inglés porque la herramienta los lee por nombre. Sin sidecar `.impeccable/design.json` (solo sirve al panel «live»).
- Herramienta: `sh .agents/skills/impeccable/scripts/impeccable context` (binario en `~/.impeccable/bin`); tras editar UI, `impeccable detect --json <archivos>`.
- **Rebanada 1 (Acceso) completa** (commits 0f851d6, ea66e08, 28b4b49; test `test/revisionAcceso.test.js`): 404 con ruta comodín; AccessDenied con la sesión real; 429 → `DEMASIADOS_INTENTOS`; textos de acceso en tú (`utils/mensajesInicioSesion.js`); tooltips (dg-texto, 13/14 px) y `$positive`/`$negative` de la paleta en toda la app; ojo de 44 px; `prefers-reduced-motion` global en `app.scss`; fuentes Matter y Monument en el repo (Avant Garde, `icons` y `backgrounds` del usuario quedan sin commit, no se usan). Los `side-tab` de los avisos de estado del login son falsos positivos. Sin decidir: nombre de la PWA en el manifiesto y logo PNG de 1600×600.
- Error de prueba a evitar: un heredoc perdió las `\\` de un `new RegExp` y la prueba comparaba `undefined === undefined`. Usar `String.raw` y exigir que el valor exista.
- Rebanada 2 (Estructura): critique 26/40, audit 12/20. Escape **sí** cierra el menú móvil (B se equivocó; verificado), pero el foco no entra al menú. **Grupo A hecho** (sin commit; test `test/revisionEstructura.test.js`): `body` con fondo `dg-superficie` y `color-scheme: light` (`app.scss` + meta en `index.html`); `api.js` traduce la ruta a un dato entendible (`DATO_POR_RUTA`: «tus casos», «las auditorías»…) y los «qué hacer» van en tú (`QUE_HACER` en `utils/mensajes.js`, también en `stores/cases.js` y `counters.js`); `ErrorState` separa las tres partes con `separarMensajeError`; menú dentro de `<nav aria-label="Navegación principal">`, `aria-current` con `paginaActual()` y botón «Saltar al contenido» → `#contenido-principal`. Commit 77683a0. **Grupo B hecho** (sin commit): el cursor despliega el menú compacto tras 150 ms (`alEntrarCursor`/`alSalirCursor`) y con teclado sin animación (clase `menu-lateral--al-instante`: Quasar pone las clases en `.q-drawer__content`, la transición está en el `aside`, por eso `.q-drawer:has(> …)`); diálogo de cierre con `fade` 150 ms, nombre en el `q-dialog` y `autofocus` en «Cancelar»; menú móvil con `aria-expanded`/`aria-controls`, foco a la primera opción al abrir y de vuelta al botón al cerrar, Escape con el foco dentro (`cerrarMenuMovil`; Quasar no lo hace); logo con `tabindex=-1` en celular; títulos h2 de estados y diálogo en 600/1.3; «Ir al dashboard admin». Aprendizaje: dos ediciones separadas (plantilla y función) dejaron a Vite sirviendo una versión intermedia rota; reiniciar el dev server. Pendiente grupo C (textos, colores sueltos, side-tab de ErrorState, dos h1, fecha de la campana). Mensajes del backend y de formularios siguen en usted (otras rebanadas).
- Plan: 1 Acceso, 2 Estructura y estados compartidos, 3 «Mis casos», 4 «Mi resumen», 5 Dashboard admin, 6 Auditorías lista/registro, 7 Ficha y bitácora, 8 Directorio de usuarios, 9 Revisión de conjunto. Cada rebanada: informe (critique + audit + clarify + harden + tabla emil) → el usuario elige → TDD → navegador → commit.

## Pendientes

- Boceto de auditorías: campo Importancia, aviso al Socio Director, días inhábiles SAT, campos RFC/Unidad/Socio/Multa (no existen en las tablas: proponer cambio de esquema antes).
- `authRoutes` «correo en mayúsculas» falla a veces (carrera entre archivos de prueba).
- `verificarPruebas.js` da FALLA porque `auditoria*`, `eventosRoutes` e `importarCuentas` no están en `MINIMOS` y `userModel` tiene 5 de 9 (ya pasaba antes del chat).

## Backend (lo esencial)

- Errores `buildError` (3 partes ES), `asyncHandler`, handler global, `jti` por token.
- `parseCounterId` solo dígitos; se usa también para ids de caso.
- MariaDB/mysql2 (pool), seed idempotente, sin modo estricto (validaciones en controlador).
- `node --test` en paralelo con BD local real: datos `zz_test_*`, cerrar servidor/pool en `after`.
- Cuentas demo solo con `SEED_CUENTAS_DEMO=true`.

## Decisiones (y por qué)

- Contrato de fechas y edición de casos: ver `AGENTS.md`.
- Rate limit de login apagable en pruebas; sin `JWT_SECRET` en producción el servidor no arranca.
- El usuario descartó por ahora: encabezado de ficha en dos columnas, pruebas del servicio de eventos.
- **Patrón de diseño para `q-select` moderno (2026-11-04):** los selectores nativos de Quasar (`dense outlined`) se ven demasiado simples y planos. Para darles acabado visual profesional tipo Uiverse/SaaS ejecutivo alineado con la identidad DCA:
  1. **Props estándar:** `dense outlined options-dense dropdown-icon="expand_more" popup-content-class="menu-seleccion-custom" transition-show="jump-down" transition-hide="jump-up"` y clase `selector-moderno`.
  2. **Slot `#prepend`:** icono semántico del selector (`calendar_month`, `tune`, `description`, etc.) para anclar visualmente su función.
  3. **Slot `#selected-item="scope"`:** texto con peso medio (`text-weight-medium text-primary`), sentence case (`text-capitalize` si es fecha) y dot semáforo (`punto-estado-sm`) si representa un estado o prioridad. Usar siempre `scope.opt?.label ?? scope.opt` para tolerar valores escalares o reactivos.
  4. **Slot `#option="{ itemProps, opt, selected }"`:** `<q-item v-bind="itemProps" :class="['item-opcion-custom', { 'opcion-seleccionada': selected }]">`, con `<q-item-section avatar class="item-seccion-icono">` para icono o dot semáforo (`punto-estado`), etiqueta de texto y check (`check`) o badge contextual (`badge-mes-actual`) en el lado derecho.
  5. **Estilos flotantes en `app.scss`:** `.menu-seleccion-custom` (tarjeta flotante con `border-radius: 12px`, padding 6px, sombra suave de profundidad y hover `#f1f5f9`), `.punto-estado` (10px) y `.punto-estado-sm` (8px) viven en `app.scss` porque Quasar monta el menú en el `body`.
  6. **Estilos de caja en el componente (`.selector-moderno`):** esquinas redondeadas (`border-radius: 10px`), borde sutil `#dcdfe4`, sombra tenue de apoyo, hover con elevación suave, foco con anillo `box-shadow: 0 0 0 3px rgba(17, 30, 48, 0.12)`, chevron con transición fluida de rotación y ancho 100% responsivo bajo 600px.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&`/`||`; usar `npm.cmd`. En Git Bash `API_URL=/api` → `MSYS_NO_PATHCONV=1`.
- `verificarPruebas.js` tiene `MINIMOS` por archivo: actualizar al añadir tests.
- Prettier: no formatear archivos completos que ya estaban sin formato en HEAD.
- Una prueba que pasa sin el cambio no prueba nada. Las pruebas de opencode solo buscaban texto: verificar lo que digan otros agentes en BD real y navegador.
- Verificar en navegador: CORS solo desde `:9000`; usar contador `zz_test_*` y borrarlo; emular `colorScheme: light`. El Vite de otra sesión puede quedarse con un módulo a media edición: `touch` y recargar.
- MySQL de XAMPP: si una tabla da «doesn't exist in engine», reinstalar limpia la carpeta `data`; no borrar tablas sueltas.
- `git --work-tree=<otra carpeta> checkout` contamina el índice → `rm .git/index && git reset`.
- Imprimir: `@page` con nombre en `body:has(...)`; `emulateMedia('screen')` también afecta a `page.pdf`.

---
Nada sensible en esta memoria.
