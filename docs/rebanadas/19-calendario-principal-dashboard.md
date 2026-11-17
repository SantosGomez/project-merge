# 19 — Calendario como apartado principal del dashboard

- **Riesgo:** medio (reorganiza la página principal del administrador; sin backend ni tablas nuevas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus) + revisión UI/UX
- **Estado:** aprobada por el usuario («Sí, implementa», 2026-11-17); rama `experimento`

## Historia

Como administrador, quiero ver desde que entro al dashboard qué está vencido y qué vence pronto, con el calendario a la vista junto a los casos y las auditorías, y al elegir un día ver solo lo de ese día separado en casos y auditorías, para anticiparme sin perder la vista general del equipo.

## Criterios de aceptación

1. **Sin pestaña «Calendario».** Las pestañas vuelven a ser Casos | Auditorías. Un enlace viejo con `?tab=calendario` abre el dashboard en la vista general (no da error).
2. **Franja «Requiere atención»** arriba de todo, con cuatro cifras-botón:
   - «Vencidos»
   - «Vencen hoy»
   - «Esta semana» (de hoy a 7 días)
   - «Entregas pendientes» (de auditoría, de hoy a 7 días)

   Cuentan los mismos elementos que el calendario: casos importantes no finalizados, auditorías no completadas y entregas pendientes. El texto aclara «casos importantes». Cada cifra abre su lista en la columna derecha (criterio 5). Con 0 se muestra en tono neutro y no es botón.
3. **Escritorio (≥ 1024 px): dos columnas.**
   - **Izquierda (~320 px):** calendario compacto con marcas de color, leyenda, botón «Hoy» y filtro por contador.
   - **Derecha:** las pestañas Casos | Auditorías como hoy (`DetalleContador`, dona, `TableroAuditorias` sin cambios de comportamiento).
4. **Al elegir un día**, la columna derecha cambia al **modo día**:
   - **Encabezado** «Lo que vence el 12 de noviembre» con un chip «12 nov ✕» (tooltip «Volver a la vista general»).
   - **Pestañas propias del día:** Casos (n) | Auditorías (n). «Auditorías» junta los vencimientos de auditoría y las entregas, en dos subgrupos.
   - **Renglones:** se reutilizan los de la rebanada 18 (urgencia en texto, contador, «de {auxiliar}», «Ver»).
   - **Vacío:** «Nada vence este día.»
   - Si una pestaña del día queda vacía, la otra se abre sola. «Esc» o el chip vuelven a la vista general.
5. **Las cifras de la franja** abren el mismo modo con su rango (por ejemplo «Vencidos (5)» → «Lo vencido hasta hoy») y las mismas pestañas del día.
6. **Estado en la URL:**
   - `?dia=AAAA-MM-DD` o `?rango=vencidos|hoy|semana|entregas`; recargar o compartir el enlace conserva lo elegido.
   - `?tab=casos|auditorias` sigue funcionando en la vista general.
   - El filtro por contador aplica al calendario, a la franja y al modo día.
7. **Botones «Asignar caso» / «Asignar auditoría»:** igual que hoy en la vista general, según la pestaña. En modo día no se muestran.
8. **Móvil y tablet (< 1024 px):**
   - Arriba, la franja (2 × 2 cifras).
   - Debajo, el calendario plegado a una **tira de la semana** que se desliza de lado (7 días con marca y número), con «Ver mes» que despliega el `q-date` completo con `jump-down` de 180 ms.
   - Debajo, las pestañas (generales o del día).
   - Nada de scroll horizontal de página; objetivos de toque de 44 px.
9. **Datos:**
   - Mismos endpoints de la rebanada 18 (`GET /contadores/casos-importantes`, `GET /auditorias`, `GET /auditorias/calendario`), pedidos una vez al cargar el dashboard.
   - Recarga en silencio en `visibilitychange` y también después de asignar un caso o una auditoría (resuelve el opcional 2 de la rebanada 18).
   - Un fallo al releer no borra lo mostrado.
10. **Lógica pura** en `utils/calendarioAdministrador.js`, con pruebas `node --test`: cifras de la franja, elementos de un rango, agrupación del día en Casos / Auditorías. Contrato de fechas de AGENTS.md.
11. **Convenciones:** español y en tú, tooltips, Quasar, paleta `dg-*`, accesibilidad (región con `aria-live` al cambiar a modo día, foco al encabezado del día, el color nunca es el único indicador) y movimiento con `$curva-salida`.

## Archivos (a autorizar)

Frontend (`Seguimiento-proyectos/`):

