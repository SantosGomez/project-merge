# 23 — Juntas privadas y agenda de otros

- **Riesgo:** alto (columna nueva, visibilidad de datos de otras personas)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Opus)
- **Estado:** aprobada

## Historia

Como cualquier usuario del calendario, quiero ver la agenda de otra persona, por ejemplo la del administrador, para saber si está libre antes de invitarla. Y como organizador, quiero marcar una junta como privada para que los demás solo vean «Ocupado».

## Decisiones

- **Del usuario:** la privacidad se decide junta por junta.
- **Del orquestador:**
  - cualquiera de los 4 roles del calendario puede consultar la agenda de cualquiera de esos roles;
  - una junta pública muestra a terceros solo el título, el horario y el organizador; nunca la descripción ni los invitados.

## Criterios de aceptación

### Backend

1. **Esquema:** migración idempotente que agrega `juntas.privada` TINYINT(1) NOT NULL DEFAULT 0. Las juntas existentes quedan públicas.
2. **Alta y edición:**
   - `POST` y `PATCH /juntas` aceptan `privada` (booleano; si no viene, `false`). Cualquier otro tipo da 400, sobre `privada`.
   - La junta completa devuelve `privada`.
3. **`GET /juntas/agenda/:usuarioId?desde&hasta`** (mismas reglas de rango que la 21a):
   - Devuelve las juntas donde esa persona es organizadora o invitada. No incluye las `cancelada` ni las que esa persona rechazó, porque ahí no está ocupada.
   - **Si quien consulta participa** (organiza o está invitado): la junta completa, como en `GET /juntas`.
   - **Si no participa y la junta es pública:** `{ id: null, titulo, inicio, fin, organizador: { nombre }, privada: false, ocupado: true }`.
   - **Si no participa y la junta es privada:** `{ id: null, titulo: 'Ocupado', inicio, fin, privada: true, ocupado: true }`, sin organizador.
   - La respuesta es `{ usuario: { id, nombre, rol }, juntas: [...] }`.
   - Un `usuarioId` que no existe o que no tiene un rol del calendario da 404. Uno no numérico da 400.
   - La ruta usa `requireCalendario` y entra en `autorizacionMatriz` y en `inyeccionSql`.
4. **Sin fugas:** las demás rutas (`GET /juntas`, `GET /juntas/:id`) no cambian su regla: una junta ajena sigue respondiendo 404.

### Frontend

5. **Interruptor «Junta privada»** en `JuntaFormDialog.vue`:
   - Ayuda: «Quien no esté invitado solo verá «Ocupado» en las agendas».
   - En la ficha, si la junta es privada, se muestra el chip «Privada».
6. **Selector «Ver agenda de»** en la pantalla «Juntas»:
   - Opciones: «Mi agenda» más las personas de `participantes-disponibles`, con su rol.
   - La elección viaja en la URL (`?agenda=ID`).
   - En la agenda de otra persona, el título dice «Agenda de {nombre}».
   - Los bloques ajenos muestran «Ocupado» o «{título} · organiza {nombre}», sin abrir ninguna ficha. Un tooltip con teclado aclara: «No estás invitado a esta junta».
   - Las juntas en las que yo participo se abren con su ficha completa, como siempre.
7. **Agendar con esa persona:** en la agenda de otro, «Nueva junta» o un clic en un hueco vacío abre el diálogo con esa persona ya invitada. Así se agenda una junta con el administrador desde su agenda.
8. **Textos y estilo:** Quasar, paleta `$dg-colores`, tú. «Ocupado» se distingue por texto y no solo por color. Funciona a 375 px.
9. **Datos de prueba:** solo cuentas `zz_test_`; al terminar, 0 filas `zz_test_%`, 0 juntas y 0 avisos de prueba.

## Archivos autorizados

Backend:
- `src/utils/seed.js` (solo la migración de `privada`)
- `src/models/JuntaModel.js`, `src/controllers/JuntaController.js`, `src/routes/juntaRoutes.js` y `src/utils/validacionJuntas.js`
- `test/juntas.test.js`, `test/validacionJuntas.test.js`, `test/agendaJuntas.test.js` (nuevo), `test/autorizacionMatriz.test.js`, `test/inyeccionSql.test.js`
- `soporte-pruebas/verificarPruebas.js` (`MINIMOS`)

