# 16 — Informes de horas

- **Riesgo:** medio (consultas de agregación y exportación; sin tablas nuevas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, sonnet)
- **Estado:** refinada y aprobada por el usuario («sigue con las demás hasta terminar», 2026-11-13); rama `experimento`

## Historia

Como contador o auxiliar, quiero ver cuántas horas dediqué a cada cliente y a cada tipo de actividad en un periodo y descargarlo, para cuantificar mi tiempo.

## Criterios de aceptación

1. «Mis actividades» tiene una cuarta vista **«Informes»** en el conmutador (`?vista=informes`).
2. **Filtros:** «Desde» y «Hasta» (por defecto, el mes actual; botón «Este mes»), cliente y tipo de actividad (incluyen los desactivados que tengan tiempo en el periodo). «Desde» no puede ser posterior a «Hasta»; el periodo máximo es de 366 días.
3. **Resumen:** horas totales, horas cobrables y no cobrables (según la marca guardada en cada bloque), días con tiempo registrado, y —de la jornada— horas trabajadas, horas extra contra la jornada base y tiempo sin asignar a actividades. Si no hay jornadas en el periodo, esa parte lo dice en vez de mostrar ceros.
4. **Horas por cliente** y **horas por tipo:** listas ordenadas de mayor a menor con una barra proporcional (`q-linear-progress`), las horas y el porcentaje en texto.
5. **Detalle:** tabla de bloques (fecha, cliente, tipo, inicio, fin, duración, cobrable, «a mano»), más recientes primero, paginada; en móvil se muestra como tarjetas.
6. **Jornadas del periodo:** tabla con fecha, las cuatro horas, trabajado y extra.
7. **CSV:** «Descargar CSV» baja el detalle del periodo filtrado (columnas: Fecha, Cliente, Tipo, Inicio, Fin, Minutos, Horas, Cobrable, A mano), con BOM UTF-8 para Excel, separador coma, comillas escapadas y nombre `actividades_AAAA-MM-DD_a_AAAA-MM-DD.csv`. Se genera en el navegador con `Blob` y un enlace de descarga. Los valores que empiecen con `=`, `+`, `-` o `@` se neutralizan para que Excel no los tome como fórmula.
8. **Sin tarifa ni importes** (decisión del usuario). El cronómetro en marcha no cuenta hasta que se detiene.
9. **Privacidad:** cada quien ve solo lo suyo; solo roles `contador` y `auxiliar` (los demás 403). No hay vista para el administrador.
10. **Endpoint** `GET /informes/tiempo?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&cliente_id=&tipo_id=` → `{ resumen, por_cliente, por_tipo, bloques, jornadas }`; fechas inválidas, rango invertido o mayor a 366 días → 400 en tres partes y en tú. La agregación se hace en el servidor.
11. Estados de carga, vacío («No registraste tiempo en este periodo.») y error con «Reintentar». Convenciones del proyecto: español y en tú, tooltips, Quasar, paleta `dg-*`, accesibilidad (las barras tienen su valor en texto), responsivo y móvil, contrato de fechas de AGENTS.md.
12. `verificarPruebas.js` en verde con los archivos nuevos en `MINIMOS`.

## Archivos autorizados

Backend (`Backend/`):
- `src/models/InformeTiempoModel.js`, `src/controllers/InformeTiempoController.js`, `src/routes/informeRoutes.js` (nuevos)
- `src/utils/jornada.js` (reutilizar el cálculo de minutos trabajados; sin cambiar su comportamiento)
- `src/app.js` (solo montar `/informes`)
- `test/informesTiempo.test.js` (nuevo)
- `soporte-pruebas/verificarPruebas.js` (solo `MINIMOS`)

Frontend (`Seguimiento-proyectos/`):
- `src/components/MisActividades.vue` (cuarta vista), `src/components/InformesActividades.vue` (nuevo)
- `src/services/informeService.js` (nuevo)
- `src/utils/informes.js` (nuevo: armado del CSV, porcentajes, formato de horas)
- `test/informesActividades.test.js` (nuevo) y ajustes mínimos a `test/misActividades.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Referencia de lógica: `renderInformes`, `agrupa`, `barras` y `csvDown` de la agenda original.
- Un bloque pertenece al día de su `inicio`.
- Fuera de esta rebanada: tarifa e importes, informe del despacho para el administrador, gráficas, exportar a Excel o PDF.
- PROHIBIDO en pruebas el DDL destructivo: la base de XAMPP se comparte con el backend de desarrollo.
- Pruebas del backend por archivo; cuentas `zz_test_`; 0 filas nuevas `zz_test_%` en XAMPP al terminar.

---

## Reporte del implementer

1. Rebanada completada: los 12 criterios (2026-11-13). Cierra el feature (rebanadas 10 a 16).
2. Archivos: backend nuevos `InformeTiempoModel.js`, `InformeTiempoController.js`, `informeRoutes.js`, `test/informesTiempo.test.js` (14); modificados `app.js` y `MINIMOS`. Frontend nuevos `InformesActividades.vue`, `informeService.js`, `utils/informes.js`, `test/informesActividades.test.js` (28); modificado `MisActividades.vue` (cuarta vista).
3. Prueba en rojo y por qué falló: `GET /informes/tiempo` devolvía 404; en el frontend, `informeService.js` inexistente. Las pruebas del componente se escribieron junto con las de utilidades.
4. Puertas: backend `informesTiempo` 14 y `verificarPruebas.js` OK (55 archivos, 535 pruebas); frontend 1337/1337, build y lint; navegador en escritorio y 375 px, con el resumen comparado contra SQL independiente. Sin verificar: el CSV abierto en Excel, Electron, anchos menores a 375 px, tableta, cuenta de auxiliar.
5. Decisiones no cubiertas: `resumen.jornada` es un objeto o `null` si no hay jornadas; la jornada y «sin asignar» no dependen de los filtros de cliente ni de tipo (la pantalla lo avisa); porcentajes enteros por mayor residuo (suman 100); un `cliente_id` o `tipo_id` ajeno devuelve 200 vacío, igual que uno inexistente; 366 días pasa y 367 da 400; el CSV lleva fechas `AAAA-MM-DD`, horas decimales con punto y neutraliza también tabulador y retorno de carro; los selectores ofrecen todos los clientes y tipos con «(desactivado)»; los filtros se aplican solos.
6. Para la memoria: ver MEMORY.md.

## Veredicto del reviewer (vuelta 1)

**APROBADO** (reviewer con Sonnet, 2026-11-13, sin modificar archivos). Privacidad correcta; exactitud comprobada con SQL independiente sobre 82 bloques y 12 jornadas (totales, cobrables, por cliente, por tipo, trabajado, extra y sin asignar coinciden); límites del rango, SQL parametrizado, CSV y ausencia de XSS correctos.

Bajo, sin aplicar aquí (pasa a la revisión de UI/UX): en móvil las tarjetas del detalle de bloques salen con anchos desiguales. Opcionales: al cambiar un filtro se sigue viendo el informe anterior sin indicador de carga; una línea de comentario larga en `MisActividades.vue`. Sin verificar: descarga real del CSV, error con «Reintentar» en navegador y tablas en escritorio ancho.
