# Plan 003 — Frontend funcional conectado al backend

Spec: `specs/003-frontend-funcional/spec.md` (su línea `Estado:` dice aprobada, pero la spec cambió después al añadir RF-45 a RF-47 y el criterio 31: necesita una nueva aprobación del usuario antes de T2) · Plan para implementar dentro de `Seguimiento-proyectos/`.

## 1. Alcance del plan

- Conectar el frontend real (Quasar v2, Vue 3) ya implementado en la spec 001 con datos en memoria al backend real de la spec 002 (localhost:3000, MariaDB).
- Reemplazar los datos en memoria (`src/services/exampleData.js`, `src/stores/maqueta.js`) por peticiones HTTP a los endpoints del backend.
- Autenticación con JWT Bearer; el token se guarda en `sessionStorage` (RF-02, RF-42, RF-43, RF-44).
- Caducidad de sesión por inactividad de 30 minutos medida desde el cliente; cada petición válida reinicia el temporizador (RF-07).
- Pantallas P-1 a P-5 con sus estados de interfaz: carga, vacío, error, acceso denegado, sesión caducada (RF-34 a RF-38).
- Tooltips contextuales en prioridades, estados, conteos, campos y mensajes (RNF-03).
- Responsivo de 360 px a 1024+ px, sin desplazamiento horizontal, una columna por debajo de 600 px (RNF-02).
- Textos de interfaz y mensajes en español, mensajes de error con tres partes (qué ocurrió, sobre qué, qué hacer) (RNF-01, RNF-04, RNF-05, RNF-06, RNF-07, RNF-08, RNF-09).
- **Fuera de alcance**: pantallas de alta de usuarios y restablecimiento de contraseñas (spec posterior), controles de simulación ("Simular caducidad", "Simular error"), búsqueda, filtros, ordenación, paginación, exportación, notificaciones, reportes.
- No se toca el backend ni `backend/`. Todo el código nuevo vive en `Seguimiento-proyectos/src/` y `Seguimiento-proyectos/test/`.

## 2. Archivos y responsabilidades

Cada fila indica si el archivo es **NUEVO**, **MODIFICA** o **ELIMINA** un archivo existente de la spec 001, y cuál.

### Contrato con el backend
Cada servicio HTTP consume los endpoints reales del backend (localhost:3000). La tabla siguiente muestra el método, ruta, rol requerido, cuerpo de entrada, formato de éxito y formato de error para cada función:

| Función del servicio | Método | Ruta | Rol requerido | Cuerpo entrada | Éxito (formato real) | Error (formato real) | Consume (RF) |
|---|---|---|---|---|---|---|---|
| `authService.login` | POST | `/auth/login` | cualquiera | `{ usuario, password }` | `200 { token, rol, id, usuario }` | `400 { mensaje }` (faltan usuario o contraseña; tras la spec 004 también un dato que no es texto); `401 { mensaje }` (credenciales no válidas, mensaje genérico) | RF-01..RF-04, RF-08..RF-10 |
| `authService.logout` | POST | `/auth/logout` | cualquiera (token) | vacío | `200 { mensaje: "Sesión cerrada correctamente" }` | `401 { mensaje }` (`authenticateToken` revocado/exp); si 401 porque token ya estaba revocado/expirado → cierre local igual; cualquier fallo (red/5xx) → cierre local + aviso de 3 partes RF-47 | RF-10 (best-effort, sin diálogo), RF-45, RF-46, RF-47 (cierre voluntario confirmado; caducidad y cierre pestaña NO llaman) |
| `counterService.listCounters` | GET | `/contadores` | administrador | vacío | `200 { contadores: [...] }` o `200 { mensaje, contadores: [] }` | `401 { mensaje }` (`authenticateToken` sin/exp token); `403 { mensaje }` (`requireAdmin`) | RF-11, RF-12, RF-16 |
| `counterService.getConteosPorEstado` | GET | `/contadores/:id/conteos` | administrador | vacío | `200 { contador_id, pendiente, en_proceso, finalizado }` | `404 { mensaje }` (contador no existe); `401`; `403` (rol) | RF-13 |
| `counterService.getCasosPorContador` | GET | `/contadores/:id/casos` | administrador | vacío | `200 { casos: [...] }` o `200 { mensaje, casos: [] }` | `404 { mensaje }`; `401`; `403` (rol) | RF-14, RF-15 |
| `caseService.getMisCasos` | GET | `/casos/mis-casos` | cualquiera con token (la ruta no tiene `requireContador`; el frontend solo la llama con perfil contador) | vacío | `200 { casos: [...] }` o `200 { mensaje, casos: [] }` | `401` | RF-15, RF-27, RF-32 |
| `caseService.crearCaso` | POST | `/casos` | contador | `{ cliente, prioridad }` | `201 { mensaje, caso: {...} }` | `400 { mensaje }` (validación entrada); `401`; `403` (`requireContador`) | RF-18..RF-21, RF-25 |
| `caseService.actualizarCaso` | PATCH | `/casos/:id` | contador | `{ estado?, prioridad? }` | `200 { mensaje, caso: {...} }` | `400 { mensaje }`; `401`; `403` (`checkCaseOwnership` no pertenece / `requireContador`); `404 { mensaje }` (caso no existe) | RF-22, RF-29, RF-30, RF-31 |

**Nota `logout`:** `POST /auth/logout` (RF-45/46/47): si 401 porque token revocado/exp → cierre local igual (no bloquea); cualquier otro fallo → cierre local + aviso 3 partes (RF-47). No se llama en caducidad (RF-07) ni cierre pestaña (RF-44).

**Tratamiento por `api.js`:** `401` (token expirado/revocado o sin header) → `authService.limpiarSesion()`, mostrar `AvisoSesionCaducada` (RF-42/43); `403` (rol incorrecto o propiedad del caso u origen) → `AccessDenied.vue` / `ErrorState.vue` con mensaje (NO borrar sesión); `404` → `ErrorState` con mensaje del backend; cualquier `5xx` → `ErrorState` con el `mensaje` del backend (o `construirError` si no trae cuerpo) + reintentar (RF-36); error de red o **sin respuesta en 15 s** (axios cancela la petición por `timeout` y la rechaza con `error.code === 'ECONNABORTED'`; en ambos casos no hay `error.response`) → `ErrorState` con `construirError` + reintentar (RF-36). `originMiddleware` rechaza con `403` (no confundir con 401 de auth). Errores internos del backend: hoy responde `500` y, tras la spec 004, `503`; `api.js` trata igual cualquier `5xx`, así que no hay que cambiarlo cuando se implemente la 004. El límite de 15 s también cubre el defecto actual del backend (hasta la spec 004, un fallo de base de datos dentro de un controlador deja la petición sin respuesta) para que el indicador de carga nunca se quede girando.

Nota contrato (P-2): `AdminDashboardPage.vue` hace primero `GET /contadores`; luego lanza **N peticiones paralelas** `GET /contadores/:id/conteos` (`Promise.all`) (contrato 2, RF-12, RF-36). Si cualquiera falla → estado de error completo en P-2 (RF-36, sin conteos parciales); `counterService.getConteosPorEstado` debe consumirse en paralelo tras completar `listCounters`.

## Traducción de estado y prioridad (backend ↔ frontend)

