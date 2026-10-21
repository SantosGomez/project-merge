# Plan 003 — Frontend funcional conectado al backend

Spec: `specs/003-frontend-funcional/spec.md` (Estado: aprobada por el usuario) · Plan para implementar dentro de `Seguimiento-proyectos/`.

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

### Servicios (capa de comunicación con el backend)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/services/api.js` | Instancia HTTP baseURL `http://localhost:3000`, interceptor que añade `Authorization: Bearer <token>` desde `sessionStorage` a cada petición, manejo centralizado de errores de red y respuestas 401/403. | RF-02, RF-04, RF-05, RF-07, RF-34, RF-36 | NUEVO |
| `src/services/authService.js` | `login(usuario, password)`, `logout()`, `getToken()`, `setToken(token)`, `getRol()`, `getUsuario()`, `limpiarSesion()`. Lee/escribe `sessionStorage`. | RF-01, RF-02, RF-03, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10 | NUEVO |
| `src/services/counterService.js` | `listCounters()`, `getConteosPorEstado(id)`, `getCasosPorContador(id)`. Lectura exclusiva para administrador. | RF-11, RF-12, RF-13, RF-14, RF-15, RF-16 | NUEVO |
| `src/services/caseService.js` | `getMisCasos()`, `crearCaso(cliente, prioridad)`, `actualizarCaso(id, {estado, prioridad})`. Escritura exclusiva para contador sobre sus propios casos. | RF-15, RF-17, RF-18, RF-19, RF-20, RF-21, RF-22, RF-29, RF-30 | NUEVO |
| `src/services/exampleData.js` | Deja de usarse como origen de datos; se sustituye por llamadas a los servicios HTTP anteriores. Los datos de ejemplo dejan de ser la fuente de verdad. | Todos | MODIFICA (deja de usarse) |

### Stores (estado reactivo de la aplicación)

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/stores/session.js` | Token, rol, usuario, autenticado, bandera de sesión caducada, último momento de actividad, temporizador de inactividad (30 min). | RF-02, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10 | NUEVO |
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
| `src/pages/LoginPage.vue` | P-1: formulario usuario/contraseña, validación de campos vacíos o solo espacios, mensaje genérico de credenciales no válidas, redirección al perfil tras login válido. Usa `LoginLayout.vue` (sin menú interno). | RF-01, RF-03, RF-04 | MODIFICA (`src/pages/LoginPage.vue` existe; se sustituye login en memoria por `authService.login` y se cambia su layout) |
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
| `src/layouts/MaquetaLayout.vue` | Layout común de pantallas internas (P-2 a P-5): título, regreso, aviso de acceso denegado, aviso de sesión caducada. Se quitan los controles de simulación y se integra `AvisoSesionCaducada.vue`. | RF-38, RF-06, RF-07 | MODIFICA (se quita `SimulationControls.vue`; se añade `AvisoSesionCaducada.vue`) |

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

### Punto de entrada

| Archivo | Responsabilidad | RF | Estado |
|---|---|---|---|
| `src/main.js` | Configura Quasar, Vue, router y stores. Nada de lógica de negocio. | Todos | MODIFICA (registrar stores nuevos si es necesario) |
| `src/App.vue` | Componente raíz con layout base y outlet de rutas. | Todos | MODIFICA (verificar que no necesite cambios; no se toca si ya funciona) |

## 3. Funciones puras

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
```

