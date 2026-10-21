# Plan 002 — Backend con autenticación y datos

Spec: `specs/002-backend-auth-datos/spec.md` (Estado: aprobada por el usuario) · Plan para implementar dentro de `backend/`.

## 1. Alcance del plan

- Se construye el **backend real** con Node.js + Express + MariaDB (servidor local) que dé soporte a:
  - Inicio de sesión con credenciales y token JWT Bearer (RF-01 a RF-07).
  - Caducidad de sesión por inactividad (30 minutos; cada petición válida reinicia el temporizador) y cierre voluntario con revocación persistente en la base de datos (RF-25, RF-26, RF-31).
  - Lectura de contadores, conteos de casos por estado (ceros incluidos) y detalle de casos (RF-12 a RF-16).
  - Registro de caso por contador autenticado (estado Pendiente automático) y cambio de estado y prioridad de casos propios (RF-17 a RF-22).
  - Alta de usuarios y restablecimiento de contraseñas protegido para administrador y usuarios_de_sistema (RF-28 a RF-30).
  - Seed de datos maestros al iniciar el servidor (RF-27).
  - Middlewares de autenticación, roles y propiedad de casos (RF-04 a RF-11).
- **Fuera de alcance** (sección Fuera de alcance de la spec): frontend, búsqueda, filtros, ordenación, paginación, exportación, notificaciones, reportes, históricos, eliminación de casos.
- No se toca el frontend ni archivos de `Seguimiento-proyectos/`.
- Todo el código nuevo vive en `backend/src/` siguiendo la arquitectura obligatoria de la constitución (`config/`, `controllers/`, `middlewares/`, `models/`, `routes/`, `utils/`); `app.js` solo configura Express, CORS y monta rutas; `server.js` solo inicializa, ejecuta el seed y escucha.

## 2. Archivos y responsabilidades

Todos los archivos son nuevos (`backend/` está vacío). Cada archivo nuevo requiere la aprobación del usuario antes de crearse.

### Configuración

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/package.json` | Dependencias del servidor: express, mysql2, jsonwebtoken, argon2, dotenv, cors. | Todos |
| `backend/.env` | Variables de entorno: puerto, credenciales de MariaDB, secreto JWT, tiempo de expiración del token, minutos de inactividad (30). | Todos |
| `backend/src/config/db.js` | Pool de conexiones a MariaDB; exporta `query(sql, params)` para ejecutar SQL. | RF-27, RF-12 a RF-16, RF-17 a RF-22 |
| `backend/src/config/constants.js` | Constantes del dominio: estados (`Pendiente`, `En proceso`, `Finalizado`), prioridades (`Alta`, `Media`, `Baja`), roles (`administrador`, `contador`, `usuarios_de_sistema`), longitud máxima de cliente (80), minutos de inactividad (30). | RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-25 |
| `backend/src/config/jwt.js` | Configuración de JWT: secreto, algoritmo y tiempo de expiración del token. | RF-01, RF-04, RF-05 |

### Modelos (consultas SQL)

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/src/models/UserModel.js` | Consultas SQL de usuarios: `findByUsername`, `create`, `findById`, `findAll` (contadores). | RF-01, RF-03, RF-27, RF-28, RF-29, RF-30 |
| `backend/src/models/CaseModel.js` | Consultas SQL de casos: `findById`, `findByCounter`, `countByStatus` (incluye ceros), `create`, `updateStatus`, `updatePriority`. | RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RF-22 |
| `backend/src/models/SessionModel.js` | Persistencia de sesiones activas y tokens revocados en BD: registrar sesión (jti, usuario_id, última actividad), tocar actividad, consultar sesión, revocar token (persistente, sobrevive reinicios). | RF-05, RF-25, RF-26, RF-31 |

### Controladores (lógica de negocio por endpoint)

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/src/controllers/AuthController.js` | `login`, `logout`: validación de credenciales, generación/verificación de token, revocación persistente de sesión, mensajes de error en español con tres partes. | RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-23, RF-24, RF-25, RF-26 |
| `backend/src/controllers/UserController.js` | `createUser`: alta de usuario protegida, validación de entrada, hash de contraseña con Argon2id. | RF-28, RF-29, RF-30, RF-23 |
| `backend/src/controllers/CounterController.js` | `listCounters`, `countCasesByStatus`, `getCasesByCounter`, `getMyCases`: lectura solo para administrador y casos propios del contador. | RF-12, RF-13, RF-14, RF-15, RF-16, RF-08, RF-09 |
| `backend/src/controllers/CaseController.js` | `createCase`, `updateCase`: registro de caso (estado Pendiente automático, contador asignado = autenticado) y cambio de estado/prioridad de casos propios. | RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-10, RF-16 |

### Middlewares

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/src/middlewares/authMiddleware.js` | Extrae token de `Authorization: Bearer <token>`, verifica JWT, comprueba caducidad (campo exp), revocación persistente e inactividad (30 min), actualiza última actividad en cada petición válida (RF-25), adjunta `req.user`. | RF-04, RF-05, RF-06, RF-07, RF-25 |
| `backend/src/middlewares/roleMiddleware.js` | `requireAdmin`, `requireAdminOrSistema`: comprueba el rol del usuario autenticado (solo consulta vs alta de usuarios y restablecimiento de contraseñas). | RF-08, RF-09, RF-28, RF-29 |
| `backend/src/middlewares/ownershipMiddleware.js` | `checkCaseOwnership`: verifica que el caso existe y pertenece al contador autenticado antes de permitir escritura. | RF-10, RF-11, RF-16 |
| `backend/src/middlewares/validationMiddleware.js` | Valida cuerpos de petición (campos requeridos, formato, longitud). | RF-02, RF-19, RF-20, RF-21, RF-30 |

### Utilidades (funciones puras, probables con `node --test`)

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/src/utils/passwordUtils.js` | `hashPassword(password)`, `verifyPassword(password, hash)` con Argon2id. | RNF-1, RF-03, RF-27, RF-28 |
| `backend/src/utils/tokenUtils.js` | `generateAccessToken(payload, secreto, expiresIn)`, `verifyAccessToken(token, secreto)`, `isTokenExpired(token, hoy)`. | RF-01, RF-04, RF-05, RF-25, RF-26 |
| `backend/src/utils/validationUtils.js` | `validateLoginInput(usuario, password)`, `validateNewCaseInput(cliente, prioridad)`, `validateStatus(estado)`, `validatePriority(prioridad)`. | RF-02, RF-19, RF-20, RF-21, RF-30 |
| `backend/src/utils/dateUtils.js` | `nowLocal()`, `formatLocalDate(fecha)` ('YYYY-MM-DD HH:mm:ss' hora local), `isSessionInactive(ultimaActividad, hoy, limiteMinutos)`. "Hoy" se inyecta como parámetro. | RNF-2, RF-25, RF-26 |
| `backend/src/utils/seed.js` | `seedDatabase()`: crea tablas si no existen e inserta datos maestros (al menos un administrador y al menos un contador, contraseñas hasheadas, credenciales desde `.env`); si ya existen, no hace nada. | RF-27 |
| `backend/src/utils/errorUtils.js` | `buildError(queOcurrio, sobreQue, queHacer)`: mensaje de error con las tres partes en español. | RF-23, RNF-5, RNF-6 |

### Punto de entrada y montaje

| Archivo | Responsabilidad | RF |
|---|---|---|
| `backend/src/app.js` | Configuración de Express, CORS, middlewares globales, montaje de rutas. Nada de lógica de negocio. | Todos |
| `backend/src/server.js` | Inicializa el servidor, ejecuta el seed, escucha en el puerto. Solo eso. | RF-27 |

### Rutas (una por módulo)

| Archivo | Rutas | RF |
|---|---|---|
| `backend/src/routes/authRoutes.js` | `POST /auth/login`, `POST /auth/logout` | RF-01 a RF-07, RF-25, RF-26 |
| `backend/src/routes/caseRoutes.js` | `POST /casos`, `PATCH /casos/:id`, `GET /casos/mis-casos` | RF-17 a RF-22, RF-10, RF-15, RF-16 |
| `backend/src/routes/counterRoutes.js` | `GET /contadores`, `GET /contadores/:id/conteos`, `GET /contadores/:id/casos` | RF-12 a RF-16, RF-08, RF-09 |
| `backend/src/routes/userRoutes.js` | `POST /usuarios` | RF-28 a RF-30 |

## 3. Funciones puras

Todas las funciones de `utils/` son sincronas, sin efectos secundarios y sin depender de Express ni de MariaDB. Las que trabajan con fechas reciben `hoy` (objeto `Date`) como parámetro para ser determinísticas en tests.

### `backend/src/utils/passwordUtils.js`

```js
hashPassword(password) -> string          // Argon2id, devuelve el hash
verifyPassword(password, hash) -> boolean // compara contraseña contra el hash
```

### `backend/src/utils/tokenUtils.js`

```js
generateAccessToken(payload, secreto, expiresIn) -> string  // JWT firmado con campo exp
verifyAccessToken(token, secreto) -> { valido, payload, error }  // decodifica y verifica firma y expiración
isTokenExpired(token, hoy) -> boolean  // true si el token ya expiró respecto a hoy
```

### `backend/src/utils/validationUtils.js`

```js
validateLoginInput(usuario, password) -> { valido, faltantes: string[] }
validateNewCaseInput(cliente, prioridad) -> { valido, error: 'cliente_requerido' | 'cliente_demasiado_largo' | 'prioridad_requerida' | 'prioridad_invalida' | null }
validateStatus(estado) -> boolean      // uno de: Pendiente, En proceso, Finalizado
validatePriority(prioridad) -> boolean // uno de: Alta, Media, Baja
```

### `backend/src/utils/dateUtils.js`

```js
nowLocal() -> Date                     // fecha y hora en zona local del servidor
formatLocalDate(fecha) -> string       // 'YYYY-MM-DD HH:mm:ss' en hora local
isSessionInactive(ultimaActividad, hoy, limiteMinutos) -> boolean
```

### `backend/src/utils/errorUtils.js`

```js
buildError(queOcurrio, sobreQue, queHacer) -> { mensaje: string }  // en español, tres partes
```

## 4. Algoritmo en pseudocódigo

### 4.1 Inicio de sesión (RF-01, RF-02, RF-03, RF-06)

```
POST /auth/login
  { usuario, password } = cuerpo
  { valido, faltantes } = validateLoginInput(usuario, password)
  si !valido:
      devolver 400 { mensaje: buildError("Faltan credenciales", "usuario y/o contraseña", "Ingrese usuario y contraseña") }  // RF-02
  cuenta = UserModel.findByUsername(usuario)  // distingue mayúsculas y minúsculas
  si cuenta es null o !verifyPassword(password, cuenta.password_hash):
      devolver 401 { mensaje: buildError("Credenciales no válidas", "usuario o contraseña", "Verifique sus datos e intente nuevamente") }  // RF-03 (genérico)
  token = generateAccessToken({ id: cuenta.id, usuario: cuenta.usuario, rol: cuenta.rol }, secretoJWT, expiracion)
  SessionModel.registrarSesion(token, cuenta.id, ahora)  // jti del token, usuario, ahora (hora local)
  devolver 200 { token, rol: cuenta.rol, usuario: cuenta.usuario }  // RF-01, RF-06
