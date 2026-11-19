# 32 — «Mi Calendario»: legibilidad del calendario

- **Riesgo:** medio (solo frontend; dos componentes nuevos)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Criterios de aceptación

1. **`components/MarcaJunta.vue` (nuevo):** una píldora con icono y texto para las marcas de la junta:
   - «Responder» (`reply`), en `--dg-acento` con texto `--dg-superficie`;
   - «Responder por {nombre}» y «Tu respuesta pendiente»;
   - «Por confirmar» (`schedule`), en aviso;
   - «Cancelada»;
   - «Privada» (`lock`) y «Solo tú» (`person`), en neutro.

   En modo `solo-icono` (bloques angostos) solo muestra el icono y conserva el texto en el `aria-label`. El color nunca es el único indicador.
2. **`components/BloqueJunta.vue` (nuevo):** un solo bloque de junta para Semana, Día y Mes, con:
   - variantes por estado: normal, por confirmar, cancelada y ocupada o ajena;
   - las marcas de `MarcaJunta`;
   - la nota de recorte de la 29;
   - un **modo compacto** cuando el alto es de 45 px o menos, o el ancho de 120 px o menos: una sola línea «11:30 Título», con la hora en negrita.

   `CalendarioJuntas.vue` lo usa en lugar del marcado repetido. Se conservan las claves `claveDeJunta`, los `aria-label` y el comportamiento: abrir la ficha o, si es ajeno, sin ficha.
3. **Color por estado:**
   - **Cancelada:** neutro (`neutro-fondo`, borde `neutro-borde`, texto `texto-tenue`, título tachado), no rojo.
   - **Por confirmar:** rayado (`repeating-linear-gradient` 135° con `aviso-fondo` y `superficie`) y borde de aviso.
   - **Ocupado o ajeno:** rayado neutro con el icono `lock` en «Ocupado», no el gris punteado.
   - Todos los colores salen de `$dg-colores`. Si hace falta uno nuevo, se agrega a la paleta y, si va de texto sobre fondo, a `paletaColores.test.js`.
4. **Marcas que faltan:** «Privada» cuando la junta es privada y no es un bloque «Ocupado», y «Solo tú» cuando no tiene invitados. Ambas se calculan en `marcasDeJunta`, con prueba.
5. **Vista Mes:**
   - Primera línea «hora · título» y las marcas en una segunda línea pequeña.
   - Como máximo 3 elementos por día (juntas y vencimientos). Si hay más, un `q-btn flat dense` «+N más» abre la vista Día de esa fecha.
   - Todas las filas tienen el mismo alto.
6. **Vencimientos como «pestaña de expediente»:**
   - Llevan icono: `flag` para casos y `fact_check` para auditorías.
   - Fondo pleno, sin el borde izquierdo de las juntas, para no confundirse con ellas.
   - Título en hasta 2 líneas (`-webkit-line-clamp: 2`); la prioridad va en su propia píldora.
   - El `aria-label` completo se conserva.
7. **Bloque público de otra agenda:** «organiza {nombre}» va en su propia línea.
8. **Foco:** un solo anillo `outline: 2px solid var(--dg-foco); outline-offset: 2px` con `:focus-visible` en bloques, etiquetas, vencimientos y bloques ajenos. El bloque enfocado queda por encima de los demás (`z-index`).
9. **Tooltips de la cabecera** (fuera del calendario): `:delay="500"` en «Anterior», «Hoy» y «Siguiente», y `max-width="320px"` en todos los de la pantalla, en especial el de «Mostrar vencimientos».
10. **Sin tooltips dentro del calendario.** Textos en tú. Responsivo hasta 375 px.

## Archivos autorizados

