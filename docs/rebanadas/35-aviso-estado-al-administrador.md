# 35 — El administrador recibe el aviso de estado cuando la recepcionista responde por él

- **Riesgo:** bajo
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer-ligero`, Haiku)
- **Estado:** refinada

## Historia

Como administrador, quiero enterarme de que mi junta quedó confirmada o se canceló cuando la recepcionista responde por mí, para no tener que abrir la junta y revisarlo.

## Criterios de aceptación

1. Cuando la recepcionista responde por un administrador (`PATCH /juntas/:id/respuesta` con `en_nombre_de`) y esa respuesta confirma o cancela la junta, el administrador recibe **dos avisos**: primero el de siempre («{recepcionista} aceptó/rechazó por ti «{título}»») y después el de estado («La junta «{título}» quedó confirmada» / «… se canceló»), los dos con `junta_id`.
2. Si la respuesta no cambia el estado de la junta (sigue «Por confirmar» o ya estaba igual), el administrador solo recibe el aviso «por ti», como hoy.
3. Repetir la misma respuesta sigue sin avisar a nadie.
4. La recepcionista sigue sin recibir avisos por su propia acción.
5. Cuando el administrador responde él mismo, nada cambia: no recibe aviso de su propia respuesta.
6. El organizador y los demás invitados reciben exactamente lo mismo que hoy.

## Archivos autorizados

- `Backend/src/controllers/JuntaController.js` (solo `responderJunta`)
- `Backend/test/recepcionistaJuntas.test.js` (actualizar la prueba «avisos: … el administrador recibe «por ti» con enlace», que hoy afirma que el administrador NO recibe el aviso de estado, y agregar las pruebas nuevas)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario (2026-11-20): dos avisos separados, no un aviso combinado.
- Hoy `responderJunta` crea `generales = crearAvisos(consultante.id, [quien.id])`: ese `[quien.id]` es lo que deja fuera al administrador del aviso de estado. Cuando responde él mismo ya queda fuera por ser el autor.
- Orden: el aviso «por ti» va antes que el de estado en la campana del administrador (se insertan en ese orden).
- No cambian los textos de `estadoJunta.js` ni el comportamiento de otros endpoints.
- Backend: correr por archivo y en serie (`node --test --test-concurrency=1 test/recepcionistaJuntas.test.js`, `test/respuestasJuntas.test.js`, `test/recepcionAdministradores.test.js`) y `node soporte-pruebas/verificarPruebas.js`. Al final, 0 filas `zz_test_%`.

---

## Reporte del implementer

1. Rebanada completada: sí. Con `en_nombre_de`, si la respuesta confirma o cancela la junta, el administrador recibe «por ti» y después el aviso de estado, los dos con `junta_id`.
2. Archivos modificados: `Backend/src/controllers/JuntaController.js` (solo `responderJunta`) y `Backend/test/recepcionistaJuntas.test.js`.
3. Prueba en rojo y por qué falló: la prueba «avisos: … recibe «por ti» con enlace», actualizada para esperar el aviso de estado, falló porque el administrador solo tenía [invitación, «aceptó por ti»]. Causa: `crearAvisos(consultante.id, [quien.id])`. Se quitó la exclusión y el «por ti» pasó antes del estado. Pruebas nuevas: sin cambio de estado solo «por ti»; el administrador que responde él mismo no recibe aviso.
4. Puertas (verde / rojo / no aplica): verde. `recepcionistaJuntas` 31/31, `respuestasJuntas` 16/16, `recepcionAdministradores` 11/11, `verificarPruebas.js` OK (844 pruebas) y `node --test --test-concurrency=1` 844/844. Sin `--test-concurrency=1` hay 10 fallos por la base compartida (ya conocido). 0 filas `zz_test_%`.
5. Decisiones no cubiertas: ninguna.
6. Para la memoria: `responderJunta` ya no excluye a `quien` del aviso de estado y el «por ti» va primero.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (`reviewer-ligero`, sin escalar)

- Alcance: solo los dos archivos autorizados.
- Puertas: `recepcionistaJuntas` 31/31, `respuestasJuntas` 16/16, `recepcionAdministradores` 11/11, `verificarPruebas.js` OK (844 pruebas); 0 filas `zz_test_%`.
- Criterios 1 a 6 cubiertos. Quitar `[quien.id]` de `generales` no cambia lo que reciben el organizador y los demás: el organizador nunca es invitado.

Opcionales (sin aplicar):
- «repetir la misma respuesta…»: comprobar también que el organizador y el segundo invitado no reciben nada nuevo.
- «avisos: …»: comprobar la lista completa de avisos de `contador2`, no solo el último.