```

### 4.2 Cierre de sesión (RF-26, RF-31)

```
POST /auth/logout
  token = extraer de Authorization: Bearer <token>
  SessionModel.revocar(token)  // invalida el token de forma persistente en BD
  devolver 200 { mensaje: "Sesión cerrada correctamente" }
```

### 4.3 Middleware de autenticación (RF-04, RF-05, RF-06, RF-07, RF-25)

```
al recibir petición con cabecera Authorization:
  si no hay cabecera Authorization o no empieza con "Bearer ":
      devolver 401 { mensaje: buildError("No hay sesión activa", "autorización", "Inicie sesión para acceder a esta función") }  // RF-04, RF-07
  token = extraer después de "Bearer "
  sesion = SessionModel.obtenerSesion(token)
  si sesion es null o sesion.revocado:
      devolver 401 { mensaje: buildError("Sesión caducada", "token de acceso", "Inicie sesión de nuevo para recuperar el acceso") }  // RF-05
  { valido, payload, error } = verifyAccessToken(token, secretoJWT)
  si !valido:
      si error es "expirado": devolver 401 { mensaje: buildError("Sesión caducada", "token de acceso", "Inicie sesión de nuevo para recuperar el acceso") }  // RF-05
      devolver 401 { mensaje: buildError("Token no válido", "autorización", "Inicie sesión de nuevo") }  // RF-04
  si isSessionInactive(sesion.ultima_actividad, hoy, limiteInactividad):
      SessionModel.revocar(token)
      devolver 401 { mensaje: buildError("Sesión caducada por inactividad", "token de acceso", "Inicie sesión de nuevo para recuperar el acceso") }  // RF-05
  SessionModel.tocarActividad(token, ahora)  // RF-25: petición válida reinicia el temporizador
  req.user = { id: payload.id, usuario: payload.usuario, rol: payload.rol }
  continuar al siguiente middleware o controlador
```

### 4.4 Middleware de rol (RF-08, RF-09, RF-28, RF-29)

```
requireAdmin:
  si req.user.rol != 'administrador':
      devolver 403 { mensaje: buildError("Acceso denegado", "función de administrador", "Vuelva a la pantalla de su perfil de contador") }  // RF-08

requireAdminOrSistema (alta de usuarios y restablecimiento de contraseña):
  si req.user.rol no es 'administrador' ni 'usuarios_de_sistema':
      devolver 403 { mensaje: buildError("Acceso denegado", "alta de usuarios", "Solo administrador y usuarios_de_sistema pueden dar de alta usuarios") }  // RF-29
```

### 4.5 Middleware de propiedad de caso (RF-10, RF-11, RF-16)

```
checkCaseOwnership (para PATCH /casos/:id):
  caso = CaseModel.findById(id)
  si caso es null:
      devolver 404 { mensaje: buildError("No se encontró el caso", "caso solicitado", "Verifique el identificador del caso") }  // RF-16
  si caso.contador_id != req.user.id:
      devolver 403 { mensaje: buildError("Acceso denegado", "caso ajeno", "No puede modificar casos que no le pertenecen") }  // RF-10, RF-11
  continuar
```

### 4.6 Lectura de contadores y casos (RF-12, RF-13, RF-14, RF-15, RF-16)

```
GET /contadores (requiere administrador):
  contadores = UserModel.findAll({ rol: 'contador' })
  si contadores está vacío:
      devolver 200 { mensaje: "No hay contadores registrados", contadores: [] }  // RF-24
  devolver 200 { contadores }

GET /contadores/:id/conteos (requiere administrador):
  contador = UserModel.findById(id)
  si contador es null:
      devolver 404 { mensaje: buildError("No se encontró el contador", "contador solicitado", "Verifique el identificador del contador") }  // RF-16
  conteos = CaseModel.countByStatus(id)  // incluye ceros para cada estado
  devolver 200 { contador_id: id, pendiente: n, en_proceso: n, finalizado: n }

GET /contadores/:id/casos (requiere administrador):
  contador = UserModel.findById(id)
  si contador es null:
      devolver 404 { mensaje: buildError("No se encontró el contador", "contador solicitado", "Verifique el identificador del contador") }  // RF-16
  casos = CaseModel.findByCounter(id)
  si casos está vacío:
      devolver 200 { mensaje: "El contador no tiene casos registrados", casos: [] }  // RF-24
  devolver 200 { casos }

GET /casos/mis-casos (requiere contador):
  casos = CaseModel.findByCounter(req.user.id)
  si casos está vacío:
      devolver 200 { mensaje: "No tiene casos registrados aún", casos: [] }  // RF-24
  devolver 200 { casos }
```

### 4.7 Registro de caso (RF-17, RF-18, RF-19, RF-20, RF-21)

```
POST /casos (requiere contador)
  { cliente, prioridad } = cuerpo
  { valido, error } = validateNewCaseInput(cliente, prioridad)
  si !valido:
      devolver 400 { mensaje: buildError(...según error: cliente obligatorio, cliente demasiado largo (máximo 80), prioridad obligatoria o inválida...) }  // RF-19, RF-20, RF-21
  caso = CaseModel.create({
      contador_id: req.user.id,  // asigna al autenticado (RF-17)
      cliente: cliente.trim(),
      prioridad,
      estado: 'Pendiente',  // siempre Pendiente, no se elige (RF-18)
      creado_en: nowLocal(),
      actualizado_en: nowLocal()
  })
  devolver 201 { caso, mensaje: "Caso registrado correctamente" }
```

### 4.8 Cambio de estado y prioridad de caso propio (RF-22)

```
PATCH /casos/:id (requiere contador, checkCaseOwnership)
  { estado, prioridad } = cuerpo  // opcionales, al menos uno presente
  caso = CaseModel.findById(id)  // ya verificado que pertenece al usuario
  si estado se envía: validar que sea Pendiente/En proceso/Finalizado (sin restricción, incluso desde Finalizado)
  si prioridad se envía: validar que sea Alta/Media/Baja
  actualizar campos enviados y actualizado_en = nowLocal() (hora local); cliente no se modifica
  devolver 200 { caso, mensaje: "Caso actualizado correctamente" }  // RF-22
```

### 4.9 Alta de usuario protegida (RF-28, RF-29, RF-30)

```
POST /usuarios (requiere administrador o usuarios_de_sistema)
  { usuario, password, rol } = cuerpo
  validar: usuario no vacío, contraseña válida (mínimo 8 caracteres), rol en {administrador, contador, usuarios_de_sistema}  // RF-30
  si inválido: devolver 400 { mensaje: buildError("Datos inválidos", "usuario/contraseña/rol", "Corrija el dato indicado e intente nuevamente") }  // RF-30
  si ya existe un usuario con ese nombre: devolver 400 { mensaje: buildError("El usuario ya existe", "usuario", "Elija otro nombre de usuario") }  // RF-30
  hash = hashPassword(password)  // Argon2id (RNF-1)
  UserModel.create(usuario, hash, rol)
  devolver 201 { mensaje: "Usuario dado de alta correctamente" }  // RF-28
```

### 4.10 Seed de datos maestros (RF-27)

```
al iniciar el servidor (server.js):
  seedDatabase():
      crear tabla usuarios si no existe: id, usuario, password_hash, rol, creado_en
      crear tabla casos si no existe: id, contador_id, cliente, estado, prioridad, creado_en, actualizado_en
      crear tabla sesiones si no existe: jti, usuario_id, ultima_actividad, revocado, creado_en
      insertar administrador con contraseña hasheada (si no existe ya un administrador)
      insertar al menos un contador con contraseña hasheada (si no existe ya un contador)
      si los usuarios ya existen, no hace nada (no sobrescribe ni falla)
