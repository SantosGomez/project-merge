# Plan — Spec 004

Plan de la spec 004, que recoge las correcciones del backend aprobadas como Cambio 3 de la spec 002. Se conserva la numeración de secciones del plan original (10.1 a 10.6) para no perder la trazabilidad con la spec 002, que ya tiene implementados y aprobados sus Cambios 1 y 2. Todo el trabajo ocurre en `backend/`; no se toca `Seguimiento-proyectos/`.

Las tareas están en `tasks.md`, repartidas en tres bloques (3A.1, 3A.2 y 3B) con un máximo de 10 tareas cada uno. `server.js` sigue limpio, sin endpoints ni lógica de negocio (constitución).

Spec: RF-36 a RF-48, RNF-8, y reescritos RF-05, RF-09, RF-16, RF-30, RF-41, RNF-2 y RNF-4, criterios 31 a 44 y reescritos 9, 13 y 23. Este plan solo añade: nada de lo planificado en las secciones 1 a 9 de la spec 002 se reabre.

## 10. Correcciones del backend (robustez, restablecimiento, fechas y mayúsculas)

### 10.1 Alcance y bloques (3A.1, 3A.2 y 3B)

El cupo acordado es **10 tareas por bloque de cambio** (como los Cambios 1 y 2). Cada bloque aplica la convención del proyecto: por cada área, una tarea de **tests en rojo** y otra de **implementar**, y cada bloque cierra con una tarea de **validación del reviewer**. La spec aprobada propone dos bloques (3A robustez y 3B restablecimiento y perfil) con el mismo alcance y el mismo reparto de requisitos que este plan; sin embargo, con esa convención las seis áreas de 3A (A-F) ocuparían 12 tareas más el cierre (13), por encima del cupo. Por eso 3A se ejecuta como **3A.1** y **3A.2**, sin cambiar el alcance ni mover ningún RF de 3A a 3B: **3A.1** (robustez de entradas y fallos: A, B, C), **3A.2** (resto de robustez y datos: D, E, F) y **3B** (restablecimiento, perfil, máximo de 100 y barrido: G, H, I, J). Las 10 áreas (A-J) son **disjuntas**: cada área aparece en un único bloque, con su tarea de tests en rojo y su tarea de implementar. Los IDs de tarea (T1 a T23) están en `tasks.md`.

| Bloque | Áreas | Tareas (en orden) | Nº tareas | ⚠️ |
|---|---|---|---:|---|
| **3A.1** | A, B, C | Tests en rojo A → Implementar A → Tests en rojo B → Implementar B → Tests en rojo C → Implementar C → Validación y cierre (reviewer) | 7 | ⚠️ (A, B y C tocan archivos que hoy funcionan) |
| **3A.2** | D, E, F | Tests en rojo D → Implementar D → Tests en rojo E → Implementar E → Tests en rojo F → Implementar F → Validación y cierre (reviewer) | 7 | ⚠️ (D, E y F tocan archivos que hoy funcionan) |
| **3B** | G, H, I, J | Tests en rojo G → Implementar G → Tests en rojo H → Implementar H → Tests en rojo I → Implementar I → Tests en rojo J → Implementar J → Validación y cierre (reviewer) | 9 | ⚠️ (G, H, I y J tocan archivos que hoy funcionan) |

Ningún bloque pasa de 10 tareas (máximo 9, en 3B). D se consideró para 3A.1 (habría quedado en 9 tareas), pero D no es robustez de entradas ni de fallos sino emisión del token: queda en 3A.2 junto con E y F.

**Áreas, tareas y RF/criterio (disjuntas, una sola vez cada área):**

| Área | Bloque | Tests en rojo | Implementar | RF / criterio | Qué hace | ⚠️ |
|---|---|---|---|---|---|---|
| A. Validación de tipos | 3A.1 | T1 (rojo A) | T2 (impl. A) | RF-37, criterio 32 | Rechaza datos de texto enviados con otro tipo (número, objeto, lista, booleano) con 400 de tres partes, antes de cualquier `.trim()`; cuerpo mal formado → 400 JSON inválido. | Sí |
| B. Captura async + handler global | 3A.1 | T3 (rojo B) | T4 (impl. B) | RNF-8, RF-47, criterio 41 | `asyncHandler` captura rechazos de manejadores `async`; handler global de `app.js` responde 503 (falla interna) o 400 (JSON mal formado) y el servidor atiende la siguiente petición. | Sí |
| C. Persistencia de sesiones | 3A.1 | T5 (rojo C) | T6 (impl. C) | RF-38, RF-39, RF-40, criterios 33, 34, 35 | Los errores de BD de `registrarSesion`, `revocar`, `obtenerSesion` y `tocarActividad` ya no se tragan: login → 503 sin token, logout → 503 sin confirmar, petición con token válido → 503 sin invalidar la sesión. | Sí |
| D. Token propio por inicio de sesión | 3A.2 | T8 (rojo D) | T9 (impl. D) | RF-41, criterio 36 | `jti` único por login; `registrarSesion` nunca falla por duplicado; `verifyAccessToken` devuelve `jti` en el payload. | Sí |
| E. Fechas en hora local | 3A.2 | T10 (rojo E) | T11 (impl. E) | RF-48, RNF-2, criterio 23 | Las fechas de los casos se devuelven como texto `YYYY-MM-DD HH:mm:ss` sin tocar el esquema. | Sí |
| F. Mayúsculas y duplicados | 3A.2 | T12 (rojo F) | T13 (impl. F) | RF-36, RF-45, criterios 31, 40 | Login compara exacto (carácter a carácter); alta rechaza duplicados sin distinguir mayúsculas; el almacenamiento sigue impidiendo dos cuentas equivalentes. | Sí |
| G. Restablecimiento de contraseña | 3B | T15 (rojo G) | T16 (impl. G) | RF-42, RF-43, RF-44, criterios 38, 39, 43, 44 | Endpoint protegido, invalida todas las sesiones de la cuenta, contraseña nueva con reglas del alta. | Sí |
| H. Perfil antes del caso | 3B | T17 (rojo H) | T18 (impl. H) | RF-46, RF-09, RF-16, criterios 9, 13, 37 | `requireContador` delante de `checkCaseOwnership` en `PATCH /casos/:id`. | Sí |
| I. Máximo 100 del nombre de usuario | 3B | T19 (rojo I) | T20 (impl. I) | RF-30, criterio 42 | La alta rechaza nombres > 100 caracteres sin llegar a la BD. | Sí |
| J. Barrido de respuestas sin datos de acceso | 3B | T21 (rojo J) | T22 (impl. J) | RF-33, RNF-7, criterio 27 | `respuestasApi.test.js` incluye el nuevo endpoint de restablecimiento. | Sí |

