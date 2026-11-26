# 56d — Mi perfil vincula clientes; el alta y la edición quedan solo en Ajustes; se retiran las rutas viejas

- **Riesgo:** alto (retira rutas y pantallas que hoy funcionan, cambia permisos de escritura sobre el catálogo compartido y cierra una restricción de seguridad)
- **Implementa:** un agente de código (Sonnet o equivalente) con TDD; **revisa** otra instancia con un modelo grande (Opus o equivalente) que **no modifica nada**.
- **Estado:** refinada y redactada para continuarla en otra herramienta. **El usuario todavía no la ha aprobado: no implementar nada hasta que la apruebe** (`AGENTS.md`: solo se aplican cambios aprobados). Al abrirla, leerle al usuario el resumen de «Lo que cambia» y los puntos de «Por confirmar» y esperar su visto bueno.

## Léelo primero

`AGENTS.md`, `MEMORY.md`, `docs/traspaso-pendientes-2026-11-26.md` (estado, reglas, trampas y mapa del código), `docs/flujo-agentes.md` y los archivos `docs/rebanadas/53` a `56c` (con sus veredictos). Esta rebanada sigue sus decisiones.

## Por qué existe (la restricción que cierra)

Desde la 56b, cualquier contador o auxiliar puede vincularse a cualquier cliente activo del catálogo (`POST /clientes/vinculos`). Mientras exista `PATCH /clientes/:id` de «Mis actividades» (`ClienteModel.actualizar`), ese contador vinculado puede **renombrar, cambiar el RFC o desactivar** el cliente para todos. Un cliente desactivado ya no admite documentos nuevos en Recepción. Por eso **no se publica sin esta rebanada**. Producción (fase 5) está en pausa; la base de pruebas no corre riesgo real.

## Decisiones del usuario que la sostienen (2026-11-26)

- Editar un cliente es **exclusivo de Ajustes**; solo administrador y sistemas renombran, desactivan y asignan contadores.
- El **alta** de clientes también es solo de Ajustes (administrador, sistemas y recepcionista). El contador **no crea ni modifica** clientes: **vincula** los que ya existen, desde «Mi perfil» (cualquier cliente activo, sin aprobación; queda en la bitácora) y puede quitarse **solo su propio vínculo**.
- Pueden llevar clientes las cuentas con `usuarios.rol` contador o auxiliar, o con rol Contador en Documentos (regla `puedeLlevarClientes` de `ClienteContadorModel`, ya hecha).
- Un solo nombre por cliente en todo el catálogo (índice `uq_clientes_nombre`, ya hecho).

## Lo que cambia (resumen para el usuario)

1. **«Mi perfil»** (contador y auxiliar): «Mi cartera de clientes» deja de armarse con el texto de los casos y pasa a ser la **lista real del catálogo** (`GET /clientes/mi-cartera`), con botones **«Vincular clientes»** (buscador del catálogo) y **«Quitar de mi cartera»**.
2. **Documentos → Clientes:** desaparecen «Nuevo cliente» y «Editar»; la ficha (expediente) queda de solo lectura con un aviso de que los cambios se hacen en Ajustes (con enlace «Ir a Ajustes» para quien pueda).
3. **Mis actividades → Clientes:** el contador ya no crea, edita ni desactiva clientes; ve su lista de solo lectura y un texto/botón que lo lleva a «Mi perfil» para vincular más.
4. **Backend:** se retiran `POST` y `PATCH /doc/clientes` y `POST` y `PATCH /clientes`.

## Criterios de aceptación

### A. Frontend: «Mi perfil» (`Seguimiento-proyectos/src/pages/ContadorAuxiliaresPage.vue`; hoy usa `utils/carteraClientes.js`, que agrupa los casos por el texto del cliente)

