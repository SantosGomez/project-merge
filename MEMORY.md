# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): implementada con salvedades** — Cambios 1 y 2 aprobados por el reviewer: T1-T29 todas `[x]`; `node --test` 119 pruebas, 119 pass, 0 fail en 20 archivos; verificador `RESULTADO: OK` (cifras validadas por el reviewer y comprobadas por el coordinador). Su línea `Estado:` ya lo refleja.
- Contenido del Cambio 1: CORS con orígenes locales vía `CORS_ORIGENES`; login con `id`; `GET /contadores` solo `id` y `usuario`; 404 para ids que no son de contador (`parseCounterId` + `findCounterById`).
- Cambio 2: pruebas reales con `node:test`, verificador con tabla de mínimos, apoyos en `soporte-pruebas/`, sin puerta trasera de tokens (93 pruebas en 15 archivos en su momento).
- **Spec 004 (`specs/004-correcciones-backend/`) en curso en paralelo a la 003**, en la rama `worktree-spec-004` (worktree `.claude/worktrees/spec-004`, solo toca `Backend/` y `specs/004`): 23 tareas (bloques de 7, 7 y 9). **T1-T2 hechas** (área A): `validarCampoTexto` en `validationUtils.js` y 400 de tres partes para datos no textuales en login, alta y registro de caso; `node --test` 125/125 en 20 archivos, verificador OK (125 de 122). **T3-T4 hechas** (área B): `errorHandlerGlobal.test.js` (5 pruebas) en verde; `utils/asyncHandler.js` envuelve los 9 controladores `async` de las 4 rutas y `app.js` responde 400 (JSON mal formado) o 503 (fallo interno) con tres partes; `node --test` 130/130 en 21 archivos, verificador OK (130 de 127). En `app.js` se usa `type: 'entity.parse.failed'`, el valor real de body-parser (la tarea decía `entity.parse.error`). **T5 hecha**: `fallosPersistencia.test.js` (6 pruebas: 2 pass, 4 fail por aserción; hoy `SessionModel` se traga los errores: login 200 con token, logout 200, 401 «sesión caducada» y 200). Cada prueba usa su propio contador para no repetir tokens. **T6, T8 y T9 hechas** (áreas C y D; orden cambiado con aprobación del usuario, anotado en `tasks.md`): `SessionModel` propaga los errores y login/logout/middleware responden 503; cada token lleva `jti` propio y la sesión se identifica por él. El revisor de T7 pidió 2 cambios, ya corregidos con pruebas: `asyncHandler(checkCaseOwnership)` (un fallo de BD en `PATCH /casos/:id` tumbaba el servidor) y tipo inválido de estado/prioridad/rol (RF-37). `node --test` 141/141 en 22 archivos, verificador OK (141 de 138). **Bloque 1 cerrado (T7 APROBADO por el revisor independiente).** Sin commit. Siguiente: Bloque 2 sin el área D, ya hecha (T10-T14: fechas y mayúsculas). La línea `Estado:` de la spec no cambia sin aprobación del usuario. El cierre T7 lo debe validar un revisor independiente, no quien implementa.
- **Spec 003 (frontend funcional, T1-T10): sin empezar**; el frontend sigue siendo maqueta (spec 001 completa, 5 pantallas) con datos de ejemplo y cuentas locales `admin`/`contador`; no se conecta al backend.

## Próximos pasos

- Empezar la **spec 003** (T1-T10) antes que la 004, por decisión del usuario (la 002 ya se alargó demasiado).
- Después, implementar la **spec 004** para cerrar los pendientes de la 002.
- Commit de `specs/002.../spec.md` y `specs/004-correcciones-backend/` solo cuando el usuario lo pida; nunca push sin preguntar.

## Pendientes que pasan a la spec 004

- RF-28 / criterio 9: no existe restablecimiento de contraseña (solo alta de usuarios).
- RNF-2 / criterio 23: las fechas se devuelven en UTC ISO (`...Z`) en vez de hora local `YYYY-MM-DD HH:mm:ss`.
- El login no distingue mayúsculas (colación `utf8mb4_general_ci`; `ADMIN_SEED` entra como `admin_seed`).
- Resueltos en la rama de la 004 (T1-T6, T8-T9): datos no textuales, handlers `async` sin respuesta, errores de BD ignorados en `SessionModel` y token repetido sin `jti`.
- Un admin o usuarios_de_sistema que cambia un caso inexistente recibe 404 en vez de 403.

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