**Dependencias y orden entre bloques:**
- **3A.1 antes que 3A.2 y 3B.** Dentro de 3A.1 el orden es **A → B → C**: A no depende de nada; B introduce `asyncHandler` y el handler global; C los necesita para que un error de persistencia termine en 503 (sin B el rechazo seguiría sin respuesta) y además deja en `fallosPersistencia.test.js` la infraestructura de fallos simulados (`pool.query`, 10.3.3) que reutilizan 3A.2 y 3B (criterio 41 y área G).
- **3A.2 antes que 3B:** D (RF-41, token propio por login) y E (fechas) deben estar implementados antes del barrido final (J), que los ejercita en las respuestas y en las sesiones, y antes de G, que revoca sesiones identificadas por `jti`.
- **F (RF-36 y RF-45) se implementan juntos** en 3A.2, porque login exacto y duplicados del alta comparten `UserModel.findByUsername` y `usuarioExisteIgnoreCase`.
- **3B en orden interno:** G (restablecimiento) antes que J (barrido que incluye el nuevo endpoint); H (perfil) e I (máximo 100) son independientes entre sí y solo comparten `UserController`/`userRoutes` con G, por lo que se ordenan para no tocar el mismo archivo a la vez.
- Ningún bloque supera las 10 tareas (máximo 9, en 3B).

### 10.2 Archivos nuevos y modificados con su responsabilidad

Archivos nuevos:

| Archivo | Responsabilidad | RF / criterio | Ya funciona |
|---|---|---|---|
| `backend/src/utils/asyncHandler.js` | `asyncHandler(fn)`: middleware Express que captura promesas rechazadas de manejadores `async` y llama `next(err)`; nunca deja la petición sin respuesta. | RNF-8, RF-47, criterio 41 | No (nuevo) |
| `backend/test/errorHandlerGlobal.test.js` | Integración: 400 cuerpo mal formado, 503 fallo interno, y que la petición siguiente es atendida. | RNF-8, RF-47, criterio 41 | No (nuevo) |
| `backend/test/fallosPersistencia.test.js` | Criterios 33, 34, 35 y 41 forzando fallos de BD en `registrarSesion`, `revocar`, `obtenerSesion`/`tocarActividad`, `findByUsername`, `findByCounter` y `CaseModel.create` mediante sustitución de `pool.query` solo en el archivo de prueba (ver 10.3.3). | RF-38, RF-39, RF-40, RF-47, criterios 33, 34, 35, 41 | No (nuevo) |

Archivos existentes que se modifican (⚠️ requieren aprobación explícita; hoy funcionan):

| Archivo | Qué cambia | RF / criterio | Ya funciona |
|---|---|---|---|
| `backend/src/app.js` | Handler de errores: 400 para cuerpo no JSON (`entity.parse.error`/status 400), 503 para cualquier fallo interno (hoy es 500 genérico). | RF-47, RNF-8, criterio 41 | ✅ Sí (⚠️) |
| `backend/src/utils/validationUtils.js` | `validarCampoTexto(valor, nombre)`: comprueba `typeof === 'string'` antes de cualquier `.trim()`; devuelve faltante/tipo_invalido/valido. `validateLoginInput`, `validateNewCaseInput` y alta lo usan. | RF-37, RF-30, criterio 32 | ✅ Sí (⚠️) |
| `backend/src/utils/tokenUtils.js` | `generateAccessToken` agrega `jti` al payload antes de firmar. `verifyAccessToken` devuelve `jti` en el payload. | RF-41, criterio 36 | ✅ Sí (⚠️) |
| `backend/src/models/SessionModel.js` | Se eliminan los `try/catch` que tragan errores de BD; los errores propagan. Nuevo `revocarSesionesDeUsuario(usuarioId)`: `UPDATE sesiones SET revocado = 1 WHERE usuario_id = ?`. | RF-38, RF-39, RF-40, RF-42, criterios 33, 34, 35, 43 | ✅ Sí (⚠️) |
| `backend/src/models/UserModel.js` | `findByUsername` consulta con `WHERE usuario = ?` y filtra en la app con `rows.find(f => f.usuario === usuario)` (coincidencia exacta, independiente de la colación). Nuevo `usuarioExisteIgnoreCase(usuario)` (`LOWER(usuario) = LOWER(?)`) para duplicados del alta. Nuevo `updatePassword(id, hash)`. | RF-36, RF-45, RF-42, RF-44, criterios 31, 40 | ✅ Sí (⚠️) |
| `backend/src/controllers/AuthController.js` | `login`: si `registrarSesion` falla → 503 sin devolver token (RF-38). `logout`: revoca por `jti` del token; si falla → 503 sin confirmar el cierre (RF-39). | RF-38, RF-39, RF-41 | ✅ Sí (⚠️) |
| `backend/src/middlewares/authMiddleware.js` | Busca la sesión con `payload.jti` (`obtenerSesion(jti)`). `try/catch` alrededor de `obtenerSesion` y `tocarActividad`: fallo de BD → 503, nunca «sesión caducada», nunca invalida (RF-40, RNF-4). Adjunta `req.jti` para el logout. | RF-40, RF-04, RF-05, RNF-4, criterio 35 | ✅ Sí (⚠️) |
| `backend/src/routes/authRoutes.js` | `login` y `logout` envueltos con `asyncHandler` (área B). | RNF-8 | ✅ Sí (⚠️) |
| `backend/src/controllers/UserController.js` | Nuevo `resetPassword`: valida contraseña nueva (≥ 8, texto), busca cuenta exacta, hashea, `updatePassword`, `revocarSesionesDeUsuario`, respuesta sin datos de acceso. Alta valida ≤ 100 caracteres y duplicado sin distinguir mayúsculas. | RF-42, RF-43, RF-44, RF-45, RF-30, criterios 38, 39, 40, 42, 43, 44 | ✅ Sí (⚠️) |
| `backend/src/routes/userRoutes.js` | Nueva ruta protegida de restablecimiento de contraseña (`PATCH /:usuario/restablecer-contrasena`); rutas `async` envueltas con `asyncHandler` (área B). | RF-42, RF-43, RF-44, RNF-8 | ✅ Sí (⚠️) |
| `backend/src/routes/caseRoutes.js` | `PATCH /casos/:id`: `authenticateToken, requireContador, checkCaseOwnership, updateCase`; rutas `async` envueltas con `asyncHandler` (área B). | RF-46, RF-09, RF-16, criterios 9, 13, 37 | ✅ Sí (⚠️) |
| `backend/src/routes/counterRoutes.js` | Rutas `async` de lectura envueltas con `asyncHandler` (área B); el controller pasa a devolver fechas formateadas. | RNF-8, RF-48, criterio 23 | ✅ Sí (⚠️) |
| `backend/src/controllers/CaseController.js` | `createCase` y `updateCase`: devuelven `creado_en`/`actualizado_en` con `formatLocalDate` (texto `YYYY-MM-DD HH:mm:ss`). | RF-48, RNF-2, criterio 23 | ✅ Sí (⚠️) |
| `backend/src/controllers/CounterController.js` | `getCasesByCounter`: devuelve fechas con `formatLocalDate`. | RF-48, RNF-2, criterio 23 | ✅ Sí (⚠️) |

