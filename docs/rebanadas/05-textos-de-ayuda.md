# 05 — Textos de ayuda que explican la regla de los equipos

- **Riesgo:** bajo (solo textos de interfaz; sin lógica, permisos ni datos)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer-ligero`, Haiku)
- **Estado:** aprobada (implementada, revisada y verificada en navegador el 2026-11-11)

## Historia

Como contador o como persona del despacho, quiero que las pantallas de equipos digan quién puede cambiar un equipo y a quién se le avisa, para no llevarme sorpresas cuando llega un aviso o cambia mi lista de auxiliares.

La regla que deben contar (opción B, rebanadas 01 a 04): el despacho puede armar cualquier equipo; cada contador ajusta el suyo; a los afectados les llega aviso.

## Criterios de aceptación

1. **«Mis auxiliares» (contador)** explica que el despacho también puede cambiar su equipo y a quién se avisa cuando el contador agrega o quita. Textos exactos en la tabla, filas 1 a 3.
2. **«Contadores que apoya» y el alta de un auxiliar (despacho)** dicen que se avisa al auxiliar y a los contadores, también al quitar, y que cada contador puede ajustar su propio equipo. Textos exactos en la tabla, filas 4 y 5.
3. Ningún texto promete un aviso que el sistema no envía, y las pantallas siguen viéndose bien en móvil y en escritorio (sin texto cortado ni desbordado).

## Textos

| N.º | Dónde | Texto actual | Texto nuevo |
|---|---|---|---|
| 1 | `ContadorAuxiliaresPage.vue`, párrafo bajo el título | «Aquí están los auxiliares que te apoyan con tus casos. Pueden cambiar el estado de tus casos y tú recibirás un aviso cada vez que lo hagan.» | «Aquí están los auxiliares que te apoyan con tus casos. Pueden cambiar el estado de tus casos y tú recibirás un aviso cada vez que lo hagan. Tú puedes agregar o quitar auxiliares, y el despacho también puede hacerlo; si lo hace, te llegará un aviso.» |
| 2 | `AgregarAuxiliaresDialog.vue`, ayuda bajo el título | «Marca a quienes te ayudarán. Verán tus casos y podrán cambiar su estado; tú recibirás un aviso cada vez que lo hagan.» | «Marca a quienes te ayudarán. Verán tus casos y podrán cambiar su estado; tú recibirás un aviso cada vez que lo hagan. A cada persona que asignes se le avisará, y también a los administradores.» |
| 3 | `ContadorAuxiliaresPage.vue`, confirmación «¿Quitar auxiliar?» | «{auxiliar} dejará de ver tus casos y de poder cambiar su estado.» | «{auxiliar} dejará de ver tus casos y de poder cambiar su estado. Se le avisará, y también a los administradores.» |
| 4 | `ContadoresDeAuxiliarDialog.vue`, ayuda bajo el título | «{auxiliar} verá los casos de estos contadores y podrá cambiar su estado. A los que agregues se les avisará.» | «{auxiliar} verá los casos de estos contadores y podrá cambiar su estado. Al guardar se avisa a {auxiliar} y a cada contador que agregues o quites. Cada contador también puede cambiar su equipo desde «Mis auxiliares».» |
| 5 | `NewUserDialog.vue`, ayuda del campo de contadores | «El auxiliar verá los casos de estos contadores y podrá cambiar su estado. Se les avisará.» | «El auxiliar verá los casos de estos contadores y podrá cambiar su estado. Se les avisará a ellos y al auxiliar.» |

## Archivos autorizados

- `Seguimiento-proyectos/src/pages/ContadorAuxiliaresPage.vue` — textos 1 y 3.
- `Seguimiento-proyectos/src/components/AgregarAuxiliaresDialog.vue` — texto 2.
- `Seguimiento-proyectos/src/components/ContadoresDeAuxiliarDialog.vue` — texto 4.
- `Seguimiento-proyectos/src/components/NewUserDialog.vue` — texto 5.
- `Seguimiento-proyectos/test/` — una prueba nueva que exija los textos nuevos; si algún aserto existente exige literalmente un texto que cambia, se ajusta solo ese aserto al texto nuevo.

Fuera de esta lista, el implementer para y pregunta. Solo cambian textos: nada de estilos, estructura ni lógica.

## Notas del orquestador

- Qué avisa el sistema hoy (para no prometer de más):
  - El contador agrega: aviso al auxiliar, al propio contador y a cada administrador.
  - El contador quita: aviso al auxiliar y a cada administrador (no al propio contador).
  - El despacho agrega o quita: aviso al auxiliar y al contador (no a los administradores).
  - Alta de un auxiliar con contadores: aviso al auxiliar y a cada contador.
- Textos en tú, sin ambigüedad, como el resto de la app.
- **NO entra:** tooltips de los botones, mensajes de éxito o error, cualquier cambio en el backend.
- Trampas: varios `.vue` usan CRLF (editar con cuidado de no cambiar los fines de línea); las pruebas del frontend leen el código fuente, así que un texto partido en dos líneas necesita un aserto que tolere espacios y saltos.
- Puertas: Frontend `npm run lint:check`, `npm run build`, `node --test`. Backend: no aplica. Navegador (`backend-experimento-3011` + `frontend-experimento-9012`, cuentas `zz_test_`): los cinco textos en móvil y en escritorio.

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: los cinco textos, copiados tal cual de la tabla.
2. Archivos modificados: `ContadorAuxiliaresPage.vue` (textos 1 y 3), `AgregarAuxiliaresDialog.vue` (2), `ContadoresDeAuxiliarDialog.vue` (4, conserva `{{ cuenta?.nombre }}`), `NewUserDialog.vue` (5) y `test/textosAyudaEquipos.test.js` (nuevo, 5 pruebas). Fines de línea de cada archivo sin cambios.
3. Prueba en rojo: las 5 pruebas nuevas fallaron (`The expression evaluated to a falsy value`) porque los textos nuevos no estaban.
4. Puertas: `node --test` 1042/1042, `npm run build` en verde, `npm run lint:check` con salida 0. Backend: no aplica.
5. Decisiones no cubiertas: ninguna. No tocó ningún aserto existente.
6. Para la memoria: nada nuevo.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer-ligero` (Haiku), 2026-11-11. Resumido por el orquestador.