Frontend:
- `src/services/juntaService.js`, `src/utils/juntas.js`
- `src/pages/JuntasPage.vue`, `src/components/JuntaFormDialog.vue`, `src/components/JuntaDetalleDialog.vue` y `src/components/CalendarioJuntas.vue`
- `test/juntas*.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- **Privacidad:** la prueba clave es que un tercero nunca reciba la descripción, los invitados ni el `id` de una junta ajena. Tampoco el título, si es privada. Comprobarlo con aserciones sobre las llaves exactas.
- **No entra:** el correo (24) ni la vista de año (25).
- Puertas y navegador como en la 22. En el navegador:
  - un contador `zz_test_` crea una junta privada con un administrador `zz_test_`;
  - un auxiliar `zz_test_` consulta la agenda del administrador y ve «Ocupado» sin el título;
  - desde esa agenda, el auxiliar agenda una junta con el administrador ya invitado.

---

## Reporte del implementer

1. **Rebanada completada:** sí, backend y frontend.
   - Backend: columna `juntas.privada` y ruta `GET /juntas/agenda/:usuarioId`, que muestra la junta completa a quien participa y las llaves mínimas a un tercero.
   - Frontend: interruptor «Junta privada», chip «Privada» en la ficha y selector «Ver agenda de» (`?agenda=`).
   - Desde la agenda de otra persona, «Nueva junta» abre el formulario con esa persona ya invitada.
2. **Archivos (todos dentro de la lista):**
   - Backend: `seed.js`, `JuntaModel.js`, `JuntaController.js`, `juntaRoutes.js` y `validacionJuntas.js`.
   - Pruebas del backend: `agendaJuntas.test.js` (nueva, 9 pruebas), `juntas`, `validacionJuntas`, `autorizacionMatriz`, `inyeccionSql` y `MINIMOS`.
   - Frontend: `juntaService.js`, `juntas.js`, `JuntasPage.vue`, `JuntaFormDialog.vue`, `JuntaDetalleDialog.vue`, `CalendarioJuntas.vue` y 3 archivos de pruebas.
3. **Prueba en rojo:**
   - Faltaban la columna, la validación y la ruta: la agenda daba 404 en sus 9 pruebas.
   - En el frontend faltaban las funciones nuevas, `privada` en el cuerpo de la petición y el interruptor, el selector y el chip.
4. **Puertas:**
   - Backend: los 78 archivos en verde; `verificarPruebas.js` con 778 pruebas.
   - Frontend: `lint:check`, `prettier --check`, `build` y `node --test` (1537/1537) en verde.
   - Navegador:
     - un auxiliar ve en la agenda del administrador solo «Ocupado 10:00 – 11:00»;
     - al pulsar ese bloque no se abre nada, y con el teclado aparece el tooltip «No estás invitado a esta junta»;
     - «Nueva junta» trae al administrador ya invitado;
     - a 375 px no hay scroll horizontal.
   - Datos de prueba: 0 de prueba; las juntas del usuario quedaron intactas.
5. **Decisiones no cubiertas:**
   - `privada: null` responde 400.
   - La agenda valida en este orden: id (400), rango (400) y persona (404), con el campo «persona solicitada».
   - Las juntas canceladas se filtran con el estado calculado.
   - Un `?agenda=` inválido muestra el error de carga con «Reintentar».
   - El bloque ajeno es un `div` con `tabindex` y `aria-label`, no un `q-btn`.
   - El texto del error de carga dice ahora «las juntas» en vez de «tus juntas».
6. **Para la memoria:**
   - Para que el estilo del bloque ocupado funcione hace falta el selector doble `.junta-bloque.junta-bloque--ocupada`.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

**VEREDICTO: CAMBIOS NECESARIOS** (Opus, 2026-11-18, sin modificar archivos).

- La privacidad del backend cumple: las llaves exactas están probadas, la regla usa a quien consulta y no hay fugas por `GET /juntas`, `GET /juntas/:id` ni `/notificaciones`.
- Puertas en verde: backend 778 pruebas; frontend 1537/1537, `lint` y `build`.
- Probado en el navegador.

**Cambio necesario:**

1. `utils/juntas.js:214` y `CalendarioJuntas.vue`: `claveDeJunta` arma la clave `ocupado-${indice}`, que se repite en cada día. Al enfocar un «Ocupado», su tooltip aparece también en el de otros días. Hay que usar una clave única en todo el calendario y agregar la prueba de dos días distintos.

**Opcional:**

- `JuntaFormDialog.vue:266`: el tooltip dice «en tu agenda» y la ayuda visible dice «en las agendas». Hay que unificarlos.

## Vuelta 2

- **Implementer:**
  - `claveDeJunta` ahora arma `ocupado-${inicio}-${indice}`, con una prueba nueva de dos días distintos.
  - El tooltip del interruptor dice «en las agendas».
  - Navegador: con dos «Ocupado» en días distintos, solo aparece un tooltip a la vez. El foco se simuló con eventos sintéticos, porque el panel no tenía foco real.
  - Frontend: 1538/1538, `lint`, `prettier` y `build` en verde. 0 datos de prueba.
- **Verificación del orquestador:** leí la línea corregida y volví a correr `juntasUtils` (47/47). Quedan 0 cuentas `zz_test_` y solo las 2 juntas del usuario.
- **Estado:** aprobada (2026-11-18).
