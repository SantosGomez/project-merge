# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- **Spec 002 (backend): T1-T10 implementadas** (auth con Argon2id y JWT, sesiones en BD, casos, seed idempotente y rutas montadas). Repo unificado en la raíz con un solo `.git`.
- ⚠️ Esas pruebas **no se ejecutaban de verdad** (los 15 archivos solo se cargaban y `node --test` los contaba como "pass"), así que el criterio 25 no estaba cumplido. El Cambio 2 (T11-T20) lo corrige: hoy son **93 pruebas reales en 15 archivos**.
- **Cambio 2 (T11-T20) cerrado y APROBADO por @reviewer:** verificador con tabla de mínimos, apoyos `bd.js`/`http.js`, 15 suites aisladas, corrección de `create` en T13, tokens reales en T17 y sin puerta trasera en T18. Cifras validadas por @reviewer, no re-ejecutadas aquí: `node --test` dos veces → 93 pruebas, 93 pass, 0 fail/omitidas/pendientes/canceladas, 15 archivos, código 0; `verificarPruebas.js` → 15 archivos `OK`, 93 de 93 mínimas, `RESULTADO: OK`, código 0; 0 filas `zz_test_%`. Criterios 25 y 30, RF-04, RF-05, RF-07 y RF-25 cumplidos.
- Spec 001 (frontend Quasar/Vue 3): completa (5 pantallas); pruebas, lint y build cerrados en su momento.

## Próximos pasos

- **Cambio 1 (T21-T29: CORS y datos de acceso): sin empezar**; empieza solo con aprobación del usuario.
- Después, **spec 003 (frontend funcional, T1-T10): sin empezar**; el frontend sigue siendo maqueta con datos de ejemplo.
- Cambio 3 previsto, **sin spec aprobada**. La línea `Estado:` de `spec.md` 002 no cambia hasta que el usuario lo apruebe.

## Hallazgos (Cambio 2)

- Pruebas **sin ejecución real**: se cargaban los archivos y se contaban como "pass" sin ejecutar ninguna prueba.
- **Puerta trasera de tokens de prueba** (`TOKENS_PRUEBA` en `SessionModel` y su rama en `authMiddleware`): aceptaba valores fijos sin sesión registrada. Eliminada en T18.
- **Secreto JWT duplicado** en dos archivos. Unificado en `backend/src/config/jwt.js` en T18.
- **RF-17 y RF-28 rotos** por el patrón `const [result] = await query`: `POST /casos` y `POST /usuarios` respondían 500 dejando la fila creada. Corregido en T13.

## Decisiones (y por qué)

- Tests de backend con `node --test`, sin paquetes adicionales (Constitución, Principio 2); misma base `delgrow_contadores` con datos `zz_test_*` que cada archivo borra al terminar.
- Funciones puras en `backend/src/utils/`, síncronas, con `hoy` inyectado para ser deterministas (plan, sección 3).
- Mensajes de error con tres partes en español (RF-23, RNF-5, RNF-6); fechas en hora local YYYY-MM-DD HH:mm:ss (RNF-2).
- MariaDB con mysql2 (pool); seed idempotente (RF-27).
- Un único `config/jwt.js` con un valor por defecto de desarrollo; sin arranque condicionado a la variable (decisión del usuario).

## Aprendizajes y errores a evitar

- Comprobar que las pruebas se ejecutan: contar por archivo y usar `node soporte-pruebas/verificarPruebas.js`; un archivo "pass" no significa que haya ejecutado pruebas.
- Los apoyos de prueba van en `soporte-pruebas/`, fuera de `test/`; dentro de `test/` se ejecutan como archivos de prueba.
- Aislar los datos (`zz_test_*`, limpiar solo lo que creó el proceso) y cerrar servidor y pool en `after`, o `node --test` se queda colgado.
- MariaDB debe estar en marcha (3306, XAMPP) antes de las suites de integración.
- `query()` devuelve `rows`: en un `INSERT` es un objeto con `insertId`, no una lista; no desestructurarlo.
- Reiniciar el servidor de desarrollo tras cambios en el middleware de autenticación: un proceso antiguo puede seguir aceptando los tokens de prueba retirados.
- PowerShell no soporta `&&` ni `||`; usar comandos separados.
