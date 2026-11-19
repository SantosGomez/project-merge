# 33 — «Mi Calendario»: cabecera, móvil y vista Año

- **Riesgo:** medio (solo frontend; un componente nuevo y cambios de layout)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Criterios de aceptación

### Cabecera (E)

1. **`components/BarraPeriodo.vue` (nuevo):** la cabecera del calendario.
   - **Fila 1:** el periodo en grande (1.5 rem, peso 700, `aria-live="polite"`), la navegación compacta ‹ Hoy › y el slot de acciones («Nueva junta») a la derecha.
   - **Fila 2:** el selector de vista (Año, Mes, Semana y Día) y un slot para «Ver agenda de» y el interruptor de vencimientos.
   - Usa componentes de Quasar, la paleta del proyecto y `.control-touch`. Los botones de icono llevan tooltip con retraso, porque están fuera del calendario.
   - `JuntasPage.vue` usa este componente. El `h2` duplicado («Agenda de …») se integra en el periodo o en la franja de contexto.
2. **Texto de guía:** una sola línea que depende de la vista y de la agenda.
   - En tu agenda, en Semana y Día: «Pulsa un hueco libre para crear una junta».
   - En Mes y Año: «Pulsa un día para verlo».
   - En la agenda de otra persona: «Estás viendo la agenda de {nombre}».
   - Va en un `computed` puro con prueba.
3. **«Ver agenda de»:**
   - Las opciones (slot `#option`) llevan el nombre y debajo el rol. Para la recepcionista, en la línea del rol dice «Tú la administras».
   - Lo seleccionado (`#selected-item`) muestra solo el nombre, sin cortarlo.
   - Ya no aparecen dos paréntesis seguidos.
4. **Franja de la recepcionista:**
   - Es un `q-banner dense` de una línea con `inline-actions`: «Administras la agenda de {nombre}».
   - Si no estás en esa agenda, lleva la acción «Ver su agenda». Si ya estás en ella, la acción es «Volver a mi agenda».
   - El aviso de que no tiene agenda asignada no cambia.

### Móvil (E)

5. **Menos de 600 px:**
   - El texto de guía se oculta.
   - «Nueva junta» pasa a un botón flotante, `q-page-sticky` con `q-btn fab`, abajo a la derecha, con `aria-label`.
   - ‹ › quedan solo con icono.
   - «Ver agenda de» y el interruptor van en un `q-expansion-item` «Opciones de la vista».
   - El calendario empieza en los primeros 250 px de la pantalla.
6. **Semana y Mes en móvil:**
   - Se reutiliza el patrón de la tira de semana de `CalendarioAdministrador.vue` (`SemanaCalendario`): la tira de días arriba y debajo la agenda del día elegido, con sus bloques.
   - En Mes, una cuadrícula compacta con el número de juntas por día y, debajo, la lista del día elegido.
   - Si `SemanaCalendario` no se puede reutilizar tal cual, el implementer para y pregunta.
   - No hay scroll horizontal.

### Vista Año (F)

7. **Teclado:**
   - Foco itinerante: un solo día con `tabindex=0` (la fecha elegida u hoy).
   - Las flechas ←→ mueven un día, ↑↓ una semana, e Inicio y Fin van al principio y al fin del mes.
   - Enter abre la vista Día.
   - El movimiento del foco no se anima.
8. **Tamaño y posición:**
   - Los días miden al menos 44 px también en escritorio.
   - Al abrir, se hace `scrollIntoView` del mes de la fecha elegida.
9. **Peso visual:**
   - Los días sin juntas van en peso 400 y `texto-tenue`.
   - Los días con juntas llevan tinte por intensidad: 1, 2–3 y 4 o más, con colores de la paleta.
   - Hoy tiene un anillo de 2 px en `--dg-foco`.
   - El número de juntas sigue en el `aria-label`.

### Movimiento (G)

10. **`prefers-reduced-motion`** en `src/css/app.scss`:
    - se quita el desplazamiento de `jump-down` y `jump-up` (en selectores, tooltips, la campana y los calendarios del formulario) y se deja solo el fundido;
    - se desactiva el `shake` de los diálogos `persistent`.

    Las reglas de movimiento que ya funcionan no cambian.

11. **Estilo:** sin tooltips dentro del calendario. Paleta `$dg-colores`. Textos en tú.

## Archivos autorizados

