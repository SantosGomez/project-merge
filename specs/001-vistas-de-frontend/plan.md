# Plan 001 — Maqueta navegable de las vistas

Spec: `specs/001-vistas-de-frontend/spec.md` (Estado: aprobada) · Plan para implementar dentro de `Seguimiento-proyectos/`.

## 1. Alcance del plan

- Se construye **solo la maqueta navegable** de las cinco pantallas (P-1 a P-5) con datos de ejemplo en memoria.
- **Fuera de alcance** (spec, sección Fuera de alcance): `Backend/`, cualquier API, persistencia entre recargas, sincronización entre pestañas, autenticación real y reglas de reparto.
- No se instalan paquetes nuevos: se usa lo ya presente (Quasar v2, Vue 3, vue-router, Pinia) y `node --test` para la lógica pura (constitución, Principio 2).

## 2. Archivos y responsabilidades

Todos los archivos nuevos viven en `Seguimiento-proyectos/src/` (y `Seguimiento-proyectos/test/`), respetando la estructura de `AGENTS.md`. **Todo archivo o carpeta nueva requiere la aprobación del usuario antes de crearse** (límites de `AGENTS.md`).

### Utilidades (lógica pura, sin Vue, importable por `node --test`)

| Archivo | Responsabilidad | RF |
|---|---|---|
| `src/utils/constants.js` | Valores únicos del dominio: estados (`pendiente`, `en_proceso`, `finalizado`), prioridades (`alta`, `media`, `baja`), etiquetas en español, colores por prioridad, perfiles (`administrador`, `contador`), textos de los controles de simulación. | RF-12, RF-20, RF-32, RF-38, RNF-1, RNF-7 |
| `src/utils/caseRules.js` | Reglas puras de los casos: validar el registro, contar por estado, agregar un caso, cambiar estado, cambiar prioridad, filtrar por contador. | RF-12, RF-21 a RF-26, RF-29 a RF-34 |
| `src/utils/accessRules.js` | Reglas puras de acceso: normalizar credenciales (quitar espacios extremos), detectar campos faltantes, resolver el perfil de una cuenta. | RF-2, RF-3, RF-4, RF-8 |
| `src/utils/screenState.js` | Regla pura del estado de una pantalla: dado `{ cargando, error, filas }` devuelve `cargando` \| `error` \| `vacio` \| `contenido`. | RF-35, RF-36, RF-37 |

### Datos y estado

| Archivo | Responsabilidad | RF |
|---|---|---|
| `src/services/exampleData.js` | Semilla de los datos de ejemplo: contadores, casos y cuentas de ejemplo. Es la única fuente del contenido ficticio. | RF-45, RF-2, RF-12, RF-14, RF-34 |
| `src/stores/maqueta.js` (Pinia) | Estado de la maqueta **solo en memoria**: sesión (perfil, cuenta), conjunto de casos, contador seleccionado, banderas de carga/error por pantalla y acciones (iniciar sesión, cerrar sesión, registrar caso, cambiar estado/prioridad, simular error, simular caducidad). Delega toda decisión en `utils/`. | RF-7, RF-9, RF-21, RF-25, RF-30, RF-31, RF-38, RF-41 |

### Interfaz

