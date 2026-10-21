# Tareas 002 — Backend con autenticación y datos

Máximo 10 tareas, en orden de dependencia. Cada una con sus RF y comprobación verificable. Formato: `node --test` desde `backend/`.

- [x] **T1. Tests de utilidades de contraseña y validación (en rojo).** RF-02, RF-19, RF-20, RF-21, RNF-1
  - Hecho cuando: `node --test test/passwordUtils.test.js test/validationUtils.test.js` falla (tests en rojo) para `hashPassword`, `verifyPassword`, `validateLoginInput`, `validateNewCaseInput`.

- [x] **T2. Implementar utilidades de contraseña (Argon2id) y validación de entrada.** RF-02, RF-19, RF-20, RF-21, RNF-1
  - Hecho cuando: `node --test test/passwordUtils.test.js test/validationUtils.test.js` pasa en verde; `hashPassword` y `verifyPassword` usan Argon2id; las validaciones devuelven los campos faltantes o el código de error correcto.

- [x] **T3. Tests de tokens, fechas y errores (en rojo).** RF-01, RF-04, RF-05, RF-25, RF-26, RNF-2, RNF-5, RNF-6
  - Hecho cuando: `node --test test/tokenUtils.test.js test/dateUtils.test.js test/errorUtils.test.js` falla (tests en rojo) para `generateAccessToken`, `verifyAccessToken`, `isTokenExpired`, `isSessionInactive`, `buildError`.

- [x] **T4. Implementar generación, verificación de tokens JWT y utilidades de fecha y error.** RF-01, RF-04, RF-05, RF-25, RF-26, RNF-2, RNF-5, RNF-6
  - Hecho cuando: `node --test test/tokenUtils.test.js test/dateUtils.test.js test/errorUtils.test.js` pasa en verde; `generateAccessToken` devuelve JWT firmado con campo exp; `verifyAccessToken` decodifica y valida; `isTokenExpired` y `isSessionInactive` reciben `hoy` como parámetro; `buildError` devuelve las tres partes en español.

- [x] **T5. Tests de modelos de datos y seed de datos maestros (en rojo).** RF-27, RF-12, RF-13, RF-14, RF-15, RF-16
  - Hecho cuando: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` falla (tests en rojo) para consultas SQL, conteos con ceros, búsqueda por contador y seed de datos maestros.

- [x] **T6. Implementar configuración de BD, modelos SQL y seed de datos maestros.** RF-27, RF-12, RF-13, RF-14, RF-15, RF-16
  - Hecho cuando: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` pasa en verde (con MariaDB de prueba); `seedDatabase` crea tablas e inserta administrador y contador con contraseñas hasheadas y no hace nada si ya existen.

- [x] **T7. Tests de middlewares de autenticación, roles y propiedad de casos (en rojo).** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11
  - Hecho cuando: `node --test test/authMiddleware.test.js test/roleMiddleware.test.js test/ownershipMiddleware.test.js` falla (tests en rojo) para `authenticateToken`, `requireAdmin`, `requireAdminOrSistema`, `checkCaseOwnership`.

- [x] **T8. Implementar middlewares de autenticación, roles y propiedad de casos.** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11
  - Hecho cuando: `node --test test/authMiddleware.test.js test/roleMiddleware.test.js test/ownershipMiddleware.test.js` pasa en verde; el middleware adjunta `req.user`, rechaza sin sesión, rechaza token expirado/revocado/inactivo y actualiza la actividad en cada petición válida.

- [x] **T9. Implementar controladores y rutas de la API.** RF-01 a RF-30 (todos)
  - Hecho cuando: `node --test test/authRoutes.test.js test/caseRoutes.test.js test/counterRoutes.test.js test/userRoutes.test.js` pasa en verde (requiere MariaDB de prueba); todos los endpoints responden con formato JSON consistente y mensajes en español con tres partes (RF-23, RNF-5, RNF-6).

- [x] **T10. Cablear `app.js` y `server.js`, registrar rutas, levantar servidor y pruebas de integración completa.** RF-01 a RF-30 (todos), criterios 1-25
  - Hecho cuando: `cd backend && node src/server.js` levanta el servidor sin errores, ejecuta el seed y responde en los endpoints montados (login, logout, contadores, casos, usuarios); `node --test` desde `backend/` pasa en verde (100% de tests, ninguno fallando), cubriendo los 25 criterios de finalización de la spec; sin tests en rojo pendientes.

## Cobertura y división

- Las 10 tareas cubren la spec completa: RF-01 a RF-30, RNF-1 a RNF-6, y los 25 criterios de finalización verificados en T10.
- No hace falta dividir la spec en bloques: entran en 10 tareas.
- Dependencias: T2 depende de T1; T4 depende de T3; T6 depende de T5; T8 depende de T7 y de T2/T4; T9 depende de T2, T4, T6 y T8; T10 depende de T9.

---

## Orden de los bloques de cambio y recuento

La spec tiene dos bloques de cambio aprobados que se ejecutan en este orden: **primero el Cambio 2 (T11-T20)** y **después el Cambio 1 (T21-T29)**, para que el Cambio 1 se construya sobre pruebas que de verdad se ejecutan. Las tareas se numeran en orden de ejecución. El cupo de 10 tareas se cuenta por bloque (decisión del usuario): Cambio 2 = 10 tareas, Cambio 1 = 9 tareas. T1-T10 no se modifican.

Correspondencia de IDs. **Esta tabla es solo histórica**: sirve para localizar referencias a la numeración anterior (el Cambio 1 se numeraba T11-T20; ninguna tarea se había empezado) y no se usa para ejecutar nada; los IDs vigentes son los T11-T29 de las secciones de cada bloque:

