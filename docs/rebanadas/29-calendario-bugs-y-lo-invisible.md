# 29 — «Mi Calendario»: bugs y lo que no se ve

- **Riesgo:** medio (solo frontend; cambia lo que se muestra en Semana y Día)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Decisiones del usuario (2026-11-18)

- **Fin de semana:** la vista Semana agrega sábado y domingo **solo cuando esa semana tiene juntas o vencimientos en esos días**. Esto cambia lo que decidieron la 21b y la 25: hasta ahora, de lunes a viernes siempre.
- Se aplican todas las rebanadas de la revisión, de la 29 a la 33, una tras otra.

## Criterios de aceptación

1. **Juntas fuera de 8:00 a 19:00 (A1).** En Semana y Día, una junta que queda entera antes de las 8:00 o después de las 19:00 aparece en la franja de arriba del día (`#head-day-event`, donde ya van los vencimientos) como etiqueta:
   - el texto es «Antes de las 8:00 · {hora} {título}» o «Después de las 19:00 · {hora} {título}»;
   - al hacer clic abre su ficha;
   - si es un bloque ajeno de la 23, se muestra igual, sin ficha;
   - un bloque **recortado** (empieza antes o termina después del horario) muestra «Empieza {hora real}» o «Sigue hasta {hora real}», usando `recortadaAntes` y `recortadaDespues` de `segmentoDelDia`.
2. **Fin de semana (A2).**
   - La vista Semana muestra sábado y domingo solo si esa semana tiene juntas (propias o de la agenda que se ve) o vencimientos en esos días.
   - Si no hay nada, se queda de lunes a viernes.
   - El rango de carga sigue siendo de lunes a domingo, así que basta con decidir qué días se pintan.
3. **Vista Mes, juntas que cruzan la medianoche (A3).** En el día de continuación, la etiqueta dice «Hasta {hora fin}» en vez de repetir la hora de inicio. Va en un helper puro con prueba, por ejemplo `horaEnElDia(junta, dia)` en `utils/juntas.js`.
4. **Hover (A4).**
   - El hover de los bloques y etiquetas no cambia el color de su estado: refuerza el que ya tiene, con un hover propio para cada estado.
   - Va dentro de `@media (hover: hover) and (pointer: fine)`, con `transition` corta.
   - Lo mismo con el hover de los huecos de 30 minutos, cuyo `cursor: pointer` queda solo en los huecos y no en la columna de horas.
5. **«Responder» en la agenda de otra persona (A5).**
   - **En tu agenda:** «Responder» sigue como hoy y se refiere a tu invitación.
   - **Recepcionista en la agenda de un administrador que atiende:** la marca es «Responder por {nombre}» cuando ese administrador tiene la respuesta pendiente. Sale de `responder_por` de la junta.
   - **Cualquier otra agenda ajena:** si la persona que mira tiene su propia invitación pendiente, la marca dice «Tu respuesta pendiente».
   - Va en `marcasDeJunta` con un parámetro nuevo (el id de la agenda que se ve), con prueba.
6. **Campana (A6).**
   - En móvil, el número de avisos no queda cortado en el borde superior.
   - Hay una sola barra de desplazamiento: se quita el `max-height` de la lista, porque el `q-menu` ya limita el alto.
   - Los avisos ya no se piden 2 o 3 veces por carga: se observa `route.path`, no `route.fullPath`.
   - El comportamiento de «marcar como leído al abrir» no cambia.
7. **Sin tooltips dentro del calendario** (excepción de `AGENTS.md`). Paleta `$dg-colores`, textos en tú, responsivo hasta 375 px.

## Archivos autorizados

- `Seguimiento-proyectos/src/components/CalendarioJuntas.vue`, `src/pages/JuntasPage.vue`, `src/utils/juntas.js` y `src/components/CampanaAvisos.vue`
- `Seguimiento-proyectos/test/juntas*.test.js` y las pruebas de la campana que fallen, sin debilitarlas (`test/campana*.test.js`, `test/revisionCampanaEnlace.test.js`)

