# 40 — Notificaciones del navegador para los avisos nuevos

- **Riesgo:** medio (comportamiento nuevo con una API del navegador; solo frontend)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** refinada

## Historia

Como usuario de la app, quiero recibir una notificación de Windows cuando me llega un aviso nuevo y no estoy viendo la app, para enterarme sin tener que revisar la campana.

## Criterios de aceptación

1. **Cuándo sale:** al llegar un aviso nuevo (SSE `aviso-nuevo`, que hoy recarga la campana en `CampanaAvisos.vue`), por cada aviso **no leído** que no se había visto antes en esta sesión de la pestaña, sale una notificación del sistema **solo si la pestaña no está visible** (`document.visibilityState !== 'visible'`) y el permiso es `granted` y la persona las activó en este equipo.
   - Título: «Seguimiento de Proyectos». Cuerpo: el `mensaje` del aviso. Icono: `/icons/icon-192x192.png`. `tag` con el id del aviso (no se duplica).
   - La primera carga de la campana (al entrar o recargar) **no** notifica los avisos que ya existían; tampoco la recarga por `reconectado`, la del intervalo de 5 minutos ni la del cambio de ruta. Solo `aviso-nuevo`.
   - Si llegan muchos a la vez, como máximo 3 notificaciones; si hay más, una sola que diga «Tienes N avisos nuevos».
2. **Clic en la notificación:** trae la pestaña al frente (`window.focus()`), cierra la notificación y navega a lo mismo que el aviso de la campana (`destinoDeAviso(aviso, session.rol)`); si el aviso no tiene destino, solo enfoca.
3. **Activar en la campana:** dentro del menú de la campana, mientras no estén activadas en este equipo y el navegador las soporte, aparece «Activar avisos en este equipo» (`q-btn` con tooltip). Al pulsarlo se pide el permiso (`Notification.requestPermission()`):
   - `granted` → se guardan como activadas y el botón desaparece (con un `$q.notify` positivo «Listo: te avisaremos aunque no estés viendo la app»).
   - `denied` → texto claro: «El navegador bloqueó los avisos. Actívalos en la configuración del sitio (candado junto a la dirección).» y no se vuelve a pedir.
4. **Activar en «Mi perfil»** (`ContadorAuxiliaresPage.vue`, solo contador y auxiliar, que son quienes tienen esa pantalla): interruptor «Avisos en este equipo» con texto de ayuda. Encenderlo hace lo mismo que el botón de la campana; apagarlo deja de mostrar notificaciones en este equipo (no se puede retirar el permiso del navegador desde la página: la ayuda lo explica). Si el permiso está `denied`, el interruptor queda deshabilitado con el mismo texto de ayuda.
5. La preferencia es **por equipo** (localStorage, con `try/catch`), no se guarda en la base. Sin soporte de `Notification` (o en un contexto no seguro), no aparece ni el botón ni el interruptor y nada falla.
6. Al cerrar sesión no queda nada que notifique (la campana se desmonta y deja de escuchar).
7. La lógica vive en un módulo nuevo `src/utils/notificacionesNavegador.js` con dependencias inyectables (la API `Notification`, `document`, almacenamiento) y pruebas en `test/` que cubren: no notifica en la primera carga, solo los no leídos y no vistos, solo con la pestaña oculta, respeta permiso y preferencia, tope de 3 y el resumen, y el clic.

## Archivos autorizados

- `Seguimiento-proyectos/src/utils/notificacionesNavegador.js` (nuevo)
- `Seguimiento-proyectos/src/components/CampanaAvisos.vue`
- `Seguimiento-proyectos/src/pages/ContadorAuxiliaresPage.vue` («Mi perfil»)
- Prueba nueva en `Seguimiento-proyectos/test/`

Fuera de esta lista, el implementer para y pregunta. Sin dependencias nuevas ni cambios en el backend.

## Notas del orquestador

- Decisiones del usuario (2026-11-20): opción 1 (sin Web Push); solo cuando no se está viendo la app; activar en la campana y en «Mi perfil»; el clic abre la app en el aviso.
- Administrador y recepcionista no tienen «Mi perfil»: para ellos solo la campana.
- `localhost` cuenta como contexto seguro; en producción ya es HTTPS (túnel). En un HTTP por IP de la LAN el navegador no ofrece `Notification`: por eso el criterio 5.
- Textos en tú, sin ambigüedad; botones con tooltip; `.control-touch` y `.boton-presionable`.
- Puertas: `lint:check`, `prettier --check` de los archivos tocados (solo tus líneas si ya fallaban), `build`, `node --test`. El navegador lo prueba el orquestador.
- No entra: Web Push con la app cerrada (rebanada aparte), sonido, ni preferencias por tipo de aviso.

---

