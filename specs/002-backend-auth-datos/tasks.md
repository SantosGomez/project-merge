# Tareas 002 — Backend con autenticación y datos

Máximo 10 tareas, en orden de dependencia. Cada una con sus RF y comprobación verificable. Formato: `node --test` desde `backend/`.

- [x] **T1. Tests de utilidades de contraseña y validación (en rojo).** RF-02, RF-19, RF-20, RF-21, RNF-1
  - Hecho cuando: `node --test test/passwordUtils.test.js test/validationUtils.test.js` falla (tests en rojo) para `hashPassword`, `verifyPassword`, `validateLoginInput`, `validateNewCaseInput`.

- [x] **T2. Implementar utilidades de contraseña (Argon2id) y validación de entrada.** RF-02, RF-19, RF-20, RF-21, RNF-1
  - Hecho cuando: `node --test test/passwordUtils.test.js test/validationUtils.test.js` pasa en verde; `hashPassword` y `verifyPassword` usan Argon2id; las validaciones devuelven los campos faltantes o el código de error correcto.

- [x] **T3. Tests de tokens, fechas y errores (en rojo).** RF-01, RF-04, RF-05, RF-25, RF-26, RNF-2, RNF-5, RNF-6
  - Hecho cuando: `node --test test/tokenUtils.test.js test/dateUtils.test.js test/errorUtils.test.js` falla (tests en rojo) para `generateAccessToken`, `verifyAccessToken`, `isTokenExpired`, `isSessionInactive`, `buildError`.

- [x] **T4. Implementar generación, verificación de tokens JWT y utilidades de fecha y error.** RF-01, RF-04, RF-05, RF-25, RF-26, RNF-2, RNF-5, RNF-6
  - Hecho cuando: `node --test test/tokenUtils.test.js test/dateUtils.test.js test/errorUtils.test.js` pasa en verde; `generateAccessToken` devuelve JWT firmado con campo exp; `verifyAccessToken` decodifica y valida; `isTokenExpired` y `isSessionInactive` reciben `hoy` como parámetro; `buildError` devuelve las tres partes en español.

