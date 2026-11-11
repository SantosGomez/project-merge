# 03 — Avisos cuando el contador asigna a un auxiliar

- **Riesgo:** medio (lógica nueva en un controlador; sin cambios de permisos, tabla ni interfaz)
- **Implementa:** opencode (`implementer`; si el modelo del agente da límite, `-m opencode/deepseek-v4.1-flash-free`; tras 2 fallos pasa a Claude)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** refinada — pendiente de aprobación del usuario. No se implementa hasta cerrar la 02 (toca el mismo controlador).

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

1. Rebanada completada:
2. Archivos modificados:
3. Prueba en rojo y por qué falló:
4. Puertas (verde / rojo / no aplica):
5. Decisiones no cubiertas:
6. Para la memoria:

## Veredicto del reviewer (vuelta 1)

VEREDICTO:
