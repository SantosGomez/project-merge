# 30 — «Mi Calendario»: formulario, ficha y respuesta inmediata

Junta las rebanadas 30 y 31 propuestas en la revisión.

- **Riesgo:** medio (solo frontend; cambia cómo carga y cómo responde la pantalla)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Decisión del usuario

- **Ficha de la junta en móvil (menos de 600 px):** una sola columna, con la etiqueta arriba y el valor abajo, y **sin** el scroll interno de 120 px en la descripción y las observaciones. En escritorio se queda como está.

## Criterios de aceptación

### Formulario y ficha (B)

1. **Formulario** (`JuntaFormDialog.vue`):
   - Usa el mismo patrón que la ficha: `max-height` de unos 85vh, columna flex, cuerpo con `overflow-y: auto` y `q-card-actions` fijo al pie con un borde superior.
   - «Cancelar» y «Crear junta»/«Guardar» siempre se ven, también con 800 px de alto y con «Organiza: …».
   - Las ayudas («Formato DD-MM-AAAA», ayuda de invitados) quedan justo bajo su campo, con la prop `hint` o en el mismo bloque. No quedan sueltas debajo de toda la fila.
2. **Ficha en móvil** (`JuntaDetalleDialog.vue`): aplica la decisión del usuario.
   - Hay un solo scroll, el del cuerpo.
   - El pie no tapa ninguna sección.
3. **Encabezado «Responder por {nombre}»:** el nombre se ve como está escrito, no en mayúsculas.
4. **Editar desde la ficha:**
   - El formulario se abre cuando la ficha termina de cerrarse (`@hide`), para que nunca haya dos fondos a la vez.
   - Al cerrar el formulario, el foco vuelve al bloque de esa junta en el calendario, si está a la vista.

### Carga y respuesta (D)

5. **Cambio de periodo, vista o agenda:**
   - El `ScreenLoader` solo sale en la **primera** carga.
   - En las siguientes, el calendario se queda montado con `aria-busy`, una `q-linear-progress` indeterminada de 2 px arriba de la tarjeta y el contenido con opacidad reducida (transición de unos 150 ms).
   - Si una carga falla después de la primera, el calendario sigue visible y aparece un aviso con «Reintentar».
6. **Aviso «No tienes juntas en este periodo»:** ya no empuja el calendario. Va dentro de la tarjeta, sin cambiar el alto de la página.
7. **Guardar o borrar:**
   - Al guardar, se usa la junta que devuelve la API para insertarla o reemplazarla de inmediato en la lista. Al borrar, se quita de inmediato.
   - Después, una recarga silenciosa reconcilia los datos. Si esa recarga falla, no se muestra como fallo del guardado.
8. **Resaltar la junta guardada:**
   - Después de crear o editar, si la junta cae fuera del periodo o de la vista actual, la pantalla navega a su fecha (`irA`).
   - La junta queda resaltada unos 3 s con un anillo `--dg-acento` y una transición corta, con el mismo patrón que `caso-resaltado` de «Mis casos».
   - Si cae fuera de 8:00 a 19:00, se resalta su etiqueta en la franja de arriba.
9. **Responder:** con la ficha abierta ya no sale el aviso «Respuesta guardada.»: el botón marcado es la confirmación. Se agrega un `aria-live="polite"` que anuncia la respuesta. Si la respuesta falla, se muestra el error como hoy.
10. **Estilo:** Quasar y paleta `$dg-colores`. Textos en tú. Sin tooltips dentro del calendario. Respeta `prefers-reduced-motion`. Responsivo hasta 375 px.

## Archivos autorizados

- `Seguimiento-proyectos/src/pages/JuntasPage.vue`, `src/components/JuntaFormDialog.vue`, `JuntaDetalleDialog.vue` y `CalendarioJuntas.vue`
- `Seguimiento-proyectos/src/utils/juntas.js` (solo helpers puros, si hacen falta)
- `Seguimiento-proyectos/test/juntas*.test.js`

