# MEMORY.md — DelGrow Estado Contadores

Memoria entre sesiones (máx. ~50 líneas). El detalle está en los commits y en `docs/rebanadas/`.

## Estado actual

- **Ramas (2026-11-20):** `main` = `experimento` (4785e54, rebanadas 34 a 38), ambas en `origin`, con «Mis actividades» (10–17), el calendario del administrador (18–19), la edición de cuentas y el módulo «Mi Calendario» (20–33).
- **Docker = `main` 8911a26 (edición de cuentas).** Faltan «Mis actividades» y el calendario. Antes de publicar: respaldo; el seed crea las tablas de actividades (en producción no existen); validar la regla fiscal con los contadores; revisar auxiliares con varios contadores (`SELECT auxiliar_id, COUNT(*) FROM contador_auxiliar GROUP BY auxiliar_id HAVING COUNT(*) > 1`).
- **Publicar:** respaldo dentro del contenedor (`mariadb-dump --single-transaction --routines --triggers --events > /tmp/...` + `docker compose cp`; la tubería de PowerShell daña acentos; los `.sql` nunca se versionan). Etiquetar las imágenes anteriores (última: `antes-editar-usuarios-2026-11-17`). `docker compose build` desde PowerShell (en Git Bash `API_URL=/api` se rompe). `up -d --no-deps backend frontend` para que el túnel conserve su URL.
- **Túnel cloudflared:** la URL cambia en cada reinicio (`docker compose logs tunnel`). Agregarla a `CORS_ORIGENES` y `up -d backend`; si no, el login da 403.
- **Bases:** producción en Docker 3307 (solo en una publicación pedida); pruebas en XAMPP 3306, compartida con el backend de desarrollo. Las 12 cuentas `zz_test_` del 2026-11-10 no se tocan.
- **Proceso:** rebanadas verticales con TDD (`docs/flujo-agentes.md`). `implementer` sonnet; `reviewer` opus en riesgo medio o alto, `reviewer-ligero` en bajo. Cada rebanada en `docs/rebanadas/NN-*.md` con su reporte y opcionales. Solo el orquestador edita MEMORY.md.

## Funcionalidades recientes

- **«Mis actividades» (10–17):** «Mi trabajo» con pestañas Mis casos | Mis actividades. Clientes y tipos propios de cada quien; la jornada solo la ve cada quien; informes sin tarifa. El vencimiento se calcula en `utils/vencimientoActividad.js` (festivos LFT). El cronómetro usa la hora del servidor y `FOR UPDATE`.
- **Calendario del administrador (18–19):** franja «Requiere atención» (solo casos importantes), dos columnas desde 1280 px, modo día o rango (`?dia=`/`?rango=`). Endpoints `GET /contadores/casos-importantes` y `GET /auditorias/calendario` (`GET /auditorias` no trae los eventos). «Vence pronto» va en amarillo (`dg-vence-pronto`).
- **Editar cuentas:** `PATCH /usuarios/:id` con `NewUserDialog.vue` (prop `cuenta`). Nunca cambia la contraseña; si cambia el rol, revoca las sesiones. Sin cubrir: auditorías de un contador que cambia de rol.
- **Contador reparte casos a su equipo (37–38, 2026-11-20, subidas en 4785e54):** `POST /casos/para-mi-auxiliar` (caso nuevo; acepta «Importante») y `PATCH /casos/:id/responsable` (pasar un caso existente entre el contador y sus auxiliares; UPDATE condicional con 409 si algo cambió; avisos a quien recibe y a quien pierde). Solo rol contador; el auxiliar no pasa casos. UI: selector «Registrar caso para» y «Pasar a…» en «Mis casos» y «Mi equipo» (`CaseFormDialog` prop `auxiliarDestino`, `utils/pasarCaso.js`).
- **«Mi Calendario», hoy pintado (39, 2026-11-20, sin commit):** la celda de hoy de la cabecera (Semana y Día) y la de la tira del celular van en `var(--q-primary)` (marino de «Nueva junta») con texto blanco y foco blanco. La tira se pinta desde `CalendarioJuntas` (`.calendario-juntas__tira`), porque `SemanaCalendario` también la usa el calendario del administrador, que no cambia.
- **Trampas de prueba:** `limpiarDatosDePrueba` borra todo aviso que mencione `zz_test_`, así que no se prueba en navegador mientras corre el backend. Con el panel del navegador oculto, las animaciones van a ~1 cuadro/s y los clics y teclas pueden fallar: mostrar el panel (`show_pane` preview) antes de probar.
- **«Mi perfil»:** «Cambiar contraseña» está oculto (`CAMBIO_CONTRASENA_HABILITADO = false`); el backend sigue ahí.

