# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Metodología (desde 2026-10-23): rebanadas verticales con la skill `tdd`** (rojo-verde-refactor, código mínimo, sin sobreingeniería). Se eliminó el SDD: skill `sdd`, comandos `sdd-*`, `coordinator`, `planner` y la carpeta `specs/` (siguen en el historial de git, antes del commit que los borra). Constitución sin «La spec manda» (principios renumerados 1-4).
- Hecho hasta ahora (antes en specs 001-004): frontend funcional conectado al backend y backend con autenticación, casos, robustez, fechas locales, login exacto y restablecimiento de contraseña. Backend `node --test` 162 pruebas (verificador `162 de 159` OK); frontend 277; `npm run build` en verde.
- Historias #1-#4 (menú lateral): #1-#4 verificadas en navegador por el usuario (#4: Cerrar Sesión en el pie con `session.autenticado`, fila con `session.usuario`, icono alineado, sin botón en la barra). 289 pruebas, `lint:check` y `build` en verde.
- Flujo: `/backlog` → `/story` → `/pair` (con `tdd`) → `/code-review` hecho por un modelo distinto del que condujo. D-16 hace backlog y story; B-127 conduce `/pair` en lo normal y D-16 en lo delicado.
- Backlog aprobado (2026-10-23): 9 historias de UI/UX del layout con identidad DelGrow (drawer oscuro completo, secciones por rol —administrador y contador; `usuarios_de_sistema` tendrá «Usuarios» en la #9—, usuario y logout al pie, sin barra superior en escritorio, barra delgada en celular, modo mini con despliegue al pasar el cursor, fijar con clic en el logo). Las historias están en `docs/backlog.md`. Siguiente: `/story` de la #5.
- Pendiente aparte: pantallas de alta de usuarios y restablecer contraseña (el backend ya existe). Push solo cuando el usuario lo pida.

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