```

## 5. Decisiones y alternativas descartadas

1. **MariaDB con `mysql2`** como motor de base de datos.
   Alternativa descartada: MSSQL o MySQL. Se usa MariaDB por ahora porque así lo establece `AGENTS.md` ("por ahora se usará MariaDB en un servidor local"). La decisión puede revisarse más adelante.

2. **Argon2id para hash de contraseñas** (obligatorio por la constitución, Principio 5).
   Alternativa descartada: bcrypt, script o SHA-256. Se descarta porque la constitución exige Argon2id como estándar obligatorio.

3. **JWT Bearer en cabecera `Authorization`** como token de acceso.
   Alternativa descartada: sesiones en cookie o tokens en el cuerpo de la petición. Se descarta porque la spec (decisiones tomadas) establece explícitamente JWT Bearer en `Authorization`.

4. **Persistencia de sesiones y tokens revocados en tabla de base de datos (`sesiones`)**.
   Alternativa descartada: lista negra de revocación solo en memoria. Se descarta porque la spec (decisión tomada) exige que el cierre voluntario invalide el token de forma persistente y que las peticiones sean rechazadas incluso tras reiniciar el servidor (RF-26, RF-31, RNF-4); una lista en memoria se perdería al reiniciar.

5. **Funciones puras con `hoy` como parámetro** en `dateUtils.js` y `tokenUtils.js`.
   Alternativa descartada: usar `new Date()` directamente dentro de las funciones. Se descarta porque dificultaría los tests con `node --test` (no serían determinísticas); inyectar `hoy` permite probar fechas simuladas.

6. **Mensajes de error con tres partes en español**: "qué ocurrió", "sobre qué dato o acción", "qué hacer".
   Alternativa descartada: mensajes técnicos en inglés o mensajes de una sola parte. Se descarta porque `RF-23` y `RNF-6` lo exigen explícitamente.

7. **Seed automático al iniciar el servidor** para crear datos maestros.
   Alternativa descartada: script de migración separado o creación manual de la primera cuenta. Se descarta porque la spec (decisiones tomadas) establece el seed al iniciar/configurar la base de datos, y `RF-27` lo exige.

8. **Un archivo de rutas por módulo** (`authRoutes.js`, `caseRoutes.js`, `counterRoutes.js`, `userRoutes.js`).
   Alternativa descartada: un único archivo `routes.js` con todas las rutas. Se descarta porque la spec (decisiones tomadas) establece un archivo por módulo.

9. **CORS declarado y aplicado en el backend** (orígenes permitidos definidos en la implementación). *(Parcialmente sustituida por el Cambio 1, sección 8: los orígenes quedan restringidos a los locales de desarrollo.)*
   Alternativa descartada: no aplicar CORS. Se descarta porque la spec declara que el backend configura y aplica CORS.

## 6. Estrategia de tests con `node --test`

- Ejecutarse desde `backend/`: `node --test`
- Sin instalar paquetes adicionales para tests (constitución, Principio 2).
- Archivos de test en `backend/test/`:
  - `test/passwordUtils.test.js`: Argon2id hash y comparación (RNF-1, RF-03).
  - `test/tokenUtils.test.js`: generación, verificación, expiración con `hoy` inyectado (RF-01, RF-04, RF-05, RF-25).
  - `test/validationUtils.test.js`: login, registro de caso, estados y prioridades (RF-02, RF-19, RF-20, RF-21, RF-30).
  - `test/dateUtils.test.js`: hora local, inactividad de sesión con `hoy` (RNF-2, RF-25, RF-26).
  - `test/errorUtils.test.js`: mensajes con tres partes (RF-23, RNF-5, RNF-6).
- Tests de integración (requieren MariaDB en ejecución):
  - `test/authRoutes.test.js`: login, logout, credenciales inválidas (RF-01 a RF-07).
  - `test/caseRoutes.test.js`: registro, cambio de estado/prioridad, propiedad (RF-17 a RF-22, RF-10).
  - `test/counterRoutes.test.js`: listado, conteos, detalle (RF-12 a RF-16).
  - `test/userRoutes.test.js`: alta de usuario protegida (RF-28 a RF-30).
- **Puerta de calidad:** ninguna tarea se da por hecha con tests en rojo (constitución, Principio 2). Antes de cerrar la spec, `node --test` debe pasar en verde sin tests fallando, cubriendo los 25 criterios de finalización de la spec.

## 7. Trazabilidad RF → parte del plan

| RF | Parte del plan |
|---|---|
| RF-01 | 4.1 login, `AuthController.login`, `tokenUtils.generateAccessToken` |
| RF-02 | 4.1 login, `validationUtils.validateLoginInput` |
| RF-03 | 4.1 login, mensaje genérico sin revelar datos |
| RF-04 | 4.3 middleware auth, token ausente o inválido |
| RF-05 | 4.3 middleware auth, token expirado o revocado, inactividad |
| RF-06 | 4.1 login, el rol viene de la cuenta, no se elige manualmente |
| RF-07 | 4.3 middleware auth, sin sesión no se devuelve información |
| RF-08 | 4.4 `requireAdmin`, contador intenta función de administrador |
| RF-09 | 4.4 `requireAdmin`, administrador intenta escribir casos; también `requireAdminOrSistema` rechaza al contador |
| RF-10 | 4.5 `checkCaseOwnership`, caso ajeno |
| RF-11 | 4.5 `checkCaseOwnership`, contador no ve información de otro perfil |
| RF-12 | 4.6 `CounterController.listCounters` |
| RF-13 | 4.6 `CaseModel.countByStatus`, incluye ceros |
| RF-14 | 4.6 `CounterController.getCasesByCounter` |
| RF-15 | 4.6 `CaseModel.findByCounter(req.user.id)` |
| RF-16 | 4.6, 4.5, 404 cuando no existe contador o caso |
| RF-17 | 4.7 `CaseController.createCase`, contador autenticado asignado |
| RF-18 | 4.7, estado Pendiente automático, no se elige |
| RF-19 | 4.7, cliente faltante o vacío |
| RF-20 | 4.7, prioridad faltante o inválida |
| RF-21 | 4.7, cliente > 80 caracteres |
| RF-22 | 4.8, cambio de estado/prioridad de caso propio |
| RF-23 | `errorUtils.buildError`, todas las respuestas de error |
| RF-24 | 4.6, mensaje de vacío cuando no hay casos |
| RF-25 | 4.3, actualizar última actividad en cada petición válida |
| RF-26 | 4.2 logout, `SessionModel.revocar` persistente en BD |
| RF-27 | 4.10, `seedDatabase`, tablas y cuentas iniciales hasheadas |
| RF-28 | 4.9, `UserController.createUser`, alta exitosa |
| RF-29 | 4.4 `requireAdminOrSistema`, contador recibe acceso denegado |
| RF-30 | 4.9, `validationUtils`, datos inválidos de alta |
| RNF-1 | `passwordUtils.hashPassword`, Argon2id |
| RNF-2 | `dateUtils.nowLocal`, `dateUtils.formatLocalDate` |
| RNF-3 | Compatibilidad hacia atrás con datos existentes |
| RNF-4 | RF-25 + RF-26, sesión activa no se pierde mientras se usa |
| RNF-5 | Todos los mensajes en español |
| RNF-6 | `errorUtils.buildError`, tres partes en cada error |

---

## 8. Cambio 1 — protección de datos, CORS e ids

Spec: cambio aprobado sobre RF-12, RF-14, RF-16 (modificados), RF-32 a RF-35 y RNF-7 (nuevos), criterios 1 y 24 (modificados) y 26 a 29 (nuevos). Todo lo anterior (secciones 1 a 7) queda como está: este cambio solo añade. Todo se hace dentro de `backend/`; no se toca `Seguimiento-proyectos/`.

### 8.1 Estado real del código que motiva el cambio (contrastado con `backend/src/`)

- `UserModel.findAll` y `UserModel.findById` hacen `SELECT *` sobre `usuarios`, así que devuelven `password_hash`. `CounterController.listCounters` devuelve esas filas tal cual en `GET /contadores`: fuga de datos de acceso.
- `AuthController.login` responde `{ token, rol, usuario }`: falta `id` (RF-01 y criterio 1 lo exigen).
- `CounterController.countCasesByStatus` y `getCasesByCounter` usan `UserModel.findById`, que no filtra por rol: un id de administrador o de usuarios_de_sistema pasa como "contador".
- `app.js` usa `app.use(cors())` sin opciones: acepta cualquier origen.
- Las demás respuestas (`logout`, `POST /usuarios`, casos, conteos, errores 404/500) no contienen datos de acceso (revisado leyendo controladores y modelos; los casos solo traen `id, contador_id, cliente, estado, prioridad, creado_en, actualizado_en`).

### 8.2 Archivos y responsabilidades

Archivos nuevos (su creación queda aprobada al aprobar este plan y las tareas T21-T28):

| Archivo | Responsabilidad | RF / criterio |
|---|---|---|
| `backend/src/utils/originUtils.js` | Funciones puras: `parseAllowedOrigins(valorEnv)` y `isOriginAllowed(origen, permitidos)`. | RF-34, criterios 24, 28 |
| `backend/src/middlewares/originMiddleware.js` | `createOriginGuard(permitidos)`: rechaza con 403 las peticiones con origen no permitido. `buildCorsOptions(permitidos)`: opciones para el paquete `cors`. | RF-34, RF-23, criterios 24, 28 |
| `backend/test/originUtils.test.js` | Pruebas unitarias de las funciones puras de origen (con `node:test` real). | RF-34 |
| `backend/test/originMiddleware.test.js` | Pruebas del guard con `req`/`res` simulados. | RF-34 |
| `backend/test/appCors.test.js` | Integración con la app real (`crearApp`): origen permitido, no permitido, sin origen, preflight. | RF-34, criterio 28 |
| `backend/test/respuestasApi.test.js` | Integración: `id` en el login, lista de contadores con solo `id` y `usuario`, barrido de todas las respuestas (éxito y error) sin `password_hash` ni `$argon2`. | RF-32, RF-33, RNF-7, RF-01, criterios 1, 26, 27 |
| `backend/test/idsContador.test.js` | Integración: conteos y casos de un id inexistente, de administrador, de usuarios_de_sistema y no numérico devuelven 404. | RF-35, RF-14, RF-16, criterio 29 |

Archivos existentes que se modifican (⚠️ requieren aprobación explícita; hoy funcionan):

| Archivo | Qué cambia | RF |
|---|---|---|
| `backend/src/models/UserModel.js` | Se **añaden** `findCountersPublic()` (`SELECT id, usuario FROM usuarios WHERE rol = 'contador' ORDER BY id`) y `findCounterById(id)` (`SELECT id, usuario FROM usuarios WHERE id = ? AND rol = 'contador'`). `findByUsername`, `findById`, `findAll` y `create` **no se tocan**. | RF-32, RF-35, RNF-7 |
| `backend/src/controllers/CounterController.js` | `listCounters` usa `findCountersPublic`. `countCasesByStatus` y `getCasesByCounter` usan `findCounterById` (más la validación de id de 8.3) en lugar de `findById`. Mismos mensajes y códigos de siempre. `getMyCases` no cambia. | RF-12, RF-14, RF-16, RF-32, RF-35 |
| `backend/src/controllers/AuthController.js` | `login` añade `id: cuenta.id` a la respuesta 200. Nada más. | RF-01, criterio 1 |
| `backend/src/utils/validationUtils.js` | Se **añade** `parseCounterId(valor)` (pura). Las demás funciones no se tocan. | RF-35 |
| `backend/src/app.js` | `crearApp(opciones)` acepta `opciones.origenesPermitidos` (opcional, para tests); si no se pasa, lee `CORS_ORIGENES` del entorno. Sustituye `cors()` por `createOriginGuard(...)` seguido de `cors(buildCorsOptions(...))`, ambos antes de `express.json()` y de las rutas. Se corrige el comentario que citaba RF-24. | RF-34 |
| `backend/.env` | Se añade la línea `CORS_ORIGENES=...` (sin credenciales). | RF-34 |

### 8.3 Funciones puras (ninguna recibe `hoy`: ninguna trabaja con fechas)

```js
// backend/src/utils/originUtils.js
parseAllowedOrigins(valorEnv) -> string[]
  // texto separado por comas -> lista; recorta espacios, quita barra final y vacíos.
  // si valorEnv es undefined o vacío -> orígenes por defecto de desarrollo (8.4)
