# MEMORY.md — Seguimiento de Proyectos (unión con Recepción de documentos)

Memoria entre sesiones (máx. ~50 líneas). Las reglas fijas están en `AGENTS.md`; el plan y las decisiones de la unión, en `PLAN.md`; el detalle, en los commits y en `docs/rebanadas/`.

## Estado de la unión (2026-11-24)

- Repo `SantosGomez/project-merge`, rama `unificacion/fase-0`. Fases 0 a 4 hechas; falta la 5: probar con copia de datos reales por rol y módulo, y publicar en Docker. `main` = status-conta sin la unión.
- Un login (correo o `alias`), rol general + rol por módulo (`usuario_modulos`), selector `/modulos`. Backend de documentos en `/doc`, frontend en `src/modulos/documentos/`.
- Base de prueba: `delgrow_merge` en XAMPP (3306), copiada el 2026-11-24 del contenedor `merge-prueba-db` (ya borrado) para trabajar sin Docker; con MariaDB 10.4 pasa todo salvo `usuarios_respaldo_5c` (de siempre). Respaldos fuera del proyecto: `~/respaldos-seguimiento-proyectos/union-documentos-2026-11-24/`.
- Últimas cifras: backend 1171 de 1172 en XAMPP (falla solo `usuarios_respaldo_5c`, cosa de la base de prueba); frontend 2097 de 2097.
- 2026-11-24: `AGENTS.md` y esta memoria se reescribieron para el proyecto unido (antes eran los de status-conta).

## Pendientes de la unión

- Documentos: el aviso «Acceso denegado» habla del rol general («tu perfil es auxiliar»), debería usar el rol en el módulo; probar en navegador las firmas dibujadas en el lienzo.
- Límite de intentos del login cuenta por separado correo y alias de una misma persona (menor).
- Por decidir: ¿`casos` se liga a `clientes.id` o sigue con el cliente como texto? Llave `clientes → usuarios` en cascada: pasar a `SET NULL`.
- `.claude/launch.json` depende de un script en una carpeta temporal: rehacerlo con rutas del proyecto.
- `PRODUCT.md` y `docs/constitution.md` describen solo status-conta.

## Producción (Docker de status-conta)

- Corre `main` 7e584f7 (despliegue 2026-11-18), con «Mis actividades» restringido (`USUARIOS_CON_ACTIVIDADES=7917`); le faltan el calendario, las rebanadas 20 a 42 y toda la unión.
- Antes de publicar: respaldo de `db_datos` y del volumen `adjuntos`, etiquetar imágenes; confirmar que el 7947 es administrador; revisar auxiliares con varios contadores (`SELECT auxiliar_id, COUNT(*) FROM contador_auxiliar GROUP BY auxiliar_id HAVING COUNT(*) > 1`); validar la regla fiscal con los contadores.
- Pendiente en producción: restablecer desde la app las contraseñas de las cuentas reales (≥12) y corregir las auditorías migradas con «Periodo por confirmar».

## Pendientes de seguimiento (status-conta)

- Avisos por correo (24): esperan nodemailer y una cuenta SMTP. Web Push con la app cerrada: requiere aprobación (`web-push`, VAPID, tabla).
- «Mis actividades»: los «para decidir» de `17-revision-ui-actividades.md` y la regla fiscal.
- Opcionales sin aplicar en `docs/rebanadas/NN-*.md` (en especial 29 a 33); tras un fallo inicial, las recargas en silencio no limpian el error (`cases.refrescarEnSilencio`, auditorías, «Mi perfil»).
- «Mi perfil»: revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor.
- Copiar una cifra del odómetro (`ContadorRodante.vue`) copia los dígitos ocultos: por decidir.
- `prettier --check` falla en ~180 archivos del frontend: decidir si se formatea todo en un commit aparte.
- Requieren aprobación (estructura): índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías.
- Dudoso: `usuarios_de_sistema` puede crear/promover administradores; `GET /eventos` no revisa la sesión al canjear el pase.

## Pendientes de documentos (traídos de Proyecto-documentos)

- En espera de definición: relación muchos a muchos contador-cliente; tabla real de «tipos de recepción» con plantilla por cliente (el autollenado es maqueta); matriz y pantalla de documentos requeridos por cliente.
- Deuda: el color por prioridad está duplicado en `IndexPage` y `DireccionamientoPage`.

## Errores a evitar

- Revisar las cifras, los diffs y la codificación del trabajo de otro agente (un `.vue` en Windows-1252 compila con el texto roto; cargar SQL con `--default-character-set=utf8mb4`).
- Un oráculo sobre la plantilla no prueba que el permiso exista: comprobar en el navegador con cada rol.
- Guardia de rutas: `useQuasar()` no funciona ahí; cada redirección lleva `return`; el permiso va en cada ruta hija.

---

Nada sensible en esta memoria.
