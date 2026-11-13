# 12 — Vencimientos de las actividades

- **Riesgo:** alto (esquema y fechas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** refinada y aprobada por el usuario («vamos a darle con las demás», 2026-11-13); rama `experimento`

## Historia

Como contador o auxiliar, quiero que cada tipo de actividad tenga su regla de vencimiento y que la lista del mes me diga cuándo vence cada renglón y cuáles ya vencieron o están por vencer, para atender primero lo urgente.

## Criterios de aceptación

1. **Regla por tipo:** el formulario del tipo de actividad tiene «Vencimiento» con cuatro opciones: «Sin fecha» (por defecto), «Día fijo del mes», «Fin de mes» y «Día 17 según el RFC del cliente». Con «Día fijo» se pide el día (1 a 28; la ayuda dice que para el último día se usa «Fin de mes»). La fila del tipo muestra su regla en texto («Vence el día 3», «Vence a fin de mes», «Vence el 17 según el RFC», «Sin fecha de vencimiento»).
2. **Campos nuevos en `tipos_actividad`** (migración idempotente en el seed, sin perder datos): `regla_vencimiento` ENUM(`ninguna`, `dia_del_mes`, `fin_de_mes`, `dia_17_rfc`) NOT NULL DEFAULT `ninguna`, y `dia_del_mes` TINYINT NULL. Los tipos existentes quedan en `ninguna`. `dia_del_mes` es obligatorio (1–28) solo con la regla `dia_del_mes`; con las demás se guarda NULL.
3. **Cálculo (backend, una sola fuente):** utilidad pura con pruebas que, dado regla, día, mes `AAAA-MM` y RFC, devuelve la fecha `AAAA-MM-DD` o nada:
   - `dia_del_mes`: ese día del mes; si es inhábil, el siguiente día hábil.
   - `fin_de_mes`: el último día del mes; si es inhábil, el siguiente día hábil (puede caer en el mes siguiente).
   - `dia_17_rfc`: el día 17 (si es inhábil, el siguiente hábil) más los días hábiles extra según el **sexto dígito numérico del RFC**: 1 y 2 → 1; 3 y 4 → 2; 5 y 6 → 3; 7 y 8 → 4; 9 y 0 → 5. Sin RFC válido no hay fecha.
   - `ninguna`: sin fecha.
4. **Días inhábiles:** sábados, domingos y festivos de la LFT: 1 de enero, primer lunes de febrero, tercer lunes de marzo, 1 de mayo, 16 de septiembre, tercer lunes de noviembre, 25 de diciembre y 1 de octubre de cada seis años (2024, 2030…) por el cambio de Poder Ejecutivo. La lista vive en un solo lugar, fácil de ampliar.
5. **API:** `GET/POST/PATCH /tipos-actividad` aceptan y devuelven `regla_vencimiento` y `dia_del_mes` (valores inválidos → 400 con error de campo). `GET /actividades?mes=` agrega a cada renglón `vence` (`AAAA-MM-DD` o null) y `falta_rfc` (true cuando la regla es `dia_17_rfc` y el cliente no tiene RFC).
6. **Lista del mes:** cada renglón muestra «Vence DD-MM-AAAA». Un renglón pendiente lleva la etiqueta **«Vencida»** si la fecha ya pasó y **«Vence pronto»** si faltan pocos días (mismo umbral y mismos colores que los casos); el color nunca es el único indicador. Los renglones hechos no llevan etiqueta de alerta. Con `falta_rfc` se muestra «Falta el RFC del cliente» con tooltip que explica dónde capturarlo. Sin regla no se muestra nada.
7. **Orden y resumen:** dentro de cada grupo, primero lo pendiente por fecha de vencimiento (lo vencido arriba; lo que no tiene fecha al final) y luego lo hecho. El encabezado del mes dice cuántas están vencidas cuando hay alguna.
8. Fechas sin `new Date('AAAA-MM-DD')` (regla de AGENTS.md): usar las utilidades existentes (`dateUtils.js`, `fechasCaso.js`) o aritmética de año, mes y día.
9. Convenciones del proyecto: español y en tú, tooltips, Quasar, paleta `dg-*`, diálogo con sus protecciones, accesibilidad (la etiqueta y la fecha entran en el nombre accesible del renglón), responsivo y móvil.
10. `verificarPruebas.js` sigue en verde: cada archivo nuevo de pruebas del backend entra en `MINIMOS`.

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/seed.js` (solo la migración de las dos columnas)
- `src/utils/vencimientoActividad.js` (nuevo; puede reutilizar `dateUtils.js` sin modificarlo)
- `src/models/TipoActividadModel.js`, `src/controllers/TipoActividadController.js`
- `src/models/ActividadMesModel.js`, `src/controllers/ActividadMesController.js`
- `test/vencimientoActividad.test.js` (nuevo), `test/tiposActividad.test.js`, `test/actividadesMes.test.js`
- `soporte-pruebas/verificarPruebas.js` (solo `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/TipoActividadFormDialog.vue`, `MisTiposActividad.vue`, `ListaDelMes.vue`
- `src/services/tipoActividadService.js`, `src/utils/actividades.js`
- `test/vencimientosActividad.test.js` (nuevo) y ajustes mínimos a `test/misActividades.test.js` y `test/listaDelMes.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- **Diferencias con la agenda original, a validar con los contadores:** (a) la agenda cuenta los días extra desde el 17 aunque sea inhábil; aquí primero se recorre el 17 al siguiente hábil y luego se suman (así lo publican los calendarios fiscales); (b) la agenda usa el 1 de diciembre sexenal; la LFT vigente dice 1 de octubre; (c) no se incluyen Semana Santa ni otros días inhábiles del SAT.
- El mes de la lista es el mes en que se hace el trabajo, así que el vencimiento se calcula **dentro de ese mismo mes** (el 17 de noviembre para la lista de noviembre).
- El vencimiento se calcula, no se guarda (igual que el semáforo de auditorías).
- Fuera de esta rebanada: calendario (13), cronómetro (14), avisos en la campana por actividades vencidas, sumar actividades a «Tus próximos vencimientos» de «Mi resumen».
- Trampas: `seed.js` y varios `.vue` usan CRLF; un DDL hace commit implícito; clics JS simultáneos en casillas de Quasar se pierden (probar con clics reales).
- Pruebas del backend por archivo; cuentas `zz_test_`; 0 filas nuevas `zz_test_%` en XAMPP al terminar.

---

## Reporte del implementer

1. Rebanada completada: criterios 1 a 10 implementados (2026-11-13).
2. Archivos modificados: backend `utils/vencimientoActividad.js` (nuevo: `calcularVencimiento`, `esDiaInhabil`, festivos y días extra en constantes), `seed.js` (`migrarVencimientoDeTipos`, `ADD COLUMN IF NOT EXISTS`), modelos y controladores de tipos y de actividades del mes, pruebas `vencimientoActividad` (20), `tiposActividad` (13), `actividadesMes` (13) y `MINIMOS`. Frontend `utils/actividades.js`, `tipoActividadService.js`, `TipoActividadFormDialog.vue`, `MisTiposActividad.vue`, `ListaDelMes.vue`, `test/vencimientosActividad.test.js` (19) y un ajuste legítimo de orden en `listaDelMes.test.js`.
3. Prueba en rojo y por qué falló: módulo inexistente (utilidad), columnas y campos faltantes (tipos), `vence` y `falta_rfc` faltantes (actividades), exports inexistentes (frontend).
4. Puertas: backend por archivo en verde, `verificarPruebas.js` OK (51 archivos, 482 pruebas); frontend lint, build y 1232/1232; navegador en escritorio y móvil con las cuatro reglas, etiquetas, «Falta el RFC del cliente» y orden. Sin probar el rol auxiliar en navegador.
5. Decisiones no cubiertas: el «sexto dígito» es el último de la fecha AAMMDD del RFC; `falta_rfc` también sale en renglones hechos; con regla distinta de día fijo el día se guarda NULL; etiquetas con `esCasoVencido` / `esCasoProximoAVencer` (umbral de 3 días); un renglón marcado «Hecha» baja al final del grupo; el tooltip del selector se oculta con la lista abierta.
6. Para la memoria: ver MEMORY.md.

## Veredicto del reviewer (vuelta 1)

**CAMBIOS NECESARIOS** (reviewer con Opus, 2026-11-13). Único bloqueo: la prueba de la migración en `tiposActividad.test.js` hacía `ALTER TABLE … DROP COLUMN` sobre la base compartida con el backend de desarrollo y borraba las reglas de los tipos reales en cada corrida (no se perdió nada: los 4 tipos reales estaban en `ninguna`). Lo demás cumple: comparó `calcularVencimiento` contra un comprobador propio en 7 644 casos (2021–2033, tres zonas horarias) sin diferencias; migración idempotente; sin fugas de RFC; etiquetas, orden y conteo correctos; navegador en escritorio y móvil.

Opcionales sin aplicar: prueba de PATCH de regla sobre tipo ajeno; `FORMA_RFC` duplicada en `ClienteController.js` y `vencimientoActividad.js`; `calcularVencimiento` acepta día hasta 31 (la API limita a 28); el tooltip del «Día del mes» tapa el error en móvil; al marcar «Hecha» el renglón se mueve bajo el cursor.

## Corrección del orquestador (vuelta 1)

La prueba ya no ejecuta DDL destructivo: crea un tipo `zz_test_` con regla y día, corre el seed dos veces, comprueba que los conserva y revisa en `SHOW COLUMNS` el tipo, `NOT NULL` y `Default: ninguna`. `tiposActividad` 13/13 y `verificarPruebas.js` OK. No queda ningún `DROP` ni `TRUNCATE` en `Backend/test`. Sin segunda vuelta del reviewer.
