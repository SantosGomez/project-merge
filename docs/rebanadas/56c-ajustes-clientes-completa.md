# 56c — Pestaña «Clientes» de Ajustes completa (alta, edición, estado y contadores)

- **Riesgo:** alto (pantalla con escrituras sobre el catálogo compartido, permisos por rol en frontend y backend, y dos lecturas nuevas en el backend)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada tras corregir un cambio menor (Opus); sin commit; no publicar sin la 56d

## Contexto

La 56a dejó la API del catálogo (`POST`, `PATCH /:id` y `PUT /:id/contadores` en `/ajustes/clientes`) y la 56b la regla de quién lleva clientes. Hoy la pestaña «Clientes» de Ajustes (`AjustesClientes.vue`) es solo lectura. Esta rebanada le da las escrituras. Quedan para la 56d: «Mi perfil» con «Vincular clientes», quitar «Editar» y «Nuevo cliente» de Documentos y el alta y edición de «Mis actividades», y retirar las rutas viejas. Hasta la 56d **no se publica** (ver la nota de la 56b).

## Historia

Como administrador o usuario de sistemas, quiero dar de alta, editar, activar o desactivar clientes y asignarles contadores desde Ajustes, y como recepcionista quiero dar de alta clientes, para llevar el catálogo del despacho en un solo lugar.

## Lo que ya decidió el usuario

- Alta de clientes: administrador, sistemas y recepcionista. Edición, renombrar, desactivar y asignar contadores: solo administrador y sistemas.
- Clave de carpeta obligatoria; RFC opcional; un solo nombre por cliente en todo el catálogo.
- Quién puede ser contador de un cliente: cuentas con rol contador o auxiliar de Seguimiento, o Contador de Documentos (regla de la 56b).
- El primero de la lista de contadores es el **principal**.

## Criterios de aceptación

### Backend (dos lecturas nuevas, solo lectura)

1. **Datos completos en el listado:** `GET /ajustes/clientes` agrega `email` y `telefono` a cada cliente (conserva todos los campos actuales y `contadores`). Sin cambiar permisos (administrador y sistemas) salvo lo que decida el criterio 2.
2. **Recepcionista (confirmado por el usuario el 2026-11-26): ve la lista y da de alta.** `GET /ajustes/clientes` también le responde a ella (middleware `requireAltaClientes`, el mismo del alta); `PATCH` y `PUT` siguen en 403 para ella. La respuesta es la misma que para administrador y sistemas.
3. **`GET /ajustes/contadores`** (administrador, sistemas y recepcionista, porque la API de alta ya acepta `contadores`): lista las cuentas que **pueden llevar clientes** según `puedeLlevarClientes`, con `id`, `nombre` y `rol` (el de Seguimiento), ordenadas por nombre, sin correo ni otros datos. Ruta nueva en la matriz de autorización.

### Frontend

