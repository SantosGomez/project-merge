# 02 — Avisos al quitar a un auxiliar

- **Riesgo:** medio (lógica nueva en controladores; sin cambios de permisos, tabla ni interfaz)
- **Implementa:** opencode (`implementer`; si el modelo del agente da límite, `-m opencode/deepseek-v4.1-flash-free`; tras 2 fallos pasa a Claude)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada (implementada por opencode el 2026-11-10; revisada por el reviewer de Sonnet el 2026-11-11)

## Historia

Como auxiliar o contador, quiero recibir un aviso en la campana cuando dejo de formar parte de un equipo, para no enterarme hasta que ya no veo los casos.

## Criterios de aceptación

1. **Quita el despacho → se avisa a los dos.** Cuando `PUT /usuarios/:id/contadores` quita de verdad un vínculo, el auxiliar recibe «Ya no apoyas a {contador} con sus casos.» y el contador recibe «{auxiliar} ya no es tu auxiliar.» (un aviso por cada vínculo quitado, con `caso_id` nulo), y a ambos se les envía el evento `aviso-nuevo`.
2. **Quita el propio contador → se avisa solo al auxiliar.** Con `DELETE /contadores/:id/auxiliares/:auxiliarId` el auxiliar recibe «Ya no apoyas a {contador} con sus casos.» y el evento `aviso-nuevo`; el contador no recibe aviso.
3. **Sin cambio real no hay aviso, y el nombre ya no miente.** Quitar a quien no estaba vinculado no crea avisos en ninguna de las dos vías. El controlador `reemplazarContadoresDeAuxiliar` pasa a llamarse `ajustarContadoresDeAuxiliar` (también en `userRoutes.js`), sin cambiar la ruta ni el comportamiento: las pruebas existentes siguen en verde y el nombre viejo ya no aparece en `Backend/src`.

## Archivos autorizados

- `Backend/src/controllers/AuxiliarController.js` — avisos al quitar en las dos vías (función hermana de `avisarNuevosVinculos`) y renombre del controlador.
- `Backend/src/models/AuxiliarModel.js` — solo para que `quitarAuxiliar` diga si de verdad quitó el vínculo.
- `Backend/src/routes/userRoutes.js` — solo el renombre del import y de la ruta `PUT`.
- `Backend/test/contadoresDeAuxiliar.test.js` — avisos al quitar por la vía del despacho.
- `Backend/test/auxiliarRoutes.test.js` — avisos al quitar por la vía del contador.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-10): los dos textos de arriba tal cual; si quita el propio contador se avisa solo al auxiliar; el renombre entra en esta rebanada.
- Base ya lista (rebanada 01, commit `b9c69a1`): `AuxiliarModel.ajustarContadoresDeAuxiliar` devuelve `{ agregados, quitados }` con lo que de verdad cambió. Los nombres para el aviso hay que leerlos aparte: tras quitar, el contador ya no sale en `listarContadoresQueMeTienenComoAuxiliar`.
- Los avisos de equipo no llevan enlace (`caso_id` nulo), igual que «ahora es tu auxiliar».
- **NO entra:** aviso cuando el contador asigna (03), aviso a administradores (04a), campana del administrador (04b), textos de ayuda (05). Nada de frontend: el texto «A los que agregues se les avisará» del diálogo se ajusta en la 05.
- Trampas: pruebas del backend por archivo (todas juntas se cuelgan); `verificarPruebas.js` da «FALLA» solo por `MINIMOS` desactualizados (defecto previo: se reporta, no se arregla aquí); solo cuentas y datos `zz_test_`, nunca `admin_seed` ni cuentas reales; al terminar, ninguna fila `zz_test_%` nueva (hoy quedan 12 de sesiones anteriores).
- Puertas: Backend `node --test test/contadoresDeAuxiliar.test.js`, `node --test test/auxiliarRoutes.test.js`, `node --test test/auxiliarModel.test.js`, `node --test test/rolAuxiliar.test.js` y `node soporte-pruebas/verificarPruebas.js`. Frontend y navegador: no aplica (no cambia la interfaz).

---

## Reporte del implementer