1. La sección «Mi cartera de clientes» lista los clientes de `GET /clientes/mi-cartera` (`id`, `clave`, `nombre`, `activo`): nombre, clave («Sin clave» si no hay), chip «Inactivo» si no está activo, y las cifras de casos (**abiertos y finalizados**) calculadas por **coincidencia de nombre** entre el cliente del catálogo y el texto de `casos.cliente`, usando la misma normalización sin acentos ni mayúsculas que `carteraClientes.js` (reutilizarla, no escribir otra). Hasta la rebanada 57 (`cliente_id` en los casos) estas cifras son aproximadas: el texto de ayuda de la sección lo dice. Cliente sin casos: «Sin casos abiertos». Los casos cuyo texto no coincide con ningún cliente de la cartera **no aparecen** en la lista.
2. **«Vincular clientes»** (botón de la sección; control táctil de 44 px, tooltip, `aria-label`): abre un diálogo con buscador (`GET /clientes/catalogo?q=&limite=`, debounce, mínimo 2 caracteres o vacío para los primeros; sin distinguir acentos ni mayúsculas) y una lista de resultados con casilla de selección. Los que ya están en la cartera salen marcados como «Ya en tu cartera» y deshabilitados. Se pueden elegir varios (1 a 50) y se envían juntos con `POST /clientes/vinculos` (`{ clienteIds: [...] }`). Respuesta `{ vinculados, yaEstaban }`: aviso «Se vincularon N clientes» (y, si aplica, «M ya estaban en tu cartera»). Todo o nada: si el backend responde 400, se muestra su mensaje de tres partes en el diálogo.
3. **«Quitar de mi cartera»** (acción por cliente): confirmación en diálogo («Dejarás de verlo en Mi cartera, Mis actividades y Documentos. El cliente no se borra.»; si el cliente está **inactivo** añade «Está inactivo: no podrás volver a vincularlo hasta que un administrador lo active»). Llama a `DELETE /clientes/vinculos/:clienteId`; un 404 («no estaba en tu cartera») se trata como ya hecho y recarga la lista.
4. Estados: cargando, error con «Reintentar», vacío («Todavía no tienes clientes en tu cartera» / «Vincula los que atiendes con «Vincular clientes»»). Recarga **en silencio** tras vincular o quitar; un fallo al releer no se presenta como fallo del guardado.
5. Patrón de diálogos de la app: `hayDatosSinGuardar` + `:persistent` + `@shake` («¿Descartar los cambios?») en el de vincular, `label for` + `for`, bandera de reentrada en cada acción, foco de regreso al botón que abrió el diálogo, `dialogo-entra`/`dialogo-sale`, `.boton-presionable`.
6. Servicio nuevo en `src/services/` (por ejemplo ampliar `clienteService.js` o crear `carteraService.js`): `listarMiCartera`, `buscarEnCatalogo`, `vincularClientes`, `quitarVinculo`, con api inyectable y sin Vue ni Quasar, como los demás servicios.
7. Responsiva de 1440 a 320 sin desborde de página; colores de `$dg-colores` (nunca hexadecimales; para `outline` usar `var(--dg-foco)`); textos en español y en tú; sin `transition: all`; `prefers-reduced-motion` respetado.

### B. Frontend: Documentos

8. `modulos/documentos/pages/ClientesPage.vue`: quitar el botón «Nuevo cliente» y el uso de `NuevoClienteDialog`.
9. `modulos/documentos/components/ExpedienteClienteDialog.vue`: quitar «Editar» y el uso de `NuevoClienteDialog`. La ficha queda de solo lectura, con una línea: «Para cambiar los datos o los contadores de este cliente, pide el cambio a administración». Para quien puede editar en Ajustes (administrador y sistemas) se agrega el botón/enlace «Ir a Ajustes» (`/ajustes?tab=clientes`), con tooltip.
10. Retirar el componente muerto `NuevoClienteDialog.vue` y su prueba `NuevoClienteDialog.test.js`, y las funciones de cliente que ya nadie use en `modulos/documentos/servicios/api.js` (`crearCliente`, `editarCliente`; conservar `obtenerExpediente`/lectura). Antes de borrar, `grep` de usos; si algo más lo usa, parar y preguntar. Ajustar `ClientesPage.rebanada2.test.js`, `ExpedienteClienteDialog.test.js` y las pruebas que cubrían el alta y la edición **sin relajar asertos de otras cosas**: los que se quitan son los que defendían lo retirado.
11. El permiso `crear_cliente` (`Backend/src/modulos/documentos/logica/errores.mjs` y `Seguimiento-proyectos/src/utils/modulos.js`, **siempre las dos tablas iguales**) queda sin uso al retirar las rutas: eliminarlo de ambas (y de `modulos/documentos/permisos.js` si aparece), con cuidado de las pruebas que comparan las tablas.

