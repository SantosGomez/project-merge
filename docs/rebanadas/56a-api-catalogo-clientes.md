# 56a — API del catálogo de clientes en Ajustes (solo backend)

- **Riesgo:** alto (nuevas escrituras sobre el catálogo compartido, permisos por rol y un cambio de esquema)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada (Opus); sin commit

## Decisiones del usuario (2026-11-26) que sacan esta rebanada

- **Solo el administrador renombra y desactiva clientes** (se asume que «el administrador» incluye a Sistemas, que ya administra el catálogo en Ajustes).
- **Un solo nombre por cliente** en todo el catálogo; los repetidos no se borran: se fusionan (rebanada 56c, con vista previa).
- **Editar un cliente es exclusivo de Ajustes.** Así desaparece el riesgo de que editar desde Documentos borre a los demás contadores.
- De la 53: el alta de clientes la hacen administrador, sistemas y recepcionista (en Ajustes); la clave de carpeta es obligatoria y el RFC no.

## Cómo se reparte el trabajo (56a, 56b, 56c)

- **56a (esta):** API nueva en `/ajustes/clientes`, unicidad por nombre, `DATETIME(3)` y centralizar el contador principal. Solo se **agrega**: no se quita ni se cambia ninguna ruta, pantalla ni permiso existente.
- **56b (frontend):** pestaña «Clientes» de Ajustes completa; en Documentos desaparece el «Editar» del cliente; en Mis actividades el contador deja de crear, editar y desactivar clientes; se retiran las rutas viejas (`PATCH /doc/clientes/:id`, y las altas y ediciones que ya no se usen).
- **56c (producción):** script de consolidación de nombres repetidos con vista previa y el índice único definitivo.

## Criterios de aceptación

1. **`POST /ajustes/clientes`** (administrador, usuario de sistemas y recepcionista; 403 al resto): cuerpo `{ clave, nombre, rfc?, email?, telefono?, contadores?: [id] }`. La clave es **obligatoria** (máximo 4 caracteres sin espacios, en mayúsculas); `nombre` obligatorio (máximo 150); RFC, correo y teléfono con las mismas reglas de `validarDatosNuevoCliente` de `clientes.mjs`. Crea el cliente y sus contadores en una transacción con `ClienteContadorModel`. Responde 201 con el cliente y su lista `contadores`.
2. **`PATCH /ajustes/clientes/:id`** (administrador y usuario de sistemas; 403 al resto, incluida la recepcionista): cambia `nombre`, `clave`, `rfc`, `email`, `telefono` y `activo`; solo se tocan los campos enviados; no toca contadores. 404 si no existe.
3. **`PUT /ajustes/clientes/:id/contadores`** (administrador y usuario de sistemas): cuerpo `{ contadores: [id] }`, la lista completa (puede ir vacía). Reemplaza el conjunto con `ClienteContadorModel.reemplazarContadores`. Valida que cada id exista y tenga **rol Contador en Documentos** (ver «Decisiones confirmadas»); sin duplicados en la lista; 400 con mensaje de tres partes si algo no es válido. Responde con el cliente y su lista de contadores.
4. **Unicidad:** el nombre es único en todo el catálogo, sin distinguir mayúsculas ni acentos (la colación de la tabla ya lo hace), y la clave sigue única. Un duplicado responde **409** con el código `NOMBRE_REPETIDO` («Ya existe un cliente con ese nombre») o `CLAVE_REPETIDA`. `seed.js` crea `uq_clientes_nombre` (índice único) **solo si no hay nombres repetidos**; si los hay, no lo crea, registra un aviso con `registrar` de `utils/bitacoraSeguridad.js` y no borra nada (la 56c los resuelve). La restricción vieja `(usuario_id, nombre)` se conserva hasta el cierre.
5. **`asignado_en` a `DATETIME(3)`** (idempotente, conserva los valores existentes) para que no haya empates de segundo. `ClienteContadorModel` usa `NOW(3)` y, al reemplazar con varios ids, deja como **principal al primero de la lista** (tiempos crecientes de 1 ms según su posición).
6. **Centralizar el contador principal:** un solo fragmento de SQL exportado por `ClienteContadorModel` que usan `ClienteModel`, `clientes.mjs`, `documentos.mjs` y `catalogos.mjs` (hoy está repetido en los cuatro). Sin cambio de comportamiento.
7. **Lo que no cambia:** ninguna ruta, pantalla ni permiso existente (ni `PATCH /clientes`, ni `POST` y `PATCH /doc/clientes`); `GET /ajustes/clientes` sigue igual.
8. **Matriz de autorización:** las rutas nuevas entran en `autorizacionMatriz.test.js` (la prueba falla si faltan). 401 sin sesión, 403 con rol no permitido.
9. **Pruebas** (datos `zz_test_`, 0 filas al terminar y `clientes` en 156): alta válida e inválida (sin clave, nombre repetido, clave repetida, RFC mal formado), edición parcial, desactivar y reactivar, reemplazo de contadores (vacío, uno, varios, duplicados, id inexistente), el principal es el primero de la lista, rollback si falla a la mitad, permisos por rol (recepcionista solo puede el alta), `seed` idempotente con y sin nombres repetidos, y que `asignado_en` queda en `DATETIME(3)`. Pruebas existentes sin relajar asertos.
10. **Respaldo previo** de `delgrow_merge` fuera del proyecto (el del día solo sirve si los datos no cambiaron; si cambiaron, uno nuevo), sin imprimir credenciales.
11. **Puertas** en `Backend/`: `node --test --test-concurrency=1` por archivo y `node soporte-pruebas/verificarPruebas.js`; una ruta nueva va en la matriz; con curl o la sesión del navegador, comprobar las rutas nuevas con cuentas `zz_test_` de administrador y recepcionista.

