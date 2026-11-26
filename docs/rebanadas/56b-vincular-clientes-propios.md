# 56b — Vincular clientes a la cartera propia (solo backend)

- **Riesgo:** alto (nuevos permisos de escritura sobre el catálogo compartido y cambio de la regla de quién puede llevar clientes)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada (Opus); sin commit; NO publicar sin la 56d

## Decisiones del usuario (2026-11-26) que sacan esta rebanada

- En «Mi perfil», **el contador vincula clientes del catálogo a su propia cartera** (en lugar de crearlos o modificarlos). Administrador y sistemas asignan contadores desde Ajustes (ya existe: 56a).
- **Puede vincularse a cualquier cliente activo** del catálogo, aunque ya tenga otro contador (un cliente puede tener varios).
- **Quitar su propio vínculo:** sí, solo el suyo. El cliente no se borra ni se desactiva; si era el único contador, queda sin contador.
- **Quién puede llevar clientes:** no solo el rol Contador de Documentos: **en general, las cuentas de ambos módulos** (contador o auxiliar de Seguimiento, o Contador de Documentos). Esta regla **reemplaza** a la de la 56a («solo rol Contador en Documentos»).

## Plan de rebanadas que salen de este ajuste

- **56b (esta, backend):** regla nueva de quién lleva clientes, endpoints de cartera propia, compatibilidad con Recepción. Solo se agrega: no se quita ninguna ruta.
- **56c (frontend):** pestaña «Clientes» de Ajustes completa (alta, edición, estado y contadores).
- **56d (frontend):** «Mi perfil» con «Vincular clientes» y «Quitar de mi cartera» (la cartera deja de armarse con el texto de los casos y pasa a ser la del catálogo, con sus cifras de casos por nombre hasta la 57); se quitan el «Editar» y el «Nuevo cliente» de Documentos y el alta y edición de «Mis actividades»; se retiran las rutas viejas (`PATCH` y `POST /doc/clientes`, `POST` y `PATCH /clientes`).
- **56e (producción):** consolidar nombres repetidos con vista previa y resolver el orden entre el índice único y el importador (antes 56c).

## Criterios de aceptación