### 4.2 Caducidad por inactividad (RF-07)

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
```

### 4.3 Guard de navegación y acceso denegado (RF-05, RF-06)

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

### 4.4 Registro de caso (RF-18 a RF-25, RF-26, RF-40, RF-41)

```
P-4: contador envía formulario
  clienteLimpio = cliente.trim()
  { valido, error } = validarCliente(clienteLimpio)
  si error == 'cliente_requerido': mostrar "El cliente es obligatorio. Ingrese el nombre del cliente o empresa."  // RF-21
  si error == 'cliente_demasiado_largo': mostrar "El cliente excede los 80 caracteres permitidos. Reduzca el texto."  // RF-23
  { valido, error } = validarPrioridad(prioridad)
  si error == 'prioridad_requerida': mostrar "La prioridad es obligatoria. Seleccione Alta, Media o Baja."  // RF-22
  si todo válido:
      respuesta = caseService.crearCaso(clienteLimpio, prioridad)
      si respuesta.ok:
          mostrar confirmación "Caso registrado correctamente." (RF-20, RF-37)
          limpiar formulario (cliente vacío, prioridad sin elegir)  // RF-20
          ofrecer control "Ver mis casos" que abre /contador/casos (P-5)  // RF-41
          el caso se asigna al contador que inició sesión (RF-25)
      si respuesta.error:
          mostrar ErrorState con tres partes y botón Reintentar; al reintentar, repetir la operación (RF-36)
          en P-4 el error impide ver el formulario hasta recuperarse  // RF-36
