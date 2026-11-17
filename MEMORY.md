# MEMORY.md — DelGrow Estado Contadores

Memoria entre sesiones (máx. ~50 líneas). El detalle está en los commits y en `docs/rebanadas/`.

## Estado actual

- **Ramas (2026-11-17):** `main` = `experimento`, ambas en `origin`, con «Mis actividades» (rebanadas 10–17), el calendario del administrador (18–19) y la edición de cuentas.
- **Docker = `main` 8911a26 (edición de cuentas).** Faltan «Mis actividades» y el calendario. Antes de publicar: respaldo; el seed crea las tablas de actividades (en producción no existen); validar la regla fiscal con los contadores; revisar auxiliares con varios contadores (`SELECT auxiliar_id, COUNT(*) FROM contador_auxiliar GROUP BY auxiliar_id HAVING COUNT(*) > 1`).
- **Publicar:** respaldo dentro del contenedor (`mariadb-dump --single-transaction --routines --triggers --events > /tmp/...` + `docker compose cp`; la tubería de PowerShell daña acentos; los `.sql` nunca se versionan). Etiquetar las imágenes anteriores (última: `antes-editar-usuarios-2026-11-17`). `docker compose build` desde PowerShell (en Git Bash `API_URL=/api` se rompe). `up -d --no-deps backend frontend` para que el túnel conserve su URL.
- **Túnel cloudflared:** la URL cambia en cada reinicio (`docker compose logs tunnel`). Agregarla a `CORS_ORIGENES` y `up -d backend`; si no, el login da 403.
- **Bases:** producción en Docker 3307 (solo en una publicación pedida); pruebas en XAMPP 3306, compartida con el backend de desarrollo. Las 12 cuentas `zz_test_` del 2026-11-10 no se tocan.
- **Proceso:** rebanadas verticales con TDD (`docs/flujo-agentes.md`). `implementer` sonnet; `reviewer` opus en riesgo medio o alto, `reviewer-ligero` en bajo. Cada rebanada en `docs/rebanadas/NN-*.md` con su reporte y opcionales. Solo el orquestador edita MEMORY.md.

## Funcionalidades recientes

- **«Mis actividades» (10–17):** «Mi trabajo» con pestañas Mis casos | Mis actividades. Clientes y tipos propios de cada quien; la jornada solo la ve cada quien; informes sin tarifa. El vencimiento se calcula en `utils/vencimientoActividad.js` (festivos LFT). El cronómetro usa la hora del servidor y `FOR UPDATE`.
- **Calendario del administrador (18–19):** franja «Requiere atención» (solo casos importantes), dos columnas desde 1280 px, modo día o rango (`?dia=`/`?rango=`). Endpoints `GET /contadores/casos-importantes` y `GET /auditorias/calendario` (`GET /auditorias` no trae los eventos). «Vence pronto» va en amarillo (`dg-vence-pronto`).
- **Editar cuentas:** `PATCH /usuarios/:id` con `NewUserDialog.vue` (prop `cuenta`). Nunca cambia la contraseña; si cambia el rol, revoca las sesiones. Sin cubrir: auditorías de un contador que cambia de rol.
- **«Mi perfil»:** «Cambiar contraseña» está oculto (`CAMBIO_CONTRASENA_HABILITADO = false`); el backend sigue ahí.

## Pendientes / para decidir

- **«Mis actividades»:** los «para decidir» de `17-revision-ui-actividades.md` (`en_cartera` en `GET /actividades`, jornada plegada) y la regla fiscal. Los opcionales sin aplicar están en cada `docs/rebanadas/NN-*.md`.
- **Revisión UI 2, sin aplicar:** el resumen del admin parpadea; `?chat=1` no se quita; «Registrar caso para» no se puede vaciar; auditorías y «Mi perfil» sin tiempo real; falta `hayDatosSinGuardar` en «Agregar auxiliares» y «Contador que apoya»; tooltips de chips sin teclado; carga en la campana.
- **«Mi perfil», opcionales:** revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor. Proponer su regla para `AGENTS.md`.
- **Requieren aprobación (estructura):** índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías (Importancia, RFC/Unidad/Socio/Multa).
- **Producción:** corregir en la app las auditorías migradas con «Periodo por confirmar».
- **Preguntas abiertas:** nombre de la PWA, logo más liviano, qué hacer con `.playwright-mcp/` (sin versionar).

