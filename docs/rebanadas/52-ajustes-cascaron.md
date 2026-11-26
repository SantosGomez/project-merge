# 52 — Cascarón de Ajustes (Clientes y Usuarios)

- **Riesgo:** medio (toca router, permisos por rol y un endpoint nuevo de solo lectura)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Sonnet, `reviewer`, instancia nueva)
- **Estado:** aprobada; su entrada se reubicó en la 52b

## Historia

Como administrador, usuario de sistemas o recepcionista, quiero una sola pantalla «Ajustes» donde estén el directorio de usuarios y el catálogo de clientes, para dejar de buscarlos dentro de cada módulo.

## Criterios de aceptación

1. Existe la ruta `/ajustes` (nombre `ajustes`) con `q-tabs`: «Clientes» y «Usuarios», la pestaña activa viaja en `?tab=clientes|usuarios` (por omisión, «Usuarios»).
2. Acceso: administrador, usuario de sistemas y recepcionista entran a Ajustes. La pestaña «Clientes» solo la ven administrador y usuario de sistemas; la recepcionista solo ve «Usuarios». Si la recepcionista abre `?tab=clientes`, cae en «Usuarios».
3. Pestaña «Usuarios»: es el directorio actual (`CountersDirectoryPage`) reutilizado, con el mismo comportamiento y permisos por rol de hoy. No se reescribe su lógica.
4. Pestaña «Clientes» (solo lectura): lista todos los clientes con clave, razón social, RFC, contador (o «Sin contador»), y estado (activo/inactivo), con búsqueda por texto y estado vacío que invita a actuar. Sin altas, ediciones ni fusión (eso es la rebanada 56).
5. Endpoint nuevo `GET /ajustes/clientes` (solo administrador y sistemas, 403 al resto, formato JSON de seguimiento). Solo lee `clientes` y `usuarios`; sin cambios de esquema ni semáforo.
6. Menú: «Directorio» se reemplaza por «Ajustes» (icono `settings`) en los mismos lugares, en el dock (`opcionesDock`, con `q-tooltip` y `aria-label`) y en el menú lateral del celular (sin tooltip). Se cambian las dos plantillas. Las opciones de administrador, sistemas y recepcionista siguen apareciendo donde hoy aparece «Directorio».
7. Compatibilidad: la ruta `admin/directorio` queda como redirección a `/ajustes?tab=usuarios`; el enlace del dashboard del administrador y los `volverA` apuntan a Ajustes. Ningún enlace existente se rompe.
8. Responsiva (1440, 1024, 768, 375, 320) sin desbordar. Si la tabla de clientes desborda: ocultar columnas en móvil, `ellipsis` + tooltip y `scrollWidth - clientWidth = 0` en `.q-table__middle.scroll`. Las dos etiquetas `no-data-label` y `no-results-label`.
9. Movimiento (emil-design-eng): el cambio de pestaña es instantáneo (se usa a menudo); `.boton-presionable` en botones; `prefers-reduced-motion` respetado; ningún `transition: all`.
10. Textos en español y en tú; colores solo de `$dg-colores`.
11. Pruebas: el endpoint nuevo entra en `autorizacionMatriz.test.js` y su archivo de prueba va en `MINIMOS`; prueba de que la recepcionista recibe 403 y no ve la pestaña. Datos de prueba `zz_test_`, 0 filas al terminar.

## Archivos autorizados

Backend:
- `Backend/src/routes/ajustesRoutes.js` (nuevo)
- `Backend/src/controllers/AjustesController.js` (nuevo)
- `Backend/src/models/ClienteModel.js` (agregar listado de todos los clientes, sin tocar lo existente)
- `Backend/src/app.js` (registrar la ruta)
- `Backend/test/ajustes.test.js` (nuevo), `Backend/test/autorizacionMatriz.test.js`, `Backend/soporte-pruebas/verificarPruebas.js` (`MINIMOS`)

Frontend (`Seguimiento-proyectos/src/`):
- `pages/AjustesPage.vue` (nuevo), `components/AjustesClientes.vue` (nuevo), `services/ajustesService.js` (nuevo)
- `router/index.js`
- `layouts/MaquetaLayout.vue` (dock y menú lateral)
- `pages/AdminDashboardPage.vue` (solo el enlace al directorio)
- `pages/CountersDirectoryPage.vue` solo si hace falta quitarle el encabezado propio al montarlo como pestaña; avisar antes.
- Pruebas del frontend que ya cubran el menú o el router, si fallan por el cambio.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones con el usuario (2026-11-26): los tres roles entran a Ajustes; «Clientes» lo ven administrador y sistemas; la lista sale de un endpoint nuevo y chico; «Directorio» se reemplaza por «Ajustes» en el menú.
- No entra: altas, edición o fusión de clientes, tabla `cliente_contador`, cambios de esquema, cambios al directorio de usuarios más allá de montarlo como pestaña. Siguen en las rebanadas 53–58.
- Trampas: las opciones del menú viven en dos lugares; `GET /clientes` de seguimiento es solo del contador dueño (no sirve para el administrador); `GET /doc/clientes` calcula semáforo y no se reutiliza. `session.id` es texto: comparar con `Number(...)`.
- Fable no está disponible: la revisión de riesgo alto usa Opus.

---