| Archivo | Responsabilidad | RF |
|---|---|---|
| `src/router/index.js` (modificado) | Las cinco direcciones, la meta de cada ruta (`requiereSesion`, `perfil`) y el guard que resuelve sesión, perfil y regreso. Reemplaza las rutas de la plantilla de Quasar. | RF-1, RF-5, RF-6, RF-40 |
| `src/layouts/MaquetaLayout.vue` | Marco común de las pantallas internas: título visible de la pantalla, control de regreso, controles "Simular caducidad" y "Simular error" con su ayuda contextual. | RF-7, RF-38, RF-40, RNF-3, RNF-5 |
| `src/pages/LoginPage.vue` | **P-1**: formulario de acceso, avisos de campo faltante y de credenciales no válidas, aviso de sesión caducada. | RF-1, RF-2, RF-3, RF-4, RF-8, RF-9, RNF-8 |
| `src/pages/AdminDashboardPage.vue` | **P-2**: contadores con sus tres conteos, detalle al seleccionar, control "Ver directorio". | RF-11 a RF-15, RF-42, RNF-9, RNF-10 |
| `src/pages/CountersDirectoryPage.vue` | **P-3**: nombres de los contadores; al elegir uno, abre P-2 con ese contador seleccionado. | RF-16, RF-17, RNF-10 |
| `src/pages/NewCasePage.vue` | **P-4**: formulario de registro con estado Pendiente y contador asignado no editables; confirmación con formulario limpio y control "Ver mis casos". | RF-19 a RF-25, RF-43 |
| `src/pages/MyCasesPage.vue` | **P-5**: casos propios con cambio de estado y de prioridad; estado vacío con control "Registrar caso". | RF-28 a RF-34, RF-43, RF-44 |
| `src/components/PriorityTag.vue` | Etiqueta de prioridad: texto + color, siempre con el texto, contraste ≥ 4.5:1. | RNF-7, RF-20, RF-29 |
| `src/components/ScreenLoader.vue` | Indicador de carga con el texto correspondiente. | RF-35, RNF-8 |
| `src/components/EmptyState.vue` | Mensaje de vacío con el texto que indica qué falta y, si aplica, el control de acción. | RF-36, RF-14, RF-34 |
| `src/components/ErrorState.vue` | Mensaje de error (qué ocurrió, sobre qué dato o acción, y qué hacer) con botón de reintento. | RF-37, RNF-1 |
| `src/components/AccessDenied.vue` | Aviso de acceso denegado con vuelta a la pantalla principal del perfil. | RF-6 |
| `src/components/SimulationControls.vue` | Los dos controles de simulación con su ayuda contextual, dentro del layout. | RF-7, RF-38, RNF-3 |
| `src/components/CounterCountsRow.vue` | Fila de un contador con sus tres conteos (incluido "0") y su selección. | RF-12, RF-13, RF-15 |
| `src/components/CaseRow.vue` | Fila de un caso con cliente, estado, etiqueta de prioridad y, en P-5, los selectores de estado y prioridad. | RF-13, RF-26, RF-29 a RF-33, RNF-9 |

### Tests

| Archivo | Responsabilidad |
|---|---|
| `test/exampleData.test.js` | Comprueba el contenido obligatorio de los datos de ejemplo, incluido el volumen que desborda P-2, P-3 y el detalle de un contador con muchos casos (RF-45). |
| `test/caseRules.test.js` | Validación del registro, conteos por estado, alta de caso, cambios de estado/prioridad y filtrado (RF-12, RF-21 a RF-26, RF-30 a RF-34). |
| `test/accessRules.test.js` | Credenciales, campos faltantes y resolución de perfil (RF-2, RF-3, RF-4, RF-8). |
| `test/screenState.test.js` | Estado de pantalla: carga, error, vacío y contenido, y sus prioridades (RF-35 a RF-37). |

### Archivos existentes que quedan sin uso

`src/pages/index.vue`, `src/pages/index/(index).vue`, `src/pages/index/second.vue`, `src/pages/[...path].vue`, `src/components/EssentialLink.vue` y `src/stores/example-store.js` son de la plantilla de Quasar. El router dejará de usarlos. **No se eliminan sin aprobación** (regla de `AGENTS.md`); el plan solo los deja inertes.

## 3. Funciones puras

No hay fechas en esta spec: la maqueta no calcula plazos, vencimientos ni rachas, así que **ninguna función recibe `hoy`**. Todas son síncronas, sin efectos secundarios y sin depender de Vue ni del navegador.