| ID anterior | Descripción | ID nuevo |
|---|---|---|
| T11 | Tests en rojo de orígenes: funciones puras y guard | **T21** |
| T12 | Implementar `originUtils` y `originMiddleware` | **T22** |
| T13 | Tests en rojo de CORS sobre la app real | **T23** |
| T14 | Cablear la restricción de orígenes en `app.js` y `.env` | **T24** |
| T15 | Tests en rojo de respuestas: `id` en login, lista de contadores, barrido | **T25** |
| T16 | `id` en el login y lista de contadores con `id` y `usuario` | **T26** |
| T17 | Tests en rojo de ids que no son de un contador | **T27** |
| T18 | Rechazar con 404 los ids que no son de un contador | **T28** |
| T19 | Resolver `mock_exp.test.js` | absorbida en **T11** (se elimina) |
| T20 | Validación y cierre del Cambio 1 | **T29** |

---

## Cambio 2 — Reparación de las pruebas y eliminación de la puerta trasera (T11-T20)

Plan: sección 9 de `plan.md`. Requisitos: criterio 25 (reescrito) y criterio 30 (nuevo), refuerzo de RF-04, RF-05, RF-07 y RF-25. Sin RF nuevos.

Reglas comunes del bloque:
- `node --test` y los demás comandos se ejecutan **desde `backend/`**.
- **Prerrequisito de toda tarea con base de datos: MariaDB en marcha (XAMPP, puerto 3306).** Al revisar estaba apagada (`ECONNREFUSED`). Si no responde, la tarea se detiene y avisa al usuario; no se da nada por verificado ni se marca como hecha. Cada tarea que la necesita lo repite en su línea «Prerrequisito». Esto incluye ejecutar `soporte-pruebas/verificarPruebas.js` desde T14, que necesita MariaDB igual que `node --test` (plan 9.5, punto 2.f).
- **Base de las pruebas (decisión del usuario):** la misma base `delgrow_contadores`, con datos propios de prefijo `zz_test_` que cada archivo borra al terminar; no se modifica `backend/src/config/db.js` ni se crea otra base.
- **Archivos nuevos aprobados por el usuario en este bloque:** `backend/soporte-pruebas/bd.js`, `backend/soporte-pruebas/http.js`, `backend/soporte-pruebas/verificarPruebas.js` y `backend/src/config/jwt.js`.
- Los archivos de prueba se registran con `node:test` (`describe`/`test`); los cuerpos de las funciones existentes se conservan y solo se cambia lo necesario para el aislamiento de datos (plan 9.2 y 9.3).
- **Política ante fallos (plan 9.4):** si una prueba real falla por una afirmación sobre el comportamiento, la tarea se detiene sin tocar `src/` ni relajar la prueba, se deja sin marcar y se reporta al usuario con el archivo, la prueba, el aserto, lo esperado y lo obtenido. Los arreglos de aislamiento dentro de la propia prueba (ids o nombres fijos, falta de limpieza) se hacen y se listan en el informe.
- ⚠️ = modifica o elimina archivos existentes que hoy funcionan; requiere aprobación explícita antes de empezar.
- Cada tarea termina con la puerta: `node --test <archivos de la tarea>` con el resultado indicado, y `MEMORY.md` actualizado.

- [x] **T11. ⚠️ Verificador del criterio 25 y eliminación de `mock_exp.test.js` (el "rojo" medible del bloque).** criterio 25
  - Prerrequisito: ninguno (no usa la base de datos).
  - **Esta tarea crea la carpeta `backend/soporte-pruebas/`.**
  - Archivo nuevo (aprobado por el usuario): `backend/soporte-pruebas/verificarPruebas.js`, con el diseño cerrado del plan 9.5, punto 2 (apartados a a h): `run({ files })` de `node:test` sobre `test/*.test.js`; cuenta como prueba real todo evento con `details.type === 'test'` cuyo nombre no sea la ruta del archivo; detecta omitidas (`skip`), pendientes (`todo`), canceladas (`failureType === 'cancelledByParent'`) y fallidas; agrupa por `data.file`; la tabla de mínimos va como constante `MINIMOS` dentro del propio archivo (los 15 archivos de la tabla 9.5, total 93); salida `archivo | pruebas | mínimo | resultado` más línea `RESUMEN`; código 0 = todo cumple, 1 = cualquier incumplimiento; detecta como ajeno cualquier archivo de `test/` que no termine en `.test.js`; temporizador de seguridad de 120 s.
  - ⚠️ Archivo existente eliminado: `backend/test/mock_exp.test.js` (decisión del usuario).
  - Hecho cuando: (1) `backend/test/mock_exp.test.js` ya no existe; (2) `cd backend; node soporte-pruebas/verificarPruebas.js; "exit=$LASTEXITCODE"` imprime **literalmente** las 16 líneas del plan 9.5, punto 2.g (15 líneas `<archivo> | 0 | <mínimo> | FALLA: sin pruebas reales` y la línea `RESUMEN: archivos 15 | con pruebas reales 0 | pruebas 0 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA`) y después `exit=1`; (3) comprobación de los ajenos: se crea temporalmente un archivo vacío `backend/test/ajeno.js`, el verificador imprime además `AJENO | test/ajeno.js | - | FALLA: archivo que no termina en .test.js dentro de test/`, el resumen muestra `.js ajenos 1` y sale con código 1; se borra `ajeno.js` y vuelve a salir la salida de (2); (4) `node --test` desde `backend/` muestra `tests 15`, `suites 0`, `pass 15`, `fail 0`, `skipped 0`, `todo 0` y **ya no** lista «mock CJS experiment» (son 15 entradas de archivos sin comprobaciones; es el verificador quien las marca como vacías; este es el único momento del bloque en que «15 pass» es el resultado esperado); (5) todo lo anterior se obtiene **con MariaDB apagada o encendida**: ejecutar los 15 archivos, que solo exportan funciones, no abre conexiones.

