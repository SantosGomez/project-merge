# 38 — El contador pasa un caso existente dentro de su equipo

- **Riesgo:** alto (cambia el dueño de un caso: permisos y datos)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer` con modelo Opus)
- **Estado:** refinada

## Historia

Como contadora con auxiliares, quiero pasar un caso que ya existe a uno de mis auxiliares (o regresármelo, o moverlo de un auxiliar a otro), para repartir el trabajo sin volver a capturarlo.

## Criterios de aceptación

### Backend
1. `PATCH /casos/:id/responsable` con `{ responsable_id }`. Ruta en `caseRoutes.js`, controlador `pasarCaso` en `CaseController.js`, modelo `CaseModel.cambiarResponsable`.
2. Solo el rol contador (auxiliar, administrador, etc. → 403).
3. El caso debe ser del contador o de uno de sus auxiliares (si no: 404, como `checkCaseOwnership` para casos ajenos).
4. `responsable_id` debe ser el propio contador o uno de sus auxiliares (si no: 400 con `buildError` sobre «responsable»). Si es el dueño actual: 400 («El caso ya es de esa persona»).
5. Solo cambia `contador_id` (y `actualizado_en` si existe). No cambian estado, prioridad, fechas, «Importante» ni observaciones.
6. Avisos, en la misma transacción que el cambio:
   - A quien lo recibe (si no es el propio contador): «{contador} te pasó el caso «{cliente}».»
   - A quien lo pierde (si no es el propio contador): «{contador} te quitó el caso «{cliente}» y se lo pasó a {nuevo}.»; si el nuevo dueño es el propio contador: «{contador} te quitó el caso «{cliente}» y lo regresó a su lista.»
   - Ambos con `caso_id`. SSE `aviso-nuevo` a cada destinatario y `caso-actualizado` a los administradores.
7. Respuesta 200 `{ mensaje: 'Caso pasado correctamente', caso }`.
8. Ruta agregada a `test/autorizacionMatriz.test.js` (y a `inyeccionSql.test.js` si aplica).

### Frontend
9. En `CasoItem.vue`, acción nueva «Pasar a…» (icono `swap_horiz`, tooltip «Pasa este caso a otra persona de tu equipo») con un `q-menu` (`jump-down` 180 ms) que lista al contador («A mí») y a sus auxiliares, sin el dueño actual. Al elegir, confirma con un diálogo corto («¿Pasar «{cliente}» a {nombre}?») y guarda.
10. Solo la ve el contador que tiene al menos un auxiliar, en «Mis casos» y en el detalle de «Mi equipo». No sale en la vista `soloLectura` del administrador ni para el auxiliar.
11. Al guardar, el caso se mueve de dueño en el store (sin recargar) y sale un `$q.notify` «Caso pasado a {nombre}». Si falla, mensaje de error en tres partes.

## Archivos autorizados

- Backend: `src/routes/caseRoutes.js`, `src/controllers/CaseController.js`, `src/models/CaseModel.js`, `src/models/AuxiliarModel.js` (solo consultas), pruebas nuevas en `test/` (y en `MINIMOS`), `test/autorizacionMatriz.test.js`, `test/inyeccionSql.test.js`.
- Frontend: `src/components/CasoItem.vue`, `src/pages/MyCasesPage.vue`, `src/components/MiEquipo.vue`, `src/stores/cases.js`, `src/services/caseService.js`, utilidades puras con prueba en `src/utils/` y `test/`.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-20): la contadora pasa casos suyos a un auxiliar, los regresa a sí misma o los mueve entre auxiliares, siempre dentro de su equipo; el auxiliar no pasa casos; se avisa a quien lo recibe y a quien lo pierde.
- Depende de la rebanada 37 solo en que ambas tocan `caseRoutes.js`/`CaseController.js`/`MiEquipo.vue`: se implementa después de la 37.
- Un caso «Importante» de un auxiliar sigue contando para el administrador en el detalle del contador («de {auxiliar}»); pasarlo no cambia la marca.
- Textos sin género: preferir «lo regresó a su lista» en lugar de «lo tomó ella».
- No entra: que el administrador pase casos entre contadores; historial de dueños.

---

## Reporte del implementer

1. Rebanada completada: sí, sin navegador (lo prueba el orquestador).
2. Archivos modificados:
   - Backend: `caseRoutes.js` (con `requireContador`, antes de `/:id/prioridad`), `CaseController.js` (`pasarCaso`), `CaseModel.js` (`cambiarResponsable`, solo `contador_id` y `actualizado_en`), `test/contadorPasaCasoAEquipo.test.js` (8), `MINIMOS`, `autorizacionMatriz.test.js` e `inyeccionSql.test.js`.
   - Frontend: `utils/pasarCaso.js` (nuevo), `test/contadorPasaCasoAEquipo.test.js` (13), `caseService.js`, `stores/cases.js`, `CasoItem.vue` (prop `equipoParaPasar`, emit `pasar`, `q-menu`), `MyCasesPage.vue` y `MiEquipo.vue`.
3. Prueba en rojo y por qué falló: en el backend la ruta no existía (404 donde se esperaba otra respuesta). En el frontend faltaban el módulo y las funciones.
4. Puertas (verde / rojo / no aplica): backend 858/858 y `verificarPruebas.js` OK. Frontend: `lint:check`, `build` y `node --test` 1779/1779 en verde. `prettier --check` en verde en los archivos nuevos y en `MiEquipo.vue`; los demás ya fallaban en HEAD (solo se ajustaron las líneas nuevas).
5. Decisiones no cubiertas:
   - Un caso ajeno da 404 (validado en el controlador; `checkCaseOwnership` da 403).
   - Un `responsable_id` inválido o fuera del equipo da 400 «Responsable no válido».
   - El destino propio se llama «A mí» en el menú y «tu lista» en el diálogo y el aviso.
   - El store rellena `nombre_contador`, porque la respuesta no lo trae.
   - La acción no sale en casos `soloEstado` (los del contador al que apoyas), en la vista `soloLectura` ni para el auxiliar.
   - La confirmación con `$q.dialog` está repetida en «Mis casos» y en «Mi equipo».
6. Para la memoria: `PATCH /casos/:id/responsable`; `utils/pasarCaso.js`.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: CAMBIOS NECESARIOS (`reviewer` con Opus)

- Puertas en verde: backend 858 y frontend 1779. Permisos, ids raros, atomicidad del UPDATE con los avisos y «solo cambia `contador_id`» están bien.
- **Bloqueante:** el dueño anterior y el equipo se leen fuera de la transacción, y `cambiarResponsable` filtra solo `WHERE id = ?`.
  - Con dos pases a la vez, los avisos salen mal y uno de los que lo pierden no se entera.
  - Si un auxiliar se desvincula entre la consulta y el UPDATE, el caso puede salir del equipo.
  - Se espera un UPDATE condicional: dueño anterior leído, nuevo y anterior todavía en el equipo, y revisar `affectedRows`. Si son 0 filas, 409 con `buildError` y sin avisos. Además, una prueba que falle sin esto.
- Opcionales:
  1. En la prueba de caso ajeno, comprobar también el `mensaje` del 404.
  2. Agregar `responsable_id` a `CAMPOS` de `inyeccionSql` y `-1` a los destinos inválidos.
  3. Ordenar los comentarios de `caseRoutes.js:34-35` y corregir el formato de `} =require(` en la línea 13.
  4. La confirmación está repetida en dos pantallas.

## Vuelta 2 (encargo del orquestador)

- El bloqueante.
- Los opcionales 1, 2 y 3.
- Deshabilitar «Pasar a…» mientras se guarda ese caso (`guardandoId`), en «Mis casos» y en «Mi equipo», para evitar el doble envío.
- En el frontend, si llega el 409, mensaje de error en tres partes y releer la lista en silencio.

## Reporte del implementer (vuelta 2)

- **Bloqueante resuelto:** `cambiarResponsable(id, { anteriorId, nuevoId, contadorId }, ejecutar)` hace un UPDATE condicional (dueño leído; nuevo y anterior siguen en el equipo o son el contador) y devuelve `affectedRows === 1`. Con 0 filas, `pasarCaso` responde 409 «El caso cambió mientras lo pasabas», sin avisos ni SSE.
- **Opcionales 1 a 3 aplicados:** mensaje del 404; `responsable_id` en `CAMPOS` y `-1`; comentarios de `caseRoutes.js` ordenados y formato de `require` corregido.
- **Frontend:**
  - «Pasar a…» se deshabilita mientras se guarda: `guardandoId` en «Mis casos» y `pasandoId` en «Mi equipo».
  - Con un 409, error en tres partes y `refrescarEnSilencio()`.
- **Pruebas en rojo:**
  - 3 pruebas directas de `cambiarResponsable`, que fallaban con la firma anterior.
  - 1 de HTTP: con el auxiliar desvinculado respondía 200 en vez de 409.
  - 2 de plantilla.
- **Puertas:** backend 862/862, `verificarPruebas.js` OK y `contadorPasaCasoAEquipo` 12/12. Frontend: `lint:check` y `build` en verde, `node --test` 1781/1781. 0 cuentas `zz_test_`.
- **Nota:** la carrera en HTTP se simula con un mock de `listarAuxiliares`; la atomicidad real la cubren las pruebas directas del modelo.

## Veredicto del reviewer (vuelta 2)

VEREDICTO: APROBADA (`reviewer` con Opus)

- Bloqueante resuelto. InnoDB vuelve a evaluar el WHERE con el dato ya confirmado, así que con dos pases a la vez o un auxiliar desvinculado a medio camino el UPDATE cambia 0 filas y la respuesta es 409, sin avisos ni SSE. Las pruebas nuevas fallan con la versión anterior.
- Frontend correcto: deshabilita la fila mientras se pasa el caso; con el 409 muestra el error en tres partes y relee la lista.
- Puertas: backend 862 (`verificarPruebas.js` OK) y frontend 1781/1781.
- Opcionales sin aplicar: el aviso usa el `cliente` leído antes de la transacción (muy improbable que importe); la confirmación sigue repetida en dos pantallas.

## Comprobación en navegador (orquestador, 2026-11-20)

- Vuelta 1:
  - El menú «Pasar a…» muestra «A mí» y los auxiliares, sin el dueño actual, y confirma antes de pasar.
  - Al pasar el caso cambia «de {auxiliar}» sin recargar; la marca Importante, el estado y la prioridad no cambian.
  - «A mí» regresa el caso a la contadora y se puede volver a pasar.
  - Los avisos de quien recibe y de quien pierde se comprobaron en la base.
  - La acción está también en «Mi equipo». A 375 px no hay desborde.
- Vuelta 2: con la página abierta se desvinculó al auxiliar en la base y se intentó pasarle un caso. La respuesta fue 400 «Responsable no válido» (el backend ve el cambio antes del UPDATE), con error en tres partes y el caso sin mover. El 409 solo se da en la carrera real y lo cubren las pruebas.
- Opcional: después de un 400, el auxiliar desvinculado sigue en el menú hasta recargar (el 400 no relee la lista de auxiliares).
- Trampa: con el panel del navegador oculto, las animaciones van a ~1 cuadro/s y los clics por coordenadas fallan; usar `ref` y esperar 4–5 s.
- 0 filas `zz_test_` al terminar.