- **Módulo de calendario (desde 2026-11-18):** rebanadas:
  - 20, rol recepcionista: hecha y subida (`e401872`).
  - 21a, juntas en el backend: hecha y subida (`6aedcce`).
  - 21b, pantalla «Juntas» (`/juntas`, QCalendar 5.4.0 importado solo en `CalendarioJuntas.vue`; principal de la recepcionista). Si `npm install` da EBUSY, cerrar el servidor de desarrollo.
  - 22, responder invitaciones: `PATCH /juntas/:id/respuesta`, estado calculado en `estadoJunta.js` (no se guarda), `notificaciones.junta_id`; el enlace del aviso solo se da a quien organiza o sigue invitado; cambiar inicio/fin reinicia respuestas. Recepcionista con campana.
  - 23, juntas privadas y agenda de otros: `juntas.privada`, `GET /juntas/agenda/:usuarioId` (un tercero nunca recibe id, descripción ni invitados; privada = «Ocupado»), selector «Ver agenda de» (`?agenda=`). Claves de bloques sin id únicas en todo el calendario.
  - 24, avisos por correo: PENDIENTE por decisión del usuario (hace falta nodemailer y una cuenta SMTP del despacho).
  - 25, vista Año (`?vista=anio`) y vencimientos de casos en Mes, Semana y Día (`utils/vencimientosEnCalendario.js`; interruptor por persona en localStorage). La Semana es de lunes a viernes, sin vencimientos de fin de semana.
  - 26, ajustes:
    - juntas sin invitados (bloquean el horario);
    - vencimientos de auditorías del contador (`auditoriaService` entrega las fechas en `DD-MM-AAAA`);
    - calendario sin tooltips (excepción anotada en `AGENTS.md`).
  - 27, «Mi Calendario» (la ruta sigue siendo `/juntas`):
    - la recepcionista es secretaria de todos los administradores (`organizador_id`, `en_nombre_de`);
    - las reglas viven solo en `utils/accesoJuntas.js`;
    - `JuntaModel` recibe al consultante como `{id, rol}`.
  - 28, la recepcionista solo atiende a los administradores de `ADMINISTRADORES_DE_RECEPCION` (`config/recepcion.js`):
    - local `1` (`Backend/.env`), producción `7947` (`.env` de la raíz);
    - sin definir: todos fuera de producción y nadie en producción;
    - la recepcionista ve el aviso «Administras la agenda de…»;
    - trampa: dotenv carga `Backend/.env` en las pruebas, así que la prueba que necesite a todos los administradores debe quitar la variable;
    - **antes de desplegar**, confirmar que el 7947 es administrador en la base de Docker.
  - Revisión de UX (`docs/revision-ux-mi-calendario.md`), rebanadas 29 a 33, ya subidas:
    - la vista Semana muestra sábado y domingo solo si tienen algo;
    - etiquetas para juntas fuera de 8:00 a 19:00;
    - el calendario no se desmonta al cargar;
    - `BloqueJunta`, `MarcaJunta` y `BarraPeriodo` son el marcado único;
    - en móvil, `SemanaCalendario` con `conCabecera=false`;
    - vista Año con foco itinerante;
    - trampa: el foco de los `q-btn` del calendario necesita `!important` para ganar a `app.scss`.
    - rebanada 34: la recepcionista ve en la agenda de su administrador también las canceladas y rechazadas; cancelada en rojo (`--dg-error*`), no gris; marcas en compacto como iconos (máx. 2); «Sin invitados» si no organizas. Trampa: no usar `git stash` aquí (cambia LF/CRLF y rompe `prettier --check`).
    - rebanada 35: si la recepcionista responde por el administrador y eso confirma o cancela la junta, él recibe dos avisos («por ti» y luego el de estado).
    - rebanada 36: «Agendar junta» en el directorio, solo para administrador y recepcionista, en filas de cuentas con calendario (no la propia ni usuario de sistema). La recepcionista agenda a nombre del administrador que atiende (con varios, `q-menu` «A nombre de…»; sin ninguno, a su nombre). Reglas en `altaDesdeDirectorio`/`puedeAgendarDesdeDirectorio` de `utils/juntas.js`. `CountersDirectoryPage.vue` ya fallaba `prettier --check`.
  - Pendientes:
    - opcionales de la revisión sin aplicar (en cada `docs/rebanadas/29` a `33`), entre ellos probar en el navegador la agenda de la recepcionista con los bloques nuevos;
    - formatear `MaquetaLayout.vue` y `router/index.js` (ya fallaban `prettier --check`);
    - rebanadas 35 y 36 (2026-11-20) aprobadas, probadas en navegador y subidas (9988877).

  Decisiones:
  - Calendario propio (Google queda aparte), solo juntas internas y privacidad por junta.
  - Cada invitado acepta o rechaza; si el administrador está invitado, su respuesta confirma o cancela la junta.
  - Los 4 roles crean juntas e invitan entre sí.
  - La recepcionista consulta el directorio y administra la agenda de los administradores; su pantalla principal es «Mi Calendario».

  21a:
  - Tablas `juntas` y `junta_participantes`, rutas `/juntas` (`requireCalendario`); `/eventos` es el SSE.
  - El PATCH pide el cuerpo completo y conserva respuestas y `respondido_en`.
  - Campos de error: `título`, `descripción`, `inicio`, `fin`, `participantes` y `rango de fechas`.

  Pregunta abierta: si la recepcionista ve el «Último acceso» en el directorio.

