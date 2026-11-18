# 25 — Vista de año y vencimientos de casos en «Juntas»

- **Riesgo:** medio (solo frontend; reutiliza endpoints existentes)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Historia

Como usuario del calendario, quiero una vista de año para ubicar rápido los días con juntas, y ver en el calendario los vencimientos de mis casos para no agendar juntas encima de una entrega.

## Criterios de aceptación

1. **Vista Año:**
   - El selector pasa a ser Año | Mes | Semana | Día (`?vista=anio`).
   - Muestra 12 meses compactos (lunes a domingo). Cada día con juntas lleva un indicador con el número de juntas, y su texto accesible dice «18 de noviembre: 2 juntas».
   - Al hacer clic en un día se abre la vista Día de esa fecha.
   - Los botones «Anterior» y «Siguiente» mueven de año en año; el título es «2026».
   - Pide `GET /juntas` (o la agenda de la 23, si hay otra persona elegida) con el rango del 1 de enero al 31 de diciembre, que cabe en el máximo de 400 días.
   - Hasta 600 px se ven 1 o 2 meses por fila, sin scroll horizontal.
2. **Vencimientos de casos en Mes, Semana y Día:**
   - **Contador y auxiliar:** salen de sus casos (`GET /casos/mis-casos`, o del store de casos si ya está cargado).
   - **Administrador:** salen de `GET /contadores/casos-importantes`.
   - **Recepcionista:** no ve vencimientos ni el interruptor.
   - Solo cuentan los casos que no están Finalizados, por su `fecha_vencimiento`.
   - Cada vencimiento sale como una etiqueta de día completo (arriba en Semana y Día, dentro de la celda en Mes) con el texto «Vence: {cliente}», el color de su prioridad y el texto «Importante» si lo es.
   - Al hacer clic:
     - contador o auxiliar → «Mis casos» con `?casoId=`;
     - administrador → su resumen con `?dia=AAAA-MM-DD`.
3. **Interruptor «Mostrar vencimientos de casos»:**
   - Encendido por defecto.
   - Se recuerda por persona en `localStorage`, siempre dentro de `try/catch`, con el patrón de `preferenciaMenu.js`.
   - En la agenda de otra persona (23) los vencimientos no se muestran.
4. **Fechas:** `fecha_vencimiento` es una DATE `AAAA-MM-DD`. Se compara como texto o con `parseFechaInicio`, nunca con `new Date('AAAA-MM-DD')`.
5. **Carga:** si la carga de vencimientos falla, el calendario de juntas se sigue viendo y aparece un aviso discreto: «No se pudieron cargar los vencimientos. Reintentar».
6. **Estilo:** Quasar, paleta `$dg-colores` y la etiqueta de prioridad existente (`PriorityTag`/`etiquetaSemaforo`), textos en tú y tooltips en los botones de icono.

## Archivos autorizados

- `src/pages/JuntasPage.vue`, `src/components/CalendarioJuntas.vue` y `src/components/AnioJuntas.vue` (nuevo)
- `src/utils/juntas.js` y `src/utils/vencimientosEnCalendario.js` (nuevo)
- `src/services/juntaService.js` (solo si hace falta)
- `test/juntas*.test.js` y `test/vencimientosEnCalendario.test.js` (nuevo)

No se toca el backend ni las pantallas existentes. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Reutilizar `caseService`/`counterService` y el store de casos tal como están. Si se necesita algo que no exista, parar y preguntar.
- Navegador: un contador `zz_test_` con un caso `zz_test_` que vence esta semana (crearlo con `soporte-pruebas/bd.js`). Revisar la vista Año en escritorio y a 375 px, el interruptor y el clic hacia «Mis casos».
- Al terminar, 0 filas `zz_test_%`, 0 juntas y 0 casos de prueba.

---

## Reporte del implementer

1. **Rebanada completada:** sí, solo en el frontend.
   - **Vista Año** (`?vista=anio`, `AnioJuntas.vue`): cada día muestra su conteo de juntas con texto accesible y abre la vista Día de esa fecha.
   - **Vencimientos** en Mes, Semana y Día: etiqueta «Vence: {cliente}» con la prioridad escrita y la marca «Importante».
   - **Fuentes:** el contador y el auxiliar usan `getMisCasos`; el administrador, `getCasosImportantesCalendario`; la recepcionista no ve vencimientos.
   - **Interruptor:** se guarda en `localStorage` por persona.
   - **Error de carga:** aparece un aviso con «Reintentar» y el calendario sigue visible.
2. **Archivos:**
   - Modificados: `JuntasPage.vue`, `CalendarioJuntas.vue`, `juntas.js` y `test/juntasUtils.test.js`.
   - Nuevos: `AnioJuntas.vue`, `vencimientosEnCalendario.js`, `test/vencimientosEnCalendario.test.js` y `test/juntasAnioVencimientosPantalla.test.js`.
3. **Prueba en rojo:** con esqueletos vacíos, los tres archivos de prueba fallaron por aserto (la pantalla, 12 de 12).
4. **Puertas:** `lint:check`, `prettier --check` y `build` en verde; `node --test` 1576/1576. En el navegador, en escritorio, a 375 px y a 600 px, se comprobó:
   - las 4 vistas;
   - el clic en un vencimiento, que lleva a «Mis casos» con el caso resaltado (contador) o a `admin-dashboard?dia=` (administrador);
   - el interruptor y su persistencia;
   - la recepcionista no ve vencimientos;
   - un fallo simulado de la carga de vencimientos.
   - Quedan 0 datos de prueba.
5. **Decisiones no cubiertas:**
   - **Fuente de datos:** usa siempre el servicio y no el store de casos, para no alterar «Mis casos».
   - **Vista Año:** no muestra vencimientos.
   - **Prueba ajustada:** en `juntasUtils.test.js` la vista inválida de ejemplo pasó de `anio` a `trimestre`.
   - **Vista Semana:** solo muestra de lunes a viernes, así que no salen los vencimientos de fin de semana.
   - **Prioridad:** la etiqueta usa las variables `--dg-prioridad-*` sin el componente `PriorityTag`.
   - **Días sin juntas en la vista Año:** el texto accesible dice «sin juntas».
6. **Para la memoria:**
   - `head-day-event` es el slot de QCalendarDay para las etiquetas de día completo.
   - La clave de la preferencia es `delgrow_juntas_vencimientos_{id}`.
   - Opcional: mostrar el nombre del contador en los vencimientos que ve el administrador.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 6 criterios.
- Puertas: `lint:check` y `build` en verde; `node --test` 1576/1576.
- Comprobó por código el año bisiesto, las fechas comparadas como texto, la fuente de datos por rol, los enlaces, el `try/catch` y la compatibilidad con `?juntaId=` y `?agenda=`.
- No probó en el navegador.

**Opcionales:**

- La vista Semana no muestra los vencimientos de fin de semana.
- El administrador ve los vencimientos sin el nombre del contador.
- Las pruebas de pantalla son estáticas.

## Cierre del orquestador

- **Navegador, con un contador `zz_test_`:**
  - La vista Año pide `/juntas?desde=2026-01-01&hasta=2026-12-31`, muestra el título «2026» y los 30 días de noviembre con su `aria-label`.
  - En la vista Año el interruptor no aparece, como se decidió.
  - La vista Mes pide del 26-10 al 06-12 y `/casos/mis-casos`, muestra el interruptor «Mostrar vencimientos de casos» y no hay error ni scroll horizontal.
- **Datos de prueba:** quedan 0 filas `zz_test_%` y 0 casos de prueba; en `juntas` siguen solo las 2 del usuario.
- **Estado:** aprobada.