El backend no se toca. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Patrones a copiar:
  - `CalendarioActividades.vue`: el loader solo sin datos;
  - `MyCasesPage.vue`: `caso-resaltado`;
  - `JuntaDetalleDialog.vue`: el pie fijo.
- Puertas: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`.
- Navegador en escritorio, con 800 px de alto, y a 375 px, con cuentas `zz_test_`. Los scripts base están en `scratchpad\revision-ui\`. Comprobar:
  - el formulario de la recepcionista con «Organiza»;
  - la ficha de una junta con descripción larga en móvil;
  - que el calendario no salte al pasar de periodo;
  - crear una junta en otra semana: la pantalla debe navegar a ella y resaltarla;
  - borrar una junta;
  - responder.
- Al final quedan 0 datos de prueba y los servidores cerrados.

---

## Reporte del implementer

1. **Rebanada completada:** sí, los 10 criterios. La implementación se cortó una vez por el límite de uso y se retomó con el mismo agente.
2. **Archivos:**
   - `JuntasPage.vue`, `JuntaFormDialog.vue`, `JuntaDetalleDialog.vue` y `CalendarioJuntas.vue`.
   - `utils/juntas.js`: `juntaCaeEnRango`, `conJuntaGuardada` y `sinJunta`.
   - Prueba nueva `test/juntasFormularioFichaCarga.test.js` (24 pruebas).
   - Ajustes en 3 pruebas existentes por cambio de estructura.
3. **Prueba en rojo:** primero faltaba el export de los helpers; después fallaron las aserciones de la pantalla, el formulario y la ficha.
4. **Puertas:**
   - `lint:check`, `prettier --check` y `build` en verde; `node --test` 1666/1666.
   - Navegador (Playwright, 1280×800 y 375 px):
     - el calendario no se desmonta al cambiar de periodo;
     - los botones del formulario se ven, también con «Organiza»;
     - una junta creada en otra semana: la pantalla navega a ella y la resalta;
     - el foco vuelve al bloque;
     - nunca hay dos fondos de diálogo a la vez;
     - borrar quita la junta al instante;
     - la ficha en móvil va en una columna;
     - al responder, el anuncio es por `aria-live`, sin notificación;
     - si la carga falla, aparece «Reintentar» con el calendario visible.
   - Datos de prueba: 0.
5. **Decisiones no cubiertas:**
   - 3 pruebas existentes ajustadas por cambio de estructura:
     - «Respuesta guardada» ahora debe no aparecer;
     - la expresión regular de «Responder por» admite el `<span>`;
     - los invitados ahora usan `:hint`.
   - El foco solo vuelve a bloques con `data-junta-id`; «Ocupado» no lo tiene.
   - Un fallo en una carga posterior vacía `juntas`.
   - El `hint` de Quasar sustituye al `aria-describedby` manual.
   - La vista Año no resalta la junta guardada.
6. **Para la memoria:** al editar, conservar el fin de línea de cada archivo: los `.vue` de `components` usan CRLF y `JuntasPage.vue` usa LF.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 10 criterios.
- Revisó:
  - las carreras entre cargas con `peticionActual`;
  - que el guardado inmediato no duplique juntas;
  - el resaltado y la limpieza de su temporizador;
  - el foco al cerrar el formulario;
  - que el patrón de formularios del proyecto quedó intacto.
- Las 3 pruebas ajustadas no quedaron más débiles.
- Puertas: `lint:check` con salida 0, `build` en verde y `node --test` 1666/1666.
- No probó en el navegador.

**Opcionales:**
1. En la agenda de otra persona, `alGuardar` puede mostrar unos instantes una junta que no es de esa agenda, hasta que la recarga la corrige.
2. Si falla una carga posterior, el calendario queda vacío debajo del aviso.
3. La vista Año no resalta la junta guardada.

**Estado:** aprobada (2026-11-18). El orquestador se apoya en la prueba con Playwright del implementer.
