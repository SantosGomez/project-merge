# 52b — Ajustes fuera de seguimiento, desde el selector de módulos

- **Riesgo:** alto (cambia a dónde llega cada persona al iniciar sesión, la regla de «un solo módulo entra directo» y los permisos de pantallas)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada con dos vueltas de revisión (Opus) y correcciones aplicadas; sin commit

## Historia

Como administrador, usuario de sistemas o recepcionista, quiero entrar a «Ajustes» desde el selector de módulos, como una pantalla propia fuera de Seguimiento y de Documentos, porque clientes y usuarios son un catálogo compartido por los dos módulos.

## Decisiones del usuario (2026-11-26)

- Ajustes es **un botón del selector `/modulos`**, no una tarjeta de módulo (la tarjeta sugiere otro sistema). El texto «Ajustes» debe verse siempre, no solo al pasar el mouse, y lleva tooltip «Usuarios y clientes del despacho».
- Ajustes **no lleva dock ni menú de módulo**: es solo configuración. Encabezado propio y botón «Volver a módulos».
- Lo ven **los tres roles** (administrador, sistemas, recepcionista), con los permisos de la rebanada 52: «Clientes» solo administrador y sistemas; «Usuarios» los tres.
- **Todos pasan por `/modulos` al iniciar sesión**, sin importar cuántos módulos tengan. Se pueden ver las tarjetas de los dos módulos; al elegir uno sin permiso se muestra un aviso («No tienes acceso a este módulo») y no se entra.
- El «Directorio» de seguimiento **sigue, pero solo para la recepcionista** (le ayuda a agendar juntas). El administrador y sistemas entran a esos datos por Ajustes.
- Fuera de esta rebanada (propuesta aparte): modal con el directorio dentro del calendario.

## Criterios de aceptación

1. `/ajustes` es una ruta de nivel superior (como `/modulos`), con un layout propio y mínimo (`AjustesLayout.vue`), sin `MaquetaLayout` ni dock. Mantiene las pestañas, la tabla de clientes y el endpoint `GET /ajustes/clientes` de la 52, sin cambios de comportamiento ni de permisos.
2. Encabezado de Ajustes con el título y un botón «Volver a módulos» (a `/modulos`). El foco inicial y el orden de tabulación son lógicos. Responsiva de 1440 a 320 sin desborde.
3. En `/modulos`, el botón «Ajustes» (el que el usuario ya empezó en `ModulosPage.vue`, sin definir `abrirAjustes` ni cerrar bien el CSS) queda terminado: aparece solo a los tres roles, muestra siempre su texto, lleva `q-tooltip` y `aria-label`, y abre `/ajustes`. Se corrige la coma que falta en el selector CSS de `prefers-reduced-motion`. Se conserva el trabajo del usuario en ese archivo: se completa, no se reescribe.
4. Cualquier persona con sesión llega a `/modulos` al entrar (`destinoTrasEntrar`), incluida quien tiene un solo módulo. La regla de `AGENTS.md` ya la actualizó el orquestador con aprobación del usuario; el implementer no toca ese archivo.
5. Las tarjetas de módulo se muestran siempre. La de un módulo sin permiso se ve apagada (`aria-disabled`, sigue enfocable); al pulsarla sale un `$q.notify` de aviso «No tienes acceso a {módulo}. Pide a un administrador que te lo asigne.» (tres partes: qué pasó, por qué, qué hacer) y no navega. Las de módulos con permiso funcionan como hoy.
6. Menú de seguimiento: se quita «Ajustes» del dock y del menú lateral. «Directorio» vuelve **solo para la recepcionista** (subtítulo «Consultar cuentas del equipo», icono `group`, tooltip y `aria-label` en el dock; sin tooltip en el lateral; las dos plantillas coinciden). Administrador y sistemas ya no lo ven.
7. `admin/directorio` vuelve a mostrar el directorio a la recepcionista (como antes de la 52). Para administrador y sistemas redirige a `/ajustes?tab=usuarios`, de modo que no se rompe ningún enlace guardado. El botón «Ver directorio» del dashboard del administrador y los `volverA` que apuntan a Ajustes siguen funcionando.
8. **Sistemas (por confirmar con el usuario):** su única pantalla en seguimiento era el directorio, que ahora vive en Ajustes. Propuesta: para sistemas la tarjeta «Seguimiento» se muestra sin acceso (criterio 5) y Ajustes es su pantalla de trabajo; `RUTA_PRINCIPAL_POR_ROL.usuarios_de_sistema` deja de apuntar al directorio.
9. Pruebas actualizadas: `destinoTrasEntrar`, el selector (botón visible por rol, tarjetas sin permiso y aviso), el router (rutas y redirecciones por rol), los menús y las pruebas que la 52 cambió de «Directorio» a «Ajustes». Ningún aserto relajado. Una prueba nueva garantiza que contador y auxiliar no ven el botón «Ajustes» y reciben el bloqueo de ruta si abren `/ajustes`.
10. Textos en español y en tú; colores de `$dg-colores`; movimiento: `.boton-presionable`, sin `transition: all`, `prefers-reduced-motion` respetado, sin animar acciones de teclado.
11. Puertas: `node --test` y `lint:check`, `build` y comprobación en navegador real (administrador, sistemas, recepcionista, contador, y un usuario de documentos) en escritorio y móvil, con datos `zz_test_` y 0 filas al terminar.