- `Seguimiento-proyectos/src/components/BloqueJunta.vue` y `MarcaJunta.vue` (nuevos)
- `Seguimiento-proyectos/src/components/CalendarioJuntas.vue` y `src/pages/JuntasPage.vue` (solo tooltips)
- `Seguimiento-proyectos/src/utils/juntas.js` y `src/utils/vencimientosEnCalendario.js`
- `Seguimiento-proyectos/src/css/quasar.variables.scss` y `test/paletaColores.test.js`, solo si hace falta un color
- `Seguimiento-proyectos/test/juntas*.test.js` y `test/vencimientosEnCalendario.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Los bocetos de `BloqueJunta`, `MarcaJunta` y la dirección visual («agenda de despacho») están en el reporte de la revisión visual, resumido en `docs/revision-ux-mi-calendario.md`. Se usan como guía, no como código final.
- Navegador en escritorio y a 375 px con datos `zz_test_` (los scripts base están en `scratchpad\revision-ui\`). Comprobar:
  - una junta de 30 minutos;
  - dos juntas que se cruzan;
  - un día del Mes con 5 elementos;
  - una cancelada junto a un vencimiento de prioridad Alta;
  - una privada;
  - una sin invitados;
  - la agenda de otra persona;
  - el recorrido con Tab.

---

## Reporte del implementer

1. **Rebanada completada:** sí, los criterios 1 a 10, solo en el frontend.
2. **Archivos:**
   - Nuevos: `MarcaJunta.vue`, `BloqueJunta.vue` y `test/juntasLegibilidad.test.js`.
   - Modificados:
     - `CalendarioJuntas.vue`;
     - `JuntasPage.vue` (solo los tooltips);
     - `juntas.js` (`detalleDeMarca`, `esBloqueCompacto`, `limitarElementosDelDia`, y «Privada» y «Solo tú» en las marcas);
     - `vencimientosEnCalendario.js` (`iconoDeVencimiento`);
     - `paletaColores.test.js` (7 pares de contraste nuevos, sin colores nuevos).
   - Pruebas ajustadas para que apunten a `BloqueJunta.vue`: `juntasPantalla`, `juntasRespuestas`, `juntasAnioVencimientosPantalla` y `juntasFormularioFichaCarga`.
3. **Prueba en rojo:** primero faltaba el export `detalleDeMarca`; después fallaron las pruebas estáticas de los componentes y de los tooltips.
4. **Puertas:**
   - `lint:check` y `build` en verde.
   - `node --test` 1699/1699.
   - `prettier --check` en verde, salvo `paletaColores.test.js`, que ya fallaba antes.
   - Navegador, a 1280 px y a 375 px, con la cuenta del contador:
     - una junta de 30 minutos y dos juntas encimadas;
     - «+N más» en la vista Mes;
     - una junta cancelada junto a un vencimiento con prioridad Alta;
     - una junta privada y una sin invitados;
     - la agenda de otra persona, con el candado;
     - el recorrido con Tab.
   - No se probó en el navegador la agenda de la recepcionista.
   - Datos de prueba: 0.
5. **Decisiones no cubiertas:**
   - «+N más» cambia la URL con `router.replace` desde `CalendarioJuntas`, para no tocar más `JuntasPage.vue`.
   - En la vista Mes las juntas van antes que los vencimientos.
   - El ancho compacto se decide con `@container`.
   - En modo compacto las marcas no se pintan; quedan en el `aria-label`.
   - El foco usa `!important` para ganar a `app.scss`.
   - «Cancelada» usa el icono `event_busy`.
6. **Para la memoria:**
   - `BloqueJunta` y `MarcaJunta` son el único marcado de las juntas del calendario.
   - La vista Mes muestra como máximo 3 elementos por día y «+N más».

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 10 criterios.
- `BloqueJunta` conserva lo de las rebanadas 29 y 30: la ficha, el bloque ajeno, `data-junta-id`, el resaltado, las claves y las etiquetas fuera de horario.
- Los pares de contraste nuevos son reales.
- «+N más» conserva `?agenda=`.
- Las pruebas que se reapuntaron no quedaron más débiles.
- Puertas: `lint:check` y `build` en verde; `node --test` 1699/1699.

**Opcionales:**
- Nadie probó en el navegador la agenda de la recepcionista.
- Usar una sola constante para el ancho compacto, en lugar de los 100 px del `@container` y los 120 px del criterio.

**Estado:** aprobada (2026-11-18).
