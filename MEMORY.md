# MEMORY.md — DelGrow Estado Contadores

Memoria entre sesiones (máx. ~50 líneas). Las reglas fijas están en `AGENTS.md`; el detalle, en los commits y en `docs/rebanadas/`.

## Estado actual (2026-11-23)

- `main` = `experimento` en `origin` (2026-11-23): rebanada 41 + rediseño visual mezclado a `main`:
  - Fondo general: degradado radial azul («bg 2», `degradado-1`/`degradado-2` en la paleta; en la esquina `texto-tenue` baja a 3.7:1).
  - Menú: dock flotante en escritorio (`MenuDock.vue`, «menu 2»; con el aspecto del dock del otro proyecto: panel con borde celeste `dock-borde`, azulejos con degradado `dock-azulejo`→`primary`, logo en azulejo, activa rellena de celeste; `test/menuDock.test.js`); en celular el menú lateral con píldoras, relleno celeste y punto activo («menu 1»; cambió la prueba que prohibía hover propio).
  - Pendiente: actualizar en `AGENTS.md` las reglas del menú (altura completa con nombre de empresa y app; ítems sin tooltip), que el dock ya no cumple. Las opciones del menú están duplicadas (plantilla del menú lateral y `opcionesDock`).
  - Descartados: degradado naranja (contraste), fondo WebGL animado (consumo y distracción) y efectos de luz de Magic Bento en las cifras.
- `main` = `experimento` = 9b082e2 en `origin` (2026-11-23), que incluye: número tipo odómetro (`ContadorRodante.vue`, idea del Counter de Vue Bits) en cifras de dashboards y cronómetro, y rebanada 42 («Tu próxima junta» con cuenta regresiva + línea de la hora actual en «Mi Calendario»). Copiar una cifra del odómetro copia los dígitos ocultos: por decidir.
- «aparecer 1» a «aparecer 4»: entrada animada `vAparecer` (`utils/aparecer.js`, idea de Animated Content, sin GSAP). Login: tarjeta con desenfoque 12 px y cortina. Dashboards: bloques escalonados (0.5 s); en «Mi resumen» y en las pestañas «Casos | Auditorías» del administrador cada pestaña entra por bloques cada vez que se abre (`reproducirAparicion` al cambiar de pestaña, porque las pestañas son `keep-alive`; ignora la pestaña que sale durante el fundido); igual las sub-pestañas del tablero (`TableroAuditorias.vue`, también en la pestaña «Auditorías» del administrador). Resto de páginas: entran completas desde el `router-view` de `MaquetaLayout.vue` (`RUTAS_CON_ENTRADA_PROPIA` excluye los dashboards). Mientras entra la página, los elementos `fixed` (botón del chat en la ficha, celular) no se ven.
- En `main` (dcd5043, `experimento` igual): «Tu sesión se cerró» (`AvisoSesionCaducada.vue`) con el estilo de la tarjeta del login (`q-card` 16 px, sombra, ícono `lock_clock` en ámbar, botón a lo ancho y entrada con cortina); con la sesión cerrada `MaquetaLayout.vue` ya no muestra el menú lateral anterior ni el botón de menú del celular.
- Rebanada 43 aprobada sin commit (2026-11-24): juntas con `cliente` (texto, sin `cliente_id`, para conservar el nombre de ese día), `modalidad` (presencial/virtual) y `lugar`, opcionales y con la privacidad de la descripción. «Elegir de mis clientes» solo para contador/auxiliar con «Mis actividades»; los demás escriben a mano. El seed agrega las columnas.
- «Tu próxima junta» en escritorio (≥600 px): tarjeta ajustada al contenido (360–520 px, a la izquierda) y en una sola fila (`flex-wrap: nowrap`; el título se recorta con «…»); en celular sigue a todo el ancho. 6b7f5b7 en origin; la fila única, sin commit.
- Docker corre `main` 7e584f7 (despliegue 2026-11-18): tiene «Mis actividades» restringido (`USUARIOS_CON_ACTIVIDADES=7917`); le faltan el calendario y las rebanadas 20 a 40 (21 commits).
- Antes del próximo despliegue: respaldo; el seed crea las tablas nuevas; confirmar que el 7947 es administrador en la base de Docker; validar la regla fiscal con los contadores; revisar auxiliares con varios contadores (`SELECT auxiliar_id, COUNT(*) FROM contador_auxiliar GROUP BY auxiliar_id HAVING COUNT(*) > 1`). Última etiqueta de imagen: `antes-editar-usuarios-2026-11-17`; respaldo previo e imágenes `:anterior` del 2026-11-18.
- Pendiente de producción: restablecer desde la app las contraseñas de las cuentas reales (≥12), activar el hook (`git config core.hooksPath .githooks`) y corregir las auditorías migradas con «Periodo por confirmar».
- Las 12 cuentas `zz_test_` del 2026-11-10 no se tocan (el 2026-11-23 ya no había ninguna `zz_test_` en la base de XAMPP).

## Funcionalidades recientes

- «Mis actividades» (10–17): pestaña de «Mi trabajo»; clientes y tipos propios; vencimiento en `utils/vencimientoActividad.js` (festivos LFT); cronómetro con la hora del servidor y `FOR UPDATE`.
- Calendario del administrador (18–19): franja «Requiere atención», `?dia=`/`?rango=`, `GET /contadores/casos-importantes` y `GET /auditorias/calendario`.
- Editar cuentas: `PATCH /usuarios/:id` (`NewUserDialog.vue`, prop `cuenta`); nunca cambia la contraseña; si cambia el rol, revoca las sesiones. Sin cubrir: auditorías de un contador que cambia de rol.
- «Mi Calendario» (20–36): juntas, invitaciones, privadas, agenda de otros, vista Año, vencimientos en el calendario, recepcionista como secretaria y «Agendar junta» desde el directorio (`utils/juntas.js`).
- Contador reparte casos a su equipo (37–38), hoy pintado en Semana y Día (39) y notificaciones del navegador (40, `utils/notificacionesNavegador.js`; probado en Chrome, en Opera GX no llegó).
- Revisión UI 2 cerrada (41): recargas en silencio sin loader, `?chat=1` se quita, «¿Descartar los cambios?» en los diálogos de auxiliares, chips con tooltip por teclado.

## Pendientes / para decidir

- Avisos por correo (24): esperan nodemailer y una cuenta SMTP del despacho.
- Web Push con la app cerrada: requiere aprobación (`web-push`, VAPID, tabla de suscripciones).
- «Mis actividades»: los «para decidir» de `17-revision-ui-actividades.md` y la regla fiscal.
- Opcionales sin aplicar en cada `docs/rebanadas/NN-*.md` (en especial 29 a 33); probar en navegador la agenda de la recepcionista con los bloques nuevos.
- «Mi perfil»: revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor.
- Opcional de la 41: tras un fallo inicial, las recargas en silencio no sacan del error a la cartera (`cases.refrescarEnSilencio` no limpia `error`), a la lista de auditorías ni a la cuenta de «Mi perfil».
- `prettier --check` falla en ~180 archivos del frontend (formato, no solo CRLF): decidir si se formatea todo en un commit aparte.
- Requieren aprobación (estructura): índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías (Importancia, RFC/Unidad/Socio/Multa).
- Dudoso sin cambiar: `usuarios_de_sistema` puede crear/promover administradores y restablecer su contraseña; `GET /eventos` no revisa la sesión al canjear el pase.
- Preguntas abiertas: nombre de la PWA, logo más liviano, qué hacer con `.playwright-mcp/`, si la recepcionista ve el «Último acceso».

---
Nada sensible en esta memoria.