12. **«Cambiar de módulo» para todos (decisión del usuario, 2026-11-26):** como todos pasan por `/modulos`, el logo del dock y el menú lateral llevan al selector aunque la cuenta tenga un solo módulo (hoy dependen de `session.variosModulos` en `MaquetaLayout.vue`, líneas ~49, 86-87 y 525). El menú de documentos queda igual. Se actualizan las pruebas que cubran eso.
13. **«Acceso al módulo» pasa a Ajustes (decisión del usuario, 2026-11-26):** nueva pestaña «Acceso a módulos» (`?tab=accesos`) en Ajustes, junto a «Usuarios». Reutiliza la pantalla actual `modulos/documentos/pages/AccesoDocumentosPage.vue` sin cambiar su lógica ni el backend (`GET /doc/usuarios`, `PUT /doc/usuarios/:id/rol`). La ve quien tenga en documentos el permiso `administrar_usuarios` (`hayAccesoDocumentos(session.rolDocumentos, 'administrar_usuarios')`: Administrador y Sistemas); a los demás no se les muestra la pestaña y `?tab=accesos` cae en «Usuarios». Se quita «Acceso al módulo» del menú de documentos (dock y lateral, las dos plantillas) y `/documentos/accesos` redirige a `/ajustes?tab=accesos`. Sin ese permiso, la redirección termina en la pestaña «Usuarios». Los estilos de documentos tienen alcance propio (`documentos.scss`): comprobar que la pantalla se ve bien fuera del layout de documentos, en escritorio y móvil.

## Archivos autorizados

Frontend (`Seguimiento-proyectos/src/`):
- `pages/ModulosPage.vue`, `pages/AjustesPage.vue`, `layouts/AjustesLayout.vue` (nuevo)
- `router/index.js`, `utils/modulos.js`, `utils/constants.js` (solo la ruta principal de sistemas), `stores/session.js` (solo lo necesario para el destino al entrar)
- `layouts/MaquetaLayout.vue` (dock y menú lateral), `pages/AdminDashboardPage.vue` (solo el enlace)
- `modulos/documentos/pages/AccesoDocumentosPage.vue` solo si hace falta quitarle el `q-page` o el encabezado propio al montarlo como pestaña (avisar antes), y sus pruebas.
- `components/AccessDenied.vue` solo si hace falta para el aviso de módulo sin acceso; avisar antes.
- Pruebas del frontend que cubran los puntos anteriores.

