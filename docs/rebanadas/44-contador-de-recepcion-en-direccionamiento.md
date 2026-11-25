# 44 — El contador asignado en Recepción es el que recibe en Direccionamiento

- **Riesgo:** medio
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`)
- **Estado:** refinada

## Historia

Como recepcionista, quiero que el contador que elijo al recibir un documento sea el mismo que aparece y firma en Direccionamiento, para que el flujo siga con quien se asignó desde el principio y no se entregue a otro contador.

## Situación actual (lo que se encontró)

- `IndexPage.vue` (Recepción) tiene «Contador Asignado (opcional)», pero el valor **no se envía**: `crearDocumento(datos)` no lleva contador y el `INSERT INTO documentos` de `rutaDocumentos` (`Backend/src/modulos/documentos/rutas/documentos.mjs`) no guarda `contador_id`.
- `onClienteChange` rellena el campo con un nombre fijo de la maqueta (`'CP. Carlos Ruiz'`).
- `rutaListaDireccionamiento` ya devuelve `COALESCE(d.contador_id, c.usuario_id)` como `contadorId`/`contador`.
- El modal de entrega (`DireccionamientoPage.vue`) tiene un `q-select` con todos los contadores; `rutaEntregarDocumento` acepta cualquier contador con rol `contador` en documentos.
- La columna `documentos.contador_id` ya existe: **no hay cambio de esquema**.

## Criterios de aceptación

1. **Recepción — obligatorio:** «Contador asignado» pasa a ser obligatorio (asterisco `aria-hidden`, regla de validación, etiqueta sin «(opcional)»). Las opciones son `{ value: id, label: nombre }` del catálogo (`emit-value` + `map-options`).
2. **Recepción — propuesta:** al elegir cliente (a mano, desde frecuentes o con autollenado) se propone el contador habitual del cliente (`clientes.usuario_id`) si está en el catálogo de contadores; si no tiene, el campo queda vacío para elegirlo. Se puede cambiar. Se quita el nombre fijo `'CP. Carlos Ruiz'`. Para eso el catálogo de clientes de `GET /doc/catalogos` agrega `usuario_id AS contadorId`.
3. **Recepción — guardado:** el formulario envía `contadorId` y `POST /doc/documentos` lo guarda en `documentos.contador_id`. El backend lo rechaza con 400 (`VALIDACION`, en el formato de documentos) si falta o si no es una cuenta con el módulo de documentos y rol `contador`.
4. **Direccionamiento — modal:** el contador se muestra como **texto fijo de solo lectura** (icono + nombre, «Contador que recibe la documentación»), sin selector. La notificación de éxito usa ese nombre.
5. **Documentos anteriores:** si el documento no tiene `contador_id`, se usa el contador habitual del cliente (ya lo da `COALESCE`), también fijo. Solo si tampoco el cliente tiene contador (`contadorId` nulo), el modal muestra el selector como hoy para elegirlo.
6. **Backend — entrega:** `rutaEntregarDocumento` lee `contador_id` (y el `usuario_id` del cliente) en el mismo `SELECT … FOR UPDATE`. Si el documento tiene contador asignado (o, sin él, el cliente lo tiene) y `datos.contadorId` es distinto, responde 400 `VALIDACION` con un mensaje claro en tres partes (qué pasó, por qué, qué hacer) y no cambia nada. Solo cuando ninguno de los dos existe acepta el contador elegido (con la validación de rol actual).
7. La tabla de Direccionamiento cambia el encabezado «Contador sugerido» por «Contador asignado» (también en la relación imprimible).
8. Pruebas: backend (guardado con contador, rechazo sin contador o con cuenta que no es contador, entrega rechazada con otro contador, entrega aceptada con el asignado, entrega de documento antiguo con el contador del cliente, y sin ninguno con selección libre). Frontend: pruebas de texto/lógica existentes de `IndexPage` y `DireccionamientoPage` actualizadas y nuevas para lo de arriba.

## Archivos autorizados

- `Backend/src/modulos/documentos/rutas/documentos.mjs`
- `Backend/src/modulos/documentos/rutas/catalogos.mjs`
- `Backend/src/modulos/documentos/logica/validacion.mjs` (y su copia del frontend si existe y una prueba exige que sean iguales)
- `Backend/src/modulos/documentos/rutas/*.test.mjs` y `logica/*.test.mjs` relacionados
- `Seguimiento-proyectos/src/modulos/documentos/pages/IndexPage.vue`
- `Seguimiento-proyectos/src/modulos/documentos/pages/DireccionamientoPage.vue`
- `Seguimiento-proyectos/src/modulos/documentos/composables/autollenado.js` (solo si hace falta para el contador propuesto)
- Pruebas del frontend de esas páginas (`*.test.js` al lado)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-25): obligatorio en Recepción; texto fijo en el modal; los anteriores usan el contador del cliente y, si no hay, se elige.
- No cambiar el esquema. No tocar firmas, folio, adjuntos, ni el flujo de estados.
- Respuestas de `/doc` en formato `{ error, mensaje }`.
- La observación de la entrega sigue yendo a `documento_historial.comentarios`.
- Leer el lienzo (`toDataURL()`) antes de armar los datos (ya se hace; no romperlo).
- Datos de prueba `zz_test_` y correos `@ejemplo.com`; 0 filas `zz_test_%` al terminar.

---

## Reporte del implementer

1. Rebanada completada: Recepción exige y guarda `contador_id` (propuesto desde `clientes.usuario_id` con `contadorPropuesto` de `autollenado.js`; se quitó «CP. Carlos Ruiz»). `GET /doc/catalogos` trae `contadorId` por cliente. `POST /doc/documentos` responde 400 sin contador (`faltantes`) o con cuenta que no es contador (`mensaje`). La entrega lee `contador_id` y `usuario_id` del cliente en el `SELECT … FOR UPDATE` y rechaza con 400 a otro contador; sin ninguno, selección libre. Modal con texto fijo (`v-else` selector). «Contador asignado» en tabla y relación.
2. Archivos modificados: Backend `logica/validacion.mjs` (+test), `rutas/catalogos.mjs`, `rutas/documentos.mjs` (+test), `test/documentosModulo.test.js`; frontend `composables/autollenado.js` (+test), `pages/IndexPage.vue`, `pages/DireccionamientoPage.vue`, nuevos `IndexPage.contador.test.js` y `DireccionamientoPage.contador.test.js`.
3. Prueba en rojo y por qué falló: aserciones (validación sin `contadorId`, INSERT sin `contador_id`, catálogo sin `contadorId`, textos «(opcional)»/«Contador sugerido»), consulta no prevista en el mock de entrega e importación de `contadorPropuesto` inexistente.
4. Puertas: backend verde por archivo (documentos 15 archivos, `documentosModulo` 16, `autorizacionMatriz` 39); `verificarPruebas.js` OK (908/810). Frontend lint, prettier (salvo las copias que no se formatean), build y `node --test` (2131) en verde. 0 filas `zz_test_%`. Navegador: no aplicado por el implementer.
5. Decisiones no cubiertas: tocó `Backend/test/documentosModulo.test.js` (fuera de la lista) porque la recepción de punta a punta ahora exige contador. Con catálogo de contadores vacío no se puede guardar la recepción.
6. Para la memoria: Recepción guarda `documentos.contador_id` (obligatorio); Direccionamiento lo muestra fijo y el backend rechaza otro contador.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA

- Los 8 criterios se cumplen. Puertas en verde: `documentos.test.mjs` 40/40, `validacion.test.mjs` 43/43, `documentosModulo.test.js` 16/16, `autorizacionMatriz.test.js` 39/39; frontend lint y `node --test` 2131/2131.
- Opcionales: `contadorId` de la recepción solo se valida como presente (uno no numérico igual da 400); con el catálogo de contadores vacío no se puede guardar la recepción.
- Navegador: sin verificar (ni el implementer ni el reviewer lo abrieron).