## Errores a evitar

- **Shell:** PowerShell no admite `&&`/`||`. En Git Bash, `MSYS_NO_PATHCONV=1`. Varios `.vue` usan CRLF y `sed` falla con varias líneas o con `\\`: usar Edit.
- **Pruebas:** nunca `DROP`/`ALTER` destructivo. Cada archivo de `Backend/test` va en `MINIMOS`. El backend se corre por archivo (todo junto se cuelga). `lint:check` no revisa formato: correr también `npx prettier --check`.
- **Datos de prueba:** borrar las `sesiones` antes que la cuenta. `limpiarDatosDePrueba` borra los avisos `zz_test_`.
- **Calidad de las pruebas:** si una prueba pasa sin el cambio, no prueba nada. Nunca esquivar una prueba de texto moviendo el texto a otro archivo.
- **Quasar:**
  - el fondo de `q-dialog` responde a `mousedown`;
  - `scoped` no alcanza los menús montados en `body`;
  - con la prop `padding` de `q-btn`, el `min-height` necesita `!important`;
  - `sticky` no sirve dentro de `q-tab-panels`;
  - `q-avatar` se ajusta con `size`;
  - `tabular-nums` solo va en cifras.
- **Navegador:** `backend-experimento-3011` + `frontend-experimento-9012`, con cuentas `zz_test_` que se borran al final. El 3011 puede figurar «running» estando caído. Con el panel oculto, `requestAnimationFrame` va a ~1 cuadro/s; en Playwright, esperar 3 s antes de capturar.
- **Subagentes:** pedir que no dejen procesos en segundo plano, que no toquen MEMORY.md y que usen solo cuentas `zz_test_`.
- **Otros:** `session.id` es texto (comparar con `Number(...)`). Si una tabla de XAMPP da «doesn't exist in engine», no borrar tablas sueltas.
- **Revisión de seguridad (rama `revision-CS`, S0 a S8 hechas y mezcladas; 2026-11-17):** Apache de XAMPP sirve todo `htdocs` en la LAN (S0: `.htaccess` lo bloquea): no dejar secretos ni respaldos dentro del proyecto. Rotar claves con `Backend/src/utils/rotarSecretos.js`. Guía de despliegue en `docs/seguridad-despliegue.md`.
- **Backend seguro:** contraseña ≥12 y no común (`validarPasswordNueva`); cambio/restablecimiento revoca sesiones y cierra SSE; bloqueo 5 fallos/15 min por correo (memoria); JWT HS256 y secreto ≥32; sin seed demo en producción. `db.js` solo acepta parámetros primitivos (para `IN`/`VALUES` armar los `?` a mano). JSON ≤100 kb, rate limit 300/min (60/min escrituras; `crearApp({ limitarPeticiones })`, apagado en `soporte-pruebas/http.js`), máx. 5 SSE por usuario.
- **Bitácora (S6):** `registrar(evento, req, extra)` de `utils/bitacoraSeguridad.js` (JSON a stdout; descarta pass/token/hash/sql/body y enmascara correo); el 403 se registra en `app.js`; `registrarError` reemplaza `console.error`.
- **Sesión (S8):** cookie `sp_sesion` HttpOnly/SameSite=Strict/Secure por HTTPS; el front solo guarda el perfil. Con cookie, las escrituras exigen `X-Requested-With: SeguimientoProyectos`; Bearer sigue válido. CORS con credenciales solo a orígenes de la lista. nginx: cabeceras en `nginx/cabeceras-seguridad.conf`; `CF-Connecting-IP` solo se confía en el puerto interno 8081 (túnel).
- **Pruebas/infra (S3, S5, S7):** `inyeccionSql.test.js` y `autorizacionMatriz.test.js` (falla si una ruta nueva no está en su tabla). Compose endurecido, respaldos AES-256-GCM (`respaldarBd.js`/`restaurarBd.js`, `RESPALDO_FRASE`), hook `.githooks/pre-commit` (activar con `git config core.hooksPath .githooks`). Probar siempre con `node --test --test-concurrency=1` (en paralelo falla al azar por la BD compartida).
- **Dudoso sin cambiar (S5):** `usuarios_de_sistema` puede crear/promover administradores y restablecer su contraseña; `GET /eventos` no revisa la sesión al canjear el pase.

---
Nada sensible en esta memoria.