1. **Regla única «puede llevar clientes»** en `ClienteContadorModel` (reemplaza a `idsSinRolContadorEnDocumentos`): una cuenta puede llevar clientes si su `usuarios.rol` es `contador` o `auxiliar`, o si tiene en `usuario_modulos` el módulo `documentos` con rol `contador`. Revisar si `usuarios` tiene un campo de cuenta activa y, de ser así, exigirlo. `PUT /ajustes/clientes/:id/contadores` y `POST /ajustes/clientes` (con `contadores`) usan esta regla, con el mensaje de error actualizado (tres partes: qué pasó, por qué, qué hacer). Las pruebas de la 56a que dependían de la regla vieja se ajustan reportando cada cambio y sin relajar asertos.
2. **`GET /clientes/mi-cartera`:** lista los clientes de quien consulta (todos los vinculados, activos e inactivos, con `id`, `clave`, `nombre`, `activo`), ordenados por nombre. **No** exige el módulo «Mis actividades» (el perfil lo ve todo el que trabaja casos). Solo cuentas que pueden llevar clientes (criterio 1); el resto, 403.
3. **`GET /clientes/catalogo?q=&limite=`:** busca en el catálogo (sin distinguir acentos ni mayúsculas, por nombre o clave) solo **clientes activos**, con `id`, `clave`, `nombre` y `vinculado` (si ya está en la cartera de quien consulta), máximo 50 por llamada (por omisión 25), ordenados por nombre. Mismas reglas de acceso que el criterio 2.
4. **`POST /clientes/vinculos`** con `{ clienteIds: [id] }` (1 a 50 ids, sin duplicados): agrega a la cuenta como contador de cada cliente **activo** con `ClienteContadorModel.agregarContador` (transacción, invariante de `usuario_id` intacto). Es idempotente: uno que ya estaba vinculado no se cambia. Responde `{ vinculados, yaEstaban }`. Un id inexistente o de un cliente inactivo → 400 con mensaje de tres partes y no se vincula ninguno (todo o nada).
5. **`DELETE /clientes/vinculos/:clienteId`:** quita solo el vínculo de quien consulta; 404 con mensaje claro si ese cliente no estaba en su cartera. No borra ni desactiva el cliente; si era el único contador, `usuario_id` queda NULL (invariante).
6. **Bitácora:** `registrar` con `cliente_vinculado` y `cliente_desvinculado` (ids y cantidades, nunca nombres ni datos del cliente).
7. **Recepción sigue coherente:** con la regla ampliada, el contador principal de un cliente puede ser alguien sin rol Contador en Documentos (por ejemplo un auxiliar). Revisar cómo valida Recepción y Direccionamiento el contador (`documentos.contador_id`, `catalogos.mjs`, `documentos.mjs`) y hacer que Recepción **solo proponga** al principal si tiene rol Contador en Documentos; si no, no propone a nadie y se elige. Sin cambiar los mensajes ni el contrato de la API de documentos.
8. **Lo que no cambia:** ninguna ruta, pantalla ni permiso existente (ni `POST` y `PATCH /clientes`, ni `POST` y `PATCH /doc/clientes`, ni las de `/ajustes/clientes`); `GET /clientes` (de «Mis actividades») sigue igual.
9. **Autorización:** rutas nuevas en `autorizacionMatriz.test.js`. Con sesión: contador, auxiliar y quien tenga Contador en Documentos → permitido; administrador, sistemas y recepcionista sin ninguna de esas condiciones → 403; sin sesión → 401. Con cookie, las escrituras exigen `X-Requested-With` como las demás.
10. **Pruebas** (datos `zz_test_`, 0 filas al terminar y `clientes` en 156 con `cliente_contador` en 6): la regla de quién lleva clientes (contador, auxiliar, Contador de Documentos, administrador sin rol, cuenta inactiva si aplica); `mi-cartera`; `catalogo` con búsqueda por acentos y mayúsculas, solo activos y `vinculado`; vincular (uno, varios, repetido, inexistente, inactivo, más de 50) con todo o nada; desvincular (propio, no vinculado, el único contador); un cliente con dos contadores aparece en la cartera de ambos; el invariante de `usuario_id` tras vincular y desvincular; Recepción propone o no según el rol del principal. Pruebas existentes sin relajar asertos.
11. **Respaldo previo** de `delgrow_merge` fuera del proyecto, sin imprimir credenciales (los de días anteriores no sirven si cambiaron datos).
12. **Puertas** en `Backend/`: `node --test --test-concurrency=1` por archivo y `node soporte-pruebas/verificarPruebas.js`; comprobar las rutas nuevas con un servidor propio en puerto distinto (el 3001 corre con nodemon; no tocarlo) y cuentas `zz_test_`, y borrar todo después. Sin navegador (no hay UI nueva).

## Archivos autorizados

- `Backend/src/routes/clienteRoutes.js`, `Backend/src/controllers/ClienteController.js` (funciones nuevas), `Backend/src/models/ClienteModel.js` (funciones nuevas), `Backend/src/models/ClienteContadorModel.js` (regla nueva), `Backend/src/middlewares/roleMiddleware.js` (middleware nuevo aditivo).
- `Backend/src/controllers/AjustesController.js` (solo para usar la regla nueva), `Backend/src/modulos/documentos/rutas/catalogos.mjs` y, si Direccionamiento lo exige, `documentos.mjs` (solo la propuesta del contador).
- `Backend/test/` (pruebas nuevas, `autorizacionMatriz.test.js` y las pruebas de la 56a que dependían de la regla vieja) y `soporte-pruebas/verificarPruebas.js` (`MINIMOS`).

Nada de frontend. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- «Mi cartera de clientes» del perfil hoy se arma con el texto de `casos.cliente` (rebanada 08), no con el catálogo. La 56d la cambia a la lista del catálogo y mantiene las cifras de casos por coincidencia de nombre hasta que la 57 ponga `cliente_id` en los casos.
- Vincularse a un cliente da a ese contador los mismos derechos que a cualquier contador del cliente (ver la cartera, registrar actividades y tiempo, verlo en Documentos). Renombrar y desactivar sigue siendo exclusivo de administrador y sistemas: la 56d quita esa posibilidad de «Mis actividades» y de Documentos.
- Cualquier contador puede vincularse a cualquier cliente activo sin aprobación; queda en la bitácora y el administrador ve quién atiende a cada cliente en Ajustes.
- Trampas: `db.js` solo acepta parámetros primitivos (los `?` de `IN` se arman a mano); las pruebas del backend en serie y por archivo; un cliente con `usuario_id` NULL no se borra en cascada.

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Opus, sin defectos que bloqueen). Detalle y restricción de publicación al final de este archivo.