4. **Acciones por fila** (administrador y sistemas), con `q-btn` de icono y `q-tooltip` + `aria-label`: «Editar datos», «Contadores», y «Desactivar» o «Activar» (con confirmación en un diálogo; desactivar avisa que ya no admitirá documentos nuevos en Recepción). La recepcionista no ve esas acciones.
5. **«Nuevo cliente»** (administrador, sistemas y recepcionista), botón arriba de la tabla. Diálogo con **clave** (obligatoria, hasta 4 caracteres sin espacios, en mayúsculas), **razón social** (obligatoria, hasta 150), RFC, correo, teléfono y, opcional, **contadores**. Los campos son exactamente los de la tabla `clientes`: no se agregan otros.
6. **«Editar datos»**: el mismo diálogo en modo edición con los valores actuales (`GET /ajustes/clientes` ya trae todos); guarda con `PATCH /ajustes/clientes/:id` y solo envía los campos que cambiaron.
7. **«Contadores»**: diálogo propio que lista las cuentas elegibles (`GET /ajustes/contadores`) con búsqueda y selección múltiple (`q-select` múltiple con chips). El orden de la selección es el de la lista: el primero se marca con «Principal» y una línea de ayuda lo explica («El principal es quien aparece sugerido en Recepción»). Guarda con `PUT /ajustes/clientes/:id/contadores` con la lista completa. Si el principal es una cuenta sin rol Contador en Documentos, el diálogo avisa que Recepción no lo propondrá. Se puede dejar sin contadores (lista vacía).
8. **Tabla y tarjetas:** la columna «Contador» muestra el principal y, si hay más, «+N» con tooltip con todos; la vista de tarjetas (menos de 600 px) lista todos los contadores; el estado «Inactivo» se ve igual. Búsqueda, orden y paginación como hoy; el texto de ayuda de la cabecera se reescribe porque ya no es solo de consulta.
9. **Errores y avisos:** mensajes del backend de tres partes mostrados con `mensajeParaUsuario`; la parte «sobre X» marca el campo con error (`erroresCampo` + `enfocarPrimerError`); 409 por nombre o clave repetidos se muestran junto al campo; éxito con `$q.notify` («Cliente agregado», «Cambios guardados», «Cliente desactivado», «Contadores actualizados»). Tras guardar, la lista se recarga en silencio y el foco vuelve al botón que abrió el diálogo.
10. **Diálogos:** patrón de la app (`hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?», `label for` + `for`, asterisco `aria-hidden`, `dialogo-entra`/`dialogo-sale`, botones `.boton-presionable`, bandera de reentrada en cada acción). Una sola petición a la vez por acción.
11. **Visibilidad por rol:** administrador y sistemas ven todo; la recepcionista ve la pestaña «Clientes» con la lista completa (solo lectura) y el botón «Nuevo cliente», sin las acciones de editar, contadores y desactivar. El contador, el auxiliar y los demás no entran a Ajustes. `AjustesPage.vue` muestra la pestaña «Clientes» también a la recepcionista (hoy se la oculta).
12. **Responsiva** de 1440 a 320 sin desborde (`scrollWidth - clientWidth` = 0 en `.q-table__middle.scroll`), columna de acciones siempre visible (o menú «⋮» en pantallas chicas), objetivos táctiles de 44 px, colores de la paleta (`$dg-colores`) y textos en español y en tú. Movimiento sin animar acciones de teclado y con `prefers-reduced-motion` respetado.
13. **Pruebas:** servicio (`ajustesService.js`: `crearCliente`, `editarCliente`, `reemplazarContadores`, `listarContadoresElegibles`), reglas de visibilidad por rol, textos de ayuda y estados, validaciones del formulario (clave obligatoria, límites), el patrón de diálogo y la tabla sin desborde (pruebas de texto como las de la 52 y 52b). Backend: los dos endpoints nuevos, la matriz y que `email` y `telefono` salgan. Todas deben **fallar sin el cambio**.
14. **Navegador real** (con cuentas `zz_test_` de administrador, sistemas y recepcionista, y un cliente `zz_test_`): alta con y sin contadores, error de nombre repetido, edición, desactivar y reactivar, asignar y quitar contadores, vista móvil de 375 px y de 320 px; borrar al terminar. Mostrar el panel antes de probar.
15. **Respaldo previo** de `delgrow_merge` fuera del proyecto, sin imprimir credenciales. **Puertas:** frontend `npm run lint:check`, `npm run build`, `node --test` y `npx prettier --check` (contra LF); backend `node --test --test-concurrency=1` por archivo y `node soporte-pruebas/verificarPruebas.js`. El navegador solo después de las pruebas del backend (la limpieza borra avisos `zz_test_`), y de preferencia con el backend del 3001 sin editar archivos mientras corren las pruebas (nodemon vuelve a correr el seed).

## Archivos autorizados

- Backend: `Backend/src/routes/ajustesRoutes.js`, `Backend/src/controllers/AjustesController.js`, `Backend/src/models/ClienteModel.js` y `ClienteContadorModel.js` (solo lecturas nuevas), `Backend/test/` (pruebas nuevas, matriz y las de Ajustes) y `soporte-pruebas/verificarPruebas.js` (`MINIMOS`).
- Frontend (`Seguimiento-proyectos/src/`): `components/AjustesClientes.vue`, `components/ClienteCatalogoDialog.vue` (nuevo), `components/ContadoresClienteDialog.vue` (nuevo), `services/ajustesService.js`, `pages/AjustesPage.vue` (visibilidad de la pestaña), `utils/modulos.js` (si hace falta una regla de rol) y pruebas en `Seguimiento-proyectos/test/`.

No se tocan Documentos, «Mis actividades», «Mi perfil» ni las rutas viejas. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Se reutilizan los patrones de los diálogos de formulario de la app (por ejemplo `NuevoClienteDialog.vue` de Documentos como referencia de campos y mensajes); no se copian sus reglas de contador (esa pantalla desaparece en la 56d).
- Para el diseño, el implementer sigue `AGENTS.md` (identidad visual, componentes de Quasar, paleta, tooltips y accesibilidad) y las guías de `emil-design-eng` (movimiento solo donde aporta) y `web-design-guidelines`; no se inventa una estética nueva.
- Trampa: el `GET /ajustes/clientes` actual no trae `email` ni `telefono`; sin el criterio 1 el formulario de edición los mostraría vacíos y un guardado los borraría (el `PATCH` borra con vacío o null): el frontend envía solo lo que cambió.
- Trampa: el cliente con `contador` inactivo o sin rol: la lista de elegibles viene de `puedeLlevarClientes`; si un cliente ya tiene un contador que dejó de ser elegible, el diálogo lo muestra y lo conserva hasta que lo quiten.

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: CAMBIOS NECESARIOS (Opus, un solo cambio, ya aplicado y verificado por el orquestador; no se pidió segunda vuelta). Detalle al final de este archivo.

## Reporte del implementer (resumen)

- **Respaldo previo:** `~/respaldos-seguimiento-proyectos/56c-ajustes-clientes-20261126-1613.sql` (297 800 bytes, fuera del proyecto; el primer intento salió vacío porque `.env` repite `DB_HOST`).
- **Backend:** `GET /ajustes/clientes` pasa a `requireAltaClientes` (también la recepcionista) y trae `email` y `telefono`; nueva `GET /ajustes/contadores` (`listarQuePuedenLlevarClientes`, `SQL_PUEDE_LLEVAR_CLIENTES` compartido con `idsQueNoPuedenLlevarClientes`; devuelve también `contador_documentos`, no pedido en el criterio 3 pero necesario para el aviso del criterio 7). PATCH y PUT sin cambios de permiso.
- **Frontend:** `AjustesClientes.vue` reescrito (acciones por fila, «Nuevo cliente», columna «Contador» con «+N», tarjetas en celular), `ClienteCatalogoDialog.vue` (alta y edición de datos) y `ContadoresClienteDialog.vue` (selección múltiple; el primero es el principal; avisa si no tiene rol Contador en Documentos), `ajustesService.js` (`crearCliente`, `editarCliente`, `reemplazarContadores`, `listarContadoresElegibles` y ayudas), `AjustesPage.vue` (la recepcionista ve la pestaña), `utils/modulos.js` (`puedeAgregarClientes`, `puedeEditarClientes`).
- **Pruebas:** backend nuevas `ajustesClientesLecturas.test.js` (11; en rojo antes: 8 de 11); frontend nueva `ajustesClientesCompleta.test.js` (41; 23 en rojo antes); cambios a pruebas existentes: `Backend/test/ajustes.test.js` (la recepcionista pasa de 403 a 200), `autorizacionMatriz.test.js` (fila de `GET /ajustes/clientes` con recepcionista y fila nueva de `/ajustes/contadores`), `Seguimiento-proyectos/test/ajustes.test.js` (la pestaña la ven también la recepcionista; la prueba de «solo lectura» pasó a búsqueda y textos vacíos, conservando la prohibición de `<q-form`, `@submit`, `.post(` y `.patch(` en la lista).
- **Puertas:** backend 94 archivos, 1020 pruebas, 0 fallidas; build y ESLint del frontend verdes; `prettier` contra LF verde en lo tocado; `node --test` del frontend 2300 de 2301: la que falla es `selectorModulos.test.js` («el CSS usa solo variables de la paleta que existen…»), rota desde antes por `var(--dg-texto-oscuro)` en `ModulosPage.vue` (líneas ~703 y ~741), que no es de esta rebanada.
- **Navegador (3001 y 9001 del usuario):** administrador (alta con y sin contadores, correo mal escrito, nombre repetido con otras mayúsculas con el 409 junto al campo, editar teléfono sin tocar otros campos, desactivar y activar con confirmación, asignar un auxiliar como principal con el aviso, quitar contadores, «¿Descartar los cambios?»); sistemas con acciones y «Nuevo cliente»; recepcionista con lista, «Nuevo cliente» y alta correcta, sin acciones; `scrollWidth - clientWidth` = 0 a 1440, 1024 y 768 con los 156 clientes; tarjetas a 375 y 320 con botones de 44 px. `clientes` 156 → 156, `cliente_contador` 6 → 6, 0 `zz_test_`.
- **Decisiones del implementer:** la clave solo es obligatoria al editar si el cliente ya la tenía; activar o desactivar envía solo `{ activo }`; para cambiar al principal hay que quitar y volver a elegir (no hay reordenar); un contador que ya no es elegible se muestra con nota y guardar con él da 400 junto al campo; la recarga tras guardar es silenciosa, con aviso propio si falla; la lista de la recepcionista incluye todos los campos; el comportamiento de foco y enfoque de error de los diálogos se verificó solo en navegador.
- **Verificado por el orquestador:** `clientes` 156, `cliente_contador` 6, `asignado_en` `datetime(3)`, `uq_clientes_nombre` presente, 0 incoherencias, 0 `zz_test_`.

## Detalle del veredicto del reviewer (Opus) y corrección

VEREDICTO: CAMBIOS NECESARIOS por un solo hallazgo.

**Hallazgo (media):** `Seguimiento-proyectos/test/ajustes.test.js:193`: la línea `assert.doesNotMatch(lista, /#[0-9a-fA-F]{3,8}\b/)` quedó con un byte de control real (0x08, retroceso) en lugar de los dos caracteres `\b` (un heredoc de bash los rompió). Con eso la expresión nunca coincide y la prueba de «sin hexadecimales» de `AjustesClientes.vue` pasaba siempre; ESLint lo marcaba como `no-control-regex` y `lint:check` no lo detecta porque no revisa `test/`. **Corregido por el orquestador:** se cambió el byte por `\b` escrito como texto; la línea quedó idéntica a la de HEAD, ESLint del archivo en verde y `node --test test/ajustes.test.js` 20/20; no queda ningún otro byte 0x08 en las pruebas.

Verificado por el reviewer: `GET /ajustes/clientes` (administrador, sistemas y recepcionista, con `email` y `telefono`), `GET /ajustes/contadores` (solo `id`, `nombre`, `rol` y `contador_documentos`, con la regla compartida `SQL_PUEDE_LLEVAR_CLIENTES`), PATCH y PUT en 403 para la recepcionista, el contador y el auxiliar; permisos de frontend iguales a los del backend; diálogos con campos exactos de `clientes`, `cambiosDeCliente` que no borra correo ni teléfono sin querer, clave obligatoria solo si ya la tenía, errores junto al campo, reentrada, descartar cambios, foco de regreso y activar/desactivar con confirmación; diálogo de contadores (principal, aviso sin rol Contador, no elegible conservado, lista vacía); sin hexadecimales ni `transition: all`; pruebas nuevas en rojo sin el cambio; solo archivos autorizados; puertas del backend en verde (94 archivos, 1020 pruebas, 0 fallidas); frontend `node --test` 2300 de 2301 (la falla es `selectorModulos.test.js` por `var(--dg-texto-oscuro)` en `ModulosPage.vue`, que ya fallaba en HEAD y no es de esta rebanada); base con `clientes` 156, `cliente_contador` 6 y 0 `zz_test_%`.

Opcionales (no bloquean): `ClienteCatalogoDialog.vue:105` y `:157` usan `maxlength` 151 y 21 (para mostrar el error), frente a 4 y 150 de otros campos, y la prueba `ajustesClientesCompleta.test.js:395` pasa por el campo de correo (verde casual); `normalizarRfc` del frontend no quita guiones ni espacios como el backend (rechazaría «ABC-010101-XY1»); al editar se valida el formulario completo, así que un dato viejo inválido impediría guardar otro campo (hoy hay 0); `lint:check` corre prettier sin `--check` y no revisa `test/`.

Riesgos para la 56d: dos caminos de alta con reglas distintas hasta retirar el de Documentos y el de «Mis actividades» (pueden seguir naciendo clientes sin clave); la edición de Documentos y de «Mis actividades» con un solo contador puede pisar el conjunto de `cliente_contador`; `listarQuePuedenLlevarClientes` no filtra cuentas inactivas (`usuarios` no tiene esa columna): si hay bajas, cambiar la regla en un solo lugar (`SQL_PUEDE_LLEVAR_CLIENTES`).

No verificado: la medida numérica de `scrollWidth - clientWidth` (solo a la vista; el implementer reportó 0 a 1440, 1024 y 768); rechazo del contador y del auxiliar en el navegador (por lectura del router y pruebas); una vez al escribir justo tras abrir el diálogo de contadores se cerró, sin reproducirse (probar a mano).
