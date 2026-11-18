# 21b — Calendario de juntas (pantalla)

- **Riesgo:** medio (pantalla nueva, diálogo con validación, dependencia nueva y fechas en el frontend; sin cambios en el backend)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet u Opus) + revisión en navegador
- **Estado:** aprobada

Continúa la 21a (API `/juntas` ya publicada). El plan del módulo está en `20-rol-recepcionista.md` y en `MEMORY.md`.

## Historia

Como administrador, contador, auxiliar o recepcionista, quiero ver mis juntas en un calendario por mes, semana o día, y crear, editar o borrar las que organizo, para organizar mejor al equipo.

## Decisiones del usuario (2026-11-18)

- **QCalendar aprobado:** `@quasar/quasar-ui-qcalendar`, versión exacta en `package.json`, sin `^`.
- **Horario laboral:** de 8:00 a 19:00, de lunes a viernes.
- Cada invitado acepta o rechaza su invitación; si el administrador está invitado, su respuesta confirma o cancela la junta. Responder llega en la **22**. Aquí solo se **muestra** la respuesta de cada invitado.

## Criterios de aceptación

1. **Dependencia:** se instala `@quasar/quasar-ui-qcalendar` en una versión compatible con Vue 3.5 y Quasar 2.35, sin `^`. Se registra solo en la pantalla de juntas (importación local del componente y su CSS), no como plugin global, para no cargarlo en las demás vistas. `npm run build` en verde.
2. **Pantalla y ruta:** ruta `/juntas` (nombre `juntas`), página `pages/JuntasPage.vue`, `meta.perfil` con los 4 roles y título «Juntas». El usuario de sistema recibe «Acceso denegado».
3. **Menú lateral:** en cada sección de rol (Administración, Mi trabajo y Recepción) hay un ítem «Juntas», con el subtítulo «Calendario de juntas del equipo» y sin tooltip. Se llama «Juntas» y no «Calendario» porque el dashboard del administrador ya tiene un calendario de vencimientos.
4. **Pantalla principal de la recepcionista:** `RUTA_PRINCIPAL_POR_ROL.recepcionista` pasa a `/juntas`. El directorio sigue en su menú.
5. **Vistas:**
   - Un selector Mes | Semana | Día (`q-btn-toggle`), los botones «Anterior», «Hoy» y «Siguiente», y el título del periodo en español (por ejemplo, «noviembre de 2026» o «16 – 20 de noviembre de 2026»).
   - **Mes:** cuadrícula de lunes a domingo; cada junta se muestra como una etiqueta con la hora de inicio y el título.
   - **Semana:** de lunes a viernes, de 8:00 a 19:00.
   - **Día:** de 8:00 a 19:00. Una junta fuera del horario se recorta al borde de la vista y la ficha muestra su hora real. En sábado o domingo, la vista de día muestra ese día de 8:00 a 19:00.
   - En pantallas de menos de 600 px la vista inicial es Día; en las demás, Semana. La vista y la fecha elegidas viajan en la URL (`?vista=semana&fecha=2026-11-18`) para recargar sin perderlas.
   - Toda la información de una junta se lee con texto, no solo con color.
6. **Carga:**
   - Al cambiar de periodo se llama a `GET /juntas?desde&hasta` con el rango visible.
   - Mientras carga se muestra `ScreenLoader` o un esqueleto; si falla, `ErrorState` con «Reintentar».
   - Sin juntas en el periodo, el aviso dice «No tienes juntas en este periodo».
   - En `visibilitychange` recarga en silencio. Un fallo al recargar no se presenta como fallo de un guardado.
7. **Ficha de la junta:** al hacer clic en una junta se abre un diálogo de solo lectura con:
   - título, fecha, hora de inicio y fin, descripción y organizador («Tú» si eres tú);
   - cada invitado con su respuesta como chip con texto: «Pendiente», «Aceptó» o «Rechazó».
   - Si soy el organizador, aparecen los botones «Editar» y «Borrar». «Borrar» pide confirmación: «¿Borrar la junta? Se quitará del calendario de todos los invitados».