- `src/pages/AdminDashboardPage.vue`: layout de dos columnas, franja, modo día, quitar la pestaña.
- `src/components/CalendarioAdministrador.vue`: queda solo el calendario compacto, leyenda, «Hoy» y filtro; emite `elegir-dia`.
- `src/components/ResumenAtencion.vue` (nuevo): la franja «Requiere atención».
- `src/components/VencimientosDelDia.vue` (nuevo): modo día/rango con sus pestañas, a partir de la lista que hoy vive en `CalendarioAdministrador.vue`.
- `src/components/SemanaCalendario.vue` (nuevo): tira de la semana para móvil.
- `src/utils/calendarioAdministrador.js` y `test/calendarioAdministrador.test.js`: funciones nuevas.

- `src/components/CasoDetalleDialog.vue`: solo el texto para el administrador (decisión 2), con su prueba en `test/`.

Fuera de esta lista, el implementer para y pregunta. Sin cambios en backend, `TableroAuditorias.vue`, `DetalleContador.vue` ni `CalendarioActividades.vue`.

## Decisiones del usuario (2026-11-17, «Sí, implementa»)

1. **«Esta semana»** = de hoy a los próximos 7 días.
2. **Texto de la ficha del caso para el administrador** (opcional 1 de la rebanada 18): se corrige aquí. Para el administrador la ficha no menciona «Editar»; dice que es de solo lectura. Para el contador y el auxiliar el texto no cambia. Se autoriza `src/components/CasoDetalleDialog.vue` solo para eso (prop o rol), con su prueba.
3. **La franja cuenta solo casos importantes**, igual que el calendario.

## Notas del orquestador

- **Origen:** idea del usuario (calendario como apartado principal y, al elegir un día, pestañas Casos / Auditorías) con la crítica UX acordada. No se esconden las vistas generales; el modo día es reversible y se ve con claridad.
- **No entra:** casos no importantes en el calendario, actividades de «Mis actividades», edición desde el calendario ni cambios de backend.

---

## Reporte del implementer

1. Rebanada completada: 19, calendario como apartado principal del dashboard. Sin pestaña «Calendario» (`?tab=calendario` abre la vista general), franja «Requiere atención», dos columnas en escritorio, modo día/rango con pestañas Casos | Auditorías, `?dia`/`?rango`, tira de la semana con «Ver mes» en móvil y tablet, y texto de la ficha del caso para el administrador.
2. Archivos modificados: `src/pages/AdminDashboardPage.vue`, `src/components/CalendarioAdministrador.vue` (ahora compacto, sin pedir datos), `src/components/CasoDetalleDialog.vue` (solo `textoAyuda`), `src/utils/calendarioAdministrador.js`, `test/calendarioAdministrador.test.js`. Nuevos: `ResumenAtencion.vue`, `VencimientosDelDia.vue`, `SemanaCalendario.vue`. La lista del día que estaba en el calendario pasó a `VencimientosDelDia.vue` (las filas se escriben una sola vez).
3. Prueba en rojo: las pruebas nuevas de lógica pura (`cifrasDeAtencion`, `elementosDeRango`, `agruparPorPestana`, `pestanaDelDia`, `leerVista`, `consultaConVista`, `diasDeTira`, encabezados) fallaron porque `calendarioAdministrador.js` no exportaba esas funciones (error de importación). Las de plantilla y de la ficha fallaron por el aserto: la pestaña seguía y faltaban los componentes y el texto.
4. Puertas: `node --test` 1404/1404 verde; ESLint verde (`npm run lint:check` no revisa formato); `npx prettier --check` verde en todos los archivos tocados salvo `AdminDashboardPage.vue`, que ya fallaba en HEAD por finales de línea y por saltos de línea; no se reformateó entera (solo se mantuvo la sangría de lo que se movió); `npm run build` verde; Backend `verificarPruebas.js` OK (57 archivos, 542 pruebas). Navegador (Playwright con cuentas `zz_test_s19_`): escritorio 1360 px, tablet 768 px y móvil 375 px sin scroll horizontal de página; cifras verificadas a mano con el filtro por contador (3/2/5/2); modo día, rango, foco en el encabezado, Esc, chip, recarga con `?dia`, `?rango`, `?tab=calendario`, auto-cambio a «Auditorías» cuando «Casos» queda vacía, tira de la semana, «Ver mes»/«Ocultar mes», ficha del caso como administrador (texto sin «Editar»), y que los botones de asignar no salen en modo día. Datos: 0 filas `zz_test_s19_`; las 12 cuentas antiguas quedaron intactas; servidores cerrados.
5. Decisiones no cubiertas:
   - Cada cifra cuenta todos los tipos (casos, auditorías y entregas) salvo «Entregas pendientes»; las entregas vencidas cuentan en «Vencidos».
   - «Esta semana» = hoy a hoy + 7 inclusive.
   - El filtro por contador vive en `CalendarioAdministrador.vue` y el dashboard lo comparte con la franja y el modo día (`v-model:contador`).
   - La tira de la semana son 3 semanas (anterior, actual y siguiente) deslizables.
   - «Ver mes» usa una transición propia de 180 ms con `--dg-curva-salida` (Quasar no incluye `jump-down` con `animations: []`).
   - Los conteos de las pestañas del día van en `q-badge`, no «(n)», porque la tipografía pinta «(1)» como ⓘ.
   - Un clic en el día ya elegido no lo desmarca; se vuelve con el chip o Esc.
   - Se usa `v-show` para conservar el contador elegido al salir del modo día.
   - Se envolvieron los botones de asignar en `<template v-if="!enModoDia">` y el texto de ayuda en `<template v-else>` para no romper pruebas existentes (`tableroAuditorias`, `revisionDashboardAdmin`, `t9Pages`), que no se modificaron.
   - Las dos columnas de «Casos» (lista y detalle) usan una consulta de contenedor (≥ 820 px) porque la columna derecha es más angosta.
   - Barra de carga lineal en vez de `ScreenLoader` para que `t9Pages` siga viendo `<ResumenEquipo` antes de `<ScreenLoader`.