### C. Frontend: Mis actividades

12. `components/MisClientes.vue` pasa a **solo lectura**: lista de clientes del contador (los de `GET /clientes`), sin «Agregar cliente», sin «Editar» y sin «Desactivar». Texto de ayuda: «Para agregar o quitar clientes de tu cartera, usa Mi perfil. Los datos de un cliente los cambia administración.» y un botón «Ir a Mi perfil» (`/perfil`, con tooltip).
13. Retirar `components/ClienteFormDialog.vue` (alta y edición del contador) y lo que ya no haga falta de `services/clienteService.js` (`crearCliente`, `editarCliente`; conservar `listarMisClientes`). Revisar y ajustar `ListaDelMes.vue` (estado vacío «Todavía no tienes clientes»: la acción pasa a «Ir a Mi perfil»), `MisActividades.vue`, `InformesActividades.vue`, `ClientesDeTipoDialog.vue` y sus pruebas (`misActividades.test.js`, `listaDelMes.test.js`, `revisionUiActividades.test.js`) sin relajar asertos de lo que se conserva.
14. Comprobar que «Mis actividades» no dependa de ninguna ruta que se retire (`ClientesDeTipoDialog` y los tipos de actividad usan `/tipos-actividad/:id/clientes`, que **no** se retira).

### D. Backend: retirar las rutas viejas

15. Quitar `POST` y `PATCH /doc/clientes/:id` de `Backend/src/routes/documentoRoutes.js` (alrededor de las líneas 160-180) y los manejadores `rutaCrearCliente` y `rutaEditarCliente` de `Backend/src/modulos/documentos/rutas/clientes.mjs` con sus pruebas (`clientes.test.mjs`: conservar las del listado y la ficha). **Conservar y seguir exportando `validarDatosNuevoCliente`** (la usa Ajustes: `AjustesController.js`) y `rutaConsultarCliente`/`rutaClientes`.
16. Quitar `POST /clientes` y `PATCH /clientes/:id` de `Backend/src/routes/clienteRoutes.js`, `crearCliente` y `actualizarCliente` de `ClienteController.js` y `ClienteModel.crear` y `ClienteModel.actualizar` (revisar con `grep` que nada más los use, incluidas las pruebas y el seed; **conservar** `listarDeUsuario`, `buscarDeUsuario`, `listarTodos`, `crearEnCatalogo`, `actualizarEnCatalogo` y lo de cartera). Con ellas desaparecen los mensajes 409 engañosos («edita el cliente que ya tienes con ese nombre», «ese contador ya tiene un cliente con esa razón social»).
17. Quitar de `Backend/test/autorizacionMatriz.test.js` las filas de las cuatro rutas retiradas (si no, la prueba falla) y las pruebas de `Backend/test/clientes.test.js`, `clienteContadorModel.test.js` y `unificacion.test.js` que dependían de `ClienteModel.crear` (el importador no lo usa: revisar); reportar cada prueba existente que se quita o cambia y por qué. Actualizar `MINIMOS` de `Backend/soporte-pruebas/verificarPruebas.js` con los nuevos conteos (nunca dejar un mínimo por encima de lo real).
18. Las rutas nuevas de la 56b y 56c, `GET /clientes` y `PUT /tipos-actividad/:id/clientes` no cambian. Una petición a una ruta retirada responde el 404 genérico.

### E. Pruebas, verificación y cierre

