# AGENTS.md — Seguimiento de Proyectos (unión con Recepción de documentos)

Sistema único del despacho (Grupo DelGrow S.C.), con un solo login, una sola base de datos y varios módulos. Nació de unir `status-conta` y `Proyecto-documentos`; el plan, las fases y las decisiones de la unión están en `PLAN.md`.

- **Seguimiento contable** (módulo `seguimiento`): el estado de urgencia del trabajo de los contadores en casos y clientes importantes, auditorías, «Mis actividades» y «Mi Calendario».
- **Recepción de documentos** (módulo `documentos`): recepción de documentos con firmas, direccionamiento al contador, dashboard con semáforo por cliente, clientes y seguimiento por folio o RFC.
- Cada persona tiene **un rol general** (`usuarios.rol`, el de seguimiento) y un **rol por módulo** en `usuario_modulos` (`modulo`, `rol`). El administrador tiene documentos por su rol, aunque no esté en la tabla (`UsuarioModuloModel.modulosDeUsuario`); si la tabla le da otro rol en documentos, gana la tabla. Toda cuenta nueva nace con `seguimiento`.
- Al entrar, todos llegan al selector `/modulos`, aunque tengan un solo módulo: ahí eligen el módulo o abren «Ajustes» (administrador, sistemas y recepcionista). Un módulo sin permiso muestra un aviso y no se entra. Las reglas viven en `src/utils/modulos.js` del frontend.

## Stack y estructura

- Frontend: Vue 3, HTML5, CSS, Javascrip usando el framework Quasar FrameWork v2
- backend: se usaran api rest con nodejs con expres y base de datos MySQL con MSSQL (Microsoft SQL Server) o MariaDB, estara por decidir cual usar, por ahora se usara MariaDB en un servidor local.
- se puede hacer build para web y para escritorio como un .exe usando electron, para el escritorio debe funcionar en windows.
- poner en contenedores de docker el proyecto para publicar o para usar localmente, estara por decidir cual usar, por ahora se usara docker.
- estructura de carpetas del proyecto

/Proyecto-Merge/
├── PLAN.md # Plan y fases de la unión
├── docker-compose.yml # db (MariaDB), backend, frontend (nginx) y tunnel
├── /docs/ # constitución, flujo de agentes, rebanadas y despliegue
├── /Backend/
│ ├── /soporte-pruebas/ # http.js, bd.js y verificarPruebas.js (MINIMOS)
│ ├── /test/ # Pruebas del backend (node --test)
│ ├── /src/
│ │ ├── /modulos/documentos/ # Backend de documentos en ESM (.mjs): logica/ y rutas/, con sus *.test.mjs al lado
│ │ ├── /config/ # Configuración de base de datos, variables de entorno y constantes
│ │ ├── /controllers/ # Lógica de negocio de cada módulo (ej. authController.js, docController.js)
│ │ ├── /middlewares/ # Middlewares de Express (ej. autenticación JWT, Argon2id, validación de roles)
│ │ ├── /models/ # Modelos de datos / consultas SQL / ORM
│ │ ├── /routes/ # Definición de endpoints HTTP (ej. authRoutes.js, docRoutes.js)
│ │ ├── /utils/ # Funciones auxiliares globales (ej. formateadores, logger)
│ │ ├── app.js # Configuración de Express, CORS, middlewares globales y montaje de rutas
│ │ └── server.js # Punto de entrada principal (escucha en el puerto)
│ ├── .env # Variables de entorno locales del backend
│ └── package.json # Dependencias del servidor

└── /Seguimiento-proyectos/(frontend)
├── node_modules/
├── public/
├── src/
│ ├── components/ # Componentes reutilizables
│ ├── layouts/ # Layouts de la aplicación
│ ├── pages/ # Páginas de seguimiento (login, selector de módulos, dashboards, «Mis casos», directorio…)
│ ├── modulos/documentos/ # Frontend de documentos: pages, components, composables, servicios, logica, css y permisos.js
│ ├── services/ # Servicios de la aplicación
│ ├── utils/ # Funciones auxiliares globales
│ ├── store/ # Stores de la aplicación
│ ├── router/ # Rutas de la aplicación
│ ├── main.js # Punto de entrada principal
│ ├── App.vue # Componente principal
│ └── index.html # HTML principal
├── .env
└── package.json