8. **Diálogo de alta y edición** (`components/JuntaFormDialog.vue`):
   - Se abre con «Nueva junta» o con un clic en un hueco vacío de semana o día, que precarga esa fecha y hora (30 minutos por defecto).
   - **Campos:**
     - título (obligatorio, máximo 150);
     - fecha (`DD-MM-AAAA`, con `q-date` en un popup `jump-down` de 180 ms y sin `cover`);
     - hora de inicio y hora de fin (`q-time`, cada 15 minutos);
     - descripción (opcional, máximo 1000);
     - invitados (`q-select` múltiple con búsqueda, desde `GET /juntas/participantes-disponibles`, con el rol junto al nombre).
   - **La fecha va a la API en `AAAA-MM-DD HH:mm`.** La junta del formulario es de un solo día; la API acepta cruzar la medianoche, pero esta pantalla no lo ofrece. Se valida que el fin sea posterior al inicio.
   - **Patrón de formularios del proyecto:**
     - `hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?»;
     - `erroresCampo` + `enfocarPrimerError`;
     - `label for` + `for`;
     - asterisco con `aria-hidden`;
     - animaciones `dialogo-entra`/`dialogo-sale`.
   - Los errores de la API se asignan a su campo por la parte «sobre X»: `título`, `descripción`, `inicio`, `fin` y `participantes`.
   - Al guardar se cierra, se avisa con «Junta guardada» y se recarga el periodo. La edición usa el mismo diálogo con la prop `junta` y envía el cuerpo completo, porque el PATCH lo pide así.
9. **Servicio:** `services/juntaService.js` con axios (`api.js`), funciones `listar`, `obtener`, `crear`, `actualizar`, `borrar` y `participantesDisponibles`. Errores con el patrón de los demás servicios.
10. **Utilidades puras con prueba** en `utils/juntas.js`:
    - rango visible por vista (lunes a domingo para mes y semana, el día para día);
    - armar `AAAA-MM-DD HH:mm` desde el formulario;
    - texto del periodo;
    - etiqueta de respuesta.
    - Sin `new Date('AAAA-MM-DD')`: usar `parseFechaInicio`/`formatearFechaISO`.
11. **Estilo:**
    - Componentes de Quasar.
    - Colores solo de la paleta `$dg-colores`; un color nuevo se agrega a la paleta y, si es texto sobre fondo, al test de contraste.
    - Textos en tú y en español, con tooltips en los botones de icono.
    - `.boton-presionable` y `.control-touch` de 44 px.
    - Responsivo hasta 375 px sin scroll horizontal; en móvil, la vista de semana puede desplazarse dentro de su propio contenedor.
12. **Datos de prueba:** solo cuentas `zz_test_`; al terminar, 0 filas `zz_test_%` y 0 juntas.

## Archivos autorizados

- `Seguimiento-proyectos/package.json` y `package-lock.json` (solo QCalendar)
- `Seguimiento-proyectos/src/pages/JuntasPage.vue` (nuevo)
- `Seguimiento-proyectos/src/components/JuntaFormDialog.vue`, `JuntaDetalleDialog.vue` y `CalendarioJuntas.vue` (nuevos)
- `Seguimiento-proyectos/src/services/juntaService.js` y `src/utils/juntas.js` (nuevos)
- `Seguimiento-proyectos/src/router/index.js`, `src/utils/constants.js` (ruta principal de la recepcionista) y `src/layouts/MaquetaLayout.vue` (ítems «Juntas»)
- `Seguimiento-proyectos/src/css/quasar.variables.scss` (solo si hace falta un color) y `test/paletaColores.test.js`
- `Seguimiento-proyectos/test/juntas*.test.js` (nuevos) y las pruebas existentes que fallen por el menú o la ruta nueva (sin debilitarlas, como `layout-drawer-check.js` o `rolRecepcionista.test.js`)

El backend no se toca. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- QCalendar trae sus propios estilos y textos. Configura el idioma `es-MX` y revisa que no queden textos en inglés ni colores fuera de la paleta (sobrescríbelos con `var(--dg-*)` dentro del componente).
- Patrones a copiar: `CaseFormDialog.vue` y `AuditoriaFormDialog.vue` (formularios en diálogo y fechas `DD-MM-AAAA`), `CasoDetalleDialog.vue` (ficha de solo lectura) y `CalendarioAdministrador.vue` (recarga en `visibilitychange`).
- **No entra:**
  - responder invitaciones, estado «por confirmar» y avisos (22);
  - juntas privadas y ver la agenda de otros (23);
  - correo (24);
  - vista de año (25);
  - arrastrar juntas para moverlas, juntas que se repiten y eventos de todo el día.
- Puertas: `npm run lint:check` (cuenta el código de salida), `npx prettier --check` en los archivos nuevos, `npm run build` y `node --test`. Navegador con `backend-experimento-3011` + `frontend-experimento-9012`, en escritorio y a 375 px:
  - crear, editar y borrar una junta con dos cuentas `zz_test_`;
  - que el invitado la vea con «Pendiente»;
  - que la recepcionista caiga en «Juntas»;
  - que el usuario de sistema reciba «Acceso denegado».
  - Al final, cerrar los servidores.

---

## Reporte del implementer

1. **Rebanada completada:** sí, cumple los 12 criterios. No se tocó el backend.
2. **Archivos:**
   - Nuevos: `utils/juntas.js`, `services/juntaService.js`, `pages/JuntasPage.vue`, `CalendarioJuntas.vue`, `JuntaFormDialog.vue` y `JuntaDetalleDialog.vue`.
   - Pruebas nuevas: `test/juntasUtils.test.js` (41), `test/juntasServicio.test.js` (7) y `test/juntasPantalla.test.js` (12).
   - Modificados: `package.json` y su lock (QCalendar `5.4.0` exacta), `router/index.js`, `constants.js` (la pantalla principal de la recepcionista pasa a `/juntas`), `MaquetaLayout.vue` (ítem «Juntas» en las 3 secciones) y `test/rolRecepcionista.test.js`.
3. **Pruebas en rojo:**
   - Faltaban los módulos, la ruta, el menú y los componentes.
   - `rolRecepcionista` falló por la nueva pantalla principal y porque su menú pasa a tener 2 ítems.
4. **Puertas:**
   - `lint:check`, `prettier --check` (archivos nuevos) y `build`: en verde.
   - `node --test`: 1504/1504.
   - **Dependencia:** `npm install` falló con `EBUSY` por el servidor de desarrollo del usuario (puerto 9000). El lock se generó con `--package-lock-only` y el paquete se extrajo a mano desde npm; `npm ls` lo reconoce.
   - **Navegador:**
     - crear, editar y borrar funcionan, con validación y confirmación;
     - mes, semana y día se ven bien, con recorte al horario laboral, cruce de medianoche y juntas encimadas;
     - el invitado ve la junta con «Pendiente» y sin «Editar» ni «Borrar»;
     - la recepcionista cae en `/juntas` y el usuario de sistema recibe «Acceso denegado»;
     - a 375 px abre en vista Día y no hay scroll horizontal;
     - QCalendar sale en español y con los colores de la paleta.
   - **Datos de prueba:** 0 cuentas `zz_test_%` y 0 juntas.
5. **Decisiones no cubiertas:**
   - Fechas: `parsearFechaISO` y `formatearFechaISO` propias en `utils/juntas.js`, armadas por componentes.
   - `time-clicks-clamped`: el clic en un hueco cae al inicio de la media hora.
   - Al editar una junta que cruza la medianoche, el formulario avisa que la dejará en un solo día.
   - El banner «No tienes juntas en este periodo.» no oculta el calendario.
   - `api.js` no tiene un nombre para `/juntas` (no estaba autorizado).
   - La vista Mes no recorta al horario laboral.
6. **Para la memoria:**
   - QCalendar se importa solo en `CalendarioJuntas.vue`.
   - En el panel del navegador, QCalendar no pinta nada hasta que se toma un screenshot.
   - Si `npm install` da `EBUSY`, hay un servidor de desarrollo abierto.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 12 criterios.
- Puertas: `lint:check` y `build` en verde; `node --test` 1504/1504; `npm ls` con QCalendar 5.4.0 y sin `invalid` ni `missing`.
- No probó en el navegador.

**Opcionales:**
- `npm ls` marca `extraneous` en `@parcel/watcher`, `node-addon-api` y `sass`. Ya estaban así antes de esta rebanada.
- `package.json` y el lock tienen finales de línea CRLF y LF mezclados.
- QCalendar pide Node 22.13 o superior. La imagen de Docker es `node:22`, que hoy instala la última 22.x.
- Correr `npm ci` con el servidor de desarrollo cerrado antes de publicar, para confirmar que el lock reconstruye el mismo árbol.

## Cierre del orquestador

- **Navegador:** la recepcionista `zz_test_` cae en `/juntas?vista=semana&fecha=2026-11-18`. Se ven la semana del 16 al 20 de noviembre de 8:00 a 19:00, los textos en español, el aviso «No tienes juntas en este periodo» y el menú con Juntas y Directorio.
- **Datos de prueba:** 0 filas `zz_test_%` y 0 juntas.
- **Estado:** aprobada.