19. **TDD:** pruebas en rojo primero (estructura/textos del frontend como en `selectorModulos.test.js` y `ajustesClientesCompleta.test.js`; servicio con api inyectada; backend con la matriz). Cada prueba nueva debe **fallar sin el cambio**. Antes de borrar pruebas existentes, anotar por qué.
20. **Respaldo previo** de `delgrow_merge` con `mysqldump` de XAMPP (`C:\xampp\mysql\bin`) a `~/respaldos-seguimiento-proyectos/56d-<fecha>.sql`, **fuera del proyecto**, sin imprimir credenciales; `Backend/.env` repite `DB_HOST`: usar la primera aparición (el primer intento puede salir vacío; comprobar que no esté vacío y que termine en «Dump completed»). Hacerlo desde Git Bash (la tubería de PowerShell daña los acentos).
21. **Puertas:** Backend: `node --test --test-concurrency=1` **por archivo** (los de clientes, `ajustes*`, `clientesCartera`, `autorizacionMatriz`, `clienteContadorModel`, `esquemaClienteContador`, `seed`, `documentosModulo`, `unificacion`, `userModel`), `src/modulos/documentos/**/*.test.mjs` y `node soporte-pruebas/verificarPruebas.js` (puede fallar una vez de forma intermitente si el backend del 3001 con nodemon reinicia y corre el seed a media suite: repetir, o detener el 3001). Frontend: `npm run build`, `npx eslint` de los archivos tocados y **de `test/`** (`lint:check` no revisa `test/`), `node --test` (hoy da 2300 de 2301 por `selectorModulos.test.js`, ajena a esta rebanada: ver «Antes de empezar») y `npx prettier --check` de los archivos tocados **contra el contenido en LF** (el árbol está en CRLF). Al terminar: `clientes` = 156, `cliente_contador` = 6 y 0 filas `zz_test_%`.
22. **Navegador real** (servidores del usuario: backend 3001 con nodemon y frontend 9001; no cerrarlos ni reiniciarlos; mostrar el panel antes de probar; no editar archivos mientras hay un diálogo abierto, porque el HMR borra lo escrito; probar **después** de terminar las pruebas del backend porque `limpiarDatosDePrueba` borra avisos con `zz_test_`). Con cuentas `zz_test_` creadas para la prueba y borradas al final (sesiones primero): contador (rol Contador en Documentos), auxiliar, recepcionista, administrador y sistemas, y un usuario solo de Documentos (Practicante). Verificar: vincular uno y varios clientes, vincular uno que ya está, buscar con acentos y mayúsculas, quitar con confirmación (activo e inactivo), que «Mis actividades» muestre el cliente vinculado y que **ya no se pueda crear, editar ni desactivar** desde ahí, que Documentos → Clientes no tenga «Nuevo cliente» ni «Editar» y la ficha muestre el aviso (con «Ir a Ajustes» solo para administrador y sistemas), 375 px y 320 px sin desborde de página, y que el administrador siga editando desde Ajustes. Comprobar también (con `curl` o el navegador) que las cuatro rutas retiradas responden 404 y que `PATCH /clientes/:id` ya no existe para el contador vinculado.
23. **Cierre:** reviewer sin modificar nada (puertas, permisos por rol, que las pruebas nuevas fallen sin el cambio y que no se haya relajado ninguna otra); veredicto en este archivo; `MEMORY.md` (quitar la restricción de «no publicar sin la 56d» y las notas ligadas a ella); commit con mensaje descriptivo; **push solo con permiso del usuario**.

## Archivos autorizados

