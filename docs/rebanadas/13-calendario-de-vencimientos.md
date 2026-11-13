# 13 — Calendario de vencimientos

- **Riesgo:** medio (interfaz y fechas; sin tablas nuevas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, sonnet)
- **Estado:** refinada y aprobada por el usuario («sigue con las demás hasta terminar», 2026-11-13); rama `experimento`

## Historia

Como contador o auxiliar, quiero ver en un calendario qué actividades vencen cada día del mes, para planear mi semana de un vistazo.

## Criterios de aceptación

1. «Mis actividades» tiene una tercera vista **«Calendario»** en el conmutador («Lista del mes» | «Calendario» | «Clientes y tipos»), en `?vista=calendario`. Comparte `?mes=AAAA-MM` con la lista: al cambiar de vista se conserva el mes.
2. El calendario es un `q-date` de Quasar (mes completo, semana que empieza en lunes, en español) que marca con un punto los días en que vence algo: color de alerta si ese día tiene pendientes ya vencidas, de aviso si tiene pendientes por vencer, y de éxito si todo lo de ese día está hecho. Bajo el calendario hay una leyenda con texto para cada color (el color nunca es el único indicador).
3. Al elegir un día se listan debajo sus actividades (tipo, cliente, etiqueta «Vencida» / «Vence pronto» y casilla «Hecha» que funciona igual que en la lista del mes). Al abrir, el día elegido es hoy si pertenece al mes mostrado; si no, el primer día con vencimientos. Un día sin vencimientos dice «Nada vence este día.».
4. El calendario muestra las actividades **por su fecha de vencimiento**, así que incluye las del mes anterior cuyo «fin de mes» se recorrió a los primeros días del mes mostrado (se piden el mes mostrado y el anterior, y se filtra por `vence`).
5. Los sábados, domingos y festivos se distinguen como inhábiles; el festivo dice su condición al elegirlo («Día inhábil»). El backend entrega los festivos del mes en `GET /actividades?mes=` como `festivos: ['AAAA-MM-DD', …]` (misma lista de `vencimientoActividad.js`; el frontend no duplica la lista).
6. Las actividades sin fecha de vencimiento no salen en el calendario; un texto dice cuántas hay y que están en la «Lista del mes».
7. Navegar de mes desde el calendario actualiza `?mes=`; «Hoy» vuelve al mes actual. Estados de carga, vacío y error con «Reintentar»; recarga silenciosa en `visibilitychange`.
8. Convenciones del proyecto: español y en tú, tooltips, paleta `dg-*`, accesible por teclado, responsivo (en móvil el calendario ocupa el ancho y la lista del día queda debajo), sin `new Date('AAAA-MM-DD')`.
9. `verificarPruebas.js` sigue en verde.

## Archivos autorizados

Backend (`Backend/`):
- `src/utils/vencimientoActividad.js` (exportar los festivos de un mes), `src/controllers/ActividadMesController.js` (agregar `festivos`)
- `test/vencimientoActividad.test.js`, `test/actividadesMes.test.js`
- `soporte-pruebas/verificarPruebas.js` (solo `MINIMOS`, si cambia algún conteo)

Frontend (`Seguimiento-proyectos/`):
- `src/components/MisActividades.vue` (tercera vista), `src/components/CalendarioActividades.vue` (nuevo)
- `src/components/ListaDelMes.vue` solo si hace falta extraer el renglón a un componente compartido `RenglonActividad.vue` (nuevo) sin cambiar su comportamiento
- `src/services/actividadService.js`, `src/utils/actividades.js`
- `test/calendarioActividades.test.js` (nuevo) y ajustes mínimos a `test/listaDelMes.test.js` y `test/misActividades.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario: el calendario vive dentro de «Mis actividades» como vista alterna; no se mezcla con «Tus próximos vencimientos» de «Mi resumen».
- `q-date` acepta `events` y `event-color` como función, `first-day-of-week`, `locale` y `navigation-min/max-year-month`; las fechas de `q-date` van como `AAAA/MM/DD`: convertir con texto, no con `Date`.
- Fuera de esta rebanada: cronómetro (14), jornada (15), informes (16), arrastrar actividades entre días, vista semanal.
- Trampas: un estilo scoped no alcanza los menús de Quasar; un tooltip sobre un `q-select` tapa la primera opción; clics JS simultáneos en casillas se pierden.
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
