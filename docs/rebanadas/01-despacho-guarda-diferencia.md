# 01 — El despacho guarda solo la diferencia

- **Riesgo:** alto (permisos de equipo, cambio de contrato de una ruta y escritura en varias filas)
- **Implementa:** Claude (orquestador, con la skill tdd)
- **Revisa:** opencode (`reviewer`; respaldo `opencode/deepseek-v4.1-flash-free`)
- **Estado:** aprobada por el reviewer en la vuelta 1 (2026-11-10); pendiente de commit

## Historia

Como despacho (administrador o usuario de sistema), quiero que «Contadores que apoya» guarde solo lo que yo marqué o desmarqué, para no borrar sin querer el vínculo que un contador agregó por su cuenta mientras yo tenía el diálogo abierto.

## Criterios de aceptación

1. **No se pisa lo ajeno.** Con el auxiliar vinculado a Uno, el despacho abre el diálogo; mientras tanto el contador Dos lo agrega desde «Mis auxiliares»; el despacho desmarca a Uno y guarda. Resultado: el auxiliar queda solo con Dos. El diálogo envía únicamente la diferencia contra lo que cargó al abrir (`{ agregar, quitar }`) y, si no hubo cambios, cierra sin llamar al servidor.
2. **Todo o nada.** `PUT /usuarios/:id/contadores` recibe `{ agregar: [ids], quitar: [ids] }` y aplica el cambio en una transacción: si un id no es válido (no existe, no es contador, la cuenta no es auxiliar, el mismo id viene en las dos listas) o falla una escritura a medias, no cambia nada y responde el error de siempre. El cuerpo anterior `{ contadores: [...] }` se rechaza con 400.
3. **Repetir no rompe ni duplica.** Agregar a un contador que ya estaba vinculado no duplica la fila ni vuelve a avisar; quitar a uno que ya no estaba no da error. Solo se avisa de los vínculos realmente nuevos (como hoy). El alta de un auxiliar con contadores (`POST /usuarios`) sigue vinculando en el mismo paso.

## Archivos autorizados

Backend:

- `Backend/src/models/AuxiliarModel.js` — `ajustarContadoresDeAuxiliar(auxiliarId, { agregar, quitar })` con `conTransaccion`, devuelve `{ agregados, quitados }`; sustituye a `reemplazarContadoresDeAuxiliar`.
- `Backend/src/controllers/AuxiliarController.js` — el `PUT` lee `{ agregar, quitar }`.
- `Backend/src/controllers/UserController.js` — solo la línea del alta que hoy llama a `reemplazarContadoresDeAuxiliar` (pasa a `agregar`).
- `Backend/test/contadoresDeAuxiliar.test.js` — contrato nuevo y prueba cruzada de las dos vías.
- `Backend/test/auxiliarModel.test.js` — solo si hoy prueba `reemplazarContadoresDeAuxiliar`.

Frontend:

- `Seguimiento-proyectos/src/services/userService.js` — `guardarContadoresDeAuxiliar(auxiliarId, { agregar, quitar })`.
- `Seguimiento-proyectos/src/components/ContadoresDeAuxiliarDialog.vue` — recuerda lo cargado y envía la diferencia. Sin cambios visuales.
- `Seguimiento-proyectos/test/contadoresDeAuxiliar.test.js`.
- Función pura para calcular la diferencia: dentro de un archivo existente de `src/utils/` si encaja; si hiciera falta un archivo nuevo, se pregunta antes.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario (2026-11-10): **opción B** — ambos ajustan, el despacho ajusta cualquier equipo y todo se avisa. Sin cambio en la tabla `contador_auxiliar`.
- Se eligió `{ agregar, quitar }` y no «lista completa + transacción»: la transacción sola no arregla la lista vieja, porque el despacho seguiría mandando una foto antigua del equipo.
- Las rutas siguen con `requireAdminOrSistema` (administrador y sistema pesan igual para armar equipos).
- **NO entra:** avisos al quitar (rebanada 02), aviso cuando el contador asigna (03), aviso al administrador (04), textos de ayuda (05). El texto del diálogo no se toca aquí.
- Trampas: pruebas del backend por archivo (todas juntas se cuelgan); `verificarPruebas.js` puede dar FALLA por `MINIMOS` desactualizados (defecto previo: se reporta, no se arregla aquí); el `.vue` puede tener CRLF; al terminar, 0 filas `zz_test_%` nuevas.
- Puertas: Backend `node --test test/<archivo>` y `node soporte-pruebas/verificarPruebas.js`; Frontend `npm run lint:check`, `npm run build`, `node --test` y navegador (`backend-experimento-3011` + `frontend-experimento-9012`), incluida la vista móvil.

