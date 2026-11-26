# 55b — Corte a `cliente_contador`, parte 2: lecturas y varios contadores

- **Riesgo:** alto (cambia qué clientes ve cada contador en Seguimiento y en Documentos)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada (Opus); sin commit

## Historia

Como despacho, quiero que «mis clientes», Documentos, Recepción y Ajustes lean los contadores de `cliente_contador`, para que un cliente con varios contadores aparezca a todos ellos.

## Criterios de aceptación

1. **Lecturas de Seguimiento** pasan de `usuario_id = ?` a `cliente_contador` (`EXISTS` o `JOIN`): `ClienteModel.listarDeUsuario`, `buscarDeUsuario`, `actualizar` (`WHERE id = ? AND …`) y `CarteraActividadModel.clientesDeUsuario`. Mismos resultados con los datos actuales; un cliente con dos contadores aparece en la lista de los dos.
2. **Lecturas de Documentos:** listado y ficha de clientes (`clientes.mjs`), filtros y bandejas de `documentos.mjs` (`d.contador_id = ? OR c.usuario_id = ?`, `COALESCE(d.contador_id, c.usuario_id)`, `ucl`, `contadorCliente`) y el catálogo de Recepción (`catalogos.mjs:48`, ahora autorizado). Las respuestas conservan `contadorId` y `contador` (el principal) y agregan `contadores: [{ id, nombre }]`. Recepción sigue proponiendo el principal. Un filtro «de este contador» incluye los clientes donde figura como uno de varios.
3. **Ajustes:** `GET /ajustes/clientes` agrega `contadores` (lista) y conserva `contador_id` y `contador_nombre` del principal para no romper el frontend.
4. **Pruebas existentes** que escriben `clientes.usuario_id` a mano (`ajustes.test.js`, `documentosModulo.test.js`, `unificacion.test.js`, `documentos.test.mjs`, `clientes.test.mjs`) pasan a poblar `cliente_contador` con el modelo de la 55a; el implementer reporta cada cambio y por qué, sin relajar asertos. Pruebas nuevas: un cliente con dos contadores aparece en «mis clientes» de ambos y en el filtro de documentos de ambos; el principal es el esperado; documentos y Ajustes devuelven `contadores`.
5. **Sin cambios visibles** con los datos actuales: frontend sin tocar. Comprobación en el navegador con cuentas `zz_test_` (contador y administrador): «Mis actividades», «Clientes» y «Recepción» de documentos muestran lo mismo que antes, y la pestaña «Clientes» de Ajustes sigue bien.
6. **Respaldo previo** de `delgrow_merge` fuera del proyecto (el del día sirve si no hubo cambios de datos desde entonces; si los hubo, uno nuevo).
7. **Puertas** en `Backend/`: `node --test --test-concurrency=1` por archivo y `node soporte-pruebas/verificarPruebas.js`; `clientes` en 156 y 0 filas `zz_test_%` al terminar.

## Archivos autorizados

`Backend/src/models/ClienteModel.js`, `CarteraActividadModel.js`, `Backend/src/controllers/AjustesController.js` (solo la forma de la respuesta), `Backend/src/modulos/documentos/rutas/clientes.mjs`, `documentos.mjs`, `catalogos.mjs` y las pruebas citadas en el criterio 4. Nada de frontend, rutas ni permisos.

## Notas del orquestador

- Depende de la 55a (modelo y escrituras). Cuando ambas estén aprobadas, queda para la 56 la API de administración del catálogo (alta, edición, estado y contadores), la política «el contador pide el alta», la pestaña «Clientes» completa y la unicidad por nombre; y para el cierre, retirar `clientes.usuario_id`.
- Limitación conocida: editar un cliente desde Documentos reemplaza el conjunto de contadores por el `contadorId` recibido; se revisa en la 56.

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Opus, sin hallazgos que bloqueen). Detalle al final de este archivo.

## Observaciones heredadas de la 55a (para el implementer y la 56)

- Las pruebas que escriben `clientes.usuario_id` a mano deben poblar `cliente_contador` con `ClienteContadorModel` (criterio 4).
- Empates de `asignado_en` (DATETIME sin fracciones): con dos contadores en el mismo segundo gana el de menor `usuario_id`; en la 56 usar `DATETIME(3)` o fijar el orden del principal.
- `sincronizarPrincipal` puede chocar con `uq_clientes_usuario_nombre`; la 56 la replantea.
- Con varios contadores, borrar la cuenta del principal borra el cliente (CASCADE); se resuelve en el cierre al retirar `usuario_id`.
- La edición desde Documentos fija el conjunto en `[contadorId]`; la 56 lo cambia antes de exponer la asignación múltiple.

## Reporte del implementer (resumen)

