# 27 — Recepcionista como secretaria del administrador y nombre «Mi Calendario»

- **Riesgo:** alto (permisos: actuar en nombre de otra cuenta)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Opus)
- **Estado:** aprobada

## Historia

Como recepcionista, quiero administrar la agenda de los administradores como su secretaria, agendando, editando, borrando y respondiendo por ellos, para que no todo lo tenga que hacer el administrador. Además, la pantalla «Juntas» pasa a llamarse «Mi Calendario».

## Decisiones del usuario (2026-11-18)

- La recepcionista **crea juntas a nombre de** un administrador: el organizador es el administrador.
- **Edita y borra** las juntas que organiza un administrador.
- **Responde por** el administrador a las invitaciones que le llegan. Su respuesta confirma o cancela la junta, igual que si respondiera él.
- **Ve todo el detalle** de las juntas de los administradores, incluidas las privadas.
- Atiende a **todos** los administradores, sin asignación.
- **Nombre:** solo cambia el texto a «Mi Calendario». La dirección sigue siendo `/juntas`, para que los avisos guardados funcionen.

## Criterios de aceptación

### Backend

1. **Alta a nombre de un administrador:**
   - `POST /juntas` acepta `organizador_id` **solo si quien llama es recepcionista**.
   - Si viene, debe ser un administrador existente; si no, responde 400 sobre `organizador`. Con cualquier otro rol que lo envíe responde 403.
   - La junta queda con `creado_por = organizador_id`.
   - Las reglas de invitados se aplican respecto del organizador: no puede invitarse a sí mismo. La recepcionista sí puede estar invitada.
   - Sin `organizador_id`, la recepcionista crea juntas propias, como hoy.
2. **Acceso de secretaria:** para una recepcionista, una junta es «de un administrador» si su organizador es administrador o si hay un administrador invitado.
   - **`GET /juntas/:id`:** completa si es de un administrador.
   - **`PATCH` y `DELETE /juntas/:id`:** permitidos si el organizador es administrador.
   - **Juntas de un contador o auxiliar en las que no participa:** sigue la regla actual, 404.
   - **`PATCH /juntas/:id/respuesta`:** acepta `{ respuesta, en_nombre_de }` solo de la recepcionista, y `en_nombre_de` debe ser un administrador invitado a esa junta.
     - Guarda la respuesta en la fila del administrador.
     - Con cualquier otro rol que envíe `en_nombre_de`, responde 403.
     - Si el administrador no está invitado, responde 404.
3. **Agenda:** `GET /juntas/agenda/:usuarioId`, pedida por una recepcionista sobre un administrador, devuelve todas sus juntas completas, incluidas las privadas.
   - Sobre cualquier otra persona aplica la regla de la 23 («Ocupado» y llaves mínimas).
4. **Permisos en la respuesta:** toda junta completa incluye `puede_editar` y `responder_por`.
   - `puede_editar` es un booleano: verdadero si eres el organizador, o si eres recepcionista y el organizador es administrador.
   - `responder_por` es una lista `[{ id, nombre, respuesta }]` de los administradores invitados por los que puedes responder. Siempre va vacía, salvo para la recepcionista.
5. **Avisos:**
   - Lo que la recepcionista hace a nombre de un administrador se avisa a los demás como si lo hubiera hecho el administrador: «{administrador} te invitó…», «{administrador} aceptó…».
   - Además, el administrador recibe un aviso con enlace a la junta:
     - al agendar: «{recepcionista} agendó «{título}» a tu nombre el {fecha} a las {hora}»;
     - al editar: «{recepcionista} cambió «{título}»»;
     - al responder: «{recepcionista} aceptó por ti «{título}»» o «… rechazó por ti …».
   - Al borrar le llega «{recepcionista} borró «{título}» del {fecha}», con `junta_id` en NULL.
   - Nadie recibe aviso de su propia acción.
6. **Seguridad:**
   - Toda la lógica de «secretaria» vive en una función con prueba (por ejemplo, `utils/accesoJuntas.js`).
   - Las pruebas cubren que la recepcionista no puede actuar sobre juntas de contadores o auxiliares, que nadie más puede usar `organizador_id` ni `en_nombre_de`, y que un contador sigue sin ver el detalle de las juntas privadas del administrador.
   - `autorizacionMatriz` e `inyeccionSql` se actualizan con los campos nuevos.

