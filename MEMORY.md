# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): implementada con salvedades** — Cambios 1 y 2 aprobados por el reviewer: T1-T29 todas `[x]`; `node --test` 119 pruebas, 119 pass, 0 fail en 20 archivos; verificador `RESULTADO: OK` (cifras validadas por el reviewer y comprobadas por el coordinador). Su línea `Estado:` ya lo refleja.
- Contenido del Cambio 1: CORS con orígenes locales vía `CORS_ORIGENES`; login con `id`; `GET /contadores` solo `id` y `usuario`; 404 para ids que no son de contador (`parseCounterId` + `findCounterById`).
- Cambio 2: pruebas reales con `node:test`, verificador con tabla de mínimos, apoyos en `soporte-pruebas/`, sin puerta trasera de tokens (93 pruebas en 15 archivos en su momento).
- **Spec 004 (`specs/004-correcciones-backend/`)** en la rama `worktree-spec-004` (worktree `.claude/worktrees/spec-004`, solo toca `Backend/` y `specs/004`): 23 tareas (bloques de 7, 7 y 9). **Bloque 1 (T1-T7) cerrado y APROBADO por el revisor** (áreas A, B y C: tipos validados con `validarCampoTexto`, `asyncHandler` y handler global 400/503, `SessionModel` propaga errores → 503) y **área D (T8-T9) hecha** (`jti` propio por token); todo en el commit `55d78df`, 141/141 pruebas en 22 archivos. **T10-T11 hechas (área E, commit `871a723`)**: pruebas de fechas en `counterRoutes`/`caseRoutes` (mínimos 6 y 8) y `conFechasLocales` en `CaseController` y `CounterController` (incluido `getMyCases`): las fechas salen como `YYYY-MM-DD HH:mm:ss`. `node --test` 143/143 en 22 archivos, verificador OK (143 de 140). **T12-T13 hechas (área F, commit `0634980`)**: `findByUsername` exige el nombre exacto (filtro en la aplicación, la colación `utf8mb4_general_ci` no se toca) y el alta detecta duplicados con `usuarioExisteIgnoreCase`; `node --test` 148/148 en 22 archivos, verificador OK (148 de 145). **T14 APROBADO por el revisor independiente (segunda validación; la primera solo pidió corregir esta memoria y subir +4 las cifras globales de `tasks.md` desde T14, por las pruebas añadidas en T7): Bloque 2 cerrado**, 148/148, verificador OK (148 de 145). La línea `Estado:` de la spec no cambia sin aprobación del usuario; los cierres de bloque los valida un revisor independiente.
- **Spec 003 (frontend funcional, T1-T10)**: se trabaja en `main`, fuera de esta rama (T1 hecha allí, sin commit); en pausa mientras avanza la 004.

## Próximos pasos

- La **spec 004 va primero**, por decisión del usuario: seguir con el Bloque 3 (T15-T23); la spec 003 se retoma después.
- La rama `worktree-spec-004` se integra en `main` con merge solo cuando el usuario lo decida.
- Commits solo cuando el usuario lo pida; nunca push sin preguntar.

## Pendientes que pasan a la spec 004

- RF-28 / criterio 9: no existe restablecimiento de contraseña (solo alta de usuarios) → área G (T15-T16).
- Un admin o usuarios_de_sistema que cambia un caso inexistente recibe 404 en vez de 403 → área H (T17-T18).
- Resueltos en la rama de la 004 (T1-T13): datos no textuales, handlers `async` sin respuesta, errores de BD ignorados en `SessionModel`, token repetido sin `jti`, fechas en UTC ISO (ahora `YYYY-MM-DD HH:mm:ss`) y login sin distinguir mayúsculas.

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
- Los apoyos de prueba van en `soporte-pruebas/`, fuera de `test/` (dentro se ejecutan como archivo de prueba).
- Aislar datos (`zz_test_*`, limpiar solo lo que creó el proceso), cerrar servidor y pool en `after` o `node --test` se cuelga; MariaDB en marcha (3306, XAMPP).
- `query()` devuelve `rows`: en un `INSERT` es un objeto con `insertId`, no una lista.
- Reiniciar el servidor de desarrollo tras tocar el middleware de auth; cualquier script con `config/db.js` debe cerrar el pool; una ejecución interrumpida deja filas `zz_test_*` huérfanas.
- PowerShell no soporta `&&` ni `||`: usar comandos separados.