- [x] **T12. ⚠️ Convertir en pruebas reales las 6 suites unitarias (sin base de datos).** criterio 25, RNF-1, RNF-2, RNF-5, RNF-6, RF-01, RF-02, RF-05, RF-08, RF-09, RF-19 a RF-21, RF-25, RF-28, RF-29
  - Prerrequisito: ninguno (pruebas unitarias, no usan la base de datos).
  - ⚠️ Archivos existentes reescritos (solo se quita `module.exports` y se registra cada función con `describe`/`test`; cuerpos intactos): `test/dateUtils.test.js` (4), `test/errorUtils.test.js` (2), `test/passwordUtils.test.js` (4), `test/tokenUtils.test.js` (5), `test/validationUtils.test.js` (16), `test/roleMiddleware.test.js` (8).
  - Hecho cuando: `node --test test/dateUtils.test.js test/errorUtils.test.js test/passwordUtils.test.js test/tokenUtils.test.js test/validationUtils.test.js test/roleMiddleware.test.js` ejecuta **6 archivos y 39 pruebas, 39 pass, 0 fail, 0 skipped, 0 todo**, sin MariaDB y terminando por sí solo; `node soporte-pruebas/verificarPruebas.js` (tampoco necesita MariaDB en esta tarea) imprime `OK` en esos 6 archivos con `pruebas` igual a su mínimo (4, 2, 4, 5, 16 y 8), `FALLA: sin pruebas reales` en los otros 9, el resumen `RESUMEN: archivos 15 | con pruebas reales 6 | pruebas 39 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA` y sale con código 1.