No se toca el backend ni el esquema. No se edita `AGENTS.md` ni `MEMORY.md` (lo hace el orquestador).

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Trampa: `RUTA_PRINCIPAL_POR_ROL` y `destinoTrasEntrar` se usan en el login y al restaurar la sesión (`stores/session.js`); probar las dos entradas.
- Trampa: `CountersDirectoryPage` usa `q-page`, que necesita un `q-layout` padre; `AjustesLayout` debe dárselo.
- Trampa: el árbol del frontend está en CRLF; comparar `prettier` contra el contenido LF.
- Por confirmar: el criterio 8 (sistemas) y que «todos pasan por `/modulos`» incluye a contador y auxiliar.

---

## Reporte del implementer

1. Rebanada completada: sí, los 11 criterios, con la propuesta de Sistemas del criterio 8. `/ajustes` de nivel superior con `AjustesLayout.vue` (sin dock ni menú; encabezado «Ajustes» y «Volver a módulos»); `destinoTrasEntrar` devuelve siempre `/modulos`; el selector muestra siempre las dos tarjetas y la que no tiene acceso se ve apagada (`<button aria-disabled>`, «Sin acceso» con candado) y al pulsarla sale un `$q.notify` sin navegar; botón «Ajustes» solo para administrador, sistemas y recepcionista, con texto siempre visible y tooltip; «Ajustes» fuera del dock y del menú lateral; «Directorio» solo para la recepcionista; `admin/directorio` redirige (`beforeEnter`) a `/ajustes?tab=usuarios` para administrador y sistemas; `RUTA_PRINCIPAL_POR_ROL.usuarios_de_sistema` = `/ajustes`; tarjeta «Seguimiento» de Sistemas sin acceso (`tieneAccesoSeguimiento`).
2. Archivos modificados (bajo `Seguimiento-proyectos/`): nuevos `src/layouts/AjustesLayout.vue`, `test/selectorModulos.test.js`; editados `src/pages/ModulosPage.vue`, `src/router/index.js`, `src/utils/modulos.js` (`puedeAbrirAjustes`, `tieneAccesoSeguimiento`, `mensajeSinAccesoModulo`), `src/utils/constants.js`, `src/layouts/MaquetaLayout.vue`; pruebas editadas `ajustes`, `modulosUnion`, `sessionStore`, `accessRules`, `juntasPantalla`, `layout-drawer-check`, `directorioUsuarios`, `rolRecepcionista`. No se tocaron `session.js`, `AdminDashboardPage.vue`, `AccessDenied.vue` ni `AjustesPage.vue`. Backend sin tocar.
3. Prueba en rojo y por qué falló: `modulosUnion` por importar funciones que no existían; 6 pruebas de `sessionStore` esperaban la pantalla del rol al entrar (se actualizaron a `/modulos`, cambio pedido); `ajustes` y `selectorModulos` fallaron por aserto (faltaban layout, botón, tarjetas sin acceso y `beforeEnter`); 9 pruebas de menú de la 52 se reescribieron para exigir «Directorio» solo en la recepcionista.
4. Puertas: `node --test` 2249/2249; `lint:check` y `build` verdes; `prettier` contra LF verde en lo nuevo y en `ModulosPage`, `modulos.js`, `constants.js` (los demás ya fallaban en HEAD por CRLF); navegador (3001/9001 del usuario, escritorio y 375 px, sin desborde): administrador, sistemas, recepcionista, contador y auxiliar con documentos «Practicante» probados; `/ajustes` medido a 1440, 375 y 320; `prefers-reduced-motion` solo por lectura de CSS; 0 filas `zz_test_%`.
5. Decisiones no cubiertas: el CSS del botón «Ajustes» usaba `--dg-primary` y `--dg-texto-oscuro` (no existen); se reescribió como píldora siempre expandida con `var(--q-primary)` y `--dg-texto-claro`, quitando la expansión al pasar el mouse; se quitó la sección «Usuarios» vacía de Sistemas en dock y menú lateral; sin lista de módulos (sesión vieja) la tarjeta «Seguimiento» cuenta con acceso; `admin/directorio` ya no lleva `volverA`. **Pendiente del usuario:** tras crear la contraseña propia (`crearContrasenaPropia` y el guard de `cambiar-contrasena`) se sigue yendo a la pantalla principal del rol y no a `/modulos`. Observado una vez, sin repetirse: tras «Acceso denegado» de Sistemas en `/juntas`, un `navigate` a `#/modulos` terminó en `/juntas?vista=…`. A 320 px un nombre muy largo recorta el saludo del selector (estilo previo).
6. Para la memoria: todas las cuentas entran por `/modulos`; Ajustes es un botón del selector con layout propio; «Directorio» de seguimiento solo de la recepcionista; Sistemas trabaja en Ajustes. Trampas: `--dg-primary` y `--dg-texto-oscuro` no existen en la paleta; los `.vue` y varios tests están en CRLF (usar Write o Edit, no heredocs de bash).

