# Propuesta: ¿quién manda en los equipos de auxiliares?

Análisis de Fable 5.2 (2026-11-10, solo lectura), revisado por el orquestador. Pendiente de decisión del usuario.

## Estado actual

- **Contador** («Mis auxiliares»): lista, agrega y quita solo en su propio equipo (`Backend/src/routes/counterRoutes.js`, `AuxiliarController.js`).
- **Despacho** (admin o sistema): fija la lista completa de contadores de un auxiliar en el alta (`POST /usuarios`) o con «Contadores que apoya» (`PUT /usuarios/:id/contadores`). Commit `917d616`.
- **Auxiliar**: solo consulta a quién apoya.

## Defectos verificados

1. **Lista vieja:** `reemplazarContadoresDeAuxiliar` (`Backend/src/models/AuxiliarModel.js:140`) deja al auxiliar exactamente con la lista enviada. Si el contador agrega mientras el despacho tiene el diálogo abierto, al guardar se pierde ese vínculo. Sin transacción: un fallo a medias deja el equipo incompleto.
2. **Avisos desiguales:** solo la vía del despacho avisa (`avisarNuevosVinculos`, `AuxiliarController.js:188`); cuando el contador agrega no hay aviso.
3. **Bajas silenciosas:** ninguna vía avisa al quitar.
4. Ninguna prueba cruza las dos vías (`rolAuxiliar.test.js`, `contadoresDeAuxiliar.test.js`).

## Opciones

- **A. Solo el despacho arma equipos**; el contador solo ve. Sin cambio de tabla. Descarta el rediseño de «Mis auxiliares».
- **B. Ambos ajustan, todo se avisa (recomendada).** El despacho ajusta cualquier equipo, cada contador el suyo, y a todos los afectados les llega aviso. Sin cambio de tabla.
- **C. Como B, con candado:** el contador no puede quitar a los auxiliares que asignó el despacho. **Requiere aprobar** un campo nuevo `asignado_por INT NULL` (FK a `usuarios`, `ON DELETE SET NULL`) en `contador_auxiliar` y decidir qué hacer con las filas actuales (NULL).

## Decisión del usuario (2026-11-10): opción B

1. Un contador sí puede quitar a un auxiliar que le asignó el despacho.
2. Un contador sí puede tomar por su cuenta a cualquier auxiliar.
3. Al quitar se avisa a los dos («Ya no apoyas a X» / «Y ya no es tu auxiliar»).
4. El administrador sí recibe aviso cuando un contador cambia su equipo.
5. Sistema y administrador tienen funciones distintas, pero para armar equipos pesan casi igual: las rutas siguen con `requireAdminOrSistema`. El aviso de la rebanada 04 llega solo a administradores.

### Rebanadas ajustadas (orden de trabajo)

| N.º | Rebanada | Riesgo | Archivo |
|---|---|---|---|
| 01 | El despacho guarda solo la diferencia (`{ agregar, quitar }` en transacción + prueba cruzada) | alto | `01-despacho-guarda-diferencia.md` |
| 02 | Avisos al quitar, en las dos vías, y renombre de `reemplazarContadoresDeAuxiliar` en controlador y ruta | medio | — |
| 03 | Avisos cuando el contador asigna | medio | — |
| 04a | Se guarda un aviso para cada administrador cuando un contador cambia su equipo (backend) | medio | — |
| 04b | El administrador ve la campana de avisos en el menú (hoy solo la ven contador y auxiliar) | medio | — |
| 05 | Textos de ayuda que expliquen la regla | bajo | — |

Decisiones para la 02 (usuario, 2026-11-10): textos «Ya no apoyas a {contador} con sus casos.» y «{auxiliar} ya no es tu auxiliar.»; si quita el propio contador se avisa solo al auxiliar, si quita el despacho se avisa a los dos. Para la 04: el aviso llega solo a administradores (no a usuarios de sistema) y sí se les pone campana.

La 01 va primero porque deja el modelo devolviendo `{ agregados, quitados }`, que es la base de los avisos de la 02 a la 04; los textos van al final, cuando la regla ya esté completa.

## Rebanadas para B (lista original)

1. Avisos cuando el contador asigna, reutilizando `avisarNuevosVinculos`. `AuxiliarController.js`, `auxiliarRoutes.test.js`. Riesgo **medio**.
2. Avisos al quitar, en las dos vías (`reemplazarContadoresDeAuxiliar` devuelve también los quitados). `AuxiliarModel.js`, `AuxiliarController.js`, `contadoresDeAuxiliar.test.js`. Riesgo **medio**.
3. El despacho guarda solo la diferencia (`{ agregar, quitar }` o transacción) y prueba cruzada «el contador agrega mientras el despacho edita». `AuxiliarModel.js`, `AuxiliarController.js`, `userService.js`, `ContadoresDeAuxiliarDialog.vue` y sus pruebas. Riesgo **alto**.
4. Textos de ayuda que expliquen la regla (`ContadorAuxiliaresPage.vue`, `AgregarAuxiliaresDialog.vue`, `ContadoresDeAuxiliarDialog.vue`, `NewUserDialog.vue`). Riesgo **bajo**.
5. Opcional: aviso al administrador cuando un contador cambia su equipo. Riesgo **medio**.

C agrega a lo anterior el candado (403 al quitar un vínculo del despacho), la migración en `seed.js` y el ícono con tooltip en «Mis auxiliares».

## Preguntas para el usuario

1. ¿Un contador puede quitar a un auxiliar que le asignó el despacho? (Sí → B; no → C.)
2. ¿Un contador puede tomar por su cuenta a cualquier auxiliar, o solo el despacho decide? (Solo el despacho → A.)
3. Al quitar, ¿se avisa a los dos? Texto propuesto: «Ya no apoyas a X» / «Y ya no es tu auxiliar».
4. ¿El administrador recibe aviso cuando un contador cambia su equipo?
5. ¿El usuario de sistema y el administrador pesan igual (como hoy con `requireAdminOrSistema`)?
