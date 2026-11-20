# MEMORY.md — DelGrow Estado Contadores

Memoria entre sesiones (máx. ~50 líneas). Las reglas fijas están en `AGENTS.md`; el detalle, en los commits y en `docs/rebanadas/`.

## Estado actual (2026-11-20)

- `main` = `experimento`, ambas en `origin`, hasta la rebanada 40 (c713bc1).
- Docker corre `main` 7e584f7 (despliegue 2026-11-18): tiene «Mis actividades» restringido (`USUARIOS_CON_ACTIVIDADES=7917`); le faltan el calendario y las rebanadas 20 a 40 (21 commits).
- Antes del próximo despliegue: respaldo; el seed crea las tablas nuevas; confirmar que el 7947 es administrador en la base de Docker; validar la regla fiscal con los contadores; revisar auxiliares con varios contadores (`SELECT auxiliar_id, COUNT(*) FROM contador_auxiliar GROUP BY auxiliar_id HAVING COUNT(*) > 1`). Última etiqueta de imagen: `antes-editar-usuarios-2026-11-17`; respaldo previo e imágenes `:anterior` del 2026-11-18.
- Pendiente de producción: restablecer desde la app las contraseñas de las cuentas reales (≥12), activar el hook (`git config core.hooksPath .githooks`) y corregir las auditorías migradas con «Periodo por confirmar».
- Las 12 cuentas `zz_test_` del 2026-11-10 no se tocan.

## Funcionalidades recientes

- «Mis actividades» (10–17): pestaña de «Mi trabajo»; clientes y tipos propios; vencimiento en `utils/vencimientoActividad.js` (festivos LFT); cronómetro con la hora del servidor y `FOR UPDATE`.
- Calendario del administrador (18–19): franja «Requiere atención», `?dia=`/`?rango=`, `GET /contadores/casos-importantes` y `GET /auditorias/calendario`.
- Editar cuentas: `PATCH /usuarios/:id` (`NewUserDialog.vue`, prop `cuenta`); nunca cambia la contraseña; si cambia el rol, revoca las sesiones. Sin cubrir: auditorías de un contador que cambia de rol.
- «Mi Calendario» (20–36): juntas, invitaciones, privadas, agenda de otros, vista Año, vencimientos en el calendario, recepcionista como secretaria y «Agendar junta» desde el directorio (`utils/juntas.js`).
- Contador reparte casos a su equipo (37–38), hoy pintado en Semana y Día (39) y notificaciones del navegador (40, `utils/notificacionesNavegador.js`; probado en Chrome, en Opera GX no llegó).

## Pendientes / para decidir

- Avisos por correo (24): esperan nodemailer y una cuenta SMTP del despacho.
- Web Push con la app cerrada: requiere aprobación (`web-push`, VAPID, tabla de suscripciones).
- «Mis actividades»: los «para decidir» de `17-revision-ui-actividades.md` y la regla fiscal.
- Opcionales sin aplicar en cada `docs/rebanadas/NN-*.md` (en especial 29 a 33); probar en navegador la agenda de la recepcionista con los bloques nuevos.
- Revisión UI 2: el resumen del admin parpadea; `?chat=1` no se quita; «Registrar caso para» no se puede vaciar; auditorías y «Mi perfil» sin tiempo real; falta `hayDatosSinGuardar` en «Agregar auxiliares» y «Contador que apoya»; tooltips de chips sin teclado; carga en la campana.
- «Mi perfil»: revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor.
- Formatear `MaquetaLayout.vue`, `router/index.js` y `CountersDirectoryPage.vue` (ya fallaban `prettier --check`).
- Requieren aprobación (estructura): índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías (Importancia, RFC/Unidad/Socio/Multa).
- Dudoso sin cambiar: `usuarios_de_sistema` puede crear/promover administradores y restablecer su contraseña; `GET /eventos` no revisa la sesión al canjear el pase.
- Preguntas abiertas: nombre de la PWA, logo más liviano, qué hacer con `.playwright-mcp/`, si la recepcionista ve el «Último acceso».

---
Nada sensible en esta memoria.
