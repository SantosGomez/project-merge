# 48 — Chips de estado y prioridad legibles en documentos

- **Riesgo:** bajo (estilos)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer-ligero`)
- **Estado:** refinada

## Historia

Como usuario de Recepción de documentos, quiero leer sin esfuerzo el estado y la prioridad de cada documento, para no confundirme ni forzar la vista.

## Problema (auditoría del 2026-11-25)

`$info` (#1a5f9e) y `$positive` (#1b5e20) se oscurecieron para los avisos con texto blanco, pero los chips de documentos siguen poniendo texto `primary` encima. Contraste actual: Recepcionado y En proceso 2.54, Completado 2.13, prioridad Media 2.54 (WCAG AA pide 4.5). Además Recepcionado y En proceso tienen el mismo fondo.

## Decisión del usuario (2026-11-25)

Píldoras claras con texto y borde del color (patrón `chip-estado` de `DESIGN.md`), solo con tokens existentes de `$dg-colores`. Urgente se queda sólido. Los puntos de color de los selectores y los iconos de las tarjetas del Dashboard **no** cambian.

## Criterios de aceptación

1. Estados (fondo / texto / borde):
   - Recepcionado: `neutro-fondo` / `texto-secundario` / `neutro-borde` (7.50:1)
   - En proceso: `info-fondo` / `info-texto` / `info-borde` (9.92:1)
   - Pendiente del cliente: `aviso-fondo` / `aviso-texto` / `aviso-borde` (10.86:1)
   - Completado: `exito-fondo` / `exito-oscuro` / `exito-borde` (9.47:1)
   - Cancelado: `error-fondo` / `error-campo` / `error` (7.97:1)
   - Desconocido: neutro como hoy, con texto legible.
2. Prioridades: URGENTE sólido `$negative` con texto blanco (7.46:1, igual que hoy); ALTA `prioridad-alta-fondo` / `prioridad-alta` / `prioridad-alta-borde`; MEDIA `prioridad-media-*`; BAJA `prioridad-baja-*`.
3. `estiloDeEstadoDocumento` conserva `fondo` (lo usan los puntos de color) y agrega las clases de la píldora (por ejemplo `chip`: fondo, texto y borde). Corregir su comentario, que dice que `$info` y `$positive` son claros.
4. Todos los chips/badges de estado y prioridad del módulo usan las píldoras: `DashboardPage.vue`, `DireccionamientoPage.vue`, `SeguimientoPage.vue` (y cualquier otro de `modulos/documentos` que pinte estado o prioridad con texto encima). La prioridad usa una sola función compartida en vez de las copias de `getPrioridadFondo`/`getPrioridadTexto` (deuda anotada en MEMORY.md); los puntos de `IndexPage.vue` siguen como están.
5. Forma: píldora (`rounded.pill`), `padding: 2px 10px`, borde de 1 px del color, peso 600, tamaño de etiqueta; mismo alto en tabla y en tarjetas móviles. Sin hexadecimales sueltos (clases `bg-dg-*`, `text-dg-*` o `var(--dg-*)`). Las clases globales van en `modulos/documentos/css/documentos.scss` con alcance propio.
6. El texto del estado y de la prioridad sigue visible (el color nunca es el único indicador) y los iconos de los chips toman el color del texto.
7. Pruebas: unidad de `estiloDeEstadoDocumento` y de la función de prioridad (clases por valor) y agregar los pares texto/fondo nuevos a `test/paletaColores.test.js` si no están ya.
8. Navegador: Dashboard, Direccionamiento (con el toggle de entregados) y Seguimiento en escritorio y 375 px, con al menos un documento por estado cuando se pueda (datos `zz_test_`).

## Archivos autorizados

- `Seguimiento-proyectos/src/modulos/documentos/composables/estadoDocumentoVista.js` y su prueba
- Un archivo nuevo de lógica pura para la prioridad en `modulos/documentos/composables/` (con su prueba), si no existe uno
- `Seguimiento-proyectos/src/modulos/documentos/pages/DashboardPage.vue`, `DireccionamientoPage.vue`, `SeguimientoPage.vue` y sus pruebas
- `Seguimiento-proyectos/src/modulos/documentos/css/documentos.scss`
- `Seguimiento-proyectos/test/paletaColores.test.js`

Fuera de esta lista, el implementer para y pregunta. Sin cambios de backend ni de la paleta.

## Notas del orquestador

- Leer `.claude/skills/impeccable/reference/craft-floor.md` antes de editar.
- No cambiar `$info`, `$positive` ni ningún valor de `$dg-colores`.
- Correr el detector al final: `.claude/skills/impeccable/scripts/impeccable.cmd detect --json <archivos cambiados>`.

---

## Reporte del implementer

1. Rebanada completada:
2. Archivos modificados:
3. Prueba en rojo y por qué falló:
4. Puertas (verde / rojo / no aplica):
5. Decisiones no cubiertas:
6. Para la memoria:

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

### Reporte (copiado por el orquestador)

1. Rebanada completada: píldoras `chip-doc chip-doc--*` para estado y prioridad (URGENTE sólido); puntos de color sin cambios.
2. Archivos modificados: `estadoDocumentoVista.js` (+`chip`, sin `texto`) y su prueba; nuevos `prioridadVista.js` (`estiloDePrioridadDocumento`) y su prueba; `css/documentos.scss` (`.chip-doc.q-chip`, mapa `$chips-doc` con `var(--dg-*)`); `DashboardPage.vue`, `DireccionamientoPage.vue`, `SeguimientoPage.vue` y sus pruebas; `test/paletaColores.test.js` (par `error-campo`/`error-fondo`).
3. Prueba en rojo y por qué falló: 7 fallos (clases viejas, módulo inexistente, oráculos de las páginas).
4. Puertas: lint, build y `node --test` (2176) en verde; prettier verde salvo `paletaColores.test.js` (ya fallaba en HEAD); detector de diseño `[]`. Navegador (Playwright, admin y 8 documentos `zz_test_`) en 1440 y 375: sin desborde, 0 errores, chips de 24 px; contraste medido 5.51–10.86. 0 filas `zz_test_%`.
5. Decisiones no cubiertas: «Por entregar» / «Entregado el …» de Direccionamiento también tenían bajo contraste y pasaron a `en-proceso` / `completado`; prioridad pasó de `q-badge` a `q-chip`; «Estado actual» del detalle de `xs` a `sm`; `IndexPage.vue` conserva su `getPrioridadFondo` para los puntos; la prueba de prioridad de `rebanada5` se reemplazó por el comportamiento nuevo.
6. Para la memoria: píldoras con `estiloDeEstadoDocumento(...).chip` y `estiloDePrioridadDocumento(...).chip`; `fondo` solo para puntos.

### Veredicto (copiado por el orquestador)

VEREDICTO: APROBADA (reviewer-ligero)

- Tokens exactos por estado y prioridad, `fondo` conservado para los puntos, `.chip-doc` con alcance propio, sin hexadecimales, contador fijo y toggle sin cambios, pruebas no relajadas. Lint y `node --test` 2176/2176.
- El orquestador confirmó `npm run build` (salida 0) y que el CSS generado trae las variables `--chip-*` de cada clase.
- Opcional: el detalle del Dashboard pasó de `size="xs"` a `sm`.
