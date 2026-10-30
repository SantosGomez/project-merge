# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Sesión persistente + SSE: **publicado en Docker** (2026-10-28). Login con "Mantener sesión" (7 días), token 30d vs 2h, latido 25s, reconexión 5→60s. Campanita, dashboard y Mis casos en tiempo real.
- Túnel: servicio `tunnel` (cloudflared 2026.9.2, Quick Tunnel → `http://frontend:80`) en el compose (2026-10-29); ya no depende de la IP de la PC. La URL cambia en cada reinicio (`docker compose logs tunnel`). Para URL fija: túnel con token + dominio en Cloudflare.
- Contadores depurados (2026-10-29) según «Usuarios Sistemas.xlsx»: quedan 16 (se agregó César Hernández, Casa Amarilla; se borraron 15 sin casos) en la base y en `cuentas.local.json`. Respaldo previo en el Escritorio (`santos/respaldo-2026-10-29`). Todas las cuentas con `debe_cambiar_contrasena=1` salvo Santos (sistemas), Santos admin y José Alejandro Delgado.
- MySQL de XAMPP (pruebas locales) se dañó el 2026-10-29 al rearmar su carpeta `data` (ib_logfile desfasados → «doesn't exist in engine»). Se recreó `delgrow_contadores` desde respaldo + Docker. Si vuelve a fallar otra tabla: reinstalar limpia la carpeta `data` de XAMPP. No reparar borrando tablas sueltas: el índice de InnoDB las retiene hasta reiniciar MySQL.
- PWA para contadores: **publicado** (src-pwa, Workbox, standalone, íconos DelGrow).
- Vencimiento lo captura el contador (obligatorio, ≥ inicio); prioridad ya no lo recalcula.
- Calendario `q-date` en fechas del caso (máscara DD-MM-YYYY, bloquea días antes del inicio).

## Nuevo Módulo de Auditorías (próximos pasos)

- Nuevo modulo para registro de casos tipo auditoria (ya sea Revisión de gabinete, Visita, etc) el cual va a ser independiente del modulo de casos, este nuevo modulo va a tener sus propios campos, estados y fases, con un historial del seguimiento de la auditoria.
- Esquema (nombres del usuario): `auditorias` (sin Entidad/Actas/AlertaActas/Semaforo; + CreadoPor/CreadoEn/ActualizadoEn), `auditoria_dtl` = bitácora, `aud_conta` (UNIQUE + AsignadoEn), `fases_aud` (6 fases del boceto). Todas con FK. TipoAud libre (sin catálogo). Semáforo se calculará desde la bitácora. `seed.js › migrarAuditorias` crea todo y retira el esquema beta (vacía → DROP; con datos → `_respaldo_beta`); probado contra copia del esquema de Docker.
- Rebanada 1 hecha (2026-10-29, sin commit): API `GET/POST/PATCH /auditorias` (admin ve/edita todas y elige contadores; contador registra y queda asignado, ve/edita solo las suyas, no reasigna). `auditoriaService.js` (fechas DD-MM ↔ AAAA-MM-DD). Página conectada; el detalle aún no muestra bitácora (rebanada 2). Pruebas: `auditoriaRoutes.test.js` (18) y `auditoriaService.test.js` (4).
- Rebanada 2 hecha (2026-10-30, sin commit): bitácora = `GET/POST /auditorias/:id/eventos`, `PATCH/DELETE …/eventos/:eventoId`, `GET /auditorias/fases` (admin o contador asignado). Fecha límite la captura el contador (≥ fecha del evento); `Contador_id` = quien registró. Eventos se editan y se borran (con confirmación). `AuditoriaDetalleDialog` muestra la bitácora real. Pruebas: `auditoriaEventos.test.js` (10); el servicio de eventos no tiene pruebas (decisión del usuario).
- Siguiente: rebanada 3 = fase actual, próximo vencimiento y semáforo calculados desde la bitácora. Los 5 fallos de layout del frontend ya existían en HEAD; `authRoutes` «correo en mayúsculas» falla a veces por carrera entre archivos de prueba (no es de auditorías).
- Error a evitar: `git --work-tree=<otra carpeta> checkout` contamina el índice (stat CRLF) → 200 archivos «M» falsos; se arregla con `rm .git/index && git reset`.

## Backend (lo esencial)

- Errores `buildError` (3 partes ES), `asyncHandler`, handler global, `jti` por token.
- `parseCounterId` solo dígitos; se usa también para ids de caso.
- MariaDB/mysql2 (pool), seed idempendente, sin modo estricto (validaciones en controlador).
- `node --test` en paralelo: datos `zz_test_*`, cerrar servidor/pool en `after`.
- Cuentas demo solo con `SEED_CUENTAS_DEMO=true`.

## Decisiones (y por qué)

- Contrato de fechas y edición de casos: ver `AGENTS.md` (trampas conocidas).
- Rate limit login apagable (`crearApp({ limitarLogin: false })`); logins OK no cuentan.
- Sin `JWT_SECRET` por defecto en producción (el servidor no arranca).
- Textos y comentarios en español.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&`/`||`; usar `npm.cmd`.
- `verificarPruebas.js` tiene `MINIMOS` por archivo: actualizar al añadir tests.
- `npm run lint:check` llama a prettier sin `--check` (preexistente).
- No dar por terminada una rebanada por lo que diga otro agente: comprobar en BD real.
- Tests backend usan BD local real: corren `seedDatabase` y migraciones sobre datos de verdad.
- Una prueba que pasa sin el cambio no prueba nada: fijar fecha exacta esperada.
- Mantener servidores hasta el final de la verificación (MCP navegador se pierde).
- En Git Bash `API_URL=/api` → ruta Windows (`MSYS_NO_PATHCONV=1`); en Docker no.
- Probar sin backend: sesión simulada en `sessionStorage` (token falso `exp` futuro).
- Verificar afirmaciones de otros agentes; no fiarse de "falla preexistente".

## Directorio de usuarios: pulido (2026-10-29, sin commit)

- Hecho: tooltip «directorio de usuarios» en `AdminDashboardPage.vue`; contraseña en memoria se limpia al cerrar `NewUserDialog`/`ResetPasswordDialog`; `.form-group`, `.form-label`, `.required-mark`, `.form-help` y `.error-banner` pasaron a `src/css/app.scss` (sin `sass` instalado no se puede usar un partial; `CaseFormDialog` conserva copia porque `t9Pages.test.js` exige `.form-group` en su `<style>`).
- Hecho: `MENSAJES_VALIDACION` en `constants.js` reemplaza los `MENSAJES` locales de los dos diálogos (el aviso del campo ya dice «Contraseña nueva», así que el texto es el neutro). `CambiarContrasenaPage` mantiene su copia más cercana, a propósito. `directorioUsuarios.test.js` verifica que los 8 códigos tengan texto.
- Hecho: `RUTA_PRINCIPAL_POR_ROL` (paths) en `constants.js` es la única tabla; `session.js` la exporta como `PANTALLA_PRINCIPAL` y `accessRules.js` deriva `PANTALLA_PRINCIPAL_POR_ROL` (nombres) con la convención `/a/b` → `a-b`, que una prueba contrasta contra `router/index.js`.
- La recarga con loader tras el alta no requiere cambio: `cargar()` pone `cargando` de forma síncrona.
- Las pruebas estáticas de los diálogos ya existían en `test/directorioUsuarios.test.js`.

---
Nada sensible en esta memoria.