## Protocolo de Generación de Código para Backend

Al implementar o modificar funcionalidades en el servidor, los agentes deben cumplir las siguientes pautas:

- **Ubicación de Archivos:**
  - Nuevas rutas HTTP → `Backend/src/routes/[modulo]Routes.js`
  - Lógica de negocio y controladores → `Backend/src/controllers/[modulo]Controller.js`
  - Middlewares de validación o autenticación → `Backend/src/middlewares/[middlewareName].js`
  - Consultas y modelos de datos → `Backend/src/models/[modulo]Model.js`

- **Reglas de Integración:**
  - Mantén `server.js` limpio; jamás agregues endpoints o lógica de negocio directamente en este archivo.
  - Asegúrate de importar y registrar las nuevas rutas en `Backend/src/app.js`.
  - Todas las respuestas de error o éxito desde los controladores deben mantener un formato JSON consistente.

## Comandos

- levantar frontend:

```bash
cd Seguimiento-proyectos
npm run dev
```

- levantar backend:

```bash
cd Backend && npm run dev
```

- build:

```bash
cd Seguimiento-proyectos
npm run build
```

- **Tests:**
  - Para pruebas unitarias de utilidades y lógica (Node.js nativo sin dependencias adicionales):

    ```bash
    node --test
    ```

## Puertas de verificación

Los agentes (implementer y reviewer, en Claude Code y en opencode) corren estas puertas en cada carpeta que toca la rebanada. Ninguna rebanada se da por hecha con una puerta en rojo.

- Frontend (`Seguimiento-proyectos/`): `npm run lint:check`, `npm run build`, `node --test` y comprobación en navegador real si toca interfaz (incluida la vista móvil).
- Backend (`Backend/`): `node --test` y `node soporte-pruebas/verificarPruebas.js`. Las pruebas de documentos son `src/modulos/documentos/**/*.test.mjs` (más `test/documentosModulo.test.js`). Requiere en marcha MariaDB de XAMPP (puerto 3306) con la base de prueba de la unión `delgrow_merge` (la que usa `Backend/.env`). Si no responde, parar y avisar.
- Datos de prueba: las cuentas y registros de prueba usan el prefijo `zz_test_` (en documentos, correos `@ejemplo.com`); al terminar deben quedar 0 filas `zz_test_%`. Nunca datos reales en pruebas ni en el repo.
- Navegador: `merge-backend` (3001) + `merge-frontend` (9001) de `.claude/launch.json`; cerrar los servidores que se abran. Si toca documentos, probar con cada rol del módulo (el menú y los permisos cambian por rol).
- El reviewer solo corre las puertas de pruebas y lectura; nunca modifica archivos.
- Backend: correr `node --test --test-concurrency=1` y por archivo (todo junto se cuelga; en paralelo falla al azar por la BD compartida). Cada archivo de `Backend/test` va en `MINIMOS`. Una ruta nueva va en la tabla de `autorizacionMatriz.test.js` (si no, la prueba falla).
- `lint:check` no revisa formato: correr también `npx prettier --check`.
- Nunca `DROP`/`ALTER` destructivo en pruebas. Borrar las `sesiones` antes que la cuenta. `limpiarDatosDePrueba` borra todo aviso que mencione `zz_test_`: no probar en navegador mientras corren las pruebas del backend.
- Si una prueba pasa sin el cambio, no prueba nada. Nunca esquivar una prueba de texto moviendo el texto a otro archivo.
- Con el panel del navegador oculto, `requestAnimationFrame` va a ~1 cuadro/s y los clics y teclas pueden fallar: mostrar el panel antes de probar. El backend puede figurar «running» estando caído. En Playwright, esperar 3 s antes de capturar.