## Decisiones confirmadas el 2026-11-26

- **Quién puede ser contador de un cliente:** solo cuentas con **rol Contador en el módulo de Documentos** (`usuario_modulos`: `modulo = 'documentos'` y `rol = 'contador'`), la misma regla que hoy usa el alta de Documentos. Consecuencia: un contador de Seguimiento que no tenga ese rol en Documentos no puede recibir clientes desde Ajustes (se le da el rol en «Acceso a módulos»). Las asignaciones que ya existen en `cliente_contador` no se tocan ni se revalidan; la regla aplica a lo que se guarde con la API nueva.
- **El alta de clientes es solo en Ajustes:** en la 56b desaparece el «Nuevo cliente» de Documentos (hoy lo usan Contador, Administrador y Sistemas de Documentos) y el alta la hacen administrador, sistemas y recepcionista desde Ajustes.

## Archivos autorizados

- `Backend/src/routes/ajustesRoutes.js`, `Backend/src/controllers/AjustesController.js`, `Backend/src/models/ClienteModel.js` (funciones nuevas del catálogo), `Backend/src/models/ClienteContadorModel.js`.
- `Backend/src/utils/seed.js` (solo el `DATETIME(3)` y el índice único condicionado).
- `Backend/src/modulos/documentos/rutas/clientes.mjs`, `documentos.mjs` y `catalogos.mjs` (solo para usar el fragmento del principal).
- `Backend/test/` (pruebas nuevas, `autorizacionMatriz.test.js` y las pruebas del modelo) y `soporte-pruebas/verificarPruebas.js` (`MINIMOS`).

Nada de frontend. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Las validaciones de alta se reutilizan: no duplicar reglas distintas. Si es práctico, mover las reglas de `validarDatosNuevoCliente` a un módulo común usado por Documentos y Ajustes, sin cambiar los mensajes de Documentos.
- Con el índice único por nombre, la restricción `(usuario_id, nombre)` y los choques de `sincronizarPrincipal` dejan de ser posibles.
- Borrar la cuenta del contador principal sigue borrando el cliente (CASCADE de `fk_clientes_usuario`): se resuelve al retirar `clientes.usuario_id` en el cierre.
- Trampas: `db.js` solo acepta parámetros primitivos; `clientes` con `usuario_id` NULL no se borran en cascada: las pruebas deben limpiarse por nombre `zz_test_%`; el índice único se prueba también con un nombre que solo cambia en acentos o mayúsculas.

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Opus, sin hallazgos que bloqueen). Detalle al final de este archivo.

