# 45 — Dashboard de documentos por mes de recepción

- **Riesgo:** medio (consulta del backend y fechas)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`)
- **Estado:** refinada

## Historia

Como contador (o administrador), quiero que el documento que marco como completado siga en el Dashboard del mes y cuente en «Completados», para no perder de vista lo terminado.

## Bug

`GET /doc/documentos` (`rutaListaDocumentos`, `Backend/src/modulos/documentos/rutas/documentos.mjs`) filtra por **periodo contable** (`d.periodo = ?`) más lo que sigue en trámite de periodos anteriores. Un documento recibido en noviembre con periodo 2026-01, al pasar a `COMPLETADO`, sale de la consulta y desaparece; la tarjeta «Completados» (`coincideConTarjeta` en `composables/resumenDocumentos.js`) tampoco lo cuenta porque compara `documento.periodo`. Caso real en la base de prueba: DCA-2026-0011 (periodo 2026-01, recibido 2026-11-25, completado).

## Decisión del usuario (2026-11-25)

El mes del Dashboard se compara contra el **mes de la fecha de recepción** (`d.fecha_recepcion`), no contra el periodo contable.

## Criterios de aceptación

1. Backend: la consulta trae los documentos **recibidos en el mes elegido** (rango de `fecha_recepcion` del primer día del mes al primero del siguiente, en hora local, sin `DATE_FORMAT` sobre la columna si se puede usar rango), más los que siguen en trámite (`RECEPCIONADO`, `EN_PROCESO`, `PENDIENTE_CLIENTE`) recibidos **antes** de ese mes. El parámetro sigue llamándose `periodo` (`AAAA-MM`) para no cambiar el contrato ni el frontend que lo envía. El filtro «mis documentos» y el resto de columnas no cambian.
2. Frontend: en `resumenDocumentos.js`, «del mes» se decide con los 7 primeros caracteres de `fechaRecepcion` (llega `AAAA-MM-DDTHH:mm:ss` local, sin Z: no usar `new Date` para esto). Así «Recibidos» y «Completados» cuentan lo recibido en el mes, y el filtro de la tabla al pulsar la tarjeta sigue la misma regla.
3. Un documento recibido en el mes con periodo contable de otro mes aparece en la tabla con cualquier estado y, si está `COMPLETADO`, cuenta en «Completados» y aparece al pulsar esa tarjeta.
4. Textos del Dashboard que digan «periodo» para el selector del mes o el pie de las tarjetas se revisan para que no confundan (por ejemplo, «Recibidos en noviembre 2026»); solo cambiar los que hagan falta y avisar en el reporte cuáles.
5. Pruebas: backend (documento de otro periodo contable recibido en el mes y completado sí sale; completado recibido en un mes anterior no sale; en trámite de un mes anterior sí sale) y frontend (`resumenDocumentos` con `fechaRecepcion`). Actualizar las pruebas existentes que fijaban la regla por `periodo`, explicando cada una en el reporte.

## Archivos autorizados

- `Backend/src/modulos/documentos/rutas/documentos.mjs` (solo `rutaListaDocumentos`) y `rutas/documentos.test.mjs`
- `Backend/test/documentosModulo.test.js` (si alguna prueba de punta a punta fija la regla vieja)
- `Seguimiento-proyectos/src/modulos/documentos/composables/resumenDocumentos.js` y su prueba
- `Seguimiento-proyectos/src/modulos/documentos/pages/DashboardPage.vue` y sus pruebas (`DashboardPage*.test.js`)

Fuera de esta lista, el implementer para y pregunta. No tocar Clientes/semáforo (`GET /doc/clientes`), Direccionamiento ni Seguimiento.

## Notas del orquestador

- No cambiar el esquema. `periodo` del documento sigue siendo el periodo contable que se captura en Recepción y se muestra donde ya se muestra.
- Fechas: `fecha_recepcion` es DATETIME local; las respuestas usan `aTextoLocal`. Nunca `new Date('AAAA-MM-DD')`.
- Datos de prueba `zz_test_` / `@ejemplo.com`; 0 filas `zz_test_%` al terminar.

---

## Reporte del implementer

1. Rebanada completada: `rutaListaDocumentos` filtra por rango de `fecha_recepcion` (`AAAA-MM-01 00:00:00` al primero del mes siguiente; diciembre pasa a enero) más lo en trámite recibido antes; `resumenDocumentos.js` usa `fechaRecepcion.slice(0, 7)`.
2. Archivos modificados: `rutas/documentos.mjs` (solo `rutaListaDocumentos`), `rutas/documentos.test.mjs`, `composables/resumenDocumentos.js` (+test), `pages/DashboardPage.vue` (textos), nuevo `pages/DashboardPage.mesRecepcion.test.js`.
3. Prueba en rojo y por qué falló: 10 del backend (parámetros y doble de la base por `periodo`, más pruebas nuevas contra MariaDB) y 3 de `resumenDocumentos`, más 4 de textos del Dashboard.
4. Puertas: backend verde (documentos 43, `documentosModulo` 16, `autorizacionMatriz` 39, documentos 279; `verificarPruebas` OK 908). Frontend lint, prettier, build y `node --test` (2137) verdes. 0 filas `zz_test_%`. Navegador: no aplicado.
5. Decisiones no cubiertas: textos nuevos («Mes de recepción», «Recibidos en {mes}», «Recibidos en {mes} y terminados», subtítulo y tabla vacía); la columna «Periodo» sigue siendo el contable; el helper de la prueba contra MariaDB filtra por la marca `ZZT…` para no mezclar documentos reales.
6. Para la memoria: el mes del Dashboard de documentos se rige por `fecha_recepcion`; el parámetro sigue llamándose `periodo`.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA

- Criterios 1 a 5 cumplidos; límites del mes (diciembre→enero, 31 23:59:59 contra 1 00:00:00) probados; sin conversión UTC; «mis documentos» intacto; pruebas no relajadas. Puertas: `documentos.test.mjs` 43/43, `documentosModulo` 16/16, lint y `node --test` 2137/2137.
- Opcionales: `documentosModulo.test.js` ya no ejercita la rama «recibido en el mes» (la cubre `documentos.test.mjs`); `periodo` con mes 00 o 13 da un rango inválido (previo a esta rebanada).