El backend (`backend/src/utils/validationUtils.js`) usa forma capitalizada: `Pendiente` / `En proceso` / `Finalizado` (estados) y `Alta` / `Media` / `Baja` (prioridades). El frontend existente (`constants.js`, `PriorityTag.vue`, `CaseRow.vue`, `CounterCountsRow.vue`) usa códigos internos en minúscula: `pendiente` / `en_proceso` / `finalizado` y `alta` / `media` / `baja`. **Los servicios convierten; los componentes no cambian.**

| Sentido | Estado (backend) | Estado (interno) | Prioridad (backend) | Prioridad (interno) |
|---|---|---|---|---|
| De backend a frontend | `Pendiente` → | `pendiente` | `Alta` → | `alta` |
| De backend a frontend | `En proceso` → | `en_proceso` | `Media` → | `media` |
| De backend a frontend | `Finalizado` → | `finalizado` | `Baja` → | `baja` |
| De frontend a backend | `pendiente` → | `Pendiente` | `alta` → | `Alta` |
| De frontend a backend | `en_proceso` → | `En proceso` | `media` → | `Media` |
| De frontend a backend | `finalizado` → | `Finalizado` | `baja` → | `Baja` |

**Archivo de traducción (`NUEVO`):** `src/utils/traduccionBackend.js` (funciones puras, sin efectos secundarios, testeables con `node --test`). Funciones propuestas:
El nombre de cada función dice hacia dónde traduce: `…DeBackend` recibe la forma del backend y devuelve el código interno; `…ABackend` recibe el código interno y devuelve la forma del backend.

- `estadoDeBackend(estadoBackend)` → código interno (`'En proceso'` → `'en_proceso'`). Si el valor no es uno de los tres estados del backend, devuelve `null`; el servicio trata `null` como respuesta inesperada y genera un error de 3 partes (`construirError`).
- `estadoABackend(estadoInterno)` → forma del backend (`'en_proceso'` → `'En proceso'`). Si el valor no es uno de los tres códigos internos, devuelve `null`.
- `prioridadDeBackend(prioridadBackend)` (`'Alta'` → `'alta'`) y `prioridadABackend(prioridadInterna)` (`'alta'` → `'Alta'`): mismo patrón y mismo `null` para valores desconocidos.
- `casoDeBackend(casoBackend)`: devuelve una copia del caso con `estado` y `prioridad` traducidos a código interno; si alguno de los dos es desconocido, devuelve `null` para que el servicio genere el error de 3 partes. `casoABackend` no se necesita: al backend solo se envían `cliente`, `prioridad` y `estado`, que se traducen campo a campo.
- **Valor desconocido:** siempre `null`; no se inventan valores ni se lanzan excepciones.

**Uso en las pantallas y los servicios:**
- **P-4 (registro de caso)**: el formulario y `PriorityTag.vue` siguen trabajando con los códigos internos (`alta`/`media`/`baja`, de `PRIORITIES`). Antes de validar, la pantalla traduce con `prioridadABackend`; `validarPrioridad` recibe la forma del backend y `caseService.crearCaso(cliente, prioridadBackend)` la envía tal cual (ver 4.5). Una prioridad sin elegir (`null`) se traduce a `null` y `validarPrioridad(null)` devuelve `prioridad_requerida`.
- `caseService.crearCaso(cliente, prioridadBackend)`: envía `POST /casos` con `{ cliente, prioridad: prioridadBackend }`, sin traducir; traduce la respuesta con `casoDeBackend`.
- `caseService.actualizarCaso(id, { estado?, prioridad? })`: recibe códigos internos desde P-5 y los traduce con `estadoABackend` / `prioridadABackend` antes del `PATCH`; traduce la respuesta con `casoDeBackend`.
- `caseService.getMisCasos()` y `counterService.getCasosPorContador(id)`: aplican `casoDeBackend` a cada caso antes de guardarlo en el store o devolverlo a la vista.
- `counterService.getConteosPorEstado(id)`: las claves `pendiente`, `en_proceso`, `finalizado` del backend ya coinciden con los códigos internos; no se traducen.

**Ejemplo de flujo completo (registro de caso):**
```
P-4: el usuario elige "Alta" → el formulario guarda el código interno 'alta'
prioridadBackend = prioridadABackend('alta')            → 'Alta'
validarPrioridad('Alta')                                → { valido: true, error: null }
caseService.crearCaso(cliente, 'Alta')                  → POST /casos con { cliente, prioridad: 'Alta' }
respuesta 201 { caso: { prioridad: 'Alta', estado: 'Pendiente', ... } }
casoDeBackend(caso)                                     → { prioridad: 'alta', estado: 'pendiente', ... }
store cases.js → PriorityTag.vue recibe 'alta' y muestra "Alta" con su color
```

Nota: `validarPrioridad` y `formatearPrioridad` (T1/T2) reciben la forma **del backend** (`Alta`, `Media`, `Baja`), como afirman sus pruebas; los componentes (`PriorityTag.vue`, `CaseRow.vue`, etc.) siguen recibiendo el código interno (`alta`, `media`, `baja`) y usan sus mapas (`STATUS_LABELS`, `PRIORITY_LABELS`). `constants.js` y los componentes no cambian por la traducción.

Nota de T1 (decisión de implementación, no pregunta): `validarCredenciales` usa `faltantes: ['username', 'password']` (no `usuario` ni `contraseña`), porque son las claves que ya usa P-1: `LoginPage.vue` tiene `v-model="form.username"` / `v-model="form.password"` y marca los campos con `missing.username` / `missing.password`, y `accessRules.js` usa `LOGIN_FIELDS.username` / `LOGIN_FIELDS.password`. Las pruebas de T1 (`test/validators.test.js`) afirman estas claves. `construirError` construye la cadena exacta: `"Qué ocurrió: X. Sobre: Y. Qué hacer: Z."` (tres partes separadas por puntos y espacios); solo se usa cuando no llega respuesta del backend; cuando llega `mensaje` del backend, se muestra ese mensaje tal cual (`"Qué ocurrió sobre qué: qué hacer"`) sin reescribirlo. No se prueban partes vacías, valores `hoy` futuros ni datos inválidos que no cubra el contrato.

Nota de dependencia con la spec 004: la distinción de mayúsculas y minúsculas en el login depende del backend; ver la decisión 12 de la sección 5.

**Nota de construcción para RNF-01 / RF-36:** el backend devuelve `{ mensaje }` como cadena única con las tres partes ya unidas (`"Qué ocurrió sobre qué: qué hacer"`). El frontend usa ese `mensaje` directamente cuando existe (respuesta 400/401/404/503); para errores de red o sin respuesta (no llega cuerpo JSON), usa `construirError(...)` de `src/utils/mensajes.js` para formar las tres partes. El componente `ErrorState.vue` muestra `title` (qué ocurrió, fijo en componente) + `detail` (sobre qué) + botón `Reintentar`; si se conecta al backend, se pasa `detail = respuesta.mensaje` para que la parte "sobre qué" y "qué hacer" vengan del servidor.

