# 22 — Responder invitaciones y avisos de juntas

- **Riesgo:** alto (columna nueva en `notificaciones`, permisos por participante, regla de estado de la junta)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Opus)
- **Estado:** aprobada

Continúa la 21a (API) y la 21b (pantalla «Juntas»).

## Historia

Como invitado a una junta, quiero aceptarla o rechazarla y que me avisen de invitaciones y cambios, para que el organizador sepa quién va. Si el administrador está invitado, su respuesta confirma o cancela la junta.

## Regla de estado (decisión del usuario, 2026-11-18)

El estado de la junta se calcula cada vez a partir de las respuestas; no se guarda en ninguna columna.

- **Sin administradores invitados:** `confirmada`. Cada invitado acepta o rechaza solo por su cuenta.
- **Con uno o más administradores invitados:**
  - `cancelada` si alguno rechazó;
  - si nadie rechazó, `por_confirmar` mientras alguno siga pendiente;
  - `confirmada` cuando todos los administradores invitados aceptaron.
- Si el organizador es administrador, no cuenta como invitado. Su junta queda `confirmada`, salvo que invite a otros administradores.

## Criterios de aceptación

### Backend

1. **Esquema:** migración idempotente en el seed que agrega `notificaciones.junta_id` INT NULL, con FK a `juntas(id)` ON DELETE CASCADE e índice. No se borran ni modifican filas existentes.
2. **Estado en la respuesta:** todas las respuestas de una junta (lista, detalle, alta y edición) incluyen `estado`: `confirmada`, `por_confirmar` o `cancelada`. La regla vive en una función pura con pruebas, en `utils/validacionJuntas.js` o en un util nuevo `estadoJunta.js`.
3. **`PATCH /juntas/:id/respuesta`** con cuerpo `{ respuesta: 'aceptada' | 'rechazada' }`:
   - Solo un invitado puede responder. El organizador recibe 403 y quien no participa, 404 (igual que en la 21a).
   - Un invitado puede cambiar su respuesta después.
   - Guarda `respondido_en` con la hora local.
   - Devuelve 200 con `{ junta }`.
   - Cualquier otro valor en `respuesta` da 400, sobre `respuesta`.
   - La ruta entra en `autorizacionMatriz` y en `inyeccionSql`.
4. **Edición que cambia la fecha o la hora:** si un PATCH de la junta cambia `inicio` o `fin`, todas las respuestas vuelven a `pendiente` y `respondido_en` a NULL. Si solo cambian el título, la descripción o los invitados, las respuestas se conservan, como en la 21a.
5. **Avisos** (tabla `notificaciones` con `junta_id`, más `eventos.enviarAUsuario(id, 'aviso-nuevo', {})` para la campana en tiempo real). Fechas en `DD-MM-AAAA` y horas en `HH:mm`.
   - **Alta**, a cada invitado: «{organizador} te invitó a «{título}» el {fecha} a las {hora}».
   - **Edición**, a los invitados nuevos: la misma invitación.
   - **Edición** que cambia la fecha o la hora, a los que siguen: «{organizador} cambió «{título}» al {fecha} a las {hora}. Vuelve a confirmar tu asistencia».
   - **Respuesta**, al organizador: «{nombre} aceptó «{título}»» o «{nombre} rechazó «{título}»».
   - **Respuesta de un administrador que cambia el estado**, al organizador y a los demás invitados: «La junta «{título}» quedó confirmada» o «La junta «{título}» se canceló».
   - **Borrado**, a cada invitado: «{organizador} canceló «{título}» del {fecha}». Este aviso se guarda con `junta_id` en NULL; si no, el borrado en cascada se lo llevaría.
   - Nadie recibe aviso de su propia acción.
6. **`GET /notificaciones`:** cada aviso incluye `junta_id` y la fecha de inicio de la junta (`junta_inicio`, para abrir el periodo correcto), o `null` si no tiene junta. El resto del formato no cambia.

### Frontend

7. **Campana:**
   - La recepcionista ahora ve la campana (`veCampana`).
   - Un aviso con `junta_id` lleva a `{ name: 'juntas', query: { fecha, juntaId } }` para los 4 roles del calendario.
   - `destinoDeAviso` conserva el comportamiento de los avisos de casos.
8. **Pantalla «Juntas»:**
   - Con `?juntaId=` en la URL, la pantalla abre la ficha de esa junta al cargar.
   - Si la junta ya no existe o no es tuya, avisa: «Esa junta ya no está disponible».
9. **Ficha de la junta:**
   - Muestra un chip de estado con texto: «Confirmada», «Por confirmar» o «Cancelada».
   - Si eres invitado, muestra tu respuesta y los botones «Aceptar» y «Rechazar». El botón de tu respuesta actual queda marcado y puedes cambiarla.
   - Al responder aparece «Respuesta guardada», la ficha se actualiza y el calendario se recarga.
   - Si falla, el error se muestra en tres partes y la ficha queda como estaba.
