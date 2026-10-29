# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas.

## Estado actual

- Sesión persistente + SSE: **publicado en Docker** (2026-10-28). Login con "Mantener sesión" (7 días), token 30d vs 2h, latido 25s, reconexión 5→60s. Campanita, dashboard y Mis casos en tiempo real.
- Túnel: servicio `tunnel` (cloudflared 2026.9.2, Quick Tunnel → `http://frontend:80`) en el compose (2026-10-29); ya no depende de la IP de la PC. La URL cambia en cada reinicio (`docker compose logs tunnel`). Para URL fija: túnel con token + dominio en Cloudflare.
- PWA para contadores: **publicado** (src-pwa, Workbox, standalone, íconos DelGrow).
- Vencimiento lo captura el contador (obligatorio, ≥ inicio); prioridad ya no lo recalcula.
- Calendario `q-date` en fechas del caso (máscara DD-MM-YYYY, bloquea días antes del inicio).

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