### Servicios (capa de comunicación con el backend)
| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/services/api.js` | Instancia única de **axios** (`axios.create`) con `baseURL: 'http://localhost:3000'` y `timeout: 15000` (**15 s**). Interceptor de petición: añade `Authorization: Bearer <token>` desde `sessionStorage`. Interceptor de respuesta: centraliza el tratamiento de errores de red, tiempo agotado y respuestas 401/403/404/5xx (ver «Tratamiento por `api.js`») y rechaza siempre con `{ estado, mensaje }`, donde `mensaje` tiene las tres partes. Los servicios importan esta instancia; ninguna pantalla ni store llama a axios directamente. | RF-02, RF-04, RF-05, RF-07, RF-34, RF-36 | NUEVO |
| `src/services/authService.js` | `login(usuario, password)`, `logout()`, `getToken()`, `setToken(token)`, `getRol()`, `setRol(rol)`, `getUsuario()`, `setUsuario(usuario)`, `isTokenExpirado(token, ahora)` (lee el campo `exp` del JWT), `limpiarSesion()`. Lee/escribe `sessionStorage`. | RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-42, RF-43 | NUEVO |
| `src/services/counterService.js` | `listCounters()`, `getConteosPorEstado(id)`, `getCasosPorContador(id)`. Lectura exclusiva para administrador. | RF-11, RF-12, RF-13, RF-14, RF-15, RF-16 | NUEVO |
| `src/services/caseService.js` | `getMisCasos()`, `crearCaso(cliente, prioridad)`, `actualizarCaso(id, {estado, prioridad})`. Escritura exclusiva para contador sobre sus propios casos. | RF-15, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-29, RF-30 | NUEVO |
| `src/services/exampleData.js` | Deja de usarse como origen de datos; se sustituye por llamadas a los servicios HTTP anteriores. Los datos de ejemplo dejan de ser la fuente de verdad. | Todos | MODIFICA (deja de usarse) |

### Stores (estado reactivo de la aplicación)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/stores/session.js` | Token, rol, usuario, autenticado, bandera de sesión caducada, último momento de actividad, temporizador de inactividad (30 min), **campo `avisoSesion` para aviso persistente (se limpia con la siguiente acción del usuario en P-1)**. | RF-02, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-42, RF-43, RF-44, RF-45, RF-46, RF-47 | NUEVO (hoy no existe `src/stores/session.js`; la sesión de la maqueta vive en `maqueta.js`) |
| `src/stores/counters.js` | Lista de contadores, conteos por estado (con ceros), contador seleccionado y su detalle. | RF-11, RF-12, RF-13, RF-14, RF-15, RF-16 | NUEVO |
| `src/stores/cases.js` | Casos asignados al contador autenticado, caso en edición (estado/prioridad). | RF-15, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33 | NUEVO |
| `src/stores/maqueta.js` | Deja de usarse como origen de datos en memoria; se sustituye por los stores anteriores que consumen el backend. | Todos | MODIFICA (deja de usarse como fuente de datos) |
| `src/stores/index.js` | Registra los stores nuevos (`session`, `counters`, `cases`) junto con los existentes. | Todos | MODIFICA |

### Router y navegación

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/router/index.js` | Rutas: `/login` (P-1, con `LoginLayout.vue`), `/admin/dashboard` (P-2, solo administrador), `/admin/directorio` (P-3, solo administrador), `/contador/registro` (P-4, solo contador), `/contador/casos` (P-5, solo contador). Guards: sin sesión → P-1; perfil incorrecto → acceso denegado con vuelta a pantalla principal; control de regreso en pantallas internas; token desde `sessionStorage` en cada navegación. | RF-01, RF-05, RF-06, RF-38, RF-39, RF-40, RF-41 | MODIFICA (`src/router/index.js` existe; se cambian los guards para usar `sessionStorage` y el backend en lugar de `maqueta.js`; se añade layout de login para `/login`) |
| `src/router/accessState.js` | Estado compartido `accessDenied` entre el guard y el layout. Se mantiene pero se alimenta del guard actualizado. | RF-06 | MODIFICA |

### Vistas (pantallas P-1 a P-5)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/pages/LoginPage.vue` | P-1: formulario usuario/contraseña, validación de campos vacíos o solo espacios, mensaje genérico de credenciales no válidas, redirección al perfil tras login válido. Usa `LoginLayout.vue` (sin menú interno). **Incluye aviso persistente (`q-banner` o componente propio) de cierre de sesión (RF-46, RF-47) que se limpia con la siguiente acción del usuario.** | RF-01, RF-03, RF-04, RF-05, RF-06, RF-45, RF-46, RF-47 | MODIFICA (`src/pages/LoginPage.vue` existe; se sustituye login en memoria por `authService.login`; se añade aviso persistente; se cambia su layout) |
| `src/pages/AdminDashboardPage.vue` | P-2: lista de contadores con conteos por estado (ceros incluidos), detalle de contador seleccionado (cliente, estado, prioridad con texto + color), mensaje de vacío si no tiene casos, control "Ver directorio", control de regreso. | RF-11, RF-12, RF-13, RF-14, RF-15, RF-38, RF-39 | MODIFICA (`src/pages/AdminDashboardPage.vue` existe; se sustituyen datos en memoria por `counterService`) |
| `src/pages/CountersDirectoryPage.vue` | P-3: solo nombres de contadores, sin conteos ni casos; selección de un nombre abre P-2 con ese contador seleccionado; control de regreso. | RF-16, RF-17, RF-38 | MODIFICA (`src/pages/CountersDirectoryPage.vue` existe; se sustituyen datos en memoria por `counterService`) |
| `src/pages/NewCasePage.vue` | P-4: formulario cliente (texto libre) y prioridad (Alta/Media/Baja); estado Pendiente y contador asignado mostrados como no editables; validaciones (cliente obligatorio, prioridad obligatoria, máximo 80 caracteres), confirmación de registro, formulario vacío tras éxito, control "Ver mis casos". | RF-18, RF-19, RF-20, RF-21, RF-22, RF-23, RF-25, RF-26, RF-40, RF-41 | MODIFICA (`src/pages/NewCasePage.vue` existe; se sustituye registro en memoria por `caseService.crearCaso`) |
| `src/pages/MyCasesPage.vue` | P-5: lista de casos del contador (cliente, estado, prioridad con texto + color), cambio de estado y prioridad en cualquier momento (incluido Finalizado), mensaje de vacío con control "Registrar caso", confirmación visual de cambios, control de regreso, control "Registrar caso" siempre visible. | RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33, RF-37, RF-38, RF-40 | MODIFICA (`src/pages/MyCasesPage.vue` existe; se sustituyen datos en memoria por `caseService`) |
| `src/pages/index.vue` | Redirección raíz a `/login`. No se toca salvo que el redireccionamiento del login lo exija. | RF-01 | MODIFICA (solo si el cambio de layout de login lo exige; de lo contrario sin cambios) |
| `src/pages/[...path].vue` | Catch-all de rutas inexistentes. No se toca. | — | MODIFICA (solo si es necesario; de lo contrario sin cambios) |