isOriginAllowed(origen, permitidos) -> boolean
  // comparación exacta (distingue mayúsculas); 'null', '' o undefined -> false

// backend/src/utils/validationUtils.js (añadida)
parseCounterId(valor) -> number | null
  // devuelve el entero positivo si valor es solo dígitos ('12' -> 12); si no ('abc', '2abc', '-1', '1.5', '') -> null
```

### 8.4 Orígenes permitidos (RF-34) — valor real de desarrollo

- El frontend es Quasar (`@quasar/app-vite`) y `Seguimiento-proyectos/quasar.config.js` no fija puerto de desarrollo (`devServer: { open: true }`); Quasar usa por defecto el puerto **9000** y abre `http://localhost:9000`. No existe `.env` en el frontend.
- Lista por defecto (en código, si falta la variable): `http://localhost:9000` y `http://127.0.0.1:9000`.
- Variable `CORS_ORIGENES` en `backend/.env`, separada por comas, con ese mismo valor por defecto. Si Quasar usa otro puerto por estar el 9000 ocupado, se añade ese origen aquí; no se acepta "cualquier puerto local" porque la spec define como rechazado "otro puerto local no autorizado".
- Quedan rechazados: cualquier otro sitio, la aplicación de escritorio (su origen `null`/`file://`) y puertos locales no listados.

### 8.5 Pseudocódigo

```
app.js → crearApp(opciones):
  permitidos = opciones.origenesPermitidos ?? parseAllowedOrigins(process.env.CORS_ORIGENES)
  app.use(createOriginGuard(permitidos))        // 1.º: rechaza antes de cualquier otra cosa
  app.use(cors(buildCorsOptions(permitidos)))   // 2.º: solo añade cabeceras CORS a orígenes permitidos
  app.use(express.json()) ; montar rutas ; 404 ; 500   // igual que hoy

createOriginGuard(permitidos) → (req, res, next):
  origen = req.headers.origin
  si no hay origen: next()                      // RF-34: curl, scripts, node --test se aceptan (el token sigue exigiéndose, RF-04)
  si isOriginAllowed(origen, permitidos): next()
  si no: 403 buildError("Origen no permitido", "origen de la petición", "Use la aplicación web de desarrollo autorizada para acceder al servicio")
         // sin cabeceras CORS: el navegador no deja leer la respuesta

buildCorsOptions(permitidos) → { origin: (origen, cb) => cb(null, !origen || isOriginAllowed(origen, permitidos)) }
  // sin origen: sin cabeceras CORS (no hacen falta); permitido: refleja el origen

GET /contadores (admin):
  contadores = UserModel.findCountersPublic()   // solo id y usuario; el hash nunca sale de la base de datos
  mismo vacío/200 que hoy

GET /contadores/:id/conteos y /:id/casos (admin):
  idNumerico = parseCounterId(req.params.id)
  contador = idNumerico ? UserModel.findCounterById(idNumerico) : null
  si !contador: 404 buildError("No se encontró el contador", "contador solicitado", "Verifique el identificador del contador")  // mismo texto de hoy
  resto igual que hoy

POST /auth/login:
  ... igual ... responder 200 { token, rol: cuenta.rol, id: cuenta.id, usuario: cuenta.usuario }
```

### 8.6 Decisiones y alternativas descartadas

1. **El filtrado de campos se hace en la consulta SQL (columnas explícitas) en funciones nuevas del modelo.**
   Alternativa descartada: mapear `{id, usuario}` en el controlador. Con ese mapeo el hash viaja hasta el controlador y cualquier endpoint futuro que olvide mapear lo filtraría; con columnas explícitas el hash no sale de la base de datos para esos casos. Además la prueba de barrido (punto 8.7) vigila el resultado final.
2. **Funciones nuevas en el modelo (`findCountersPublic`, `findCounterById`) en lugar de cambiar `findAll`/`findById`.**
   Alternativa descartada: modificar `findAll`/`findById` para filtrar columnas o rol. `findById` y `findAll` ya tienen pruebas y quizá usos futuros que necesitan la fila completa (`findByUsername` la necesita para el login). Modificarlas rompería funciones que ya funcionan, algo que `AGENTS.md` prohíbe sin preguntar. Quedan sin uso en los controladores: se dejan, sin tocar.
3. **RF-35 se resuelve con una consulta `WHERE id = ? AND rol = 'contador'`.**
   Alternativa descartada: comprobar `contador.rol !== 'contador'` en el controlador tras `findById`: duplica la regla en dos controladores y trae el hash a memoria sin necesidad.
4. **El id se valida con `parseCounterId` antes de consultar.**
   Alternativa descartada: pasar `req.params.id` directo al SQL. MariaDB convierte `'2abc'` en `2` al comparar con una columna entera y devolvería los datos del contador 2 para un id que no corresponde a ninguno. Si el usuario no quiere esta función extra, se elimina sin afectar al resto (T27/T28).
5. **Los orígenes permitidos son una lista exacta en `CORS_ORIGENES`, con valores por defecto de desarrollo en el código.**
   Alternativa descartada: patrón que acepte cualquier puerto de `localhost` (contradice el caso límite de la spec: "otro puerto local no autorizado" se rechaza) o lista fija solo en código (obliga a editar código para cambiar de puerto).
6. **Origen no permitido: respuesta 403 explícita (con mensaje de tres partes) además de no enviar cabeceras CORS.**
   Alternativa descartada: dejar que `cors` solo omita las cabeceras (la petición se procesaría igual en el servidor y no habría nada verificable con `node --test`; RF-34 pide "rechaza"). El guard va antes que `cors` y que las rutas.
7. **Peticiones sin cabecera `Origin` se aceptan** (decisión del usuario, RF-34): herramientas, scripts y pruebas; el token sigue siendo el control de acceso.
   Alternativa descartada: rechazarlas (rompería `node --test` y las pruebas manuales).
8. **Pruebas nuevas con `node:test` real (`test()`/`describe()`), siguiendo las convenciones de la sección 9 (Cambio 2).** El Cambio 2 se ejecuta antes que este cambio (T11-T20 primero, T21-T29 después), así que las pruebas nuevas se apoyan en los apoyos de `backend/soporte-pruebas/` y en las reglas de aislamiento de datos de 9.3.

### 8.7 Estrategia de tests (`node --test` desde `backend/`)

- Orden por cada parte: tests nuevos **en rojo** → implementación → `node --test <archivos>` en verde → marcar la tarea y parar.
- **Contexto:** el hallazgo de que los 15 archivos de `backend/test/` no ejecutaban nada se resuelve en el Cambio 2 (sección 9), que se ejecuta **antes** que este cambio. Al llegar a T21, las pruebas existentes ya son reales y están en verde, y las pruebas nuevas de este cambio siguen las mismas convenciones (`node:test`, apoyos de `backend/soporte-pruebas/`, datos propios con prefijo `zz_test_` y limpieza).
- Tras el Cambio 2, los tests existentes que este cambio podría afectar siguen en verde: ninguno depende de `password_hash`; los de contadores usan solo `id` y el texto "No se encontró el contador", que se conserva; los de login comprueban `token`, `rol` y `usuario` (el `id` extra no los rompe); los del modelo de usuarios prueban `findAll`/`findById`, que no se modifican.
- Integración con MariaDB real (la de `.env`); las pruebas nuevas crean sus propios usuarios y casos (9.3), no dependen de `admin_seed`/`contador_seed`. Las de origen, de `parseCounterId` y del guard son puras o con simulación y no necesitan base de datos.
- Prueba de barrido (RF-33, RNF-7): con la app real, iniciar sesión como administrador, contador y usuarios_de_sistema (este último se crea con `POST /usuarios` y nombre único), llamar a todos los endpoints en éxito y en error (400, 401, 403, 404) y comprobar que el texto de cada respuesta no contiene `password_hash` ni `$argon2`.
- `mock_exp.test.js` (experimento que fallaba siempre) se elimina en T11 por decisión del usuario.

