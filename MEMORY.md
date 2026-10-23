# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 004 (correcciones del backend): completada y fusionada en `main` (2026-10-23, sin push).** T1-T32 [x]; validación SDD final del revisor independiente: APROBADO. Backend: `node --test` desde `Backend/` 162 pruebas en 22 archivos, verificador `162 de 159` OK. Única línea de `src/` del Bloque 4: el 400 de tipo inválido del login nombra el dato (`tipoInvalido.join(' y ')`).
- **Spec 003 (frontend funcional): implementada y validada** — T1-T10 [x], `Estado: implementada`, reviewer APROBADO (RF-01 a RF-47, RNF-01 a RNF-09, 31 criterios). `npm run build` en verde.
- **Spec 002 (backend): implementada con salvedades**; sus pendientes se resolvieron en la 004.
- Siguiente: reiniciar el servidor del puerto 3000 con el backend fusionado y comprobar el frontend contra él. Push solo cuando el usuario lo pida.

## Lo que trae la 004 al backend

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
- Se trabaja con las reglas de la skill `ponytail` (cambio mínimo completo); `AGENTS.md` manda sobre ella.

## Excepciones aprobadas en la 003

- Aserciones ajustadas en `t9Pages.test.js` y `layout-drawer-check.js`; `counters.js` y `cases.js` con guardia de versión; `SIMULATION` eliminado; `CaseRow`, `CounterCountsRow`, `ErrorState`, `PriorityTag` adaptados.

## Aprendizajes y errores a evitar

- En Express 4 todo middleware o controlador `async` que consulte la BD va con `asyncHandler`.
- Un archivo "pass" no basta: usar `node soporte-pruebas/verificarPruebas.js`; en rojo cuenta también el `describe` que falla.
- Contrastar los veredictos del reviewer con la spec (hubo un «APROBADO» con requisitos pendientes).
- Para simular fallos de BD hay que sustituir `pool.query`, no `db.query`.
- `node --test` corre los archivos en paralelo: los asertos de «no se creó nada» filtran por datos propios, nunca cuentan tablas enteras.
- Cerrar servidor y pool en `after` o `node --test` se cuelga; MariaDB en marcha (3306, XAMPP); una ejecución interrumpida deja `zz_test_*` huérfanos.
- MariaDB local no está en modo estricto (trunca sin error): los máximos se validan en el controlador.
- Con `String.replace` en Node, pasar el reemplazo como función («$`» duplicó `tasks.md`). Con `sed` global, revisar que no toque líneas históricas.
- PowerShell no soporta `&&` ni `||`; usar `npm.cmd` en vez de `npm.ps1`.
- El MCP del navegador se puede perder: mantener servidores hasta el final de la verificación; liberar puertos 9000/3000 al terminar.

## Puntos NO verificados en T10 de la 003 (justificados)

- Cierre de pestaña, recarga con token vigente, caducidad en carga lenta, estados vacíos y listas largas, respuesta tardía tras cierre y recorrido solo con teclado: cubiertos por pruebas unitarias o verificados estáticamente.

Nada sensible en esta memoria.