```js
// utils/constants.js
STATUSES = ['pendiente', 'en_proceso', 'finalizado']
PRIORITIES = ['alta', 'media', 'baja']
STATUS_LABELS = { pendiente: 'Pendiente', en_proceso: 'En proceso', finalizado: 'Finalizado' }
PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' }
PRIORITY_COLORS = { alta: 'red', media: 'amber', baja: 'green' }
PROFILES = { administrador: 'administrador', contador: 'contador' }
MAX_CLIENT_LENGTH = 80
SIMULATION = { error: 'Simular error', expiry: 'Simular caducidad' }

// utils/accessRules.js
normalizeCredential(value) -> string            // quita espacios al inicio y al final
validateLoginForm(username, password) -> { valid, missing: ['username'|'password'] }
resolveProfile(username, password, accounts) -> 'administrador' | 'contador' | null  // distingue mayúsculas

// utils/screenState.js
screenState({ loading, error, rows }) -> 'cargando' | 'error' | 'vacio' | 'contenido'

// utils/caseRules.js
validateNewCase({ client, priority }) -> { valid, errorCode }        // 'client_required' | 'client_too_long' | 'priority_required'
buildCase({ client, priority, counterId, nextId }) -> caso            // estado inicial 'pendiente'
addCase(cases, { client, priority, counterId, nextId }) -> casos      // nuevo arreglo
countByStatus(cases) -> { pendiente, en_proceso, finalizado }         // con ceros
casesByCounter(cases, counterId) -> casos
changeStatus(cases, caseId, status) -> casos                          // nuevo arreglo
changePriority(cases, caseId, priority) -> casos                      // nuevo arreglo
```

## 4. Algoritmo en pseudocódigo

### 4.1 Guard de navegación (RF-1, RF-5, RF-6, RF-40)

```
al navegar hacia `to`:
  sesion = store.session
  si to  es P-1: mostrar P-1 (si hay sesión, se mantiene: RF-10)
  si to requiere sesión y no hay sesion:
      ir a P-1 con aviso "inicia sesión para continuar"          # RF-5
      volver
  si to declara un perfil y sesion.profile != to.profile:
      renderizar <AccessDenied> en esa dirección, con botón "volver a mi pantalla principal"
      (la dirección se mantiene, para poder comprobar el acceso directo)   # RF-6
  si no: renderizar la página de `to`
```

### 4.2 Inicio de sesión (RF-2 a RF-4, RF-8, RF-9)

```
al enviar P-1:
  { valid, missing } = validateLoginForm(username, password)
  si no valid: mostrar un aviso por cada campo faltante; quedarse en P-1     # RF-3
  perfil = resolveProfile(username, password, accounts)                      # distingue mayúsculas
  si perfil es null: mostrar "credenciales no válidas" (genérico); quedarse   # RF-4
  guardar sesión { profile, account } y abrir la pantalla principal del perfil:
      administrador -> P-2 ; contador -> P-5                                  # RF-2, RF-8
```

### 4.3 Carga simulada y estados de pantalla (RF-35 a RF-37)

```
al entrar en una pantalla con datos (P-2, P-3, P-4, P-5):
  loading = true; error = false
  tras ~1 segundo: loading = false
  estado = screenState({ loading, error, rows })
      'cargando'  -> <ScreenLoader>
      'error'     -> <ErrorState> con botón "reintentar"
      'vacio'     -> <EmptyState>
      'contenido' -> la lista o el formulario

al pulsar "Simular error": error = true      # sustituye lo que hubiera en pantalla (RF-37, RF-38)
al pulsar "reintentar":    repetir la carga desde el inicio
                           en P-2, selectedCounterId = null                  # RF-37

al pulsar "Simular caducidad":
  limpiar sesión; error = false; mostrar aviso de sesión caducada con acceso a P-1   # RF-7
```

### 4.4 Registro de un caso (RF-19 a RF-25, RF-43, RF-44)

```
al abrir P-4: contador asignado = sesión actual (no editable); estado = Pendiente (no editable)
al enviar:
  { valid, errorCode } = validateNewCase({ client, priority })
  si no valid: mostrar el mensaje del código y no agregar                # RF-22, RF-23, RF-24
  si valid:
      cases = addCase(cases, { client, priority, counterId: sesión, nextId })
      mostrar confirmación; limpiar el formulario; quedarse en P-4       # RF-21
  el control "Ver mis casos" abre P-5                                    # RF-44
```

### 4.5 Cambio de estado o de prioridad (RF-25, RF-30 a RF-33, RF-39)

