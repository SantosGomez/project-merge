# AGENTS.md — DelGrow Estado Contadores

Es una herramienta que permite gestionar el estado de los contadores, para saber el estado de urgencia de trabajo de los contadores para casos o clientes importantes o urgentes.

## Stack y estructura

- Frontend: Vue 3, HTML5, CSS, Javascrip usando el framework Quasar FrameWork v2
- backend: se usaran api rest con nodejs con expres y base de datos MySQL con MSSQL (Microsoft SQL Server) o MariaDB, estara por decidir cual usar, por ahora se usara MariaDB en un servidor local.
- se puede hacer build para web y para escritorio como un .exe usando electron, para el escritorio debe funcionar en windows.
- poner en contenedores de docker el proyecto para publicar o para usar localmente, estara por decidir cual usar, por ahora se usara docker.
- estructura de carpetas del proyecto

/status-conta/
├── /backend/
│ ├── /src/
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
│ ├── pages/ # Páginas de la aplicación (vista de login, dashboard de casos, «Mis casos» del contador y directorio de usuarios, con alta y restablecimiento de contraseña en diálogos.)
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
  - Nuevas rutas HTTP → `backend/src/routes/[modulo]Routes.js`
  - Lógica de negocio y controladores → `backend/src/controllers/[modulo]Controller.js`
  - Middlewares de validación o autenticación → `backend/src/middlewares/[middlewareName].js`
  - Consultas y modelos de datos → `backend/src/models/[modulo]Model.js`

- **Reglas de Integración:**
  - Mantén `server.js` limpio; jamás agregues endpoints o lógica de negocio directamente en este archivo.
  - Asegúrate de importar y registrar las nuevas rutas en `backend/src/app.js`.
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
- Backend (`Backend/`): `node --test` y `node soporte-pruebas/verificarPruebas.js`. Requiere MariaDB en marcha (XAMPP, puerto 3306); si no responde, parar y avisar.
- Datos de prueba: las cuentas y registros de prueba usan el prefijo `zz_test_`; al terminar deben quedar 0 filas `zz_test_%`.
- Navegador: `backend-experimento-3011` + `frontend-experimento-9012` de `.claude/launch.json`; cerrar los servidores que se abran.
- El reviewer solo corre las puertas de pruebas y lectura; nunca modifica archivos.

## Convenciones

- Textos de la interfaz en español.
- Código solido y limpio, nombres descriptivos y comentarios solo donde aporten.
- El lenguaje que se debe utilizar en todo el proyecto es el Español.
- Los comentarios deben estar en español.
- las vistas deben ser responsivas para todo tipo de dispositivos (mobile, desktop).
- los textos de las vistas no tienen que ser ambiguos para que todas los usuarios puedan entender
- tener tooltips para dar contexto al usuario y evitar ambiguedad.
- Identidad visual: la app se llama «Seguimiento de Proyectos» y comparte el diseño de las demás apps de Grupo DelGrow S.C. (menú lateral oscuro de altura completa con logo, nombre de la empresa y de la app, secciones por rol y usuario con cierre de sesión al pie).
- Componentes de Quasar en todas las vistas (`q-btn`, `q-list`/`q-item`, `q-card`, `q-chip`/`q-badge`, `q-form`, `q-input`…). HTML nativo solo cuando Quasar no tiene equivalente; la única excepción acordada es el SVG de la dona «Casos por estado» (`DonaEstados.vue`), que va dentro de un `q-card`.
- Colores desde la paleta `$dg-colores` de `src/css/quasar.variables.scss` (`color="dg-acento"`, clases `text-dg-*`/`bg-dg-*` o `var(--dg-*)`), nunca un hexadecimal suelto en un componente. Un color nuevo se agrega a la paleta y, si es texto sobre fondo, a los pares de contraste de `test/paletaColores.test.js`.

## Reglas de dominio / trampas conocidas

- Lo que es fácil hacer mal y el agente no puede deducir leyendo el código.
- Lee `docs/constitution.md` antes de tocar código.
- solo aplicar los cambios o modificaciones que sean aprobadas por el usuario.
- El registro de caso del contador vive en un diálogo dentro de «Mis casos» (`components/CaseFormDialog.vue`). No crear una pantalla aparte ni un ítem de menú para registrarlo; `contador/registro` solo redirige a «Mis casos».
- Contrato de fechas del caso: el formulario usa `DD-MM-AAAA`, la API y las columnas DATE `AAAA-MM-DD`, y los DATETIME se devuelven en hora local `YYYY-MM-DD HH:mm:ss`. Nunca usar `new Date('AAAA-MM-DD')` (se lee como UTC y desplaza un día); usar `parseFechaInicio`/`formatearFechaISO` de `dateUtils.js` y `fechasCaso.js` en el frontend.
- El vencimiento lo captura el contador (obligatorio al registrar) y no depende de la prioridad: nunca se recalcula al cambiar prioridad o fecha de inicio, ni cuando el administrador cambia la prioridad. Debe ser igual o posterior a la fecha de inicio (sin inicio, a hoy). Al editar un caso (PATCH `/casos/:id`, botón «Editar» de «Mis casos») se pueden cambiar cliente, estado, prioridad, fecha de inicio, fecha de vencimiento, descripción y observaciones. La edición usa el mismo `CaseFormDialog.vue` que el registro (prop `caso`). `calcularFechaVencimiento` (días hábiles por prioridad) solo la usa el seed.
- Seguridad del backend: en producción `JWT_SECRET` es obligatorio (sin él el servidor no arranca). El login tiene límite de intentos fallidos; las pruebas crean la app con `crearApp({ limitarLogin: false })` (ya lo hace `soporte-pruebas/http.js`).
- Un caso Finalizado se pinta en verde en «Mis casos» (contador) y en el detalle de casos del dashboard del administrador (solo lectura): fondo `dg-exito-fondo`, borde izquierdo `dg-estado-finalizado` y estado en `dg-exito`, y ese verde gana sobre «Importante». El texto «Finalizado» sigue visible (el color nunca es el único indicador). El selector de prioridad del administrador (`caso-item__prioridad`) no se pinta de verde. Vive en `components/CasoItem.vue` (`esFinalizado` + `.caso-item--finalizado`).
- La ficha de consulta de un caso vive en `components/CasoDetalleDialog.vue` y se abre con «Ver» desde «Mis casos» (está en `CasoItem.vue`, emit `ver`). Es solo lectura: sin campos editables ni guardado; para cambiar datos se usa «Editar» (`CaseFormDialog.vue`). Se alimenta del caso del store (incluye `observaciones`, `nombre_contador`); no hay endpoint nuevo. El botón no se muestra en la vista `soloLectura` del administrador. La ficha sigue el patrón visual de la app: icono por campo, secciones separadas (datos del caso —incluye las fechas— y descripción/observaciones) con separador sutil, chip de «Importante», punto de color en el estado (`COLOR_ESTADO` + `punto-estado-sm`), radius 12 px, ancho 1080 px y textos largos con scroll interno de 120 px. El contador dueño del caso se muestra como «Tú».
- <Limites: que no tocar, que no agregar ni modificar sin preguntar.>

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
