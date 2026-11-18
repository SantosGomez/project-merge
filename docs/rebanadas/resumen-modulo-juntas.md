# Resumen del módulo «Juntas» (calendario)

Implementado el 2026-11-18. Cada rebanada tiene su propio commit en `main`. Las rebanadas 20 y 21a ya están en `origin`; la 21b, la 22, la 23 y la 25 están **sin push**, pendientes de tu revisión.

| Rebanada | Commit | Qué hace | Revisión |
|---|---|---|---|
| 20 — Rol «Recepcionista» | `e401872` (subido) | Rol nuevo; consulta el directorio y nada más. | Opus: aprobada |
| 21a — Juntas en el backend | `6aedcce` (subido) | Tablas `juntas` y `junta_participantes`; API `/juntas`. | Opus: 1 cambio (textos), aprobada en la vuelta 2 |
| 21b — Pantalla «Juntas» | `a9b4968` | Calendario de mes, semana y día (QCalendar 5.4.0), alta, edición y ficha. | Sonnet: aprobada |
| 22 — Responder invitaciones | `3460fa8` | Aceptar o rechazar, estado de la junta y avisos en la campana. | Opus: 1 cambio (privacidad de avisos), aprobada en la vuelta 2 |
| 23 — Privadas y agenda de otros | `97e317b` | «Junta privada» y «Ver agenda de» con «Ocupado». | Opus: 1 cambio (tooltips), aprobada en la vuelta 2 |
| 24 — Avisos por correo | — | **Pendiente**, por decisión tuya: hacen falta `nodemailer` y una cuenta SMTP del despacho. | — |
| 25 — Vista Año y vencimientos | (este commit) | Vista Año y vencimientos de casos en el calendario. | Sonnet: aprobada |

## Cómo funciona hoy

- **Quién entra:** administrador, contador, auxiliar y recepcionista; para la recepcionista es su pantalla principal. El usuario de sistema no tiene acceso.
- **Vistas:**
  - Año, Mes, Semana y Día.
  - Semana y Día van de 8:00 a 19:00; Semana solo de lunes a viernes.
  - En celular abre en Día y en computadora, en Semana.
- **Crear y editar:**
  - Cualquiera de los 4 roles crea juntas e invita a otros de esos roles (de 1 a 50 personas).
  - Solo el organizador edita o borra.
  - Si se cambia la fecha o la hora, los invitados tienen que volver a confirmar.
- **Respuestas y estado:**
  - Cada invitado acepta o rechaza.
  - Si hay administradores invitados, la junta queda «Por confirmar» hasta que respondan.
  - Si alguno rechaza, la junta queda «Cancelada»; si todos aceptan, «Confirmada».
- **Avisos en la campana:**
  - Llegan por invitación, cambio de horario, respuesta, confirmación o cancelación, y borrado.
  - Al tocar el aviso se abre la ficha de la junta.
  - Quien deja de estar invitado ya no recibe el enlace.
- **Privacidad:**
  - En «Ver agenda de», quien no está invitado ve solo el título, el horario y el organizador.
  - Si la junta es privada, solo ve «Ocupado».
  - Nunca ve la descripción ni la lista de invitados.
  - Desde la agenda de otra persona se puede agendar una junta con ella ya invitada.
- **Vencimientos de casos (Mes, Semana y Día):**
  - El contador y el auxiliar ven los de sus casos.
  - El administrador ve los de los casos importantes.
  - La recepcionista no ve vencimientos.
  - Se pueden ocultar con un interruptor.

## Decisiones que tomé y que conviene confirmar

1. Cualquiera de los 4 roles puede ver la agenda de cualquiera de los otros.
2. Con varios administradores invitados, basta que uno rechace para cancelar la junta.
3. No se avisa cuando una junta pasa de «Cancelada» a «Por confirmar».
4. La vista Semana no muestra el fin de semana, así que tampoco sus vencimientos (sí salen en Mes y Día).
5. El administrador ve los vencimientos sin el nombre del contador.
6. La recepcionista ve en el directorio el «Último acceso» de cada cuenta.

## Antes de publicar

- **Revisar el lock de npm:** con el servidor de desarrollo cerrado, correr `npm ci` en `Seguimiento-proyectos/`. QCalendar se copió a mano por un `EBUSY` y así se confirma que el lock reconstruye el mismo árbol.
- **Versión de Node:** QCalendar pide Node 22.13 o superior. La imagen `node:22` de Docker hoy la cumple.
- **Respaldo de la base:** el seed crea las tablas `juntas` y `junta_participantes` y las columnas `notificaciones.junta_id` y `juntas.privada`. Todos estos cambios son idempotentes.
- **Rama `experimento`:** quedó atrás de `main`.
- **Datos de prueba:** en la base de XAMPP solo quedan tus 2 juntas y ninguna cuenta `zz_test_`.

El detalle de cada rebanada (criterios, reportes y veredictos) está en `docs/rebanadas/20-*.md` a `25-*.md`.
