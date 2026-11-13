# 11 — Cartera por tipo y lista del mes

- **Riesgo:** alto (esquema nuevo en la base)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** refinada, **pendiente de aprobación del usuario** (rama `experimento`; plan en `mi-trabajo-actividades-propuesta.md`)

La rebanada 2 del plan se parte en dos para que cada una sea chica: esta (cartera y lista del mes, sin fechas) y la 12 (vencimientos: regla por tipo, días hábiles y etiquetas «Vencida» / «Vence pronto»).

## Historia

Como contador o auxiliar, quiero decir una sola vez qué clientes llevo en cada tipo de actividad y ver cada mes la lista de lo que me toca, agrupada por tipo, para marcar lo hecho sin capturar nada.

## Criterios de aceptación

1. **Cartera por tipo:** en cada tipo de actividad hay un botón «Clientes» que abre un diálogo con mis clientes activos en casillas (con filtro por nombre, sin acentos); al guardar se envía solo la diferencia (`{ agregar, quitar }`). La fila del tipo muestra cuántos clientes tiene.
2. **Lista del mes:** «Mis actividades» abre en la lista del mes actual, con un renglón por cada combinación tipo–cliente de la cartera (solo tipos y clientes activos), **agrupada por tipo** (grupo plegable con «hechas de total») y, dentro, los clientes por nombre.
3. **Marcar hecha:** cada renglón tiene una casilla «Hecha»; se guarda al instante y se puede desmarcar. Si el guardado falla, la casilla vuelve a su estado y se avisa. El grupo y el total del mes se actualizan.
4. **Cambiar de mes:** botones «Mes anterior» / «Mes siguiente» y «Hoy»; el mes va en la dirección (`?mes=AAAA-MM`). El mes es **el mes en que se hace el trabajo** (noviembre = lo que haces en noviembre).
5. **Historial:** lo marcado como hecho se conserva aunque después se quite el cliente de la cartera o se desactive el cliente o el tipo (el renglón hecho sigue saliendo en su mes). Lo pendiente de un mes se calcula con la cartera actual.
6. **Catálogos:** «Mis clientes» y «Mis tipos de actividad» (rebanada 10) pasan a una segunda vista dentro de «Mis actividades» (conmutador «Lista del mes» | «Clientes y tipos», en `?vista=catalogos`), sin cambiar su funcionamiento.
7. **Estados vacíos con guía:** sin clientes o sin tipos → explica qué falta y lleva a «Clientes y tipos»; con catálogos pero sin cartera → explica el botón «Clientes» de cada tipo.
8. **Permisos:** cada usuario solo ve y cambia lo suyo (cliente o tipo ajeno → 404); solo `contador` y `auxiliar` (los demás 403). No se puede asignar un cliente o un tipo desactivado (400).
9. **Tablas nuevas** creadas por el seed de forma idempotente:
   - `cartera_actividad`: `usuario_id`, `cliente_id`, `tipo_id`, `creado_en`; llave primaria `(cliente_id, tipo_id)`; FKs con ON DELETE CASCADE.
   - `actividades_mes`: `id`, `usuario_id`, `cliente_id`, `tipo_id`, `mes` (CHAR(7), `AAAA-MM`), `estado` (ENUM `pendiente`, `hecha`), `hecha_en` (DATETIME NULL); único `(cliente_id, tipo_id, mes)`; FKs con ON DELETE CASCADE. Solo se guarda una fila cuando el renglón se marca; lo pendiente no ocupa filas.