- `Seguimiento-proyectos/src/components/BarraPeriodo.vue` (nuevo)
- `Seguimiento-proyectos/src/pages/JuntasPage.vue`, `src/components/CalendarioJuntas.vue` y `AnioJuntas.vue`
- `Seguimiento-proyectos/src/components/SemanaCalendario.vue`, solo si hace falta una prop opcional y sin cambiar su comportamiento actual; si no, parar y preguntar
- `Seguimiento-proyectos/src/utils/juntas.js` y `src/css/app.scss` (solo el bloque de `prefers-reduced-motion`)
- `Seguimiento-proyectos/test/juntas*.test.js` y las pruebas de movimiento que fallen, sin debilitarlas

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Esta rebanada va después de la 32, porque usa `BloqueJunta` en la agenda móvil.
- Navegador en escritorio y a 375 px con datos `zz_test_`. Comprobar:
  - la cabecera en las 4 vistas;
  - la recepcionista con su franja y el selector;
  - el móvil: botón flotante, opciones plegadas, tira de semana y Mes compacto;
  - la vista Año con el teclado (Tab y flechas);
  - la emulación de `prefers-reduced-motion`.

---

## Reporte del implementer

1. **Rebanada completada:** sí, los criterios 1 a 11. Los criterios 5 y 6 tienen las salvedades del punto 5.
2. **Archivos:**
   - Nuevos: `BarraPeriodo.vue` y `test/juntasCabeceraMovilAnio.test.js` (45 pruebas).
   - Modificados:
     - `JuntasPage.vue`, `CalendarioJuntas.vue` (tira de semana y Mes compacto en móvil) y `AnioJuntas.vue`;
     - `SemanaCalendario.vue`: prop opcional `conCabecera`, que por defecto es `true`, y la marca `junta`; el dashboard del administrador no cambia;
     - `juntas.js`: 6 helpers nuevos;
     - `app.scss`: solo el bloque de movimiento reducido.
   - Pruebas reapuntadas sin debilitarlas: `juntasPantalla`, `juntasLegibilidad` y `juntasRespuestas`.
3. **Prueba en rojo:** primero faltaba el export `accionesDeAtendidos`; después fallaron las pruebas estáticas de cada componente hasta implementarlo.
4. **Puertas:**
   - `lint:check` y `build` en verde; `node --test` 1744/1744.
   - `prettier --check` en verde, salvo `app.scss` y `SemanaCalendario.vue`, que usan CRLF. `app.scss` ya fallaba antes.
   - **Navegador** (Playwright):
     - en escritorio, la cabecera tiene dos filas;
     - a 375 px aparecen el botón flotante, las opciones plegadas, la tira de semana y el Mes compacto, sin scroll horizontal;
     - en la vista Año hay una sola parada de Tab, las flechas funcionan y los días miden 44 px;
     - la franja de la recepcionista muestra «Ver su agenda» o «Volver a mi agenda», según la agenda;
     - con `prefers-reduced-motion` no hay desplazamiento.
   - **Datos de prueba:** 0.
5. **Decisiones no cubiertas:**
   - **Altura del calendario:** con la franja de la recepcionista y un nombre largo, el calendario empieza en unos 337 px y no en 250.
   - **Tira de semana:** solo marca los días de la semana que ya está cargada.
   - **«Opciones de la vista»:** no lleva tooltip.
   - **Tinte del Año:** usa `color-mix` de colores de la paleta.
   - **Navegación:** ‹ › van solo con icono también en escritorio.
6. **Para la memoria:**
   - El calendario móvil usa `SemanaCalendario` o el mini mes, más la vista Día.
   - `BarraPeriodo` tiene los slots `acciones` y `opciones`.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 11 criterios.
- `SemanaCalendario` no cambia para el dashboard del administrador.
- `app.scss` solo cambia el bloque de movimiento reducido.
- No se pierde nada de las rebanadas 29, 30 y 32.
- El contraste estimado del `color-mix` es de unos 7:1.
- El desvío de altura en móvil (unos 337 px con la franja de la recepcionista) es aceptable.
- Puertas: `lint:check` y `build` en verde; `node --test` 1744/1744.

**Opcionales:**

1. Agregar elipsis al nombre del selector «Ver agenda de». **Aplicado por el orquestador** (`text-overflow: ellipsis`); `lint:check` y `node --test` 1744/1744 siguen en verde.
2. Agregar el par de contraste del `color-mix` a `paletaColores.test.js`.
3. Confirmar en el navegador, a 375 px, la altura con la franja y el foco del Año.

**Estado:** aprobada (2026-11-18).