## Reporte del implementer (resumen)

- **Respaldo previo:** `~/respaldos-seguimiento-proyectos/56b-vincular-clientes-2026-11-26.sql` (297 655 bytes, fuera del proyecto, sin versionar, termina en «Dump completed»).
- **Regla única «puede llevar clientes»** (`ClienteContadorModel`: `idsQueNoPuedenLlevarClientes` y `puedeLlevarClientes`, reemplazan a `idsSinRolContadorEnDocumentos`): `usuarios.rol` es `contador` o `auxiliar`, o rol Contador en Documentos. `usuarios` no tiene campo de cuenta activa, así que no se exige. Ajustes la usa con un mensaje nuevo en tres partes.
- **Rutas nuevas** bajo `/clientes`, sin `requireModuloActividades` y con el middleware nuevo `requireLlevaClientes`: `GET /mi-cartera`, `GET /catalogo?q=&limite=` (solo activos, sin acentos ni mayúsculas, comodines `%` y `_` escapados, `limite` recortado a 50, `q` máximo 150), `POST /vinculos` (1 a 50 ids enteros, sin duplicados, todo o nada con `FOR UPDATE` en orden de id, idempotente) y `DELETE /vinculos/:clienteId` (404 si no estaba en su cartera).
- **Recepción:** `catalogos.mjs` devuelve `contadorId` null si el principal no tiene rol Contador en Documentos. `documentos.mjs` sin cambios (su `COALESCE(d.contador_id, principal)` solo aplica a documentos sin `contador_id`).
- **Bitácora:** `cliente_vinculado` (`vinculados`, `yaEstaban` y `clienteIds` en texto) y `cliente_desvinculado` (`clienteId`), sin nombres.
- **Pruebas:** nueva `clientesCartera.test.js` (32), `autorizacionMatriz.test.js` (+4 filas), `MINIMOS` actualizado; en rojo antes: rutas 404, funciones inexistentes, Ajustes rechazaba a un auxiliar y Recepción proponía a un auxiliar sin rol.
- **Cambio a una prueba existente:** `ajustesClientesEscritura.test.js`: la cuenta «contador sin rol Contador en Documentos» ahora es válida, y la cuenta inválida pasó a un `usuarios_de_sistema` sin ninguna condición (los dos asertos siguen igual de estrictos).
- **Puertas:** archivos del backend en verde (incluidos `roleMiddleware`, `moduloActividades` e `inyeccionSql`), documentos 312/312, `verificarPruebas.js` OK en la segunda corrida (93 archivos, 1009 pruebas, 0 fallidas; la primera dio 1 fallida: `userModel.test.js`, que pasa solo, 5/5). Humo con servidor propio: sin `X-Requested-With` `POST` y `DELETE` dan 403; con la cabecera, vincular 200 `{vinculados:1,yaEstaban:0}`, `catalogo` y `mi-cartera` 200, `DELETE` 200 y el segundo 404. `clientes` 156 → 156, `cliente_contador` 6 → 6, 0 `zz_test_%`.
- **Pendiente:** el fallback de Direccionamiento (`COALESCE`) con documentos viejos sin `contador_id` cuyo principal no tenga rol Contador: Direccionamiento lo sugeriría y rechazaría al guardar.

## Detalle del veredicto del reviewer (Opus)