| Parte | RF / criterio |
|---|---|
| `originUtils` + `originMiddleware` + cableado en `app.js` + `.env` | RF-34, criterios 24, 28 |
| `UserModel.findCountersPublic` + `listCounters` | RF-12, RF-32, criterio 26 |
| Barrido de respuestas | RF-33, RNF-7, criterio 27 |
| `login` con `id` | RF-01, criterio 1 |
| `findCounterById` + `parseCounterId` + controladores de conteos y casos | RF-35, RF-14, RF-16, criterio 29 |
| Cierre: `node --test` completo | criterios 1, 24 a 29 |

---

## 9. Cambio 2 — reparación de las pruebas y eliminación de la puerta trasera de tokens

Spec: Cambio 2 aprobado (criterio 25 reescrito, criterio 30 nuevo, refuerzo de RF-04 y RF-07; sin RF nuevos). Se ejecuta **antes** que el Cambio 1, para que este se construya sobre pruebas que de verdad se ejecutan. Orden de IDs: Cambio 2 = T11-T20; Cambio 1 = T21-T29 (el Cambio 1 pasa de 10 tareas a 9 porque su tarea "resolver `mock_exp`" se absorbe en T11). El cupo de 10 tareas se cuenta por bloque. Todo dentro de `backend/`; no se toca `Seguimiento-proyectos/`.

### 9.1 Estado real verificado (leyendo el código y ejecutando `node --test`)

- Los 15 archivos de `backend/test/` definen funciones `testXxx` y las exportan con `module.exports`; ninguno las registra con `node:test`. `node --test` los carga y el ejecutor crea por cada archivo vacío **una entrada "prueba" cuyo nombre es la ruta del archivo** (comprobado con la API `run()` de `node:test`): por eso aparecen como "pasados" sin ejecutar ninguna comprobación. La única prueba real era `mock_exp.test.js`, que falla siempre. Son 87 funciones `testXxx` sin ejecutar.
- `node --test` sin argumentos ejecuta como archivo de prueba **cualquier `.js` dentro de una carpeta llamada `test/`** (comprobado). Por eso los apoyos de pruebas no pueden vivir en `backend/test/`: se ejecutarían y aparecerían como archivos sin pruebas. Los apoyos van en una carpeta nueva `backend/soporte-pruebas/`, que `node --test` no recorre.
- La base de datos no estaba levantada al revisar (`ECONNREFUSED 127.0.0.1:3306`). **Prerrequisito de toda tarea que use la base de datos: MariaDB en marcha (XAMPP, puerto 3306).** Si no responde, la tarea se detiene y avisa al usuario; no se da nada por verificado ni se marca como hecha.
- **Defecto en `create` de los modelos (descubierto al ejecutar el humo de T13; detalle y arreglo en 9.9):** `db.js` hace `const [rows] = await pool.query(...)` y devuelve solo `rows`; para un `INSERT` ese primer elemento es un `ResultSetHeader` (objeto con `insertId`), no una lista. `UserModel.js:25` y `CaseModel.js:65` hacen `const [result] = await query(...)` e intentan desestructurar ese objeto, y lanzan `TypeError: ... is not iterable` **después** de que el `INSERT` ya se ejecutó. Efecto: `POST /usuarios` (RF-28) y `POST /casos` (RF-17, RF-18) responden 500 dejando la fila creada, con riesgo de duplicados al reintentar. Son las dos únicas ocurrencias del patrón `const [x] = await query(` en `backend/src/` (comprobado con búsqueda); `db.js` es correcto para los `SELECT` y `seed.js` no está afectado (RF-27 no se ve afectado). No se había detectado porque las pruebas no se ejecutaban.
- **Puerta trasera confirmada en `SessionModel.js`:** `TOKENS_PRUEBA` define `token_valido_xyz`, `token_revocado_xyz` y `token_inactivo_xyz`, y `obtenerSesion` los devuelve cuando la tabla no tiene esa fila. En `authMiddleware.js`, un valor que no es un JWT válido cae en una rama que reconstruye `req.user` desde esa sesión alternativa: con `Authorization: Bearer token_valido_xyz` se obtiene acceso como contador con `id` 1 (que en una base recién sembrada es `admin_seed`) sin haber iniciado sesión. Incumple RF-04 y RF-07.
- **Secreto JWT con dos valores por defecto:** `AuthController` usa `delgrow_secret_cambiar_en_produccion` y `authMiddleware` usa `delgrow_secreto_desarrollo` si falta `JWT_SECRET`; el `.env` define un tercer valor. Hoy funciona porque `dotenv` carga el `.env` al ser requerido desde `backend/`, y si no lo cargara (por ejemplo ejecutando desde otra carpeta) la puerta trasera ocultaría el desajuste. Al quitar la puerta trasera, ese desajuste dejaría sin acceso a todos los endpoints: hay que unificarlo en el mismo bloque (9.6).

### 9.2 Inventario de las 15 suites existentes y cómo se rehacen

"Unitaria" = no necesita MariaDB. "Integración" = necesita MariaDB real. N = funciones `testXxx` que exporta hoy (= pruebas que ejecutará cada archivo tras la conversión, salvo las nuevas de T17).

| Archivo | N | Tipo | Qué hay que cambiar | Tarea |
|---|---|---|---|---|
| `dateUtils.test.js` | 4 | Unitaria | Solo registrar (`nowLocal`, `formatLocalDate`, `isSessionInactive` ×2). | T12 |
| `errorUtils.test.js` | 2 | Unitaria | Solo registrar. | T12 |
| `passwordUtils.test.js` | 4 | Unitaria (asíncrona, Argon2id) | Solo registrar. | T12 |
| `tokenUtils.test.js` | 5 | Unitaria | Solo registrar. | T12 |
| `validationUtils.test.js` | 16 | Unitaria | Solo registrar. | T12 |
| `roleMiddleware.test.js` | 8 | Unitaria (`req`/`res` simulados) | Solo registrar. | T12 |
| `userModel.test.js` | 7 | Integración | Hoy crea `usuario_create_t5`/`usuario_findid_t5` con nombre fijo y hash falso: la segunda ejecución falla por usuario duplicado. Pasar a nombres únicos con prefijo `zz_test_`, `after` que borra lo creado y `before` que prepara la base. `testCreateInsertaUsuarioYDevuelveId` ya afirma que `create` devuelve un número y que el registro existe: cubre la corrección de 9.9. | T14 |
| `caseModel.test.js` | 8 | Integración | Hoy usa `contador_id` 1 a 5 y 99998 (fijos): sin esos usuarios falla la clave foránea y `countByStatus(2)` depende de datos previos. Crear contadores propios y comprobar cantidades exactas sobre ellos. `testCreateCreaCasoConEstadoPendiente` añade la afirmación de que `create` devuelve un número (9.9). | T14 |
| `seed.test.js` | 3 | Integración | Hoy cuenta administradores y contadores de toda la tabla y toma "el primer contador", que puede ser un usuario de otra prueba con hash falso (inestable en paralelo). Comprobar solo las cuentas del seed (`admin_seed`, `contador_seed`): existe una de cada, hash `$argon2id$`, y dos ejecuciones no las duplican. | T14 |
| `authRoutes.test.js` | 4 | Integración (HTTP) | Hoy depende de `contador_seed`. Crear un contador propio. `testLogoutRevocado` solo comprueba el mensaje: añadir que el mismo token recibe 401 tras cerrar sesión (RF-26, criterio 7). | T15 |
| `userRoutes.test.js` | 3 | Integración (HTTP) | Hoy da de alta `nuevo_usuario_t9` con nombre fijo (falla en la segunda ejecución). Usar un administrador propio y nombres únicos, y borrar lo creado. `testAltaUsuarioComoAdmin` afirma además que, tras el 201, existe una sola fila con ese nombre (9.9). | T15 |
| `caseRoutes.test.js` | 7 | Integración (HTTP) | Hoy depende de `contador_seed`/`admin_seed` y deja casos sin limpiar. Contadores propios; en `testCambiarCasoAjenoEsDenegado` el caso ajeno lo intenta cambiar un **segundo contador** (RF-10) y, además, un administrador (RF-09): son dos comprobaciones dentro de la misma prueba y el mínimo del archivo sigue siendo 7 (9.5, punto 5). `testRegistrarCasoValido` afirma además que, tras el 201, el `id` del caso es numérico y el contador tiene exactamente un caso (9.9). | T16 |
| `counterRoutes.test.js` | 5 | Integración (HTTP) | Hoy depende del seed y usa `contadores[0]`. Crear contadores y casos propios y comprobar conteos exactos; el id inexistente se calcula como el máximo existente más un margen en vez de un número fijo. | T16 |
| `authMiddleware.test.js` | 7 (+6 nuevas en T17) | Integración (middleware con tabla `sesiones` real) | **Depende de la puerta trasera:** `testRechazaTokenRevocado`, `testRechazaTokenExpirado`, `testRechazaSesionInactiva` y `testTokenValidoAdjuntaReqUserYLlamaNext` usan los tokens fijos de `TOKENS_PRUEBA` (y `req.user.usuario === 'contador1'`, que no existe en la base). `testRechazaTokenExpirado` hoy pasa por la razón equivocada: el valor no es un JWT y recibe "Token no válido", no "Sesión caducada". Se rehacen con tokens emitidos por el login (9.3 y 9.6) y, para token revocado o sin sesión, esperan el aviso «Sesión caducada». | T17 |
| `ownershipMiddleware.test.js` | 4 | Integración (`CaseModel` real) | Hoy usa casos 10 y 20 y afirma "el caso 20 pertenece al contador 2": datos que nadie crea. Crear dos contadores y sus casos propios; el caso inexistente se obtiene creando y borrando un caso. | T17 |
| `mock_exp.test.js` | 0 | (experimento) | Se elimina. | T11 |

Total tras el Cambio 2: **93 pruebas en 15 archivos** (87 existentes convertidas + 6 nuevas de autenticación en T17).

### 9.3 Estrategia de conversión

