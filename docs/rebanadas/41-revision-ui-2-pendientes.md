# 41 — Pendientes de la revisión de UI 2

- **Riesgo:** bajo (ajustes de interfaz y recargas en silencio; solo frontend)
- **Implementa:** Claude (orquestador, TDD)
- **Revisa:** Claude (`reviewer-ligero`)
- **Estado:** en curso

## Historia

Como usuario, quiero que las pantallas no parpadeen, no pierdan lo que escribí por accidente y se mantengan al día solas, para confiar en lo que veo.

## Criterios de aceptación

1. **Resumen del administrador sin parpadeo** (`AdminDashboardPage.vue`): la carga inicial muestra el loader; las recargas por `caso-actualizado`, `reconectado` o al volver a la ventana son en silencio (no ponen `cargandoResumen`) y, si fallan, conservan las cifras sin mostrar error.
2. **`?chat=1` se quita** (`AuditoriaFichaPage.vue`): al abrir el chat desde «Ver mensajes», la ficha quita el parámetro con `router.replace`; recargar no vuelve a abrir el chat y un segundo «Ver mensajes» sí lo abre.
3. **«Registrar caso para» se puede vaciar** (`MyCasesPage.vue`): el selector del auxiliar lleva `clearable`, como el del contador.
4. **Carga en la campana** (`CampanaAvisos.vue`): antes de la primera respuesta muestra «Cargando avisos…» con spinner, no «No tienes avisos.».
5. **Tiempo real:** la lista de auditorías (`AuditoriasPage.vue`) relee en silencio con `auditoria-actualizada` y `reconectado`. «Mi perfil» (`ContadorAuxiliaresPage.vue`) relee en silencio (perfil, casos, auxiliares o contador que apoya) al volver a la ventana, con `aviso-nuevo` y con `reconectado`; un fallo conserva lo que se ve. El store de auxiliares gana `refrescarAuxiliaresEnSilencio` (sin `cargando`, sin pisar el error ni los datos al fallar).
6. **¿Descartar los cambios?** en «Agregar auxiliares» (hay marcados) y «Contador que apoya» (el elegido difiere del cargado): `hayDatosSinGuardar` + `:persistent` + `@shake` + «Cancelar» pregunta, con `focus: 'cancel'`.
7. **Tooltips de chips con teclado:** los `q-chip` con tooltip (estado de la ficha de auditoría, «Importante» de «Mi perfil») llevan `tabindex="0"`.

## Archivos autorizados

- `Seguimiento-proyectos/src/pages/AdminDashboardPage.vue`, `AuditoriaFichaPage.vue`, `MyCasesPage.vue`, `AuditoriasPage.vue`, `ContadorAuxiliaresPage.vue`
- `Seguimiento-proyectos/src/components/CampanaAvisos.vue`, `AgregarAuxiliaresDialog.vue`, `ContadoresDeAuxiliarDialog.vue`
- `Seguimiento-proyectos/src/stores/auxiliares.js`
- Pruebas: `test/revisionUiConjunto2.test.js` y `test/revisionAuxiliares.test.js`

Sin dependencias nuevas ni cambios en el backend.

## Notas del orquestador

- Los siete puntos salen de la lista «Revisión UI 2» de `MEMORY.md`; el usuario pidió continuar con lo pendiente (2026-11-23).
- Ajustes durante la implementación:
  - El resumen también parpadeaba tras guardar una prioridad y tras asignar un caso: esas dos recargas también van en silencio (solo la carga inicial muestra el loader).
  - `refrescarAuxiliaresEnSilencio` no hace nada si hay una carga completa en curso; si no, la descartaba y `cargando` quedaba en `true` (prueba propia).
  - Criterio 7: `QChip` no clicable ignora `tabindex`. El texto y el tooltip van en un `<span tabindex="0" class="chip-con-ayuda">` dentro del chip; el anillo de foco está en `app.scss` (archivo agregado a la lista).
  - Se ajustaron dos pruebas viejas (`revisionDashboardAdmin`, `tiempoReal`) que fijaban `cargarResumen()`: misma intención, ahora `cargarResumen({ silencioso: true })`.

## Reporte

- Frontend: `node --test` 1827/1827, eslint limpio, build OK. `prettier --check` ya fallaba en ~180 archivos antes de esta rebanada; `CampanaAvisos.vue`, el único de la lista que pasaba, sigue pasando.
- Navegador (3011 + 9012, cuentas `zz_test_` borradas al terminar): el resumen se relee sin mostrar el loader; `?chat=1` abre el chat y desaparece, al recargar no se reabre; Tab enfoca el chip de estado y sale su tooltip; «Mi perfil» quita a un auxiliar desvinculado al volver a la ventana sin esqueleto; «Agregar auxiliares» con uno marcado pregunta «¿Descartar los cambios?»; «Registrar caso para» del auxiliar se vacía con la «x»; campana y vista móvil correctas.
- Revisión ligera: cambios necesarios, ya aplicados. (1) Una recarga en silencio correcta de los auxiliares ahora quita el error de una carga inicial fallida (prueba nueva). (2) El resumen del administrador lleva un número de petición: solo la respuesta más reciente cuenta y apaga el loader, y si no hay cifras que conservar, el fallo silencioso sí se muestra. Se ajustó `t9Pages.test.js:562` (misma intención). Frontend 1828/1828.
- Opcional sin aplicar: `cases.refrescarEnSilencio` (`stores/cases.js`, fuera de la lista) tampoco quita `cases.error`; tras un fallo inicial, la cartera de «Mi perfil» sigue en error hasta «Reintentar». Lo mismo pasa con la lista de auditorías y la cuenta de «Mi perfil» (se saltan la recarga si hubo error).
- Sin probar en navegador: el número de petición del resumen (posterior a la prueba en navegador), el texto «Cargando avisos…» (dura lo que tarda la primera respuesta) y la lista de auditorías con `auditoria-actualizada` (mismo patrón que `TableroAuditorias.vue`).
