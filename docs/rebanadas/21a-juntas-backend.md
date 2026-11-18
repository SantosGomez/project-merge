# 21a — Juntas en el backend

- **Riesgo:** alto (esquema nuevo, fechas y permisos por rol)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer` con Opus; Fable si hay cuota)
- **Estado:** aprobada

Segunda rebanada del módulo de calendario. El plan completo está en `20-rol-recepcionista.md`; la 21 se partió en 21a (backend) y 21b (pantalla con QCalendar, dependencia ya aprobada).

## Historia

Como administrador, contador, auxiliar o recepcionista, quiero crear juntas con fecha, hora e invitados, y consultar las mías por rango de fechas, para que la pantalla del calendario (21b) tenga de dónde leer y guardar.

## Decisiones del usuario (2026-11-18)

- Cada invitado acepta o rechaza su invitación.
- Si el administrador está entre los invitados, la junta queda **por confirmar** hasta que él responda. Su respuesta confirma o cancela la junta.
- Entre usuarios sin administrador, cada quien acepta o rechaza y la junta sigue en pie.
- Responder a una invitación y el estado «por confirmar» van en la **22**. En esta rebanada solo se guarda la respuesta inicial (`pendiente`).

## Criterios de aceptación

1. **Tablas** (seed idempotente, `CREATE TABLE IF NOT EXISTS`, InnoDB):
   - `juntas`: `id`, `titulo` VARCHAR(150) NOT NULL, `descripcion` VARCHAR(1000) NULL, `inicio` DATETIME NOT NULL, `fin` DATETIME NOT NULL, `creado_por` INT NOT NULL (FK `usuarios(id)` ON DELETE CASCADE), `creado_en` DATETIME NOT NULL, `actualizado_en` DATETIME NOT NULL. Índice `(inicio, fin)`.
   - `junta_participantes`: `junta_id` (FK `juntas(id)` ON DELETE CASCADE), `usuario_id` (FK `usuarios(id)` ON DELETE CASCADE), `respuesta` ENUM('pendiente', 'aceptada', 'rechazada') NOT NULL DEFAULT 'pendiente', `respondido_en` DATETIME NULL. Llave primaria `(junta_id, usuario_id)`; índice por `usuario_id`.
   - No se agregan más columnas. `privada` llega en la 23 con su propia migración.
2. **Quién usa el calendario:** `administrador`, `contador`, `auxiliar` y `recepcionista`. `usuarios_de_sistema` recibe 403 en todas las rutas de `/juntas`. Va en un middleware nuevo, `requireCalendario`.
3. **`GET /juntas/participantes-disponibles`:** devuelve `{ usuarios: [{ id, nombre, rol }] }` con las cuentas de esos 4 roles, sin la cuenta que pide y ordenadas por nombre. No incluye correo ni último acceso; es lo que usará el selector de invitados.
4. **`POST /juntas`:** crea una junta con `{ titulo, descripcion?, inicio, fin, participantes: [ids] }`.
   - `inicio` y `fin` llegan como `AAAA-MM-DD HH:mm` en hora local. `fin` debe ser posterior a `inicio`; inicio y fin pueden caer en días distintos.
   - Hace falta al menos 1 participante y como máximo 50. No se aceptan ids repetidos ni el propio creador. Cada id debe existir y tener uno de los 4 roles del calendario.
   - Los participantes quedan en `pendiente`.
   - Responde 201 con la junta completa (ver criterio 6). Los errores usan `buildError` con el campo en la parte «sobre X».
5. **`GET /juntas?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`:** devuelve las juntas que se cruzan con el rango (`inicio < hasta + 1 día` y `fin > desde`) donde quien pide es el creador o un participante. El rango es obligatorio, `hasta ≥ desde` y como máximo 400 días (alcanza para la vista de año). El orden es por `inicio`.
6. **Formato de una junta:** `{ id, titulo, descripcion, inicio, fin, creado_por: { id, nombre }, participantes: [{ id, nombre, rol, respuesta }], soy_organizador }`. Los DATETIME salen en hora local `YYYY-MM-DD HH:mm:ss`, con `formatLocalDate`.
7. **`GET /juntas/:id`:** la junta si quien pide es el creador o un participante. Si no lo es, o si la junta no existe, responde 404 (no se revela que existe).
8. **`PATCH /juntas/:id`:** solo el creador. Cambia título, descripción, inicio, fin y participantes con las mismas validaciones del alta. Al reemplazar la lista de participantes, los que siguen conservan su respuesta, los nuevos entran en `pendiente` y los que salen se borran. Si no es el creador pero es participante responde 403; si no participa, 404.
9. **`DELETE /juntas/:id`:** solo el creador. Borra la junta y, en cascada, a sus participantes. Responde 403 o 404 con la misma regla del PATCH.
10. **Rutas:** se registran en `app.js` como `/juntas`. No se usa `/eventos`: esa ruta ya es el canal SSE de avisos.
11. **Seguridad:**
    - Todas las rutas nuevas entran en la tabla de `autorizacionMatriz.test.js`; la prueba falla si falta una.
    - Las consultas usan parámetros: en `IN`, los `?` se arman a mano, porque `db.js` solo acepta valores primitivos.
    - Los textos se recortan y respetan sus máximos (título 150, descripción 1000).
12. **Datos de prueba:** solo cuentas `zz_test_`. Las juntas se borran solas con la cuenta que las creó. Al terminar quedan 0 filas `zz_test_%` y 0 juntas huérfanas.

## Archivos autorizados

- `Backend/src/utils/seed.js` (solo las dos tablas nuevas)
- `Backend/src/models/JuntaModel.js` (nuevo)
- `Backend/src/controllers/JuntaController.js` (nuevo)
- `Backend/src/routes/juntaRoutes.js` (nuevo)
- `Backend/src/utils/validacionJuntas.js` (nuevo, validaciones puras con prueba unitaria)
- `Backend/src/middlewares/roleMiddleware.js` (`requireCalendario`)
- `Backend/src/app.js` (solo el `require` y el `app.use('/juntas', …)`)
- `Backend/test/juntas.test.js` y `Backend/test/validacionJuntas.test.js` (nuevos), `Backend/test/autorizacionMatriz.test.js`, `Backend/test/seed.test.js`, `Backend/test/inyeccionSql.test.js` (si aplica)
- `Backend/soporte-pruebas/verificarPruebas.js` (`MINIMOS`) y `Backend/soporte-pruebas/bd.js` (solo si la limpieza lo necesita)

Fuera de esta lista, el implementer para y pregunta. El frontend no se toca.

## Notas del orquestador

- **Fechas:** nunca `new Date('AAAA-MM-DD')`. Para armar y comparar, partir el texto en sus partes o usar `dateUtils.js`. Probar los bordes: una junta que termina justo cuando empieza el rango no entra, una que cruza la medianoche sí entra, y el último día del rango cuenta completo.
- **Rol que cambia:** si a un participante le cambian el rol a `usuarios_de_sistema`, su fila se queda. No se limpia en esta rebanada.
- **No entra:** responder invitaciones, estado «por confirmar», avisos, privacidad, ver la agenda de otros, juntas que se repiten ni eventos de todo el día.
- Puertas: `node --test --test-concurrency=1` por archivo y `node soporte-pruebas/verificarPruebas.js`. Comprobar el esquema con `SHOW CREATE TABLE`. No hay navegador, porque la rebanada no tiene interfaz.

---

## Reporte del implementer

1. **Rebanada completada:** sí, con todas las puertas en verde.
2. **Archivos modificados:**
   - Nuevos: `utils/validacionJuntas.js`, `models/JuntaModel.js`, `controllers/JuntaController.js`, `routes/juntaRoutes.js`, `test/validacionJuntas.test.js` (8 pruebas) y `test/juntas.test.js` (14 pruebas).
   - Modificados: `seed.js` (`migrarJuntas()`), `roleMiddleware.js` (`requireCalendario`), `app.js` (montaje), `autorizacionMatriz.test.js` (6 rutas nuevas; el mínimo de módulos pasa de 13 a 14), `inyeccionSql.test.js` y `verificarPruebas.js` (`MINIMOS`).
   - `seed.test.js` y `bd.js` quedaron sin cambios: `juntas.test.js` ya prueba el seed y su repetición.
3. **Prueba en rojo:**
   - `validacionJuntas`: faltaba el módulo.
   - `juntas`: la tabla no existía y las rutas daban 404 porque no estaban montadas.
   - La matriz se puso en verde al agregar las rutas a su tabla.
4. **Puertas:**
   - Los 75 archivos de `test/`, uno por uno, con 0 fallos.
   - `verificarPruebas.js`: 741 pruebas (mínimo 652), 0 fallidas.
   - `SHOW CREATE TABLE`: columnas, índices, llave primaria y las 3 FK en cascada, como en la rebanada.
   - Datos de prueba: 0 filas `zz_test_%`, 0 juntas y 0 huérfanas.
   - Frontend y navegador: no aplican.
5. **Decisiones no cubiertas:**
   - El PATCH pide el cuerpo completo, igual que el alta.
   - PATCH y DELETE revisan primero el acceso (404 o 403) y después validan el cuerpo.
   - Respuestas:
     - alta: 201 con `{ junta }`;
     - GET por id y PATCH: 200 con `{ junta }`;
     - lista: `{ juntas }`;
     - DELETE: 200 con `{ ok: true }`.
   - Un id no numérico responde 400.
   - Un invitado inexistente o con rol fuera del calendario responde 400 «sobre participantes».
   - Campos de error: `título`, `descripción`, `inicio`, `fin`, `participantes` y `rango de fechas`.
   - Las horas se guardan con los segundos en cero.
   - Los invitados se ordenan por nombre.
   - Al editar, `INSERT IGNORE` y `DELETE … NOT IN` conservan la respuesta de los invitados que siguen.
6. **Para la memoria:** tablas `juntas` y `junta_participantes` y rutas `/juntas` con `requireCalendario`. Quedan para la 22 responder invitaciones y el estado «por confirmar», y para la 23, `privada`.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: CAMBIOS NECESARIOS** (Opus, 2026-11-18, sin modificar archivos).

- Los 12 criterios se cumplen en acceso, fechas, SQL, transacción y esquema.
- Pruebas: `juntas` 14/14, `validacionJuntas` 8/8, `autorizacionMatriz` 37/37, `inyeccionSql` 9/9 y `seed` 29/29.
- `verificarPruebas.js`: OK, 741 pruebas.

**Cambio necesario:**

1. `validacionJuntas.js:49-63`: `validarTexto` arma los mensajes en masculino. Con «descripción» sale, por ejemplo, «El descripción supera… Escribe un descripción más corto». Hay que corregir la concordancia, dejar igual la parte «sobre descripción» y fijar el texto en la prueba.

**Opcionales:**

- Comprobar `respondido_en` en la prueba del PATCH.
- `hasta=9999-12-31` arma «10000-01-01» y la consulta no devuelve las juntas de ese día.
- 401 días contando los dos extremos entran en el límite de 400.
- Si la junta se borra justo durante un PATCH, responde 500 en lugar de 404.
- Si a un invitado le cambian el rol a usuario de sistema, la junta ya no se puede editar sin quitarlo.

## Vuelta 2

- **Implementer:**
  - `validarTexto` ahora concuerda en género, con el mapa `GENERO_CAMPO`; la parte «sobre X» no cambió.
  - Prueba nueva en `validacionJuntas.test.js`: fija el texto completo de 5 mensajes.
  - Prueba del PATCH: comprueba que se conserva `respondido_en`.
  - `MINIMOS` de `validacionJuntas` pasa de 8 a 9.
  - Rojo: «El descripción…».
  - `verificarPruebas.js`: OK, 742 pruebas.
- **Verificación del orquestador:** el cambio es acotado y no toca la lógica, así que no repetí la revisión completa. Leí el diff y volví a correr las pruebas: `validacionJuntas` 9/9 y `juntas` 14/14. Quedan 0 cuentas `zz_test_%` y 0 juntas.
- **Estado:** aprobada (2026-11-18).