**Registro con `node:test`.** En cada archivo: `const { describe, test, before, after } = require('node:test');` y, en lugar de `module.exports`, un `describe('<módulo>', () => { test('<descripción>', testXxx); ... })`. Se conservan los cuerpos y los comentarios RF de cada `testXxx`; solo cambian los que necesitan datos propios (tabla 9.2). Los comentarios siguen en español. Sin paquetes nuevos.

**Apoyos nuevos en `backend/soporte-pruebas/` (fuera de `test/`).** Archivos nuevos aprobados por el usuario: `bd.js`, `http.js` y `verificarPruebas.js` (y `backend/src/config/jwt.js`, 9.6).

**Base de datos de las pruebas (decisión del usuario).** Las pruebas de integración usan la misma base `delgrow_contadores` que el desarrollo, con datos propios de prefijo `zz_test_` que cada archivo borra al terminar. No se modifica `backend/src/config/db.js` ni se crea una base aparte. Requiere MariaDB en marcha (XAMPP, puerto 3306).

| Archivo | Responsabilidad |
|---|---|
| `backend/soporte-pruebas/bd.js` | API exacta, todas asíncronas salvo `registrarUsuarioCreado`: `prepararBaseDeDatos(): Promise<void>` (ejecuta `seedDatabase()` entre `GET_LOCK('delgrow_pruebas_seed', 30)` y `RELEASE_LOCK(...)` sobre una conexión propia obtenida con `pool.getConnection()`, para que dos archivos en paralelo no inserten a la vez las cuentas del seed y choquen con la restricción de usuario único); `crearUsuarioDePrueba(rol): Promise<{ id, usuario, password }>` (nombre `zz_test_<rol>_<8 caracteres hexadecimales aleatorios>`, por ejemplo `zz_test_contador_9f3a1c7e`, con `crypto.randomBytes(4)`; contraseña fija `PruebaClave123`; hash real con `hashPassword`; se inserta con `UserModel.create` y el id se guarda en la memoria del proceso); `registrarUsuarioCreado(nombreUsuario): void` (para usuarios dados de alta por la API dentro de una prueba: guarda el nombre exacto, que la limpieza resuelve a id con `UserModel.findByUsername`); `crearCasoDePrueba(contadorId, { cliente = 'Cliente de prueba', estado = 'Pendiente', prioridad = 'Media' } = {}): Promise<number>` (devuelve el id del caso y lo guarda en la memoria del proceso); `envejecerSesion(token, minutos): Promise<void>` (resta `minutos` a `ultima_actividad` de esa sesión, solo para probar la inactividad); `limpiarDatosDePrueba(): Promise<void>` (borra, en este orden: `casos` cuyo id esté registrado **o** cuyo `contador_id` sea un usuario registrado, `sesiones` de los usuarios registrados y `usuarios` registrados; después vacía sus listas; nunca borra por prefijo); `cerrarBaseDeDatos(): Promise<void>` (`pool.end()` del pool de ese proceso). |
| `backend/soporte-pruebas/http.js` | `iniciarServidor(app = crearApp()): Promise<{ servidor, puerto, cerrar }>` (escucha en el puerto 0; `cerrar(): Promise<void>` cierra el servidor y también las conexiones abiertas); `peticion(puerto, metodo, ruta, cuerpo, token, cabeceras): Promise<{ statusCode, body, headers }>` (con el módulo nativo `http`; `body` ya interpretado como JSON si es posible); `iniciarSesion(puerto, usuario, password): Promise<string>` (login real por `POST /auth/login`, falla si no responde 200, devuelve el token). |
| `backend/soporte-pruebas/verificarPruebas.js` | Comprobación objetiva del criterio 25 (9.5). **T11 crea la carpeta `backend/soporte-pruebas/`.** |

**Aislamiento de datos (todas las pruebas de integración).**
- Cada archivo crea sus propios usuarios y casos con prefijo `zz_test_`, no depende de `admin_seed`/`contador_seed` ni de ids fijos ni de lo que haya en la base, y sus aserciones de cantidad son exactas **sobre sus propios datos**.
- `before` llama a `prepararBaseDeDatos()`; `after` llama a `limpiarDatosDePrueba()` y luego a `cerrarBaseDeDatos()`.
- Ningún archivo borra datos por prefijo general (borraría los de otro archivo que corre a la vez): cada uno borra solo lo que su propio proceso registró (ver "Procesos y aislamiento"). Si una ejecución se corta a mitad, pueden quedar filas `zz_test_%`; el cierre del bloque (T20) las busca con una consulta y se informa al usuario.

**Procesos y aislamiento entre archivos.** `node --test` y `run()` ejecutan **cada archivo de prueba en un proceso de Node aparte** (comprobado en la versión instalada: dos archivos que imprimen su `process.pid` y un contador de módulo muestran procesos distintos y estado independiente). Consecuencias:
1. Cada archivo tiene su propia copia de `db.js` y, por tanto, **su propio pool** de `mysql2` (hasta 10 conexiones por archivo; con 15 a 20 archivos en paralelo queda por debajo del límite habitual de 151 conexiones de MariaDB). `cerrarBaseDeDatos()` cierra solo el pool de su proceso.
2. `bd.js` guarda en la **memoria del proceso** (listas a nivel de módulo: ids de usuarios creados con `crearUsuarioDePrueba`, ids de casos creados con `crearCasoDePrueba` y nombres registrados con `registrarUsuarioCreado`) lo que ese archivo creó. `limpiarDatosDePrueba()` borra únicamente eso: nunca por prefijo `zz_test_` y nunca datos de otro proceso.
3. Los archivos solo comparten la base de datos. Por eso los nombres de usuario de prueba llevan sufijo aleatorio (`zz_test_<rol>_<aleatorio>`), la preparación del seed se serializa con `GET_LOCK` y las aserciones de cantidad se hacen sobre datos propios. No se añade el nombre del archivo al usuario ni se cambia el esquema: el prefijo y el sufijo bastan para localizar residuos.
4. Un archivo cuyo proceso no termina (servidor o pool sin cerrar) deja bloqueados a `node --test` y a `run()`: comprobado que ni la opción `timeout` de `run()` lo interrumpe. Por eso `verificarPruebas.js` lleva un temporizador de seguridad (9.5).

**Arranque y cierre para que `node --test` termine.** Un servidor HTTP abierto o el pool de `mysql2` sin cerrar mantienen vivo el proceso de la suite y el ejecutor se queda esperando. Regla: todo archivo que levante un servidor lo cierra en `after` (cerrando también las conexiones inactivas) y todo archivo que toque la base llama a `pool.end()` en su último `after`. Los archivos unitarios no abren nada. La comprobación de T20 incluye que `node --test` termina por sí solo en menos de 2 minutos.

**Se ejecuta desde `backend/`** (`dotenv` carga `.env` desde la carpeta actual, igual que `db.js`).

### 9.4 Política cuando una prueba real destape un fallo

Al ejecutar por primera vez pruebas que antes no se ejecutaban, es probable que alguna falle. Reglas para T12-T17:
1. Los arreglos de **aislamiento** dentro del archivo de prueba (ids fijos, nombres fijos, dependencia de datos previos, falta de limpieza) forman parte de la conversión y se hacen sin preguntar; se listan en el informe de la tarea.
2. Si una prueba falla por una **afirmación sobre el comportamiento** (el código no hace lo que la prueba o la spec dice), la tarea **se detiene**: no se modifica `src/` y no se relaja ni se borra el aserto. Se deja la tarea sin marcar y se reporta al usuario: archivo, nombre de la prueba, aserto que falla, valor esperado y valor obtenido, y una hipótesis (defecto del código o de la prueba). El usuario decide.
3. No se marca ninguna tarea con una prueba en rojo, omitida o pendiente (Constitución, Tests como puerta).

Fuera de este bloque (previsto para un Cambio 3, que aún no tiene plan): la robustez ante entradas no textuales y errores de base de datos, y el rol de contador exigido en `PATCH /casos/:id` (hoy un administrador sobre un caso inexistente recibe 404, no 403). Por eso las pruebas de T16 no afirman ese 403.

El aviso de token sin sesión o revocado se corrige dentro de este bloque (T18), así que T17 espera ya el texto «Sesión caducada» (9.6).

### 9.5 Cómo se comprueba objetivamente el criterio 25