1. Rebanada completada: sí (2026-11-10). Tres de tres criterios de aceptación cubiertos y verificados.
2. Archivos modificados:
   - `Backend/src/controllers/AuxiliarController.js` — `reemplazarContadoresDeAuxiliar` renombrado a `ajustarContadoresDeAuxiliar` (función y export); añade `avisarVinculosQuitados` (despacho: avisa a auxiliar y contador) y `avisarAuxiliarDeBaja` (contador: avisa solo al auxiliar); `quitarAuxiliar` avisa solo cuando el modelo devolvió que borró de verdad; `PUT /usuarios/:id/contadores` avisa de agregados y de quitados.
   - `Backend/src/models/AuxiliarModel.js` — `quitarAuxiliar` devuelve `true` solo si `affectedRows > 0`.
   - `Backend/src/routes/userRoutes.js` — import y ruta `PUT` usan `ajustarContadoresDeAuxiliar`.
   - `Backend/test/contadoresDeAuxiliar.test.js` — 2 pruebas nuevas: aviso a ambos al quitar de verdad; sin aviso al quitar a quien no estaba vinculado.
   - `Backend/test/auxiliarRoutes.test.js` — 2 pruebas nuevas: aviso solo al auxiliar al quitar su vínculo; sin avisos sin vínculo previo.
3. Prueba en rojo y por qué falló:
   - Las 4 pruebas nuevas se escribieron antes de aplicar los avisos: fallaban porque `quitarAuxiliar` no devolvía si borró algo y el controlador no creaba notificaciones ni renombraba la función. Verde tras los cambios de modelo, controlador y ruta.
   - Las pruebas existentes de `contadoresDeAuxiliar`, `auxiliarRoutes`, `auxiliarModel` y `rolAuxiliar` siguieron verdes (9/9, 10/10, 9/9, 10/10).
4. Puertas (verde / rojo / no aplica):
   - `node --test test/contadoresDeAuxiliar.test.js` → verde (9/9).
   - `node --test test/auxiliarRoutes.test.js` → verde (10/10).
   - `node --test test/auxiliarModel.test.js` → verde (9/9).
   - `node --test test/rolAuxiliar.test.js` → verde (10/10).
   - `node soporte-pruebas/verificarPruebas.js` → 0 pruebas fallidas; `RESULTADO: FALLA` solo por `MINIMOS` desactualizado (defecto previo documentado, no de esta rebanada; `userModel.test.js` bajo el mínimo y archivos nuevos sin mínimo ya estaban así antes).
   - Datos de prueba: 12 filas `zz_test_%` (sesiones anteriores, sin nuevos residuos); 0 filas en `contador_auxiliar` y `notificaciones` de `zz_test_%`.
   - Frontend y navegador: no aplica (la rebanada no toca la interfaz).
5. Decisiones no cubiertas: ninguna fuera de la rebanada; el aviso al contador asignando (03), aviso a administradores (04a), campana del administrador (04b) y textos de ayuda (05) quedan para sus rebanadas.
6. Para la memoria: `reemplazarContadoresDeAuxiliar` ya no existe en `Backend/src`; los textos de baja son «Ya no apoyas a {contador} con sus casos.» (auxiliar) y «{auxiliar} ya no es tu auxiliar.» (contador), `caso_id` nulo y evento `aviso-nuevo` para quien recibe el aviso.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet), 2026-11-11, sobre el commit `36adbfe`. Resumido por el orquestador, que repitió las dos pruebas principales (19/19).

VEREDICTO: APROBADO

- Los 3 criterios se cumplen y solo se tocaron los 5 archivos autorizados de código y pruebas. No cambió ningún comportamiento previo.
- Ejecutado (por archivo, en `Backend/`): `contadoresDeAuxiliar.test.js` 9/9, `auxiliarRoutes.test.js` 10/10, `auxiliarModel.test.js` 9/9, `rolAuxiliar.test.js` 10/10; `verificarPruebas.js` 387 pruebas, 0 fallidas (FALLA solo por `MINIMOS` desactualizados, defecto previo). Sin residuos `zz_test_` nuevos.
- Solo leído: textos y destinatarios de los avisos en las dos vías, aviso solo con cambio real (`affectedRows > 0`) y renombre a `ajustarContadoresDeAuxiliar`. Que las pruebas fallan sin el comportamiento está razonado, no comprobado con mutación.

Opcional (no bloquea):

1. Ninguna prueba verifica el evento `aviso-nuevo`; solo se leyó que el código llama a `eventos.enviarAUsuario`.
2. Las dos pruebas «no vinculado» pasan también con el código anterior: protegen contra regresión, no prueban lo nuevo.
3. Actualizar `MINIMOS` de `verificarPruebas.js` en una rebanada aparte.