### Frontend

7. **«Mi Calendario»:** el ítem del menú (en las 3 secciones), el título de la pantalla y el `meta.titulo` de la ruta pasan de «Juntas» a «Mi Calendario».
   - El subtítulo del menú pasa a ser «Juntas y vencimientos».
   - La ruta y su nombre (`/juntas`, `juntas`) no cambian.
   - Se actualizan los textos de la pantalla que digan «Juntas» como nombre de la sección.
8. **Recepcionista en la agenda de un administrador** (con «Ver agenda de»):
   - Ve los bloques completos y abre su ficha, también las privadas.
   - «Nueva junta» y el clic en un hueco abren el formulario a nombre de ese administrador. El formulario muestra «Organiza: {administrador}» en texto de solo lectura y no lo precarga como invitado.
   - En la ficha aparecen «Editar» y «Borrar» si `puede_editar`.
   - Por cada administrador de `responder_por` aparece la sección «Responder por {nombre}», con «Aceptar» y «Rechazar» y su respuesta actual marcada.
9. **Para los demás roles no cambia nada:** se comportan como hoy.
10. **Estilo:** Quasar, paleta `$dg-colores`, textos en tú y sin tooltips dentro del calendario (excepción de `AGENTS.md`). Funciona a 375 px.
11. **Datos de prueba:** solo cuentas `zz_test_`. Al terminar quedan 0 filas `zz_test_%` y 0 juntas y avisos de prueba. Los datos del usuario no se tocan.

## Archivos autorizados

Backend:
- `src/controllers/JuntaController.js`, `src/models/JuntaModel.js`, `src/routes/juntaRoutes.js`, `src/utils/validacionJuntas.js`, `src/utils/estadoJunta.js` (solo si hace falta) y `src/utils/accesoJuntas.js` (nuevo)
- `test/juntas.test.js`, `test/respuestasJuntas.test.js`, `test/agendaJuntas.test.js`, `test/validacionJuntas.test.js`, `test/recepcionistaJuntas.test.js` (nuevo), `test/accesoJuntas.test.js` (nuevo), `test/autorizacionMatriz.test.js` e `test/inyeccionSql.test.js`
- `soporte-pruebas/verificarPruebas.js` (`MINIMOS`)

Frontend:
- `src/layouts/MaquetaLayout.vue` (solo el texto de los ítems) y `src/router/index.js` (solo `meta.titulo`)
- `src/pages/JuntasPage.vue`, `src/components/JuntaFormDialog.vue`, `JuntaDetalleDialog.vue` y `CalendarioJuntas.vue`
- `src/services/juntaService.js` y `src/utils/juntas.js`
- `test/juntas*.test.js`, `test/rolRecepcionista.test.js` y las pruebas del menú que fallen por el nombre nuevo, sin debilitarlas

Fuera de esta lista, el implementer para y pregunta. **No hay cambios de esquema.** Quién agendó a nombre de quién no se guarda en la tabla; si se quiere conservar, sería otra rebanada con una columna nueva.

## Notas del orquestador