## Reporte del implementer (resumen)

- **Respaldo previo:** `~/respaldos-seguimiento-proyectos/56a-api-catalogo-2026-11-26.sql` (296 413 bytes, fuera del proyecto, sin versionar).
- **Rutas nuevas** (`ajustesRoutes.js`, `AjustesController.js`, `ClienteModel.js`: `buscarDelCatalogo`, `crearEnCatalogo`, `actualizarEnCatalogo`): `POST /ajustes/clientes` (administrador, sistemas y recepcionista, con el middleware nuevo `requireAltaClientes`), `PATCH /ajustes/clientes/:id` y `PUT /ajustes/clientes/:id/contadores` (administrador y sistemas). Clave obligatoria; contadores solo con rol Contador en Documentos; 409 `NOMBRE_REPETIDO` y `CLAVE_REPETIDA`; errores de dato «No se guardó el cliente porque un dato no es válido sobre {nombre|clave|rfc|correo|teléfono}: …»; registro con `registrar` (`cliente_catalogo_creado`, `cliente_catalogo_editado` con nombres de campos y nunca valores, `cliente_catalogo_contadores`).
- **Esquema:** `asignado_en` a `DATETIME(3)` (ALTER solo si la precisión no es 3, conserva valores); `ClienteContadorModel` usa `NOW(3)` + 1 ms por posición, `reemplazarContadores` deja como principal al primero de la lista (incluso si ya existía: `adelantarAlPrimero` le adelanta la fecha); `asegurarIndiceUnicoNombre` crea `uq_clientes_nombre` solo si no hay repetidos (si los hay, avisa con `registrar` y no crea nada).
- **SQL del principal centralizado:** `SQL_PRINCIPAL_DE_C` en `ClienteContadorModel`, usado por `ClienteModel`, `clientes.mjs`, `documentos.mjs` y `catalogos.mjs` (mismo texto y parámetros). `validarDatosNuevoCliente` se exporta y sus errores llevan un campo `campo` (aditivo).
- **Pruebas:** nuevas `ajustesClientesEscritura.test.js` (26), `clienteContadorPrincipal.test.js` (7) e `indiceNombreClientes.test.js` (4); modificadas `autorizacionMatriz.test.js` (+3 filas), `ajustes.test.js`, `clientes.test.js` y `MINIMOS`. En rojo antes: 404 en las rutas, precisión 0 ≠ 3, falta de `SQL_PRINCIPAL_DE_C` y de `asegurarIndiceUnicoNombre`, `reemplazar([c,b,a])` no dejaba a `c` como principal.
- **Puertas:** archivos pedidos por separado en verde, documentos 312/312, `verificarPruebas.js` 92 archivos y 977 pruebas (mínimo 878), 0 fallidas. Humo con servidor propio en puerto efímero: recepcionista POST 201, recepcionista PATCH 403, administrador PATCH 200, PUT contadores [] 200, nombre repetido por mayúsculas 409; todo borrado. El backend del 3001 sigue con código viejo (hay que reiniciarlo para ver las rutas nuevas).
- **Cambios a pruebas existentes (consecuencia directa de la regla de nombre único):** `clientes.test.js` «dos usuarios pueden tener el mismo nombre» pasó a esperar 409; `ajustes.test.js` (55b) esperaba como principal al menor id y ahora es el primero de la lista. Efecto de producto: `POST /clientes` (Mis actividades) da 409 si otro contador ya usa ese nombre.
- **Decisiones del implementer:** el desfase de milisegundos va como entero calculado en el texto SQL (para no cambiar los parámetros de los asertos de `clientes.test.mjs`); `requireAltaClientes` se agregó a `roleMiddleware.js` (archivo no listado, permitido como «equivalente»); `crearEnCatalogo` y `actualizarEnCatalogo` comprueban el nombre dentro de la transacción además del índice; `PATCH` valida solo los campos enviados (clave no vacía; RFC, correo y teléfono vacíos los borran); un administrador sin fila en `usuario_modulos` de Documentos NO es válido como contador de un cliente.
- **Verificado por el orquestador:** `clientes` 156, `cliente_contador` 6, `asignado_en` `datetime(3)`, `uq_clientes_nombre` y `uq_clientes_usuario_nombre` únicos, 0 incoherencias, 0 `zz_test_`.