VEREDICTO: APROBADA. Puertas del backend en verde (93 archivos, 1009 pruebas, 0 fallidas ni canceladas en dos corridas seguidas; documentos 312/312). `clientesCartera.test.js` falla 30 de 32 contra HEAD. Verificado: la regla «puede llevar clientes» sin falsos positivos y usada igual en Ajustes (`AjustesController.js:130` y `:202`), en `requireLlevaClientes` y en las rutas nuevas (la regla vieja ya no aparece en ningún lado); las cuatro rutas con `authenticateToken` y `requireLlevaClientes`, sin `requireModuloActividades`, y `X-Requested-With` con cookie dentro de `authenticateToken`; búsqueda sin inyección (`limite` pasa por `parseCounterId` solo con `^\d+$`, comodines escapados, solo activos, solo `id, clave, nombre, vinculado`); vincular todo o nada con `FOR UPDATE` en orden de id, idempotente y sin cambiar `asignado_en`; `DELETE` solo del vínculo propio; bitácora sin nombres; Recepción solo propone al principal con rol Contador en Documentos; solo archivos autorizados; base con `clientes` 156, `cliente_contador` 6, 0 incoherencias, 0 `zz_test_%`.

### Restricción importante: no publicar la 56b sin la 56d (gravedad alta)

Desde la 56b, cualquier contador o auxiliar puede vincularse a cualquier cliente activo y con eso queda dentro de `ES_CONTADOR_DEL_CLIENTE`. Si tiene «Mis actividades», puede usar `PATCH /clientes/:id` (`ClienteModel.actualizar`, `ClienteModel.js:135-150`) para **renombrar, cambiar el RFC o desactivar** ese cliente del catálogo compartido; un cliente desactivado ya no admite documentos nuevos en Recepción. Además ve y registra actividades y tiempo del cliente y, con rol Contador en Documentos, ve sus documentos. La nota «renombrar y desactivar es exclusivo de administrador y sistemas» solo será cierta cuando la 56d retire `PATCH /clientes` y `PATCH /doc/clientes`. Hasta entonces: **no publicar**, o confirmar antes que `USUARIOS_CON_ACTIVIDADES` esté vacío o sin definir en producción (cerrado por omisión).

### Observaciones

- **Para la 56c:** con la regla nueva, Ajustes puede dejar como principal a un auxiliar; la pantalla debe indicar cuándo el principal no tiene rol Contador en Documentos (Recepción no lo propondrá).
- **Para la 56d:** al retirar `PATCH /clientes` y `PATCH /doc/clientes`, comprobar que «Mis actividades» no dependa de ellas; la cartera incluye clientes inactivos que no se pueden volver a vincular si se quitan, así que hay que avisarlo antes de «Quitar de mi cartera»; las cifras de casos por nombre siguen siendo aproximadas hasta la 57.
- **Direccionamiento** (`documentos.mjs:391`, `:572`, `:603-632`): el `COALESCE(d.contador_id, principal)` solo afecta a documentos con `contador_id` NULL (Recepción lo exige y lo valida al crear; hoy hay 0 en la base). Si existiera uno cuyo principal no tenga el rol Contador, quedaría imposible de entregar (400 con cualquier contador). Se destraba dando el rol al principal o cambiando los contadores en Ajustes.
- **Cualquier contador o auxiliar puede recorrer todo el catálogo activo** (nombre y clave) con `q`: es lo que decidió el usuario.
- **Interbloqueos:** `reemplazarContadores` (Ajustes) toma los bloqueos en otro orden (`cliente_contador` y luego `clientes`) que la vinculación (`clientes` y luego `cliente_contador`); InnoDB revierte una de las dos con 500 sin dejar datos a medias. Raro. Opción: alinear el orden o reintentar una vez ante `ER_LOCK_DEADLOCK`.
- **Falla intermitente de `verificarPruebas.js`** (vista en la 52 y en esta rebanada, no reproducida): hipótesis del reviewer, sin confirmar: el backend del 3001 corre con nodemon sobre la misma `delgrow_merge` y se reinicia, corriendo el seed (que hace `ALTER` del ENUM de `usuarios`), cada vez que un archivo del backend cambia; si coincide con las pruebas, el seed de la prueba (`GET_LOCK` de 30 s) falla en el `before` y cancela todo el archivo. Para confirmarlo, repetir la corrida con el 3001 detenido.

Opcionales: `clientesCartera.test.js:172` y `:418` pasan sin el cambio (la ruta inexistente da 404): afirmar códigos concretos y el texto «no está en tu cartera»; `leerClienteIds` acepta cadenas numéricas (`"5"`), permisivo pero no inseguro.

No verificado: la falla intermitente, humo propio con cookie sin `X-Requested-With` (confirmado por lectura), navegador (no hay UI).
