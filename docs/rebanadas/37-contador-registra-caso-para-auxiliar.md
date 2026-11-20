# 37 — El contador registra un caso nuevo a nombre de su auxiliar

- **Riesgo:** medio (permiso nuevo, pero copia el patrón de `POST /casos/para-auxiliar`)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** refinada

## Historia

Como contadora con auxiliares, quiero registrar un caso nuevo a nombre de uno de mis auxiliares, para repartirle trabajo sin que él tenga que capturarlo.

## Criterios de aceptación

### Backend
1. `POST /casos/para-mi-auxiliar` con `{ auxiliar_id, cliente, prioridad, … }` (mismo cuerpo y validación que `POST /casos`, `validarNuevoCaso`). Ruta en `caseRoutes.js`, controlador `crearCasoParaAuxiliar` en `CaseController.js`.
2. Solo el rol contador (otro rol → 403). El auxiliar debe estar asignado a ese contador (`contador_auxiliar`): si no, 403 con `buildError` («No es tu auxiliar»). Id inválido o cuenta que no es auxiliar → 404.
3. El caso nace con `contador_id` = auxiliar y estado Pendiente. **Sí acepta `importante: true`** (el contador es quien marca los casos de su auxiliar).
4. El caso y el aviso se guardan en una transacción. Aviso al auxiliar: «{contador} te asignó el caso «{cliente}».» con `caso_id`. SSE: `aviso-nuevo` al auxiliar y `caso-actualizado` a los administradores, como `crearCasoComoAuxiliar`.
5. Respuesta 201 `{ mensaje: 'Caso asignado correctamente', caso }` con fechas locales.
6. La ruta nueva se agrega a la tabla de `test/autorizacionMatriz.test.js` y, si aplica, a `test/inyeccionSql.test.js`.

### Frontend
7. **«Mis casos»:** la contadora con al menos un auxiliar ve, junto a «Registrar caso», el selector «Registrar caso para» con sus auxiliares (mismo control que ya usa el auxiliar, tooltip «Registra el caso a nombre de este auxiliar y le avisa»). El auxiliar sigue viendo el suyo como hoy.
8. **«Mi equipo»:** en la fila de cada auxiliar, botón «Registrar caso» (icono `add_circle`, tooltip) que abre el mismo formulario con ese auxiliar como destino.
9. `CaseFormDialog.vue` gana un modo «para mi auxiliar» (prop nueva, p. ej. `auxiliarDestino: { id, nombre }`): título «Registrar caso para {auxiliar}», ayuda que diga que el caso queda a su nombre y él recibe un aviso, interruptor «Importante» visible, botón «Asignar caso al auxiliar». Los demás modos no cambian.
10. Al guardar, el caso aparece en «Mis casos» de la contadora (ya trae los de sus auxiliares) y en «Mi equipo» sin recargar la página.
11. Servicio en `services/auxiliarService.js` o `caseService.js` (donde viva `crearCasoComoAuxiliar`) y acción en el store correspondiente.

## Archivos autorizados

- Backend: `src/routes/caseRoutes.js`, `src/controllers/CaseController.js`, `src/models/AuxiliarModel.js` (solo si hace falta una consulta), pruebas nuevas en `test/` (agregarlas a `MINIMOS` de `soporte-pruebas/verificarPruebas.js`), `test/autorizacionMatriz.test.js`, `test/inyeccionSql.test.js`.
- Frontend: `src/components/CaseFormDialog.vue`, `src/pages/MyCasesPage.vue`, `src/components/MiEquipo.vue`, `src/services/auxiliarService.js`, `src/stores/auxiliares.js` (o `cases.js`), pruebas en `test/`.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-20): caso nuevo y también pasar casos existentes (este segundo va en la rebanada 38); desde «Mis casos» y desde «Mi equipo»; el contador puede marcar «Importante» al registrarlo.
- Un auxiliar apoya a un solo contador; validar con `AuxiliarModel.listarAuxiliares(req.user.id)` como hace `crearCasoComoAuxiliar` al revés.
- Contrato de fechas y vencimiento obligatorio: los mismos que el registro normal.
- No entra: pasar casos existentes (38), cambios en el dashboard del administrador.
- Puertas: backend por archivo y en serie + `verificarPruebas.js`; frontend `lint:check`, `prettier --check` de los archivos tocados, `build`, `node --test`. 0 filas `zz_test_%` de las que crees (no borrar cuentas `zz_test_` ajenas).