## Veredicto del reviewer (vuelta 1)

VEREDICTO: CAMBIOS NECESARIOS (Opus). Puertas en verde: `node --test` 2249/2249, `lint:check` y `build` OK, backend `ajustes` + `autorizacionMatriz` 43/43.

Cambios necesarios:
1. `ModulosPage.vue:149-150` (y :24-27), gravedad media: `tieneAccesoSeguimiento([], null)` devuelve `true`; al cerrar sesión `rol` y `modulos` se vacían antes del `router.replace`, la tarjeta de Seguimiento se pinta como `RouterLink` con `to=undefined` y vue-router avisa `VUE_ROUTER_R0005` (en producción lanzaría `TypeError`). Se espera: acceso solo si además hay destino (`Boolean(destino) && ...`) y prueba (sin rol o rol sin pantalla → sin acceso).
2. `stores/session.js:420` (`crearContrasenaPropia`), gravedad baja: tras crear la contraseña propia va a la pantalla del rol y se salta `/modulos`; contradice el criterio 4. Se espera devolver `RUTA_SELECTOR_MODULOS` y actualizar la prueba de `sessionStore`.

Revisado y correcto: entradas (login, restaurar sesión, redirecciones de `admin/directorio` y `usuarios/alta`), permisos por rol, menús coincidentes, pruebas sin asertos relajados, CSS sin hexadecimales ni `transition: all`.

Opcionales (no bloquean): el aviso «Puedes cambiar de área desde el menú» no es cierto para quien tiene un solo módulo (el logo solo vuelve al selector si hay más de uno, `MaquetaLayout.vue:49`); `/ajustes` sin `meta.comun: true`; tarjeta sin acceso como `<button>` con `div` dentro; dos reglas `.modulo-tarjeta` seguidas; `volverA: 'ajustes'` sin lector.

Aparte (ya existía antes de la rebanada): carrera en el router tras un «Acceso denegado» (`router/index.js:296`, `JuntasPage.vue:596-597`) que puede dejar a Sistemas en `/juntas`. Va en una rebanada aparte.

No verificado: Sistemas, recepcionista, auxiliar y solo-documentos en el navegador (sin contraseñas de prueba); la tarjeta apagada y su aviso en vivo; `prefers-reduced-motion` en vivo; `scrollWidth - clientWidth`; `/ajustes` a 1024 y 375.

## Corrección del implementer (vuelta 2)

- `utils/modulos.js`: `tieneAccesoSeguimiento` exige además un rol con pantalla en `RUTA_PRINCIPAL_POR_ROL`; sin rol o con un rol sin pantalla la tarjeta no tiene acceso y no se pinta como `RouterLink` con destino indefinido.
- `stores/session.js`: `crearContrasenaPropia` devuelve `RUTA_SELECTOR_MODULOS` (todas las cuentas pasan por el selector). El guard de `cambiar-contrasena` no cambió.
- Pruebas: `modulosUnion` (sin rol y rol sin pantalla → sin acceso) y `sessionStore` (`/modulos`), ambas en rojo antes del cambio. `node --test` 2249/2249, `lint:check` y `build` verdes; en navegador, cerrar sesión desde `/modulos` ya no genera `VUE_ROUTER_R0005`. 0 filas `zz_test_%`.
- Revisado por el orquestador contra el diff de `modulos.js` y `session.js`. No se repitió la revisión de Opus.