### Componentes compartidos (reutilizados, no se crean nuevos de aviso)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/components/PriorityTag.vue` | Etiqueta de prioridad: texto ("Alta", "Media", "Baja") + color (rojo, ámbar, verde) con contraste ≥ 4.5:1, tooltip de ayuda. Nunca el color como único portador. | RF-13, RF-19, RF-28, RNF-06, RNF-03 | MODIFICA (existe; se verifica que tenga tooltip y contraste) |
| `src/components/CaseRow.vue` | Fila de caso con cliente, estado y prioridad; usada en P-2 detalle y P-5. | RF-13, RF-28, RNF-06, RNF-03 | MODIFICA (existe; se reusa) |
| `src/components/CounterCountsRow.vue` | Tarjeta de contador con nombre y tres conteos (Pendiente, En proceso, Finalizado); nombre largo se muestra completo sin truncar. | RF-12, RNF-08 | MODIFICA (existe; se reusa) |
| `src/components/AccessDenied.vue` | Aviso de acceso denegado con botón para volver a la pantalla principal del perfil. Se reutiliza tal cual (no se crea `AvisoAccesoDenegado`). | RF-06 | MODIFICA (existe; se reusa) |
| `src/components/ErrorState.vue` | Mensaje de error con tres partes (qué, sobre qué, qué hacer) y botón "Reintentar". Se reutiliza tal cual (no se crea `MensajeError`). | RF-36, RNF-01 | MODIFICA (existe; se reusa) |
| `src/components/EmptyState.vue` | Mensaje de vacío que indica qué información falta. Se reutiliza tal cual (no se crea `MensajeVacio`). | RF-33, RF-35 | MODIFICA (existe; se reusa) |
| `src/components/ScreenLoader.vue` | Indicador de carga mientras se obtienen datos del backend. | RF-34 | MODIFICA (existe; se reusa) |
| `src/components/EssentialLink.vue` | Enlace de navegación con foco visible y área táctil ≥ 44×44 px. | RF-38, RNF-02, RNF-07 | MODIFICA (existe; se reusa) |
| `src/components/SimulationControls.vue` | Controles "Simular caducidad" y "Simular error". **Eliminados** por decisión del usuario; se borra el archivo y sus importaciones. | — | ELIMINA |
| `src/components/AvisoSesionCaducada.vue` | Aviso de sesión caducada con botón "Ir a inicio de sesión" que lleva a P-1. | RF-07 | NUEVO |

### Layouts

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/layouts/LoginLayout.vue` | Layout propio para P-1 (login), sin menú interno, sin controles de simulación, centrado y responsivo. | RF-01, RF-03, RF-04 | NUEVO |
| `src/layouts/MaquetaLayout.vue` | Layout común de pantallas internas (P-2 a P-5): título, regreso, aviso de acceso denegado, aviso de sesión caducada, **control "Cerrar sesión" con diálogo `QDialog` (confirmar/cancelar)**, foco visible, Escape para cancelar, retorno del foco al control al cancelar, área táctil ≥ 44×44 px (RNF-02/03/07). | RF-38, RF-06, RF-07, RF-45, RF-46, RF-47 | MODIFICA (se quita `SimulationControls.vue`; se añade `AvisoSesionCaducada.vue`; **⚠️ se integra control + diálogo de cierre**) |

### Utilidades (funciones puras, probables con `node --test`)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/utils/validators.js` | `validarCredenciales(usuario, password)`, `validarCliente(cliente)`, `validarPrioridad(prioridad)`. Síncronas, sin efectos secundarios. | RF-03, RF-21, RF-22, RF-23 | NUEVO |
| `src/utils/inactividad.js` | `estaInactivo(ultimaActividad, hoy, limiteMinutos)`, `calcularMinutosInactividad(ultimaActividad, hoy)`. `hoy` se inyecta como parámetro (`Date`). | RF-07 | NUEVO |
| `src/utils/formateadores.js` | `formatearEstado(estado)`, `formatearPrioridad(prioridad)`: devuelven `{ texto, color, tooltip }`. | RF-13, RF-28, RNF-06 | NUEVO |
| `src/utils/mensajes.js` | `construirError(queOcurrio, sobreQue, queHacer)`: mensaje de tres partes en español. | RF-36, RNF-01 | NUEVO |
| `src/utils/constants.js` | Constantes de dominio: estados, prioridades, colores, perfiles, `MAX_CLIENT_LENGTH`. Se quita `SIMULATION` (controles de simulación eliminados). | Todos | MODIFICA (se quita `SIMULATION`; se mantienen `STATUSES`, `PRIORITIES`, `STATUS_LABELS`, `PRIORITY_LABELS`, `PRIORITY_COLORS`, `PROFILES`, `MAX_CLIENT_LENGTH`) |
| `src/utils/accessRules.js` | `validateLoginForm`, `normalizeCredential`, `resolveProfile`. `resolveProfile` recibe las cuentas/rol desde `authService` en lugar de importarlas de `exampleData.js`. | RF-03, RF-04, RF-08 | MODIFICA |
| `src/utils/caseRules.js` | `validateNewCase`, `buildCase`, `addCase`, `countByStatus`, `casesByCounter`, `changeStatus`, `changePriority`. Se mantienen como reglas puras para validación local antes de enviar al backend. | RF-19, RF-20, RF-21, RF-22, RF-29, RF-30, RF-31 | MODIFICA (se mantienen para validación local; el envío al backend ahora pasa por `caseService`) |
| `src/utils/screenState.js` | `screenState({loading, error, rows})`: decide carga, error, vacío o contenido. | RF-34, RF-35, RF-36 | MODIFICA (se reusa; no se toca si ya funciona) |
| `src/utils/traduccionBackend.js` | Funciones puras `estadoDeBackend`, `estadoABackend`, `prioridadDeBackend`, `prioridadABackend`, `casoDeBackend`. Traducen estados/prioridades entre backend (`Pendiente`/`En proceso`/`Finalizado`, `Alta`/`Media`/`Baja`) y frontend interno (`pendiente`/`en_proceso`/`finalizado`, `alta`/`media`/`baja`). Valor desconocido → `null`; el servicio trata `null` como respuesta inesperada (`construirError`). Usada por `caseService`, `counterService`. | RF-13, RF-19, RF-28, RF-29, RF-30, RF-31 | NUEVO |

### Punto de entrada

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/main.js` | Configura Quasar, Vue, router y stores. Nada de lógica de negocio. | Todos | MODIFICA (registrar stores nuevos si es necesario) |
| `src/App.vue` | Componente raíz con layout base y outlet de rutas. | Todos | MODIFICA (verificar que no necesite cambios; no se toca si ya funciona) |

## 3. Funciones puras

Nota de construcción para validadores de T1 (`validators.js`): `validarCredenciales` devuelve `faltantes` con claves `username` y `password` (no `usuario` ni `contraseña`), las mismas que usa P-1 (`form.username`, `missing.username`, `LOGIN_FIELDS.username`). `validarPrioridad` recibe la forma del backend (`Alta`/`Media`/`Baja`): en P-4 se traduce antes de validar (ver 4.5). No se prueba la parte vacía de `validarPrioridad` (no se inventan valores) ni datos futuros (`hoy` futuro); los casos límite del contrato (`RF-21` a `RF-23`) cubren lo que se prueba.

Nota de construcción para mensajes de T1 (`mensajes.js`): `construirError` construye exactamente `"Qué ocurrió: X. Sobre: Y. Qué hacer: Z."` (tres partes separadas por punto y espacio); se usa solo para errores sin respuesta del backend (`RF-36` con red caído). Si llega `mensaje` del backend (`{ mensaje: "Qué ocurrió sobre qué: qué hacer" }`), se muestra ese mensaje tal cual (`ErrorState.vue`), sin pasar por `construirError`.

Nota de construcción para formateadores de T1 (`formateadores.js`): reciben la forma **del backend** (`Pendiente`, `Alta`, etc.) porque son los que consumen los datos del servicio antes/o después de la traducción; los componentes internos (`PriorityTag.vue`, `CaseRow.vue`) reciben el código interno (`pendiente`, `alta`) y usan sus propios mapas internos (`STATUS_LABELS`, `PRIORITY_LABELS`). No se unifica la cadena de texto porque ambas capas coexisten.

Nota de construcción para utilidades de T1 (`inactividad.js`): `calcularMinutosInactividad` recibe `ultimaActividad` y `hoy` (`Date`); no se prueba con `hoy` futuro ni con `ultimaActividad` nula (no está en el contrato); solo se prueba el límite (`30` minutos exacto) y un caso por encima (`>30`).

Nota de construcción para traducción de T2 (`traduccionBackend.js`): funciones puras; valor desconocido (`null` o no en los 3 estados/prioridades) devuelve `null`; el servicio trata `null` como respuesta inesperada con `construirError` (tres partes). No lanza excepciones ni inventa valores.

Todas las funciones de `src/utils/` son síncronas, sin efectos secundarios y sin depender de Vue, Quasar ni del navegador. Las que trabajan con tiempo reciben `hoy` (objeto `Date`) como parámetro para ser determinísticas en tests.

### `src/utils/validators.js`

```js
validarCredenciales(usuario, password) -> { valido: boolean, faltantes: string[] }
// usuario y password se trimean; vacío o solo espacios cuenta como faltante.