## Convenciones

- Textos de la interfaz en español.
- Código solido y limpio, nombres descriptivos y comentarios solo donde aporten.
- El lenguaje que se debe utilizar en todo el proyecto es el Español.
- Los comentarios deben estar en español.
- las vistas deben ser responsivas para todo tipo de dispositivos (mobile, desktop).
- los textos de las vistas no tienen que ser ambiguos para que todas los usuarios puedan entender
- tener tooltips para dar contexto al usuario y evitar ambiguedad. Menú: en escritorio, el dock (`MenuDock.vue`) es de solo iconos, así que cada opción lleva `q-tooltip` y `aria-label` con el mismo texto. Excepción: los ítems del menú lateral del celular (`MaquetaLayout.vue`) no llevan tooltip, porque la etiqueta y el subtítulo ya dan el contexto; el logo y el nombre del usuario sí lo conservan. Las opciones del menú están en dos lugares (plantilla del menú lateral y `opcionesDock`): cambiar las dos. Excepción 2: dentro del calendario de «Mi Calendario» (`CalendarioJuntas.vue`, `AnioJuntas.vue`) no hay tooltips; el texto visible y el `aria-label` de cada bloque dan el contexto. Los botones de esa pantalla, fuera del calendario, sí llevan tooltip.
- Identidad visual: la app se llama «Seguimiento de Proyectos» y comparte el diseño de las demás apps de Grupo DelGrow S.C.: fondo con degradado radial azul; en escritorio, dock flotante a la izquierda (`MenuDock.vue`: logo en azulejo, opciones del módulo actual, perfil y cierre de sesión); en celular, menú lateral con píldoras. Con varios módulos, el menú muestra «Cambiar de módulo» y solo las opciones del módulo en el que estás.
- Componentes de Quasar en todas las vistas (`q-btn`, `q-list`/`q-item`, `q-card`, `q-chip`/`q-badge`, `q-form`, `q-input`…). HTML nativo solo cuando Quasar no tiene equivalente; la única excepción acordada es el SVG de la dona «Casos por estado» (`DonaEstados.vue`), que va dentro de un `q-card`.
- Colores desde la paleta `$dg-colores` de `src/css/quasar.variables.scss` (`color="dg-acento"`, clases `text-dg-*`/`bg-dg-*` o `var(--dg-*)`), nunca un hexadecimal suelto en un componente. Un color nuevo se agrega a la paleta y, si es texto sobre fondo, a los pares de contraste de `test/paletaColores.test.js`.
- Textos en tú; mensajes de error en tres partes. La parte «sobre X» de `buildError` no se cambia: el frontend la usa en `campoConError` y el alta busca «ya existe».
- Formularios en diálogo: `hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?»; `erroresCampo` + `enfocarPrimerError`; `label for` + `for`; asterisco `aria-hidden`.
- Movimiento: diálogos con `dialogo-entra`/`dialogo-sale` (220 ms); selectores y calendarios `jump-down` 180 ms sin `cover`; `.boton-presionable` en botones; curva `$curva-salida`. Utilidades globales: `.sr-only` y `.control-touch` (44 px).
- Etiquetas visibles con `etiquetaSemaforo` («En atención») y `etiquetaEstado` («En proceso»); los valores guardados no cambian.
- Las pantallas con plazos recargan en silencio en `visibilitychange`; un fallo al releer no se presenta como fallo del guardado.

## Reglas de dominio / trampas conocidas

- Lo que es fácil hacer mal y el agente no puede deducir leyendo el código.
- Lee `docs/constitution.md` antes de tocar código.
- solo aplicar los cambios o modificaciones que sean aprobadas por el usuario.
- El registro de caso del contador vive en un diálogo dentro de «Mis casos» (`components/CaseFormDialog.vue`). No crear una pantalla aparte ni un ítem de menú para registrarlo; `contador/registro` solo redirige a «Mis casos».
- Contrato de fechas del caso: el formulario usa `DD-MM-AAAA`, la API y las columnas DATE `AAAA-MM-DD`, y los DATETIME se devuelven en hora local `YYYY-MM-DD HH:mm:ss`. Nunca usar `new Date('AAAA-MM-DD')` (se lee como UTC y desplaza un día); usar `parseFechaInicio`/`formatearFechaISO` de `dateUtils.js` y `fechasCaso.js` en el frontend.
- El vencimiento lo captura el contador (obligatorio al registrar) y no depende de la prioridad: nunca se recalcula al cambiar prioridad o fecha de inicio, ni cuando el administrador cambia la prioridad. Debe ser igual o posterior a la fecha de inicio (sin inicio, a hoy). Al editar un caso (PATCH `/casos/:id`, botón «Editar» de «Mis casos») se pueden cambiar cliente, estado, prioridad, fecha de inicio, fecha de vencimiento, descripción y observaciones. La edición usa el mismo `CaseFormDialog.vue` que el registro (prop `caso`). `calcularFechaVencimiento` (días hábiles por prioridad) solo la usa el seed.
- Seguridad del backend: en producción `JWT_SECRET` es obligatorio (sin él el servidor no arranca). El login tiene límite de intentos fallidos; las pruebas crean la app con `crearApp({ limitarLogin: false })` (ya lo hace `soporte-pruebas/http.js`).
- Un caso Finalizado se pinta en verde en «Mis casos» (contador) y en el detalle de casos del dashboard del administrador (solo lectura): fondo `dg-exito-fondo`, borde izquierdo `dg-estado-finalizado` y estado en `dg-exito`, y ese verde gana sobre «Importante». El texto «Finalizado» sigue visible (el color nunca es el único indicador). El selector de prioridad del administrador (`caso-item__prioridad`) no se pinta de verde. Vive en `components/CasoItem.vue` (`esFinalizado` + `.caso-item--finalizado`).
- La ficha de consulta de un caso vive en `components/CasoDetalleDialog.vue` y se abre con «Ver» desde «Mis casos» (está en `CasoItem.vue`, emit `ver`). Es solo lectura: sin campos editables ni guardado; para cambiar datos se usa «Editar» (`CaseFormDialog.vue`). Se alimenta del caso del store (incluye `observaciones`, `nombre_contador`); no hay endpoint nuevo. El botón no se muestra en la vista `soloLectura` del administrador. La ficha sigue el patrón visual de la app: icono por campo, secciones separadas (datos del caso —incluye las fechas— y descripción/observaciones) con separador sutil, chip de «Importante» junto al cliente (solo si lo es; no hay fila «Importante»), etiqueta «Vencido»/«Vence pronto» junto al vencimiento, punto de color en el estado (`COLOR_ESTADO` + `punto-estado-sm`), radius 12 px, ancho 1080 px y textos largos con scroll interno de 120 px. El contador dueño del caso se muestra como «Tú». Si el caso cambia con la ficha abierta, «Mis casos» le pasa la versión nueva y la ficha avisa con texto qué campos cambiaron y los resalta (`camposActualizadosDelCaso` en `caseRules.js`).
- Escalar casos de un auxiliar: el auxiliar **no** marca ni desmarca «Importante» (sin estrella en «Mis casos», sin interruptor en el formulario y el backend responde 403 en `POST /casos`, `POST /casos/para-auxiliar` y `PATCH /casos/:id`). Lo marca su contador, y entonces el administrador lo ve en el detalle de ese contador con la etiqueta «de {auxiliar}» y cuenta en sus cifras (`findParaAdministrador`, `countByStatus` y `resumenPorContador` de `CaseModel.js`). Los casos importantes de un auxiliar también se abren desde el directorio («Ver casos importantes» → `CasosDeAuxiliarDialog.vue`, que reutiliza `DetalleContador.vue` con la prop `auxiliar`); los auxiliares siguen sin salir en la lista del dashboard.
- Un auxiliar apoya a **un solo contador**; un contador puede tener varios auxiliares. Lo valida el backend, no la tabla (`contador_auxiliar` no tiene índice único por auxiliar): `asignarAuxiliar` rechaza con 409 (`AUXILIAR_CON_OTRO_CONTADOR`), `ajustarContadoresDeAuxiliar` y el alta con 400 (`MAS_DE_UN_CONTADOR`), y «Agregar auxiliares» solo lista a quienes no apoyan a nadie. Para cambiar a un auxiliar de contador, el despacho usa «Contador que apoya» del directorio, que envía el nuevo en `agregar` y el anterior en `quitar`.
- «Mi equipo» es una pestaña de «Mi resumen» (`ContadorDashboardPage.vue`, `?tab=equipo`), no una vista ni un ítem de menú: solo la ve el contador que tiene al menos un auxiliar. La pinta `components/MiEquipo.vue` (tarjetas del equipo con `ResumenEquipo`, una fila por auxiliar con sus conteos y el detalle con `CasoItem` y todas sus acciones). Las cifras se calculan en el frontend con `resumenDeAuxiliares` (`utils/resumenMisCasos.js`) sobre los casos del store, que ya traen los de los auxiliares; no hay endpoint nuevo. Cuenta todos los casos del auxiliar, no solo los importantes.
- «Mi Calendario» (ruta `/juntas`, `JuntasPage.vue`; se llamaba «Juntas») lo usan administrador, contador, auxiliar y recepcionista; el usuario de sistema no. Una junta puede no tener invitados (bloquea el horario). Si hay administradores invitados, la junta queda «Por confirmar» hasta que respondan; un rechazo la cancela. El estado se calcula (`estadoJunta.js`), no se guarda. Un tercero nunca recibe id, descripción ni invitados de una junta ajena; si es privada, solo «Ocupado».
- La recepcionista funciona como secretaria solo de los administradores de la variable `ADMINISTRADORES_DE_RECEPCION` (`config/recepcion.js`; producción `7947`, local `1`; sin definir: todos fuera de producción y nadie en producción). Con ellos: crea juntas a nombre de un administrador (el organizador es él), edita y borra las que organiza un administrador, responde por él a sus invitaciones y ve completas sus juntas, incluidas las privadas. Fuera de eso, solo consulta el directorio.
- Roles: el seed fija el ENUM `usuarios.rol` en cada arranque y MariaDB no está en modo estricto. Un rol agregado a mano que no esté en el seed queda en `''` sin error: agregarlo siempre en `seed.js` (CREATE y ALTER).
- Pasar casos dentro del equipo: solo el contador (`POST /casos/para-mi-auxiliar` para un caso nuevo, que acepta «Importante»; `PATCH /casos/:id/responsable` para pasar uno existente entre el contador y sus auxiliares, UPDATE condicional con 409 si algo cambió y aviso a quien recibe y a quien pierde). El auxiliar no pasa casos.
- «Mis actividades» solo para las cuentas de `USUARIOS_CON_ACTIVIDADES` (`config/modulos.js`, se lee en cada petición; ids separados por comas, `*` = todos, vacío = nadie, sin definir = abierto en desarrollo y cerrado en producción). `requireModuloActividades` va en todas sus rutas (403 «Módulo no habilitado»); login y `/auth/perfil` traen `actividades_habilitadas`. `soporte-pruebas/http.js` fija `*`.
- «Mi Calendario»: las reglas de acceso viven solo en `utils/accesoJuntas.js` y `JuntaModel` recibe al consultante como `{id, rol}`. dotenv carga `Backend/.env` en las pruebas: la prueba que necesite a todos los administradores debe quitar `ADMINISTRADORES_DE_RECEPCION`.
- «Vence pronto» va en amarillo (`dg-vence-pronto`).
- «Mi perfil»: «Cambiar contraseña» está oculto (`CAMBIO_CONTRASENA_HABILITADO = false`); el backend sigue ahí.
- Seguridad: Apache de XAMPP sirve todo `htdocs` en la LAN; no dejar secretos ni respaldos dentro del proyecto y no quitar el `.htaccess` de la raíz. Rotar claves con `Backend/src/utils/rotarSecretos.js`. `db.js` solo acepta parámetros primitivos (para `IN`/`VALUES` armar los `?` a mano). Registrar con `registrar`/`registrarError` de `utils/bitacoraSeguridad.js`, no con `console.error`. Con la cookie `sp_sesion`, las escrituras exigen `X-Requested-With: SeguimientoProyectos`; Bearer sigue válido. Contraseñas ≥12 y no comunes (`validarPasswordNueva`).
- <Limites: que no tocar, que no agregar ni modificar sin preguntar.>

## Módulo de documentos (Recepción de documentos)

- **Origen:** el código de `Proyecto-documentos` se copió casi igual. Backend en `Backend/src/modulos/documentos/` (ESM `.mjs`, que el código CommonJS carga con `require()`); frontend en `Seguimiento-proyectos/src/modulos/documentos/`. Se cambian solo las consultas que tocan tablas unidas; la lógica no se reescribe sin preguntar.
- **Router:** `Backend/src/routes/documentoRoutes.js`, montado en `/doc` **antes** del `express.json` de 100 kb de `app.js`, porque lleva su propio parser (las firmas en base64 pesan hasta 2 MiB y los archivos se suben en crudo hasta 25 MB; nginx acepta 26 MB solo en `/api/doc/`). Sus respuestas conservan el formato de documentos `{ error, mensaje }` (excepción acordada al formato de seguimiento). Una ruta nueva de `/doc` también va en `autorizacionMatriz.test.js`.
- **Sesión y permisos:** usa la sesión de status-conta (no existen `/sesion`, la cookie `dca_sesion` ni scrypt; un hash `scrypt$` viejo se pasa a argon2 al entrar). Entra quien tiene el módulo o es administrador. Cada ruta pide su permiso con `hayAcceso(rolEnDocumentos, accion)` (`logica/errores.mjs`); el frontend repite la tabla en `src/utils/modulos.js` (`hayAccesoDocumentos`, usada por `modulos/documentos/permisos.js`): cambiar siempre las dos. Roles del módulo: Administrador, Contador, Recepcionista, Practicante, Sistemas (Cliente apagado: `clienteId = null`).
- **Quién entra y con qué rol:** pestaña «Acceso a módulos» de Ajustes (`/ajustes?tab=accesos`; `/documentos/accesos` solo redirige; `GET /doc/usuarios` y `PUT /doc/usuarios/:id/rol`). Las cuentas se crean en la pestaña «Usuarios» de Ajustes, nunca en documentos. A un administrador no se le quita el módulo con `rol: null`.
- **Tablas unidas:** `clientes` es un solo catálogo (`nombre` = razón social, `usuario_id` = contador y opcional, `activo` = estado, más `clave`, `email`, `telefono`); «Contador» en documentos sale de `usuario_modulos`, no de una tabla `roles`. `usuarios.alias` es el usuario corto de documentos (no se llama `usuario` porque una migración vieja borra esa columna). El esquema lo agrega `migrarUnificacion()` en `seed.js` (repetible, no borra datos).
- **Cliente HTTP del frontend:** llama a `${API_URL}/doc/...` y manda `X-Requested-With` (sin ella el backend rechaza las escrituras con cookie). Devuelve el cuerpo pelado; los errores se muestran con `mensajeParaUsuario(err, respaldo)`.
- **Copias que no se formatean:** `src/modulos/documentos/logica/normalizar.js` y `estadosDocumento.js` son copias del backend (en Docker el frontend se construye sin el Backend); una prueba compara `normalizar` y deben quedar idénticas.
- **Estados y direccionamiento:** reglas en `logica/estadosDocumento.mjs`. `RECEPCIONADO` solo pasa a `EN_PROCESO` por Direccionamiento (`POST /doc/documentos/:id/entrega`, con `SELECT … FOR UPDATE`; si ya se entregó, 400). Las dos firmas van a `firma_contador_recep` y `firma_contador`; la observación de la entrega va a `documento_historial.comentarios`, nunca a `documentos.observaciones`.
- **Firmas:** leer el lienzo (`toDataURL()`) antes de armar los datos, o el primer clic se rechaza por «faltan las firmas». Toda acción repetible lleva bandera de reentrada.
- **PDF:** `html2pdf.js` se importa de forma estática (`AcuseImprimir.vue`, `DireccionamientoPage.vue`); con `import()` dinámico Vite devolvía HTML. El acuse se pinta desde `acuseData`, no desde el formulario.
- **Adjuntos:** se guardan en `CARPETA_ADJUNTOS`, una carpeta por cliente (`{clave} {razón social}/{año}/{MM MES}/{folio}/`, con el acuse y los archivos) para que el despacho la consulte. En local es `##RECEPCION DE PAPELERIA_CLIENTES` en la raíz (ignorada en git); en el servidor será la ruta compartida; en Docker, volumen `adjuntos` en `/app/storage`. Sin la variable cae en `Backend/storage`. Las pruebas usan carpetas temporales. Nada de texto libre en cabeceras HTTP: los nombres de archivo van en la URL.
- **Estilos:** las clases globales de documentos van en `modulos/documentos/css/documentos.scss` con alcance propio, para no cambiar el `.selector-moderno` de seguimiento. Los estilos de un menú de `q-select` no van en `<style scoped>` (Quasar lo monta en `body`). `q-select` con opciones `{ value, label }` necesita `emit-value` y `map-options`.
- **Tablas (`QTable`):** si una tabla desborda, la columna de Acciones se sale de la pantalla: recortar con `max-width` + `ellipsis` y tooltip, ocultar columnas en móvil y comprobar que `scrollWidth - clientWidth` de `.q-table__middle.scroll` dé 0 (1440, 1024, 768, 375 y 320). Con búsqueda activa Quasar muestra `no-results-label`, no `no-data-label`: poner las dos.
- **Maqueta:** el autollenado usa plantillas de prueba (nunca toca periodo, archivos ni firmas); «Nuevo cliente» y «Exportar reporte» de Clientes solo muestran un aviso.