10. **Endpoints:** `GET /tipos-actividad/:id/clientes`, `PUT /tipos-actividad/:id/clientes` (`{ agregar, quitar }`, en transacción), `GET /actividades?mes=AAAA-MM` y `PUT /actividades/estado` (`{ cliente_id, tipo_id, mes, hecha }`). `GET /tipos-actividad` agrega `total_clientes`. Errores en tres partes y en tú.
11. Convenciones del proyecto: español y en tú, tooltips, Quasar, paleta `dg-*`, diálogo con `hayDatosSinGuardar` / `:persistent` / `@shake`, `.control-touch`, responsivo (móvil incluido) y recarga silenciosa en `visibilitychange`.
12. La puerta `verificarPruebas.js` vuelve a verde: se agregan a `MINIMOS` los archivos de pruebas de las rebanadas 10 y 11 y se corrige el mínimo desactualizado de `userModel.test.js`.

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/seed.js` (solo la migración de las dos tablas)
- `src/models/CarteraActividadModel.js`, `src/models/ActividadMesModel.js` (nuevos); `src/models/TipoActividadModel.js` (solo `total_clientes`)
- `src/controllers/CarteraActividadController.js`, `src/controllers/ActividadMesController.js` (nuevos)
- `src/routes/actividadRoutes.js` (nuevo); `src/routes/tipoActividadRoutes.js` (las dos rutas de clientes del tipo)
- `src/app.js` (solo montar `/actividades`)
- `src/utils/validationUtils.js` solo si hace falta validar `AAAA-MM`
- `test/carteraActividad.test.js`, `test/actividadesMes.test.js` (nuevos); `test/tiposActividad.test.js` (solo `total_clientes`)
- `soporte-pruebas/verificarPruebas.js` (solo la tabla `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/MisActividades.vue` (conmutador de vistas), `MisTiposActividad.vue` (botón «Clientes» y conteo)
- `src/components/ListaDelMes.vue`, `ClientesDeTipoDialog.vue` (nuevos)
- `src/services/actividadService.js` (nuevo); `src/services/tipoActividadService.js` (clientes del tipo)
- `src/utils/actividades.js` (agrupar por tipo, mes anterior/siguiente, diferencia de cartera)
- `test/listaDelMes.test.js` (nuevo) y `test/misActividades.test.js` (ajustes por el conmutador)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- **Fuera de esta rebanada:** vencimientos y regla por tipo (rebanada 12), calendario (13), cronómetro (14), jornada, informes, sugerir clientes desde `casos.cliente`, y los ajustes de texto pendientes de la rebanada 10 (nombres del menú, 403 «para trabajar casos», «las ves»).
- Los meses se manejan como texto `AAAA-MM`; nunca `new Date('AAAA-MM-DD')` (regla de fechas de AGENTS.md).
- Mismo patrón que «Contador que apoya» para enviar solo la diferencia (`calcularCambiosDeContadores` en `userService.js`) y que `AgregarAuxiliaresDialog.vue` para casillas con filtro (`filtrarContadores`).
- El renglón hecho de un cliente o tipo desactivado se muestra con su nombre y sin poder reactivarse desde la lista.
- Trampas de la rebanada 10: el `q-item-section` principal colapsa nombres largos en móvil (`flex: 1 1 220px`); `session.id` es texto; varios `.vue` usan CRLF.
- Pruebas del backend por archivo; cuentas `zz_test_`; al terminar, 0 filas nuevas `zz_test_%` en XAMPP.

---

## Reporte del implementer

1. Rebanada completada: criterios 1 a 12 implementados (2026-11-13).
2. Archivos modificados: backend `seed.js` (`migrarCarteraYActividadesMes`), `app.js`, `TipoActividadModel.js` (`total_clientes`), `tipoActividadRoutes.js`, `validationUtils.js` (`esMesValido`), `verificarPruebas.js` (`MINIMOS`) y nuevos `CarteraActividadModel.js`, `ActividadMesModel.js`, sus controladores, `actividadRoutes.js` y pruebas `carteraActividad.test.js`, `actividadesMes.test.js`. Frontend `MisActividades.vue` (conmutador), `MisTiposActividad.vue` (botón «Clientes»), `tipoActividadService.js`, `utils/actividades.js` y nuevos `ListaDelMes.vue`, `ClientesDeTipoDialog.vue`, `actividadService.js`, `test/listaDelMes.test.js`.
3. Prueba en rojo y por qué falló: backend, tablas inexistentes y falta de `total_clientes`; frontend, `ERR_MODULE_NOT_FOUND` de `actividadService.js` y luego 9 pruebas de componentes.
4. Puertas: backend por archivo en verde (`tiposActividad` 9, `carteraActividad` 8, `actividadesMes` 11) y `verificarPruebas.js` OK (50 archivos, 456 pruebas); frontend lint, build y `node --test` en verde; navegador: contador (escritorio y móvil) y auxiliar (móvil). Sin ver en navegador: vacío «sin tipos», error con «Reintentar» y animaciones.
5. Decisiones no cubiertas: `MINIMOS` cubre los 50 archivos (24 altas, no solo las de 10 y 11; `userModel` 9 → 5, su número real); `{ cliente_ids }` en la cartera; `GET /actividades` → `{ mes, actividades: [...] }`; `total_clientes` cuenta solo clientes activos; tipo desactivado permite quitar pero no agregar; **desmarcar borra la fila** (el valor `pendiente` del ENUM queda sin uso); marcar exige estar en la cartera activa (400); sin `?mes` se usa el mes actual.
6. Para la memoria: ver MEMORY.md.

## Veredicto del reviewer (vuelta 1)

**CAMBIOS NECESARIOS** (reviewer con Opus, 2026-11-13). Único bloqueo: las cabeceras de los grupos plegables de `ListaDelMes.vue` se leían todas como «Colapsar», sin decir el tipo. Aislamiento entre usuarios, validación, historial, esquema, `MINIMOS` (sin mínimos relajados) y navegador (escritorio y móvil 375 px): bien.

Opcionales sin aplicar (requieren decisión): renglón hecho de un cliente que salió de la cartera queda con la casilla habilitada y al remarcar da 400 (la API no manda `en_cartera`); al cambiar de mes el total muestra un momento las cifras del mes anterior; un `?mes=` inválido se queda en la dirección; prueba de aislamiento de la cartera más estricta; `INSERT IGNORE` en la cartera; el tooltip del conmutador tapa el título del mes.

## Corrección del orquestador (vuelta 1)

Aplicada por el orquestador (cambio de dos atributos, sin volver al implementer): `:toggle-aria-label` con tipo y «hechas de total» en cada grupo de `ListaDelMes.vue`, y `:aria-label` con el nombre del cliente en las casillas de `ClientesDeTipoDialog.vue` (opcional del reviewer). Prueba nueva en `listaDelMes.test.js`. Frontend: 1213/1213, lint y build en verde. **Sin segunda vuelta del reviewer y sin comprobar en navegador con lector de pantalla**; `toggleAriaLabel` existe en la versión de Quasar instalada.