`asyncHandler` (área B) envuelve las rutas cuyo controller es `async`; por eso `authRoutes.js`, `userRoutes.js`, `caseRoutes.js` y `counterRoutes.js` figuran como modificados aunque su otro cambio pertenezca a otra área (en `userRoutes.js` y `caseRoutes.js` las filas ya incluyen ese envoltorio).

Sin cambios: `backend/src/server.js` (sigue limpio), `backend/src/config/db.js` (sin cambios en producción; el pool y `query()` quedan igual y solo se sustituye `pool.query` en memoria dentro del archivo de prueba, 10.3.3), `backend/src/utils/dateUtils.js` (ya tiene `formatLocalDate`; `isSessionInactive` sigue recibiendo `Date`), `backend/src/middlewares/ownershipMiddleware.js` (no lee `rol`; la comprobación de perfil va en la ruta), `backend/src/utils/seed.js`, `backend/src/utils/passwordUtils.js` (ya exporta `hashPassword`/`verifyPassword`).

Pruebas existentes modificadas (⚠️ toca archivos que ya funcionan):

| Archivo | Qué cambia | Por qué |
|---|---|---|
| `backend/test/validationUtils.test.js` | Seis pruebas de tipo inválido (usuario y contraseña como número, cliente como lista, prioridad como booleano, y los validadores de login y alta con objeto) — 3A.1, área A. | RF-37, criterio 32 |
| `backend/test/tokenUtils.test.js:36` | `deepStrictEqual(resultado.payload, { id, usuario, rol })` falla porque el payload ahora incluye `jti`; se ajusta a verificar `id`, `usuario`, `rol` y que `jti` es string no vacío (3A.2, área D). | RF-41, criterio 36 |
| `backend/test/authMiddleware.test.js` | Comentario de `iniciarSesionLimpia` (líneas 87-99) documenta el defecto antiguo («dos logins en el mismo segundo dan el mismo JWT y chocan en `jti` PK»); con `jti` por token ese defecto desaparece (3A.2, área D; no añade pruebas). | RF-41, criterio 36 |
| `backend/test/userModel.test.js` | `findByUsername` coincide exacto y `usuarioExisteIgnoreCase` detecta duplicados sin distinguir mayúsculas (3A.2, área F). | RF-36, RF-45, criterios 31, 40 |
| `backend/test/caseRoutes.test.js` | Fechas en respuestas (3A.2, área E); `PATCH` de un administrador sobre caso inexistente → 403 y no 404 (3B, área H). | RF-46, RF-48, criterios 13, 23 |
| `backend/test/counterRoutes.test.js` | Fechas en respuestas de casos (3A.2, área E). | RF-48, criterio 23 |
| `backend/test/userRoutes.test.js` | Alta con nombre que duplica a otra cuenta en distinta capitalización (3A.2, área F); restablecimiento de contraseña y máximo 100 caracteres (3B, áreas G e I). | RF-36, RF-45, RF-42 a RF-44, RF-30, criterios 31, 38, 39, 40, 42 |
| `backend/test/authRoutes.test.js` | Se añaden 2 pruebas de extremo a extremo: login con otra capitalización → 401 genérico, y dos inicios de sesión → tokens distintos e independientes (3A.2, áreas D y F). | RF-36, RF-41, criterios 31, 36 |
| `backend/test/respuestasApi.test.js` | El barrido existente se amplía para incluir el nuevo endpoint en éxito y error; no se añade una prueba nueva (3B, área J). | RF-33, RNF-7, criterio 27 |
| `backend/test/ownershipMiddleware.test.js` | Nada: no se modifica. El middleware no lee `rol`; la comprobación de perfil está en la ruta (área H no toca este archivo). | — |

### 10.3 Diseño y pseudocódigo por área

#### 10.3.1 Área A — validación de tipos antes de `.trim()` (RF-37, criterio 32)