## Trampas del entorno

- Shell: PowerShell no admite `&&`/`||`. En Git Bash, `MSYS_NO_PATHCONV=1`. Varios `.vue` usan CRLF y `sed` falla con varias líneas o con `\\`: usar Edit. No usar `git stash` (cambia LF/CRLF y rompe `prettier --check`).
- Quasar: el fondo de `q-dialog` responde a `mousedown`; `scoped` no alcanza los menús montados en `body`; con la prop `padding` de `q-btn`, el `min-height` necesita `!important` (igual el foco de los `q-btn` del calendario frente a `app.scss`); `sticky` no sirve dentro de `q-tab-panels`; `q-avatar` se ajusta con `size`; `tabular-nums` solo va en cifras.
- Si `npm install` da EBUSY, cerrar el servidor de desarrollo. Si una tabla de XAMPP da «doesn't exist in engine», no borrar tablas sueltas.
- `session.id` es texto: comparar con `Number(...)`.
- `.claude/launch.json` (`merge-backend`, `merge-frontend`) arranca con `cmd /c` desde las carpetas del proyecto, en los puertos del `Backend/.env` (3001 y 9001); el frontend recibe `API_URL=http://localhost:3001`. Si no arranca, avisar en lugar de inventar otra configuración.
- Este repo es un clon de `status-conta` (remoto `status-conta` = carpeta local; GitHub `SantosGomez/project-merge`). `status-conta` y `Proyecto-documentos` siguen en `htdocs` solo de consulta: no editarlos desde aquí.

## Despliegue (solo cuando se pida)

- Bases: producción en Docker (puerto 3307), solo en una publicación pedida; pruebas de la unión en XAMPP (3306), base `delgrow_merge`. En el mismo XAMPP están las bases de `status-conta` (`delgrow_contadores`) y de documentos (`dca_documentos`): no se tocan; `dca_documentos` solo se lee para importar. Guía completa en `docs/seguridad-despliegue.md`.
- Unión en producción (fase 5 de `PLAN.md`): respaldar `db_datos` **y** el volumen `adjuntos`; arrancar el backend nuevo (el seed migra) y correr una sola vez `node src/utils/importarDocumentos.js` con `DOCS_DB_*` apuntando a `dca_documentos` (`--deshacer` revierte; `unificacion_mapa` evita duplicados).
- Respaldo dentro del contenedor (`mariadb-dump --single-transaction --routines --triggers --events > /tmp/...` + `docker compose cp`); la tubería de PowerShell daña acentos; los `.sql` nunca se versionan. Etiquetar las imágenes anteriores antes de reconstruir.
- `docker compose build` desde PowerShell (en Git Bash `API_URL=/api` se rompe) y `up -d --no-deps backend frontend` para que el túnel conserve su URL.
- Túnel cloudflared: la URL cambia al reiniciarlo o recrearlo (`docker compose logs tunnel`). Agregarla a `CORS_ORIGENES` y hacer `up -d backend`; si no, el login da 403.

