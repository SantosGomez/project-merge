# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Metodología (desde 2026-10-23): rebanadas verticales con la skill `tdd`** (rojo-verde-refactor, código mínimo, sin sobreingeniería). Se eliminó el SDD: skill `sdd`, comandos `sdd-*`, `coordinator`, `planner` y la carpeta `specs/` (siguen en el historial de git, antes del commit que los borra). Constitución sin «La spec manda» (principios renumerados 1-4).
- Hecho hasta ahora (antes en specs 001-004): frontend funcional conectado al backend y backend con autenticación, casos, robustez, fechas locales, login exacto y restablecimiento de contraseña. Backend `node --test` 162 pruebas (verificador `162 de 159` OK); frontend 277; `npm run build` en verde.
- Historias #1-#4 (menú lateral): #1-#4 verificadas en navegador por el usuario (#4: Cerrar Sesión en el pie con `session.autenticado`, fila con `session.usuario`, icono alineado, sin botón en la barra). 289 pruebas, `lint:check` y `build` en verde.
- Historia #5 (sin barra en escritorio): barra con `v-if="$q.screen.lt.md"` y encabezado con `gt.sm` dentro de `q-page-container`; reutiliza `pageTitle` y «Volver». Tras `/code-review`: drawer con `:breakpoint="1023"` (QDrawer es móvil con ancho <= breakpoint; con 1024 quedaba sin barra ni menú a 1024 px) y `q-page-container.contenedor-paginas` en columna de 100vh con `min-height: 0 !important` en la q-page (QPage no descuenta el encabezado y sobraba scroll). 297 pruebas y `lint:check` en verde; verificado en navegador a 1366/1024/1023/768/375 px (commit 4932957, sin push). Después se quitó el código muerto del botón de menú (`lt-lg` y media query ≥1024 px). El usuario decidió no aplicar por ahora: «Volver» y CSS de barra/encabezado duplicados, encabezado fijo al hacer scroll y doble relleno superior.
- Flujo: `/backlog` → `/story` → `/pair` (con `tdd`) → `/code-review` hecho por un modelo distinto del que condujo. D-16 hace backlog y story; B-127 conduce `/pair` en lo normal y D-16 en lo delicado.
- Backlog de UI (2026-10-23, `docs/backlog.md`): historias #1-#8 y 9a hechas, verificadas en navegador y subidas (push hasta 287993c). Detalle en los commits. Hallazgos menores de revisión sin aplicar: tooltip del título móvil siempre visible, doble toque en tablets con el menú compacto, parpadeo al compactar, pruebas de layout que leen cadenas del `.vue` en vez de conducta.
- Claves de diseño que no se ven a simple vista: drawer `:breakpoint="1023"` (con 1024 no había barra ni menú a 1024 px); `contenedor-paginas` con `min-height: 0 !important` en la q-page; `menuCompacto = !menuFijado && !cursorEnMenu && !focoEnMenu` y el foco solo cuenta si es `:focus-visible` (QDialog devuelve el foco al cerrar); el alta y el login recortan usuario/correo y contraseña igual. El vigilante de Vite a veces no detecta ediciones rápidas: `touch` al archivo.
- Login por correo (2026-10-23): rebanadas 1-3 hechas, verificadas en navegador y subidas (c246e9b, a959b32, 40e4298). Decidido con el usuario: roles del Excel → SuperAdmin=administrador, Sistemas=usuarios_de_sistema, Contador y Pract_Contador=contador; la pestaña Administración no se importa; contraseña temporal «PrimerNombre1234»; nombre como en el Excel sin títulos; columnas en español; migración que conserva datos (`migrarUsuarios()` en `seed.js`, respaldo `usuarios_respaldo_20261023`); retirar `usuario` por pasos.
- Cómo quedó: login con `{ correo, password }` (sin distinguir mayúsculas/espacios) que guarda `ultimo_acceso_en` y devuelve nombre y correo; menú con `session.nombreVisible`; alta `POST /usuarios` con `{ nombre, correo, password, rol }` (≤150, `esCorreoValido`, correo único → 400 «El correo ya existe»); `importarCuentas.js` importó 35 cuentas reales a la base local. Mientras exista, `usuario` guarda el mismo correo (VARCHAR(150)); cuentas viejas tienen `usuario@prueba.local`. Ojo: `session.js` arma `authServicePorDefecto` con lista fija de funciones (sumar ahí las nuevas). Backend 172 y frontend 342 pruebas.
- **Para la siguiente sesión (pendientes):**
  - **Rebanada 4 — restablecer contraseña por correo (= historia 9b):** hoy es `PATCH /usuarios/:usuario/restablecer-contrasena` (`resetPassword` en `UserController.js`, busca con `findByUsername`; pruebas en `test/userRoutes.test.js` con el apoyo `restablecer(nombre, …)` y `estadoDelLogin` que usa `correoDeTransicion`). Cambiarlo a correo (ruta o cuerpo, decidir con el usuario) y hacer la pantalla «Restablecer contraseña» en la sección «Usuarios» del usuario de sistema (no hay endpoint para listar cuentas: se escribe el correo exacto). La 9b no está en `docs/backlog.md`: hacer `/story` primero.
  - **Rebanada 5 — borrar la columna `usuario`:** cuando nada la use. Hoy la usan: el token JWT y `req.user` (`usuario`), la lista de contadores (`findCountersPublic`/`findCounterById` devuelven `usuario`; el frontend la muestra en `utils/filasVista.js` y `AdminDashboardPage.vue`; pasar a `nombre`), `findByUsername`/`usuarioExisteIgnoreCase`/`create`/`correoDeTransicion`, la semilla (`admin_seed`, `contador_seed`), `soporte-pruebas/bd.js` (limpia por `usuario`) y la respuesta del login. Después: `ALTER TABLE usuarios DROP COLUMN usuario` en la migración y quitar `delgrow_usuario` del frontend.
  - Antes de cerrar: `/code-review` de las rebanadas 1-3 por otro modelo (B-127 u Orion Pax); las condujo D-16.