## Ampliación del implementer (criterios 12 y 13)

- **12:** el logo del dock y el del menú lateral llevan siempre a `/modulos` (sin `variosModulos`, `aria-disabled` ni `tabindex` condicionales). El menú de documentos queda igual.
- **13:** pestaña «Acceso a módulos» (`?tab=accesos`, icono `admin_panel_settings`, con tooltip) en Ajustes, que monta `AccesoDocumentosPage.vue` sin cambios; visible solo con `hayAccesoDocumentos(session.rolDocumentos, 'administrar_usuarios')`, si no `?tab=accesos` cae en «Usuarios». «Acceso al módulo» sale de `opcionesDocumentos` (dock y menú lateral a la vez); `/documentos/accesos` redirige a `/ajustes?tab=accesos`.
- Archivos: `layouts/MaquetaLayout.vue`, `router/index.js`, `pages/AjustesPage.vue`; pruebas `ajustes`, `modulosUnion` (se quitó la fila `doc-accesos`, sustituida por la prueba de redirección), `layout-drawer-check`, `revisionEstructura`. No se tocó `AccesoDocumentosPage.vue`, backend ni `modulos.js`.
- Puertas: `node --test` 2253/2253, `lint:check` y `build` verdes; navegador (administrador y Sistemas en documentos): tres pestañas, redirección correcta, sin desborde de página a 375 px; no se probó el dock de escritorio con el logo (cubierto por pruebas estáticas); 0 filas `zz_test_%`.
- Pendiente de autorización (requiere tocar `AccesoDocumentosPage.vue`): a 375 px su tabla tiene scroll interno propio (`.q-table__middle` 946/309), lo que incumple la regla de tablas de AGENTS; y la pantalla trae su propio `q-page` y un `h1` «Acceso al módulo» que duplica el título de la pestaña.

## Ajuste de AccesoDocumentosPage (autorizado por el usuario)

- `AccesoDocumentosPage.vue`: raíz de `<q-page>` a `<section class="acceso-page" aria-label="Acceso a módulos">`; se quitó el `h1` «Acceso al módulo» y su relleno; el párrafo de ayuda ahora remite a la pestaña «Usuarios» de Ajustes. Tabla: «Correo» oculto bajo 600 px y «Usuario» bajo 1024 px, nombre y correo con `ellipsis` y `q-tooltip` (correo bajo el nombre en celular), columna del rol siempre visible, `min-width` del selector 140 px (110 px bajo 360 px), `no-data-label` y `no-results-label` conservados. Lógica, permisos y backend sin cambios.
- Pruebas: dos nuevas en `test/ajustes.test.js` (en rojo antes) y se reemplazó el aserto del `<q-page>`. `node --test` 2254/2254, `lint:check` y `build` verdes; `scrollWidth - clientWidth` = 0 a 1440, 1024, 768, 375 y 320 (a 320 daba 22 y se corrigió con `@media (max-width: 359px)`); 0 filas `zz_test_%`.

## Veredicto del reviewer (vuelta 2, revisión final, Opus)

VEREDICTO: CAMBIOS NECESARIOS (dos fallos chicos). Puertas en verde: `node --test` 2254/2254, `lint:check` y `build` OK, backend `ajustes` + `autorizacionMatriz` 43/43. Las dos correcciones de la vuelta 1 y los criterios 12 y 13 verificados en navegador con cuentas `zz_test_52b_*` (administrador, Sistemas, recepcionista, contador, auxiliar y solo-documentos) de 320 a 1440 px.