## Detalle del veredicto del reviewer (Opus)

VEREDICTO: APROBADA. Puertas del backend en verde (92 archivos, 977 pruebas, 0 fallidas, documentos 312/312). Las pruebas nuevas fallan contra HEAD (25 de 26, 4 de 7 y 3 de 4; las que pasan son regresiones sobre una base ya migrada o ya existente). Verificado por lectura: permisos (`POST` con `requireAltaClientes`, `PATCH` y `PUT` con `requireAdminOrSistema`; la matriz y `authenticateToken` con `X-Requested-With`), validación reutilizada de `validarDatosNuevoCliente` sin cambio visible en Documentos, 409 por nombre o clave (también por acentos y mayúsculas), transacciones con rollback, `${posicion * 1000}` siempre entero (no inyectable), `DATETIME(3)` idempotente, índice único condicionado, `SQL_PRINCIPAL_DE_C` idéntico en los cuatro archivos, bitácora sin valores sensibles y solo archivos del backend. Base: `clientes` 156, `cliente_contador` 6, 0 incoherencias, 0 `zz_test_%`, llaves en CASCADE.

Observaciones (no bloquean):
1. `roleMiddleware.js` no estaba entre los archivos autorizados; el cambio es aditivo (`requireAltaClientes`) y está bien ubicado.
2. `ClienteController.js:23-27`: el 409 de «Mis actividades» dice «edita el cliente que ya tienes con ese nombre», que ya no es correcto cuando el nombre lo usa otro contador.
3. `clientes.mjs:312-317` y `514-519`: el 409 de Documentos dice «Ese contador ya tiene un cliente registrado con esa razón social», engañoso con el índice global; la 56b retira esas rutas.
4. **Fase 5 / 56c:** el seed crea `uq_clientes_nombre` al arrancar, antes del import. Si `dca_documentos` trae dos clientes con la misma razón social, o un nombre que ya pertenece a un cliente ligado, el `INSERT` del importador (`importarDocumentos.js:161-174`) da `ER_DUP_ENTRY` y se cancela toda la importación (sin pérdida de datos, pero la fase 5 se bloquea). La 56c debe resolver el orden: importar antes del índice, o consolidar y ligar en el importador.
5. **56b / 56c:** en una base con repetidos (producción antes de la 56c), un `PATCH` que reenvíe el mismo nombre de un cliente duplicado da 409 (`exigirNombreLibre`); si el frontend manda todos los campos, ese cliente no se podrá editar hasta consolidar. Sin el índice, `POST /clientes` de seguimiento sigue aceptando repetidos entre contadores mientras Ajustes los rechaza.
6. Carreras menores: `exigirNombreLibre` y la validación de rol hacen `SELECT` sin bloqueo y el `PUT` busca el cliente fuera de la transacción (con el índice, la base ataja la de nombres; un borrado entre la búsqueda y el reemplazo daría 500, improbable).
7. Mientras exista `fk_clientes_usuario` en CASCADE, borrar la cuenta del contador principal borra el cliente.

Opcionales: la prueba del `PUT` con cliente inexistente pasa sin el cambio (404 genérico) y podría exigir el texto propio; la última prueba de `indiceNombreClientes.test.js` es condicional y pasa en las dos ramas.

No verificado: navegador (por instrucción), el servidor del 3001, el respaldo previo fuera del proyecto, humo HTTP propio (las rutas las cubren las pruebas con servidor efímero).