```

### 4.5 Cambio de estado y prioridad de caso (RF-29, RF-30, RF-31, RF-37)

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

### 4.6 Carga de datos con estados de interfaz (RF-34, RF-35, RF-36)

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

11. **Extender utilidades existentes** (`accessRules.js`, `caseRules.js`, `constants.js`) en lugar de crear archivos nuevos para todo.
    Alternativa descartada: crear `validators.js`, `formateadores.js`, `mensajes.js`, `inactividad.js` desde cero sin reusar lo existente. Se descarta porque `accessRules.js` y `caseRules.js` ya contienen reglas puras probadas con `node --test` (105 pruebas verdes); se prefieren modificar y extender esos archivos existentes en lugar de duplicar lógica.

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
- Archivos de test nuevos:
  - `test/validators.test.js`: `validarCredenciales`, `validarCliente`, `validarPrioridad` (RF-03, RF-21, RF-22, RF-23).
  - `test/inactividad.test.js`: `calcularMinutosInactividad` y `estaInactivo` con `hoy` inyectado, casos límite exactamente en el límite (RF-07).
  - `test/formateadores.test.js`: `formatearEstado` y `formatearPrioridad` devuelven texto + color correctos (RF-13, RF-28, RNF-06).
  - `test/mensajes.test.js`: `construirError` devuelve las tres partes en español (RF-36, RNF-01).
- **Puerta de calidad:** ninguna tarea se da por hecha con tests en rojo (Constitución, Principio 2). Antes de cerrar la spec, `node --test` desde `Seguimiento-proyectos/` debe pasar en verde sin tests fallando, cubriendo los 30 criterios de finalización de la spec.

## 7. Trazabilidad RF → parte del plan

| RF | Parte del plan |
|---|---|
| RF-01 | 4.1 login, `authService.login`, router `/login`, `src/pages/LoginPage.vue`, `src/layouts/LoginLayout.vue` |
| RF-02 | 4.1 login, `sessionStorage` (token, rol, usuario), redirección a P-2 o P-5 |
| RF-03 | 4.1 login, `validarCredenciales`, `validateLoginForm`, campos faltantes señalados |
| RF-04 | 4.1 login, mensaje genérico de credenciales no válidas |
| RF-05 | 4.3 guard de navegación, sin sesión → P-1 |
| RF-06 | 4.3 guard de navegación, perfil incorrecto → acceso denegado, `src/components/AccessDenied.vue` |
| RF-07 | 4.2 caducidad por inactividad, `estaInactivo` con `hoy`, limpiar `sessionStorage`, `AvisoSesionCaducada.vue` |
| RF-08 | 4.1 login, perfil determinado por la cuenta, no se elige manualmente |
| RF-09 | 4.3 guard de navegación, sin sesión no se muestra información |
| RF-10 | 4.1 login, reenviar credenciales de otra cuenta reemplaza token y perfil |
| RF-11 | 2. `counterService.listCounters`, vista `src/pages/AdminDashboardPage.vue` |
| RF-12 | 2. `CounterCountsRow.vue`, conteos con ceros incluidos |
| RF-13 | 2. `PriorityTag.vue`, `CaseRow.vue`, detalle de contador, solo lectura para admin |
| RF-14 | 4.6, mensaje de vacío cuando contador no tiene casos |
| RF-15 | 4.6, reemplazo de detalle al cambiar de contador |
| RF-16 | 2. `counterService`, `src/pages/CountersDirectoryPage.vue` solo nombres |
| RF-17 | 4.3, selección en P-3 abre P-2 con contador seleccionado |
| RF-18 | 2. `src/pages/NewCasePage.vue`, formulario cliente + prioridad, Pendiente y contador no editables |
| RF-19 | 2. `PriorityTag.vue`, tres prioridades con texto + color |
| RF-20 | 4.4 registro válido, confirmación, formulario vacío, "Ver mis casos" |
| RF-21 | 4.4, `validarCliente`, cliente obligatorio |
| RF-22 | 4.4, `validarPrioridad`, prioridad obligatoria |
| RF-23 | 4.4, cliente > 80 caracteres rechazado |
| RF-24 | 4.5, cambio se refleja en P-5 y en conteos/detalle de P-2 |
| RF-25 | 4.4, caso asignado al contador autenticado, sin regla de reparto |
| RF-26 | 2. `src/pages/NewCasePage.vue` y `src/pages/MyCasesPage.vue`, sin editar/eliminar casos ni contadores |
| RF-27 | 2. `src/pages/MyCasesPage.vue`, casos del contador autenticado |
| RF-28 | 2. `src/pages/MyCasesPage.vue`, cliente/estado/prioridad por caso |
| RF-29 | 4.5, cambio de estado de caso propio |
| RF-30 | 4.5, cambio de prioridad de caso propio |
| RF-31 | 4.5, cambio permitido incluso desde Finalizado, sin restricción |
| RF-32 | 4.3, contador solo ve sus propios casos |
| RF-33 | 4.6, mensaje de vacío "No tiene casos registrados" + "Registrar caso" |
| RF-34 | 4.6, `ScreenLoader`, indicador de carga antes de mostrar datos |
| RF-35 | 4.6, `EmptyState` cuando no hay información |
| RF-36 | 4.6, `ErrorState` con tres partes + reintentar |
| RF-37 | 4.5, confirmación visual de cambio de estado/prioridad |
| RF-38 | 2. router, control de regreso en pantallas internas, `MaquetaLayout.vue` |
| RF-39 | 2. `src/pages/AdminDashboardPage.vue`, control "Ver directorio" abre P-3 |
| RF-40 | 2. `src/pages/MyCasesPage.vue`, control "Registrar caso" siempre visible |
| RF-41 | 4.4, control "Ver mis casos" en P-4 abre P-5 |
| RF-42 | 2. `authService`, token guardado en `sessionStorage` al iniciar sesión |
| RF-43 | 4.2, token eliminado de `sessionStorage` al caducar por inactividad |
| RF-44 | 2. `sessionStorage`, se limpia al cerrar la pestaña; cada pestaña independiente |
| RNF-01 | `src/utils/mensajes.js`, todos los mensajes de error con tres partes |
| RNF-02 | Vistas y componentes, responsivo 360–1024+, controles táctiles ≥ 44×44 px |
| RNF-03 | Tooltips en prioridades, estados, conteos, campos, registro, acceso denegado, sesión caducada |
| RNF-04 | Cada vista tiene un título visible y distinto (`meta.titulo` en el router) |
| RNF-05 | Guards de navegación, contador no ve datos de otro contador |
| RNF-06 | `PriorityTag.vue`, texto + color, contraste ≥ 4.5:1 |
| RNF-07 | Recorrido completo con teclado, foco visible, avisos como texto |
| RNF-08 | Nombres largos y caracteres especiales se muestran completos |
| RNF-09 | Listas con desplazamiento vertical, sin paginación |