Cambios necesarios:
1. `ModulosPage.vue:557` y `:293`, media: `outline: 3px solid var(--dg-anillo-foco)` no se pinta porque esa variable es una sombra y no un color; el foco con Tab no se ve en la tarjeta sin acceso ni en el botón «Ajustes». Usar un color de la paleta o `box-shadow: var(--dg-anillo-foco)`.
2. `AccesoDocumentosPage.vue:124` y `:220`, media-baja: entre ~600 y ~690 px la columna del rol queda cortada y la tabla tiene scroll propio (el implementer midió 1440, 1024, 768, 375 y 320). Medir también 600, 640 y 700.

Opcionales (no bloquean): cuentas de contador o auxiliar con rol Administrador o Sistemas en documentos pierden la pantalla de accesos porque `/ajustes` solo admite administrador, sistemas y recepcionista (hoy 0 cuentas así; decide el usuario); el aviso de módulo sin acceso no es exacto para Sistemas (`utils/modulos.js:117`); `/ajustes` sin `meta.comun`; `session.variosModulos` sin uso; etiqueta «Fijar menú abierto» del logo en celular (`MaquetaLayout.vue:84`); títulos de `sessionStore.test.js` desactualizados; `directorioUsuarios.test.js` y `layout-drawer-check.js` suman diferencias de prettier en archivos que ya fallaban; columna Acciones del directorio cortada a 644 px (de antes).

Para el orquestador: `AGENTS.md:163` aún dice que «Acceso al módulo» vive en `/documentos/accesos` y que las cuentas se crean en el «Directorio de seguimiento».

No verificado: crear contraseña propia en vivo (solo por prueba), `prefers-reduced-motion` en vivo, medición numérica de desborde, el anillo de foco (no se ve por el fallo 1).

## Corrección final del implementer (vuelta 2 de revisión)

- Foco: `.modulo-tarjeta:focus-visible` y `.boton-ajustes:focus-visible` usan `outline: 3px solid var(--dg-foco)` (`--dg-anillo-foco` es una sombra); en el botón con `!important` porque `app.scss` trae un contorno global de `.q-btn` con `!important`.
- Tabla de accesos: «Correo» y «Usuario» ocultos bajo 1024 px (el correo se ve bajo el nombre hasta ahí); `scrollWidth - clientWidth` = 0 a 1440, 1024, 768, 700, 644, 620, 600, 375 y 320.
- `mensajeSinAccesoModulo`: «No tienes acceso a {módulo}. Tu cuenta no tiene permiso para entrar ahí: pide a un administrador que te lo asigne.» Títulos de pruebas de `sessionStore` corregidos.
- Verificado por el orquestador: `node --test` del frontend 2254/2254. No se pidió una tercera vuelta; quedan los opcionales del reviewer (cuentas de contador/auxiliar con rol Administrador en documentos, `meta.comun` de `/ajustes`, `session.variosModulos` sin uso, etiqueta «Fijar menú abierto» en celular).

## Restauración del estilo del botón «Ajustes» (a petición del usuario)

- El criterio 3 («texto siempre visible») era una propuesta del orquestador, no una decisión del usuario, y el implementer reescribió el CSS del botón. Se restauró el estilo original del usuario: círculo de 45 px que se expande a 168 px al pasar el mouse (mismo mecanismo que «Cerrar sesión»), con el texto visible en pantallas táctiles (`hover: none`).
- Se conserva la función (`abrirAjustes`, `v-if="veAjustes"`), el tooltip «Usuarios y clientes del despacho», el anillo de foco (`--dg-foco`) y `prefers-reduced-motion`. Colores de la paleta: `--q-primary` y `--dg-acento` al pasar el mouse (las variables `--dg-primary` y `--dg-texto-oscuro` no existen). Se quitó `boton-presionable` para conservar el efecto de pulsar original.
- Prueba reemplazada en `test/selectorModulos.test.js` (en rojo antes del cambio). Probado en navegador con una cuenta `zz_test_` (se expande, tooltip, abre `/ajustes`); 0 filas `zz_test_%` al terminar.
