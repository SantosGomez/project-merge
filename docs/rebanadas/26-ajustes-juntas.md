# 26 — Ajustes al módulo «Juntas»

- **Riesgo:** medio (cambia una validación del backend y la pantalla; sin cambios de esquema)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Historia

Como administrador, quiero bloquear mi horario sin tener que invitar a nadie, para que los demás vean en mi agenda cuándo estoy ocupado y les sea más fácil agendar conmigo. Como contador, quiero ver en el calendario los vencimientos de las auditorías en las que participo, además de los de los casos de mi equipo. Y el calendario no debe mostrar tooltips.

## Decisiones del usuario

1. **Juntas sin invitados:** cualquier junta puede no tener invitados. Así el administrador, o cualquiera, bloquea su propio horario. La regla de «Por confirmar» no cambia.
2. **Vencimientos solo del equipo:**
   - Los vencimientos de **casos** ya son solo los del equipo: «Mis casos» trae los propios, los de sus auxiliares y los de los contadores a los que apoya. No cambia.
   - Se agregan los vencimientos de **auditorías** en las que participa el contador.
3. **Tooltips:** se quitan todos los tooltips dentro del calendario (`CalendarioJuntas.vue` y `AnioJuntas.vue`). Es una excepción a la regla general de `AGENTS.md`, que se propondrá anotar.

## Criterios de aceptación

### Juntas sin invitados

1. **Backend:**
   - `POST` y `PATCH /juntas` aceptan `participantes: []`. Si no se envía, se toma como lista vacía.
   - El máximo sigue en 50, y siguen las demás reglas: sin repetidos, sin el creador y con un rol del calendario.
   - Un valor que no sea arreglo da 400 sobre `participantes`.
   - Una junta sin invitados queda `confirmada` y no crea avisos.
   - Al editar, se puede pasar de tener invitados a no tener ninguno; los invitados que salen dejan de ver la junta, igual que ahora.
2. **En la agenda de otra persona** (23), una junta sin invitados del organizador sale como cualquier otra, «Ocupado» si es privada.
3. **Frontend:**
   - En `JuntaFormDialog.vue` el campo de invitados deja de ser obligatorio: sin asterisco y sin el error «Elige al menos un invitado».
   - Ayuda visible: «Si no invitas a nadie, la junta solo bloquea tu horario y los demás la verán en tu agenda».
   - La ficha muestra «Sin invitados» cuando no hay ninguno.

### Vencimientos de auditorías (solo contador)

4. **Fuente:** las auditorías del contador vienen de `GET /auditorias`, que ya devuelve solo las suyas. Se usa `auditoriaService.listarAuditorias` tal como está.
   - Quedan fuera las que tienen `estado` «Completado».
   - La fecha es `fecha_vencimiento` (`AAAA-MM-DD`), comparada como texto.
   - El auxiliar, el administrador y la recepcionista no ven auditorías en este calendario; el administrador ya las tiene en su resumen.
5. **Etiqueta:**
   - Va en Mes, Semana y Día, junto a los vencimientos de casos.
   - El texto es «Auditoría: {cliente}» y se distingue de los casos por texto, no solo por color.
   - Se usan los colores de la paleta `$dg-colores`. Si hace falta un color nuevo, se agrega a la paleta y, si va de texto sobre fondo, a `paletaColores.test.js`.
   - Al hacer clic se abre la ficha de la auditoría (`auditoria-ficha`, `/auditorias/:id`).
6. **Interruptor:**
   - Ahora dice «Mostrar vencimientos» y controla tanto los casos como las auditorías.
   - Conserva la misma clave de `localStorage`, para no perder la preferencia guardada.
   - Si la carga de auditorías falla, se comporta igual que con los casos: el calendario sigue visible y aparece el aviso con «Reintentar».
   - En la agenda de otra persona y en la vista Año no se muestran vencimientos.

### Sin tooltips en el calendario

7. **Se quitan los `q-tooltip`** de `CalendarioJuntas.vue` y `AnioJuntas.vue`, es decir, de los bloques de junta, de los bloques «Ocupado» y de los vencimientos.
   - La información debe seguir disponible: el texto visible de cada bloque y su `aria-label` se conservan. En los «Ocupado» se mantiene «No estás invitado a esta junta» en el `aria-label`.
   - Se quita la lógica de `ayudaDeOcupada`/`enfocada`/`encima` que solo servía al tooltip, sin romper el foco con teclado.
   - Los tooltips de los botones de la pantalla (fuera del calendario) se quedan.
8. **Datos de prueba:** solo cuentas `zz_test_`; al terminar, 0 filas `zz_test_%`, 0 juntas, casos, auditorías y avisos de prueba. Las juntas, casos y auditorías del usuario no se tocan.

## Archivos autorizados