- No usar «registrado_por» ni ninguna columna nueva. El rastro queda en el aviso que recibe el administrador.
- Puertas:
  - Backend: `node --test --test-concurrency=1` por archivo y `verificarPruebas.js`.
  - Frontend: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`.
- Navegador, con una recepcionista `zz_test_` y un administrador `zz_test_`, en escritorio y a 375 px:
  - la recepcionista abre la agenda del administrador y agenda una junta a su nombre invitando a un contador `zz_test_`;
  - el contador ve la invitación de «{administrador}»;
  - el administrador recibe «… agendó … a tu nombre»;
  - el contador invita al administrador y la recepcionista acepta por él: la junta queda «Confirmada»;
  - el menú dice «Mi Calendario».

---

## Reporte del implementer

1. **Rebanada completada:** sí, backend y frontend, sin cambios de esquema.
2. **Archivos:**
   - Backend:
     - nuevos: `utils/accesoJuntas.js` y sus pruebas, `test/accesoJuntas.test.js` (12) y `test/recepcionistaJuntas.test.js` (28);
     - modificados: `JuntaController.js`, `JuntaModel.js` (recibe al consultante como `{id, rol}` y agrega `puede_editar` y `responder_por`), `validacionJuntas.js` (`validarOrganizador`) y `estadoJunta.js` (4 mensajes nuevos);
     - pruebas ajustadas: `juntas`, `agendaJuntas`, `validacionJuntas`, `autorizacionMatriz` e `inyeccionSql`, más `MINIMOS`.
   - Frontend:
     - `MaquetaLayout.vue` y `router/index.js` (solo textos);
     - `JuntasPage.vue`, `JuntaFormDialog.vue`, `JuntaDetalleDialog.vue`, `juntaService.js` y `juntas.js`;
     - 5 archivos de pruebas.
3. **Prueba en rojo:**
   - `accesoJuntas` y `recepcionistaJuntas` (23 de 28) fallaron por aserto.
   - `validarOrganizador` y `juntasUtils` fallaron por un import que no existía.
   - **Pruebas antiguas ajustadas por el cambio de contrato:**
     - las llaves de la junta ahora incluyen los campos nuevos;
     - en la agenda, la «junta ajena» ya no lleva un administrador invitado, porque con la regla nueva la recepcionista sí la vería.
4. **Puertas:**
   - Backend: 824 pruebas (mínimo 735).
   - Frontend: `lint` y `build` en verde; `node --test` 1598/1598.
   - `prettier --check` está en verde salvo en `MaquetaLayout.vue` y `router/index.js`, que ya fallaban antes de esta rebanada.
   - **Navegador:**
     - el menú dice «Mi Calendario»;
     - la recepcionista agenda a nombre del administrador e invita a un contador;
     - el contador recibe «{administrador} te invitó…»;
     - el administrador recibe «{recepcionista} agendó … a tu nombre»;
     - la recepcionista acepta por el administrador y la junta queda «Confirmada»;
     - a 375 px no hay scroll horizontal.
   - **Datos de prueba:** quedan 0. Siguen las 3 juntas del usuario: 264, 787 y 523.
5. **Decisiones no cubiertas:**
   - En una junta de un contador con un administrador invitado, la recepcionista la ve y puede responder por el administrador, pero no editarla (403).
   - En la agenda de un contador sigue viendo «Ocupado» aunque haya un administrador invitado.
   - El administrador no recibe los avisos genéricos de una respuesta dada en su nombre; solo «… aceptó por ti».
   - `participantes-disponibles` no excluye al organizador: lo quita el frontend y el backend lo rechaza.
6. **Para la memoria:**
   - `accesoJuntas.js` es la única fuente de las reglas de la secretaria.
   - `JuntaModel` recibe al consultante como `{id, rol}`.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (Opus, 2026-11-18, sin modificar archivos).

- Se cumplen los 11 criterios.
- Revisó los permisos uno por uno:
  - `organizador_id` y `en_nombre_de` solo los puede usar la recepcionista, y solo sobre administradores;
  - no hay acceso a juntas de contadores ni de auxiliares sin un administrador;
  - el contador sigue sin ver las juntas privadas del administrador;
  - `accesoJuntas.js` es la única fuente de las reglas.
- Puertas:
  - Backend: 151/151 en los 9 archivos de juntas y `verificarPruebas.js` OK, con 824 pruebas.
  - Frontend: `lint` y `build` en verde; `node --test` 1598/1598.
- No probó en el navegador.

**Opcionales:**

1. `JuntaController.js:251`: la comprobación `rol !== 'administrador'` debería pasar a `accesoJuntas.js`.
2. «Puedes responder por él» asume el género. **Aplicado por el orquestador:** ahora dice «Puedes responder en su nombre».
3. Cuando la recepcionista responde por el administrador, a él no le llega el aviso de estado («quedó confirmada»), solo el de «… aceptó por ti». Queda para decidir con el usuario.
4. En `utils/avisos.js:5`, un comentario todavía dice «Juntas».

## Cierre del orquestador

- Apliqué el opcional 2 y volví a correr las puertas del frontend: `lint:check` con salida 0 y `node --test` 1598/1598.
- En el navegador me apoyo en la prueba del implementer, en escritorio y a 375 px. No la repetí.
- **Estado:** aprobada (2026-11-18).
