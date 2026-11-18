# 20 — Rol «Recepcionista»

- **Riesgo:** alto (roles y permisos, esquema de la tabla `usuarios`)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer` con Fable u Opus)
- **Estado:** aprobada

Primera rebanada del módulo de calendario. Plan acordado con el usuario el 2026-11-18:

1. **Rol «Recepcionista» (esta rebanada).**
2. Calendario base: tablas `eventos` y `evento_participantes`, API y vistas mes / semana / día (horario laboral) con QCalendar (dependencia nueva, por aprobar).
3. Invitaciones: el administrador confirma o rechaza; aviso en la app (`notificaciones.evento_id`).
4. Juntas privadas: los demás ven solo «Ocupado» (se decide por junta).
5. Avisos por correo (`nodemailer` + cuenta del despacho, por aprobar).
6. Vista de año y vencimientos de casos en el calendario.

Decisiones del usuario: calendario propio (Google Calendar queda aparte), solo juntas internas, privacidad por junta, avisos en la app y por correo, y la recepcionista ve el calendario y el directorio.

## Historia

Como despacho, quiero crear cuentas con rol «Recepcionista» para que la recepción entre a la app, consulte el directorio y, en la siguiente rebanada, use el calendario.

## Criterios de aceptación

1. **Esquema:** el seed deja `usuarios.rol` como `ENUM('administrador', 'contador', 'usuarios_de_sistema', 'auxiliar', 'recepcionista')`, en minúscula como los demás. Hoy la base de XAMPP tiene `'Recepcionista'` agregado a mano y el seed lo borraría en el siguiente arranque. El `ALTER ... MODIFY` lo corrige sin perder filas, igual que se hizo con `'Auxiliar'`.
2. **Alta y edición:** `validationUtils` e `importarCuentas` aceptan `recepcionista`. El usuario de sistema puede crearla y editarla desde el directorio (`POST` y `PATCH /usuarios`), y el diálogo ofrece la opción «Recepcionista». El aviso de rol no válido la incluye en la lista. La parte «sobre X» de `buildError` no cambia.
3. **Inicio de sesión:** la recepcionista entra y cae en el directorio (`/admin/directorio`) como pantalla principal provisional. La rebanada 2 la cambia al calendario.
4. **Directorio de solo consulta:** `GET /usuarios` permite `recepcionista`. Las escrituras de `/usuarios` (alta, edición, restablecer contraseña, contadores del auxiliar) siguen con 403 para ella. En la vista no ve ningún botón de acción («Nuevo usuario», «Editar», «Restablecer contraseña», «Contador que apoya», «Ver casos importantes») ni los textos de ayuda del administrador o del usuario de sistema.
5. **Menú lateral:** una sección «Recepción» con un solo ítem, «Directorio» (subtítulo «Consultar cuentas del equipo»). Sin tooltip, como los demás ítems del menú. No ve «Mi trabajo», «Auditorías», «Resumen del equipo» ni la campana de avisos.
6. **Bloqueo en todo lo demás:** con token de recepcionista, todas las rutas de casos, contadores, auditorías, actividades, clientes, tipos, tiempo, jornadas e informes responden 403. Se comprueba agregando el rol a `TODOS` en `autorizacionMatriz.test.js`. En el frontend, las rutas con `meta.perfil` que no la incluyen la mandan a acceso denegado o a su pantalla principal, igual que a los demás roles.
7. **Nombre legible:** `formatearRol('recepcionista')` devuelve «Recepcionista» (pie del menú lateral y filtro «Rol» del directorio).
8. **Datos de prueba:** solo cuentas `zz_test_`; al terminar quedan 0 filas `zz_test_%`.

## Archivos autorizados

Backend:
- `Backend/src/utils/seed.js` (solo el `ALTER ... MODIFY rol` y el `CREATE TABLE usuarios`)
- `Backend/src/utils/validationUtils.js`
- `Backend/src/utils/importarCuentas.js`
- `Backend/src/controllers/UserController.js` (solo el texto de rol no válido)
- `Backend/src/middlewares/roleMiddleware.js` (nuevo middleware para el directorio)
- `Backend/src/routes/userRoutes.js` (solo `GET /`)
- `Backend/test/rolRecepcionista.test.js` (nuevo), `Backend/test/autorizacionMatriz.test.js`, `Backend/test/seed.test.js`, `Backend/test/validationUtils.test.js`, `Backend/test/importarCuentas.test.js`
- `Backend/soporte-pruebas/*` solo si hace falta para crear la cuenta de prueba del rol nuevo (y `MINIMOS`)

Frontend:
- `Seguimiento-proyectos/src/utils/constants.js` (`PROFILES`, `RUTA_PRINCIPAL_POR_ROL`)
- `Seguimiento-proyectos/src/stores/session.js` (getter `esRecepcionista`)
- `Seguimiento-proyectos/src/router/index.js` (`meta.perfil` del directorio)
- `Seguimiento-proyectos/src/layouts/MaquetaLayout.vue` (sección «Recepción»)
- `Seguimiento-proyectos/src/pages/CountersDirectoryPage.vue` (solo si algún botón o texto le queda visible)
- `Seguimiento-proyectos/src/components/NewUserDialog.vue` (opción de rol)
- `Seguimiento-proyectos/src/utils/formateadores.js`
- `Seguimiento-proyectos/test/rolRecepcionista.test.js` (nuevo) y las pruebas existentes que fallen por el rol nuevo (sin debilitarlas)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- **Trampa del ENUM:** el seed corre `ALTER TABLE usuarios MODIFY rol ENUM(...)` en cada arranque. La base tiene `sql_mode` sin modo estricto: si el ENUM no incluye el rol, las filas con ese valor quedan en `''` sin error. Primero va la prueba del seed. Nunca `DROP` ni `ALTER` destructivo en las pruebas.
- Copiar el patrón de la rebanada del rol auxiliar (`test/rolAuxiliar.test.js` en ambos lados).
- `GET /usuarios` devuelve lo mismo que hoy (incluye último acceso). Si el usuario pide ocultar datos a la recepcionista, va en otra rebanada.
- Rutas que ya no revisan rol y le quedan abiertas: `/auth/*`, `/notificaciones`, `/eventos/pase` y `GET /casos/mis-casos` (devuelve vacío). Es aceptable; la campana se le habilita en la rebanada 3.
- **No entra:** calendario, tablas de eventos, avisos ni correo. Tampoco se toca «Mi perfil» (la recepcionista no lo tiene en esta rebanada).
- Puertas: backend `node --test --test-concurrency=1` por archivo + `node soporte-pruebas/verificarPruebas.js`; frontend `npm run lint:check`, `npx prettier --check`, `npm run build`, `node --test`; navegador con `backend-experimento-3011` + `frontend-experimento-9012` (escritorio y 375 px), entrando como recepcionista y como usuario de sistema (alta de una recepcionista `zz_test_`).

---

## Reporte del implementer

1. **Rebanada completada:** sí. El seed fija el ENUM con `recepcionista`. Alta y edición desde el directorio. La recepcionista entra al directorio en solo consulta (`GET /usuarios` abierto, escrituras en 403), cae en `/admin/directorio` con la sección «Recepción» y sin campana. El resto da 403 en el backend y «Acceso denegado» en el frontend.
2. **Archivos modificados:**
   - Backend: `seed.js`, `validationUtils.js`, `importarCuentas.js`, `UserController.js` (texto de rol no válido, 2 sitios), `roleMiddleware.js` (nuevo `requireConsultaDirectorio`), `userRoutes.js` (`GET /`).
   - Pruebas del backend: `rolRecepcionista.test.js` (nueva, 5 pruebas), `autorizacionMatriz.test.js`, `seed.test.js`, `validationUtils.test.js`, `importarCuentas.test.js`, `editarUsuario.test.js`. En `soporte-pruebas/verificarPruebas.js` cambió `MINIMOS`.
   - Frontend: `constants.js`, `session.js` (`esRecepcionista`), `router/index.js`, `formateadores.js`, `MaquetaLayout.vue`, `CountersDirectoryPage.vue` (ayuda propia, «Contador que apoya» oculto y filtro «Rol»), `NewUserDialog.vue`.
   - Pruebas del frontend: `rolRecepcionista.test.js` (nueva, 8 pruebas), `exampleData.test.js`, `directorioUsuarios.test.js`, `contadoresDeAuxiliar.test.js`, `layout-drawer-check.js`.
3. **Prueba en rojo:**
   - Seed: un usuario recepcionista quedaba con `rol = ''`, porque el ENUM del seed no tenía el rol.
   - Alta y edición: daban 400 «Rol no válido».
   - Directorio: `GET /usuarios` daba 403 a la recepcionista.
   - `validateRol('recepcionista')` daba `false`.
   - Importación de cuentas: no creaba la fila con ese rol.
   - Frontend: no existían `PROFILES.recepcionista`, el getter ni la sección «Recepción».
4. **Puertas:**
   - Backend: los 73 archivos en verde, uno por uno. `verificarPruebas.js` en verde: 719 pruebas (mínimo 630) y 0 fallidas.
   - Frontend: `lint:check`, `build` y `node --test` (1443 pruebas) en verde.
   - `prettier --check`: en verde solo el archivo de prueba nuevo; los archivos existentes ya fallaban antes por CRLF.
   - Navegador (escritorio y 375 px) como recepcionista y como usuario de sistema: en verde, incluido el alta de una recepcionista.
   - Datos de prueba: 0 filas `zz_test_%`.
5. **Decisiones no cubiertas:**
   - `editarUsuario.test.js` (fuera de la lista): solo cambió el texto esperado del aviso de rol.
   - `NewUserDialog.vue`: se agregó una ayuda para el rol, con su prueba.
   - «Contador que apoya» ahora se oculta a la recepcionista.
   - `layout-drawer-check.js`: el bloque «Recepción» queda excluido del chequeo, igual que los otros roles.
   - El directorio usa un middleware nuevo en lugar de ampliar `requireAdminOrSistema`.
6. **Para la memoria:**
   - El ENUM tiene 5 roles y el seed lo fija en cada arranque. Sin modo estricto, si falta un rol las cuentas quedan con `''`.
   - La pantalla principal de la recepcionista es provisional hasta el calendario.
   - `lint:check` imprime todo; solo cuenta su código de salida.

## Veredicto del reviewer (vuelta 1)

La primera revisión con Fable no terminó porque se agotó la cuota de ese modelo. Se repitió con `reviewer` usando Opus.

**VEREDICTO: APROBADO** (Opus, 2026-11-18, sin modificar archivos).

- Se cumplen los 8 criterios.
- Pruebas del backend:
  - `rolRecepcionista` 5/5
  - `autorizacionMatriz` 37/37
  - `seed` 29/29
  - `validationUtils` 26/26
  - `importarCuentas` 3/3
  - `editarUsuario` 13/13
  - `userRoutes` 15/15
  - `roleMiddleware` 8/8
  - `rolAuxiliar` 10/10
  - `verificarPruebas.js`: OK, 719 pruebas
- Frontend: `lint:check` y `build` en verde; `node --test` 1444/1444.
- Navegador: escritorio y 375 px en verde.
- Fuera de la lista autorizada solo quedó `editarUsuario.test.js`, que es consecuencia del criterio 2. No debilita la prueba.

**Opcionales (sin aplicar):**

1. `rolRecepcionista.test.js:61-73`: después de editar, releer el rol guardado, no solo el 200.
2. `seed.test.js:398-403`: crear la recepcionista antes de correr el seed. Esa es la trampa real.
3. Un 403 en la consola. El orquestador lo rastreó: era `GET /contadores/:id/contadores-que-me-tienen-como-auxiliar`, que solo llaman «Mis casos» y «Mi perfil». Al repetir la prueba (entrar como recepcionista y abrir `/contador/casos`) no hubo ninguna petición nueva, así que no se pudo reproducir. Sin cambios.

## Cierre del orquestador

- Verificación en el navegador con una recepcionista `zz_test_`:
  - Cae en el directorio y solo pide `/usuarios`, `/eventos/pase` y `/eventos`, sin errores.
  - `/contador/casos` muestra «Acceso denegado».
  - A 375 px no hay scroll horizontal ni botones de acción, y no aparece la campana. El menú muestra «Recepción · Directorio».
- Datos de prueba: 0 filas `zz_test_%`. Servidores cerrados.
- **Estado:** aprobada.