Backend:
- `src/utils/validacionJuntas.js`, `src/controllers/JuntaController.js` y `src/models/JuntaModel.js` (solo si hace falta para la lista vacía)
- `test/validacionJuntas.test.js`, `test/juntas.test.js`, `test/respuestasJuntas.test.js` y `test/agendaJuntas.test.js`
- `soporte-pruebas/verificarPruebas.js` (`MINIMOS`)

Frontend:
- `src/components/JuntaFormDialog.vue`, `JuntaDetalleDialog.vue`, `CalendarioJuntas.vue` y `AnioJuntas.vue`
- `src/pages/JuntasPage.vue`
- `src/utils/juntas.js` y `src/utils/vencimientosEnCalendario.js`
- `src/css/quasar.variables.scss` y `test/paletaColores.test.js` (solo si hace falta un color)
- `test/juntas*.test.js` y `test/vencimientosEnCalendario.test.js`

El servicio de auditorías, sus pantallas y las del administrador no se tocan. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Al implementar juntas sin invitados, revisar que `estadoJunta`, los avisos (que no crean nada si la lista está vacía), los `IN (...)` armados a mano con una lista vacía y la agenda de la 23 no fallen.
- Puertas:
  - Backend: `node --test --test-concurrency=1` por archivo y `verificarPruebas.js`.
  - Frontend: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`.
- Navegador (en escritorio y a 375 px):
  - un administrador `zz_test_` crea una junta sin invitados;
  - un contador `zz_test_` la ve como «Ocupado» o con su título en «Ver agenda de»;
  - un contador `zz_test_` asignado a una auditoría `zz_test_` que vence esta semana ve «Auditoría: …» y el clic abre su ficha;
  - al pasar el cursor por los bloques del calendario no aparece ningún tooltip.

---

## Reporte del implementer

1. **Rebanada completada:** sí, con los tres cambios.
   - Juntas sin invitados: se aceptan `[]` o la ausencia del campo, y quedan confirmadas sin avisos.
   - Vencimientos de auditorías para el contador: «Auditoría: {cliente}», abren `auditoria-ficha` y no incluyen las Completado.
   - Interruptor «Mostrar vencimientos».
   - Sin `q-tooltip` en `CalendarioJuntas.vue`; se conservan `tabindex` y `aria-label`. `AnioJuntas.vue` no tenía tooltips.
2. **Archivos:**
   - Backend: `validacionJuntas.js` y `JuntaModel.js` (listas vacías en `IN` e `INSERT`), las pruebas `validacionJuntas`, `juntas` y `agendaJuntas`, y `MINIMOS`.
   - Frontend: `CalendarioJuntas.vue`, `JuntaFormDialog.vue`, `JuntasPage.vue`, `juntas.js`, `vencimientosEnCalendario.js` y 3 archivos de pruebas.
3. **Prueba en rojo:**
   - `validarParticipantes` rechazaba `[]` y `undefined`.
   - En el frontend fallaron 8 aserciones: validación de invitados, auditorías, tooltips, asterisco y textos.
4. **Puertas:**
   - Backend: 780/780 y `verificarPruebas.js` OK.
   - Frontend: `lint:check`, `prettier --check` y `build` en verde; `node --test` 1589/1589.
   - Navegador, en escritorio y a 375 px:
     - junta sin invitados creada por el administrador;
     - vista desde la agenda de un contador;
     - «Auditoría: …» con su clic a la ficha;
     - 0 tooltips;
     - sin scroll horizontal.
   - No se probó en el navegador el aviso de error al fallar la carga de auditorías.
   - Quedaron 0 datos de prueba.
5. **Decisiones no cubiertas:**
   - `auditoriaService` entrega `fechaVencimiento` como `DD-MM-AAAA` en camelCase; se reordena como texto.
   - Los vencimientos llevan `tipo: 'caso' | 'auditoria'`.
   - Mensaje nuevo para participantes no válidos.
   - `participantes: null` responde 400.
6. **Para la memoria:**
   - Juntas sin invitados permitidas.
   - Calendario sin tooltips.
   - Trampa: `auditoriaService` da las fechas en `DD-MM-AAAA`.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 8 criterios.
- Puertas:
  - Backend: 61/61 en los archivos de juntas y `verificarPruebas.js` OK, con 780 pruebas.
  - Frontend: `lint` y `build` en verde; `node --test` 1589/1589.
- Revisó por código que las listas vacías no armen `IN ()` y que no se creen avisos.

**Opcionales:**
- No probó en el navegador; se apoya en la prueba del implementer.
- `JuntasPage.vue` tiene comentarios largos.
- **Para tener en cuenta:** en un `PATCH`, si se omite `participantes`, se quitan todos los invitados. El frontend siempre envía la lista completa.

- **Estado:** aprobada. La excepción de los tooltips ya quedó anotada en `AGENTS.md`.