validarCliente(cliente) -> { valido: boolean, error: 'cliente_requerido' | 'cliente_demasiado_largo' | null }
// cliente se trimea; vacío tras trim → 'cliente_requerido'; longitud > 80 tras trim → 'cliente_demasiado_largo'.

validarPrioridad(prioridad) -> { valido: boolean, error: 'prioridad_requerida' | 'prioridad_invalida' | null }
// prioridad debe ser una de: Alta, Media, Baja.
```

### `src/utils/inactividad.js`

```js
calcularMinutosInactividad(ultimaActividad, hoy) -> number
// diferencia en minutos entre hoy y ultimaActividad (redondeado hacia abajo).

estaInactivo(ultimaActividad, hoy, limiteMinutos) -> boolean
// true si calcularMinutosInactividad(ultimaActividad, hoy) > limiteMinutos (30).
```

### `src/utils/formateadores.js`

```js
formatearEstado(estado) -> { texto: string, color: string, tooltip: string }
// Pendiente / En proceso / Finalizado con su texto y tooltip de ayuda.

formatearPrioridad(prioridad) -> { texto: string, color: string, tooltip: string }
// Alta → rojo, Media → ámbar, Baja → verde; texto siempre presente; tooltip de ayuda.
```

### `src/utils/mensajes.js`

```js
construirError(queOcurrio, sobreQue, queHacer) -> { mensaje: string }
// Une las tres partes en español: "Qué ocurrió: X. Sobre: Y. Qué hacer: Z."
```

## 4. Algoritmo en pseudocódigo

### 4.1 Inicio de sesión (RF-01, RF-02, RF-03, RF-04, RF-06, RF-08, RF-09)

```
P-1: usuario envía credenciales
  { valido, faltantes } = validarCredenciales(usuario, password)
  si !valido:
      marcar cada campo en faltantes como inválido
      no avanza  // RF-03
  respuesta = authService.login(usuario, password)
  si respuesta.status == 401 y credenciales inválidas:
      mostrar "Credenciales no válidas. Verifique sus datos e intente nuevamente." (genérico, sin indicar cuál falló)  // RF-04
      no avanza
  si respuesta.ok y rol == 'administrador':
      authService.setToken(respuesta.token)
      authService.setRol('administrador')
      authService.setUsuario(respuesta.usuario)
      inactividad.ultimaActividad = ahora
      iniciarTemporizadorInactividad()
      navegar a /admin/dashboard (P-2)  // RF-02
  si respuesta.ok y rol == 'contador':
      authService.setToken(respuesta.token)
      authService.setRol('contador')
      authService.setUsuario(respuesta.usuario)
      inactividad.ultimaActividad = ahora
      iniciarTemporizadorInactividad()
      navegar a /contador/casos (P-5)  // RF-02
  si respuesta.ok y rol == 'usuarios_de_sistema' u otro:
      mostrar acceso denegado: "Este perfil no tiene pantalla asignada en esta aplicación. Vuelva a P-1 para iniciar sesión con otra cuenta."  // caso límite
      no ofrece pantalla de otro perfil  // RF-08
  // Reemplazo de cuenta activa (RF-10): si hay token previa, authService.logout() best-effort (sin diálogo); si falla, no bloquea; luego setToken con nuevo.
```

### 4.2 Caducidad por inactividad y expiración del token (RF-07, RF-42, RF-43)

```
cada interacción del usuario (clic, tecla, toque):
    inactividad.ultimaActividad = ahora
al iniciar cada petición válida al backend:
    inactividad.ultimaActividad = ahora
al entrar a una pantalla interna (P-2 a P-5) o cada intervalo:
    si estaInactivo(inactividad.ultimaActividad, hoy, 30):
        authService.limpiarSesion()  // elimina token de sessionStorage
        detener temporizador
        mostrar AvisoSesionCaducada con botón "Ir a inicio de sesión" que lleva a P-1  // RF-07
        no hay sesión activa; volver a entrar exige iniciar sesión otra vez

al iniciar cada petición válida al backend (RF-42):
    token = authService.getToken()
    expirado = authService.isTokenExpirado(token, ahora)  // decodifica el campo exp del JWT
    si expirado:
        authService.limpiarSesion()  // elimina token de sessionStorage
        detener temporizador
        mostrar AvisoSesionCaducada con botón "Ir a inicio de sesión" que lleva a P-1  // RF-42, RF-43
        no hay sesión activa; volver a entrar exige iniciar sesión otra vez
    si respuesta del backend es 401 por token expirado o sesión caducada:
        authService.limpiarSesion()
        mostrar AvisoSesionCaducada con botón "Ir a inicio de sesión" que lleva a P-1  // RF-43
```

### 4.3 Validación del token al recargar la página (RF-42, RF-44, lectura protegida con petición según rol)

```
al arranque de la aplicación (montaje / recarga de pestaña):
    token = authService.getToken()  // desde sessionStorage
    si !token:
        navegar a /login (P-1)  // RF-01, RF-44; sin sesión
    si token:
        // Comprobación local sin petición (ahorra llamada si ya expiró el campo exp)
        si authService.isTokenExpirado(token, ahora):  // decodifica exp del JWT
            authService.limpiarSesion()  // elimina token de sessionStorage
            detener temporizador
            mostrar AvisoSesionCaducada con botón "Ir a inicio de sesión" → P-1  // RF-42, RF-43
        si no expiró localmente:
            // Petición protegida según rol derivado del token/rol guardado en sessionStorage
            si rol == 'administrador':
                respuesta = GET /contadores (con Authorization: Bearer <token>)
            si rol == 'contador':
                respuesta = GET /casos/mis-casos (con Authorization: Bearer <token>)
            si respuesta.status == 200 y datos presentes:
                navegar a pantalla principal del perfil (P-2 si admin, P-5 si contador)  // RF-44
                iniciarTemporizadorInactividad()
            si respuesta.status == 401 (token revocado o exp por backend):
                authService.limpiarSesion()  // NO borra datos de pantalla
                mostrar AvisoSesionCaducada con botón "Ir a inicio de sesión" → P-1  // RF-43, RF-42
            si error de red o servidor (respuesta no llega / 500/503):
                mostrar ErrorState con tres partes + botón Reintentar (RF-36, RNF-01)
                NO borrar token de sessionStorage (la sesión sigue viva)  // recarga protegida, referencia 4.3
                al reintentar: repetir la petición protegida según rol; si éxito → pantalla principal