- El Excel de cuentas reales está en `backend/` y está ignorado (`*.xlsx`, `*.local.json`, igual que `backend/cuentas.local.json`): nunca subir datos personales ni ponerlos en esta memoria.
- Push solo cuando el usuario lo pida.

## Backend (lo esencial)

- Robustez: `validarCampoTexto`, `asyncHandler` + handler global (400 entrada inválida / 503 fallo interno), errores de BD propagados → 503, `jti` propio por token.
- Fechas `YYYY-MM-DD HH:mm:ss` en hora local (`conFechasLocales`); login y nombres de usuario exactos (distinguen mayúsculas); duplicados por capitalización rechazados.
- `PATCH /usuarios/:usuario/restablecer-contrasena` (revoca todas las sesiones; riesgo aceptado: si falla la revocación responde 503 y el reintento lo completa); `requireContador` antes de `checkCaseOwnership`; máximo de 100 en el alta.
- Impacto en el frontend: el login ya no normaliza mayúsculas en el servidor; las fechas llegan como texto local, no ISO UTC.

## Decisiones (y por qué)

- Frontend: token en sessionStorage (sobrevive a recarga, independiente por pestaña); caducidad 30 min medida en cliente; axios `^1.20.0` (instancia en `src/services/api.js`, timeout 15 s); `traduccionBackend.js`: `…DeBackend` = backend→interno, `…ABackend` = interno→backend.
- Mensajes de error con tres partes en español (RNF-01 del frontend; RF-23, RNF-5, RNF-6 del backend).
- Tests con `node --test`, sin paquetes extra; datos `zz_test_*` que cada archivo borra al terminar; apoyos en `Backend/soporte-pruebas/`.
- MariaDB con mysql2 (pool); seed idempotente. La tabla `sesiones` tiene `jti` como clave primaria.
- `parseCounterId` acepta solo dígitos (MariaDB convierte `'2abc'` en `2`).
- Menú lateral (#1): 250 px, `bg-primary`, etiquetas blancas, iconos y barra activa con `var(--q-secondary)`, descripciones #c9cfd8; activo con velo blanco 10% (`active-class="q-item--nav-activo"`), hover lo aporta Quasar. Logo 64 px con ruta relativa `logos/...` (web y Electron `file://`), el PNG trae 25% de margen transparente; `:deep(.menu-lateral)` en columna para que la lista haga su scroll.
- Se trabaja con las reglas de la skill `ponytail` (cambio mínimo completo); `AGENTS.md` manda sobre ella.
- Agentes: opencode = «Orion Pax», Claude Code = «D-16», DeepSeek v4.1 Flash = «B-127». `implementer` y `reviewer` (en `.claude/agents/` y `.opencode/agents/`) trabajan por rebanadas con TDD.

## Aprendizajes y errores a evitar

- En Express 4 todo middleware o controlador `async` que consulte la BD va con `asyncHandler`.
- Un archivo "pass" no basta: usar `node soporte-pruebas/verificarPruebas.js`; en rojo cuenta también el `describe` que falla.
- Contrastar los veredictos del reviewer con lo pedido (hubo un «APROBADO» con requisitos pendientes).
- Para simular fallos de BD hay que sustituir `pool.query`, no `db.query`.
- `node --test` corre los archivos en paralelo: los asertos de «no se creó nada» filtran por datos propios, nunca cuentan tablas enteras.
- Cerrar servidor y pool en `after` o `node --test` se cuelga; MariaDB en marcha (3306, XAMPP); una ejecución interrumpida deja `zz_test_*` huérfanos.
- MariaDB local no está en modo estricto (trunca sin error): los máximos se validan en el controlador.
- Con `String.replace` en Node, pasar el reemplazo como función («$`» duplicó `tasks.md`). Con `sed` global, revisar que no toque líneas históricas.
- PowerShell no soporta `&&` ni `||`; usar `npm.cmd` en vez de `npm.ps1`.
- `npm run lint:check` no falla por formato: llama a prettier sin `--check` (preexistente).
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación; liberar puertos 9000/3000 al terminar.

## Puntos del frontend no verificados en navegador

- Cierre de pestaña, recarga con token vigente, caducidad en carga lenta, estados vacíos y listas largas, respuesta tardía tras cierre y recorrido solo con teclado: cubiertos por pruebas unitarias o verificados estáticamente.

Nada sensible en esta memoria.