---

## Reporte del implementer

1. Rebanada completada: sí, sin navegador (lo prueba el orquestador).
2. Archivos modificados:
   - Backend: `caseRoutes.js` (ruta con `requireContador`), `CaseController.js` (`crearCasoParaMiAuxiliar`), `autorizacionMatriz.test.js`, `inyeccionSql.test.js`, `verificarPruebas.js` (`MINIMOS`) y la prueba nueva `test/contadorRegistraCasoParaAuxiliar.test.js` (6).
   - Frontend: `auxiliarService.js` y `stores/auxiliares.js`, `CaseFormDialog.vue` (prop `auxiliarDestino`), `MyCasesPage.vue` (selector nuevo), `MiEquipo.vue` (botón y su propio `CaseFormDialog`) y la prueba nueva `test/contadorRegistraCasoParaAuxiliar.test.js` (7).
3. Prueba en rojo y por qué falló: en el backend, la ruta no existía (404). En el frontend faltaban la función del servicio y del store y el modo y los controles nuevos.
4. Puertas (verde / rojo / no aplica): backend por archivo en verde y `verificarPruebas.js` OK (850). Frontend: `node --test` 1765/1765, `build` y eslint en verde. `prettier --check` en rojo en archivos que ya fallaban antes; solo se formatearon las líneas nuevas. 0 filas `zz_test_%`.
5. Decisiones no cubiertas:
   - Se revisa primero el 404 (id inválido o cuenta que no es auxiliar) y después el 403 «No es tu auxiliar».
   - El selector de la contadora es distinto del del auxiliar, es `clearable` y se limpia al registrar.
   - «Mi equipo» tiene su propio formulario y relee la lista con `cases.refrescarEnSilencio()`, porque `ContadorDashboardPage.vue` no estaba autorizado.
6. Para la memoria: algunas pruebas del frontend leen las plantillas con regex y son sensibles al orden de los atributos.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (`reviewer`)

- Puertas: backend por archivo en verde y `verificarPruebas.js` OK (850). Frontend: `lint:check` y `build` en verde, `node --test` 1765/1765.
- Permisos: `requireContador` en la ruta, 404 antes que 403 y las rutas anteriores siguen bloqueando al auxiliar. Si se quita el cambio, las pruebas fallan.
- Opcionales sin aplicar: `MINIMOS` fuera de orden alfabético; `findById` solo para el nombre (mismo patrón que `crearCasoComoAuxiliar`).

## Comprobación en navegador (orquestador, 2026-11-20)

- «Mis casos»: la contadora ve «Registrar caso para» con sus 2 auxiliares. Se registró un caso Importante para un auxiliar: aparece en la lista con «de {auxiliar}» y la estrella, sin recargar.
- «Mi equipo»: el botón «Registrar caso» de cada auxiliar abre el formulario con el título «Registrar caso para {auxiliar}». Al guardar, las cifras del equipo se actualizan.
- Aviso al auxiliar comprobado en la base: «{contador} te asignó el caso «…».» con `caso_id`.
- 375 px: sin scroll horizontal.
- **Corrección del orquestador:** el pie del formulario mostraba «Contador asignado: {contadora}» en el modo para auxiliar. Se oculta como en el modo del auxiliar (`!modoAuxiliar && !modoParaMiAuxiliar`). Hay prueba nueva y se ajustó el regex de `revisionUiConjunto2.test.js:19` (cambio de una línea, misma intención). Frontend 1766/1766.
- Trampa: los avisos de la prueba manual desaparecieron mientras el reviewer corría el backend, porque `limpiarDatosDePrueba` borra todo aviso que mencione `zz_test_`. No probar en navegador mientras corren las pruebas del backend.