6. Para la memoria: rebanada 19 hecha en `experimento`, sin commit. El dashboard admin pide una sola vez casos importantes, auditorías y entregas (`cargarCalendario`) y los reparte al calendario, la franja y el modo día; se recarga tras asignar y al volver a la ventana. Trampa: el backend 3011 puede quedar «running» pero caído; reiniciarlo.

## Correcciones tras la revisión (vuelta 1)

1. Scroll: `irALaVista` espera `await router.replace`, `nextTick` y un `requestAnimationFrame`; luego `VencimientosDelDia.enfocar()` enfoca el encabezado y lo lleva a la vista (`block: 'start'` bajo 1280 px, `nearest` en escritorio; `scroll-margin-top` por la barra). Al volver, no se lleva a ningún lugar raro: el foco regresa al control.
2. Dos columnas solo desde 1280 px (`calendarioCompacto` = ancho < 1280, separado de `pantallaChica` que sigue en `lt.md` para el diálogo del detalle). Entre 1024 y 1279 px: una columna con la tira y «Casos» como antes. Consulta de contenedor para que `ResumenEquipo` (sin tocarlo) baje la dona y las tarjetas cuando la columna es angosta.
3. `aria-live` quitado de la sección; línea `.sr-only` con `role="status"` siempre montada en la página («12 de noviembre: 1 caso y 2 auditorías»), con `resumenParaLector` y `etiquetaLargaDeDia` en el utils (con pruebas).
4. Foco al volver: `origenDeVista` (cifra por `data-rango`, día por tira o q-date); si no existe, el título de la página.
5. Tira: alineada al lunes de la semana del día base; `scroll-snap-align: start` en los lunes.
6. Subtítulo bajo cada cifra («casos, auditorías y entregas», «entregas de auditoría, de hoy a 7 días»).
7. «Vence el martes…» en minúscula.
8. Ayuda del modo día: «Pulsa la ✕ junto a la fecha o la tecla Esc para volver a la vista general.». Vive en `TEXTO_AYUDA_MODO_DIA` (utils) porque una prueba existente prohíbe «la ✕» en el texto de la página.
9. Chip solo `removable` (una parada de tabulación), con `remove-aria-label`.

Puertas: `node --test` 1414/1414, ESLint, prettier en lo tocado, build en verde. Navegador a 1360, 1280, 1100, 768 y 375 px con datos `zz_test_s19_` (borrados, 0 filas; servidores cerrados): sin scroll horizontal, foco de retorno correcto, tira alineada al lunes, anuncio correcto. Nota: en 375 px el título del día no llega al tope cuando la página es demasiado corta para desplazarse más.

## Nota del orquestador tras la vuelta 1

- El texto de ayuda propuesto («Pulsa la ✕…») chocaba con la regla de `revisionDashboardAdmin.test.js` (sin «Toca» ni «la ✕» en los textos). Mover el texto al utils para esquivar la prueba no respetaba esa regla, así que se cambió a «Para volver a la vista general, quita la fecha elegida o pulsa la tecla Esc.», y la prueba del utils ahora verifica que no use esas palabras.
- `t9Pages` prohíbe `scrollIntoView` en la página porque, al elegir un contador, la página ya no baja hasta el detalle. El desplazamiento nuevo es distinto: lleva al encabezado del modo día en pantallas chicas, y vive en `VencimientosDelDia.vue` (`enfocar()`). Se acepta.
- Puertas finales: `node --test` 1414/1414, lint y build en verde, prettier en verde en lo tocado (`AdminDashboardPage.vue` ya fallaba en HEAD).