10. **Calendario:**
    - Las juntas `por_confirmar` muestran «Por confirmar» en su etiqueta; las `cancelada`, «Cancelada» y el título tachado.
    - Si me invitaron y todavía no respondo, la etiqueta muestra «Responder».
    - Todo con texto, no solo color. Colores de la paleta `$dg-colores`.
11. **Datos de prueba:** solo cuentas `zz_test_`; al terminar, 0 filas `zz_test_%`, 0 juntas y 0 avisos de prueba.

## Archivos autorizados

Backend:
- `src/utils/seed.js` (solo la migración de `junta_id`)
- `src/models/JuntaModel.js` y `src/models/NotificacionModel.js`
- `src/controllers/JuntaController.js` y `src/controllers/NotificacionController.js`
- `src/routes/juntaRoutes.js`
- `src/utils/validacionJuntas.js` o `src/utils/estadoJunta.js` (nuevo)
- `test/juntas.test.js`, `test/validacionJuntas.test.js`, `test/respuestasJuntas.test.js` (nuevo), `test/estadoJunta.test.js` (nuevo), `test/autorizacionMatriz.test.js`, `test/inyeccionSql.test.js`, `test/seed.test.js`
- `soporte-pruebas/verificarPruebas.js` (`MINIMOS`) y `soporte-pruebas/bd.js` (solo si la limpieza de avisos lo requiere)

Frontend:
- `src/stores/session.js` (`veCampana`)
- `src/utils/avisos.js`
- `src/services/notificacionService.js` y `src/services/juntaService.js`
- `src/utils/juntas.js`
- `src/pages/JuntasPage.vue`, `src/components/JuntaDetalleDialog.vue` y `src/components/CalendarioJuntas.vue`
- `src/components/CampanaAvisos.vue` (solo si hace falta para el enlace)
- `test/juntas*.test.js`, `test/avisos*.test.js` y las pruebas existentes que fallen por la campana de la recepcionista, sin debilitarlas

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Los avisos se crean en la misma transacción que el cambio (`ejecutar`), como hace `CaseController`. Los `enviarAUsuario` van después del commit.
- Ver la agenda de otros y las juntas privadas son de la 23. El correo es de la 24 y queda para después por decisión del usuario.
- Puertas:
  - Backend: `node --test --test-concurrency=1` archivo por archivo y `verificarPruebas.js`.
  - Frontend: `lint:check`, `prettier --check` en los archivos nuevos, `build` y `node --test`.
- Navegador (`backend-experimento-3011` + `frontend-experimento-9012`):
  - Un contador `zz_test_` invita a un administrador y a un auxiliar `zz_test_`. Revisar los avisos en la campana y el enlace a la ficha.
  - El auxiliar acepta y el administrador rechaza. La junta debe quedar «Cancelada» para los tres.
  - Comprobar en escritorio y a 375 px.

---

## Reporte del implementer

1. **Rebanada completada:** sí, backend y frontend.
   - Migración de `notificaciones.junta_id` con FK `fk_notificaciones_junta` y borrado en cascada.
   - Regla de estado en `estadoJunta.js`.
   - Ruta `PATCH /juntas/:id/respuesta`.
   - Al cambiar la fecha o la hora, las respuestas vuelven a pendiente.
   - Avisos creados dentro de la transacción y enviados por SSE después del commit.
   - `junta_id` y `junta_inicio` en `GET /notificaciones`.
   - Campana para la recepcionista, enlace a «Juntas» con `?juntaId=`, ficha con chip de estado y botones «Aceptar» y «Rechazar», y en el calendario las marcas «Por confirmar», «Cancelada» y «Responder».
2. **Archivos:**
   - Backend: `seed.js`, `estadoJunta.js` (nuevo), `validacionJuntas.js`, `JuntaModel.js`, `NotificacionModel.js`, `JuntaController.js`, `NotificacionController.js` y `juntaRoutes.js`.
   - Pruebas del backend: `estadoJunta.test.js` y `respuestasJuntas.test.js` (nuevas), `validacionJuntas`, `juntas`, `autorizacionMatriz`, `inyeccionSql` y `MINIMOS`.
   - Frontend: `session.js`, `avisos.js`, `juntas.js`, `notificacionService.js`, `juntaService.js`, `JuntasPage.vue`, `JuntaDetalleDialog.vue`, `CalendarioJuntas.vue`, `CampanaAvisos.vue` y `test/juntasRespuestas.test.js` (nueva).
   - **Fuera de la lista (justificados):**
     - `Backend/test/prioridadAdmin.test.js`: las columnas y llaves de los avisos ahora incluyen `junta_id`.
     - `test/rolRecepcionista.test.js`: ahora la recepcionista sí tiene campana.
     - `test/campanaAdministrador.test.js`: la expresión regular ahora admite el salto de línea que pone prettier.
