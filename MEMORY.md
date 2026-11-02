# MEMORY.md — DelGrow Estado Contadores

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Todo lo de abajo ya está en commits (último: `d0502ec`, 2026-11-02).

## Estado actual

- Publicado en Docker: sesión persistente + SSE («Mantener sesión» 7 días, latido 25s), PWA para contadores, túnel `tunnel` (cloudflared Quick Tunnel → `frontend:80`; la URL cambia en cada reinicio, ver `docker compose logs tunnel`; URL fija = túnel con token + dominio).
- 16 contadores (depurados 2026-10-29 según «Usuarios Sistemas.xlsx»), en la base y en `cuentas.local.json`.
- Casos: el vencimiento lo captura el contador (≥ inicio); `q-date` con máscara DD-MM-YYYY.
- Auditorías (módulo independiente de casos): tablas `auditorias`, `auditoria_dtl` (bitácora), `aud_conta`, `fases_aud`; API `/auditorias` + `/auditorias/:id/eventos`; semáforo, fase actual y próximo plazo se calculan (`utils/seguimientoAuditoria.js`), no se guardan. Ficha `/auditorias/:id` imprimible; tabla en escritorio (≥1024), FAB en móvil.
- Dashboard admin: pestañas Casos | Auditorías (`?tab=`, `?vista=`); tablero con indicadores, gráficas, Kanban imprimible (hoja horizontal). Tarjetas y dona de casos filtran la lista de contadores.
- «Mi resumen» del contador (`contador/dashboard`): calculado en el frontend sobre `/casos/mis-casos`; tarjetas y dona abren `contador/casos?filtro=…`; «Próximos a vencer» (hoy a +3) con `esCasoProximoAVencer`; alertas de auditoría; agenda «Lo que vence pronto» que edita con `CaseFormDialog`.
- SSE: `auditoria-actualizada` al admin y a los contadores asignados; `caso-actualizado` solo al admin.
- Colores del semáforo centralizados en `.semaforo--<clase>` (`app.scss`) y `utils/semaforoAuditoria.js`.

## Pendientes

- Boceto de auditorías: campo Importancia, aviso al Socio Director, días inhábiles SAT, campos RFC/Unidad/Socio/Multa (no existen en las tablas: proponer cambio de esquema antes).
- 5 fallos de layout del frontend que ya existían; `authRoutes` «correo en mayúsculas» falla a veces (carrera entre archivos de prueba).

## Backend (lo esencial)

- Errores `buildError` (3 partes ES), `asyncHandler`, handler global, `jti` por token.
- `parseCounterId` solo dígitos; se usa también para ids de caso.
- MariaDB/mysql2 (pool), seed idempotente, sin modo estricto (validaciones en controlador).
- `node --test` en paralelo con BD local real: datos `zz_test_*`, cerrar servidor/pool en `after`.
- Cuentas demo solo con `SEED_CUENTAS_DEMO=true`.

## Decisiones (y por qué)

- Contrato de fechas y edición de casos: ver `AGENTS.md`.
- Rate limit de login apagable en pruebas; sin `JWT_SECRET` en producción el servidor no arranca.
- El usuario descartó por ahora: encabezado de ficha en dos columnas, pruebas del servicio de eventos.

## Aprendizajes y errores a evitar

- PowerShell no soporta `&&`/`||`; usar `npm.cmd`. En Git Bash `API_URL=/api` → `MSYS_NO_PATHCONV=1`.
- `verificarPruebas.js` tiene `MINIMOS` por archivo: actualizar al añadir tests.
- Prettier: no formatear archivos completos que ya estaban sin formato en HEAD.
- Una prueba que pasa sin el cambio no prueba nada. Las pruebas de opencode solo buscaban texto: verificar lo que digan otros agentes en BD real y navegador.
- Verificar en navegador: CORS solo desde `:9000`; usar contador `zz_test_*` y borrarlo; emular `colorScheme: light`. El Vite de otra sesión puede quedarse con un módulo a media edición: `touch` y recargar.
- MySQL de XAMPP: si una tabla da «doesn't exist in engine», reinstalar limpia la carpeta `data`; no borrar tablas sueltas.
- `git --work-tree=<otra carpeta> checkout` contamina el índice → `rm .git/index && git reset`.
- Imprimir: `@page` con nombre en `body:has(...)`; `emulateMedia('screen')` también afecta a `page.pdf`.

---
Nada sensible en esta memoria.
