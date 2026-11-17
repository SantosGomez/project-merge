# 18 — Calendario del administrador

- **Riesgo:** medio (endpoint nuevo de solo lectura con regla de visibilidad; vista nueva sin tablas nuevas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** refinada y aprobada por el usuario («el plan está bien, empieza con la rebanada 18», 2026-11-17); rama `experimento`

## Historia

Como administrador, quiero un calendario con lo que vence cada día —casos importantes, auditorías y entregas de auditoría— para anticipar la carga de trabajo del despacho.

## Criterios de aceptación

1. El dashboard del administrador (`AdminDashboardPage.vue`) tiene una tercera pestaña **«Calendario»** junto a «Casos» y «Auditorías» (`?tab=calendario`, igual que las otras pestañas). No hay ítem de menú ni página nueva.
2. **Endpoint** `GET /contadores/casos-importantes`, solo administrador (los demás roles 403; sin token 401). Devuelve los casos importantes (`importante = 1`) de todos los contadores y los casos importantes de los auxiliares (escalados por su contador), cada uno con `nombre_contador` (dueño) y, si el dueño es auxiliar, el nombre del contador que apoya. Misma regla de visibilidad que `findParaAdministrador({ soloImportantes: true })` aplicada a todos los contadores; los casos no importantes nunca salen. Fechas DATE en `AAAA-MM-DD` (vía `DATE_FORMAT`, como el resto del modelo). Respuesta JSON con el formato de siempre.
3. **Auditorías:** el vencimiento de cada auditoría sale de `GET /auditorias` (ya trae `fecha_vencimiento`, `estado`, `contadores`; no se modifica). `GET /auditorias` **no** devuelve los eventos de la bitácora, así que las entregas salen de un **endpoint nuevo** `GET /auditorias/calendario`, solo administrador (los demás 403; sin token 401), de solo lectura y en una sola petición: los eventos pendientes de todas las auditorías (con `FechaLimite`, sin `FechaEntrega` y no Completados), cada uno con `id`, `auditoria_id`, `cliente`, `no_expediente`, `evento`, `fase`, `fecha_limite` (`AAAA-MM-DD`), `estado` y `contadores` de su auditoría. Decisión del usuario (2026-11-17): endpoint nuevo en vez de ampliar `GET /auditorias`.
4. **Qué se marca en el calendario** (`q-date` con eventos, mismo patrón que `CalendarioActividades.vue`):
   - vencimiento de cada caso importante que **no** esté Finalizado;
   - vencimiento (`FechaVencimiento`) de cada auditoría que **no** esté Completada;
   - fecha límite de cada evento de bitácora **pendiente** (con `FechaLimite`, sin `FechaEntrega` y no Completado).
   El color de la marca de un día refleja lo más urgente de ese día (vencido / vence pronto / a tiempo), con la paleta `dg-*`.
5. **Al elegir un día**, debajo se lista lo que vence ese día agrupado en «Casos», «Auditorías» y «Entregas de auditoría», con contadores en cada grupo. Cada renglón dice en texto si está vencido, vence pronto o va a tiempo (el color nunca es el único indicador), y muestra el contador (en casos de auxiliar, «de {auxiliar}» como en el detalle).
   - «Ver» en un caso abre `CasoDetalleDialog.vue` (solo lectura).
   - «Ver» en una auditoría o en una entrega lleva a la ficha de la auditoría (ruta `auditorias/:id`).
6. **Filtro por contador** (`q-select`, «Todos los contadores» por defecto) que aplica a los tres grupos y a las marcas; botón **«Hoy»**; **leyenda** de colores en texto.
7. Estados de carga, vacío del día («Nada vence este día.») y error con «Reintentar». Si falla una de las dos fuentes (casos o auditorías), se dice cuál y se muestra la otra.
8. La pestaña recarga en silencio en `visibilitychange`; un fallo al releer no borra lo ya mostrado.
9. La lógica pura (armar los eventos por día desde casos y auditorías, el filtro por contador, el nivel de urgencia de cada día) vive en `src/utils/calendarioAdministrador.js` y se prueba con `node --test`. Fechas con `parseFechaInicio`/`formatearFechaISO` (nunca `new Date('AAAA-MM-DD')`).
10. Convenciones: español y en tú, tooltips, componentes Quasar, paleta `dg-*` (sin hexadecimales sueltos), accesibilidad (`aria-label`, foco), responsivo con vista móvil y `.control-touch`.
11. `verificarPruebas.js` en verde con los archivos de prueba nuevos en `MINIMOS`; 0 filas `zz_test_%` al terminar.

## Archivos autorizados

Backend (`Backend/`):
- `src/models/CaseModel.js` (función nueva; no cambiar las existentes)
- `src/controllers/CounterController.js` (handler nuevo)
- `src/routes/counterRoutes.js` (ruta nueva, **antes** de las rutas con `/:id`)
- `test/casosImportantesCalendario.test.js` (nuevo)
- `src/models/AuditoriaEventoModel.js` (función nueva; no cambiar las existentes)
- `src/controllers/AuditoriaController.js` (handler nuevo; `auditoriaParaApi` no se toca)
- `src/routes/auditoriaRoutes.js` (ruta nueva, **antes** de `/:id`, con `requireAdmin`)
- `test/entregasAuditoriaCalendario.test.js` (nuevo)
- `soporte-pruebas/verificarPruebas.js` (solo agregar a `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/CalendarioAdministrador.vue` (nuevo)
- `src/utils/calendarioAdministrador.js` (nuevo)
- `test/calendarioAdministrador.test.js` (nuevo)
- `src/services/counterService.js` (función nueva para el endpoint)
- `src/services/auditoriaService.js` (función nueva para `GET /auditorias/calendario`; no cambiar las existentes)
- `src/pages/AdminDashboardPage.vue` (pestaña y panel)

Docs: este archivo.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario: el calendario muestra **casos y auditorías** (vencimiento y fechas límite de eventos); se trabaja en **`experimento`**; sin Docker y sin push.
- **No entra:** actividades de «Mis actividades» de los contadores (son privadas: «Solo cada quien»); edición desde el calendario; casos no importantes; arrastrar fechas.
- Reutilizar estilos y estructura de `CalendarioActividades.vue` sin modificarlo.
- El dashboard ya pide `GET /auditorias` en `TableroAuditorias`; el calendario hace su propia petición (no tocar `TableroAuditorias.vue`).
- Pruebas solo con cuentas y registros `zz_test_`; nada de DDL destructivo; la base XAMPP 3306 es compartida.
- Puertas de AGENTS.md; prettier además del lint (`npx prettier --check` en lo tocado). Navegador: `backend-experimento-3011` + `frontend-experimento-9012`, escritorio y móvil; cerrar los servidores.

---

## Reporte del implementer

1. Rebanada completada: sí, completa (los 11 criterios). Pestaña «Calendario» en el dashboard del administrador, `GET /contadores/casos-importantes` y `GET /auditorias/calendario` (solo administrador).
2. Archivos modificados:
   - Backend: `src/models/CaseModel.js` (`findImportantesParaCalendario`), `src/controllers/CounterController.js`, `src/routes/counterRoutes.js`, `src/models/AuditoriaEventoModel.js` (`findPendientesParaCalendario`), `src/controllers/AuditoriaController.js` (`entregasParaCalendario`), `src/routes/auditoriaRoutes.js` (ruta antes de `/:id`, con `requireAdmin`), `soporte-pruebas/verificarPruebas.js` (`MINIMOS`), `test/casosImportantesCalendario.test.js` (4) y `test/entregasAuditoriaCalendario.test.js` (3), ambos nuevos.
   - Frontend: `src/components/CalendarioAdministrador.vue`, `src/utils/calendarioAdministrador.js`, `test/calendarioAdministrador.test.js` (22 pruebas), nuevos; `src/services/counterService.js`, `src/services/auditoriaService.js` (función nueva cada uno), `src/pages/AdminDashboardPage.vue`.
3. Prueba en rojo y por qué falló: los dos archivos del backend respondían 404 (casos) y no daban el resultado esperado (auditorías: `/calendario` caía en `/:id`) porque las rutas no existían; la prueba del frontend falló con `ERR_MODULE_NOT_FOUND` (sin `calendarioAdministrador.js`) y, ya con la lógica, fallaron las 3 pruebas de la pestaña y el componente hasta crearlos.
4. Puertas: Backend verde (`node --test` de los archivos nuevos y de `auditoriaRoutes`, `counterRoutes` y `escalarCasosDeAuxiliar`; `verificarPruebas.js` OK, 57 archivos). Frontend verde (`node --test` 1384/1384, eslint sin errores, `prettier --check` en lo propio, `npm run build`). Navegador: escritorio y móvil 375 px con cuentas `zz_test_nav_*` (marcas, lista por grupos, filtro, ficha del caso, enlaces a la auditoría); sin errores de consola; servidores cerrados. `prettier --check` de `AdminDashboardPage.vue` y `auditoriaService.js` avisa, pero ya avisaba en HEAD (no es del cambio).
5. Decisiones no cubiertas: (a) el evento pendiente excluye también «Rechazado» (igual que `ESTADOS_CERRADOS` del seguimiento) y los eventos de auditorías «Completado». (b) Un auxiliar sin contador vinculado no sale (no hay quien lo escale). (c) Los casos traen además `contador_que_apoya` y `contador_que_apoya_id`; en el filtro el caso de un auxiliar cuenta para su contador y la lista dice «de {auxiliar}». (d) «Pronto» = hoy a 3 días, la misma regla de los casos. (e) La opción «Todos los contadores» usa el valor 0 (q-select no pinta la etiqueta de un valor null). (f) El tooltip del filtro se oculta con la lista abierta (patrón ya usado en otros selectores). (g) En el encabezado de la página, el texto de «Auditorías» quedó como `v-else` porque `tableroAuditorias.test.js` lo exige así; el de «Calendario» va antes.
6. Para la memoria: calendario del administrador listo en `experimento` (sin commit); `GET /auditorias` no trae eventos, por eso existe `GET /auditorias/calendario`. En XAMPP siguen 12 cuentas `zz_test_` anteriores a esta rebanada (no son de esta); casos y auditorías `zz_test_` en 0.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (reviewer opus, 2026-11-17). Los 11 criterios comprobados en código, pruebas y navegador (escritorio y 375 px). Puertas: backend 45/45 en los archivos tocados y `verificarPruebas.js` OK (57 archivos, 542 pruebas); frontend `node --test` 1384/1384, lint y build en verde. `AdminDashboardPage.vue` y `auditoriaService.js` ya fallaban `prettier --check` en HEAD (finales de línea), no lo introduce esta rebanada. Datos `zz_test_` limpios (siguen las 12 cuentas antiguas del 2026-11-10).

Opcionales sin aplicar (para decidir con el usuario):
1. `CasoDetalleDialog.vue`: abierta desde el calendario, la ficha dice «para cambiar algo usa «Editar»», pero el administrador no tiene «Editar». Texto distinto para el administrador (prop o por rol).
2. `CalendarioAdministrador.vue` dentro de `keep-alive`: una auditoría registrada en la pestaña «Auditorías» no aparece al volver a «Calendario» hasta el siguiente `visibilitychange`; releer en silencio con `onActivated`.
3. Pruebas: 403 solo se prueba con contador (falta auxiliar) y no hay prueba de que se excluya el evento «Rechazado».
4. `counterRoutes.js:5`: falta un espacio en `=require(`.
5. El texto de ayuda de la página y el de la tarjeta del calendario casi se repiten.
