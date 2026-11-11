# 04 — El administrador se entera cuando un contador cambia su equipo

- **Riesgo:** medio (lógica nueva en un controlador y la campana visible para un rol más; sin cambios de permisos del backend ni de tabla)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet, instancia nueva)
- **Estado:** aprobada (implementada, revisada y verificada en navegador el 2026-11-11)

Une las antiguas 04a (aviso guardado) y 04b (campana del administrador): por separado ninguna deja algo que el usuario pueda ver (decisión del usuario, 2026-11-11).

## Historia

Como administrador, quiero ver en la campana cuando un contador agrega o quita a un auxiliar de su equipo, para enterarme de los cambios de equipo que no hice yo.

## Criterios de aceptación

1. **El contador agrega → se avisa a cada administrador.** Con `POST /contadores/:id/auxiliares/:auxiliarId` exitoso (201), cada cuenta con rol `administrador` recibe «{contador} agregó a {auxiliar} a su equipo.» (`caso_id` nulo) y el evento `aviso-nuevo`. Los avisos al contador y al auxiliar de la rebanada 03 no cambian.
2. **El contador quita → se avisa a cada administrador.** Con `DELETE /contadores/:id/auxiliares/:auxiliarId` que quita un vínculo real, cada administrador recibe «{contador} quitó a {auxiliar} de su equipo.». Si no había vínculo, o la asignación se rechazó (409, 400, 403, 404), no se crea ningún aviso para administradores. Las cuentas `usuarios_de_sistema` nunca reciben estos avisos.
3. **El administrador ve la campana.** En el menú aparece `CampanaAvisos` para el administrador, en la barra móvil y en el encabezado de escritorio, con su contador de avisos sin leer; los avisos de equipo se muestran sin enlace. Los usuarios de sistema siguen sin campana; contador y auxiliar la ven como hoy.

## Archivos autorizados

- `Backend/src/controllers/AuxiliarController.js` — aviso a los administradores en `asignarAuxiliar` y `quitarAuxiliar`.
- `Backend/src/models/UserModel.js` — solo si hace falta una consulta de administradores; primero intentar con `findAll({ rol: 'administrador' })`, que ya existe.
- `Backend/test/auxiliarRoutes.test.js` — pruebas de los criterios 1 y 2.
- `Seguimiento-proyectos/src/layouts/MaquetaLayout.vue` — las dos condiciones `v-if` de `CampanaAvisos` (líneas ~32 y ~299).
- `Seguimiento-proyectos/src/stores/session.js` — solo si conviene un getter para «ve la campana».
- `Seguimiento-proyectos/test/` — una prueba nueva del criterio 3, y el ajuste de los dos asertos que hoy exigen el `v-if` anterior: `avisosPrioridad.test.js:73` y `rolAuxiliar.test.js:68`. Esos dos se cambian porque cambia el requisito (la campana ya no es solo de quien trabaja casos); deben seguir exigiendo que haya exactamente 2 campanas y que contador y auxiliar la vean.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones aprobadas por el usuario (2026-11-11):
  1. Solo la vía del contador avisa a los administradores. Los cambios que hace el despacho desde el directorio (`PUT /usuarios/:id/contadores` y el alta) no les avisan.
  2. Textos: «{contador} agregó a {auxiliar} a su equipo.» y «{contador} quitó a {auxiliar} de su equipo.».
  3. Sin aviso emergente: la campana del administrador solo suma al contador de sin leer, igual que hoy para contador y auxiliar.
