# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): implementada con salvedades** — Cambios 1 y 2 aprobados por el reviewer: T1-T29 todas `[x]`; `node --test` 119 pruebas, 119 pass, 0 fail en 20 archivos; verificador `RESULTADO: OK` (cifras validadas por el reviewer y comprobadas por el coordinador). Su línea `Estado:` ya lo refleja.
- Contenido del Cambio 1: CORS con orígenes locales vía `CORS_ORIGENES`; login con `id`; `GET /contadores` solo `id` y `usuario`; 404 para ids que no son de contador (`parseCounterId` + `findCounterById`).
- Cambio 2: pruebas reales con `node:test`, verificador con tabla de mínimos, apoyos en `soporte-pruebas/`, sin puerta trasera de tokens (93 pruebas en 15 archivos en su momento).
- **Spec 004 (`specs/004-correcciones-backend/`) creada, sin commitear y sin implementar**: los incumplimientos pendientes de la 002 pasan allí, en 23 tareas (T1-T23; bloques de 7, 7 y 9). Requiere la 002 implementada. También sin commitear `specs/002-backend-auth-datos/spec.md` (3 líneas).
- **Spec 003 (frontend funcional, T1-T10): sin empezar**; el frontend sigue siendo maqueta (spec 001 completa, 5 pantallas) con datos de ejemplo y cuentas locales `admin`/`contador`; no se conecta al backend.

## Próximos pasos

- Empezar la **spec 003** (T1-T10) antes que la 004, por decisión del usuario (la 002 ya se alargó demasiado).
- Después, implementar la **spec 004** para cerrar los pendientes de la 002.
- Commit de `specs/002.../spec.md` y `specs/004-correcciones-backend/` solo cuando el usuario lo pida; nunca push sin preguntar.

## Pendientes que pasan a la spec 004

- RF-28 / criterio 9: no existe restablecimiento de contraseña (solo alta de usuarios).
- RNF-2 / criterio 23: las fechas se devuelven en UTC ISO (`...Z`) en vez de hora local `YYYY-MM-DD HH:mm:ss`.
- El login no distingue mayúsculas (colación `utf8mb4_general_ci`; `ADMIN_SEED` entra como `admin_seed`).
- Un `usuario` no textual (p. ej. `12345`) rompe un handler `async` de Express 4: `TypeError`, petición sin respuesta y riesgo de tumbar el proceso.
- `SessionModel` ignora errores de BD: logout que confirma sin invalidar, login con token sin sesión, fallo de consulta leído como «sesión caducada».
- Dos inicios de sesión del mismo usuario en el mismo segundo dan el mismo token (el JWT no lleva `jti`).
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

- Un archivo de prueba "pass" no significa nada: contar por archivo y usar `node soporte-pruebas/verificarPruebas.js`.
- Contrastar los veredictos del reviewer con la spec: hubo un «APROBADO — spec completa» con RF-28 y criterios 9/23 en realidad pendientes.
- Un parche de `db.query` en una prueba no llega a los modelos (`const { query } = require('../config/db')`): para simular fallos hay que sustituir `pool.query`.
- Los apoyos de prueba van en `soporte-pruebas/`, fuera de `test/` (dentro se ejecutan como archivo de prueba).
- Aislar datos (`zz_test_*`, limpiar solo lo que creó el proceso), cerrar servidor y pool en `after` o `node --test` se cuelga; MariaDB en marcha (3306, XAMPP).
- `query()` devuelve `rows`: en un `INSERT` es un objeto con `insertId`, no una lista.
- Reiniciar el servidor de desarrollo tras tocar el middleware de auth; cualquier script con `config/db.js` debe cerrar el pool; una ejecución interrumpida deja filas `zz_test_*` huérfanas.
- PowerShell no soporta `&&` ni `||`: usar comandos separados.