- [x] **T13. ⚠️ Apoyos de pruebas con base de datos y servidor HTTP, y corrección de `create` en los modelos.** criterio 25, RF-17, RF-18, RF-28
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, la tarea se detiene y avisa al usuario en lugar de dar nada por verificado.
  - Archivos nuevos (aprobados por el usuario): `backend/soporte-pruebas/bd.js` y `backend/soporte-pruebas/http.js`, con la API exacta del plan 9.3 (`prepararBaseDeDatos`, `crearUsuarioDePrueba`, `registrarUsuarioCreado`, `crearCasoDePrueba`, `envejecerSesion`, `limpiarDatosDePrueba`, `cerrarBaseDeDatos`; `iniciarServidor`, `peticion`, `iniciarSesion`). Los ids y nombres creados se guardan en la memoria del proceso y la limpieza borra solo esos, nunca por prefijo. Los dos archivos ya están creados y **se conservan** (decisión del usuario).
  - ⚠️ Archivos existentes modificados (hallazgo del humo, plan 9.9; **el implementer aplica SOLO estas dos líneas en `backend/src/`**, sin tocar `db.js`, los `SELECT` ni nada más):
    - `backend/src/models/UserModel.js`, línea 25: `const [result] = await query(` → `const result = await query(`. `create` sigue devolviendo `result.insertId` (un número).
    - `backend/src/models/CaseModel.js`, línea 65: `const [result] = await query(` → `const result = await query(`. `create` sigue devolviendo `result.insertId` (un número).
  - Por qué: `query()` devuelve solo `rows`; para un `INSERT` es un `ResultSetHeader`, no una lista, y desestructurarlo lanzaba `TypeError: ... is not iterable` después de ejecutar el `INSERT`. Efecto: `POST /usuarios` (RF-28) y `POST /casos` (RF-17, RF-18) respondían 500 dejando la fila creada. **El humo ya falló en rojo antes del arreglo** (`TypeError` al crear el usuario o el caso de prueba): ese es el rojo documentado (TDD cumplido); con las dos líneas cambiadas debe pasar al verde literal de abajo.
  - Hecho cuando: el comando de humo siguiente se ejecuta y da exactamente el resultado indicado. Se crea el archivo temporal `%TEMP%\humo_t13.js` (**fuera del repositorio; se borra al terminar y no se deja nada en `backend/`**) con este contenido:

    ```js
    const raiz = 'C:/xampp/htdocs/status-conta/backend/';
    const bd = require(raiz + 'soporte-pruebas/bd.js');
    const http = require(raiz + 'soporte-pruebas/http.js');
    const { query } = require(raiz + 'src/config/db.js');

    async function residuos() {
      const patron = 'zz\\_test\\_%';
      const [u] = await query('SELECT COUNT(*) AS n FROM usuarios WHERE usuario LIKE ?', [patron]);
      const [c] = await query('SELECT COUNT(*) AS n FROM casos WHERE contador_id IN (SELECT id FROM usuarios WHERE usuario LIKE ?)', [patron]);
      const [s] = await query('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE usuario LIKE ?)', [patron]);
      return { usuarios: Number(u.n), casos: Number(c.n), sesiones: Number(s.n) };
    }

    (async () => {
      console.log('RESIDUOS_INICIALES', JSON.stringify(await residuos()));
      await Promise.all([bd.prepararBaseDeDatos(), bd.prepararBaseDeDatos()]);
      console.log('SEED_PARALELO OK');
      const usuario = await bd.crearUsuarioDePrueba('contador');
      console.log('USUARIO_CREADO', /^zz_test_contador_[0-9a-f]{8}$/.test(usuario.usuario));
      const [fila] = await query('SELECT password_hash FROM usuarios WHERE id = ?', [usuario.id]);
      console.log('HASH_ARGON2ID', fila.password_hash.startsWith('$argon2id$'));
      const casoId = await bd.crearCasoDePrueba(usuario.id, { cliente: 'Cliente de humo' });
      console.log('CASO_CREADO', Number.isInteger(casoId) && casoId > 0);
      const srv = await http.iniciarServidor();
      const token = await http.iniciarSesion(srv.puerto, usuario.usuario, usuario.password);
      console.log('LOGIN_TOKEN_JWT', token.split('.').length === 3);
      const [ses] = await query('SELECT COUNT(*) AS n FROM sesiones WHERE usuario_id = ?', [usuario.id]);
      console.log('SESION_REGISTRADA', Number(ses.n) >= 1);
      await srv.cerrar();
      await bd.limpiarDatosDePrueba();
      console.log('RESIDUOS_TRAS_LIMPIEZA', JSON.stringify(await residuos()));
      await bd.cerrarBaseDeDatos();
      console.log('FIN');
    })().catch((e) => {
      console.error('ERROR_HUMO', e.message);
      process.exitCode = 1;
      bd.cerrarBaseDeDatos().catch(() => {});
    });
    ```

    Se ejecuta con `cd C:\xampp\htdocs\status-conta\backend; node $env:TEMP\humo_t13.js; "exit=$LASTEXITCODE"` (desde `backend/`, para que `dotenv` encuentre `.env`) y debe imprimir **literalmente**:

    ```
    RESIDUOS_INICIALES {"usuarios":0,"casos":0,"sesiones":0}
    SEED_PARALELO OK
    USUARIO_CREADO true
    HASH_ARGON2ID true
    CASO_CREADO true
    LOGIN_TOKEN_JWT true
    SESION_REGISTRADA true
    RESIDUOS_TRAS_LIMPIEZA {"usuarios":0,"casos":0,"sesiones":0}
    FIN
    exit=0
    ```

    El script no usa `process.exit` en el camino normal, así que el comando **termina por sí solo en menos de 10 segundos** (prueba de que el servidor y el pool se cierran). Si `RESIDUOS_INICIALES` no es cero, hay residuos de una ejecución anterior: la tarea se detiene y avisa al usuario. Si aparece `ECONNREFUSED`, MariaDB está apagada: la tarea se detiene y avisa. Además, `node --test` desde `backend/` no menciona `soporte-pruebas` en su salida (no recorre esa carpeta).
  - Hecho cuando (además, por la corrección de `create`): (1) **con el arreglo aplicado el humo imprime EXACTAMENTE la salida literal de arriba** (incluidas `USUARIO_CREADO true`, `HASH_ARGON2ID true`, `CASO_CREADO true`, `LOGIN_TOKEN_JWT true`, `SESION_REGISTRADA true`, `RESIDUOS_TRAS_LIMPIEZA {"usuarios":0,"casos":0,"sesiones":0}`, `FIN` y `exit=0`); (2) `UserModel.create` y `CaseModel.create` devuelven un número: el informe muestra `typeof === 'number'` de cada una (por ejemplo con otro archivo temporal en `%TEMP%`, fuera del repo, que crea un usuario y un caso con los apoyos, comprueba `typeof` y limpia); (3) **reintentar el humo una segunda vez seguida** da el mismo resultado literal y `RESIDUOS_INICIALES {"usuarios":0,"casos":0,"sesiones":0}` (sin residuos de la primera ejecución); (4) `Get-ChildItem backend\src -Recurse -Filter *.js | Select-String -Pattern 'const \[\w+\] = await query'` devuelve **0 resultados**; (5) el diff de `backend/src/` de esta tarea es exactamente esas dos líneas.