```js
// backend/src/utils/validationUtils.js
function validarCampoTexto(valor, nombre) {
  if (valor === null || valor === undefined) {
    return { estado: 'faltante', campo: nombre };   // RF-02 / RF-19 / RF-20 / RF-30: dato que falta
  }
  if (typeof valor !== 'string') {
    return { estado: 'tipo_invalido', campo: nombre };  // RF-37: número, objeto, lista, booleano
  }
  if (valor.trim() === '') {
    return { estado: 'faltante', campo: nombre };
  }
  return { estado: 'valido', valor: valor.trim() };
}
```

En cada controller con cuerpo (login, alta, restablecimiento, registro de caso, cambio de caso): validar cada campo de texto con `validarCampoTexto`; `faltante` → 400 «falta el campo X» (tres partes); `tipo_invalido` → 400 «Dato X inválido: debe enviarse como texto» (tres partes). Nunca se llama `.trim()` sobre un valor que no sea string. El resto de la cadena (servidor) nunca se detiene porque `asyncHandler` captura cualquier rechazo restante (área B).

#### 10.3.2 Área B — captura de errores de manejadores `async` y handler global (RNF-8, RF-47, criterio 41)

```js
// backend/src/utils/asyncHandler.js
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

Se aplica a cada ruta cuyo controller es `async` (`login`, `logout`, `createUser`, `resetPassword`, `createCase`, `updateCase`, lecturas) de modo que un rechazo no capturado llegue a `next(err)` en vez de dejar la petición colgada o caer el proceso.

Handler global en `backend/src/app.js` (reemplaza el 500 actual):

```js
app.use((err, req, res, next) => {
  console.error(err);
  // express.json() ya pasa los errores de parseo con status 400 y type 'entity.parse.error'
  if (err.status === 400 || err.type === 'entity.parse.error') {
    return res.status(400).json(buildError(
      'Cuerpo de la petición no válido',
      'cuerpo JSON',
      'Envíe un cuerpo bien formado como JSON'
    ));
  }
  // Cualquier otro fallo interno → 503 servicio no disponible (RF-47, RNF-8)
  return res.status(503).json(buildError(
    'Fallo interno del servidor',
    'operación solicitada',
    'Inténtelo nuevamente en unos momentos'
  ));
});
```

Prueba de que el servidor sigue atendiendo: tras forzar un error y recibir 503, se envía una petición válida y se afirma que responde (200 o el código esperado). Nunca queda una petición sin respuesta.

**Tabla de códigos de la spec (fijada en «Decisiones tomadas»):**
- Entrada inválida → 400
- Sin sesión / sesión caducada → 401
- Acceso denegado → 403
- No encontrado → 404
- Servicio no disponible (falla interna) → 503

**Pruebas aprobadas que afirman hoy un 500:** ninguna (verificado buscando `500` en `backend/test/`). Si el reviewer encuentra alguna que aserte 500, se reajusta a 503 en la tarea que corresponda (P4, decidido).

#### 10.3.3 Área C — persistencia de sesiones y fallos de BD (RF-38, RF-39, RF-40, criterios 33, 34, 35)

`SessionModel` deja de tragar errores: se eliminan los `try/catch` de `obtenerSesion`, `registrarSesion`, `tocarActividad` y `revocar`; los errores de BD propagan y son capturados por el `try/catch` del controller o del middleware (503).

**Login (RF-38, criterio 33):**
```
token = generateAccessToken({..., jti}, ...)
try { await SessionModel.registrarSesion(token, cuenta.id, ahora) }
catch: devolver 503 { mensaje: buildError('No se pudo registrar la sesión', 'inicio de sesión', 'Inténtelo nuevamente en unos momentos') }  // sin devolver token
devolver 200 { token, rol, id, usuario }
```

**Cierre de sesión (RF-39, criterio 34):**
```
jti = jwt.decode(token).jti   // token ya validado por authenticateToken
try { await SessionModel.revocar(jti) }
catch: devolver 503 { ... 'la sesión no se cerró' ... }  // no confirma el cierre
devolver 200 { mensaje: 'Sesión cerrada correctamente' }
```

**Petición con token válido (RF-40, criterio 35, RNF-4):**
```
try { sesion = SessionModel.obtenerSesion(jti) }
catch: devolver 503 { 'fallo interno al consultar la sesión', ..., 'inténtelo nuevamente' }  // NO «sesión caducada», NO invalida
si !sesion || sesion.revocado: 401 'Sesión caducada'
try { SessionModel.tocarActividad(jti, ahora) }
catch: devolver 503 ...  // NO invalida la sesión; el mismo token sirve al recuperar la BD
```

**Simulación de fallos de BD sin paquetes nuevos.** El punto de sustitución es **`pool.query`**, no `db.query`: los modelos hacen `const { query } = require('../config/db')` y se quedan con esa referencia al cargarse, de modo que sustituir `db.query` después **no les llega**; en cambio `db.query()` resuelve `pool.query(sql, params || [])` en cada invocación (`config/db.js` exporta `{ query, pool }`), así que sustituir el método del pool afecta a todos los modelos sin tocar código de producción.

```js
// backend/test/fallosPersistencia.test.js (solo prueba; src/ no cambia)
const { pool } = require('../src/config/db');
const queryOriginal = pool.query.bind(pool); // conserva el `this` del pool

function simularFalloDeBd(condicion) {
  pool.query = async (sql, params) => {
    if (condicion(sql)) {
      throw new Error('fallo de BD simulado');
    }
    return queryOriginal(sql, params);
  };
}

