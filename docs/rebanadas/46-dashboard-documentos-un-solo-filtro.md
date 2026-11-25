# 46 — Dashboard de documentos: tarjetas y selector como un solo filtro

- **Riesgo:** medio (filtro de la tabla)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`)
- **Estado:** refinada

## Historia

Como contador o administrador, quiero que las tarjetas del Dashboard y el selector de la tabla sean el mismo filtro, para ver siempre en un solo lugar qué estoy filtrando y no tener dos filtros que se contradicen.

## Problema

En `Seguimiento-proyectos/src/modulos/documentos/pages/DashboardPage.vue` la tarjeta pulsada (`tarjetaActiva`, chip «Solo: …») y el selector «Estado» (`filtroEstado`) se aplican juntos con un Y en `filteredRows`. Con «Completados» activa, el selector no cambia nada o deja la tabla vacía, y el chip no coincide con el selector.

## Decisión del usuario (2026-11-25)

Un solo filtro: el selector «Estado» pasa a ser «Mostrar» y reúne las vistas de las tarjetas y los estados.

## Criterios de aceptación

1. Un solo valor de filtro (por ejemplo `filtroMostrar`) reemplaza a `tarjetaActiva` y `filtroEstado`. Valores: `Todos`, las cuatro vistas de tarjeta (`recibidos`, `enTramite`, `vencidos`, `completados`, con la regla de `coincideConTarjeta`) y los cinco estados del ENUM.
2. El selector se llama «Mostrar» (label, `aria-label` y tooltip claros). Sus opciones van en dos grupos con encabezado no seleccionable: «Tarjetas» (con el mismo texto de cada tarjeta, por ejemplo «Recibidos en noviembre 2026», «En trámite (en plazo)», «Vencidos», «Completados de noviembre 2026», con su icono) y «Por estado» (con su punto de color y `etiquetaEstado`/`estiloDeEstadoDocumento` como hoy). `Todos` arriba.
3. Pulsar una tarjeta pone el selector en esa vista; pulsar la tarjeta ya activa regresa a `Todos`. Elegir en el selector una vista resalta su tarjeta (`tarjeta-activa`, `aria-pressed`); elegir un estado o `Todos` no resalta ninguna.
4. Se quita el chip «Solo: …». Búsqueda, «Tipo de documento» y «Mis documentos» siguen funcionando y se combinan con «Mostrar».
5. Las cifras de las tarjetas siguen contando todos los documentos cargados (sin el filtro de la tabla). El mensaje de tabla vacía sigue considerando el filtro activo.
6. Al cambiar el mes (`periodo`) las etiquetas de las vistas se actualizan; el filtro elegido se conserva.
7. Responsivo: el selector cabe en 1440, 1024, 768, 375 y 320 sin desbordar la barra de filtros. Los estilos del menú del `q-select` no van en `<style scoped>`.
8. Pruebas: lógica del filtro único (preferible en una función pura de `composables/resumenDocumentos.js` o similar, probada con `node --test`) y pruebas de texto de la página actualizadas. Las pruebas existentes que fijaban `tarjetaActiva`/chip se actualizan explicando cada una.

## Archivos autorizados

- `Seguimiento-proyectos/src/modulos/documentos/pages/DashboardPage.vue` y sus pruebas `DashboardPage*.test.js`
- `Seguimiento-proyectos/src/modulos/documentos/composables/resumenDocumentos.js` y su prueba
- `Seguimiento-proyectos/src/modulos/documentos/css/documentos.scss` (solo si hace falta para el menú del selector)

Fuera de esta lista, el implementer para y pregunta. Sin cambios de backend.

## Notas del orquestador

- Componentes de Quasar; colores de la paleta `$dg-colores`; textos en tú y sin ambigüedad; tooltips.
- `q-select` con `{ value, label }` necesita `emit-value` y `map-options`. Para los encabezados de grupo usar opciones deshabilitadas o el slot `option` con `q-item-label header`, sin que se puedan elegir con teclado.

## Vuelta 2 — cambio pedido por el usuario tras revisar en navegador (2026-11-25)

Reemplaza los criterios 1, 2, 3 y 6 de arriba. El usuario no quiere vistas de tarjeta dentro del selector: el selector conserva sus valores originales y cada tarjeta es uno de ellos.

1. El selector vuelve a llamarse «Estado» con sus valores originales: `Todos` y los cinco estados del ENUM (`opcionesEstado` como estaba antes de la rebanada: sin grupos ni encabezados). Sigue siendo el único estado del filtro.
2. Cuatro tarjetas, una por estado: «Recibido» (`RECEPCIONADO`), «En proceso» (`EN_PROCESO`), «Pendiente del cliente» (`PENDIENTE_CLIENTE`) y «Completado» (`COMPLETADO`). Título con `estiloDeEstadoDocumento(estado).etiqueta`; color, icono y borde coherentes con el estado y tomados de la paleta. Se quitan las tarjetas «Recibidos (mes)», «En trámite» y «Vencidos».
3. La cifra de cada tarjeta es el número de documentos cargados con ese estado (los mismos que muestra la tabla con ese estado elegido, sin búsqueda ni tipo). Pie de cada tarjeta corto y claro (por ejemplo «Recibidos en {mes} y pendientes anteriores» donde aplique); tooltip y `aria-label` dicen qué filtra.
4. Pulsar una tarjeta pone el selector en su estado; pulsar la activa regresa a `Todos`. Elegir un estado en el selector resalta su tarjeta (`tarjeta-activa`, `aria-pressed`); `Todos` o `Cancelado` no resaltan ninguna.
5. Lo vencido se sigue marcando en la tabla como hoy (texto e icono de advertencia); ya no tiene tarjeta.
6. Se mantiene: sin chip «Solo: …», búsqueda/tipo/«Mis documentos» combinados, mensaje de tabla vacía con el filtro, responsivo 1440 a 320.
7. Quitar el código que quede sin uso (`opcionesMostrar`, `coincideConFiltro`/`tarjetaDeFiltro` si ya no sirven, y las reglas de tarjeta de `resumenDocumentos.js` que nadie use), con sus pruebas. `esVencido` de la tabla debe seguir funcionando.
8. Pruebas actualizadas: lógica pura del conteo por estado y textos de la página (las de `DashboardPage.mesRecepcion.test.js` y `DashboardPage.mostrar.test.js` que fijaban las tarjetas viejas se ajustan o se quitan, explicando cada una).

---

## Reporte del implementer

1. Rebanada completada: `filtroMostrar` reemplaza a `filtroEstado` y `tarjetaActiva` (ahora `computed` desde el selector); selector «Mostrar» con grupos «Tarjetas» y «Por estado» (encabezados `{ disable: true, encabezado: true }`); se quitó el chip «Solo: …».
2. Archivos modificados: `composables/resumenDocumentos.js` (`coincideConFiltro`, `tarjetaDeFiltro`) y su prueba, `pages/DashboardPage.vue`, `pages/DashboardPage.rebanada1.test.js` (clase `selector-filtro-mostrar` y ventana de regex de 1200 a 2000), nuevo `pages/DashboardPage.mostrar.test.js`.
3. Prueba en rojo y por qué falló: importación de funciones inexistentes y 11 de 12 aserciones de texto de la página.
4. Puertas: lint, prettier (salvo las copias de `logica/`), build en verde; `node --test` 2150/2154: las 4 rojas son de `MaquetaLayout.vue`, modificado en el árbol fuera de esta rebanada. Navegador: no hecho (sin cuenta).
5. Decisiones no cubiertas: el selector conserva 195 px y recorta con `ellipsis` las etiquetas largas; `coincideConTarjeta` sigue en `esVencido`.
6. Para la memoria: tarjetas y «Mostrar» son un solo filtro (`filtroMostrar`, `coincideConFiltro`, `tarjetaDeFiltro`).

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA

- Criterios 1 a 8 cumplidos; encabezados no seleccionables (sin `itemProps`, `disable`); pruebas no relajadas. Lint y prettier en verde; `node --test` con 4 rojas, todas de `MaquetaLayout.vue` (fuera de la rebanada).
- Opcionales: el `div.row` alrededor del título «Documentos» ya solo envuelve el título; falta la comprobación en navegador (anchos 1440 a 320 y roles).

## Reporte del implementer (vuelta 2)

1. Rebanada completada: selector «Estado» original (`filtroEstado` único); tarjetas Recepcionado, En proceso, Pendiente del cliente y Completado ligadas a su estado, con cifras de `contarPorEstado`; lo vencido sigue en la tabla con `esVencido`.
2. Archivos modificados: `composables/resumenDocumentos.js` (quedan `esVencido`, `contarPorEstado`, `textoDelPlazo`) y su prueba reescrita; `pages/DashboardPage.vue` (+ `.border-left-info`); nuevo `DashboardPage.tarjetasEstado.test.js`; se borró `DashboardPage.mostrar.test.js`; `DashboardPage.mesRecepcion.test.js` con los pies nuevos; `DashboardPage.rebanada1.test.js` regresó a HEAD.
3. Prueba en rojo y por qué falló: funciones inexistentes en `resumenDocumentos` y 12 de 13 aserciones de texto de la página.
4. Puertas: lint, prettier, build y `node --test` (2147/2147) en verde. Navegador: no hecho.
5. Decisiones no cubiertas: el título sale de `estiloDeEstadoDocumento` («Recepcionado»); Recepcionado y En proceso comparten color (info) y se distinguen por icono y título; pies «Recibidos en {mes} y pendientes anteriores», «Ya los atiende el contador», «Esperan algo del cliente», «Recibidos en {mes} y terminados».
6. Para la memoria: tarjetas una por estado que comparten `filtroEstado` con el selector.

## Veredicto del reviewer (vuelta 2)

VEREDICTO: APROBADA

- Selector igual a HEAD, tarjetas ligadas a `filtroEstado`, cifras con `contarPorEstado` iguales a la tabla, vencido marcado, sin chip ni código muerto, sin hexadecimales. Lint y `node --test` 2147/2147.
- Opcional 1 (aplicado por el orquestador): la plantilla usaba `colorCifra`, `colorPie` y `textoIcono` que ya no existían; se dejó la cifra en `text-primary`, el pie en `text-grey-8` y el icono en blanco (en azul marino sobre el amarillo de «Pendiente del cliente»).
- Pendiente: comprobación en navegador.