```
al cambiar el estado de un caso (P-5):
  cases = changeStatus(cases, caseId, nuevoEstado)     # sin restricción, también si estaba finalizado
  mostrar confirmación del cambio                                       # RF-39
  los conteos de P-2 se recalculan con countByStatus al mostrarse (misma sesión)   # RF-30
al cambiar la prioridad: igual con changePriority                        # RF-31, RF-32
el administrador nunca ve estos controles                                # RF-13
```

### 4.6 Reinicio de la sesión de la maqueta (RF-41)

```
estado inicial = {
  session: null,
  cases: ejemplo de services/exampleData.js,
  selectedCounterId: null,
  screens: { }   // carga, error y vacío por pantalla
}
# todo vive en memoria: al recargar o cerrar la pestaña, el estado vuelve al inicial y P-1 se muestra (RF-41)
```

## 5. Interfaz (pantallas, direcciones y recorrido)

| Pantalla | Dirección | Perfil | Controles propios |
|---|---|---|---|
| P-1 Inicio de sesión | `/login` | ninguno | usuario, contraseña, enviar |
| P-2 Dashboard del administrador | `/admin/dashboard` | administrador | seleccionar contador, "Ver directorio" (RF-42) |
| P-3 Directorio de contadores | `/admin/directorio` | administrador | elegir un nombre (RF-17) |
| P-4 Registro de caso | `/contador/registro` | contador | enviar registro (RF-21), "Ver mis casos" (RF-44) |
| P-5 Mis casos | `/contador/casos` | contador | "Registrar caso" (RF-43), cambiar estado y prioridad (RF-30 a RF-32) |
| Acceso denegado | la dirección solicitada, con `<AccessDenied>` | — | "volver a mi pantalla principal" (RF-6) |

- **Recorrido del administrador** (spec): `/login` → `/admin/dashboard` (conteos y detalle) → "Ver directorio" → `/admin/directorio` → elegir un nombre → `/admin/dashboard` con ese contador seleccionado → control de regreso → `/admin/directorio`.
- **Recorrido del contador**: `/login` → `/contador/casos` (o su vacío) → "Registrar caso" → `/contador/registro` → registrar → confirmación → "Ver mis casos" → `/contador/casos` → control de regreso → `/contador/registro`.
- **Toda pantalla interna** lleva en el layout común: título visible y distinto (RNF-5), control de regreso (RF-40) y los dos controles de simulación (RF-38).
- El botón "atrás" del navegador no forma parte del recorrido: la navegación se hace con los controles anteriores (spec, caso límite).
- Los controles de simulación se etiquetan como simulación para no confundirse con acciones reales, y llevan ayuda contextual accesible con puntero, teclado y toque (RNF-3).

## 6. Decisiones y alternativas descartadas

1. **Estado solo en memoria (Pinia), sin almacenamiento del navegador.**
   Alternativa descartada: guardar sesión y casos en el almacenamiento local del navegador para no perderlos al recargar. Se descarta porque RF-41 exige que al recargar se cierre la sesión y vuelvan los datos de ejemplo, y porque la spec anotó la excepción al Principio 3 precisamente por no existir almacenamiento real.
2. **Carpeta `src/stores/` (la que ya existe en el proyecto Quasar).**
   Alternativa descartada: crear `src/store/` como dice `AGENTS.md`. Se descarta para no duplicar carpetas ni romper la plantilla de Quasar; se avisa por si el usuario prefiere renombrarla.
3. **Lógica de negocio en `utils/` y store delgado.**
   Alternativa descartada: resolver validaciones, conteos y cambios dentro de los componentes. Se descarta porque la constitución exige probar la lógica con `node --test`, y los componentes de Vue no se pueden importar así.
4. **Un guard único en el router para sesión y perfil.**
   Alternativa descartada: comprobar la sesión dentro de cada página. Se descarta para no duplicar la regla de acceso denegado en cuatro pantallas y para que el acceso directo por dirección se comporte igual que la navegación interna (RF-5, RF-6).