- [x] **T14. ⚠️ Convertir y aislar las suites de modelos y seed (integración).** criterio 25, RF-01, RF-03, RF-12 a RF-17, RF-22, RF-27, RF-28, RNF-1
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - ⚠️ Archivos existentes reescritos: `test/userModel.test.js` (7: nombres únicos `zz_test_*`, limpieza; `testCreateInsertaUsuarioYDevuelveId` afirma que `create` devuelve un número y que el registro existe), `test/caseModel.test.js` (8: contadores propios en vez de `contador_id` 1 a 5 y 99998, cantidades exactas sobre sus datos; `testCreateCreaCasoConEstadoPendiente` añade la afirmación de que `create` devuelve un número y que el caso creado existe con ese `id`; son afirmaciones dentro de las pruebas existentes, no pruebas nuevas), `test/seed.test.js` (3: se comprueban solo `admin_seed` y `contador_seed`: una cuenta de cada, hash `$argon2id$`, no se duplican tras dos ejecuciones).
  - Hecho cuando: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` ejecuta **3 archivos y 18 pruebas, 18 pass, 0 fail/skipped/todo**; repetido dos veces seguidas da el mismo resultado; `SELECT COUNT(*)` sobre `usuarios`, `casos` y `sesiones` con `zz_test_%` devuelve **0** (las mismas tres consultas del humo de T13); el proceso termina por sí solo (pool cerrado); `node soporte-pruebas/verificarPruebas.js` (necesita MariaDB en marcha; si responde `AVISO: MariaDB no responde`, la tarea se detiene y avisa) imprime `OK` en `userModel` 7, `caseModel` 8 y `seed` 3, y `RESUMEN: archivos 15 | con pruebas reales 9 | pruebas 57 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA` (código 1 hasta T18: quedan 6 archivos sin convertir).

- [x] **T15. ⚠️ Convertir y aislar las suites de rutas de autenticación y de usuarios (integración HTTP).** criterio 25, RF-01 a RF-03, RF-26, RF-28 a RF-31
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - ⚠️ Archivos existentes reescritos: `test/authRoutes.test.js` (4: contador propio en vez de `contador_seed`; `testLogoutRevocado` pasa a comprobar también que el mismo token recibe 401 tras cerrar sesión), `test/userRoutes.test.js` (3: administrador propio, nombres de alta únicos y limpieza en lugar del nombre fijo `nuevo_usuario_t9`; `testAltaUsuarioComoAdmin` afirma además que, tras el 201 de `POST /usuarios`, existe **una sola fila** con ese nombre y su contraseña está hasheada con Argon2id; afirmaciones dentro de la prueba existente, no pruebas nuevas; cubre la corrección de `create`, plan 9.9).
  - Hecho cuando: `node --test test/authRoutes.test.js test/userRoutes.test.js` ejecuta **2 archivos y 7 pruebas, 7 pass, 0 fail/skipped/todo**; repetido dos veces seguidas da el mismo resultado; 0 filas `zz_test_%` al terminar; el proceso termina solo; el verificador (con MariaDB en marcha) imprime `OK` en `authRoutes` 4 y `userRoutes` 3 y `RESUMEN: archivos 15 | con pruebas reales 11 | pruebas 64 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA` (código 1 hasta T18).

- [x] **T16. ⚠️ Convertir y aislar las suites de rutas de casos y de contadores (integración HTTP).** criterio 25, RF-08 a RF-10, RF-12 a RF-22
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - ⚠️ Archivos existentes reescritos: `test/caseRoutes.test.js` (7: contadores propios; `testRegistrarCasoValido` afirma además que, tras el 201 de `POST /casos`, el `id` del caso es numérico y el contador tiene **exactamente un caso**, sin duplicados; afirmaciones dentro de la prueba existente, no pruebas nuevas; cubre la corrección de `create`, plan 9.9; el caso ajeno lo intenta cambiar un segundo contador (RF-10) y también un administrador (RF-09)), `test/counterRoutes.test.js` (5: contadores y casos propios con conteos exactos; id inexistente calculado, no fijo).
  - Decisión de conteo: en `testCambiarCasoAjenoEsDenegado` el intento de un segundo contador (RF-10) y el de un administrador (RF-09) son **dos comprobaciones dentro de la misma prueba**, no dos pruebas; el mínimo de `caseRoutes.test.js` sigue siendo **7** (plan 9.5, punto 5). Si una de las dos comprobaciones falla, se aplica la política ante fallos.
  - Hecho cuando: `node --test test/caseRoutes.test.js test/counterRoutes.test.js` ejecuta **2 archivos y 12 pruebas, 12 pass, 0 fail/skipped/todo**; repetido dos veces seguidas da el mismo resultado; 0 filas `zz_test_%` al terminar; el proceso termina solo; el verificador (con MariaDB en marcha) imprime `OK` en `caseRoutes` 7 y `counterRoutes` 5 y `RESUMEN: archivos 15 | con pruebas reales 13 | pruebas 76 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA` (código 1 hasta T18).

- [x] **T17. ⚠️ Rehacer las pruebas de autenticación y propiedad con tokens reales, y añadir las pruebas del criterio 30 (en rojo donde hay puerta trasera).** RF-04, RF-05, RF-07, RF-10, RF-11, RF-16, RF-25, criterios 4, 5, 6, 30
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - Texto esperado (decisión del usuario): para un token revocado o sin sesión registrada las pruebas esperan el aviso «Sesión caducada» con sus tres partes.
  - ⚠️ Archivos existentes reescritos: `test/authMiddleware.test.js` (las 7 pruebas se rehacen con tokens emitidos por el login real, `envejecerSesion` para la inactividad y un JWT firmado con vencimiento negativo para RF-05; se añaden 6 pruebas: valores fijos `token_valido_xyz`/`token_revocado_xyz`/`token_inactivo_xyz`/`token_expirado_xyz` rechazados, valor inventado, JWT con otro secreto, JWT con el secreto real sin sesión registrada, sesión a 29 minutos que sigue válida y renueva actividad, y petición HTTP a `GET /contadores` con `Bearer token_valido_xyz` rechazada con 401 y sin datos), `test/ownershipMiddleware.test.js` (4: dos contadores y casos propios; caso inexistente obtenido creando y borrando un caso, en lugar de los casos fijos 10 y 20).
  - Hecho cuando: `node --test test/authMiddleware.test.js test/ownershipMiddleware.test.js` ejecuta **2 archivos y 17 pruebas**; resultado esperado en esta tarea (rojo medible): **fallan exactamente 4 pruebas**: las 2 que demuestran la puerta trasera (valores fijos aceptados y petición HTTP con `token_valido_xyz`) y las 2 que esperan el aviso «Sesión caducada» (token revocado tras cerrar sesión y JWT firmado sin sesión registrada), porque el código aún dice «Sesión no encontrada o revocada»; las otras 13 pasan. El informe lista los nombres de las que fallan. Si falla cualquier otra, se aplica la política ante fallos. El verificador (con MariaDB en marcha) imprime `authMiddleware.test.js | 9 | 13 | FALLA: menos pruebas que el mínimo; 4 fallidas`, `ownershipMiddleware.test.js | 4 | 4 | OK` y `RESUMEN: archivos 15 | con pruebas reales 15 | pruebas 89 de 93 mínimas | fallidas 4 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA` (código 1: es el rojo esperado de esta tarea).

- [x] **T18. ⚠️ Eliminar la puerta trasera de tokens de prueba y unificar el secreto JWT.** RF-04, RF-05, RF-07, RF-25, criterio 30
  - ⚠️ Archivos existentes modificados: `backend/src/models/SessionModel.js` (se borra `TOKENS_PRUEBA`; `obtenerSesion` termina en `return null`; el resto no se toca), `backend/src/middlewares/authMiddleware.js` (se borra la rama de sesión alternativa para tokens que no son JWT; una sola consulta de sesión; importa `JWT_SECRET` de `config/jwt.js`; el aviso de token sin sesión o revocado pasa a «Sesión caducada» sobre «token de acceso» con «Inicie sesión nuevamente», decisión del usuario), `backend/src/controllers/AuthController.js` (importa `JWT_SECRET` y `JWT_EXPIRES_IN` de `config/jwt.js`; nada más).
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - Archivo nuevo (aprobado por el usuario): `backend/src/config/jwt.js` (un único valor por defecto de desarrollo para secreto y duración; carga `dotenv` primero; sin arranque condicionado a la variable).
  - Hecho cuando: `node --test test/authMiddleware.test.js test/ownershipMiddleware.test.js` ejecuta **17 pruebas, 17 pass**; `node --test` completo ejecuta **15 archivos y 93 pruebas, 0 fail/skipped/todo**; una búsqueda en `backend/src/` de `TOKENS_PRUEBA`, `token_valido_xyz`, `token_revocado_xyz` y `token_inactivo_xyz` da **0 resultados** (esos valores solo aparecen en la prueba que verifica su rechazo); `backend/src/config/jwt.js` tiene exactamente el contenido del plan 9.6 (`require('dotenv').config()`, `JWT_SECRET` y `JWT_EXPIRES_IN` con `process.env.<variable> || <valor por defecto de desarrollo>`, `module.exports = { JWT_SECRET, JWT_EXPIRES_IN }`) y `AuthController.js` y `authMiddleware.js` lo importan; `Get-ChildItem backend\src -Recurse -Filter *.js | Select-String -Pattern 'delgrow_secre|process\.env\.JWT_'` devuelve **solo 2 líneas, ambas de `backend\src\config\jwt.js`**, el mismo comando sobre `backend\test` y `backend\soporte-pruebas` no devuelve nada, y `Select-String -Pattern 'config/jwt'` devuelve una línea en `AuthController.js` y otra en `authMiddleware.js`; `node soporte-pruebas/verificarPruebas.js` imprime la salida del plan 9.5, punto 2.h (15 archivos `OK`, `RESUMEN: ... pruebas 93 de 93 mínimas | fallidas 0 | ... RESULTADO: OK`) y sale con código 0; con el servidor levantado, `GET /contadores` con `Bearer token_valido_xyz` devuelve 401 y, con un token obtenido por login de administrador, 200.

- [x] **T19. ⚠️ Corregir `MEMORY.md` con el estado real, el hallazgo y las lecciones.** criterio 25
  - ⚠️ Archivo existente modificado: `MEMORY.md` (hoy afirma "tests en verde", "15 pass, 1 fail ... pre-existente" y "25 criterios cubiertos" cuando las pruebas no se ejecutaban). Debe quedar con: estado real (T1-T10 implementadas; las pruebas no se ejecutaban; el criterio 25 no estaba cumplido; Cambio 2 aplicado con 93 pruebas reales; Cambio 1 pendiente; Cambio 3 previsto sin spec aprobada), hallazgos (pruebas sin ejecución real, puerta trasera de tokens de prueba, secreto JWT duplicado, y **RF-17 y RF-28 estaban rotos por el patrón `const [result] = await query`**: `POST /casos` y `POST /usuarios` respondían 500 con la fila ya creada, corregido en T13), y lecciones: verificar siempre que las pruebas se ejecutan (mirar el número de pruebas por archivo y usar `node soporte-pruebas/verificarPruebas.js`, no fiarse del recuento "pass"), los apoyos de prueba no van dentro de `test/`, aislamiento de datos y cierre de servidor y pool, MariaDB debe estar levantada, y el valor que devuelve `query()` es `rows` (para un `INSERT` es un objeto con `insertId`, no una lista).
  - Hecho cuando: `MEMORY.md` tiene **50 líneas o menos**, no contiene claves, contraseñas ni datos sensibles, y ninguna línea afirma resultados de pruebas que no se hayan ejecutado de verdad.

- [x] **T20. Cierre del bloque Cambio 2: criterios 25 y 30 comprobados (lo valida el reviewer).** criterios 25 y 30, RF-04, RF-07
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - Hecho cuando: `cd backend && node --test` termina por sí solo con código 0 y resumen **tests 93, fail 0, cancelled 0, skipped 0, todo 0** (15 archivos); `node soporte-pruebas/verificarPruebas.js` termina con código 0 e imprime literalmente la salida del plan 9.5, punto 2.h (15 archivos `OK` con sus mínimos y `RESUMEN: archivos 15 | con pruebas reales 15 | pruebas 93 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: OK`); dos ejecuciones seguidas de `node --test` dan el mismo resultado; 0 filas `zz_test_%` en `usuarios`, `casos` y `sesiones`; la petición con un valor de token no emitido por el login es rechazada con aviso de iniciar sesión (probada por la suite y de forma manual con el servidor); `MEMORY.md` actualizado. La línea `Estado:` de `spec.md` no cambia hasta que el usuario lo apruebe.

### Cobertura y dependencias del Cambio 2

- Cobertura: criterio 25 → T11 a T16 y T20; RF-17, RF-18 y RF-28 (corrección de `create`) → T13, con las afirmaciones de T14, T15 y T16; criterio 30, RF-04, RF-05, RF-07, RF-25 → T17, T18 y T20; estado real en memoria → T19.
- Dependencias: T11 antes que T12 (mide el rojo); T12 no necesita MariaDB; T13 antes que T14, T15, T16 y T17; T14, T15 y T16 son independientes entre sí; T17 antes que T18 (rojo → verde); T18 antes que T19; T20 depende de todas.
- Prerrequisito del bloque: el Cambio 2 debe terminar y estar aprobado antes de empezar T21.

---

## Cambio 1 — protección de datos, CORS e ids (T21-T29)

Plan: sección 8 de `plan.md`. Requisitos: RF-12, RF-14, RF-16 (modificados), RF-32 a RF-35, RNF-7, criterios 1 y 24 a 29. **Empieza solo cuando el Cambio 2 está cerrado (T20).** Al aprobar este plan y estas tareas se aprueba también la creación de los archivos nuevos que figuran en T21-T28. **Prerrequisito de toda tarea con base de datos: MariaDB en marcha (XAMPP, puerto 3306); si no responde, la tarea se detiene y avisa al usuario en lugar de dar nada por verificado.** Las pruebas nuevas usan `node:test` y los apoyos de `backend/soporte-pruebas/` (datos propios `zz_test_`, limpieza, cierre de servidor y pool), y cada archivo de prueba nuevo se añade con su mínimo a la tabla del verificador (plan 9.5). ⚠️ = modifica archivos existentes que ya funcionan; requiere aprobación explícita antes de empezar. Cada tarea termina con `node --test <archivos>` en el resultado indicado y `MEMORY.md` actualizado.

- [x] **T21. Tests en rojo de orígenes permitidos: funciones puras y guard.** RF-34
  - Prerrequisito: ninguno (pruebas puras y con simulación, sin base de datos).
  - Archivos nuevos: `backend/test/originUtils.test.js`, `backend/test/originMiddleware.test.js`.
  - Hecho cuando: `node --test test/originUtils.test.js test/originMiddleware.test.js` falla porque `originUtils.js` y `originMiddleware.js` no existen. Los tests cubren: `parseAllowedOrigins` (lista con comas y espacios, barra final, vacío o `undefined` devuelve los dos orígenes por defecto de desarrollo), `isOriginAllowed` (exacto sí; otro puerto, otro host, `null`, vacío y mayúsculas distintas no) y el guard (sin origen llama a `next`; permitido llama a `next`; no permitido responde 403 con las tres partes en español y no llama a `next`). Se añaden a la constante `MINIMOS` de `soporte-pruebas/verificarPruebas.js` (archivo creado en T11; plan 9.5, punto 2.c) las entradas `'originUtils.test.js': 7` y `'originMiddleware.test.js': 3`.

- [x] **T22. Implementar `originUtils` y `originMiddleware`.** RF-34, RF-23
  - Prerrequisito: ninguno (sin base de datos).
  - Archivos nuevos: `backend/src/utils/originUtils.js`, `backend/src/middlewares/originMiddleware.js`.
  - Hecho cuando: `node --test test/originUtils.test.js test/originMiddleware.test.js` pasa en verde (10 o más pruebas reales, 0 omitidas); `createOriginGuard` y `buildCorsOptions` exportados; las funciones puras no dependen de Express ni del entorno.

- [x] **T23. Tests en rojo de CORS sobre la app real.** RF-34, criterios 24, 28
  - Prerrequisito: ninguno (las peticiones sin token se rechazan antes de consultar la base de datos).
  - Archivo nuevo: `backend/test/appCors.test.js` (usa `crearApp({ origenesPermitidos: [...] })`).
  - Hecho cuando: `node --test test/appCors.test.js` falla (hoy `cors()` acepta cualquier origen) comprobando: origen local permitido devuelve la cabecera `Access-Control-Allow-Origin` con ese origen; origen de otro sitio y puerto local no listado reciben 403 sin esa cabecera; petición sin origen a un endpoint protegido y sin token devuelve 401 (llegó al control de acceso, no 403 por origen); preflight `OPTIONS` con origen permitido responde con las cabeceras CORS y con origen no permitido responde 403. Se añade a la constante `MINIMOS` de `soporte-pruebas/verificarPruebas.js` la entrada `'appCors.test.js': 4`.

- [x] **T24. ⚠️ Cablear la restricción de orígenes en `app.js` y `.env`.** RF-34, criterios 24, 28
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)** (el `node --test` completo y el arranque del servidor la usan).
  - Archivos existentes tocados: `backend/src/app.js` (`crearApp(opciones)` acepta `origenesPermitidos`; sustituye `cors()` por guard + `cors(buildCorsOptions(...))` antes de `express.json()`; corrige el comentario RF-24 → RF-34) y `backend/.env` (añade `CORS_ORIGENES=http://localhost:9000,http://127.0.0.1:9000`, sin credenciales).
  - Hecho cuando: `node --test test/appCors.test.js` pasa en verde y las rutas existentes siguen montadas igual (`crearApp()` sin argumentos sigue funcionando); `node --test` completo sigue con 0 fallos; `node src/server.js` arranca sin errores.

