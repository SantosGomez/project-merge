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

Archivos nuevos (requieren aprobación del usuario antes de crearse):

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
   Alternativa descartada: pasar `req.params.id` directo al SQL. MariaDB convierte `'2abc'` en `2` al comparar con una columna entera y devolvería los datos del contador 2 para un id que no corresponde a ninguno. Si el usuario no quiere esta función extra, se elimina sin afectar al resto (T17/T18).
5. **Los orígenes permitidos son una lista exacta en `CORS_ORIGENES`, con valores por defecto de desarrollo en el código.**
   Alternativa descartada: patrón que acepte cualquier puerto de `localhost` (contradice el caso límite de la spec: "otro puerto local no autorizado" se rechaza) o lista fija solo en código (obliga a editar código para cambiar de puerto).
6. **Origen no permitido: respuesta 403 explícita (con mensaje de tres partes) además de no enviar cabeceras CORS.**
   Alternativa descartada: dejar que `cors` solo omita las cabeceras (la petición se procesaría igual en el servidor y no habría nada verificable con `node --test`; RF-34 pide "rechaza"). El guard va antes que `cors` y que las rutas.
7. **Peticiones sin cabecera `Origin` se aceptan** (decisión del usuario, RF-34): herramientas, scripts y pruebas; el token sigue siendo el control de acceso.
   Alternativa descartada: rechazarlas (rompería `node --test` y las pruebas manuales).
8. **Pruebas nuevas con `node:test` real (`test()`/`describe()`), no con el patrón actual de exportar funciones.** Ver hallazgo en 8.7.

### 8.7 Estrategia de tests (`node --test` desde `backend/`)

- Orden por cada parte: tests nuevos **en rojo** → implementación → `node --test <archivos>` en verde → marcar la tarea y parar.
- **Hallazgo:** los 15 archivos de `backend/test/` existentes definen funciones `testXxx` y las exportan con `module.exports`, pero no las registran con `node:test`. `node --test` los carga y los cuenta como "pasados" sin ejecutar ninguna comprobación. Solo `mock_exp.test.js` usa `node:test` (y falla). Por eso las pruebas nuevas de este cambio usan `node:test` de verdad (`require('node:test')`), para que "en rojo" signifique realmente rojo. Los archivos existentes no se tocan; como no ejecutan nada, no se ven afectados por el cambio. Si se ejecutaran, seguirían en verde: ninguno depende de `password_hash`; `counterRoutes.test.js` usa `contadores[0].id` y el texto "No se encontró el contador", que se conserva; `authRoutes.test.js` solo comprueba `token`, `rol` y `usuario`; `userModel.test.js` prueba `findAll`/`findById`, que no se modifican.
- Integración con MariaDB real (la de `.env`, usuarios `admin_seed` y `contador_seed`); pruebas de origen, de `parseCounterId` y del guard son puras o con simulación y no necesitan base de datos.
- Prueba de barrido (RF-33, RNF-7): con la app real, iniciar sesión como administrador, contador y usuarios_de_sistema (este último se crea con `POST /usuarios` y nombre único), llamar a todos los endpoints en éxito y en error (400, 401, 403, 404) y comprobar que el texto de cada respuesta no contiene `password_hash` ni `$argon2`.
- `mock_exp.test.js` falla siempre (`t.mock is not a function`): decisión pendiente del usuario (T19).

| Parte | RF / criterio |
|---|---|
| `originUtils` + `originMiddleware` + cableado en `app.js` + `.env` | RF-34, criterios 24, 28 |
| `UserModel.findCountersPublic` + `listCounters` | RF-12, RF-32, criterio 26 |
| Barrido de respuestas | RF-33, RNF-7, criterio 27 |
| `login` con `id` | RF-01, criterio 1 |
| `findCounterById` + `parseCounterId` + controladores de conteos y casos | RF-35, RF-14, RF-16, criterio 29 |
| Cierre: `node --test` completo | criterios 1, 24 a 29 |