- Decisión previa del usuario (2026-11-10): el aviso llega solo a administradores, no a usuarios de sistema, y sí se les pone campana.
- `GET /notificaciones` y `PATCH /notificaciones/leidas` ya sirven a cualquier cuenta con sesión: el backend de la campana no se toca.
- `destinoDeAviso` (`utils/avisos.js`) ya devuelve «sin enlace» para el rol administrador: no hace falta cambiar `CampanaAvisos.vue`.
- **NO entra:** avisar por los cambios del despacho, aviso emergente, enlace del aviso al directorio, textos de ayuda (05), prueba del evento `aviso-nuevo` (pendiente opcional de la 02 y la 03).
- Trampas: pruebas del backend por archivo (todas juntas se cuelgan); `verificarPruebas.js` da «FALLA» solo por `MINIMOS` desactualizados (defecto previo); solo cuentas y datos `zz_test_`, nunca `admin_seed` ni cuentas reales; hay 12 filas `zz_test_%` de antes y deben seguir siendo 12; nada en segundo plano; varios `.vue` usan CRLF.
- Puertas: Backend `node --test test/auxiliarRoutes.test.js`, `test/contadoresDeAuxiliar.test.js`, `test/rolAuxiliar.test.js` y `node soporte-pruebas/verificarPruebas.js`. Frontend `npm run lint:check`, `npm run build`, `node --test`. Navegador (`backend-experimento-3011` + `frontend-experimento-9012`): campana del administrador en móvil y escritorio, con un aviso real creado por un contador `zz_test_`.

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: criterios 1, 2 y 3.
2. Archivos modificados: `AuxiliarController.js` (función nueva `avisarAdministradores`, llamada en `asignarAuxiliar` tras el 201 y en `quitarAuxiliar` solo si se quitó de verdad; usa `UserModel.findAll({ rol: 'administrador' })`), `auxiliarRoutes.test.js` (2 pruebas nuevas), `stores/session.js` (getter `veCampana`), `MaquetaLayout.vue` (los 2 `v-if` de la campana), `test/campanaAdministrador.test.js` (nuevo) y el regex de `avisosPrioridad.test.js:73` y `rolAuxiliar.test.js:68`.
3. Pruebas en rojo: backend, las dos nuevas fallaron con «el administrador recibe el aviso: actual 0, expected 1»; frontend, «el store define el getter veCampana» y 0 coincidencias contra 2 esperadas en la plantilla.
4. Puertas: backend `auxiliarRoutes` 14/14, `contadoresDeAuxiliar` 9/9, `rolAuxiliar` 10/10, `verificarPruebas.js` 391 pruebas y 0 fallidas (FALLA solo por `MINIMOS`, defecto previo); frontend lint y build en verde, `node --test` 1037/1037.
5. Decisiones no cubiertas: las pruebas avisan a todos los administradores de la base de pruebas, incluidas cuentas que no son `zz_test_`, y dejaban avisos de prueba en sus campanas.
6. Para la memoria: getter `veCampana`; revisar que no queden avisos `%zz_test_%` en `notificaciones`.

### Ajuste del orquestador (aprobado por el usuario)

`rolAuxiliar.test.js` y `contadoresDeAuxiliar.test.js` del backend dejaban 6 avisos de prueba cada uno a administradores. Corrección en un solo lugar: `limpiarDatosDePrueba` (`Backend/soporte-pruebas/bd.js`) borra los avisos cuyo mensaje contiene `zz_test_`; se quitó la limpieza suelta de `auxiliarRoutes.test.js`. Tras correr las cuatro pruebas de auxiliares y `verificarPruebas.js`: 0 avisos de prueba.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet, instancia nueva), 2026-11-11, con el ajuste de `bd.js` incluido. Resumido por el orquestador.

VEREDICTO: APROBADO

- Los 3 criterios se cumplen. Los dos asertos ajustados solo cambian `trabajaCasos` por `veCampana` y siguen exigiendo exactamente 2 campanas.
- El borrado de `bd.js` solo alcanza mensajes con el prefijo literal `zz_test_` (guiones bajos escapados) y no rompió ninguna prueba.
- Ejecutado: los 43 archivos del backend uno por uno, 0 fallos; `verificarPruebas.js` 391 pruebas, 0 fallidas; frontend lint, build y 1037/1037. Base igual antes y después.
- Ninguna prueba nueva pasaría sin el cambio (las del backend, razonado; las del frontend, porque el getter no existía).

Opcional (no bloquea):

1. El borrado de `bd.js` es global por prefijo: si algún día se corren archivos de prueba en paralelo, la limpieza de uno podría borrar avisos de otro en marcha. Hoy se corre por archivo.
2. `campanaAdministrador.test.js` extrae el getter con una expresión regular; se rompería si el getter pasa a varias líneas.

## Verificación en navegador (orquestador, 2026-11-11)

Con `backend-experimento-3011` + `frontend-experimento-9012` y cuentas `zz_test_` creadas y borradas para la prueba:

- Administrador en móvil (375 px): la campana aparece en la barra; al agregar el contador a un auxiliar por la API, el contador de sin leer pasó a 1 sin recargar y el aviso decía «{contador} agregó a {auxiliar} a su equipo.».
- Administrador en escritorio (1280 px): la campana aparece en el encabezado; tras quitar, mostró «{contador} quitó a {auxiliar} de su equipo.» como nuevo y el anterior como leído.
- Usuario de sistema: sin campana en móvil ni en escritorio.
- Sin errores en la consola. Al terminar: 12 filas `zz_test_%` en `usuarios` (las de antes) y 0 avisos de prueba.