- [x] **T25. Tests en rojo de respuestas: `id` en login, lista de contadores y barrido sin datos de acceso.** RF-01, RF-12, RF-32, RF-33, RNF-7, criterios 1, 26, 27
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**.
  - Archivo nuevo: `backend/test/respuestasApi.test.js` (MariaDB real; usuario de sistema creado con nombre único y limpieza).
  - Hecho cuando: `node --test test/respuestasApi.test.js` falla porque: el login de administrador, contador y usuarios_de_sistema no incluye `id` numérico; `GET /contadores` trae además `password_hash`, `rol` y `creado_en` (cada contador debe tener exactamente las claves `id` y `usuario`); el barrido (login, logout, lista de contadores, conteos, casos de contador, mis casos, alta y cambio de caso, alta de usuario, y errores 400/401/403/404) encuentra `password_hash` en `GET /contadores`. Se añade a la constante `MINIMOS` de `soporte-pruebas/verificarPruebas.js` la entrada `'respuestasApi.test.js': 3`.

- [x] **T26. ⚠️ Añadir `id` al login y filtrar la lista de contadores a `id` y `usuario`.** RF-01, RF-12, RF-32, RF-33, RNF-7, criterios 1, 26, 27
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**.
  - Archivos existentes tocados: `backend/src/models/UserModel.js` (solo **añade** `findCountersPublic`; las demás funciones no cambian), `backend/src/controllers/CounterController.js` (`listCounters` usa `findCountersPublic`; mismo mensaje de vacío), `backend/src/controllers/AuthController.js` (`login` añade `id: cuenta.id` a la respuesta).
  - Hecho cuando: `node --test test/respuestasApi.test.js` pasa en verde; ninguna respuesta del barrido contiene `password_hash` ni `$argon2`; `findByUsername`, `findAll`, `findById` y `create` quedan sin cambios (el diff de `UserModel.js` solo añade código); `node --test` completo sigue con 0 fallos.