1. `cd backend && node --test` termina por sí solo, con código de salida 0 y el resumen `fail 0`, `cancelled 0`, `skipped 0`, `todo 0`.
2. `cd backend && node soporte-pruebas/verificarPruebas.js`. Diseño cerrado del verificador (solo `node:test`, `node:path` y `node:fs`; sin paquetes nuevos; la carpeta `backend/soporte-pruebas/` la crea T11):

   **a) Qué ejecuta.** Lista recursivamente `backend/test/`. Son archivos de prueba los que terminan en `.test.js`; es «ajeno» **cualquier otro archivo** de `test/` (en cualquier subcarpeta y de cualquier extensión). Ejecuta `run({ files })` de `node:test` con las rutas absolutas de los `.test.js` y la concurrencia por omisión (igual que `node --test`) y recorre el flujo de eventos `test:pass` y `test:fail`; ignora `test:diagnostic` (su resumen es global y no trae archivo).

   **b) Qué cuenta como prueba real.** Para cada evento `d`, el archivo es `path.resolve(d.file)` y el tipo es `d.details.type` (`'test'` o `'suite'`). Comprobado en Node v24.21.0 con archivos temporales ya borrados (un archivo que solo exporta funciones; uno con `describe`, `test`, `it` y un `describe` anidado; uno con `skip`/`todo`; uno que falla en `before`; uno que lanza un error al cargarse; uno que no termina):

   | Evento | Cómo se trata |
   |---|---|
   | `details.type === 'suite'` (`describe`) en `test:pass` | No cuenta. |
   | `details.type === 'test'` con `d.name` igual a la ruta del archivo (entrada sintética) en `test:pass` | No cuenta: es la señal de «archivo sin pruebas registradas» (un archivo que solo exporta funciones da exactamente un evento así y 0 pruebas reales). |
   | `details.type === 'test'` con `d.name` distinto de la ruta, en cualquier nivel de anidación (hoja de `test()`/`it()`) | **Prueba real.** En `test:pass`: con `d.skip` verdadero es **omitida**; con `d.todo` verdadero es **pendiente**; si no, **pasada**. En `test:fail` se aplica la fila siguiente. |
   | Cualquier `test:fail` | Si `d.details.error.failureType === 'cancelledByParent'` es **cancelada**; en cualquier otro caso es **fallida** (incluye `describe` con `before` que falla, una prueba que lanza, una prueba con `todo` que falla y la entrada sintética de un archivo que no carga). |

   Resultado medido con ese criterio: el archivo que solo exporta funciones da 0 pruebas reales; el archivo con `describe`/`test`/`it`/`describe` anidado (4 pruebas) da 4; el de `skip`/`todo` da 1 pasada, 1 omitida, 1 pendiente y 1 fallida (la prueba `todo` que lanza un error); el que falla en `before` da 2 fallidas (la suite y una prueba que lanza) y 2 canceladas. Se agrupa por `path.resolve(d.file)`.

   **c) Mínimos.** La tabla de mínimos (punto 3) va **codificada dentro de `verificarPruebas.js`** como una constante `MINIMOS` (`{ 'dateUtils.test.js': 4, ... }`, con los 15 archivos y total 93). Un `.test.js` que exista en `test/` y no esté en la constante, o una entrada de la constante sin archivo, es un incumplimiento. El Cambio 1 amplía la constante en la misma tarea que crea cada archivo de prueba (T21, T23, T25, T27).

   **d) Salida en texto plano.** Una línea por archivo, ordenadas por nombre: `archivo | pruebas | mínimo | resultado`, donde `pruebas` es el número de pasadas y `resultado` es `OK` o `FALLA: ` seguido de los motivos separados por `; ` (`sin pruebas reales`, `menos pruebas que el mínimo`, `N fallidas`, `N omitidas`, `N pendientes`, `N canceladas`, `no está en la tabla de mínimos`, `el archivo no existe`). Un archivo ajeno se imprime como `AJENO | <ruta relativa> | - | FALLA: archivo que no termina en .test.js dentro de test/`. Última línea de resumen: `RESUMEN: archivos <n> | con pruebas reales <k> | pruebas <P> de <M> mínimas | fallidas <f> | omitidas <o> | pendientes <p> | canceladas <c> | .js ajenos <a> | RESULTADO: OK` (o `FALLA`). **Códigos de salida: 0 = todo cumple; 1 = cualquier incumplimiento.**

   **e) Temporizador de seguridad.** Un archivo cuyo proceso no termina (servidor o pool sin cerrar) deja colgado a `run()` (comprobado: ni su opción `timeout` lo interrumpe). El verificador arranca un temporizador de 120 000 ms; si vence, imprime `FALLA: un archivo de prueba no termina en 120 s (¿servidor HTTP o pool de la base de datos sin cerrar?)` y sale con código 1.

   **f) Dependencia de MariaDB.** En T11 los 15 archivos solo exportan funciones: ejecutarlos con `run()` no abre ninguna conexión y **no necesita base de datos**; lo mismo en T12. **Desde T14** (primera suite de integración convertida) el verificador, igual que `node --test`, **necesita MariaDB en marcha (XAMPP, puerto 3306)**. Si no responde, las pruebas de integración fallan con `ECONNREFUSED` (comprobado: `details.error.message` contiene `ECONNREFUSED` y `details.error.cause.code === 'ECONNREFUSED'`); el verificador lo detecta, imprime antes del resumen `AVISO: MariaDB no responde (ECONNREFUSED); arranque MariaDB (XAMPP, puerto 3306) y repita; no se da nada por verificado.` y sale con código 1. La tarea que lo ejecute se detiene y avisa al usuario.

   **g) Salida esperada literal en T11** (tras eliminar `mock_exp.test.js`; ninguna suite registra pruebas todavía), código de salida 1:

   ```
   authMiddleware.test.js | 0 | 13 | FALLA: sin pruebas reales
   authRoutes.test.js | 0 | 4 | FALLA: sin pruebas reales
   caseModel.test.js | 0 | 8 | FALLA: sin pruebas reales
   caseRoutes.test.js | 0 | 7 | FALLA: sin pruebas reales
   counterRoutes.test.js | 0 | 5 | FALLA: sin pruebas reales
   dateUtils.test.js | 0 | 4 | FALLA: sin pruebas reales
   errorUtils.test.js | 0 | 2 | FALLA: sin pruebas reales
   ownershipMiddleware.test.js | 0 | 4 | FALLA: sin pruebas reales
   passwordUtils.test.js | 0 | 4 | FALLA: sin pruebas reales
   roleMiddleware.test.js | 0 | 8 | FALLA: sin pruebas reales
   seed.test.js | 0 | 3 | FALLA: sin pruebas reales
   tokenUtils.test.js | 0 | 5 | FALLA: sin pruebas reales
   userModel.test.js | 0 | 7 | FALLA: sin pruebas reales
   userRoutes.test.js | 0 | 3 | FALLA: sin pruebas reales
   validationUtils.test.js | 0 | 16 | FALLA: sin pruebas reales
   RESUMEN: archivos 15 | con pruebas reales 0 | pruebas 0 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: FALLA
   ```

   **h) Salida esperada literal al cerrar el bloque (T20)**, código de salida 0: las mismas 15 líneas con cada `pruebas` igual a su mínimo y `OK`, y `RESUMEN: archivos 15 | con pruebas reales 15 | pruebas 93 de 93 mínimas | fallidas 0 | omitidas 0 | pendientes 0 | canceladas 0 | .js ajenos 0 | RESULTADO: OK`.
3. Mínimos esperados por archivo tras el Cambio 2 (es la constante `MINIMOS` de 2.c):

| Archivo | Mínimo | Archivo | Mínimo |
|---|---|---|---|
| `dateUtils.test.js` | 4 | `authRoutes.test.js` | 4 |
| `errorUtils.test.js` | 2 | `userRoutes.test.js` | 3 |
| `passwordUtils.test.js` | 4 | `caseRoutes.test.js` | 7 |
| `tokenUtils.test.js` | 5 | `counterRoutes.test.js` | 5 |
| `validationUtils.test.js` | 16 | `authMiddleware.test.js` | 13 |
| `roleMiddleware.test.js` | 8 | `ownershipMiddleware.test.js` | 4 |
| `userModel.test.js` | 7 | `caseModel.test.js` | 8 |
| `seed.test.js` | 3 | **Total** | **93** |

   El Cambio 1 añade sus archivos con sus propios mínimos, que se agregan a la constante `MINIMOS` en la misma tarea que crea cada archivo de prueba: `originUtils.test.js` 7 y `originMiddleware.test.js` 3 (T21), `appCors.test.js` 4 (T23), `respuestasApi.test.js` 3 (T25) e `idsContador.test.js` 6 (T27); total final 93 + 23 = 116 en 20 archivos (T29).
4. El estado "en rojo" del bloque es medible: al terminar T11 el verificador imprime la salida literal de 2.g (15 archivos sin pruebas reales, código 1); al terminar T17 informa de 0 archivos sin pruebas reales pero con las 4 pruebas en rojo esperadas (código 1); al terminar T18 imprime la salida de 2.h y sale con código 0.
5. `caseRoutes.test.js` tiene mínimo **7**: en `testCambiarCasoAjenoEsDenegado` el intento de un segundo contador (RF-10) y el de un administrador (RF-09) son **dos comprobaciones dentro de la misma prueba**, no dos pruebas. Razón: es lo de menor impacto (conserva las 7 funciones `testXxx` existentes y el total 93) y ambas comprobaciones prueban lo mismo, que un caso ajeno recibe «acceso denegado»; si una falla, se aplica la política de 9.4.

### 9.6 Eliminación de la puerta trasera y secreto JWT único

**Cambios en el código (⚠️ archivos que hoy funcionan):**
- `backend/src/models/SessionModel.js`: se borra `TOKENS_PRUEBA` y `obtenerSesion` termina en `return null` cuando la tabla no tiene la fila. El resto (`registrarSesion`, `tocarActividad`, `revocar`) no se toca.
- `backend/src/middlewares/authMiddleware.js`: se borra la rama "token_invalido: intentar recuperar la sesión" que reconstruía `req.user` desde la sesión, y se consulta `obtenerSesion` una sola vez.
- `backend/src/middlewares/authMiddleware.js` (texto): el aviso de token sin sesión registrada o revocado pasa de "Sesión no encontrada o revocada" a "Sesión caducada" sobre "token de acceso" con "Inicie sesión nuevamente" (tres partes, RF-05 y criterio 5). Los demás textos no cambian.
- `backend/src/config/jwt.js` (nuevo, aprobado por el usuario). Contenido exacto esperado (el valor por defecto del secreto es un marcador de desarrollo inocuo, el mismo que hoy usa `AuthController.js` —que es quien firma los tokens, así que los tokens ya emitidos siguen verificándose— y no es el valor real del `.env`; la duración por defecto, `2h`, coincide con la que ya usan `AuthController.js` y el `.env`):

  ```js
  require('dotenv').config();

  // Fuente única del secreto y de la duración del token de acceso (RF-01, RF-04, RF-05).
  // Los valores por defecto son solo de desarrollo; cada entorno los define en .env
  // con las variables JWT_SECRET y JWT_EXPIRES_IN.
  const JWT_SECRET = process.env.JWT_SECRET || 'delgrow_secret_cambiar_en_produccion';
  const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';

  module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
  ```

  `AuthController.js` y `authMiddleware.js` borran sus propias definiciones de `JWT_SECRET`/`JWT_EXPIRES_IN` y hacen `const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/jwt');` (`authMiddleware.js` solo necesita `JWT_SECRET`). Las pruebas que firman tokens (T17) importan el secreto de este mismo módulo; no escriben el valor literal.
  - **Cómo se comprueba que no queda ningún valor por defecto fuera de ese archivo:** `Get-ChildItem backend\src -Recurse -Filter *.js | Select-String -Pattern 'delgrow_secre|process\.env\.JWT_'` solo devuelve líneas de `backend\src\config\jwt.js` (exactamente dos: la línea del secreto, que contiene a la vez `process.env.JWT_SECRET` y el valor por defecto, y la de `process.env.JWT_EXPIRES_IN`; la expresión `delgrow_secre` cubre tanto el valor que hoy tiene `AuthController` como el de `authMiddleware`); el mismo comando sobre `backend\test` y `backend\soporte-pruebas` no devuelve nada; y `Select-String -Pattern "config/jwt"` sobre `AuthController.js` y `authMiddleware.js` devuelve una línea en cada uno.

