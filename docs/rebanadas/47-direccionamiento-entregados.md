# 47 — Direccionamiento: pestaña de documentos entregados

- **Riesgo:** medio (endpoint nuevo con permisos y fechas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`)
- **Estado:** refinada

## Historia

Como recepcionista o administrador, quiero ver en Direccionamiento los documentos que ya entregué al contador, para consultar a quién, cuándo y quién los entregó, sin que desaparezcan al firmar la entrega.

## Situación actual

- `GET /doc/documentos/direccionamiento` (`rutaListaDireccionamiento`) solo trae `estado = 'RECEPCIONADO'`; al entregar, el documento pasa a `EN_PROCESO` y sale de la vista.
- La entrega (`rutaEntregarDocumento`) deja en `documento_historial` una fila con `estado_anterior = 'RECEPCIONADO'`, `estado_nuevo = 'EN_PROCESO'`, `usuario_id` (quien entregó), `comentarios` («Entregado a {contador}. {observación}») y `created_at`. El contador queda en `documentos.contador_id`.
- No hay cambio de esquema.

## Decisiones del usuario (2026-11-25)

Dos pestañas en Direccionamiento: «Por entregar» (lo de hoy) y «Entregados» (solo consulta), filtrados por **mes de entrega** con un selector de mes (por omisión, el actual).

## Criterios de aceptación

1. **Backend:** `GET /doc/documentos/entregados?mes=AAAA-MM` (sin mes válido, el mes en curso; validar mes 01-12) devuelve los documentos cuya entrega (`documento_historial` con `estado_anterior = 'RECEPCIONADO'` y `estado_nuevo = 'EN_PROCESO'`) ocurrió en ese mes, por rango de `created_at` en hora local (sin `DATE_FORMAT` sobre la columna; como en la rebanada 45). Si un documento tuviera más de una entrega, cuenta la más reciente. Campos: `id`, `folio`, `cliente`, `rfc`, `tipo`, `periodo`, `prioridad`, `estado` (el actual, que puede haber cambiado después), `fechaRecepcion`, `fechaEntrega` (con `aTextoLocal`), `contadorId`, `contador`, `entregadoPor`, `comentarios`. Orden: entrega más reciente primero. Formato `{ documentos }` y errores `{ error, mensaje }` como las demás rutas de `/doc`.
2. **Permisos:** mismo permiso que la lista de direccionamiento (`registrar_recepcion`) y con mensaje propio. Agregar la ruta a `autorizacionMatriz.test.js` con los mismos roles que `GET /doc/documentos/direccionamiento`. Montarla en `Backend/src/routes/documentoRoutes.js` antes de cualquier ruta `/documentos/:id` que la pudiera capturar.
3. **Frontend:** `DireccionamientoPage.vue` con `q-tabs` + `q-tab-panels`: «Por entregar» (contenido actual intacto: resumen, filtros, tabla, firmas, relación imprimible) y «Entregados». Cada pestaña muestra su cantidad. La pestaña elegida se refleja en la URL (`?tab=entregados`) para que al recargar se quede.
4. **Pestaña «Entregados»:** selector de mes de entrega (mismo estilo que el del Dashboard), búsqueda por folio o cliente y una `q-table` de solo consulta con Folio, Cliente / RFC, Contador que recibió, Entregado el (fecha y hora), Entregó, Estado actual (con `estiloDeEstadoDocumento`) y Acciones con «Ver detalle» (reutiliza el diálogo de detalle existente y agrega fecha de entrega, quien entregó y la observación). Sin botones de firma ni edición. `no-data-label` y `no-results-label` claros; tooltips en botones de solo icono.
5. **Después de entregar:** al confirmar una entrega, el documento sale de «Por entregar» y, si el mes elegido en «Entregados» es el actual, aparece ahí al recargar esa lista (recargar ambas cuentas).
6. **Responsivo:** columnas secundarias ocultas en móvil; comprobar que `scrollWidth - clientWidth` de `.q-table__middle.scroll` dé 0 en 1440, 1024, 768, 375 y 320 (regla de AGENTS.md para `QTable`).
7. **Servicio:** función nueva en `modulos/documentos/servicios/api.js` (`obtenerEntregados(mes)`), con el cliente HTTP existente.
8. **Pruebas:** backend (rango del mes, diciembre→enero, solo entregas, entrega más reciente, estado actual distinto de `EN_PROCESO` sigue saliendo, permisos 403 sin `registrar_recepcion`, mes inválido) contra el doble y contra MariaDB con datos `zz_test_`; frontend (pestañas, `?tab`, columnas, servicio).

## Archivos autorizados

- `Backend/src/modulos/documentos/rutas/documentos.mjs` y `documentos.test.mjs`
- `Backend/src/routes/documentoRoutes.js`
- `Backend/test/autorizacionMatriz.test.js` y `Backend/test/documentosModulo.test.js`
- `Seguimiento-proyectos/src/modulos/documentos/pages/DireccionamientoPage.vue` y sus pruebas (`DireccionamientoPage*.test.js`, nuevas si hace falta)
- `Seguimiento-proyectos/src/modulos/documentos/servicios/api.js` y su prueba si existe
- `Seguimiento-proyectos/src/modulos/documentos/composables/` (solo un archivo nuevo de lógica pura para la pestaña, si hace falta, con su prueba)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- No tocar el flujo de entrega ni las firmas. La observación de la entrega sigue en `documento_historial.comentarios`.
- Fechas: `created_at` es TIMESTAMP; usar los mismos límites de texto local que la rebanada 45 y `aTextoLocal` en la respuesta. Nunca `new Date('AAAA-MM-DD')` en el frontend.
- `sticky` no sirve dentro de `q-tab-panels`.
- En el árbol hay cambios del usuario sin commit (`MaquetaLayout.vue`, `IndexPage.vue`, pruebas del menú, `MEMORY.md`): no tocarlos.

## Vuelta 2 — cambio pedido por el usuario (2026-11-25)

Reemplaza los criterios 3, 4 y 6. Sin pestañas: una sola tabla con un toggle. El backend (`GET /doc/documentos/entregados`, criterios 1, 2, 7) se queda.

1. Se quitan `q-tabs`/`q-tab-panels`, `?tab` y `tabDeQuery` (con sus pruebas). Queda una sola tabla en Direccionamiento.
2. Toggle «Mostrar entregados» (`q-toggle` en la barra de filtros, con tooltip que diga que agrega los documentos ya entregados al contador). Apagado por omisión: la tabla es exactamente la de hoy («Por entregar»).
3. Encendido: aparece el selector «Mes de entrega» (por omisión, el mes actual) y la tabla agrega los entregados de ese mes (de `obtenerEntregados(mes)`). Se distinguen con una columna/etiqueta de situación: «Por entregar» o «Entregado el {fecha}» (no solo color), y en su fila el contador es el que recibió. En los entregados solo está «Ver detalle» (con fecha de entrega, quién entregó y observación); sin botón de firma. Orden: primero los por entregar, luego los entregados (más reciente primero).
4. Búsqueda y filtros de cliente/contador aplican a las dos clases de filas. Las tarjetas de resumen y la relación imprimible siguen siendo solo de lo pendiente.
5. Tras entregar, se recargan pendientes y, si el toggle está encendido, entregados.
6. **Desborde:** la tabla única no debe desbordar: `scrollWidth - clientWidth` de `.q-table__middle.scroll` = 0 en 1440, 1024, 768, 375 y 320, con el toggle apagado y encendido. Ocultar columnas secundarias por ancho (como se hizo en «Entregados»), recortar textos largos con `ellipsis` + tooltip, y que la columna de Acciones siempre quede visible. Lo oculto se ve en «Ver detalle».
7. Pruebas: lógica pura de combinar/filtrar/ordenar filas (en `composables/entregadosVista.js` o similar) y textos de la página; se quitan las pruebas de pestañas.

---

## Reporte del implementer

1. Rebanada completada: `GET /doc/documentos/entregados?mes=` (`rutaListaEntregados`, permiso `registrar_recepcion`, montada antes de `/documentos/:id`); pestañas «Por entregar» y «Entregados» con `?tab=entregados`, selector «Mes de entrega», búsqueda, tabla de consulta y detalle con los datos de la entrega; tras entregar se recargan las dos listas.
2. Archivos modificados: `rutas/documentos.mjs` (+test), `routes/documentoRoutes.js`, `test/autorizacionMatriz.test.js`, `test/documentosModulo.test.js`, `DireccionamientoPage.vue`, `servicios/api.js` (`obtenerEntregados`); nuevos `composables/entregadosVista.js` (+test) y `DireccionamientoPage.entregados.test.js`.
3. Prueba en rojo y por qué falló: stub 501 en el backend, listas vacías contra MariaDB (pool cerrado por otro bloque y `created_at` TIMESTAMP con tope en 2038), 404/403 hasta registrar la ruta, y 6 + 14 fallos en el frontend.
4. Puertas: backend verde (`documentos` 52, matriz 39, `documentosModulo` 17; `verificarPruebas` OK 909). Frontend lint, prettier, build y `node --test` (2167) en verde. Navegador con Playwright y cuenta administrador `zz_test_`: `?tab`, recarga, detalle y desborde 0 en «Entregados» a 1440–320. 0 filas `zz_test_%`.
5. Decisiones no cubiertas: columnas ocultas en «Entregados» bajo 1200/900/600 px (folio y fecha pasan a subtítulo); entrega más reciente por `MAX(id)` del historial; «Actualizar» e «Imprimir Relación» del encabezado solo en «Por entregar»; en el detalle de una entrega se ocultan «Recibido por» y «Fecha límite». Preexistente: la tabla «Por entregar» desborda bajo 1440 px.
6. Para la memoria: `documento_historial.created_at` es TIMESTAMP (tope 2038); el bloque de MariaDB que hace `pool.end()` va al final de `documentos.test.mjs`.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA

- Criterios cumplidos: mes validado (01-12) y rango local con diciembre→enero, entrega más reciente por `MAX(id)` sin duplicados, SQL parametrizado, `{ error, mensaje }`, ruta con `registrar_recepcion` en la matriz, «Por entregar» sin cambios de comportamiento, `?tab` con `router.replace`. Puertas: `documentos.test.mjs` 52/52, matriz 39/39, `documentosModulo` 17/17, lint y `node --test` 2167/2167; 0 filas `zz_test_%`.
- Opcionales: no hay `watch` de `route.query.tab` (atrás/adelante no cambia la pestaña); el selector solo llega 12 meses atrás; «Por entregar» desborda bajo 1440 px (preexistente).

## Reporte del implementer (vuelta 2)

1. Rebanada completada: una sola tabla (`filasTabla`) con toggle «Mostrar entregados» (apagado) y selector «Mes de entrega»; columna «Situación» («Por entregar» / «Entregado el {fecha}»); firma solo en pendientes; tarjetas y relación imprimible solo de lo pendiente; recargas tras entregar y en «Actualizar».
2. Archivos modificados: `DireccionamientoPage.vue`, `composables/entregadosVista.js` (`combinarFilas`, `filtrarFilas`; se quitaron `tabDeQuery` y `filtrarEntregados`) y su prueba, `DireccionamientoPage.entregados.test.js` reescrita. Backend sin cambios en esta vuelta.
3. Prueba en rojo y por qué falló: 8 de `entregadosVista` con stubs y 9 de 16 de la página con pestañas.
4. Puertas: backend verde (52/39/17; `verificarPruebas` OK 909); frontend `node --test` 2170/2170, lint, prettier y build verdes. Navegador (Playwright, admin `zz_test_`): desborde 0 en 1440–320 con el toggle apagado y encendido; «Ver detalle» siempre visible. 0 filas `zz_test_%`.
5. Decisiones no cubiertas: ocultamiento por ancho (Tipo y Fecha límite <1600, Recepción y Prioridad <1200, Contador <900, Folio y Situación <600 como subtítulo); filtros con opciones de entregados solo con el toggle encendido; mensaje vacío «No hay documentos pendientes de entrega ni entregados en {mes}»; tooltip «Ver detalle del documento». El desborde previo de «Por entregar» quedó corregido.
6. Para la memoria: Direccionamiento = una tabla con toggle «Mostrar entregados»; clases `ocultar-bajo-xl/-lg/-md` y `ocultar-en-xs`.

## Veredicto del reviewer (vuelta 2)

VEREDICTO: APROBADA

- Sin pestañas; toggle apagado igual que antes (firmas, contador fijo, tarjetas y relación solo de pendientes); encendido agrega entregados con «Entregado el {fecha}» y solo «Ver detalle»; `filtrarFilas`/`combinarFilas` correctos; Acciones nunca oculta. Lint y `node --test` 2170/2170.
- Opcionales: un filtro de cliente o contador que solo existe en entregados deja la tabla vacía al apagar el toggle; `formatearFechaHora` usa `new Date('AAAA-MM-DD HH:mm:ss')` (preexistente, Safari).