5. **Datos de ejemplo en un servicio aparte, no dentro del store.**
   Alternativa descartada: sembrar los datos dentro del store. Se descarta para poder reiniciar el estado a la semilla con una sola llamada (RF-41) y para poder probar la semilla con `node --test` (RF-45). El volumen de la semilla se reparte entre P-2, P-3 y un contador con muchos casos, nunca en la cuenta `contador`, que se mantiene sin casos para que P-5 muestre su vacío (RF-34, RF-45).
6. **Componentes reutilizables de estado (carga, vacío, error, acceso denegado).**
   Alternativa descartada: escribir el mensaje en cada pantalla. Se descarta porque los cinco estados y el formato de los mensajes son los mismos en todas las pantallas (RNF-1, RF-36, RF-37).
7. **Etiqueta de prioridad con texto siempre visible y contraste ≥ 4.5:1.**
   Alternativa descartada: comunicar la prioridad solo con color o con iconos. Se descarta por RNF-7 y por accesibilidad (daltonismo).
8. **Ayuda contextual con el componente de Quasar, que ya se muestra con foco de teclado y con toque.**
   Alternativa descartada: el atributo nativo de título del navegador, que no aparece con teclado ni en pantallas táctiles (RNF-3).
9. **Un layout común para las pantallas internas.**
   Alternativa descartada: repetir cabecera y controles en cada página. Se descarta porque los controles de simulación y el regreso deben estar siempre disponibles (RF-38, RF-40).
10. **Reemplazar las rutas de la plantilla por las cinco de la maqueta.**
    Alternativa descartada: dejar las rutas de ejemplo de Quasar y añadir las nuevas. Se descarta porque la ruta comodín de la plantilla capturaría direcciones y rompería la comprobación de acceso denegado.
11. **No eliminar los archivos de la plantilla en esta fase.**
    Alternativa descartada: borrarlos ahora. Se descarta porque `AGENTS.md` prohíbe modificar o borrar archivos existentes sin permiso.

## 7. Estrategia de tests

- **Automatizados con `node --test`**, sin instalar paquetes (constitución, Principio 2). Se ejecuta desde `Seguimiento-proyectos/`:
  - `node --test`
- Solo se prueban módulos de `src/utils/` y `src/services/`, que son JavaScript puro sin Vue ni navegador. El proyecto ya usa módulos ES, así que los archivos de test pueden importarlos directamente.
- Qué se prueba (y qué RF cubre cada prueba):
  - `test/exampleData.test.js`: la semilla incluye la cuenta `contador` sin casos, otro contador con casos en los tres estados, un contador de nombre largo con caracteres especiales, un cliente de nombre largo y filas suficientes para que P-2, P-3 y el detalle de un contador con muchos casos desborden una ventana de 1024 × 768 px, con la cuenta `contador` siempre sin casos (RF-45, RF-8 en cuanto a las dos cuentas).
  - `test/caseRules.test.js`: cliente vacío, con solo espacios, de 80 caracteres (válido) y de 81 (inválido), prioridad sin elegir, estado inicial Pendiente, alta de caso, conteos con ceros, casos por contador, cambio de estado (incluido desde Finalizado), cambio de prioridad y que no se modifique el arreglo original (RF-12, RF-21 a RF-26, RF-30 a RF-34).
  - `test/accessRules.test.js`: campos faltantes por separado, espacios extremos tratados como vacío, mayúsculas y minúsculas distinguidas, credenciales inválidas y perfil resuelto por cuenta (RF-2, RF-3, RF-4, RF-8).
  - `test/screenState.test.js`: prioridad de error sobre carga y contenido, carga sobre contenido, vacío cuando no hay filas y contenido cuando hay filas (RF-35 a RF-37).
- **Verificación manual** (no automatizable y es la que cierra la spec): las 29 comprobaciones de "Criterios de finalización" de la spec. Cubren los cinco estados de interfaz reproducidos con los controles de simulación, la carga de aproximadamente un segundo, el recorrido P-1 a P-5, el acceso denegado por dirección en los cuatro cruces, la responsividad en 360 px y 1024 × 768 px, el contraste y el recorrido solo con teclado (RNF-2, RNF-3, RNF-4, RNF-5, RNF-8, RNF-9, RNF-10).
- **Puerta de calidad:** ninguna tarea se da por hecha con tests en rojo (constitución, Principio 2). Antes de cerrar la spec se ejecuta además `npm run lint:check` (ya existe en el proyecto) y `npm run dev` para comprobar que la maqueta levanta sin errores.

