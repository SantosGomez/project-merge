# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): implementada con salvedades** — Cambios 1 y 2 aprobados por el reviewer: T1-T29 todas `[x]`; `node --test` 119 pruebas, 119 pass, 0 fail en 20 archivos; verificador `RESULTADO: OK` (cifras validadas por el reviewer y comprobadas por el coordinador). Su línea `Estado:` ya lo refleja.
- Cambio 1: CORS con orígenes locales (`CORS_ORIGENES`), login con `id`, `GET /contadores` solo `id` y `usuario`, 404 para ids que no son de contador. Cambio 2: pruebas reales con `node:test`, verificador con mínimos, apoyos en `soporte-pruebas/`, sin puerta trasera de tokens.
- **Spec 004 (`specs/004-correcciones-backend/`)**, rama `worktree-spec-004` (worktree `.claude/worktrees/spec-004`; solo toca `Backend/` y `specs/004`). **T1-T23 hechas y con commit (T23 APROBADO en la segunda validación), pero la validación SDD posterior dio CAMBIOS NECESARIOS: la spec no está terminada.** `node --test` 153/153 en 22 archivos, verificador OK (153 de 150).
  - Bloque 1 (A-C, `55d78df`, APROBADO): `validarCampoTexto`, `asyncHandler` + handler global 400/503, `SessionModel` propaga errores → 503. Área D (`55d78df`): `jti` propio por token.
  - Bloque 2 (`871a723`, `0634980`, cierre `da332b5`, APROBADO): fechas `YYYY-MM-DD HH:mm:ss` con `conFechasLocales`; `findByUsername` exacto y `usuarioExisteIgnoreCase` para duplicados.
  - Bloque 3: G `5f75b9a` (`PATCH /usuarios/:usuario/restablecer-contrasena`, revoca todas las sesiones); H `9b66837` (`requireContador` antes de `checkCaseOwnership`; opción A del usuario: el aserto del admin acepta «Rol insuficiente»); I `bcb6401` (máximo de 100 en el alta); J `c09b16c` (barrido sin fugas, `src/` sin cambios).
  - Riesgo conocido aceptado (T16): si falla la revocación tras cambiar la contraseña, responde 503 a medias; el reintento lo completa. T23: la primera validación pidió reparar `tasks.md` (dañado en `5f75b9a`); la segunda, APROBADO.
  - **Validación SDD (revisor, RF por RF): CAMBIOS NECESARIOS.** 1 defecto: el 400 de tipo inválido del login dice «usuario o contraseña» sin nombrar el dato (RF-37). 7 huecos de pruebas: datos no textuales y JSON mal formado de extremo a extremo (crit. 32), contraseña y seed con otra capitalización (31), usuarios_de_sistema registrando caso y cambio de prioridad (13, 37), fechas de `mis-casos` (23), caducar una sesión no afecta a otra (43), restablecer propia/admin/seed (44), 201 del alta por usuarios_de_sistema (9).
- **Spec 003 (frontend, T1-T10)**: se trabaja en `main`, fuera de esta rama (T1 hecha allí, sin commit); en pausa hasta cerrar la 004.

## Próximos pasos

- **Solo queda pendiente el Cambio 1 de la spec 004 (Bloque 4, áreas K-R)**. Decidido por el usuario: Bloque 4 en esta spec (la spec no cambia); seed probado restaurando su hash; corregir la fila «Restablecer no cambia la clave» del plan; sin mejoras opcionales. Hecho: `plan.md` 10.7 y fila corregida (sin commit). Falta: escribir las tareas T24+ en `tasks.md` y que el usuario las apruebe, implementarlas (K en rojo primero; L-R de cobertura) y cerrar con revisor.
- Después: repetir la validación SDD; con APROBADO y la aprobación del usuario, cambiar la línea `Estado:` de `spec.md`, hacer el merge en `main` (sin `git add .`) y reiniciar el servidor del puerto 3000; luego retomar la spec 003.
- Commits solo cuando el usuario lo pida; nunca push sin preguntar.

## Pendientes heredados de la 002

- Todos resueltos en la 004: restablecimiento de contraseña (G), 403 sobre casos inexistentes (H), datos no textuales, `async` sin respuesta, errores de BD ignorados, token sin `jti`, fechas en UTC y login sin distinguir mayúsculas.
- Posibles mejoras fuera de la 004 (sin aprobar): el 403 de `requireContador` dice «registrar casos» también al cambiarlos; transacción para el restablecimiento; un cuerpo de más de 100 kB responde 503 en vez de entrada inválida; el barrido no genera ningún 503; cambio de hora del 1 de noviembre en `ultima_actividad`.

## Decisiones (y por qué)

- Tests de backend con `node --test`, sin paquetes extra (Constitución, Principio 2); base `delgrow_contadores` con datos `zz_test_*` que cada archivo borra al terminar.
- Funciones puras en `backend/src/utils/`, síncronas, con `hoy` inyectado para ser deterministas.
- Mensajes de error con tres partes en español (RF-23, RNF-5, RNF-6).
- MariaDB con mysql2 (pool); seed idempotente (RF-27).
- `buildCorsOptions` en `middlewares/originMiddleware.js`; `originUtils.js` solo tiene funciones puras con los orígenes por defecto. Orden en `app.js`: guard de orígenes → `cors(...)` → `express.json()`.
- `parseCounterId` acepta solo dígitos y se valida antes de consultar (MariaDB convierte `'2abc'` en `2`, RF-35).
- La tabla `sesiones` no tiene `id`: su clave primaria es `jti`; contar con `COUNT(*)`.
- Cerrar la 002 con salvedades en vez de alargarla: lo pendiente se documenta y se implementa en la 004.

## Aprendizajes y errores a evitar

- En Express 4 todo middleware o controlador `async` que consulte la BD debe ir con `asyncHandler`, no solo los controladores: si no, un rechazo deja la petición sin respuesta y puede detener el proceso.
- Un archivo de prueba "pass" no significa nada: contar por archivo y usar `node soporte-pruebas/verificarPruebas.js`. En rojo, el verificador cuenta también el `describe` que falla (6 pruebas fallidas → «7 fallidas») y no lista los nombres: verlos en la salida de `node --test`.
- Contrastar los veredictos del reviewer con la spec: hubo un «APROBADO — spec completa» con RF-28 y criterios 9/23 en realidad pendientes.
- Un parche de `db.query` en una prueba no llega a los modelos (`const { query } = require('../config/db')`): para simular fallos hay que sustituir `pool.query`.
- Los apoyos de prueba van en `soporte-pruebas/`, fuera de `test/` (dentro se ejecutan como prueba). Aislar datos (`zz_test_*`, limpiar solo lo que creó el proceso), cerrar servidor y pool en `after` o `node --test` se cuelga; MariaDB en marcha (3306, XAMPP).
- `query()` devuelve `rows`: en un `INSERT` es un objeto con `insertId`, no una lista.
- Reiniciar el servidor de desarrollo tras tocar el middleware de auth; cualquier script con `config/db.js` debe cerrar el pool; una ejecución interrumpida deja filas `zz_test_*` huérfanas.
- MariaDB local no está en modo estricto: un texto más largo que su columna se trunca sin error. Los máximos se validan en el controlador, antes de llegar a la BD.
- Al editar archivos con `String.replace` en Node, pasar el reemplazo como función: una secuencia «$`» o «$&» del texto se interpreta y puede duplicar contenido (así se dañó `tasks.md` en `5f75b9a`).
- PowerShell no soporta `&&` ni `||`: usar comandos separados.