---

## Reporte del implementer

1. Rebanada completada: sí (2026-11-10). `PUT /usuarios/:id/contadores` recibe `{ agregar, quitar }`, el modelo lo aplica en una transacción y el diálogo envía solo la diferencia.
2. Archivos modificados: `Backend/src/models/AuxiliarModel.js` (`ajustarContadoresDeAuxiliar` sustituye a `reemplazarContadoresDeAuxiliar`), `Backend/src/controllers/AuxiliarController.js`, `Backend/src/controllers/UserController.js` (línea del alta), `Backend/test/contadoresDeAuxiliar.test.js`, `Seguimiento-proyectos/src/services/userService.js` (`calcularCambiosDeContadores` y servicio), `Seguimiento-proyectos/src/components/ContadoresDeAuxiliarDialog.vue`, `Seguimiento-proyectos/test/contadoresDeAuxiliar.test.js`. `auxiliarModel.test.js` no se tocó (no probaba la función sustituida). Sin archivos nuevos.
3. Prueba en rojo y por qué falló:
   - Backend, «el despacho no pisa al contador que agregó al auxiliar mientras el diálogo estaba abierto»: falló porque la ruta no entendía `{ agregar, quitar }` (el equipo quedaba vacío). Verde con el modelo y el controlador nuevos.
   - Frontend: falló porque `userService.js` no exportaba `calcularCambiosDeContadores`. Verde con el servicio y el diálogo.
   - Las pruebas «repetir un cambio…» y «rechaza datos inválidos…» se escribieron después del modelo (salieron en verde a la primera); la prueba anterior «vincula, consulta y desvincula» sí pasó por rojo al cambiar el contrato.
4. Puertas:
   - Backend `node --test` por archivo: `contadoresDeAuxiliar` 7/7, `auxiliarModel` 9/9, `auxiliarRoutes` 8/8, `rolAuxiliar` 10/10 — verde.
   - Backend `verificarPruebas.js`: 383 pruebas, 0 fallidas; RESULTADO «FALLA» solo por la tabla `MINIMOS` desactualizada (`rolAuxiliar.test.js` sin mínimo, `userModel.test.js` bajo el mínimo). Defecto previo, no de esta rebanada.
   - Frontend `npm run lint:check` (salida 0), `npm run build`, `node --test` 1035/1035 — verde.
   - Navegador (3011 + 9012, cuentas `zz_test_`): agregar a Uno → guardado; con el diálogo abierto mostrando a Uno, el contador Dos se agregó por su vía, se desmarcó a Uno y se guardó → el auxiliar quedó solo con Dos; guardar sin cambios cerró sin `PUT` ni aviso; sin errores de consola; en 375 px el diálogo mide 311 px sin desborde. Verde.
   - Datos de prueba: quedan las mismas 12 filas `zz_test_` que había antes; ninguna nueva.
5. Decisiones no cubiertas:
   - El controlador y la ruta siguen llamándose `reemplazarContadoresDeAuxiliar`: renombrarlos exige tocar `Backend/src/routes/userRoutes.js`, que no está autorizado. Queda pendiente de decisión.
   - `quitar` no valida que los ids sean contadores: quitar a quien no está vinculado simplemente no hace nada (criterio 3).
   - El fallo «a medias» de una escritura no tiene prueba automática: no se puede provocar desde la ruta sin simular la base. Lo cubre `conTransaccion`; sí está probado que un id inválido no deja nada escrito.
   - Con `INSERT IGNORE`, si otro agrega el mismo vínculo un instante antes, no hay error ni aviso duplicado.
6. Para la memoria: contrato nuevo del `PUT` (`{ agregar, quitar }`, el cuerpo `{ contadores }` da 400); `ajustarContadoresDeAuxiliar` devuelve `{ agregados, quitados }` (base de los avisos de las rebanadas 02 a 04); pendiente el renombre del controlador y actualizar `MINIMOS` de `verificarPruebas.js`.

## Veredicto del reviewer (vuelta 1)

opencode, agente `reviewer`, modelo `opencode/deepseek-v4.1-flash-free` (el modelo del agente dio límite diario de OpenRouter). 2026-11-10. Copiado tal cual.

VEREDICTO: APROBADO

### Qué revisé

