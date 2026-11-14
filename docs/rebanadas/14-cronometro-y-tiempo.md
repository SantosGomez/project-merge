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

1. Rebanada completada:
2. Archivos modificados:
3. Prueba en rojo y por qué falló:
4. Puertas (verde / rojo / no aplica):
5. Decisiones no cubiertas:
6. Para la memoria:

## Veredicto del reviewer (vuelta 1)