// Restauración obligatoria: sin esto el pool queda roto para el resto de pruebas del archivo.
test.afterEach(() => {
  pool.query = queryOriginal;
});
```

En cada prueba que necesita el fallo se usa además `try { simularFalloDeBd(...) ... } finally { pool.query = queryOriginal; }`, para que una aserción fallida no deje el pool sustituido. La sustitución dura lo que dura el proceso de ese archivo (`node --test` ejecuta cada archivo en su propio proceso) y **solo hace fallar la sentencia que cumple la condición**: las demás consultas del mismo test siguen funcionando, que es lo que permite probar «falla el registro de la sesión pero el login encontró al usuario».

**Condiciones sobre el SQL (comprobadas contra las sentencias reales de los modelos):**

| Operación probada | Condición `condicion(sql)` | Sentencia real | Qué se afirma |
|---|---|---|---|
| Login no registra la sesión (criterio 33) | `sql.startsWith('INSERT INTO sesiones')` | `registrarSesion`: `INSERT INTO sesiones (jti, usuario_id, ...) VALUES (?, ?, ?, 0, ?)` | `findByUsername` (que empieza por `SELECT`) sigue funcionando → 503, sin `token`, y la petición siguiente es atendida. |
| Login no encuentra al usuario (criterio 41) | `sql.startsWith('SELECT * FROM usuarios')` | `findByUsername`: `SELECT * FROM usuarios WHERE usuario = ?` | 503 con tres partes; no se confirma ningún acceso y el servidor sigue atendiendo. |
| Consultar la sesión (criterio 35) | `sql.startsWith('SELECT * FROM sesiones')` | `obtenerSesion`: `SELECT * FROM sesiones WHERE jti = ?` | 503 (no 401 «sesión caducada»), la sesión no se revoca y el mismo token sirve al restaurar. |
| Renovar la actividad (criterio 35) | `sql.startsWith('UPDATE sesiones SET ultima_actividad')` | `tocarActividad`: `UPDATE sesiones SET ultima_actividad = ? WHERE jti = ?` | 503; la sesión no se invalida y el mismo token sirve al restaurar. |
| Cerrar sesión no revoca (criterio 34) | `sql.startsWith('UPDATE sesiones SET revocado = 1 WHERE jti')` | `revocar`: `UPDATE sesiones SET revocado = 1 WHERE jti = ?` | 503 sin confirmar el cierre; al restaurar, el reintento confirma y el token queda rechazado. La condición es más específica que `UPDATE sesiones` a propósito: `tocarActividad` comparte ese prefijo y debe seguir funcionando para que el fallo ocurra en el revocado. |
| Leer casos (criterio 41) | `sql.startsWith('SELECT * FROM casos')` | `findByCounter`: `SELECT * FROM casos WHERE contador_id = ? ORDER BY id DESC` | 503 con tres partes y la petición siguiente atendida. |
| Guardar un caso (criterio 41) | `sql.startsWith('INSERT INTO casos')` | `CaseModel.create`: `INSERT INTO casos (contador_id, cliente, ...) VALUES (...)` (plantilla multilínea; el texto empieza por `INSERT INTO casos`) | 503 y el caso no queda guardado; `POST /casos` no confirma creación. |
| Restablecer no cambia la clave (3B, criterio 41/43) | `sql.startsWith('UPDATE usuarios SET password_hash')` o `sql.startsWith('UPDATE sesiones SET revocado = 1 WHERE usuario_id')` | `updatePassword`: `UPDATE usuarios SET password_hash = ? WHERE id = ?`; `revocarSesionesDeUsuario`: `UPDATE sesiones SET revocado = 1 WHERE usuario_id = ?` | 503 y ningún cambio a medias; la contraseña anterior sigue sirviendo. |

Como la condición recibe la sentencia (no los parámetros), donde dos operaciones comparten prefijo se usa el prefijo más largo que las distingue (caso de `tocarActividad` frente a `revocar`).

Alternativas descartadas: exportar una bandera `forzarFallo` desde `SessionModel`/`db` (lógica de prueba en producción, prohibida); envolver `mysql2` con un adaptador (acopla la prueba al driver y añade una capa solo para probar); sustituir `db.query` en la prueba (`db.query = ...`): no funciona porque los modelos guardan su propia referencia a `query` desde que se cargan y la sustitución posterior no les llega (defecto técnico, no de estilo).

#### 10.3.4 Área D — `jti` propio por inicio de sesión (RF-41, criterio 36)

```js
// backend/src/utils/tokenUtils.js
const crypto = require('node:crypto');
function generateAccessToken(payload, secreto, expiresIn) {
  return jwt.sign({ ...payload, jti: crypto.randomBytes(16).toString('hex') }, secreto, { expiresIn });
}
```

Cada login firma un token distinto aunque sea el mismo usuario en el mismo instante. `registrarSesion(token, ...)` usa ese `jti` como PK, por lo que el segundo registro nunca falla por duplicado y las sesiones son independientes (cerrar una no invalida la otra). `verifyAccessToken` devuelve `jti` dentro del `payload` (además de `id`, `usuario`, `rol`); `authMiddleware` consulta `obtenerSesion(payload.jti)`; `req.user` sigue siendo `{ id, usuario, rol }`. `logout` obtiene el `jti` con `jwt.decode(token)` (token ya validado por `authMiddleware`).

Efecto en pruebas aprobadas (ver 10.5).

#### 10.3.5 Área E — fechas `YYYY-MM-DD HH:mm:ss` sin tocar el esquema (RF-48, RNF-2, criterio 23)

Conversión explícita en los controladores de respuesta con `formatLocalDate(fecha)` (ya existe en `dateUtils.js`): `CaseController.createCase`, `CaseController.updateCase`, `CounterController.getCasesByCounter` formatean `creado_en`/`actualizado_en` antes de `res.json`. `sesiones.ultima_actividad` sigue siendo `Date` (no se toca `isSessionInactive` ni `envejecerSesion`).

Alternativa descartada: `dateStrings: true` en el pool de `mysql2`. Convertiría también `sesiones.ultima_actividad` a string, rompiendo `.getTime()` en `isSessionInactive` y el `DATE_SUB` de `envejecerSesion`, y exigiría conversión extra en producción para seguir comparando fechas. Alternativa descartada: formatear en los modelos (acopla la capa de datos al formato de respuesta).

#### 10.3.6 Área F — mayúsculas y duplicados sin cambiar el esquema (RF-36, RF-45, criterios 31, 40)

Invariante acordado: login distingue mayúsculas (nombre y contraseña); la comprobación de duplicados del alta NO las distingue; el almacenamiento (UNIQUE) sigue impidiendo dos cuentas que solo difieran en mayúsculas; las cuentas del seed entran solo con su nombre exacto (RNF-3).

```js
// UserModel.findByUsername — independiente de la colación de la BD
async function findByUsername(usuario) {
  const rows = await query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  return rows.find((f) => f.usuario === usuario) || null;
}
```

Login: `findByUsername` exacto + `verifyPassword` (exacto) → RF-36. Alta: `usuarioExisteIgnoreCase(nombre)` → 400 «el usuario ya existe» si coincide ignorando mayúsculas → RF-45, criterio 40.

Efecto en `soporte-pruebas/bd.js`: usa `UserModel.findByUsername` para resolver nombres registrados en la limpieza; como ahora es exacto, un usuario dado de alta con `zz_test_...` se resuelve exactamente y no deja filas huérfanas (la limpieza borra por id el usuario registrado y sus casos/sesiones). No se borra nunca por prefijo `zz_test_`, así que no hay riesgo de borrar datos de otro proceso.

#### 10.3.7 Área G — restablecimiento de contraseña (RF-42, RF-43, RF-44, criterios 38, 39, 43, 44)

Ruta protegida (P1, decidido): `PATCH /usuarios/:usuario/restablecer-contrasena`, body `{ password }`.
Middlewares: `authenticateToken, requireAdminOrSistema, resetPassword`.

Controller `resetPassword`:
1. `password` con `validarCampoTexto`; si falta/vacío/solo espacios/no textual/menos de 8 → 400 «contraseña inválida» (RF-44, misma regla que RF-30).
2. `cuenta = UserModel.findByUsername(:usuario)` exacto (RF-36); si no existe → 404 no encontrado (RF-43), sin cambiar nada.
3. `hash = await hashPassword(password)` (Argon2id, RNF-1).
4. `await UserModel.updatePassword(cuenta.id, hash)` (nuevo en UserModel: `UPDATE usuarios SET password_hash = ? WHERE id = ?`).
5. `await SessionModel.revocarSesionesDeUsuario(cuenta.id)` → invalida TODAS las sesiones de la cuenta (criterio 43).
6. Responder 200 `{ mensaje: 'Contraseña restablecida correctamente' }` — sin ningún dato de acceso (RF-33).

Cualquier cuenta existente, incluidas las del seed y la propia del solicitante (RF-42, criterio 44). Un contador lo solicita → 403 vía `requireAdminOrSistema` (RF-29). Tras el restablecimiento, los tokens previos devuelven 401 «sesión caducada» (RF-05, criterio 43) y se puede entrar de inmediato con la contraseña nueva.

Funciones nuevas en modelos:
- `UserModel.updatePassword(id, hash)`
- `SessionModel.revocarSesionesDeUsuario(usuarioId)`

#### 10.3.8 Área H — perfil antes del caso (RF-46, RF-09, RF-16, criterios 9, 13, 37)

`PATCH /casos/:id` pasa de `authenticateToken, checkCaseOwnership, updateCase` a `authenticateToken, requireContador, checkCaseOwnership, updateCase` (igual que `POST /casos` ya usa `requireContador`). Un administrador o `usuarios_de_sistema` recibe 403 acceso denegado antes de buscar el caso, exista o no; solo un contador llega a `checkCaseOwnership`, que da 404 si el caso no existe y 403 si es ajeno.

Alternativa descartada: poner la comprobación de rol dentro de `checkCaseOwnership` (acopla el middleware al rol y obliga a `req.user.rol` en pruebas unitarias del middleware que hoy no lo tienen).

### 10.4 Decisiones y alternativas descartadas

1. **Simular fallos de BD sustituyendo `pool.query` solo en el archivo de prueba, con condición sobre el SQL** (criterios 33, 34, 35, 41; 10.3.3). Alternativa descartada: `db.query = ...` (los modelos guardan su referencia a `query` al cargarse, así que la sustitución posterior no les llega: no simula el fallo). Alternativa descartada: bandera `forzarFallo` en `SessionModel`/`db` (lógica de prueba en producción). Alternativa descartada: wrappers sobre `mysql2` (acopla al driver, más complejo).
2. **`asyncHandler` en las rutas `async` + handler global en `app.js`** en vez de try/catch por controller (RNF-8, RF-47, criterio 41). Alternativa descartada: try/catch repetitivo en cada controller.
3. **Handler global: 400 para JSON mal formado, 503 para cualquier fallo interno** (hoy 500 genérico en `app.js`). Alternativa descartada: dejar 500 para fallos internos (incumple RF-47/RNF-8 que fijan 503). Alternativa descartada: distinguir códigos por tipo de error de BD (no es necesario; RF-47 pide 503 para cualquier fallo interno).
4. **`jti` generado dentro de `generateAccessToken` y leído con `jwt.decode` en logout** (RF-41). Alternativa descartada: usar el JWT completo como jti (dos logins en el mismo segundo dan el mismo token y `registrarSesion` falla con PK duplicado tragado). Alternativa descartada: `verifyAccessToken` valide jti contra la BD (duplica la consulta de sesión ya hecha en `authMiddleware`).
5. **Fechas con conversión explícita `formatLocalDate` en controladores, pool sin `dateStrings`** (RF-48; P3, decidido). Alternativa descartada: `dateStrings: true` (rompe `isSessionInactive` y `envejecerSesion`). Alternativa descartada: formatear en modelos.
6. **Coincidencia exacta de usuario en la aplicación + `LOWER` para duplicados del alta** (RF-36, RF-45; P5, decidido), sin tocar esquema ni colación. Alternativa descartada: `COLLATE` en la SQL (depende de conocer la colación real). Alternativa descartada: cambiar el esquema/colación (prohibido por AGENTS.md sin consultar).
7. **`requireContador` delante de `checkCaseOwnership` en la ruta** (RF-46). Alternativa descartada: rol dentro de `checkCaseOwnership`.
8. **Ruta de restablecimiento `PATCH /usuarios/:usuario/restablecer-contrasena` con body `{ password }`** (P1, decidido). Alternativa descartada: `POST /usuarios/restablecer-contrasena` con `{ usuario, password }`.
9. **La spec 004 en tres bloques (3A.1, 3A.2 y 3B) con áreas disjuntas y sin solapamiento** (10.1). Alternativa descartada: 3A y 3B tal como los propone la spec, con 3A en 13 tareas: incumple el cupo de 10 tareas por bloque. Alternativa descartada: mover D a 3A.1 (habrían sido 9 tareas, pero D no es robustez de entradas ni de fallos sino emisión del token).

### 10.5 Estrategia de pruebas

- **Tests primero:** cada tarea escribe pruebas en rojo antes de la implementación; `node --test` desde `backend/`, sin paquetes nuevos; ninguna tarea se da por hecha con tests en rojo (constitución).
- **Apoyos solo en `backend/soporte-pruebas/`** (`bd.js`, `http.js`, `verificarPruebas.js`), nunca en `test/`. Datos de prueba con prefijo `zz_test_`. No se crean apoyos nuevos.
- **Infraestructura de fallos simulados:** sustitución de `pool.query` en el archivo de prueba (se guarda el original con `bind`, se lanza `Error` solo cuando la sentencia cumple la condición de 10.3.3 y se restaura siempre en `try/finally` y en `afterEach`). Afecta solo a las sentencias condicionadas y solo al proceso de ese archivo.
- **Mínimos en `MINIMOS` de `verificarPruebas.js`** (las tareas actualizan la constante al cerrar cada bloque). Línea base real: **20 archivos**, suma de `MINIMOS` **116** y **119 pruebas ejecutadas** (la suma de mínimos es una cota inferior: `appCors.test.js` ejecuta 6 con mínimo 4 y `idsContador.test.js` ejecuta 7 con mínimo 6; de ahí las 3 de diferencia). Los archivos de prueba existentes no listados no se tocan y conservan su mínimo.

| Archivo | Antes | 3A.1 | 3A.2 | 3B | Después |
|---|---:|---:|---:|---:|---:|
| `validationUtils.test.js` | 16 | +6 | — | — | 22 |
| `errorHandlerGlobal.test.js` | — (nuevo) | +5 | — | — | 5 |
| `fallosPersistencia.test.js` | — (nuevo) | +6 | — | — | 6 |
| `tokenUtils.test.js` | 5 | — | +1 | — | 6 |
| `authRoutes.test.js` | 4 | — | +2 | — | 6 |
| `authMiddleware.test.js` | 13 | — | 0 (solo comentarios) | — | 13 |
| `userModel.test.js` | 7 | — | +2 | — | 9 |
| `userRoutes.test.js` | 3 | — | +1 | +4 | 8 |
| `caseRoutes.test.js` | 7 | — | +1 | +1 | 9 |
| `counterRoutes.test.js` | 5 | — | +1 | — | 6 |
| `respuestasApi.test.js` | 3 | — | — | 0 (se amplía el barrido) | 3 |
| `ownershipMiddleware.test.js` | 4 | — | — | 0 | 4 |

**Totales por bloque (las columnas suman exactamente con la tabla de arriba):**

| Bloque | Pruebas nuevas | Archivos de prueba al cerrar | Suma de `MINIMOS` al cerrar | Pruebas ejecutadas esperadas |
|---|---:|---:|---:|---:|
| Línea base | — | 20 | 116 | 119 |
| **3A.1** | **17** (6 + 5 + 6) | **22** | **133** (116 + 17) | 136 (133 + 3) |
| **3A.2** | **8** (1 + 2 + 0 + 2 + 1 + 1 + 1) | **22** | **141** (133 + 8) | 144 (141 + 3) |
| **3B** | **5** (3 + 1 + 1) | **22** | **146** (141 + 5) | 149 (146 + 3) |

- **Spec 004 completa:** **30 pruebas nuevas** en 10 archivos (2 nuevos: `errorHandlerGlobal.test.js` y `fallosPersistencia.test.js`; 8 existentes ampliados), **11 archivos tocados** si se cuenta `authMiddleware.test.js`, que solo actualiza comentarios. `MINIMOS` pasa de **116 a 146** y los archivos de prueba de **20 a 22**. Comprobación cruzada: 119 ejecutadas + 30 nuevas = 149, que coincide con 146 + 3 de holgura de la línea base.
- **Comprobaciones adicionales acordadas con el usuario:** (1) la comparación exacta del login (criterio 31) se comprueba además en el endpoint, con una prueba nueva en `authRoutes.test.js` dentro de T12 (rojo) y T13 (verde); (2) las dos sesiones independientes (criterio 36) se comprueban en el endpoint con otra prueba nueva en `authRoutes.test.js` en T12, que pasa ya porque D se cerró en T9 y queda como guarda de regresión; (3) el fallo a mitad del restablecimiento se comprueba dentro de la prueba de éxito de T15 (no es una prueba nueva: se sustituye `pool.query` solo en ese archivo y se restaura en `finally`).
- Los valores por archivo son **cotas inferiores** (el verificador exige «al menos»): si al implementar sale una prueba más en un archivo, se sube su mínimo y el total, y la suma debe seguir cuadrando.

**Criterios 33, 34, 35 y 41:** se prueban con las condiciones de la tabla de 10.3.3: fallo en `registrarSesion` (login sin token, 503), en `revocar` (logout sin confirmar, 503), en `obtenerSesion` y en `tocarActividad` (503, no «sesión caducada», sesión no invalidada y mismo token válido al restaurar), y en `findByUsername`/`findByCounter`/`CaseModel.create` (503 en login, al leer casos y al guardar un caso); en cada caso se afirma además que la **siguiente petición es atendida** (servidor vivo, RNF-8) y que el pool quedó restaurado.

**Barrido RF-33 (criterio 27):** `respuestasApi.test.js` inicia sesión como administrador, contador y `usuarios_de_sistema`, llama a todos los endpoints en éxito y error (400, 401, 403, 404, 503) e afirma que ningún cuerpo de respuesta contiene `password_hash` ni `$argon2`, incluido el nuevo endpoint de restablecimiento.

### 10.6 Trazabilidad RF/RNF/criterio → bloque y área

| RF/RNF/criterio | Bloque | Área | Tareas |
|---|---|---|---|
| RF-05 (modificado: sesión caducada tras restablecimiento) | 3A.1 / 3B | C / G | T5, T6, T15, T16, T23 |
| RF-09 (modificado: acceso denegado antes de buscar el caso) | 3B | H | T17, T18, T23 |
| RF-16 (modificado: no encontrado tras comprobación de perfil) | 3B | H | T17, T18, T23 |
| RF-30 (modificado: máximo 100 del usuario) | 3B | I | T19, T20, T23 |
| RF-33 (barrido de respuestas, ya existente) | 3B | J | T21, T22, T23 |
| RF-36 | 3A.2 | F | T12, T13, T14 |
| RF-37 | 3A.1 | A | T1, T2, T3, T7 |
| RF-38 | 3A.1 | C | T5, T6, T7 |
| RF-39 | 3A.1 | C | T5, T6, T7 |
| RF-40 | 3A.1 | C | T5, T6, T7 |
| RF-41 | 3A.2 | D | T8, T9, T12, T14 |
| RF-42 | 3B | G | T15, T16, T23 |
| RF-43 | 3B | G | T15, T16, T23 |
| RF-44 | 3B | G | T15, T16, T23 |
| RF-45 | 3A.2 | F | T12, T13, T14 |
| RF-46 | 3B | H | T17, T18, T23 |
| RF-47 | 3A.1 | B (fallos de BD: C) | T3, T4, T5, T6, T7 |
| RF-48 | 3A.2 | E | T10, T11, T14 |
| RNF-2 | 3A.2 | E | T10, T11, T14 |
| RNF-4 | 3A.1 / 3B | C / G | T5, T6, T7, T15, T16, T23 |
| RNF-7 (ya existente, lo verifica el barrido) | 3B | J | T21, T22, T23 |
| RNF-8 | 3A.1 | B | T3, T4, T7 |
| criterio 9 (modificado: alta y restablecimiento por perfil autorizado) | 3B | G | T15, T16, T23 |
| criterio 13 (modificado: acceso denegado del perfil de solo consulta) | 3B | H | T17, T18, T23 |
| criterio 23 (modificado: fechas en hora local) | 3A.2 | E | T10, T11, T14, T23 |
| criterio 27 (barrido sin datos de acceso) | 3B | J | T21, T22, T23 |
| criterio 31 (RF-36) | 3A.2 | F | T12, T13, T14 |
| criterio 32 | 3A.1 | A | T1, T2, T3, T4, T7 |
| criterio 33 | 3A.1 | C | T5, T6, T7 |
| criterio 34 | 3A.1 | C | T5, T6, T7 |
| criterio 35 | 3A.1 | C | T5, T6, T7 |
| criterio 36 (RF-41) | 3A.2 | D | T8, T9, T12, T14 |
| criterio 37 (RF-46/09/16) | 3B | H | T17, T18, T23 |
| criterio 38 (RF-42) | 3B | G | T15, T16, T23 |
| criterio 39 (RF-43/44) | 3B | G | T15, T16, T23 |
| criterio 40 (RF-45) | 3A.2 | F | T12, T13, T14 |
| criterio 41 | 3A.1 | B (fallos de BD: C) | T3, T4, T5, T6, T7, T15, T23 |
| criterio 42 (RF-30) | 3B | I | T19, T20, T23 |
| criterio 43 (RF-42/05/41/RNF-4) | 3B | G | T15, T16, T23 |
| criterio 44 (RF-42/27/RNF-3) | 3B | G | T15, T16, T23 |

Cada RF/RNF/criterio nuevo o reescrito de la spec 004 aparece arriba con su bloque y su área, y con las tareas de `tasks.md` que lo cubren.

### Nota sobre el frontend (spec 003, no se modifica en este plan)

- **RF-36:** el login distingue mayúsculas y minúsculas en usuario y contraseña. `normalizeCredential` de la maqueta (spec 001/003) tendrá que dejar de normalizar mayúsculas al conectar con el backend real, o el login exacto fallaría para cuentas con mayúsculas.
- **RF-48 / RNF-2:** las fechas de los casos llegan ahora como texto `YYYY-MM-DD HH:mm:ss` (hora local), no como cadena ISO UTC; el frontend debe parsearlas o mostrarlas tal cual.
- **RF-01:** el login ya devuelve `id` (Cambio 1); el frontend lo consume como identificador del usuario.
- Nada de `Seguimiento-proyectos/` se toca en este plan; estos puntos se atienden cuando se implemente la spec 003.

### Decisiones cerradas con el usuario

P2 quedó resuelto por el plan: la división de 3A en 3A.1/3A.2 la impone el cupo de 10 tareas por bloque (3A tendría 13); el reparto está en 10.1 y no cambia el alcance aprobado en la spec.

- **P1, decidida:** `PATCH /usuarios/:usuario/restablecer-contrasena` con body `{ password }`. Alternativa descartada: `POST /usuarios/restablecer-contrasena` con `{ usuario, password }`.
- **P3, decidida:** conversión explícita con `formatLocalDate` en los controladores, sin `dateStrings` en el pool. Alternativa descartada: `dateStrings: true` en el pool de `mysql2`.
- **P4, decidida:** ninguna prueba aprobada afirma hoy un 500 (verificado con búsqueda en `backend/test/`); si al implementar aparece alguna que lo aserte, se reajusta a 503 en la tarea que corresponda.
- **P5, decidida:** `findByUsername` con `WHERE usuario = ?` y filtro en la aplicación `rows.find(f => f.usuario === usuario)`, sin tocar el esquema ni la colación. Alternativa descartada: `COLLATE` en la SQL.