## Pendientes / para decidir

- **«Mis actividades»:** los «para decidir» de `17-revision-ui-actividades.md` (`en_cartera` en `GET /actividades`, jornada plegada) y la regla fiscal. Los opcionales sin aplicar están en cada `docs/rebanadas/NN-*.md`.
- **Revisión UI 2, sin aplicar:** el resumen del admin parpadea; `?chat=1` no se quita; «Registrar caso para» no se puede vaciar; auditorías y «Mi perfil» sin tiempo real; falta `hayDatosSinGuardar` en «Agregar auxiliares» y «Contador que apoya»; tooltips de chips sin teclado; carga en la campana.
- **«Mi perfil», opcionales:** revocar sesiones al cambiar la contraseña, límite de intentos, recortar espacios en el servidor. Proponer su regla para `AGENTS.md`.
- **Requieren aprobación (estructura):** índice único en `contador_auxiliar(auxiliar_id)`; campos del boceto de auditorías (Importancia, RFC/Unidad/Socio/Multa).
- **Producción:** corregir en la app las auditorías migradas con «Periodo por confirmar».
- **Preguntas abiertas:** nombre de la PWA, logo más liviano, qué hacer con `.playwright-mcp/` (sin versionar).

## Errores a evitar

- **Shell:** PowerShell no admite `&&`/`||`. En Git Bash, `MSYS_NO_PATHCONV=1`. Varios `.vue` usan CRLF y `sed` falla con varias líneas o con `\\`: usar Edit.
- **ENUM de roles:** el seed fija `usuarios.rol` en cada arranque y MariaDB no está en modo estricto. Un rol agregado a mano que no esté en el seed queda en `''` sin error: agregarlo siempre en `seed.js` (CREATE y ALTER).
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
- **«Mis actividades» solo para cuentas habilitadas (rama `modulo-actividades-restringido`):** `USUARIOS_CON_ACTIVIDADES` (ids separados por comas; `*` = todos; vacío = nadie; sin definir = abierto en desarrollo y cerrado en producción) la lee `config/modulos.js` en cada petición; `requireModuloActividades` va en las 22 rutas de clientes, tipos-actividad, actividades, tiempo, jornadas e informes (403 «Módulo no habilitado»). Login y `/auth/perfil` traen `actividades_habilitadas`; el front oculta la pestaña (`session.actividadesHabilitadas`) y `?tab=actividades` cae a «Mis casos». `soporte-pruebas/http.js` fija `*` para el resto de pruebas. **Al desplegar:** agregar `USUARIOS_CON_ACTIVIDADES=7917` al `.env` de la raíz (sin eso el módulo queda cerrado para todos).
- **Dudoso sin cambiar (S5):** `usuarios_de_sistema` puede crear/promover administradores y restablecer su contraseña; `GET /eventos` no revisa la sesión al canjear el pase.
- **Despliegue 2026-11-18 (hecho):** Docker corre `main` 7e584f7; secretos rotados (BD, root, Workbench y JWT; las claves viejas ya no sirven), `USUARIOS_CON_ACTIVIDADES=7917` y túnel recreado (la URL *.trycloudflare.com cambió: al recrear el túnel hay que actualizar `CORS_ORIGENES` y recrear el backend). Respaldo previo en `%USERPROFILE%espaldos-delgrow\` e imágenes `:anterior` para volver atrás. **Pendiente:** restablecer desde la app las contraseñas de las cuentas reales de `cuentas.local.json` (≥12) y activar el hook (`git config core.hooksPath .githooks`). No quitar el `.htaccess` de la raíz.

---
Nada sensible en esta memoria.