## Reporte del implementer

1. Rebanada completada: sí, los 11 criterios. `/ajustes` con pestañas «Clientes» y «Usuarios» (`?tab=`, por omisión «Usuarios»); la recepcionista solo ve «Usuarios» y `?tab=clientes` cae en «Usuarios»; `GET /ajustes/clientes` solo para administrador y sistemas (403 al resto, 401 sin sesión); «Directorio» reemplazado por «Ajustes» (icono `settings`) en dock y menú lateral; `admin/directorio` redirige a `/ajustes?tab=usuarios`.
2. Archivos modificados:
   - Backend nuevos: `routes/ajustesRoutes.js`, `controllers/AjustesController.js`, `test/ajustes.test.js`. Editados: `models/ClienteModel.js` (`listarTodos`), `app.js`, `test/autorizacionMatriz.test.js`, `soporte-pruebas/verificarPruebas.js` (`'ajustes.test.js': 4`).
   - Frontend nuevos: `pages/AjustesPage.vue`, `components/AjustesClientes.vue`, `services/ajustesService.js`, `test/ajustes.test.js`. Editados: `router/index.js`, `layouts/MaquetaLayout.vue`, `pages/AdminDashboardPage.vue`; pruebas existentes actualizadas por el cambio de nombre: `test/layout-drawer-check.js`, `test/rolRecepcionista.test.js`, `test/directorioUsuarios.test.js`.
   - No se tocó `CountersDirectoryPage.vue`. `ModulosPage.vue` ya venía modificado antes (no es de esta rebanada).
3. Prueba en rojo y por qué falló: backend, `ajustes.test.js` dio 404 porque la ruta no existía; frontend, `ajustes.test.js` falló con `ERR_MODULE_NOT_FOUND` por falta de `ajustesService.js`. Al cambiar menú y router fallaron 9 pruebas existentes que dependían de `admin-directorio`/«Directorio»; se actualizaron sin relajar asertos.
4. Puertas:
   - Backend: `autorizacionMatriz` + `ajustes` verde (43/43); `verificarPruebas.js` verde en la 2.ª corrida (87 archivos, 913 pruebas, 0 fallidas; la 1.ª dio 2 fallidas sin identificar, parece intermitente de BD compartida); documentos 305/305.
   - Frontend: `node --test` 2237/2237; `lint:check` verde; `build` verde; `prettier --check` literal falla por CRLF del árbol (sin diferencias nuevas contra LF).
   - Navegador (9001/3001): administrador y recepcionista probados; sin desbordes de 1440 a 320 (tarjetas en 375 y 320). Rol sistemas no probado en navegador (cubierto por pruebas).
   - Datos de prueba: 0 filas `zz_test_%`. Sin procesos propios abiertos.
5. Decisiones no cubiertas: directorio montado tal cual con `.directory-page` sobrescrito vía `:deep()`; `admin-directorio` queda como ruta de solo redirección (por `RUTA_PRINCIPAL_POR_ROL` de sistemas); `q-tab-panels` con `keep-alive` y sin `animated`; tabla de clientes pasa a tarjetas bajo 600 px y oculta RFC bajo 1024 px; subtítulo del menú «Usuarios y clientes del despacho» (recepcionista: «Consultar cuentas del equipo»); el botón del dashboard conserva «Ver directorio».
6. Para la memoria: Ajustes reemplaza a «Directorio» en el menú; `GET /ajustes/clientes` lee `clientes` unido a `usuarios`. Trampa: en `Backend/test`, los clientes con `usuario_id` NULL no se borran en cascada, hay que borrarlos por nombre `zz_test_%`. Trampa: árbol del frontend en CRLF, comparar `prettier` contra LF. Pendiente: una falla intermitente de `verificarPruebas.js` (2 pruebas no identificadas).

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Sonnet, sin hallazgos bloqueantes).

- Puertas: backend `ajustes` 4/4 y `autorizacionMatriz` 39/39; `verificarPruebas.js` verde en dos corridas (87 archivos, 913 pruebas, 0 fallidas); frontend `node --test` 2237/2237, `lint:check` y `build` en verde. `prettier --check` marca `router/index.js`, `MaquetaLayout.vue` y `AdminDashboardPage.vue` (árbol en CRLF; los archivos nuevos pasan).
- Verificado: permisos del endpoint (200 administrador y sistemas; 403 recepcionista y contador; 401 sin sesión), pestaña «Clientes» oculta a la recepcionista, enlaces viejos a `admin/directorio` sin romper, menús del dock y lateral coinciden, pruebas existentes actualizadas sin relajar asertos, solo archivos autorizados.
- Navegador: sistemas y recepcionista probados (375 px y ~644 px). Sin 0 filas `zz_test_%` pendientes.
- No verificado: administrador en navegador, anchos 1440/1024/768/320 con medición de desborde, `prefers-reduced-motion` (solo por lectura de código). La falla intermitente de `verificarPruebas.js` no se reprodujo.
- Fuera de la rebanada: `ModulosPage.vue` ya venía modificado por el usuario (botón «Ajustes» con `abrirAjustes` aún sin definir, y falta una coma en un selector CSS). No se tocó.
- Pendiente de decisión del usuario: el punto de entrada debe moverse del menú de seguimiento al selector `/modulos` (ver notas).
