# 51 — Expediente del cliente y edición de sus datos

- **Riesgo:** alto (permisos nuevos por ruta y escritura en el catálogo único `clientes`)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** cerrada por el usuario tras 2 vueltas (2026-11-25), con pendientes: foco en el primer error y `label for` de `NuevoClienteDialog` (falta la prop `for` en los `q-input`), guarda de `fechaRecepcion` null en `ExpedienteClienteDialog`, «X» de 34 px y revalidación del contador en el PATCH aunque no cambie

## Historia

Como contador, administrador o sistemas del módulo de documentos, quiero abrir el expediente de un cliente desde «Clientes» para consultar sus datos y sus recepciones, y corregir sus datos con «Editar» sin salir de la ficha.

## Criterios de aceptación

1. En `ClientesPage.vue`, el botón «Ver expediente» (icono `folder_open`, ya existe y hoy solo muestra un aviso) abre un diálogo de solo lectura `ExpedienteClienteDialog.vue`.
2. La ficha muestra los datos de la tabla `clientes`: razón social, clave de carpeta, RFC, correo, teléfono, contador asignado, estado (Activo/Inactivo, con texto y no solo color) y fecha de alta. Los vacíos se ven como «Sin capturar».
3. La ficha muestra las últimas 20 recepciones del cliente (folio, tipo de documento, periodo, fecha de recepción y estado con el chip de `estiloDeEstadoDocumento`), de la más reciente a la más antigua, y el total de recepciones. Sin recepciones: «Este cliente aún no tiene recepciones registradas.»
4. Nuevo `GET /doc/clientes/:id` con permiso `ver_directorio` → `{ cliente, recepciones, totalRecepciones }`. Id no entero o ≤ 0 → 400; inexistente → 404 `{ error, mensaje }`.
5. La ficha tiene un botón «Editar» solo si `hayAcceso(rol, 'crear_cliente')` (Contador, Administrador, Sistemas: mismo permiso que el alta). Practicante ve la ficha sin «Editar».
6. «Editar» abre el mismo formulario del alta (`NuevoClienteDialog.vue` con prop `cliente`, título «Editar cliente», botón «Guardar cambios») con los datos precargados, más un interruptor «Cliente activo» que solo aparece al editar.
7. Nuevo `PATCH /doc/clientes/:id` con permiso `crear_cliente`: cambia razón social, clave, RFC, correo, teléfono, contador (`usuario_id`) y `activo`. Usa las mismas validaciones del alta (`validarDatosNuevoCliente`) y la misma comprobación de contador; `activo` debe ser booleano. Respuestas: 200 `{ cliente }`, 400 datos inválidos, 404 inexistente, 409 `CLIENTE_DUPLICADO` (clave o razón social con el mismo contador), 403 sin permiso.
8. Al guardar, la ficha y la tabla de Clientes se actualizan (un cliente dado de baja desaparece de la lista si «Incluir bajas» está apagado) y se avisa «Cambios guardados».
9. El formulario conserva el patrón de AGENTS.md: `hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?», errores por campo y foco en el primero, `label for`, asterisco `aria-hidden`. Sin cambios, «Guardar cambios» no envía nada.
10. Ambas rutas nuevas en `autorizacionMatriz.test.js`; los permisos del frontend no cambian (se reutilizan `ver_directorio` y `crear_cliente`).
11. Responsive: a 375 px la ficha ocupa la pantalla con scroll interno y la lista de recepciones no desborda en horizontal; botones de 44 px.

## Archivos autorizados

- `Backend/src/modulos/documentos/rutas/clientes.mjs` (+ `clientes.test.mjs`)
- `Backend/src/routes/documentoRoutes.js`
- `Backend/test/autorizacionMatriz.test.js`
- `Seguimiento-proyectos/src/modulos/documentos/servicios/api.js`
- `Seguimiento-proyectos/src/modulos/documentos/components/ExpedienteClienteDialog.vue` (nuevo) y su prueba `*.test.js`
- `Seguimiento-proyectos/src/modulos/documentos/components/NuevoClienteDialog.vue` y su prueba
- `Seguimiento-proyectos/src/modulos/documentos/pages/ClientesPage.vue` (+ `ClientesPage.rebanada2.test.js` si hace falta)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-25): la ficha incluye datos + recepciones; edita quien puede dar de alta (`crear_cliente`); se editan los campos del alta + activo.
- No se agregan columnas: todo sale de `clientes` (`id, clave, usuario_id, nombre, rfc, email, telefono, activo, creado_en`).
- El contador puede editar cualquier cliente (no solo los suyos): decisión explícita del usuario.
- Cambiar la clave hace que las recepciones nuevas busquen otra carpeta (`buscarCarpetaCliente` busca por clave); las carpetas existentes no se renombran. No entra en esta rebanada.
- `creado_en` es DATETIME: devolverlo como texto local `YYYY-MM-DD HH:mm:ss` (`aTextoLocal`/`aFechaLocal`); en el frontend no usar `new Date('AAAA-MM-DD')`.
- Sin endpoint de borrado ni nada de «Enviar recordatorio».
- Pruebas: clientes `zz_test_`, correos `@ejemplo.com`; 0 filas `zz_test_%` al terminar.

---

## Reporte del implementer

1. Rebanada completada: sí, sin commit; navegador a cargo del orquestador.
2. Archivos modificados: backend `rutas/clientes.mjs` (`rutaConsultarCliente`, `rutaEditarCliente`), `clientes.test.mjs`, `documentoRoutes.js` (GET y PATCH `/clientes/:id`), `autorizacionMatriz.test.js`; frontend `servicios/api.js` (`obtenerExpedienteCliente`, `editarClienteDocumento`), `ExpedienteClienteDialog.vue` + `.test.js` (nuevos), `NuevoClienteDialog.vue` (prop `cliente`) + `NuevoClienteDialog.test.js` (nuevo), `ClientesPage.vue`, `ClientesPage.rebanada2.test.js`.
3. Prueba en rojo y por qué falló: `clientes.test.mjs` por exportaciones inexistentes; pruebas de los diálogos por asertos (componente inexistente, sin modo edición). Las filas de la matriz se agregaron junto con las rutas (sin rojo separado).
4. Puertas: backend `clientes.test.mjs` 24/24, `autorizacionMatriz` 39/39, `documentosModulo` 17/17, `verificarPruebas` 909/909 OK; frontend lint, prettier (archivos tocados), build y `node --test` 2222/2222 en verde. 0 filas `zz_test_%`.
5. Decisiones no cubiertas: `cliente.js` no tiene `patch`: se usa `peticion(url, { method: 'PATCH', body })`. Sin `activo` en el cuerpo se conserva; no booleano → 400. 404 `CLIENTE_NO_ENCONTRADO`. Sin cambios, «Guardar cambios» cierra sin enviar. El formulario de edición va anidado en el diálogo del expediente.
6. Para la memoria: GET/PATCH `/doc/clientes/:id`, «Ver expediente» abre `ExpedienteClienteDialog`, `NuevoClienteDialog` acepta `cliente` para editar.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: CAMBIOS NECESARIOS (puertas en verde; permisos, 404, 409, 400 y fechas comprobados contra el servidor real).

1. Media — `ExpedienteClienteDialog.vue:9`: `@show` llega tras la animación de 220 ms; al abrir el cliente B después del A se ven un instante los datos de A con «Editar» activo. Cargar en `@before-show` o vaciar el expediente al cerrar/cambiar `clienteId`.
2. Media — `ExpedienteClienteDialog.vue:229`: `max-height: 90vh` scoped gana a la regla de Quasar en `:maximized`; en móvil la ficha no ocupa la pantalla (criterio 11).
3. Baja — `NuevoClienteDialog.vue:440-445`: la validación no enfoca el primer campo con error (criterio 9; hueco que ya traía el alta).

Opcionales: el PATCH revalida el contador aunque no cambie (un cliente de «Mis actividades» con contador sin rol de documentos no se podría corregir; decide el usuario); `aTextoLocal` duplica `aFechaLocal` y da «1969-12-31» con fecha NULL; no hay prueba HTTP de permisos por rol de documentos para las rutas nuevas (`documentosModulo.test.js` fuera de la lista).

## Corrección (vuelta 2)

1. Expediente carga en `@before-show` y `vaciar()` limpia en `@hide` y al cambiar `clienteId`.
2. `max-height: 90vh` solo con la clase `expediente-dialog--ajustado` (no maximizado).
3. `enfocarPrimerError()` en alta y edición.
4. `aTextoLocal` devuelve `null` con NULL.
Rojo→verde: backend 24/25 → 25/25; frontend 3 pruebas nuevas. Puertas: backend por archivo y `verificarPruebas` OK; frontend lint, prettier, build y `node --test` 2225/2225.

## Veredicto del reviewer (vuelta 2)

VEREDICTO: CAMBIOS NECESARIOS. Correcciones 1, 2 y la fecha NULL del backend, bien; puertas en verde.

1. Media — `NuevoClienteDialog.vue:452`: `enfocarPrimerError()` busca `getElementById('doc-cliente-…')`, pero `QInput` pisa el `id` con su `targetUid` si no lleva la prop `for`; el foco no se mueve y los `label for` tampoco quedan unidos (ya pasaba en el alta). Usar `for="doc-cliente-…"` como `CaseFormDialog.vue`, o `ref` + `.focus()`.
2. Baja — `ExpedienteClienteDialog.vue:194`: `r.fechaRecepcion.slice(0, 10)` sin guarda; con `null` la ficha no se pinta.

## Prueba en navegador (orquestador, 2026-11-25)

Con `admin_seed`, en `delgrow_merge`. A 1440 px: la ficha de ACME muestra datos, «Sin capturar» y la recepción DCA-2026-0004 con su chip. Con un cliente `zz_test_`: «Editar» precarga, la clave repetida da «Ya existe un cliente registrado con esa clave de carpeta.», guardar clave/teléfono/inactivo actualiza la ficha, avisa «Cambios guardados» y lo saca de la lista. A 375 px: la ficha ocupa 375×812, sin desborde; «Editar» y «Cerrar» de 44 px; la «X» de cerrar mide 34 px. Cliente de prueba borrado (0 filas `zz_test_%`).