- [x] **T5. Tests de modelos de datos y seed de datos maestros (en rojo).** RF-27, RF-12, RF-13, RF-14, RF-15, RF-16
  - Hecho cuando: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` falla (tests en rojo) para consultas SQL, conteos con ceros, búsqueda por contador y seed de datos maestros.

- [x] **T6. Implementar configuración de BD, modelos SQL y seed de datos maestros.** RF-27, RF-12, RF-13, RF-14, RF-15, RF-16
  - Hecho cuando: `node --test test/userModel.test.js test/caseModel.test.js test/seed.test.js` pasa en verde (con MariaDB de prueba); `seedDatabase` crea tablas e inserta administrador y contador con contraseñas hasheadas y no hace nada si ya existen.

- [x] **T7. Tests de middlewares de autenticación, roles y propiedad de casos (en rojo).** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11
  - Hecho cuando: `node --test test/authMiddleware.test.js test/roleMiddleware.test.js test/ownershipMiddleware.test.js` falla (tests en rojo) para `authenticateToken`, `requireAdmin`, `requireAdminOrSistema`, `checkCaseOwnership`.

- [x] **T8. Implementar middlewares de autenticación, roles y propiedad de casos.** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09, RF-10, RF-11
  - Hecho cuando: `node --test test/authMiddleware.test.js test/roleMiddleware.test.js test/ownershipMiddleware.test.js` pasa en verde; el middleware adjunta `req.user`, rechaza sin sesión, rechaza token expirado/revocado/inactivo y actualiza la actividad en cada petición válida.

- [x] **T9. Implementar controladores y rutas de la API.** RF-01 a RF-30 (todos)
  - Hecho cuando: `node --test test/authRoutes.test.js test/caseRoutes.test.js test/counterRoutes.test.js test/userRoutes.test.js` pasa en verde (requiere MariaDB de prueba); todos los endpoints responden con formato JSON consistente y mensajes en español con tres partes (RF-23, RNF-5, RNF-6).

- [x] **T10. Cablear `app.js` y `server.js`, registrar rutas, levantar servidor y pruebas de integración completa.** RF-01 a RF-30 (todos), criterios 1-25
  - Hecho cuando: `cd backend && node src/server.js` levanta el servidor sin errores, ejecuta el seed y responde en los endpoints montados (login, logout, contadores, casos, usuarios); `node --test` desde `backend/` pasa en verde (100% de tests, ninguno fallando), cubriendo los 25 criterios de finalización de la spec; sin tests en rojo pendientes.

## Cobertura y división

- Las 10 tareas cubren la spec completa: RF-01 a RF-30, RNF-1 a RNF-6, y los 25 criterios de finalización verificados en T10.
- No hace falta dividir la spec en bloques: entran en 10 tareas.
- Dependencias: T2 depende de T1; T4 depende de T3; T6 depende de T5; T8 depende de T7 y de T2/T4; T9 depende de T2, T4, T6 y T8; T10 depende de T9.

---

## Cambio 1 — protección de datos, CORS e ids

Plan: sección 8 de `plan.md`. Requisitos: RF-12, RF-14, RF-16 (modificados), RF-32 a RF-35, RNF-7, criterios 1 y 24 a 29.

> **Recuento (pendiente de decisión del usuario):** T1-T10 ya agotan el cupo de 10 tareas de la spec. Las tareas T11-T20 son otras 10 y cada una sigue siendo corta. Recomendación: tratarlas como un bloque de cambio dentro de esta misma spec (el cambio modifica requisitos de la 002 y comparte su criterio de cierre; abrir una spec 004 duplicaría contexto y trazabilidad), contando el cupo de 10 **por bloque** y no por spec. Alternativa: spec 004 "Cambio 1 del backend". Ver preguntas en la respuesta del planner.

Reglas: tests primero (en rojo, con `node:test` real) y luego código; `node --test` desde `backend/`. ⚠️ = modifica archivos existentes que ya funcionan; requiere aprobación explícita antes de empezar.

- [ ] **T11. Tests en rojo de orígenes permitidos: funciones puras y guard.** RF-34
  - Archivos nuevos: `backend/test/originUtils.test.js`, `backend/test/originMiddleware.test.js`.
  - Hecho cuando: `node --test test/originUtils.test.js test/originMiddleware.test.js` falla porque `originUtils.js` y `originMiddleware.js` no existen. Los tests cubren: `parseAllowedOrigins` (lista con comas y espacios, barra final, vacío o `undefined` devuelve los dos orígenes por defecto de desarrollo), `isOriginAllowed` (exacto sí; otro puerto, otro host, `null`, vacío y mayúsculas distintas no) y el guard (sin origen llama a `next`; permitido llama a `next`; no permitido responde 403 con las tres partes en español y no llama a `next`).

- [ ] **T12. Implementar `originUtils` y `originMiddleware`.** RF-34, RF-23
  - Archivos nuevos: `backend/src/utils/originUtils.js`, `backend/src/middlewares/originMiddleware.js`.
  - Hecho cuando: `node --test test/originUtils.test.js test/originMiddleware.test.js` pasa en verde; `createOriginGuard` y `buildCorsOptions` exportados; las funciones puras no dependen de Express ni del entorno.

- [ ] **T13. Tests en rojo de CORS sobre la app real.** RF-34, criterios 24, 28
  - Archivo nuevo: `backend/test/appCors.test.js` (usa `crearApp({ origenesPermitidos: [...] })`).
  - Hecho cuando: `node --test test/appCors.test.js` falla (hoy `cors()` acepta cualquier origen) comprobando: origen local permitido devuelve la cabecera `Access-Control-Allow-Origin` con ese origen; origen de otro sitio y puerto local no listado reciben 403 sin esa cabecera; petición sin origen a un endpoint protegido y sin token devuelve 401 (llegó al control de acceso, no 403 por origen); preflight `OPTIONS` con origen permitido responde con las cabeceras CORS y con origen no permitido responde 403.

- [ ] **T14. ⚠️ Cablear la restricción de orígenes en `app.js` y `.env`.** RF-34, criterios 24, 28
  - Archivos existentes tocados: `backend/src/app.js` (`crearApp(opciones)` acepta `origenesPermitidos`; sustituye `cors()` por guard + `cors(buildCorsOptions(...))` antes de `express.json()`; corrige el comentario RF-24 → RF-34) y `backend/.env` (añade `CORS_ORIGENES=http://localhost:9000,http://127.0.0.1:9000`, sin credenciales).
  - Hecho cuando: `node --test test/appCors.test.js` pasa en verde y las rutas existentes siguen montadas igual (`crearApp()` sin argumentos sigue funcionando); `node src/server.js` arranca sin errores.

- [ ] **T15. Tests en rojo de respuestas: `id` en login, lista de contadores y barrido sin datos de acceso.** RF-01, RF-12, RF-32, RF-33, RNF-7, criterios 1, 26, 27
  - Archivo nuevo: `backend/test/respuestasApi.test.js` (MariaDB real; usuario de sistema creado con nombre único).
  - Hecho cuando: `node --test test/respuestasApi.test.js` falla porque: el login de administrador, contador y usuarios_de_sistema no incluye `id` numérico; `GET /contadores` trae además `password_hash`, `rol` y `creado_en` (cada contador debe tener exactamente las claves `id` y `usuario`); el barrido (login, logout, lista de contadores, conteos, casos de contador, mis casos, alta y cambio de caso, alta de usuario, y errores 400/401/403/404) encuentra `password_hash` en `GET /contadores`.

