# 07 — Cambiar mi contraseña desde «Mi perfil»

- **Riesgo:** alto (autenticación)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, modelo Fable)
- **Estado:** refinada

## Historia

Como contador o auxiliar, quiero cambiar mi contraseña desde «Mi perfil» escribiendo la actual, para no depender del despacho.

## Criterios de aceptación

1. **`PATCH /auth/mi-contrasena`** (con `authenticateToken`) recibe `{ password_actual, password }`. Con la actual correcta y una nueva válida guarda el hash con Argon2id (`hashPassword`), responde 200 `{ mensaje }` y la sesión actual sigue abierta.
2. Rechazos, todos con `buildError` de tres partes: actual ausente o incorrecta → 400 sobre «contraseña actual»; nueva que no es texto o con menos de 8 caracteres → 400 sobre «contraseña»; nueva igual a la actual → 400 sobre «contraseña». Sin token → 401. En ningún rechazo cambia el hash.
3. `PATCH /auth/contrasena` (cambio pendiente de la contraseña asignada) no cambia de comportamiento.
4. **Botón «Cambiar contraseña»** en la sección «Mi cuenta» (con tooltip) abre `CambiarContrasenaDialog.vue`: campos «Contraseña actual», «Contraseña nueva» y «Confirma la contraseña nueva», cada uno con botón para mostrar u ocultar. Valida en el frontend antes de enviar (obligatorios, 8 caracteres, nueva distinta de la actual, confirmación igual). Sigue el patrón de formularios en diálogo de AGENTS.md (`hayDatosSinGuardar` + `:persistent` + `@shake` → «¿Descartar los cambios?», `erroresCampo` + `enfocarPrimerError`, `label for`, asterisco `aria-hidden`, `dialogo-entra`/`dialogo-sale`).
5. Un error del servidor se muestra en su campo (`campoConError` con la parte «sobre …») y lo escrito se conserva; al guardar, el diálogo se cierra y avisa «Contraseña actualizada.».

## Archivos autorizados

- `Backend/src/controllers/authController.js`, `Backend/src/routes/authRoutes.js`, prueba nueva en `Backend/test/`.
- `Seguimiento-proyectos/src/services/authService.js` (función `cambiarMiContrasena`), `src/components/CambiarContrasenaDialog.vue` (nuevo), `src/pages/ContadorAuxiliaresPage.vue` (botón y diálogo), `src/utils/validators.js` solo si falta una regla reutilizable, y una prueba nueva en `Seguimiento-proyectos/test/`.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario (2026-11-11): el cambio voluntario pide la contraseña actual; ruta aparte para no tocar el flujo de la contraseña asignada.
- Reutilizar lo que ya existe: validación de `cambiarContrasena` del controlador y el formulario de `CambiarContrasenaPage.vue` / `ResetPasswordDialog.vue` como patrón visual (`input-moderno`).
- Atributos `autocomplete`: `current-password` en la actual y `new-password` en las otras dos.
- **NO entra:** cerrar las demás sesiones del usuario, límite de intentos propio, reglas de complejidad nuevas, «olvidé mi contraseña».
- Para el reviewer: valorar si el límite de intentos del login debería cubrir también la contraseña actual incorrecta y si conviene revocar las otras sesiones; reportarlo como opcional, no implementarlo.
- Trampas y puertas: las de la rebanada 06. Las cuentas de prueba `zz_test_` creadas se borran al terminar.

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: criterios 1 a 5.
2. Archivos modificados: backend `AuthController.js` (`cambiarMiContrasena`; `cambiarContrasena` intacta), `authRoutes.js` (`PATCH /auth/mi-contrasena`), `test/cambioContrasenaPropia.test.js` (nuevo, 11 pruebas); frontend `authService.js` (`cambiarMiContrasena`), `validators.js` (`validarCambioContrasenaPropia`), `CambiarContrasenaDialog.vue` (nuevo), `ContadorAuxiliaresPage.vue` (botón y diálogo), `test/cambiarContrasenaPropia.test.js` (nuevo, 15 pruebas).
3. Pruebas en rojo: backend 9 de 11 con `404 !== 400/401`; frontend 9 de 15 por aserto (servicio, botón y diálogo no existían).
4. Puertas: backend `cambioContrasenaPropia` 11/11, `miPerfil` 3/3, `cambioContrasena` 8/8, `authRoutes` 19/19, `verificarPruebas.js` 414 pruebas y 0 fallidas (FALLA solo por `MINIMOS`); frontend lint y build en verde, `node --test` 1130/1130. 12 filas `zz_test_%`.
5. Decisiones no cubiertas: orden de validación (actual ausente → nueva inválida → actual incorrecta → nueva igual); el diálogo usa un `campoDelError` propio que lee «sobre X:» porque `campoConError` solo mapea campos de auditoría; el diálogo se vacía al abrir y al cerrar.
6. Para la memoria: pendientes opcionales, límite de intentos para la actual incorrecta y revocar otras sesiones.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Fable), 2026-11-11. Resumido por el orquestador.

VEREDICTO: CAMBIOS NECESARIOS

1. `CambiarContrasenaDialog.vue` envía la contraseña nueva sin recortar y el login (`LoginPage.vue`) siempre recorta: con un espacio al final el cambio responde 200 y después el login da 401 siempre (comprobado contra el backend con cuentas `zz_test_`). Se espera enviar la nueva y la actual recortadas, como `CambiarContrasenaPage.vue`, comparar «nueva distinta de la actual» sobre los valores que se envían y una prueba que falle si se envía sin recortar.
2. `test/cambiarContrasenaPropia.test.js`: el aserto de «lo escrito se conserva» no puede fallar (busca `.value = ''` y el formulario es `reactive`).

El backend está bien: no hay forma de cambiar la contraseña sin la actual ni la de otra cuenta; ningún rechazo cambia el hash; la cuenta con cambio pendiente recibe 403 del middleware.

Opcional: límite de intentos para la actual incorrecta; revocar las demás sesiones al cambiar (`revocarSesionesDeUsuario` ya existe); prueba de integración del 403 con cambio pendiente; recortar o rechazar espacios extremos en el servidor (toca `cambiarContrasena`, fuera de la rebanada).

## Corrección del implementer (vuelta 1)

Claude, agente `implementer` (Sonnet), 2026-11-11. `guardar` recorta la actual, la nueva y la confirmación, valida y envía esos mismos valores. Prueba nueva «valida y envía la actual y la nueva recortadas» (estuvo en rojo); el aserto de «lo escrito se conserva» ahora revisa el bloque `catch` de `guardar` y se vio fallar al vaciar un campo a propósito. Prueba de integración nueva en el backend: cuenta con cambio pendiente → 403 y el hash no cambia. Puertas: backend 12/12; frontend lint, build y 1131/1131; 12 filas `zz_test_%`.

## Comprobación de la corrección (orquestador, vuelta 2)

El orquestador (Fable) leyó las líneas corregidas (`CambiarContrasenaDialog.vue:267-282` y `test/cambiarContrasenaPropia.test.js:130-144`): los dos bloqueantes quedaron resueltos. No se lanzó un segundo reviewer; el caso del espacio final se comprueba además en el navegador.