## Forma de trabajar

- en el frontend se tiene la parte de las vistas y funciones que afecta a las mismas
- backend es el servidor nodejs donde se crearan las apis rest para que el frontend pueda hacer peticiones y comunicarse con la base de datos.
- No modificar archivos que no sean necesarios, siempre preguntar antes de modificar archivos existentes.
- Haz solo lo que se pide: no añadas funcionalidades por tu cuenta.
- No modificar archivos o funciones que ya funcionan, no modificarlas sin preguntarme.
- Cuándo planificar antes de tocar código, tamaño de los cambios, qué explicar al terminar.
- no agregar inputs o campos a formularios si no estan en la tabla donde se guardara informacion, en caso de necesitar mas campos proponer un cambio a la tabla y preguntar si se procede a modificar.
- versionar proyecto: al pedirte hacer "Commit" primero hacer un git add de los archivos modificados, despues hacer el git commit con un mensaje descriptivo del o los cambios realizados y por ultimo hacer un git push. No hagas push sin antes preguntar, ya que puede que no tenga tiempo de revisar los cambios.
- al terminar cada tarea, siempre actualizar `MEMORY.md` con los cambios realizados.
- Proceso: rebanadas verticales con TDD (`docs/flujo-agentes.md`); cada una en `docs/rebanadas/NN-*.md` con su reporte y opcionales. `implementer` con sonnet; `reviewer` (opus) en riesgo medio o alto y `reviewer-ligero` en bajo. Solo el orquestador edita `MEMORY.md`.
- A los subagentes se les pide que no dejen procesos en segundo plano, que no toquen `MEMORY.md` y que usen solo cuentas `zz_test_`.

## Memoria

- Al empezar, lee `MEMORY.md` para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales).

## Límites

- ✅ Siempre: hacer pruebas, mantener los textos en español, respetar la estrutura del proyecto, mantener las funciones que ya funcionan y no modificarlas sin preguntarme.
- ✅ Siempre: actualizar `MEMORY.md` al terminar cada tarea.
- ⚠️ Pregunta antes: dependencias nuevas, archivos nuevos, cambios en la estructura de los datos, cambios en la lógica del programa, etc.
- 🚫 Nunca: hacer cambios sin preguntar y sobre todo no modificar las funciones que ya funcionan y no modificarlas sin preguntarme.

## Verificación

- No consideres una tarea terminada hasta que hayas revisado que funciona, hacer pruebas y si es necesario volver a revisar, el objetivo es que todo funcione correctamente y haya pocos o cero errores o fallos.