```

Nota: no existe endpoint `/auth/me`; el rol para elegir la petición se toma de `sessionStorage` (guardado en el login). El backend valida el token en cada petición (middleware `authenticateToken`) y responde 401 si está revocado o expirado.

### 4.4 Guard de navegación y acceso denegado (RF-05, RF-06)

```
al intentar entrar a ruta interna (/admin/dashboard, /admin/directorio, /contador/registro, /contador/casos):
    si !authService.getToken():
        navegar a /login con aviso "Debe iniciar sesión para acceder a esta pantalla."  // RF-05
    si hay token:
        rol = authService.getRol()
        si ruta es /admin/dashboard o /admin/directorio y rol != 'administrador':
            mostrar AccessDenied con botón "Volver a mis casos" (P-5)  // RF-06
        si ruta es /contador/registro o /contador/casos y rol != 'contador':
            mostrar AccessDenied con botón "Volver al dashboard" (P-2)  // RF-06
        de lo contrario: permitir entrada
```

### 4.5 Registro de caso (RF-18 a RF-25, RF-26, RF-40, RF-41)

```
P-4: contador envía formulario
  clienteLimpio = cliente.trim()
  { valido, error } = validarCliente(clienteLimpio)
  si error == 'cliente_requerido': mostrar "El cliente es obligatorio. Ingrese el nombre del cliente o empresa."  // RF-21
  si error == 'cliente_demasiado_largo': mostrar "El cliente excede los 80 caracteres permitidos. Reduzca el texto."  // RF-23
  prioridadBackend = prioridadABackend(prioridad)  // el formulario guarda el código interno ('alta'); null si no se eligió
  { valido, error } = validarPrioridad(prioridadBackend)
  si error == 'prioridad_requerida': mostrar "La prioridad es obligatoria. Seleccione Alta, Media o Baja."  // RF-22
  si todo válido:
      respuesta = caseService.crearCaso(clienteLimpio, prioridadBackend)
      si respuesta.ok:
          mostrar confirmación "Caso registrado correctamente." (RF-20, RF-37)
          limpiar formulario (cliente vacío, prioridad sin elegir)  // RF-20
          ofrecer control "Ver mis casos" que abre /contador/casos (P-5)  // RF-41
          el caso se asigna al contador que inició sesión (RF-25)
      si respuesta.error:
          mostrar ErrorState con tres partes y botón Reintentar; al reintentar, repetir la operación (RF-36)
          en P-4 el error impide ver el formulario hasta recuperarse  // RF-36
```

### 4.6 Cambio de estado y prioridad de caso (RF-29, RF-30, RF-31, RF-37)

```
P-5: contador cambia estado o prioridad de caso id
  respuesta = caseService.actualizarCaso(id, {estado, prioridad})  // al menos uno presente
  si respuesta.ok:
      actualizar el caso en la lista local de casos (RF-24, RF-28, RF-29, RF-30)
      se permite cambiar incluso si el caso está en Finalizado, sin restricción ni confirmación (RF-31)
      mostrar confirmación visual "Cambio guardado." (RF-37)
      en P-2 (si administrador está viendo el detalle), al reabrir o recargar el detalle se ven los conteos actualizados (RF-24)
  si respuesta.error:
      mostrar ErrorState con tres partes y botón Reintentar; al reintentar, repetir la operación (RF-36)
```

### 4.7 Carga de datos con estados de interfaz (RF-34, RF-35, RF-36)

```
al abrir P-2, P-3, P-4 o P-5:
  mostrar ScreenLoader (indicador de carga)
  no mostrar datos incompletos ni datos anteriores
  ejecutar petición al backend
  si éxito y hay datos:
      mostrar datos; ocultar indicador de carga
  si éxito y no hay datos (vacío):
      mostrar EmptyState indicando qué información falta (RF-35)
  si error de red o servidor:
      mostrar ErrorState con tres partes + botón Reintentar (RF-36)
      al reintentar: repetir la operación; si éxito, mostrar datos o vacío
      en P-4: no se muestra el formulario mientras hay error
      en P-2: el detalle seleccionado no se conserva; al recuperarse, P-2 se muestra sin contador seleccionado
```

### 4.8 Cierre voluntario de sesión con diálogo (RF-45, RF-46, RF-47)

```
P-2 a P-5: usuario activa control "Cerrar sesión"
  mostrar QDialog con texto "¿Cerrar sesión? Tendrá que iniciar sesión de nuevo." y acciones "Cerrar sesión" / "Cancelar"
  si cancelar (Escape o botón):
      cerrar diálogo; foco vuelve al control; sesión, pantalla y contenido escrito en formularios siguen igual (RF-45)
  si confirmar:
      intentar POST /auth/logout
      si respuesta.ok:
          eliminar token de sessionStorage; detener temporizador; **fijar `avisoSesion` con "Sesión cerrada." (RF-46)**; navegar a /login (P-1) con aviso persistente (RF-46); no mostrar datos internos (RF-09)
      si respuesta.error (red/5xx/401 por token revocado):
          eliminar token igualmente (cierre local); detener temporizador; **fijar `avisoSesion` con mensaje de 3 partes (RF-47)**; navegar a /login (P-1) con aviso persistente (RF-47, RNF-01)
      // `LoginPage.vue`: limpiar `avisoSesion` al escribir en formulario o al enviar credenciales (siguiente acción del usuario, RF-46/RF-47)

si hay carga en curso al confirmar:
      descartar la carga; no llega a mostrarse ningún dato (como caducidad, RF-07, RF-34)