## Reporte del implementer

1. Rebanada completada: sí (criterios 1 a 7), sin navegador.
2. Archivos modificados:
   - `src/utils/notificacionesNavegador.js` (nuevo; `crearNotificadorNavegador` con dependencias inyectables; preferencia en localStorage `avisosNavegador`).
   - `CampanaAvisos.vue`: botón «Activar avisos en este equipo». Solo `aviso-nuevo` llama a `cargarYNotificar`; las demás recargas solo registran vistos.
   - `ContadorAuxiliaresPage.vue`: interruptor en «Mi cuenta».
   - `test/notificacionesNavegador.test.js` (nuevo).
   - `test/tiempoReal.test.js`: ajuste del regex de una línea a `cargarYNotificar`.
3. Prueba en rojo y por qué falló: el módulo no existía (`ERR_MODULE_NOT_FOUND`) y las 2 pruebas de plantilla fallaron por el aserto.
4. Puertas (verde / rojo / no aplica): `node --test` 1811/1811, `lint:check` y `build` en verde. `prettier --check` en verde en los archivos nuevos y en `CampanaAvisos.vue` (con CRLF); los demás ya fallaban en HEAD.
5. Decisiones no cubiertas:
   - Con el permiso `denied`, el botón sigue visible y al pulsarlo muestra el texto de bloqueo.
   - La campana y «Mi perfil» comparten solo el localStorage: si se activa desde «Mi perfil», la campana se entera al abrir el menú.
   - Un aviso que llega durante una desconexión no se notifica después.
6. Para la memoria: solo `aviso-nuevo` notifica.

## Comprobación en navegador (orquestador, 2026-11-20)

- El navegador integrado tiene `Notification.permission = 'denied'`, así que no se puede ver una notificación real ahí.
- Con permiso bloqueado:
  - La campana muestra «Activar avisos en este equipo» y, al pulsarlo, el texto de bloqueo sin volver a pedir permiso.
  - En «Mi perfil», el interruptor queda deshabilitado con la misma ayuda.
- Aviso real por SSE (el auxiliar crea un caso para la contadora por la API): la campana pasa a 1 al instante y no hay errores de JavaScript.
- **Pendiente:** ver la notificación de Windows en un navegador con permiso concedido (Chrome o Edge).

## Veredicto del reviewer (vuelta 1, `reviewer`)

VEREDICTO: APROBADA. Puertas en verde (1811). Sin bloqueantes.

- Opcional 1, **aplicado por el orquestador:** `new Notification()` lanza en Chrome para Android, y eso mostraba un falso «No se pudieron cargar los avisos». Ahora `mostrar` lo atrapa y queda la campana. Prueba nueva en rojo y luego en verde; 1812/1812.
- Opcionales sin aplicar: pasar `false` explícito a `cargar` en las demás recargas; línea larga del tooltip en `ContadorAuxiliaresPage.vue:62` (ese archivo ya fallaba prettier).

## Ajuste por Opera GX (orquestador, 2026-11-20)

- **Problema reportado por el usuario:** en Opera GX, «Activar avisos» se quedaba cargando. El navegador nunca contestaba `Notification.requestPermission()` (aviso de permiso silenciado o bloqueado), y la app tampoco decía nada si se cerraba la ventana sin elegir.
- **Cambio:**
  - `activar()` compite con un límite de 10 s (`esperaPermisoMs`, `programar` y `cancelar` inyectables; el temporizador se cancela al responder). Si no hay respuesta, devuelve `'sin-respuesta'`.
  - `mensajeDeActivacion(resultado)` da el texto de cada caso:
    - `denied`: bloqueado.
    - `default`: «Cerraste la ventana del permiso sin elegir…».
    - `sin-respuesta`: «Tu navegador no mostró la ventana del permiso…».
  - La campana y «Mi perfil» lo muestran.
- **Pruebas:**
  - En rojo primero (no existía `mensajeDeActivacion`), luego en verde.
  - Se actualizó el aserto de integración de la campana, que buscaba el texto anterior.
  - Frontend 1815/1815, `lint:check` y `build` en verde, prettier en verde en los archivos nuevos y en la campana.
- **Navegador:** con `permission` simulado en `default` y `requestPermission` que nunca responde, el botón carga y a los 10 s se detiene con el mensaje «Tu navegador no mostró la ventana del permiso…».

## Prueba real (usuario, 2026-11-20)

- **Chrome:** la notificación de Windows llega. Lo confirmó el usuario.
- **Opera GX:** el permiso se activa, pero la notificación no llegó. Probablemente es por la configuración de Opera GX o de Windows para ese navegador. Casi todos los usuarios usarán Chrome, así que no se investigó más.
- 0 filas `zz_test_` al terminar; servidores cerrados.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:
