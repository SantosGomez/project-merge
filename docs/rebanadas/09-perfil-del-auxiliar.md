# 09 — El auxiliar ve a quién apoya en «Mi perfil»

- **Riesgo:** bajo (lectura que ya existe, mostrada en una sección nueva)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer-ligero`, Haiku)
- **Estado:** refinada

## Historia

Como auxiliar, quiero ver en «Mi perfil» a qué contador apoyo, para tener claro con quién trabajo.

## Criterios de aceptación

1. Solo para el rol auxiliar, la vista muestra la sección «Contador que apoyas» en el lugar que para el contador ocupa «Mis auxiliares»: avatar con iniciales y nombre del contador, con el texto «Apoyas a {contador} con sus casos: ves sus casos y puedes cambiar su estado.».
2. Los datos salen de `listarContadoresQueMeTienenComoAuxiliar` del store de auxiliares (sin endpoint nuevo). Cargando: esqueleto; error: mensaje de tres partes con «Reintentar».
3. Si no apoya a nadie: «Todavía no apoyas a ningún contador» / «El despacho o un contador puede agregarte a su equipo; te llegará un aviso.». Sin botones: el auxiliar no cambia su vínculo.
4. El contador no ve esta sección y no se hace la petición para él.

## Archivos autorizados

- `Seguimiento-proyectos/src/pages/ContadorAuxiliaresPage.vue` y una prueba nueva en `Seguimiento-proyectos/test/`.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Regla de dominio: un auxiliar apoya a un solo contador; si la lista trae más de uno (datos antiguos), se muestran todos.
- Mismo estilo de tarjeta de sección que la 06; sin animaciones nuevas.
- **NO entra:** que el auxiliar cambie o deje a su contador, datos de contacto del contador.
- Puertas del frontend: `npm run lint:check`, `npm run build`, `node --test`.

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: criterios 1 a 4.
2. Archivos modificados: `src/pages/ContadorAuxiliaresPage.vue` y `test/perfilAuxiliar.test.js` (nuevo, 5 pruebas).
3. Pruebas en rojo: las 5 por el aserto (no existían la sección, el avatar, el esqueleto, el estado vacío ni la llamada al store).
4. Puertas: lint, build y `node --test` 1142/1142 en verde.
5. Decisiones no cubiertas: reutiliza `inicialesDe` y las clases `auxiliar-item*`; el texto de apoyo va como `caption` bajo el nombre; sin CSS nuevo.
6. Para la memoria: la sección solo carga datos con `session.esAuxiliar`.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet), 2026-11-11, revisada junto con la 08 (en lugar de `reviewer-ligero`). VEREDICTO: APROBADO. La sección y la petición están bajo `session.esAuxiliar`; los textos coinciden con los criterios; sin botones.

## Verificación en navegador (orquestador, 2026-11-11)

Auxiliar de prueba en móvil (375 px): «Contador que apoyas» muestra a su contador con el texto del criterio 1, su cartera solo trae su caso propio y el pie del menú es el enlace «Ir a mi perfil» (48 px, `aria-current="page"`). No se vio en navegador el estado «Todavía no apoyas a ningún contador».
