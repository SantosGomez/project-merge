# «Mi trabajo» y «Mis actividades» — propuesta (feature a futuro)

- **Estado:** completo en `experimento` (2026-11-13): rebanadas 10 a 16 hechas y revisadas, más la revisión de UI/UX (`17-revision-ui-actividades.md`). La rebanada 2 del plan se partió en 11 (cartera y lista) y 12 (vencimientos), así que la numeración final es 10–16.
- **Rama de trabajo:** `experimento` (feature a futuro; no va a `main` ni a Docker hasta decidirlo).
- **Origen:** artefactos «Agenda de trabajo» y «Bitácora de jornada» de claude.ai (carpeta Descargas del usuario; no se versionan). La Bitácora es una versión anterior y más simple de la agenda: mismas 3 pestañas y mismo modelo de datos. Se aprovecha su **lógica**, no su interfaz (vanilla JS, CSS propio y `window.claude`, que no encajan con Quasar ni con la paleta `dg-*`).

## Historia

Como contador o auxiliar, quiero registrar las actividades repetitivas que hago cada mes con mis clientes (revisión de contabilidad electrónica, de facturas, etc.) con solo elegir cliente y actividad, ver cuándo vencen y medir el tiempo con un cronómetro, para cumplir a tiempo y cuantificar cuánto me lleva cada una.

## Decisiones acordadas

1. «Mis casos» pasa a llamarse **«Mi trabajo»** y se divide en dos `q-tabs`: **Mis casos** y **Mis actividades**. Primero solo cambia la etiqueta del menú; la ruta `mis-casos` se queda (avisos de la campana, `destinoDeAviso` y pruebas dependen de ella). Cambiar la ruta es decisión aparte.
2. **El «plan del mes» de la agenda y las «actividades» son lo mismo** (2026-11-13). Las 8 obligaciones de la agenda (solicitud de información, conta electrónica, correos de cumplimiento, observaciones, estado de cuenta de impuestos, declaración mensual, DIOT, respaldo) son tipos de actividad. Un solo modelo: cada renglón de la lista del mes es un tipo por cliente, con estado, vencimiento y tiempo acumulado.
3. Los **tipos de actividad** los define **cada contador** (no el administrador). Cada tipo trae si es cobrable por defecto y una **regla de vencimiento**.
4. Cada quien **arma su propia cartera de clientes** (los clientes son del dueño, no un catálogo del despacho). Se pueden sugerir nombres desde `casos.cliente` (opcional, no en la rebanada 1).
5. **Los auxiliares también** tienen «Mis actividades», con sus propios clientes y tipos.
6. **Sí hay vencimiento.** La regla de cada tipo es una de: sin fecha, día N hábil del mes, fin de mes, o día 17 más días extra por el sexto dígito del RFC. Lógica de referencia: `habil`, `addHab`, `sexto`, `dueFor` y `fest` de la agenda; se porta a `utils/` con pruebas.
7. **Calendario:** vive **dentro de «Mis actividades»**, como vista alterna a la lista del mes (conmutador Lista | Calendario), con los vencimientos de las actividades por día. «Mi resumen» ya tiene «Tus próximos vencimientos» (`AgendaCasos.vue`) con los casos; más adelante se evalúa sumarle las actividades que vencen pronto, pero no se mezclan en la primera entrega.
8. **Sin pendientes sueltos:** todo es caso o actividad.
9. **Ligar una actividad con un caso: no por ahora.** Dejaría una columna opcional `caso_id` en `registros_tiempo` (cambio de estructura: requiere aprobación).
10. **Tarifa por hora e importe estimado: después** (rebanada de informes, no antes).

## Cómo funciona