3. **Prueba en rojo:**
   - `estadoJunta`: faltaba el módulo.
   - `respuestasJuntas`: 14 pruebas fallaron por aserto.
   - `juntasRespuestas`: falló al importar y luego en 8 asertos.
   - `validarRespuesta`: se escribió junto con su prueba, sin ver el rojo por separado.
4. **Puertas:**
   - Backend: los archivos afectados en verde.
   - `verificarPruebas.js`: 765 pruebas (mínimo 676), 0 fallidas.
   - Frontend: `lint:check`, `prettier --check`, `build` y `node --test` (1523/1523) en verde.
   - **Navegador:**
     - el auxiliar abrió la ficha desde la campana y aceptó;
     - el administrador rechazó (por la API);
     - el contador, a 375 px, vio la junta «Cancelada» tachada y sin botones de respuesta;
     - con un `?juntaId=` inexistente aparece «Esa junta ya no está disponible.».
   - **Sin probar en la interfaz:** la sesión del administrador y la marca «Responder» (cubierta solo por pruebas unitarias).
   - **Datos de prueba:** 0 de prueba. Queda la junta 264, «revision de proyecto», creada por `admin_seed` en el servidor del puerto 3000 del usuario; no se tocó.
5. **Decisiones no cubiertas:**
   - `junta_inicio` sale en hora local.
   - El servicio solo agrega `juntaId` y `juntaInicio` a los avisos de juntas.
   - El aviso de estado solo se envía cuando un administrador lleva la junta a confirmada o cancelada.
   - Si el invitado no ha respondido, «Responder» se muestra junto a «Por confirmar» o «Cancelada».
   - `?juntaId=` se quita de la URL después de abrir la ficha.
   - `CampanaAvisos.vue`: icono `event` y el texto «Toca para ver la junta».
6. **Para la memoria:**
   - El estado de la junta se calcula y no se guarda.
   - El aviso de borrado se guarda con `junta_id` en NULL.
   - Hay pruebas que extraen `veCampana` con una expresión regular.

## Veredicto del reviewer (vuelta 1)

VEREDICTO:

**VEREDICTO: CAMBIOS NECESARIOS** (Opus, 2026-11-18, sin modificar archivos). Se cumplen los criterios y las puertas están en verde; las 3 pruebas cambiadas fuera de la lista no quedaron más débiles.

**Cambio necesario:**

1. `NotificacionModel.js:29`: `GET /notificaciones` une los avisos con `juntas` sin comprobar que quien consulta siga participando. Si a alguien lo quitan de una junta, sigue viendo en `junta_inicio` la fecha y hora actuales de esa junta. Hay que devolver `junta_id` y `junta_inicio` solo a quien organiza la junta o sigue invitado, y agregar la prueba de ese caso.

**Opcionales:**

- `JuntasPage.vue:290`: al entrar desde un aviso, la URL pierde el parámetro `vista`.
- `JuntaController.js:240`: si un invitado repite la misma respuesta, el organizador recibe otra vez el mismo aviso.
- Cuando un administrador lleva la junta de `cancelada` a `por_confirmar`, no se envía aviso de estado. Es una decisión del implementer.

## Vuelta 2

- **Implementer:**
  - `GET /notificaciones` devuelve `junta_id` y `junta_inicio` solo al organizador o a quien sigue invitado. Lleva una prueba nueva.
  - Al abrir una junta desde un aviso, la URL conserva `vista` y `fecha`.
  - Si un invitado repite la misma respuesta, no se crea ningún aviso. Lleva una prueba nueva.
  - Extra: en el calendario, las marcas «Por confirmar · Responder» van en una línea aparte para que no se corten.
  - Puertas:
    - backend: 767 pruebas;
    - frontend: 1524/1524, `lint`, `prettier` y `build` en verde.
  - Navegador:
    - el administrador invitado ve «Por confirmar · Responder»;
    - acepta y la junta queda «Confirmada»;
    - a 375 px rechaza y la junta queda «Cancelada».
  - Datos de prueba: 0 de prueba; la junta 264 del usuario quedó intacta.
- **Verificación del orquestador:** leí la consulta corregida en `NotificacionModel.js` (un `LEFT JOIN` condicionado a organizador o invitado) y volví a correr `respuestasJuntas` (16/16) y `juntas` (14/14). No repetí la revisión completa: el cambio es acotado y tiene su prueba.
- **Para decidir con el usuario:** no se avisa cuando una junta pasa de «Cancelada» a «Por confirmar».
- **Estado:** aprobada (2026-11-18).