- [x] **T27. Tests en rojo de ids que no son de un contador.** RF-35, RF-14, RF-16, criterio 29
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**.
  - Archivo nuevo: `backend/test/idsContador.test.js` (MariaDB real, datos propios; incluye los casos puros de `parseCounterId`).
  - Hecho cuando: `node --test test/idsContador.test.js` falla porque `parseCounterId` no existe y porque `/contadores/:id/conteos` y `/contadores/:id/casos` devuelven 200 para el id de un administrador y de un usuarios_de_sistema. Debe comprobar además: id inexistente, no numérico (`abc`, `2abc`) y negativo devuelven 404 con el texto "No se encontró el contador"; el id de un contador real sigue devolviendo 200 con conteos (ceros incluidos) y casos. Se añade a la constante `MINIMOS` de `soporte-pruebas/verificarPruebas.js` la entrada `'idsContador.test.js': 6`.

- [x] **T28. ⚠️ Rechazar con 404 los ids que no son de un contador.** RF-35, RF-14, RF-16, criterio 29
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**.
  - Archivos existentes tocados: `backend/src/utils/validationUtils.js` (solo **añade** `parseCounterId`), `backend/src/models/UserModel.js` (solo **añade** `findCounterById`), `backend/src/controllers/CounterController.js` (`countCasesByStatus` y `getCasesByCounter` usan `parseCounterId` + `findCounterById` en lugar de `findById`; mensajes y códigos iguales que hoy).
  - Hecho cuando: `node --test test/idsContador.test.js test/respuestasApi.test.js` pasa en verde; el diff de los tres archivos solo añade funciones y cambia las llamadas de esos dos controladores; `getMyCases` y `listCounters` no se modifican en esta tarea; `node --test` completo sigue con 0 fallos.

- [x] **T29. Validación y cierre del Cambio 1 (lo valida el reviewer).** RF-12, RF-14, RF-16, RF-32 a RF-35, RNF-7, criterios 1 y 24 a 29
  - Prerrequisito: **MariaDB en marcha (XAMPP, puerto 3306)**; si no responde, se detiene y avisa.
  - Hecho cuando: `cd backend && node --test` termina por sí solo con **0 fallos, 0 omitidas y 0 pendientes**, con **20 archivos y al menos 116 pruebas** (las 93 del Cambio 2 más las nuevas de T21-T27); `node soporte-pruebas/verificarPruebas.js` termina con código 0 con los mínimos de los archivos nuevos ya incluidos en `MINIMOS` y el resumen `RESUMEN: archivos 20 | con pruebas reales 20 | pruebas <n> de 116 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: OK` (con `<n>` igual o mayor que 116); 0 filas `zz_test_%` al terminar; con las credenciales del seed y el servidor levantado se comprueba manualmente: login con `id`, `GET /contadores` sin `password_hash`, conteos de un id de administrador devuelve 404, petición con `Origin` distinto devuelve 403 y sin `Origin` funciona con token; `MEMORY.md` actualizado; la línea `Estado:` de `spec.md` cambia a `implementada` solo si el usuario lo aprueba.

### Cobertura y dependencias del Cambio 1

- Cobertura: RF-34 → T21-T24; RF-01, RF-12, RF-32, RF-33, RNF-7 → T25-T26; RF-35, RF-14, RF-16 → T27-T28; todo → T29.
- Dependencias: todas dependen de que T20 esté cerrado; T22 de T21; T23 de T22; T24 de T22 y T23; T25 puede hacerse tras T24 (o antes, es independiente de CORS); T26 de T25; T27 de T26 (comparten `UserModel.js` y `CounterController.js`); T28 de T27; T29 de todas.