Leí `AGENTS.md`, `docs/constitution.md`, `MEMORY.md`, la rebanada y el diff completo (`git diff` de los 7 archivos de código/pruebas, más `docs/rebanadas/equipos-propuesta.md`). No modifiqué ningún archivo.

**Puertas (todas en verde, salvo el defecto previo documentado):**

- Backend `node --test test/contadoresDeAuxiliar.test.js` → 7/7.
- Backend `node soporte-pruebas/verificarPruebas.js` → 383 pruebas, 0 fallidas; `RESULTADO: FALLA` solo por `MINIMOS` (comprobado con `git show HEAD:Backend/soporte-pruebas/verificarPruebas.js`: ya estaba desactualizado antes de la rebanada; el archivo no se tocó).
- Frontend `npm run lint:check` → salida 0; `npm run build` → salida 0; `node --test` → 1035/1035.
- Datos: 12 filas `zz_test_` antes y después, 0 huérfanas en `contador_auxiliar` y `notificaciones`. Ninguna fila nueva.

**Navegador (3011 + 9012, `admin_seed`, servidores cerrados al terminar):**

- El diálogo de `ESTEFANY…` carga su equipo actual; «Guardar» sin tocar nada cierra y **no emite `PUT`** (red vacía). Esto prueba de paso que `cargados` se llena con lo cargado al abrir y no con una lista vacía (si lo fuera, habría `PUT` de alta).
- Con el `PUT` interceptado (sin enviarlo, para no alterar datos) y desmarcando a BRAYAN, el cuerpo fue exactamente `{"agregar":[],"quitar":[7917]}`: solo la diferencia. La base quedó intacta (2 vínculos).
- Error del guardado mostrado en la notificación; sin errores de consola.
- Vista móvil a 375 px: diálogo de 327 px, `scrollWidth` 375, sin desborde; «Cancelar»/«Guardar» visibles.

**Contra los criterios:** el criterio 1 lo cubren la prueba cruzada del backend y la del navegador; el 2 lo cubren `rechaza datos inválidos sin cambiar nada` (400 para `{ contadores }`, listas inválidas, id repetido en ambas listas, auxiliar como contador, contador inexistente, cuenta que no es auxiliar) y el uso de `conTransaccion`; el 3 lo cubren `repetir un cambio…` (sin duplicar, sin fallar, sin aviso nuevo) y `el alta… lo vincula en el mismo paso`. Las pruebas exigen el comportamiento (estado final, conteos de avisos, payload) y no solo que exista una palabra; las del `.vue` son de código fuente, como el resto de las pantallas del proyecto.

Sin sobreingeniería: el cambio es el mínimo para el contrato pedido y no toca nada fuera de lo autorizado (el texto del diálogo sigue igual, «Mis auxiliares» del contador intacto).

### Opcional (no bloquea)

1. `Backend/src/controllers/AuxiliarController.js:233,255` — la función y el export siguen llamándose `reemplazarContadoresDeAuxiliar` aunque ya no reemplazan. Renombrarlos exige tocar `Backend/src/routes/userRoutes.js` (fuera de la lista). El implementer ya lo reportó: conviene cerrarlo en una rebanada de renombre (ruta incluida) para que el nombre no mienta.
2. `Backend/src/models/AuxiliarModel.js:156-162` — `quitar` no valida que los ids existan o sean contadores: quitar un id inexistente responde 200 sin hacer nada. Encaja con el criterio 3 («quitar a uno que ya no estaba no da error»), pero el criterio 2 enumera «no existe, no es contador» sin distinguir listas. Confirmar con el usuario si `quitar` debe validar; hoy es inofensivo (no escribe nada).
3. `Backend/src/models/AuxiliarModel.js:166` — `INSERT IGNORE` también se traga un fallo de clave foránea si el contador desapareciera entre la validación y el insert; la respuesta devuelve la lista real, así que no hay estado inconsistente, solo un 200 que no creó el vínculo. Muy improbable; si se quiere blindar, usar `INSERT … ON DUPLICATE KEY UPDATE` y comprobar el resultado.
4. El fallo «a medias» sigue sin prueba automática (documentado). Es razonable: provocarlo exigiría simular la base; `conTransaccion` ya está probado por su cuenta.
5. `Backend/soporte-pruebas/verificarPruebas.js` — la tabla `MINIMOS` sigue sin `contadoresDeAuxiliar.test.js` (y otros archivos previos). Defecto previo, ajeno a la rebanada; dejo constancia para no confundirlo con una regresión.