El backend no se toca. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- La evidencia de cada punto está en `docs/revision-ux-mi-calendario.md`: capturas, archivo:línea y observaciones.
- Para recrear los datos de prueba se pueden usar como base los scripts de `C:\Users\DBS-IT1\AppData\Local\Temp\claude\ad1317e54a52c51d\8c09610a-0a04-4029-a891-bd957a27c00e\scratchpad\revision-ui\`: `crear-cuentas.js`, `crear-juntas.js` y `limpiar.js`. Los datos de la revisión ya se borraron.
- Puertas: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`. Navegador en escritorio y a 375 px con cuentas `zz_test_`, para comprobar:
  - junta a las 06:30, de 22:00 a 01:30 y a las 19:30;
  - junta en sábado;
  - hover de una junta «Por confirmar»;
  - «Responder por» de la recepcionista;
  - campana en móvil.
- Si el panel del navegador está oculto, se puede usar Playwright, como en la revisión.

---

## Reporte del implementer

1. **Rebanada completada:** sí, del A1 al A6, solo en el frontend.
2. **Archivos:**
   - `utils/juntas.js`: helpers `horaEnElDia`, `etiquetaFueraDeHorario`, `notaDeRecorte` y `semanaMuestraFinDeSemana`, más el parámetro `agendaId` en `marcasDeJunta`.
   - `CalendarioJuntas.vue`, `JuntasPage.vue` y `CampanaAvisos.vue`.
   - Pruebas nuevas en `juntasUtils.test.js` y `juntasRespuestas.test.js`. No se tocó ninguna prueba existente.
3. **Prueba en rojo:**
   - Los helpers fallaron por un import que no existía.
   - Las pruebas que leen el código se escribieron después de implementar, así que no tuvieron rojo.
4. **Puertas:** `lint:check`, `prettier --check` y `build` en verde; `node --test` 1642/1642.
   - **Navegador** (Playwright, en escritorio y a 375 px):
     - sábado y domingo aparecen en Semana cuando hay juntas;
     - las etiquetas «Antes de las 8:00» y «Después de las 19:00» se ven y abren la ficha;
     - en Mes sale «Hasta 01:30»;
     - el hover de «Por confirmar» conserva su fondo;
     - aparecen «Responder por {nombre}» y «Tu respuesta pendiente»;
     - la campana no tiene doble scroll y no repite peticiones.
   - **Sin probar en el navegador:** el número de la campana en móvil (no había avisos sin leer) y el bloque «Ocupado» fuera de horario.
   - **Datos de prueba:** 0.
5. **Decisiones no cubiertas:**
   - Una nota de recorte que cae en otro día lleva la fecha.
   - Una junta del viernes que cruza al sábado cuenta para mostrar el fin de semana.
   - En una agenda ajena, el fin de semana depende solo de las juntas.
   - El hover de «Por confirmar» y «Cancelada» agrega un borde interior y no cambia el fondo.
6. **Para la memoria:**
   - La vista Semana muestra el fin de semana solo cuando tiene algo (cambia lo decidido en la 21b y la 25).
   - La firma es `marcasDeJunta(junta, usuarioId, agendaId)`.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 7 criterios.
- Revisó los bordes de las etiquetas fuera de horario: una junta que termina a las 8:00 exactas, una que empieza a las 19:00 exactas y una de 22:00 a 01:30.
- Revisó el fin de semana, las marcas de respuesta y la campana con `route.path`.
- Puertas: `lint:check` con salida 0, `build` en verde y `node --test` 1642/1642.
- No probó en el navegador.

**Opcionales:**
- Varias pruebas leen el código en vez de probar el comportamiento.
- Falta comprobar en pantalla el número de la campana a 375 px y el bloque «Ocupado» fuera de horario.

**Estado:** aprobada (2026-11-18). El orquestador se apoya en la prueba en el navegador del implementer.
