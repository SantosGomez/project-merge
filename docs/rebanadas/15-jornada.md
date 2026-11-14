# 15 — Jornada (entrada, descanso y salida)

- **Riesgo:** alto (esquema nuevo, horas y datos de asistencia)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** refinada y aprobada por el usuario («sigue con las demás hasta terminar», 2026-11-13); rama `experimento`

## Historia

Como contador o auxiliar, quiero registrar mi entrada, mi descanso y mi salida del día con un botón, para saber cuántas horas trabajé y cuánto de ese tiempo quedó asignado a mis actividades.

## Criterios de aceptación

1. **Tarjeta «Mi jornada de hoy»** arriba de «Mis actividades» (visible en todas sus vistas, plegable y recordando si quedó plegada). Muestra las cuatro horas del día (entrada, salida a descanso, regreso de descanso, salida) y un solo botón con el paso que sigue: «Registrar entrada» → «Salir a descanso» → «Regresar de descanso» → «Registrar salida». Desde la entrada también se puede «Registrar salida» sin tomar descanso.
2. Cada paso guarda **la hora del servidor**, no la del equipo. Un paso ya registrado no se vuelve a registrar con el botón.
3. **Horas trabajadas:** la tarjeta muestra el tiempo trabajado del día (entrada → salida, sin el descanso; si la jornada sigue abierta, hasta ahora) y lo compara con la jornada base: «Llevas 6 h 10 min de 8 h» o «1 h 15 min extra».
4. **Tiempo asignado:** muestra cuánto de lo trabajado hoy está en bloques de tiempo de actividades (rebanada 14) y cuánto queda sin asignar.
5. **Corregir:** «Corregir horas» abre un diálogo para editar las cuatro horas del día (formato de 24 h, `HH:MM`) y también las de un día anterior (selector de fecha, no futura). Validación: entrada ≤ salida a descanso ≤ regreso ≤ salida; no hay regreso sin salida a descanso; se puede dejar vacío lo que no ocurrió. Guardar todo vacío borra la jornada de ese día.
6. **Jornada base:** cada quien define sus horas base por día (por defecto 8; de 1 a 16, admite medias horas) desde la misma tarjeta.
7. **Privacidad (decisión del usuario):** cada quien ve y cambia **solo su propia jornada**. No hay ninguna vista ni endpoint para el administrador ni para el contador sobre la jornada de sus auxiliares. Solo roles `contador` y `auxiliar` (los demás 403).
8. **Tablas nuevas** (seed idempotente, FKs con ON DELETE CASCADE):
   - `jornadas`: `id`, `usuario_id`, `fecha` (DATE), `entrada`, `salida_descanso`, `regreso_descanso`, `salida` (TIME NULL); único `(usuario_id, fecha)`.
   - `ajustes_actividades`: `usuario_id` (llave primaria), `jornada_base_minutos` (INT NOT NULL DEFAULT 480).
9. **Endpoints** (errores en tres partes y en tú):
   - `GET /jornadas/hoy` → `{ jornada, minutos_trabajados, minutos_actividades, jornada_base_minutos, ahora }`
   - `POST /jornadas/hoy/marcar` `{ paso }` (`entrada`, `salida_descanso`, `regreso_descanso`, `salida`; 409 si el paso no corresponde o ya está registrado)
   - `GET /jornadas?mes=AAAA-MM` → `{ jornadas }` (para la rebanada 16 y el diálogo)
   - `PUT /jornadas/:fecha` (corrección; `AAAA-MM-DD`, no futura) → `{ jornada }` o 204 si quedó vacía
   - `PUT /jornadas/ajustes` `{ jornada_base_minutos }`
10. Convenciones del proyecto: español y en tú, tooltips, Quasar, paleta `dg-*`, diálogo con sus protecciones, accesibilidad, responsivo y móvil, recarga silenciosa en `visibilitychange`, contrato de fechas de AGENTS.md (API `AAAA-MM-DD`, formulario `DD-MM-AAAA`, sin `new Date('AAAA-MM-DD')`).
11. `verificarPruebas.js` en verde con los archivos nuevos en `MINIMOS`.

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/seed.js` (solo la migración de las dos tablas)
- `src/models/JornadaModel.js`, `src/controllers/JornadaController.js`, `src/routes/jornadaRoutes.js` (nuevos)
- `src/utils/jornada.js` (nuevo: minutos trabajados y validación del orden, funciones puras)
- `src/app.js` (solo montar `/jornadas`)
- `test/jornadas.test.js`, `test/jornadaUtils.test.js` (nuevos)
- `soporte-pruebas/verificarPruebas.js` (solo `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/MisActividades.vue` (montar la tarjeta)
- `src/components/JornadaDeHoy.vue`, `JornadaFormDialog.vue` (nuevos)
- `src/services/jornadaService.js` (nuevo)
- `src/utils/jornada.js` (nuevo) o `src/utils/actividades.js`
- `test/jornada.test.js` (nuevo) y ajustes mínimos a `test/misActividades.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Referencia de lógica: `horasMin`, `setHora` y `renderClock` de la agenda original (trabajado = tramo antes del descanso + tramo después).
- La «hora de ahora» viene del servidor (`ahora`), igual que el cronómetro.
- Un cronómetro en marcha no cuenta como tiempo asignado hasta que se detiene.
- Fuera de esta rebanada: informes y horas extra por periodo (16), avisos por olvidar la salida, jornadas que cruzan la medianoche, tarifa.
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