- [ ] **T16. ⚠️ Añadir `id` al login y filtrar la lista de contadores a `id` y `usuario`.** RF-01, RF-12, RF-32, RF-33, RNF-7, criterios 1, 26, 27
  - Archivos existentes tocados: `backend/src/models/UserModel.js` (solo **añade** `findCountersPublic`; las demás funciones no cambian), `backend/src/controllers/CounterController.js` (`listCounters` usa `findCountersPublic`; mismo mensaje de vacío), `backend/src/controllers/AuthController.js` (`login` añade `id: cuenta.id` a la respuesta).
  - Hecho cuando: `node --test test/respuestasApi.test.js` pasa en verde; ninguna respuesta del barrido contiene `password_hash` ni `$argon2`; `findByUsername`, `findAll`, `findById` y `create` quedan sin cambios (el diff de `UserModel.js` solo añade código).

- [ ] **T17. Tests en rojo de ids que no son de un contador.** RF-35, RF-14, RF-16, criterio 29
  - Archivo nuevo: `backend/test/idsContador.test.js` (MariaDB real) y casos de `parseCounterId` incluidos en él (puros).
  - Hecho cuando: `node --test test/idsContador.test.js` falla porque `parseCounterId` no existe y porque `/contadores/:id/conteos` y `/contadores/:id/casos` devuelven 200 para el id de un administrador y de un usuarios_de_sistema. Debe comprobar además: id inexistente, no numérico (`abc`, `2abc`) y negativo devuelven 404 con el texto "No se encontró el contador"; el id de un contador real sigue devolviendo 200 con conteos (ceros incluidos) y casos.

- [ ] **T18. ⚠️ Rechazar con 404 los ids que no son de un contador.** RF-35, RF-14, RF-16, criterio 29
  - Archivos existentes tocados: `backend/src/utils/validationUtils.js` (solo **añade** `parseCounterId`), `backend/src/models/UserModel.js` (solo **añade** `findCounterById`), `backend/src/controllers/CounterController.js` (`countCasesByStatus` y `getCasesByCounter` usan `parseCounterId` + `findCounterById` en lugar de `findById`; mensajes y códigos iguales que hoy).
  - Hecho cuando: `node --test test/idsContador.test.js test/respuestasApi.test.js` pasa en verde; el diff de los tres archivos solo añade funciones y cambia las llamadas de esos dos controladores; `getMyCases` y `listCounters` no se modifican en esta tarea.

- [ ] **T19. Resolver `mock_exp.test.js` según decisión del usuario.** criterio 25
  - Pendiente de la decisión del usuario (pregunta 1). Según la opción elegida:
    - Eliminar: `backend/test/mock_exp.test.js` se borra. Hecho cuando el archivo ya no existe y `node --test` no lista "mock CJS experiment".
    - Reparar: se reescribe como prueba real que pase (por ejemplo, con `mock.module` o con el patrón estándar de la suite). Hecho cuando `node --test test/mock_exp.test.js` pasa en verde y comprueba algo útil del proyecto.
    - Excluir: se cambia el modo de ejecución (por ejemplo, el script `test` de `package.json` con un patrón que no lo incluya). Hecho cuando `npm test` desde `backend/` no lo ejecuta y la regla queda documentada. Esta opción hace que `node --test` a secas siga fallando, por lo que no cumple literalmente el criterio 25.
  - ⚠️ Modifica o borra un archivo existente (`mock_exp.test.js`, o `package.json` si se elige excluir).

- [ ] **T20. Validación y cierre del Cambio 1.** RF-12, RF-14, RF-16, RF-32 a RF-35, RNF-7, criterios 1 y 24 a 29
  - Hecho cuando: `cd backend && node --test` termina con 0 tests fallando (todos los archivos nuevos ejecutando comprobaciones reales); `node src/server.js` arranca y, con las credenciales del seed, se comprueba manualmente: login con `id`, `GET /contadores` sin `password_hash`, conteos de un id de administrador devuelve 404, petición con `Origin` distinto devuelve 403 y sin `Origin` funciona con token; `MEMORY.md` actualizado con lo hecho y los hallazgos pendientes; la línea `Estado:` de `spec.md` cambia a `implementada` solo si el usuario lo aprueba.

### Cobertura y dependencias del Cambio 1

- Cobertura: RF-34 → T11-T14; RF-01, RF-12, RF-32, RF-33, RNF-7 → T15-T16; RF-35, RF-14, RF-16 → T17-T18; criterio 25 → T19; todo → T20.
- Dependencias: T12 depende de T11; T13 de T12; T14 de T12 y T13; T15 puede hacerse tras T14 (o antes, es independiente de CORS); T16 de T15; T17 de T16 (comparten `UserModel.js` y `CounterController.js`); T18 de T17; T19 es independiente pero debe estar decidida antes de T20; T20 de todas.
