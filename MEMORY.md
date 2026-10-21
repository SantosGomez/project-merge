# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): T1-T10 implementadas** (auth con Argon2id y JWT, sesiones en BD, casos, seed idempotente y rutas montadas).
- **Cambio 2 (T11-T20) cerrado y APROBADO** (pruebas reales con `node:test`, verificador con tabla de mínimos, apoyos `bd.js`/`http.js`, sin puerta trasera de tokens): 93 pruebas en 15 archivos, cifras validadas por el reviewer.
- **Cambio 1 (T21-T29) cerrado y APROBADO por @reviewer**: 20 archivos, 119 pruebas, 119 pass, 0 fail; verificador `RESULTADO: OK` (119 de 116 mínimas). Contenido: CORS con orígenes locales vía `CORS_ORIGENES`; login con `id`; `GET /contadores` solo `id` y `usuario`; 404 para ids que no son de contador (`parseCounterId` + `findCounterById`).
- Spec 001 (frontend Quasar/Vue 3): completa (5 pantallas); todavía maqueta con datos de ejemplo y cuentas `admin`/`contador` locales.
- Spec 002 lista para que el usuario apruebe el cambio de su línea `Estado:` en `spec.md`; no cambia sin su aprobación.

## Próximos pasos

- Commit del Cambio 1 (pendiente de que el usuario lo pida).
- **Spec 003 (frontend funcional, T1-T10): sin empezar**; el frontend sigue siendo maqueta con datos de ejemplo y cuentas `admin`/`contador` locales.
- Cambio 3 previsto, **sin spec aprobada**.

## Hallazgos (Cambio 2)

- Pruebas **sin ejecución real**: se cargaban los archivos y se contaban como "pass" sin ejecutar nada (criterio 25 incumplido).
- **Puerta trasera de tokens de prueba** (`TOKENS_PRUEBA`): eliminada en T18.
- **Secreto JWT duplicado**: unificado en `backend/src/config/jwt.js` en T18.
- **RF-17 y RF-28 rotos** por `const [result] = await query`: `POST /casos` y `POST /usuarios` devolvían 500 dejando la fila creada. Corregido en T13.

## Decisiones (y por qué)

- Tests de backend con `node --test`, sin paquetes adicionales (Constitución, Principio 2); misma base `delgrow_contadores` con datos `zz_test_*` que cada archivo borra al terminar.
- Funciones puras en `backend/src/utils/`, síncronas, con `hoy` inyectado para ser deterministas.
- Mensajes de error con tres partes en español (RF-23, RNF-5, RNF-6); fechas en hora local YYYY-MM-DD HH:mm:ss (RNF-2).
- MariaDB con mysql2 (pool); seed idempotente (RF-27).
- `buildCorsOptions` vive en `middlewares/originMiddleware.js` y `originUtils.js` solo tiene funciones puras; los orígenes por defecto (`http://localhost:9000`, `http://127.0.0.1:9000`) están en `originUtils.js`.
- En `app.js` el orden es guard de orígenes → `cors(buildCorsOptions(...))` → `express.json()`: un origen ajeno recibe 403 antes de cualquier otra cosa y sin cabeceras CORS.
- En `respuestasApi.test.js` el barrido guarda todas las respuestas (éxito y error) y afirma las fugas **al final**, para que el fallo liste todas las operaciones que filtran datos de acceso en una sola pasada.
- `parseCounterId` acepta **solo dígitos** (sin recortar espacios: `' 12 '` → `null`, según el plan 8.3; recortar abriría la puerta a ids ambiguos) y se valida antes de consultar porque MariaDB convierte `'2abc'` en `2` y devolvía los datos de otro contador (RF-35).
- `contador_id` en la respuesta de `/contadores/:id/conteos` se deja tal como hoy (el parámetro de la ruta) para no cambiar la forma de la respuesta; a la base de datos va el id ya validado.
- La tabla `sesiones` no tiene `id`: su clave primaria es `jti`. Al contar sesiones hay que usar `COUNT(*)` y no un id.

## Aprendizajes y errores a evitar

- Contar por archivo y usar `node soporte-pruebas/verificarPruebas.js`: un archivo "pass" no significa que haya ejecutado pruebas.
- Los apoyos de prueba van en `soporte-pruebas/`, fuera de `test/` (dentro de `test/` se ejecutan como archivo de prueba).
- Aislar los datos (`zz_test_*`, limpiar solo lo que creó el proceso) y cerrar servidor y pool en `after`, o `node --test` se queda colgado.
- MariaDB debe estar en marcha (3306, XAMPP) antes de las suites de integración.
- `query()` devuelve `rows`: en un `INSERT` es un objeto con `insertId`, no una lista; no desestructurarlo.
- Reiniciar el servidor de desarrollo tras cambios en el middleware de autenticación: un proceso antiguo puede seguir aceptando tokens retirados.
- PowerShell no soporta `&&` ni `||`; usar comandos separados.
- Cualquier script suelto que use `config/db.js` debe cerrar el pool (`pool.end()`) al terminar.
- Una ejecución de pruebas interrumpida deja filas `zz_test_*` huérfanas: la limpieza de `soporte-pruebas/bd.js` borra solo lo que creó su propio proceso; las que queden hay que buscarlas y borrarlas a mano.
- Con T28 el rojo de T27 quedó verde: 119 pruebas, 119 pass, 0 fail; verificador `RESULTADO: OK` (119 de 116 mínimas). Antes de T28, `node --test` completo y el verificador fallaban **a propósito** (tras T27: 114 pass, 5 fail; verificador 114 de 116, RESULTADO: FALLA).
