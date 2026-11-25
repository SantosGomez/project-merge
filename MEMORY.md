# MEMORY.md — Seguimiento de Proyectos (unión con Recepción de documentos)

Memoria entre sesiones (máx. ~50 líneas). Las reglas fijas están en `AGENTS.md`; el plan y las decisiones de la unión, en `PLAN.md`; el detalle, en los commits y en `docs/rebanadas/`.

## Estado de la unión (2026-11-24)

- Repo `SantosGomez/project-merge`, rama `unificacion/fase-0`. Fases 0 a 4 hechas. La unión es una alpha: no se publica ni se usa Docker; todo en local (XAMPP). La fase 5 (publicar) queda en pausa. `main` = status-conta sin la unión.
- Un login (correo o `alias`), rol general + rol por módulo (`usuario_modulos`), selector `/modulos`. Backend de documentos en `/doc`, frontend en `src/modulos/documentos/`.
- Base de prueba: `delgrow_merge` en XAMPP (3306), rehecha el 2026-11-24 desde la base de prueba de status-conta (`delgrow_contadores`) + importación de `dca_documentos`; ya no tiene datos de producción (esa copia quedó en los respaldos, fuera del proyecto: `~/respaldos-seguimiento-proyectos/union-documentos-2026-11-24/`).
- Adjuntos y acuses (2026-11-25): `CARPETA_ADJUNTOS="../##RECEPCION DE PAPELERIA_CLIENTES"` en `Backend/.env` (antes caían en `Backend/storage` por faltar la variable); se movió ahí la recepción de prueba DCA-2026-0004. Pendiente: la ruta del servidor real cuando exista.
- Cuentas de prueba en `delgrow_merge`: `admin_seed@prueba.local` (documentos por su rol) y `contador_seed@prueba.local` (documentos como contador, dado a mano el 2026-11-24; se pierde si se rehace la base). El import omite las cuentas de prueba de documentos.
- Últimas cifras (tras traer status-conta): backend 906 de 906 en `verificarPruebas`; frontend 2118 de 2118, lint y build bien. `test/proximaJunta.test.js` viene sin formato desde status-conta.
- 2026-11-24: se trajeron los 8 commits de `status-conta/main` hasta 7b36df8 (rebanada 43 de juntas, cabecera y píldora elástica de «Mi Calendario»).
- 2026-11-25, rebanada 44 (commit 9ca6182, con push): Recepción exige y guarda `documentos.contador_id` (propone `clientes.usuario_id`); Direccionamiento lo muestra fijo y `POST /doc/documentos/:id/entrega` rechaza (400) otro contador; sin contador propio ni del cliente se elige. Aprobada por el reviewer; falta la prueba en navegador por rol.
- 2026-11-25, rebanada 45 (commit 9ca6182, con push): el mes del Dashboard de documentos se rige por `fecha_recepcion`, no por el periodo contable (antes un completado de otro periodo desaparecía y no contaba). El parámetro sigue llamándose `periodo`; backend y `resumenDocumentos.js` deben tener la misma regla. Aprobada; falta navegador.
- 2026-11-25, rebanada 46 (commit 5ec1eed, con push; probada en navegador con contador_seed): en el Dashboard de documentos hay una tarjeta por estado (Recepcionado, En proceso, Pendiente del cliente, Completado) que comparte `filtroEstado` con el selector «Estado» original; cifras con `contarPorEstado`, vencido con `esVencido` (`resumenDocumentos.js`); sin chip «Solo: …» ni tarjeta «Vencidos». El usuario rechazó meter vistas de tarjeta en el selector. Aprobada; falta navegador.
- 2026-11-25 (fuera de rebanada): se quitaron tooltips que repetían texto visible: 3 en `MaquetaLayout.vue` (título móvil y nombre del pie) y 2 en documentos `IndexPage.vue` (campo Cliente y selector Tipo). El resto de los 56 tooltips de documentos se conservó: botones de solo icono, texto recortado con «…» y ayuda de filtros. Actualizadas 5 pruebas (`layout-movil`, `layout-drawer-check` ×2, `miPerfil`, `IndexPage.test.js`). Frontend 2146/2146 y `lint:check` en verde; `prettier --check` en rojo solo por formato preexistente en los archivos de seguimiento.
- 2026-11-25, rebanada 47 (commit 2c07e9c, con push): Direccionamiento es una sola tabla con el toggle «Mostrar entregados» (apagado) y selector «Mes de entrega» (el usuario rechazó las pestañas); tarjetas y relación imprimible solo de lo pendiente; columnas ocultas por ancho (`ocultar-bajo-xl/-lg/-md`, `ocultar-en-xs`), Acciones siempre visible y sin desborde de 1440 a 320. `GET /doc/documentos/entregados?mes=` toma la entrega más reciente de `documento_historial` (RECEPCIONADO→EN_PROCESO) por mes de `created_at`. Aprobada; probada con Playwright y una cuenta admin `zz_test_` (la sesión `contador_seed` no ve Direccionamiento). `created_at` es TIMESTAMP (tope 2038) en pruebas.
- 2026-11-25, rebanada 48 (commit en esta rama, sin push): chips de estado y prioridad de documentos como píldoras claras (`estiloDeEstadoDocumento(...).chip`, `estiloDePrioridadDocumento(...).chip`, clases `chip-doc--*` en `documentos.scss`); URGENTE sólido; `fondo` solo para puntos. Causa: `$info` y `$positive` se oscurecieron y el texto marino quedaba en 2.1–2.5:1. `IndexPage.vue` aún tiene su propio `getPrioridadFondo` para los puntos.
- 2026-11-25, rebanada 49 (sin commit): firmas de Recepción con `ResizeObserver` + `devicePixelRatio` + eventos pointer (`composables/lienzoFirma.js`; trazos guardados en px CSS y repintados al redimensionar; antes a 375 px el trazo quedaba ~10 % desplazado); «Limpiar» de firma a 44 px; tras registrar se limpia siempre (también con adjuntos >25 MB descartados) e incluye observaciones; se conservan empresa, cliente, tipo, periodo, prioridad y vía. Aprobada y probada en navegador (sin registrar un documento real). Opcional pendiente: ignorar el segundo dedo (`isPrimary`). Resto de la revisión UI/UX de Recepción (textos, orden firmas al final, `SeccionAnimada` de 1 s) sin aplicar.
- 2026-11-24: `AGENTS.md` y esta memoria se reescribieron para el proyecto unido (antes eran los de status-conta).