```
authenticateToken(req, res, next):                       // RF-04, RF-05, RF-07, RF-25, criterio 30
  si no hay cabecera Authorization:      401 "No se proporcionó credenciales"  (igual que hoy)
  si no empieza con "Bearer ":           401 "Formato de credenciales inválido" (igual que hoy)
  token = texto tras "Bearer "
  r = verifyAccessToken(token, JWT_SECRET)               // firma y exp; valores fijos o inventados fallan aquí
  si !r.valido y r.error == 'expirado':  401 "Sesión caducada"                  // RF-05
  si !r.valido:                          401 "Token no válido"                  // RF-04, criterio 30; sin consultar la tabla, sin alternativas
  sesion = SessionModel.obtenerSesion(token)             // SOLO tabla `sesiones` (filas que crea el login)
  si sesion es null o sesion.revocado:   401 buildError("Sesión caducada", "token de acceso", "Inicie sesión nuevamente")  // RF-04, RF-05
  si isSessionInactive(sesion.ultima_actividad, ahora, 30):
        SessionModel.revocar(token); 401 "Sesión caducada por inactividad"     // RF-05
  SessionModel.tocarActividad(token, ahora)              // RF-25 (cada petición válida reinicia el temporizador)
  req.user = { id: r.payload.id, usuario: r.payload.usuario, rol: r.payload.rol }
  next()
```

Efecto: la única forma de pasar es un JWT firmado con el secreto del servidor **y** con fila no revocada en `sesiones`, es decir, uno emitido por `login`. RF-04 y RF-07 pasan a cumplirse sin excepción; RF-05 y RF-25 se mantienen; los criterios 4, 5, 6 y 30 se comprueban en T17/T18.

### 9.7 Decisiones y alternativas descartadas

1. **Se conservan los cuerpos de las funciones `testXxx` y solo se registran con `test()`** (cambiando únicamente lo necesario para el aislamiento de datos). Alternativa descartada: reescribir las 15 suites desde cero; más trabajo y riesgo de perder comprobaciones que ya estaban bien pensadas.
2. **Apoyos en `backend/soporte-pruebas/`, no en `backend/test/`.** Alternativa descartada: `test/helpers/` (comprobado: `node --test` lo ejecuta como archivo de prueba y lo contaría como archivo sin pruebas).
3. **Cada archivo crea y borra sus propios datos con prefijo `zz_test_`.** Alternativas descartadas: vaciar tablas antes de las pruebas (destruye datos de desarrollo y choca con la ejecución en paralelo); depender de `admin_seed`/`contador_seed` e ids fijos (frágil e imposible de ejecutar dos veces); una base de datos de pruebas aparte (el usuario decidió usar la misma base `delgrow_contadores`, con prefijo y limpieza).
4. **El seed de las pruebas se serializa con `GET_LOCK` de MariaDB.** Alternativas descartadas: modificar `seedDatabase` (función que ya funciona) para tolerar inserciones simultáneas; ejecutar las pruebas con concurrencia 1 (el comando oficial es `node --test` a secas).
5. **Verificador propio con `run()` de `node:test`.** Alternativas descartadas: analizar con expresiones regulares la salida de texto del reporter (frágil); no comprobar nada, que es lo que permitió que el defecto pasara inadvertido.
6. **Las pruebas de middleware usan tokens emitidos por el login real** (más `envejecerSesion` para simular inactividad y un JWT firmado con vencimiento negativo para RF-05). Alternativa descartada: insertar filas de sesión con tokens fijos directamente en la tabla (seguiría siendo una credencial que no pasa por el login, contra la decisión del usuario).
7. **Un único módulo `config/jwt.js` con un único valor por defecto.** Alternativa descartada: que el servidor no arranque si falta `JWT_SECRET` (más seguro, pero cambia el arranque y obliga a definirlo en todo entorno de pruebas; decisión del usuario: sin arranque condicionado a la variable).
8. **No se tocan los `try/catch` de `SessionModel` que ignoran errores de base de datos** (`registrarSesion`, `tocarActividad`, `revocar`): no autentican nada y quitarlos cambia cómo falla el servidor. Queda para el Cambio 3 previsto (decisión del usuario).
9. **`create` de `UserModel` y `CaseModel` se corrige cambiando solo `const [result] = await query(` por `const result = await query(`** (9.9, dentro de T13, decisión del usuario). Alternativas descartadas: cambiar el contrato de `db.query` a `[rows]` y que los apoyos de prueba esquiven `create`.

### 9.8 Trazabilidad

| Parte | RF / criterio |
|---|---|
| Conversión de las 15 suites y eliminación de `mock_exp` | criterio 25 |
| `verificarPruebas.js` + `node --test` completo | criterio 25 |
| Pruebas de autenticación con tokens emitidos por el login y las 6 pruebas nuevas | RF-04, RF-05, RF-07, RF-25, criterios 4, 5, 6, 30 |
| `SessionModel`/`authMiddleware` sin alternativas + `config/jwt.js` | RF-04, RF-07, criterio 30 |
| `MEMORY.md` con el estado real | AGENTS.md (Memoria); criterio 25 (lección) |
| Corrección de `create` en `UserModel` y `CaseModel` (T13) | RF-17, RF-18, RF-28 (RF-27 no afectado) |

---

### 9.9 Corrección de `create` en los modelos (T13)

Hallazgo del humo de T13 (política 9.4 aplicada: la tarea se detuvo, se reportó y el usuario decidió añadir el arreglo a T13 conservando los apoyos `bd.js` y `http.js` ya creados).

**Evidencia (leída en el código):**
- `backend/src/config/db.js` (línea 25 a 28): `async function query(sql, params) { const [rows] = await pool.query(sql, params || []); return rows; }`. Para `SELECT`, `rows` es una lista; para `INSERT`/`UPDATE`, `rows` es un `ResultSetHeader` (objeto con `insertId` y `affectedRows`).
- `backend/src/models/UserModel.js` línea 25: `const [result] = await query(` (el `INSERT` de `create`); línea 29: `return result.insertId;`.
- `backend/src/models/CaseModel.js` línea 65: `const [result] = await query(` (el `INSERT` de `create`); línea 70: `return result.insertId;`.
- Resultado: `TypeError: (intermediate value) is not iterable` tras ejecutarse el `INSERT`. Búsqueda del patrón `const \[\w+\] = await query` en `backend/src/`: exactamente esas dos líneas.

**Efecto sobre los requisitos:** RF-28 (alta de usuario, `POST /usuarios`) y RF-17/RF-18 (registro de caso, `POST /casos`) están implementados pero rotos desde T6/T9 (500 con fila creada; al reintentar un caso se duplica). RF-27 (seed) no está afectado: `seed.js` usa `query` sin desestructurar. `login`, `logout`, las lecturas y los `UPDATE` de casos tampoco. T14 a T17 dependen de `create`.

**Arreglo mínimo (⚠️ dos líneas en archivos que hoy "funcionan" a medias):**

| Archivo | Línea | Antes | Después |
|---|---|---|---|
| `backend/src/models/UserModel.js` | 25 | `const [result] = await query(` | `const result = await query(` |
| `backend/src/models/CaseModel.js` | 65 | `const [result] = await query(` | `const result = await query(` |

No se toca nada más: `db.js`, los `SELECT`, `seed.js` y el resto de los modelos quedan igual. Las dos funciones siguen devolviendo `result.insertId`, que es un número.

**Decisión y alternativas descartadas:**
- Se cambian solo las dos líneas que usan mal el valor devuelto. Es el arreglo de menor alcance y deja `query()` con el contrato que ya usan todos los demás llamadores (`SELECT`, seed, sesiones).
- Descartada: cambiar el contrato de `db.query` para que devuelva siempre `[rows]`. Rompería los más de 20 usos que hoy funcionan (todos los `SELECT`, el seed y los modelos) para arreglar dos.
- Descartada: que los apoyos de prueba inserten con `query()` directo y esquiven `create`. Ocultaría el fallo: `POST /usuarios` y `POST /casos` seguirían rotos y las pruebas de rutas lo descubrirían más tarde.

**Cobertura y verificación:**
- RF-17 y RF-18 (`CaseModel.create` detrás de `POST /casos`), RF-28 (`UserModel.create` detrás de `POST /usuarios`). RF-27 no afectado.
- **Rojo documentado:** el humo de T13 falló antes del arreglo (`TypeError ... is not iterable` al crear el usuario o el caso de prueba). **Verde:** con las dos líneas cambiadas, el humo da exactamente la salida literal de T13.
- T14: `create` devuelve un número y el registro existe (afirmaciones dentro de las pruebas existentes, 9.2). T15 y T16: `POST /usuarios` y `POST /casos` responden 201 y dejan **una sola** fila (afirmaciones dentro de las pruebas existentes). **No hacen falta pruebas nuevas**: los mínimos por archivo y el total 93 no cambian.
