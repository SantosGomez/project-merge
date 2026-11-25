# 50 — Textos y tono de Recepción

- **Riesgo:** bajo (textos y etiquetas visibles; los valores guardados no cambian)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer-ligero`)
- **Estado:** refinada

## Historia

Como recepcionista, quiero que el formulario de Recepción y su acuse hablen claro y en un solo tono, para no dudar qué significa cada campo.

## Problema (revisión UI/UX del 2026-11-25)

Mayúsculas tipo inglés en títulos y etiquetas («Asunto del Documento»), jerga («SLA», «ingesta»), mezcla de «usted» y «tú» («Seleccione…» / «Elige…»), botones en mayúsculas forzadas, un chip «Folio: Se asigna al guardar» que ocupa el lugar más visible sin informar, y prioridades en mayúsculas.

## Decisión del usuario (2026-11-25)

Aprobada la tabla de abajo. Chip del folio → texto discreto. Prioridades visibles como Baja / Media / Alta / Urgente (el valor guardado sigue `BAJA`/`MEDIA`/`ALTA`/`URGENTE`).

## Criterios de aceptación

Todo en `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.vue` (formulario y diálogo del acuse en pantalla). Mayúscula solo al inicio, «tú».

1. Encabezado: título «Recepción de documentos»; subtítulo «Registra lo que entrega el cliente y genera su acuse firmado.»; se quita el `q-chip` del folio y queda una línea pequeña (`text-caption`, color de texto secundario existente) «El folio se asigna al registrar.»
2. Secciones: «1. Cliente y empresa que recibe», «2. Clasificación y periodo», «3. Prioridad y entrega», «4. Archivos, observaciones y firmas».
3. Etiquetas: «Empresa del grupo que recibe *», «Asunto del documento *», «Tipo de documento *», «Vía de entrega *», «Fecha límite de atención» con hint «Se calcula con la prioridad». El campo de archivos: etiqueta «Elige o arrastra los archivos» e hint «PDF, XML, ZIP o JPG. Máximo 25 MB por archivo.»
4. Firmas: «Firma de quien entrega (cliente) *» y «Firma de quien recibe (DCA) *»; ayuda bajo ambos lienzos «Dibuja la firma con el dedo o el ratón»; el botón de cada firma dice «Borrar firma» (tooltips: «Borrar la firma del cliente» / «Borrar la firma de quien recibe»).
5. Validaciones: «Elige la empresa que recibe», «Escribe el asunto», «Elige el departamento», «Elige el tipo de documento», «Escribe el periodo», «El periodo va como AAAA-MM, por ejemplo 2026-11». Las que ya están en tú («Elige un cliente», «Elige el contador asignado») no cambian.
6. Botones con `no-caps` en todo el formulario y el acuse: «Limpiar», «Registrar y generar acuse», «Borrar firma», «Reintentar», «Cerrar». El tooltip de registrar: «Registrar la entrega y generar el acuse de recepción».
7. Avisos: «Faltan firmas: el cliente y quien recibe deben firmar antes de registrar.»; el de un archivo grande: «El archivo {nombre} pasa de 25 MB y no se adjuntó.»
8. Prioridades: opciones `{ value: 'BAJA', label: 'Baja' }`, … `URGENTE` → «Urgente», con `emit-value` y `map-options`; `getPrioridadFondo` sigue recibiendo el valor; el autollenado y el payload siguen mandando el valor en mayúsculas. El acuse en pantalla muestra la etiqueta (función pura de etiqueta, p. ej. en `composables/`, o reutilizar una existente del módulo si ya la hay).
9. Acuse en pantalla: título «Acuse de recepción»; «Folio», «Fecha y hora», «Vía de entrega», «Fecha límite de atención» (sin dos puntos en las etiquetas de la lista), «Firmas de conformidad», pies «Entregó» y «Recibió»; nota: «Este acuse confirma que el Grupo DCA recibió la documentación para su revisión contable.»
10. Pruebas: una prueba de textos nuevos (`IndexPage.textos.test.js`) que falle sin el cambio (incluye que no queden «Seleccione», «SLA», «ingesta», «Dibuje» ni el `q-chip` del folio en la plantilla). Ajustar las pruebas existentes que buscan los textos viejos (`IndexPage.test.js` «Se asigna al guardar», `IndexPage.rebanada4.test.js` «3. Prioridad y Vía de Entrega», `IndexPage.autollenado.test.js` y `IndexPage.firmas.test.js` «Selección de Cliente» / «Registrar y Acuse»), conservando lo que cada una protege.

## Archivos autorizados

- `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.vue`
- `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.textos.test.js` (nuevo) y las pruebas `IndexPage.*.test.js` existentes que haya que ajustar
- Un archivo de lógica pura en `modulos/documentos/composables/` para la etiqueta de prioridad (con su prueba), solo si no existe ya una función equivalente

Fuera: `AcuseImprimir.vue` (PDF), otras pantallas, backend, valores guardados.

## Notas del orquestador

- No tocar la lógica de firmas, registro ni limpieza (rebanada 49) ni el orden ni los márgenes recién ajustados.
- Varios `.vue` usan CRLF: editar con Edit.

---

## Reporte del implementer

1. Rebanada completada: textos y tono de Recepción (formulario y acuse en pantalla) y prioridades visibles Baja/Media/Alta/Urgente con el valor guardado en mayúsculas.
2. Archivos modificados: `IndexPage.vue`; nuevos `IndexPage.textos.test.js`, `composables/etiquetaPrioridad.js` y `etiquetaPrioridad.test.js`; ajustadas `IndexPage.test.js`, `IndexPage.rebanada4.test.js`, `IndexPage.autollenado.test.js` e `IndexPage.firmas.test.js` (solo el texto buscado).
3. Prueba en rojo y por qué falló: `IndexPage.textos.test.js` falló por los asertos (la plantilla aún tenía los textos viejos, el `q-chip`, «Seleccione», «SLA»); `etiquetaPrioridad.test.js` falló por módulo inexistente antes de crearlo.
4. Puertas: `lint:check` verde; `prettier --check` verde en los archivos tocados; `build` verde; `node --test` 2204 pruebas, 2204 pasan, 0 fallan. Navegador: no aplica (lo hace el orquestador).

## Revisión y navegador (orquestador, 2026-11-25)

- `reviewer-ligero`: **aprobada**; las 11 pruebas de `IndexPage.textos.test.js` fallan contra la versión anterior; las pruebas ajustadas siguen protegiendo lo mismo. 2204/2204, lint, prettier y build en verde.
- Navegador con `admin_seed` (escritorio y 375 px, sin desborde): encabezado, secciones, etiquetas, «Borrar firma», «Registrar y generar acuse»; el selector muestra Baja/Media/Alta/Urgente con su punto de color y al elegir Urgente la fecha límite pasa de 7 dic a 27 nov 2026 (el valor guardado sigue en mayúsculas). El acuse no se abrió (requiere registrar un documento).

## Opcionales (no aplicados)

1. Subtítulo del acuse en Title Case: «Grupo DCA — Recepción de Documentación» (`IndexPage.vue` ~727).
2. «Correo Electrónico» en «Vía de entrega» es valor guardado y lo compara el payload: cambiar la etiqueta exige opciones `{ value, label }`.
3. Con varios archivos de más de 25 MB salen varios avisos seguidos (uno por archivo); podría ser uno solo con los nombres.
4. El icono de la ayuda de la firma de recepción pasó de `edit` a `gesture` (igual que la del cliente).