```

Nota: `authService.logout()` no se llama en caducidad (RF-07) ni cierre pestaña (RF-44); el reemplazo de cuenta (RF-10) usa `POST /auth/logout` como best-effort (`RF-45/46/47`) sin diálogo.

## 5. Decisiones y alternativas descartadas

1. **Token en `sessionStorage`** (RF-42, RF-43, RF-44).
   Alternativa descartada: `localStorage`. Se descarta porque la spec (decisión del usuario #2) establece `sessionStorage`: sobrevive a recargas de página pero se limpia al cerrar la pestaña, y cada pestaña tiene su propio almacenamiento (no se comparten sesiones entre pestañas).

2. **Caducidad por inactividad medida desde el cliente, 30 minutos** (RF-07).
   Alternativa descartada: confiar únicamente en el campo `exp` del JWT o en la inactividad medida por el backend. Se descarta porque la spec exige detección desde el cliente y que cada petición válida al backend reinicie el temporizador de inactividad.

3. **Guards centralizados en el router** para protección de rutas (RF-05, RF-06).
   Alternativa descartada: controlar el acceso por perfil dentro de cada vista por separado. Se descarta porque el guard centraliza la lógica, evita repetición en 4 pantallas y garantiza que no se filtre información de otro perfil ni siquiera al cargar la ruta (RNF-05).

4. **Mensajes de error con tres partes en español** (RNF-01, RF-36).
   Alternativa descartada: mensajes técnicos, en inglés o de una sola parte. Se descarta porque `RNF-01` y `RF-36` exigen explícitamente tres partes comprobables: qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario.

5. **No controles de simulación** ("Simular caducidad", "Simular error").
   Alternativa descartada: incluirlos como en la maqueta de la spec 001. Se descarta por decisión del usuario #1. `SimulationControls.vue` se elimina físicamente y sus importaciones en `MaquetaLayout.vue`.

6. **Stores separados por dominio** (sesión, contadores, casos).
   Alternativa descartada: un único store monolítico. Se descarta por claridad, separaciones de responsabilidades y facilidad de prueba.

7. **Etiqueta de prioridad como texto + color**, nunca color como único portador (RNF-06).
   Alternativa descartada: solo color o solo icono. Se descarta porque la spec exige texto siempre presente y contraste mínimo 4.5:1.

8. **Usar `src/pages/` y no `src/views/`**.
   Alternativa descartada: `src/views/` como proponía el borrador inicial del plan. Se descarta porque el proyecto real usa `src/pages/` (AGENTS.md y estructura actual).

9. **Reutilizar componentes de aviso existentes** en lugar de crear nuevos.
   Alternativa descartada: crear `MensajeError.vue`, `MensajeVacio.vue`, `AvisoAccesoDenegado.vue`. Se descarta porque `ErrorState.vue`, `EmptyState.vue` y `AccessDenied.vue` ya existen y cumplen el rol; solo `AvisoSesionCaducada.vue` es nuevo.

10. **Layout propio para login** (`LoginLayout.vue`).
    Alternativa descartada: usar `MaquetaLayout.vue` para P-1. Se descarta porque el usuario decidió que P-1 use un layout distinto, sin menú interno, propio para login.

11. **Utilidades nuevas para lo nuevo; las existentes se conservan** (`accessRules.js`, `caseRules.js`, `constants.js`).
    Las funciones que pide esta spec van en archivos nuevos (`validators.js`, `formateadores.js`, `mensajes.js`, `inactividad.js` en T1/T2; `traduccionBackend.js` en T2), con sus propias pruebas. `accessRules.js` y `caseRules.js` no se reescriben: siguen con sus reglas puras y sus pruebas de la spec 001 en verde, y solo cambia lo que indica cada tarea ⚠️ (por ejemplo, `resolveProfile` en T5). Alternativa descartada: meter las funciones nuevas dentro de `accessRules.js` y `caseRules.js`, porque mezclaría la maqueta 001 con el frontend real y obligaría a tocar archivos que ya funcionan.

12. **Dependencia con la spec 004 (corrección de mayúsculas/minúsculas en login).** La spec 003 exige que el login distinga mayúsculas y minúsculas (RF-04, caso límite "Mayúsculas y minúsculas"). El backend actual (`findByUsername` en `UserModel`, SQL con `=` en MariaDB) no hace esta distinción (case-insensitive por defecto). La corrección está definida en `specs/004-correcciones-backend` (su propio RF-36, que no es el RF-36 de esta spec; área F, tareas T12–T13 de la 004) y **NO está implementada**. Por tanto, mientras no se implemente la 004, el criterio 3 de la 003 (RF-04) se evalúa sobre un backend que aún acepta "admin_seed" igual que "ADMIN_SEED". El frontend no requiere cambios adicionales cuando la 004 se implemente: sigue enviando credenciales tal cual y trata cualquier 401 como inválida, sin distinguir qué campo falló. No se modifica la spec 004 ni el backend en esta 003.

13. **Peticiones HTTP con axios y límite de 15 s** (RF-34, RF-36). Decisión del usuario; **dependencia nueva aprobada por el usuario** (`axios` `^1.20.0` ya instalado en `package.json` antes de T3; T3 solo la usa).
    `api.js` crea una instancia de axios con `baseURL`, `timeout: 15000` e interceptores para el token y los errores: si el backend no responde en 15 s, la petición se cancela y se muestra el error de tres partes con «Reintentar». Se elige axios porque la aplicación crecerá con más módulos (otras APIs, subida y descarga de archivos, reintentos) y es la herramienta que el usuario usa en todos sus proyectos Quasar. La instancia vive en `src/services/api.js` (capa de servicios del proyecto) y no en un archivo de arranque `src/boot/axios.js`, para no modificar `quasar.config.js`. Alternativa descartada: `fetch` nativo con `AbortController`, que no añade dependencias pero obliga a reescribir a mano lo que axios ya resuelve cuando lleguen los módulos nuevos. Alternativas de límite descartadas: 10 s (puede cortar una petición que sí iba a responder) y 30 s (el indicador de carga gira demasiado cuando el backend no responde).

14. **La prioridad de P-4 se traduce antes de validar.** Decisión del usuario.
    El formulario de P-4 y los componentes siguen con los códigos internos (`alta`/`media`/`baja`); la pantalla traduce con `prioridadABackend` y después valida con `validarPrioridad`, que recibe la forma del backend como afirman las pruebas de T1. Alternativa descartada: cambiar las opciones del formulario a `Alta`/`Media`/`Baja`, porque obligaría a tocar `NewCasePage.vue` y las constantes de la maqueta sin necesidad.

## 6. Estrategia de tests con `node --test`

- Ejecutarse desde `Seguimiento-proyectos/`: `node --test`
- Sin instalar paquetes adicionales para tests (Constitución, Principio 2).
- Archivos de test existentes (spec 001, 105 pruebas):
  - `test/accessRules.test.js`: prueba `validateLoginForm`, `normalizeCredential`, `resolveProfile`. Puede verse afectada si `resolveProfile` cambia para recibir las cuentas desde `authService` en lugar de `exampleData.js`. Las pruebas de `validateLoginForm` y `normalizeCredential` son puras y no cambian.
  - `test/caseRules.test.js`: prueba `validateNewCase`, `buildCase`, `addCase`, `countByStatus`, `casesByCounter`, `changeStatus`, `changePriority`. No se ven afectadas por el cambio al backend porque son funciones puras que operan sobre arreglos en memoria; se siguen usando para validación local antes de enviar al backend.
  - `test/exampleData.test.js`: prueba los datos de ejemplo de `exampleData.js`. Puede verse afectada si `exampleData.js` deja de ser la fuente de verdad. Se mantienen en verde como documentación de los datos semilla; ya no se usan en tiempo de ejecución.
  - `test/maquetaStore.test.js`: prueba el store de la maqueta. Puede verse afectada si `maqueta.js` deja de usarse. Se mantienen en verde; el store de maqueta se conserva pero ya no alimenta las pantallas.
  - `test/screenState.test.js`: prueba `screenState`. No se ven afectadas.
  - `test/layout-drawer-check.js`: verifica el drawer del layout. No se ven afectadas.
  - `test/t9Pages.test.js`: verifica que las páginas existan y tengan títulos. Pueden verse afectadas si cambian los nombres de archivo de las páginas; se mantienen en verde si los nombres de `pages/` se conservan.
  - **Ningún test de `test/` menciona `SimulationControls.vue`.** La única referencia a `SimulationControls` en el código fuente es su importación y uso en `src/layouts/MaquetaLayout.vue`. Al eliminar el archivo y su importación, no hay tests de unidad que fallen por ello.
- Archivos de test nuevos (T2 incluye el archivo y su test de traducción; T1 se mantiene cerrado con los 4 archivos):
  - `test/validators.test.js`: `validarCredenciales`, `validarCliente`, `validarPrioridad` (RF-03, RF-21, RF-22, RF-23).
  - `test/inactividad.test.js`: `calcularMinutosInactividad` y `estaInactivo` con `hoy` inyectado, casos límite exactamente en el límite (RF-07).
  - `test/formateadores.test.js`: `formatearEstado` y `formatearPrioridad` devuelven texto + color correctos (RF-13, RF-28, RNF-06).
  - `test/mensajes.test.js`: `construirError` devuelve las tres partes en español (RF-36, RNF-01).
  - `test/traduccionBackend.test.js`: `estadoDeBackend`, `estadoABackend`, `prioridadDeBackend`, `prioridadABackend`, `casoDeBackend`; ida y vuelta (`estadoDeBackend(estadoABackend(x)) === x`); valor desconocido devuelve `null`; `node --test` verde.
- **Cierre voluntario (RF-45/46/47):** no introduce lógica pura independiente del servicio/estado; el mensaje/aviso depende de la respuesta de `authService.logout()` (efecto secundario) y del store (`avisoSesion`). No se crea archivo de test nuevo para cierre; la verificación es manual en T10 (criterio 31). Si en futuro se extrae una función pura `determinarAvisoCierre(resultadoLogout)` o `limpiarAviso()` podría añadirse, pero no es necesaria ahora.
- **Puerta de calidad:** ninguna tarea se da por hecha con tests en rojo (Constitución, Principio 2). Antes de cerrar la spec, `node --test` desde `Seguimiento-proyectos/` debe pasar en verde sin tests fallando, cubriendo los 31 criterios de finalización de la spec.

## 7. Trazabilidad RF → parte del plan

| RF | Parte del plan |
|---|---|
| RF-01 | 4.1 login, `authService.login`, router `/login`, `src/pages/LoginPage.vue`, `src/layouts/LoginLayout.vue` |
| RF-02 | 4.1 login, `sessionStorage` (token, rol, usuario), redirección a P-2 o P-5 |
| RF-03 | 4.1 login, `validarCredenciales`, `validateLoginForm`, campos faltantes señalados |
| RF-04 | 4.1 login, mensaje genérico de credenciales no válidas |
| RF-05 | 4.4 guard de navegación, sin sesión → P-1 |
| RF-06 | 4.4 guard de navegación, perfil incorrecto → acceso denegado, `src/components/AccessDenied.vue` |
| RF-07 | 4.2 caducidad por inactividad, `estaInactivo` con `hoy`, limpiar `sessionStorage`, `AvisoSesionCaducada.vue` |
| RF-08 | 4.1 login, perfil determinado por la cuenta, no se elige manualmente |
| RF-09 | 4.4 guard de navegación, sin sesión no se muestra información |
| RF-10 | 4.1 login (reemplazo de cuenta activa) + `authService.logout()` (`RF-10`, best-effort, `RF-45/46/47`) + nuevo token; sin cerrar sesión anterior por caducidad (ya no hay sesión) |
| RF-11 | 2. `counterService.listCounters`, vista `src/pages/AdminDashboardPage.vue` |
| RF-12 | 2. `CounterCountsRow.vue`, conteos con ceros incluidos |
| RF-13 | 2. `PriorityTag.vue`, `CaseRow.vue`, detalle de contador, solo lectura para admin |
| RF-14 | 4.7, mensaje de vacío cuando contador no tiene casos |
| RF-15 | 4.7, reemplazo de detalle al cambiar de contador |
| RF-16 | 2. `counterService`, `src/pages/CountersDirectoryPage.vue` solo nombres |
| RF-17 | 4.4, selección en P-3 abre P-2 con contador seleccionado |
| RF-18 | 2. `src/pages/NewCasePage.vue`, formulario cliente + prioridad, Pendiente y contador no editables |
| RF-19 | 2. `PriorityTag.vue`, tres prioridades con texto + color |
| RF-20 | 4.5 registro válido, confirmación, formulario vacío, "Ver mis casos" |
| RF-21 | 4.5, `validarCliente`, cliente obligatorio |
| RF-22 | 4.5, `validarPrioridad`, prioridad obligatoria |
| RF-23 | 4.5, cliente > 80 caracteres rechazado |
| RF-24 | 4.6, cambio se refleja en P-5 y en conteos/detalle de P-2 |
| RF-25 | 4.5, caso asignado al contador autenticado, sin regla de reparto |
| RF-26 | 2. `src/pages/NewCasePage.vue` y `src/pages/MyCasesPage.vue`, sin editar/eliminar casos ni contadores |
| RF-27 | 2. `src/pages/MyCasesPage.vue`, casos del contador autenticado |
| RF-28 | 2. `src/pages/MyCasesPage.vue`, cliente/estado/prioridad por caso |
| RF-29 | 4.6, cambio de estado de caso propio |
| RF-30 | 4.6, cambio de prioridad de caso propio |
| RF-31 | 4.6, cambio permitido incluso desde Finalizado, sin restricción |
| RF-32 | 4.4, contador solo ve sus propios casos |
| RF-33 | 4.7, mensaje de vacío "No tiene casos registrados" + "Registrar caso" |
| RF-34 | 4.7, `ScreenLoader`, indicador de carga antes de mostrar datos |
| RF-35 | 4.7, `EmptyState` cuando no hay información |
| RF-36 | 4.7, `ErrorState` con tres partes + reintentar |
| RF-37 | 4.6, confirmación visual de cambio de estado/prioridad |
| RF-38 | 2. router, control de regreso en pantallas internas, `MaquetaLayout.vue` |
| RF-39 | 2. `src/pages/AdminDashboardPage.vue`, control "Ver directorio" abre P-3 |
| RF-40 | 2. `src/pages/MyCasesPage.vue`, control "Registrar caso" siempre visible |
| RF-41 | 4.5, control "Ver mis casos" en P-4 abre P-5 |
| RF-42 | 2. `authService`, token guardado en `sessionStorage`; 4.2/4.3 validación del campo `exp` del JWT; 4.1 envío del token en `Authorization: Bearer` en cada petición |
| RF-43 | 4.2, token eliminado de `sessionStorage` al caducar por inactividad (30 min) o por expiración del campo `exp`; aviso de sesión caducada con acceso a P-1 |
| RF-44 | 4.3, validación del token con backend al recargar (si válido → pantalla principal del perfil; si no → P-1); `sessionStorage` independiente por pestaña; se limpia al cerrar pestaña |
| RF-45 | 4.8, control "Cerrar sesión" en `MaquetaLayout.vue` con diálogo `QDialog`; disponible solo P-2 a P-5; cancelar no cambia nada; foco, Escape, 44×44 px, tooltip (RNF-02/03/07) |
| RF-46 | 4.8, confirmar diálogo → `POST /auth/logout`, borrar token, `avisoSesion` persistente en `LoginPage.vue`, ir a P-1, sin datos internos (RF-09) |
| RF-47 | 4.8, `POST /auth/logout` falla → cierre local igual + `avisoSesion` de 3 partes (RNF-01); limpieza con escribir/enviar en P-1 |
| RNF-01 | `src/utils/mensajes.js`, todos los mensajes de error con tres partes; `avisoSesion` de cierre usa las 3 partes |
| RNF-02 | Vistas y componentes, responsivo 360–1024+, controles táctiles ≥ 44×44 px (control de cierre incluido) |
| RNF-03 | Tooltips en prioridades, estados, conteos, campos, registro, acceso denegado, sesión caducada |
| RNF-04 | Cada vista tiene un título visible y distinto (`meta.titulo` en el router) |
| RNF-05 | Guards de navegación, contador no ve datos de otro contador |
| RNF-06 | `PriorityTag.vue`, texto + color, contraste ≥ 4.5:1 |
| RNF-07 | Recorrido completo con teclado, foco visible, avisos como texto |
| RNF-08 | Nombres largos y caracteres especiales se muestran completos |
| RNF-09 | Listas con desplazamiento vertical, sin paginación |