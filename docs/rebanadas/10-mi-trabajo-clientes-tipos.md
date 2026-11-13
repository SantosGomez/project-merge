# 10 — «Mi trabajo» con pestañas, clientes y tipos de actividad propios

- **Riesgo:** alto (esquema nuevo en la base)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, modelo según cuota)
- **Estado:** refinada (rama `experimento`; plan completo en `mi-trabajo-actividades-propuesta.md`)

## Historia

Como contador o auxiliar, quiero tener mis propios clientes y mis propios tipos de actividad dentro de «Mi trabajo > Mis actividades», para dejar listo el catálogo con el que registraré mis actividades mensuales.

## Criterios de aceptación

1. El ítem del menú de contador y auxiliar dice **«Mi trabajo»** (antes «Mis casos»). La ruta `mis-casos` y el título de ruta no cambian.
2. La página de esa ruta muestra `q-tabs` con **«Mis casos»** (el contenido actual, sin cambios) y **«Mis actividades»**. La pestaña activa va en `?tab=actividades` (misma convención que `?tab=equipo`); sin parámetro, «Mis casos».
3. «Mis actividades» tiene dos secciones: **«Mis clientes»** y **«Mis tipos de actividad»**. Cada una lista lo propio (activos primero), permite **agregar**, **editar** y **desactivar/reactivar**. No se borra.
4. Cliente: `nombre` obligatorio (hasta 150), `rfc` opcional (12 o 13 caracteres con la forma de un RFC, en mayúsculas). Tipo: `nombre` obligatorio (hasta 120) y `cobrable` (interruptor, por defecto no).
5. Nombre repetido entre los del mismo usuario (sin distinguir mayúsculas ni acentos) se rechaza con 409; dos usuarios distintos sí pueden tener el mismo nombre.
6. Cada usuario solo ve y modifica lo suyo; intentar editar el cliente o el tipo de otro da 404. Solo roles `contador` y `auxiliar` (administrador y usuarios de sistema reciben 403).
7. Tablas nuevas `clientes` y `tipos_actividad` creadas por el seed de forma idempotente (`CREATE TABLE IF NOT EXISTS`, `usuario_id` con FK a `usuarios(id)` ON DELETE CASCADE, único `(usuario_id, nombre)`). Campos de `clientes`: `id`, `usuario_id`, `nombre`, `rfc` NULL, `activo`, `creado_en`. Campos de `tipos_actividad`: `id`, `usuario_id`, `nombre`, `cobrable`, `activo`, `creado_en`. No se agregan más campos.
8. Endpoints `GET/POST /clientes`, `PATCH /clientes/:id`, `GET/POST /tipos-actividad`, `PATCH /tipos-actividad/:id`, con respuestas JSON consistentes y errores en tres partes en tú.
9. Textos en español y en tú, con tooltips de contexto, estados vacío/carga/error con «Reintentar», diálogos con las convenciones del proyecto (`hayDatosSinGuardar`, `:persistent`, `@shake`, `erroresCampo`, `enfocarPrimerError`), Quasar y paleta `dg-*`, responsivo (incluida la vista móvil).

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/seed.js` (solo agregar la migración de las dos tablas y llamarla donde se llaman las demás)
- `src/models/ClienteModel.js`, `src/models/TipoActividadModel.js` (nuevos)
- `src/controllers/ClienteController.js`, `src/controllers/TipoActividadController.js` (nuevos)
- `src/routes/clienteRoutes.js`, `src/routes/tipoActividadRoutes.js` (nuevos)
- `src/app.js` (solo montar las dos rutas)
- `test/clientes.test.js`, `test/tiposActividad.test.js` (nuevos), y `soporte-pruebas/bd.js` solo si hace falta limpiar `zz_test_` de las tablas nuevas

Frontend (`Seguimiento-proyectos/`):
- `src/layouts/MaquetaLayout.vue` (solo la etiqueta del ítem)
- `src/pages/MyCasesPage.vue` (envolver en `q-tabs`; el contenido actual no se modifica)
- `src/pages/MisActividadesPage.vue` o componentes `src/components/MisClientes.vue`, `MisTiposActividad.vue`, `ClienteFormDialog.vue`, `TipoActividadFormDialog.vue` (nuevos)
- `src/services/clienteService.js`, `src/services/tipoActividadService.js` (nuevos)
- `src/stores/` solo si hace falta un store nuevo (`actividades.js`)
- `src/utils/` solo para validadores nuevos (p. ej. `validarCliente`)
- pruebas nuevas en `test/` y los ajustes **mínimos** a pruebas existentes que afirmen el texto «Mis casos» del menú

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-13): tipos y clientes propios de cada contador/auxiliar; auxiliares incluidos; sin liga con casos; vencimientos y calendario vienen en rebanadas 2 y 3; tarifa por hora después.
- Fuera de esta rebanada: regla de vencimiento, cartera por tipo, lista del mes, calendario, cronómetro, jornada, informes, sugerir clientes desde `casos.cliente`, cambiar la ruta.
- El menú de contador y auxiliar es el mismo ítem: verificar ambos roles.
- Trampas: `session.id` es texto (comparar con `Number`); varios `.vue` usan CRLF (editar con Edit); los tooltips no van en el menú lateral; colores solo de la paleta; `--dg-curva-salida` y no `cubic-bezier` suelto.
- Pruebas del backend por archivo (todas juntas se cuelgan). Cuentas de prueba `zz_test_`; al terminar 0 filas `zz_test_%` en XAMPP.

---

## Reporte del implementer

1. Rebanada completada: criterios 1 a 9 implementados (2026-11-13), sin commit.
2. Archivos modificados: backend `seed.js` (migración `migrarClientesYTiposActividad`), `app.js` y nuevos modelos, controladores, rutas y pruebas de Cliente y TipoActividad. Frontend `MaquetaLayout.vue` (etiqueta y `aria-label`), `MyCasesPage.vue` (pestañas), `test/layout-drawer-check.js` (una línea) y nuevos `MisActividades.vue`, `MisClientes.vue`, `MisTiposActividad.vue`, `ClienteFormDialog.vue`, `TipoActividadFormDialog.vue`, `clienteService.js`, `tipoActividadService.js`, `utils/actividades.js`, `test/misActividades.test.js`. Sin store; `soporte-pruebas/bd.js` sin tocar (la cascada limpia).
3. Prueba en rojo y por qué falló: backend, tabla `clientes` inexistente y rutas en 404; frontend, `ERR_MODULE_NOT_FOUND` de `clienteService.js`.
4. Puertas: backend por archivo en verde (`clientes` 13, `tiposActividad` 9, `seed` 26, `userRoutes` 15); `verificarPruebas.js` en FALLA por `MINIMOS` desactualizado (no autorizado a editarlo); frontend lint, build y `node --test` (1184/1184) en verde; navegador con Playwright: contador en escritorio y auxiliar en móvil. Sin ver en navegador: edición, error con «Reintentar» y animaciones.
5. Decisiones no cubiertas: respuestas `{ clientes }`, `{ cliente }`, `{ tipos }`, `{ tipo }`; PATCH parcial (cuerpo vacío o id inválido 400, ajeno 404); RFC en mayúsculas, vacío = null; duplicado por colación `_ci` + único → 409; 403 reutiliza `requireContadorOAuxiliar` («para trabajar casos»); `aria-label` «Ir a mi trabajo»; `?tab=casos|actividades` conserva los demás parámetros; desactivar/reactivar sin confirmación.
6. Para la memoria: ver MEMORY.md (pendientes de decidir y trampa del `flex` en móvil).

## Veredicto del reviewer (vuelta 1)

**APROBADO** (reviewer con Opus, 2026-11-13, sin modificar archivos). Los 9 criterios se cumplen; pruebas de backend 13/13 y 9/9, frontend 1184/1184 y lint en verde; esquema comprobado con `SHOW CREATE TABLE`; en navegador probó alta, RFC inválido, 409, «¿Descartar los cambios?», cobrable, desactivar/reactivar y móvil (375 px) con contador y auxiliar. No corrió `npm run build` ni `verificarPruebas.js`.

Opcionales (no bloquean, requieren decisión del usuario): el ítem «Mi trabajo» se llama igual que su sección del menú y su subtítulo no menciona actividades; «Solo tú los ves» → «las ves» en `MisTiposActividad.vue`; mensaje de aserción «falta aria-label mis casos» en `layout-drawer-check.js`; 403 «para trabajar casos»; el tooltip de los `q-input` tapa un momento la ayuda (patrón actual del proyecto); orden local vs. servidor difiere solo con Ñ.
