# 03 — Avisos cuando el contador asigna a un auxiliar

- **Riesgo:** medio (lógica nueva en un controlador; sin cambios de permisos, tabla ni interfaz)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet, instancia nueva)
- **Estado:** aprobada (implementada y revisada el 2026-11-11)

## Historia

Como auxiliar, quiero recibir un aviso en la campana cuando un contador me agrega a su equipo desde «Mis auxiliares», para saber que ya veo sus casos sin que nadie me lo tenga que decir.

## Criterios de aceptación

1. **Asigna el contador → se avisa a los dos.** Con `POST /contadores/:id/auxiliares/:auxiliarId` exitoso (201), el auxiliar recibe «Ahora apoyas a {contador} con sus casos.» y el contador recibe «{auxiliar} ahora es tu auxiliar.» (`caso_id` nulo), y a ambos se les envía el evento `aviso-nuevo`.
2. **Si no se asignó, no hay aviso.** Cuando la asignación se rechaza (409 ya asignado, 400 la cuenta no es auxiliar o es uno mismo, 403 equipo ajeno, 404) no se crea ninguna notificación.
3. **La vía del despacho no cambia.** `PUT /usuarios/:id/contadores` y el alta siguen avisando a los dos («{auxiliar} ahora es tu auxiliar.» y «Ahora apoyas a {contador} con sus casos.»), con el mismo texto para el auxiliar en las dos vías; sus pruebas siguen en verde.

## Archivos autorizados

- `Backend/src/controllers/AuxiliarController.js` — avisos a los dos en `asignarAuxiliar`, reutilizando `avisarNuevosVinculos`.
- `Backend/test/auxiliarRoutes.test.js` — aviso al asignar y ausencia de aviso en los rechazos.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario (2026-11-10): al asignar se avisa a los dos, «para que todos estén enterados». Son los mismos avisos que ya da la vía del despacho: reutilizar `avisarNuevosVinculos(auxiliarId, [contadorId])`.
- Ojo: en las bajas (rebanada 02) el usuario decidió que, si quita el propio contador, se avisa solo al auxiliar. Confirmado por el usuario: esa regla se queda así (asignar avisa a los dos; quitar por el propio contador, solo al auxiliar).
- «Agregar auxiliar» del frontend (`asignarVarios`) hace un `POST` por cada auxiliar elegido: cada uno recibe su propio aviso; no hace falta tocar el frontend.
- El aviso no lleva enlace (`caso_id` nulo), igual que los demás avisos de equipo.
- **NO entra:** aviso a administradores (04a), campana del administrador (04b), textos de ayuda (05).
- Trampas: pruebas del backend por archivo (todas juntas se cuelgan); `verificarPruebas.js` da «FALLA» solo por `MINIMOS` desactualizados (defecto previo); solo cuentas y datos `zz_test_`, nunca `admin_seed` ni cuentas reales; al terminar, ninguna fila `zz_test_%` nueva; no dejar servidores ni procesos en segundo plano abiertos.
- Puertas: Backend `node --test test/auxiliarRoutes.test.js`, `node --test test/contadoresDeAuxiliar.test.js`, `node --test test/rolAuxiliar.test.js` y `node soporte-pruebas/verificarPruebas.js`. Frontend y navegador: no aplica (no cambia la interfaz).

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: `POST /contadores/:id/auxiliares/:auxiliarId` (201) avisa a los dos con `avisarNuevosVinculos(auxiliarId, [contadorId])`, justo tras la asignación exitosa; los rechazos retornan antes y no crean avisos.
2. Archivos modificados: `Backend/src/controllers/AuxiliarController.js` (una línea en `asignarAuxiliar`) y `Backend/test/auxiliarRoutes.test.js` (2 pruebas nuevas).
3. Prueba en rojo: «al asignar un auxiliar se avisa a los dos, sin enlace a un caso» falló por el aserto (`el auxiliar recibe el aviso: 2 !== 3`). La prueba de los rechazos (409, 400 uno mismo, 400 no auxiliar, 403, 404) pasó desde el inicio: protege contra regresión.
4. Puertas: `auxiliarRoutes.test.js` 12/12, `contadoresDeAuxiliar.test.js` 9/9, `rolAuxiliar.test.js` 10/10; `verificarPruebas.js` 389 pruebas, 0 fallidas (FALLA solo por `MINIMOS`, defecto previo). Frontend y navegador: no aplica. Filas `zz_test_`: 12 antes y después.
5. Decisiones no cubiertas: ninguna.
6. Para la memoria: asignar como contador avisa a los dos, igual que el despacho; quitar por el propio contador sigue avisando solo al auxiliar.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet, instancia nueva), 2026-11-11. Resumido por el orquestador.

VEREDICTO: APROBADO

- Los 3 criterios se cumplen; solo se tocaron los dos archivos autorizados; la vía del despacho y los avisos al quitar (02) no cambiaron.
- Ejecutado: las tres pruebas de la rebanada en verde (12/12, 9/9, 10/10) y `verificarPruebas.js` con 389 pruebas, 0 fallidas. Sin residuos `zz_test_`.
- Leído: la prueba exige +1 aviso por cuenta, el texto exacto de cada destinatario y `caso_id` nulo; la de rechazos compara los conteos de las cuatro cuentas implicadas.

Opcional (no bloquea):

1. El 404 se prueba con id `0`, que rechaza el controlador; la rama `AUXILIAR_NO_EXISTE` del modelo (id válido inexistente) no tiene prueba.
2. Si falla la creación del aviso, no se responde el 201 aunque el vínculo ya esté guardado; es lo mismo que ya hacía la vía del despacho.
3. El evento `aviso-nuevo` sigue sin prueba (igual que en la 02).

Comprobación del orquestador: sin la línea del controlador la prueba nueva falla (11 pasan, 1 falla); con ella, 31/31 en los tres archivos.