## Pendientes de la unión

- Documentos: firmas en el lienzo probadas en navegador el 2026-11-25 (rebanada 49); falta un registro completo de punta a punta (aviso «Acceso denegado», rol en dock/menú y `no-results-label` en accesos ya resueltos el 2026-11-24).
- Límite de intentos del login cuenta por separado correo y alias de una misma persona (menor).
- Por decidir: ¿`casos` se liga a `clientes.id` o sigue con el cliente como texto? Llave `clientes → usuarios` en cascada: pasar a `SET NULL`.
- `.claude/launch.json` ya no usa el script temporal (2026-11-24): `merge-backend` en 3001 y `merge-frontend` en 9001 (los puertos del `Backend/.env`), con `cmd /c`; AGENTS.md ya lo dice. Sin `API_URL`, el frontend llama a `http://localhost:3001` (`api.js`, 2026-11-25): con 3000 chocaba con el backend de status-conta y daba error de CORS.
- `PRODUCT.md` y `docs/constitution.md` describen solo status-conta.

## Producción (Docker de status-conta)

- Corre `main` c4e9377 de status-conta (despliegue 2026-11-24): calendario y rebanadas 20 a 43, sin la unión; «Mis actividades» restringido (`USUARIOS_CON_ACTIVIDADES=7917`). Para regresar: imágenes `:antes-calendario-2026-11-24` + respaldo cifrado del mismo día.
- Ya revisado en Docker (2026-11-24): el 7947 es administrador y ningún auxiliar apoya a varios contadores. Falta validar la regla fiscal con los contadores.
- Pendiente en producción: restablecer desde la app las contraseñas de las cuentas reales (≥12) y corregir las auditorías migradas con «Periodo por confirmar».

## Pendientes de seguimiento (status-conta)

- Avisos por correo (24): esperan nodemailer y una cuenta SMTP. Web Push con la app cerrada: requiere aprobación (`web-push`, VAPID, tabla).
- «Mis actividades»: los «para decidir» de `17-revision-ui-actividades.md` y la regla fiscal.
- Opcionales sin aplicar en `docs/rebanadas/NN-*.md` (en especial 29 a 33); tras un fallo inicial, las recargas en silencio no limpian el error (`cases.refrescarEnSilencio`, auditorías, «Mi perfil»).
- «Mi perfil»: revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor.
- Copiar una cifra del odómetro (`ContadorRodante.vue`) copia los dígitos ocultos: por decidir.
- `prettier --check` falla en ~180 archivos del frontend: decidir si se formatea todo en un commit aparte.
- Requieren aprobación (estructura): índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías.
- Dudoso: `usuarios_de_sistema` puede crear/promover administradores; `GET /eventos` no revisa la sesión al canjear el pase.

## Pendientes de documentos (traídos de Proyecto-documentos)

- En espera de definición: relación muchos a muchos contador-cliente; tabla real de «tipos de recepción» con plantilla por cliente (el autollenado es maqueta); matriz y pantalla de documentos requeridos por cliente.
- Deuda: el color por prioridad está duplicado en `IndexPage` y `DireccionamientoPage`.

## Errores a evitar

- Revisar las cifras, los diffs y la codificación del trabajo de otro agente (un `.vue` en Windows-1252 compila con el texto roto; cargar SQL con `--default-character-set=utf8mb4`).
- Un oráculo sobre la plantilla no prueba que el permiso exista: comprobar en el navegador con cada rol.
- Guardia de rutas: `useQuasar()` no funciona ahí; cada redirección lleva `return`; el permiso va en cada ruta hija.

---

Nada sensible en esta memoria.