- **Lecturas con `cliente_contador`:** `ClienteModel` (`listarDeUsuario`, `buscarDeUsuario` y `actualizar` con `EXISTS`: edita cualquiera de los contadores; `listarTodos` con el principal por subconsulta y `contadores` por una segunda consulta agrupada, sin duplicar filas ni cambiar el orden); `CarteraActividadModel.clientesDeUsuario`; Documentos: `clientes.mjs` (listado, ficha y respuesta del alta con `contadores`; helper `contadoresPorCliente`), `documentos.mjs` (filtro `misDocumentos` con `d.contador_id = ? OR EXISTS (…)`, bandeja de Direccionamiento y `contadorCliente` con el principal) y `catalogos.mjs` (Recepción propone el principal). `AjustesController.js` sin cambios (la forma sale de `listarTodos`). Frontend, rutas, permisos y escrituras sin tocar.
- **Pruebas:** `clienteContadorModel` 18 (+5), `ajustes` 5 (+1), `documentosModulo`, `documentos.test.mjs` (+1), `clientes.test.mjs` (+2), `MINIMOS` actualizado. En rojo antes: los contadores secundarios no veían ni editaban el cliente, faltaba `contadores` y el filtro viejo solo veía al principal.
- **Cambios a pruebas existentes (sin relajar asertos):** `documentos.test.mjs`: 3 asertos de texto (`"d.contador_id = ? OR c.usuario_id = ?"` → `"d.contador_id = ? OR EXISTS"`, parámetros iguales) y un `UPDATE clientes SET usuario_id` a mano pasó a `ClienteContadorModel.reemplazarContadores`; `clientes.test.mjs`: la ficha esperada incluye `contadores: []`; `ajustes.test.js` y `documentosModulo.test.js` llenan `cliente_contador` con el modelo. `unificacion.test.js` y `esquemaClienteContador.test.js` sin tocar (prueban a propósito el `usuario_id` a mano y el esquema).
- **Puertas:** 15 archivos del backend en verde por archivo, documentos 312/312, `verificarPruebas.js` 89 archivos y 940 pruebas (mínimo 841), 0 fallidas. Navegador (cuentas `zz_test_`, cliente con dos contadores): el contador secundario lo ve y lo puede editar o desactivar en «Mis actividades», aparece una sola vez en «Clientes» de documentos con el principal; por API: ambos contadores lo ven en `/clientes` y `/doc/clientes`, `/ajustes/clientes` devuelve el principal más `contadores`, y `/doc/catalogos` propone al principal. El administrador se comprobó solo por API. `clientes` 156 → 156, `cliente_contador` 6 → 6, 0 filas incoherentes, 0 `zz_test_%`.
- **Decisiones del implementer:** el principal se calcula con una subconsulta repetida (menor `asignado_en`, luego menor `usuario_id`) en `ClienteModel`, `clientes.mjs`, `documentos.mjs` y `catalogos.mjs` (se centraliza en la 56); `uq_clientes_usuario_nombre` sigue apoyada en el principal, y un contador secundario que renombra un cliente no choca con sus propios clientes del mismo nombre (se replantea en la 56).
- Verificado por el orquestador: ver las cifras de la base al cierre de la revisión.

## Detalle del veredicto del reviewer (Opus)

VEREDICTO: APROBADA. Verificado: `EXISTS` sobre `cliente_contador` sin duplicar filas ni cambiar el orden; `misDocumentos` con 5 parámetros en el orden correcto (incluye al contador secundario y excluye a un tercero); subconsulta del principal idéntica en `ClienteModel.js:18`, `clientes.mjs:20-21`, `documentos.mjs:387,395,568` y `catalogos.mjs:50`, y coincide con `sincronizarPrincipal`; un contador ajeno sigue recibiendo 404 y un cliente con `usuario_id` NULL y sin filas se comporta igual que antes; campos antiguos con su forma y valor y `contadores` nuevo, sin romper al frontend (`AjustesClientes.vue`, `NuevoClienteDialog.vue`, `autollenado.js`, `DireccionamientoPage.vue`); cambios a pruebas legítimos (con mutaciones: las pruebas fallan al devolver las lecturas a `usuario_id`); solo archivos autorizados; listado de Ajustes viejo y nuevo idénticos (156 filas, mismo orden); base: `clientes` 156, `cliente_contador` 6, 0 incoherencias, 0 `zz_test_%`, llaves en CASCADE; puertas del backend en verde (89 archivos, 940 pruebas, 0 fallidas, documentos 312/312); EXPLAIN: índices usados, escala bien.

Efecto buscado: `buscarDeUsuario` también lo usan `ActividadMesController.js:90` y `RegistroTiempoController.js:70`, así que un contador secundario ya puede registrar actividades y tiempo de ese cliente.

Opcionales: la prueba de `misDocumentos` con dos contadores no comprueba que un tercero quede fuera; las pruebas del «principal» no distinguen la subconsulta de `c.usuario_id` mientras el invariante se cumpla; en `ajustes.test.js` el segundo contador es la recepcionista (`cliente_contador` no valida rol); los dobles de `clientes.test.mjs` solo comprueban la forma.

Riesgos para la 56:
- Un contador secundario ahora puede renombrar y desactivar el cliente para todos (`ClienteModel.actualizar`, línea ~154): definir quién puede hacerlo.
- `uq_clientes_usuario_nombre` sigue apoyada en el principal: el secundario puede recibir NOMBRE_REPETIDO por un cliente que no es suyo, y puede dar de alta un cliente con el mismo nombre de uno que comparte.
- Editar desde Documentos (`NuevoClienteDialog` con `contadorId` del principal) borra a los secundarios al guardar: resolver antes de exponer la asignación múltiple.
- Siguen abiertas: empates de `asignado_en` (DATETIME sin fracciones), borrar la cuenta del principal borra el cliente (CASCADE), doble escritura de `usuario_id`, y la subconsulta del principal repetida en 4 archivos (centralizar).

No verificado: navegador (por instrucción; el implementer lo probó), restauración del respaldo, que las escrituras sean idénticas a las de la 55a (sin instantánea), filas `zz_test_` fuera de `clientes` y `usuarios`, producción.
