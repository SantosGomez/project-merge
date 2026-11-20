# 39 — «Mi Calendario»: la celda de hoy en la cabecera va pintada completa

- **Riesgo:** bajo (solo estilos)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer-ligero`, Haiku)
- **Estado:** refinada

## Historia

Como usuario de «Mi Calendario», quiero que la celda del día de hoy en la cabecera esté pintada completa, para ubicar el día actual de un vistazo.

## Criterios de aceptación

1. **Semana de escritorio** (`CalendarioJuntas.vue`, QCalendar): en la cabecera, la celda del día de hoy (nombre del día y número) lleva un fondo sólido del acento fuerte de la paleta (el mismo color del botón «Nueva junta») con texto blanco. Se quita el círculo actual alrededor del número. Los demás días no cambian.
2. **Día de escritorio:** cuando el día mostrado es hoy, su cabecera se pinta igual. Si no es hoy, no cambia.
3. **Semana y Día del celular** (`SemanaCalendario.vue`, `.semana__dia--hoy`): el día de hoy se pinta igual (fondo sólido del acento con texto blanco, toda la celda). Si el día elegido y hoy son distintos, cada uno conserva un aspecto distinguible.
4. Los colores salen de la paleta `$dg-colores` (`var(--dg-*)`), nunca un hexadecimal suelto. Si el par texto/fondo no está en `test/paletaColores.test.js`, se agrega y debe cumplir el contraste.
5. El texto «hoy» no depende solo del color: se conserva lo que ya hay para lectores de pantalla (`aria-label` o similar) o se agrega «(hoy)» si no existía.
6. El foco visible de teclado sigue viéndose sobre la celda pintada.
7. Mes, Año y el calendario del administrador no cambian.

## Archivos autorizados

- `Seguimiento-proyectos/src/components/CalendarioJuntas.vue` (solo estilos y, si hace falta, una clase en la cabecera)
- `Seguimiento-proyectos/src/components/SemanaCalendario.vue` (solo estilos)
- `Seguimiento-proyectos/src/css/quasar.variables.scss` y `test/paletaColores.test.js` (solo si hace falta un par de contraste)
- Una prueba nueva en `Seguimiento-proyectos/test/`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-20): solo la celda de hoy; acento fuerte con texto blanco; en Semana y Día de escritorio y del celular.
- QCalendar marca hoy con su propia clase (p. ej. `q-current-day`) en la cabecera; los estilos de QCalendar pueden necesitar `:deep(...)` o más especificidad (trampa conocida: el foco de los `q-btn` del calendario necesita `!important` para ganar a `app.scss`).
- Hay pruebas de texto sobre las plantillas del calendario (`juntasLegibilidad`, `juntasCabeceraMovilAnio`…): si alguna se rompe, ajustar lo mínimo y decirlo.
- Puertas: `lint:check`, `prettier --check` de los archivos tocados (solo tus líneas si ya fallaban en HEAD), `build`, `node --test`. El navegador lo prueba el orquestador.

---

## Reporte del implementer

1. Rebanada completada: sí, sin navegador (lo prueba el orquestador).
2. Archivos modificados:
   - `CalendarioJuntas.vue`: con `:deep`, `.q-calendar-day__head--day.q-current-day` lleva fondo `--dg-acento` y texto `--dg-superficie`, sin círculo y con foco `--dg-foco`. La tira del celular se pinta desde aquí (`.calendario-juntas__tira .semana__dia--hoy`). En `#head-day-event` se agrega `<span class="sr-only">Hoy</span>`.
   - `SemanaCalendario.vue`: « (hoy)» en el `aria-label` del día de hoy.
   - `test/juntasHoyPintado.test.js` (10 pruebas).
3. Prueba en rojo y por qué falló: 8 de 10 fallaron por el aserto, porque no existían las reglas ni los textos accesibles.
4. Puertas (verde / rojo / no aplica): `lint:check` y `build` en verde, `node --test` 1791/1791. `prettier --check` en verde en los archivos tocados (`SemanaCalendario.vue` solo difiere por CRLF).
5. Decisiones no cubiertas: la tira se pinta desde `CalendarioJuntas` porque `SemanaCalendario` también la usa el calendario del administrador, que no debe cambiar. El « (hoy)» accesible sí se aplica también allí.
6. Para la memoria: `test/juntasHoyPintado.test.js`.

## Comprobación en navegador (orquestador, 2026-11-20)

- Semana y Día de escritorio: la celda de hoy va pintada completa con el acento y texto blanco, sin círculo. Los demás días no cambian.
- Celular: «VIE 20» va pintado y lleva un aro blanco cuando además es el día elegido. Si se elige otro día (jueves 19), ese queda en azul claro y hoy en sólido.
- Lector de pantalla: «Viernes 20 de noviembre de 2026 (hoy)». A 375 px no hay desborde.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: CAMBIOS NECESARIOS (`reviewer-ligero`)

- Bloqueante: el criterio 1 dice «el mismo color del botón «Nueva junta»», pero ese botón usa `primary` (#111e30, azul marino) y el implementer pintó con `--dg-acento` (#1f5f99, azul medio). Está pendiente de confirmar con el usuario.
- Cumplen: criterios 2 a 7, puertas en verde (1791/1791) y sin hexadecimales.
- Opcionales: prueba de que `CalendarioAdministrador.vue` no usa `calendario-juntas__tira`; el « (hoy)» accesible también llega al calendario del administrador.

## Vuelta 2

- El usuario eligió el azul marino de «Nueva junta» (2026-11-20).
- **Cambios:**
  - Fondo y borde de hoy en `var(--q-primary)` ($primary, #111e30), con texto `--dg-superficie`.
  - El foco del botón de la cabecera de hoy va en blanco, porque `--dg-foco` no contrasta sobre el marino.
  - Se agregó el contraste de `superficie` sobre `$primary` en `paletaColores.test.js`.
  - Se agregó la prueba de que el calendario del administrador no usa `calendario-juntas__tira`.
- **Puertas:** `lint:check` y `build` en verde, `node --test` 1793/1793.
- **Navegador (orquestador):** la cabecera de hoy en escritorio mide `rgb(17, 30, 48)` con texto blanco. En el celular, «VIE 20» va en marino.

## Veredicto del reviewer (vuelta 2)

VEREDICTO: APROBADA (`reviewer-ligero`)

- Bloqueante resuelto: se usa `var(--q-primary)`, sin hexadecimales sueltos, y el contraste es de unos 16:1. El foco es visible.
- Puertas: 1793/1793; `lint:check` y `build` en verde.
- Opcionales sin aplicar:
  - `$dg-colores` no tiene el marino; se usa `var(--q-primary)`, como en otros componentes. Si se quiere estricto, `primario` puede entrar a la paleta en otra rebanada.
  - El foco puede recortarse en los bordes de la tira (`overflow-x: auto`, ya existía).
  - El «Hoy» de `sr-only` en escritorio solo se comprobó con pruebas estáticas.