- Backend: `src/routes/documentoRoutes.js`, `src/routes/clienteRoutes.js`, `src/controllers/ClienteController.js`, `src/models/ClienteModel.js`, `src/modulos/documentos/rutas/clientes.mjs` y `clientes.test.mjs`, `src/modulos/documentos/logica/errores.mjs`; `test/autorizacionMatriz.test.js`, `test/clientes.test.js`, `test/clienteContadorModel.test.js`, `test/unificacion.test.js` (solo lo que dependa de lo retirado) y `soporte-pruebas/verificarPruebas.js` (`MINIMOS`).
- Frontend (`Seguimiento-proyectos/src/`): `pages/ContadorAuxiliaresPage.vue`, `utils/carteraClientes.js` (reutilizar la normalización; sin romper `test/` que ya lo cubren), `services/clienteService.js` o un servicio nuevo, un componente nuevo para el diálogo de vincular (por ejemplo `components/VincularClientesDialog.vue`), `components/MisClientes.vue`, `components/ListaDelMes.vue`, `components/MisActividades.vue`, `modulos/documentos/pages/ClientesPage.vue`, `modulos/documentos/components/ExpedienteClienteDialog.vue`, `modulos/documentos/servicios/api.js`, `modulos/documentos/permisos.js`, `utils/modulos.js`.
- Borrados autorizados (si el `grep` confirma que no los usa nada más): `modulos/documentos/components/NuevoClienteDialog.vue` y su prueba, `components/ClienteFormDialog.vue`.
- Pruebas del frontend que cubran lo anterior (`Seguimiento-proyectos/test/` y las `*.test.js` junto a los componentes de documentos).

No se tocan: `AjustesClientes.vue` y sus diálogos (56c), el backend de `/ajustes/clientes` ni de `/clientes/vinculos` (56a y 56b), `ModulosPage.vue`, el esquema de la base ni las demás rebanadas. **Fuera de esta lista, parar y preguntar.**

## Antes de empezar (con el usuario)

- **Prueba rota ajena:** `Seguimiento-proyectos/test/selectorModulos.test.js` («el CSS usa solo variables de la paleta que existen…») falla porque `ModulosPage.vue` usa `var(--dg-texto-oscuro)` en dos líneas (~703 y ~741), variable que no existe. Es trabajo del usuario (tarjeta de perfil). Preguntarle si quiere que se cambie esas dos líneas por una variable de la paleta; solo con su permiso. Sin eso, `node --test` del frontend da 2300 de 2301 y no es culpa de esta rebanada.

## Por confirmar con el usuario al aprobar

1. Que «Quitar de mi cartera» exista en esta rebanada (es la decisión del 2026-11-26) y que el aviso de cliente inactivo sea como el del criterio 3.
2. Que las cifras de casos por cliente salgan por **coincidencia de nombre** (aproximadas hasta la 57) y que los casos cuyo texto no coincida no aparezcan en la lista.
3. Que se **borren** `NuevoClienteDialog.vue` y `ClienteFormDialog.vue` y se retire el permiso `crear_cliente` (son código muerto tras la rebanada), en vez de dejarlos sin uso.

## Notas y riesgos

- La recepcionista **no** vincula clientes (no lleva cartera): su alta sigue en Ajustes. Administrador y sistemas tampoco ven «Vincular clientes» en «Mi perfil» salvo que tengan rol contador/auxiliar o Contador en Documentos (regla `puedeLlevarClientes`): el menú y la sección de «Mi perfil» ya existen para contador y auxiliar; no mostrar los botones a quien el backend rechazaría (403).
- «Mi perfil» hoy se ve también para otros roles (commits `66ac5fc` y `357d9ad`): la sección de cartera solo para quien `trabajaCasos`; si una cuenta puede ver el perfil pero no llevar clientes, no se le muestran los botones.
- La cartera nueva incluye clientes **inactivos**; si el contador los quita no podrá volver a vincularlos (el catálogo solo ofrece activos). El aviso del criterio 3 lo dice.
- Con el índice único de nombre, un cliente creado con un nombre ya usado se rechaza; tras esta rebanada ya no hay otro camino de alta que Ajustes.
- Quedan para después: **56e** (consolidar repetidos y el orden con el importador antes de producción), **57** (`cliente_id` en casos, auditorías y juntas; entonces las cifras de la cartera dejan de ser por nombre) y **58** (firmas a archivos).
- Trampas: un heredoc de bash rompe las barras invertidas (`\b` se vuelve el byte 0x08 en las pruebas): usar la herramienta de escritura de archivos, no heredocs, para texto con `\`; varios `.vue` están en CRLF y `sed` falla con varias líneas o con `\\`: usar la herramienta de edición; no usar `git stash`; `db.js` solo acepta parámetros primitivos.

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