VEREDICTO: APROBADO (sin escalar)

- Los cinco textos coinciden con la tabla, con comillas « » e interpolación; solo cambian textos en los cuatro `.vue` autorizados; ningún texto promete un aviso que el sistema no envía.
- Ejecutado: lint (salida 0), build (salida 0), `node --test` 1042/1042 y la prueba nueva 5/5. `git diff -w` igual que `git diff`: sin cambios de espacios.
- Cada prueba busca la frase nueva completa; fallaría si el texto volviera al anterior. Ninguna prueba existente cambió.

Opcional (no bloquea):

1. El criterio 2 pide que también el alta diga que cada contador puede ajustar su equipo; el texto 5 aprobado no lo dice (lo cubre el texto 4). Cubrirlo sería cambiar la tabla.
2. En el texto 5, «a ellos» se refiere a los contadores; se entiende, pero es indirecto.
3. El texto 4 quedó en una línea larga del código fuente (solo estilo).

## Verificación en navegador (orquestador, 2026-11-11)

Con `backend-experimento-3011` + `frontend-experimento-9012` y cuentas `zz_test_` creadas y borradas para la prueba:

- Textos 1, 2 y 3 (contador): vistos en móvil (375 px); el 1 también en escritorio (1280 px). Sin texto cortado.
- Texto 4 (despacho, «Contadores que apoya»): visto en escritorio y en móvil, con el nombre del auxiliar interpolado en los dos lugares.
- Texto 5 (alta con rol Auxiliar): visto en móvil y en escritorio.
- Al terminar: 12 filas `zz_test_%` en `usuarios` (las de antes) y 0 avisos de prueba.
