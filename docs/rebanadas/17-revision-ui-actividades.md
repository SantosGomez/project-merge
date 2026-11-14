# 17 — Revisión de UI/UX de «Mi trabajo / Mis actividades»

- **Fecha:** 2026-11-13 · **Rama:** `experimento` · **Hecha por:** agente con Fable 5.2
- **Skills:** `impeccable`, `emil-design-eng` y `.agents/skills/UI` (no se añadieron componentes de Uiverse: en una pantalla de trabajo diario nada lo justificaba)
- **Alcance:** los componentes del feature (rebanadas 10 a 16) y la parte de pestañas de `MyCasesPage.vue`. Sin tocar backend ni «Mis casos».
- **Sin segunda revisión independiente** de estos cambios; el orquestador corrió las puertas.

## Aplicado

**Rompía o confundía**
- **Cronómetro fuera de vista** (`CronometroActivo.vue`): cuando el aviso sale de la pantalla aparece una barra fija abajo (`q-page-sticky`) con cliente, tiempo y «Detener». Usa `IntersectionObserver` porque `position: sticky` no funciona dentro de `q-tab-panels`.
- **El renglón saltaba al marcar «Hecha»** (`utils/actividades.js`, `ListaDelMes.vue`): el orden se fija al cargar (`posicionesDeRenglones`); lo hecho baja al final al cambiar de mes o al volver a la ventana.
- **«Corregir horas» descartaba lo escrito al cambiar de día** (`JornadaFormDialog.vue`): ahora pregunta «¿Cambiar de día?».
- **Cifras del mes anterior al cambiar de mes** (`ListaDelMes.vue`): solo se muestran con el contenido cargado.

**Mejoras claras**
- Conmutador de cuatro vistas en celular: cuadrícula de 2 × 2, cada botón con el rótulo en una línea.
- Informes: barra «Actualizando el informe» y el informe anterior atenuado mientras llega el nuevo.
- Tooltips de los campos (minutos, nombre, día, RFC): salen arriba del campo y se quitan si hay error.
- Jerarquía: las cifras del mes van antes del párrafo de ayuda; la tarjeta de jornada es más compacta.
- Textos: «llevas 1 min de trabajo», «Solo tú las ves», tooltip de la pestaña «Mis actividades» y «Este mes» alineado.

**Pulido**
- Espacios del botón «Iniciar»; en celular «Iniciar», tiempo y «Hecha» caben en una línea también a 360 px.
- Etiqueta «Hecha» con el color de texto secundario; cliente atenuado en renglones hechos.
- «Hoy» apagado explica «Ya estás en el mes actual.»; foco visible en el icono de calendario de «Corregir horas».

**Comprobado sin cambio:** cabecera de grupo a 375 px (insignias apiladas, corrección de la rebanada 14) y tarjetas del detalle de bloques (todas del mismo ancho; no se reprodujo el hallazgo de la rebanada 16).

## Para decidir (no aplicado)

1. **«Iniciar» en historial fuera de cartera:** la API no dice si el renglón sigue en cartera. Recomendación: añadir `en_cartera` a `GET /actividades` y apagar el botón con su tooltip.
2. **Orden y plegado de la jornada:** desplegada mide unos 560 px en celular antes de la lista. Recomendación: que empiece plegada una vez registrada la entrada, o moverla debajo del conmutador. Cambia el flujo acordado.
3. **Acciones de «Mis tipos de actividad» en celular:** «Clientes / Editar / Desactivar» ocupan dos líneas por tipo. Recomendación: menú «Más» o botones de icono con tooltip.
4. **Flechas de mes del calendario** (`q-date`): menores de 44 px.
5. **Iconos de calendario de 24 px** en informes y «Corregir horas»: mismo pendiente que el resto de la app.
6. **Tooltip largo del conmutador:** aparece sobre los cuatro botones; recomendación: uno por opción.
7. **Cifras con tooltip sin acceso por teclado** (informes, totales): mismo pendiente global.
8. `MyCasesPage.vue` no pasa `prettier --check` desde antes; no se reformateó para no tocar «Mis casos».

## Pruebas y puertas

- Nueva `test/revisionUiActividades.test.js` (25 pruebas). En `test/jornada.test.js` cambiaron dos aserciones de texto («trabajados/trabajadas» → «de trabajo»). Ninguna relajada ni borrada.
- `node --test` 1362/1362, `npm run lint:check` 0, `npm run build` correcto, `prettier --check` limpio en lo tocado salvo `MyCasesPage.vue`.
- Navegador: escritorio 1366 × 900 y celular 375 px (y 360 px útiles), con una cuenta `zz_test_` ya borrada.

## Sin verificar

Estados de error de red y vacíos de cada vista (no cambiaron), la animación de la barra fija y `prefers-reduced-motion` (solo por código), el aviso de más de 10 horas, un dispositivo táctil real, `ClientesDeTipoDialog` y los tooltips de `ClienteFormDialog` (solo por prueba).