- **Cartera por tipo:** se define una vez qué clientes lleva cada quien en cada tipo. De ahí sale la agrupación tipo → clientes que hacen esa actividad.
- **Lista del mes:** cada mes aparece un renglón por tipo y cliente, con estado (pendiente o hecha), vencimiento y tiempo acumulado. El llenado es «predefinido»: solo se pulsa «Iniciar» en el renglón.
- **Cronómetro:** uno activo por usuario. Se guarda la hora de inicio en la base (no se cuenta en pantalla), así sobrevive al cerrar la ventana. Al detener se registra un bloque de tiempo y varios bloques suman en el mismo renglón. Referencia: `CATS`, `guardarAct` y `config/activa` de la agenda original.
- **Jornada:** entrada, descanso y salida; permite ver cuánto de la jornada quedó asignado a actividades y las horas extra contra la jornada base. Es control de asistencia: decidir quién la ve antes de la rebanada 5.
- **Informes:** horas por cliente y por tipo, horas extra y CSV.

## Tablas propuestas (se crean por rebanada; pedir aprobación antes de cada una)

| Tabla | Campos principales | Rebanada |
|---|---|---|
| `clientes` | `id`, `usuario_id`, `nombre`, `rfc` (opcional), `activo`, `creado_en` | 1 |
| `tipos_actividad` | `id`, `usuario_id`, `nombre`, `cobrable` (por defecto), `activo`, `creado_en` | 1 |
| `tipos_actividad` (campos nuevos) | `regla_vencimiento`, `dia_del_mes` | 2 |
| `cartera_actividad` | `usuario_id`, `cliente_id`, `tipo_id` | 2 |
| `actividades_mes` | `mes` (AAAA-MM), `usuario_id`, `cliente_id`, `tipo_id`, `estado`, `vence` | 2 |
| `registros_tiempo` | `actividad_mes_id`, `usuario_id`, `inicio`, `fin`, `minutos`, `cobrable` (+ `caso_id` opcional, más adelante) | 3 |
| cronómetro activo | columna o tabla chica por usuario: `usuario_id`, `actividad_mes_id`, `inicio` | 3 |
| `jornadas` | `usuario_id`, `fecha`, `entrada`, `salida_descanso`, `regreso_descanso`, `salida` | 5 |

## Rebanadas (vertical + TDD, una a la vez, cada una se presenta antes de tocar código)

1. **«Mi trabajo» con dos pestañas + clientes y tipos propios.** Tablas `clientes` y `tipos_actividad`; endpoints, pantalla y etiqueta del menú. Riesgo alto (esquema). Archivo: `10-mi-trabajo-clientes-tipos.md`.
2. **Cartera por tipo y lista del mes con vencimientos.** Tablas `cartera_actividad` y `actividades_mes`, regla de vencimiento en los tipos, utilidades de fechas hábiles con pruebas y estado hecha/pendiente, agrupado por tipo.
3. **Calendario de vencimientos** dentro de «Mis actividades» (vista alterna a la lista).
4. **Cronómetro y bloques de tiempo.** Tabla `registros_tiempo` y cronómetro persistente; SSE existente si hace falta.
5. **Jornada** (entrada, descanso, salida), una vez decidido quién la ve.
6. **Informes de horas:** por cliente y tipo, horas extra, CSV; aquí se decide la tarifa.

## Reglas heredadas del proyecto que aplican

- Código y textos en español y en tú; componentes Quasar y colores de la paleta `dg-*`; vistas responsivas.
- Toda tabla o archivo nuevo se pregunta antes. Pruebas con cuentas `zz_test_` y 0 filas sobrantes.
- Respaldo de la base antes de cualquier cambio de estructura en producción. El seed crea las tablas (`CREATE TABLE IF NOT EXISTS`), como las de auditorías.

## Pendientes y riesgos anotados

- Un mismo cliente que lleven dos contadores existe dos veces: un informe del despacho por cliente tendría que juntarlos por nombre o RFC.
- Qué ve el administrador de las horas y de la jornada se decide en las rebanadas 5 y 6.
- La regla fiscal (día 17 + días extra por sexto dígito del RFC, festivos LFT) hay que validarla con los contadores: no incluye Semana Santa ni otros días inhábiles del SAT.
