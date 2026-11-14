# 14 — Cronómetro y bloques de tiempo

- **Riesgo:** alto (esquema nuevo y horas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** refinada y aprobada por el usuario («sigue con las demás hasta terminar», 2026-11-13); rama `experimento`

## Historia

Como contador o auxiliar, quiero iniciar y detener un cronómetro en cada renglón de mi lista del mes, para saber cuánto tiempo me lleva cada actividad sin capturar nada a mano.

## Criterios de aceptación

1. **Iniciar y detener:** cada renglón pendiente o hecho de la lista del mes (y del día elegido en el calendario) tiene el botón «Iniciar»; el renglón con el cronómetro en marcha muestra «Detener» y el tiempo transcurrido, que avanza en pantalla. Al detener se guarda un bloque con sus minutos (mínimo 1).
2. **Uno a la vez:** cada usuario tiene como máximo un cronómetro en marcha. Iniciar otro detiene el anterior (guardando su bloque) y avisa cuál se detuvo.
3. **Sobrevive al cierre:** la hora de inicio se guarda en el servidor; al recargar, cerrar la ventana o entrar desde otro dispositivo, el cronómetro sigue en marcha con el tiempo correcto. El tiempo se calcula con la hora del servidor (la respuesta trae `ahora`), no con el reloj del equipo.
4. **Aviso fijo:** mientras hay un cronómetro en marcha, «Mis actividades» muestra arriba, en las tres vistas, un aviso con cliente, tipo, mes y tiempo transcurrido, y el botón «Detener». Si lleva más de 10 horas, el aviso lo dice («Lleva más de 10 horas en marcha; revisa si lo olvidaste.»).
5. **Tiempo acumulado:** cada renglón muestra la suma de sus bloques («1 h 20 min»); el grupo y el encabezado del mes muestran su total.
6. **Bloques:** desde el renglón se abre un diálogo «Tiempo registrado» con sus bloques (fecha, inicio, fin, minutos), donde se puede **agregar tiempo a mano** (minutos, de 1 a 1440) y **borrar** un bloque con confirmación (`focus: 'cancel'`).
7. **Historial:** el tiempo registrado se conserva y su renglón sigue saliendo en su mes aunque el cliente salga de la cartera o se desactive él o el tipo (igual que lo hecho). Iniciar o agregar tiempo exige que el renglón esté en la cartera activa (400 si no); detener y borrar solo exigen que sea propio.
8. **Tabla nueva `registros_tiempo`** (seed idempotente): `id`, `usuario_id`, `cliente_id`, `tipo_id`, `mes` (CHAR(7)), `inicio` (DATETIME), `fin` (DATETIME NULL: NULL = en marcha), `minutos` (INT NULL), `cobrable` (TINYINT, copia del tipo al crear el bloque), `manual` (TINYINT); FKs con ON DELETE CASCADE; índices por `(usuario_id, mes)` y `(cliente_id, tipo_id, mes)`.
9. **Endpoints** (solo `contador` y `auxiliar`; lo ajeno 404; errores en tres partes y en tú):
   - `GET /tiempo/activo` → `{ activo: {…} | null, ahora }`
   - `POST /tiempo/iniciar` `{ cliente_id, tipo_id, mes }` → `{ activo, detenido, ahora }` (en transacción)
   - `POST /tiempo/detener` → `{ bloque }` (404 si no hay ninguno en marcha)
   - `GET /tiempo?cliente_id=&tipo_id=&mes=` → `{ bloques }`
   - `POST /tiempo/manual` `{ cliente_id, tipo_id, mes, minutos }` → `{ bloque }`
   - `DELETE /tiempo/:id` → 204 o `{ ok: true }`
   - `GET /actividades?mes=` agrega `minutos` (suma de bloques terminados) a cada renglón.
10. Dos peticiones simultáneas de «Iniciar» no dejan dos cronómetros en marcha.
11. Convenciones del proyecto: español y en tú, tooltips, Quasar, paleta `dg-*`, diálogos con sus protecciones, accesibilidad (el botón dice de qué renglón es; el tiempo en marcha no se anuncia cada segundo), responsivo y móvil, recarga silenciosa en `visibilitychange`, fechas sin `new Date('AAAA-MM-DD')`.
12. `verificarPruebas.js` en verde con los archivos nuevos en `MINIMOS`.

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/seed.js` (solo la migración de la tabla)
- `src/models/RegistroTiempoModel.js`, `src/controllers/RegistroTiempoController.js`, `src/routes/tiempoRoutes.js` (nuevos)
- `src/models/ActividadMesModel.js` y `src/controllers/ActividadMesController.js` (`minutos` y el historial con tiempo)
- `src/app.js` (solo montar `/tiempo`)
- `test/registrosTiempo.test.js` (nuevo), `test/actividadesMes.test.js`
- `soporte-pruebas/verificarPruebas.js` (solo `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/MisActividades.vue` (aviso fijo), `ListaDelMes.vue`, `CalendarioActividades.vue`, `RenglonActividad.vue` (si existe)
- `src/components/CronometroActivo.vue`, `TiempoRegistradoDialog.vue` (nuevos)
- `src/services/tiempoService.js` (nuevo), `src/services/actividadService.js`
- `src/stores/cronometro.js` (nuevo, solo si hace falta compartir el cronómetro entre vistas)
- `src/utils/actividades.js` (formato de duración, tiempo transcurrido)
- `test/cronometro.test.js` (nuevo) y ajustes mínimos a pruebas existentes de la lista y el calendario

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones: sin liga con casos (no hay `caso_id`); sin tarifa; detener no marca «Hecha» (son acciones separadas).
- Las horas se guardan en hora local del servidor, como el resto del proyecto (`formatLocalDate`, `nowLocal` de `dateUtils.js`).
- El renglón se identifica por `(cliente_id, tipo_id, mes)`, no por una fila de `actividades_mes` (lo pendiente no tiene fila).
- Fuera de esta rebanada: jornada (15), informes y CSV (16), editar la hora de un bloque, avisos en la campana por cronómetro olvidado, SSE entre dispositivos.
- PROHIBIDO en pruebas el DDL destructivo: la base de XAMPP se comparte con el backend de desarrollo.
- Pruebas del backend por archivo; cuentas `zz_test_`; 0 filas nuevas `zz_test_%` en XAMPP al terminar.

---

## Reporte del implementer

1. Rebanada completada: los 12 criterios (2026-11-13).
2. Archivos: backend nuevos `RegistroTiempoModel.js`, `RegistroTiempoController.js`, `tiempoRoutes.js`, `test/registrosTiempo.test.js` (13); modificados `seed.js` (`migrarRegistrosTiempo`), `app.js`, `ActividadMesModel.js`, `actividadesMes.test.js`, `MINIMOS`. Frontend nuevos `CronometroActivo.vue`, `RenglonActividad.vue` (botón del cronómetro, tiempo y diálogo compartidos por lista y calendario), `TiempoRegistradoDialog.vue`, `tiempoService.js`, `stores/cronometro.js`, `test/cronometro.test.js` (35); modificados `MisActividades.vue`, `ListaDelMes.vue`, `CalendarioActividades.vue`, `utils/actividades.js`.
3. Prueba en rojo y por qué falló: `/tiempo` no existía (404), faltaba `minutos` en el renglón, imports inexistentes en el frontend; al quitar el bloqueo, la prueba de dos «iniciar» simultáneos se puso en rojo.
4. Puertas: frontend lint, build y 1286/1286; backend `registrosTiempo` 13, `actividadesMes` 14, `seed` 26, `carteraActividad` 8 y `verificarPruebas.js` OK (52 archivos, 500 pruebas); navegador en escritorio y móvil de 375 px. Sin verificar: `visibilitychange` en vivo, segundo dispositivo, lector de pantalla.
5. Decisiones no cubiertas: un solo cronómetro por usuario con transacción y `SELECT … FOR UPDATE` sobre la fila del usuario (sin índice único); minutos = máx(1, redondeo); el tiempo a mano termina «ahora» y su inicio es aproximado (etiqueta «A mano»); `GET /tiempo` devuelve solo bloques terminados; `DELETE /tiempo/:id` responde `{ ok: true }` y también borra un bloque en marcha propio; el intervalo de 1 s vive en `CronometroActivo.vue`; el aviso es un `q-card` con `role="region"` y el tiempo `role="timer"`; el aviso no es fijo al desplazarse.
6. Para la memoria: ver MEMORY.md.

## Veredicto del reviewer (vuelta 1)

**CAMBIOS NECESARIOS** (reviewer con Opus, 2026-11-13). Único cambio: en móvil de 375 px la cabecera del grupo de `ListaDelMes.vue` ganó una tercera insignia (el tiempo) y el nombre del tipo se partía a mitad de palabra. Los riesgos altos están bien: intentó romper la concurrencia con 15 vueltas de 25 peticiones simultáneas y nunca hubo más de un cronómetro ni errores 500; aislamiento, horas del servidor, validaciones, historial y migración correctos.

Opcionales sin aplicar: «Iniciar» sigue activo en un renglón de historial fuera de cartera (el servidor responde 400); un bloque que cruce el cambio de horario se desviaría 60 min; `DELETE` permite borrar el bloque en marcha; el tooltip del campo de minutos tapa su error; las pruebas de componentes revisan el código fuente.

## Corrección del orquestador (vuelta 1)

Las dos insignias de la cabecera van en una sola sección (`lista-mes__grupo-insignias`) que se apila en columna por debajo de 600 px, y el nombre usa `overflow-wrap: break-word` en vez de `anywhere`. Frontend 1286/1286, lint y prettier en verde. **Sin segunda vuelta del reviewer y sin comprobar aún en navegador a 375 px; queda para la revisión de UI/UX.**
