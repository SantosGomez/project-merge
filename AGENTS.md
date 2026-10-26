# AGENTS.md — DelGrow Estado Contadores

Es una herramienta que permite gestionar el estado de los contadores, para saber el estado de urgencia de trabajo de los contadores para casos o clientes importantes o urgentes.

## Stack y estructura

- Frontend: Vue 3, HTML5, CSS, Javascrip usando el framework Quasar FrameWork v2
- backend: se usaran api rest con nodejs con expres y base de datos MySQL con MSSQL (Microsoft SQL Server) o MariaDB, estara por decidir cual usar, por ahora se usara MariaDB en un servidor local.
- se puede hacer build para web y para escritorio como un .exe usando electron, para el escritorio debe funcionar en windows.
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
│ ├── pages/ # Páginas de la aplicación (vista de login, dashboard de casos, directorio de contadores, «Mis casos» del contador y alta/restablecimiento de usuarios.)
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
cd backend && nodemon src/server.js
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

## Convenciones

- Textos de la interfaz en español.
- Código solido y limpio, nombres descriptivos y comentarios solo donde aporten.
- El lenguaje que se debe utilizar en todo el proyecto es el Español.
- Los comentarios deben estar en español.
- las vistas deben ser responsivas para todo tipo de dispositivos (mobile, desktop).
- los textos de las vistas no tienen que ser ambiguos para que todas los usuarios puedan entender
- tener tooltips para dar contexto al usuario y evitar ambiguedad.
- Identidad visual: la app se llama «Seguimiento de Proyectos» y comparte el diseño de las demás apps de Grupo DelGrow S.C. (menú lateral oscuro de altura completa con logo, nombre de la empresa y de la app, secciones por rol y usuario con cierre de sesión al pie).

## Reglas de dominio / trampas conocidas

- Lo que es fácil hacer mal y el agente no puede deducir leyendo el código.
- Lee `docs/constitution.md` antes de tocar código.
- solo aplicar los cambios o modificaciones que sean aprobadas por el usuario.
- El registro de caso del contador vive en un diálogo dentro de «Mis casos» (`components/CaseFormDialog.vue`). No crear una pantalla aparte ni un ítem de menú para registrarlo; `contador/registro` solo redirige a «Mis casos».
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