## 8. Trazabilidad RF → parte del plan

| RF | Parte del plan |
|---|---|
| RF-1, RF-5, RF-6 | 4.1 guard, 5 rutas, `AccessDenied.vue` |
| RF-2, RF-3, RF-4, RF-8 | 4.2, `accessRules.js`, `LoginPage.vue` |
| RF-7 | 4.3, `SimulationControls.vue`, `maqueta.js` |
| RF-9 | 4.2, `LoginPage.vue` (sin datos antes de entrar) |
| RF-10 | 4.1 (P-1 no cierra la sesión al volver) |
| RF-11 a RF-15 | 4.3, `AdminDashboardPage.vue`, `CounterCountsRow.vue` |
| RF-16, RF-17 | 5, `CountersDirectoryPage.vue` |
| RF-18 | `exampleData.js` (siempre hay contadores) |
| RF-19 a RF-25 | 4.4, `NewCasePage.vue`, `caseRules.js` |
| RF-26 | 4.4, `caseRules.buildCase` |
| RF-27 | 2 (no se crean controles de edición o borrado) |
| RF-28 a RF-34 | 4.5, `MyCasesPage.vue`, `CaseRow.vue`, `caseRules.js` |
| RF-35, RF-36, RF-37 | 4.3, `screenState.js`, `ScreenLoader/EmptyState/ErrorState` |
| RF-38 | 4.3, `SimulationControls.vue` en el layout |
| RF-39 | 4.5, confirmación en `MyCasesPage.vue` |
| RF-40 | 4.1, 5, control de regreso del layout |
| RF-41 | 4.6, store en memoria y semilla |
| RF-42, RF-43, RF-44 | 5, controles "Ver directorio", "Registrar caso", "Ver mis casos" |
| RF-45 | `exampleData.js`, `test/exampleData.test.js` |
| RNF-1 | `ErrorState.vue` y textos en `constants.js` |
| RNF-2 | 5 y tarea final de responsividad |
| RNF-3 | `SimulationControls.vue` y ayudas contextuales del layout |
| RNF-4 | `exampleData.js` (datos ficticios, sin datos personales reales) |
| RNF-5 | Títulos por pantalla en el layout |
| RNF-6 | 4.1 y `casesByCounter` en P-5 |
| RNF-7 | `PriorityTag.vue` |
| RNF-8 | Etiquetas y avisos de texto en todas las pantallas |
| RNF-9 | `CounterCountsRow.vue` y `CaseRow.vue` |
| RNF-10 | `AdminDashboardPage.vue` (incluido el detalle de un contador con muchos casos, con `CaseRow.vue`) y `CountersDirectoryPage.vue` |

## 9. Riesgos y pendientes

- **Aprobación de archivos nuevos:** crear `src/services/` y las cinco páginas, los componentes, `src/layouts/MaquetaLayout.vue` y `test/` requiere el visto bueno del usuario (límites de `AGENTS.md`).
- **Archivos de la plantilla:** quedan inertes, no se borran sin aprobación.
- **Carpeta `stores/` frente a `store/`:** se usa la existente; conviene confirmarlo.
- **Direcciones de las pantallas:** se proponen rutas con prefijo por perfil; si el usuario prefiere otras, solo cambia el router y el plan de tareas no se altera.
- **Tiempo de la carga simulada:** "aproximadamente un segundo" es el único valor no exacto; se implementa como un segundo y se ajusta si el usuario lo pide.
- **Datos de ejemplo:** la lista de contadores y casos se fija en `exampleData.js` respetando el mínimo de RF-45; el usuario puede ajustar nombres y volúmenes sin tocar los requisitos. Los casos de volumen pertenecen a contadores distintos de `contador`, que permanece sin casos para que P-5 muestre su estado vacío.
