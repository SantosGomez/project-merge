# 36 — «Agendar junta» desde el directorio de usuarios

- **Riesgo:** medio
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** refinada

## Historia

Como administrador o recepcionista, quiero agendar una junta con una persona directamente desde su fila del directorio, para no tener que ir a «Mi Calendario» y buscarla entre los invitados.

## Criterios de aceptación

1. En el directorio (`CountersDirectoryPage.vue`) hay una acción nueva **«Agendar junta»** (icono `event`, `q-btn` flat como las demás, `control-touch boton-presionable`, `aria-haspopup="dialog"`, `aria-label` «Agendar junta con {nombre}» y tooltip), en la tabla y en las tarjetas de la vista móvil.
2. **Quién la ve:** solo el administrador y la recepcionista con sesión. El contador, el auxiliar y el usuario de sistema no la ven.
3. **En qué filas:** en las de las cuentas que usan el calendario (administrador, contador, auxiliar y recepcionista). No sale en las de usuario de sistema ni en la fila de quien tiene la sesión.
4. **Administrador:** abre `JuntaFormDialog` dentro del directorio, para crear, con la persona de la fila ya invitada (`invitadoInicial`). Él organiza.
5. **Recepcionista** (con `session.administradoresAtendidos`):
   - La fila es un administrador que atiende → la junta queda a nombre de ese administrador (`organizador` = la fila) y sin invitados.
   - Cualquier otra fila con **un** administrador atendido → `organizador` = ese administrador e `invitadoInicial` = la fila.
   - Cualquier otra fila con **varios** administradores atendidos → el botón abre un `q-menu` «A nombre de…» con un ítem por administrador; al elegir uno se abre el formulario con ese `organizador` y la fila invitada.
   - Sin administradores atendidos → la junta queda a su nombre (sin `organizador`) con la fila invitada, como cuando agenda en «Mi Calendario».
6. Al guardar se cierra el diálogo y sale un `$q.notify` positivo «Junta agendada» con la acción «Ver en Mi Calendario» que lleva a `/juntas`. Al cerrar el diálogo el foco vuelve al botón que lo abrió.
7. Las reglas del punto 2 a 5 viven en funciones puras de `utils/juntas.js` (por ejemplo `puedeAgendarDesdeDirectorio(rolSesion, fila, idSesion)` y `altaDesdeDirectorio(rolSesion, fila, atendidos)` → `{ organizador, invitadoInicial }` o la lista de opciones del menú), con sus pruebas en `test/juntasUtils.test.js`.
8. Nada cambia en `JuntaFormDialog.vue` ni en el backend: el formulario ya recibe `invitadoInicial` y `organizador`, y el backend ya valida que la recepcionista solo agende a nombre de sus administradores.
9. Vista móvil (375 px) sin desborde horizontal: las acciones de la tarjeta caben (ya hay hasta 5 botones en la fila del usuario de sistema).

## Archivos autorizados

- `Seguimiento-proyectos/src/pages/CountersDirectoryPage.vue`
- `Seguimiento-proyectos/src/utils/juntas.js` (solo funciones nuevas)
- `Seguimiento-proyectos/test/juntasUtils.test.js`
- `Seguimiento-proyectos/test/directorioUsuarios.test.js` (solo si hace falta una prueba de texto del botón)

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-20): botón solo para administrador y recepcionista; en todas las filas de cuentas que usan el calendario; la recepcionista agenda a nombre del administrador que atiende; el formulario se abre como diálogo en el directorio.
- Decisión del orquestador: con varios administradores atendidos se elige en un `q-menu` del propio botón, para no agregar un campo nuevo al formulario. Sin administradores atendidos (producción sin `ADMINISTRADORES_DE_RECEPCION`), la junta queda a nombre de la recepcionista.
- Reusar las funciones existentes de `utils/juntas.js` (`administraAAdministrador`, `organizadorDeAlta`, `invitadoInicialDeAlta`) en vez de duplicar la lógica.
- El id de la sesión es texto: comparar con `Number(session.id)` o `String(...)`.
- El texto de ayuda de la cabecera del directorio puede mencionar la acción nueva solo si ya describe las demás acciones por rol (no crear un párrafo nuevo).
- Puertas del frontend: `npm run lint:check`, `npx prettier --check` sobre los archivos tocados, `npm run build`, `node --test`. El navegador lo prueba el orquestador al cerrar.
- No entra: cambios en el backend, en `JuntaFormDialog.vue` o en «Mi Calendario».

---

## Reporte del implementer

1. Rebanada completada: sí (sin navegador; lo prueba el orquestador).
2. Archivos modificados: `src/utils/juntas.js` (`puedeAgendarDesdeDirectorio` y `altaDesdeDirectorio`, al final), `test/juntasUtils.test.js` (9 pruebas nuevas) y `src/pages/CountersDirectoryPage.vue` (botón en tabla y tarjetas, `JuntaFormDialog`, notify con «Ver en Mi Calendario», foco de vuelta, `tieneAccionesTarjeta` ampliado; CRLF conservado).
3. Prueba en rojo y por qué falló: `test/juntasUtils.test.js` falló porque las dos funciones no estaban exportadas (rojo por import). Con ellas, 97/97.
4. Puertas (verde / rojo / no aplica): `lint:check` verde; `prettier --check` verde en `juntas.js` y la prueba; en `CountersDirectoryPage.vue` rojo, pero ya fallaba en HEAD (solo se formatearon las líneas nuevas); `build` verde; `node --test` 1758/1758. Navegador pendiente. Backend no aplica.
5. Decisiones no cubiertas: `altaDesdeDirectorio` siempre devuelve un arreglo de `{ organizador, invitadoInicial, texto }` (1 = alta directa, varios = menú). El formulario se monta una vez, solo para administrador y recepcionista. No se cambió el texto de ayuda de la cabecera.
6. Para la memoria: `CountersDirectoryPage.vue` ya fallaba `prettier --check` en HEAD.

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (`reviewer`)

- Puertas: `lint:check` verde, `prettier --check` verde en `juntas.js` y la prueba, `build` verde, `node --test` 1758/1758. `CountersDirectoryPage.vue` ya fallaba `prettier --check` en HEAD, y las diferencias que marca son de líneas anteriores a la rebanada.
- Criterios 1 a 8 cubiertos leyendo el código. El 9 (móvil) queda para el navegador.
- Opcional: la ayuda de la cabecera no menciona la acción nueva.

## Comprobación en navegador (orquestador, 2026-11-20)

Probado en `backend-experimento-3011` + `frontend-experimento-9012` con cuentas `zz_test_` (borradas al final, 0 filas):
- Administrador: el botón sale en las filas y el formulario abre con el contador ya invitado. Al guardar sale «Junta agendada · Ver en Mi Calendario» y el foco vuelve al botón.
- 375 px: el botón cabe en la tarjeta y no hay scroll horizontal (`scrollWidth` 375).
- Recepcionista (atiende al administrador 1): en la fila del contador sale «Organiza: admin_seed» con el contador invitado; en la fila de admin_seed, «Organiza: admin_seed» sin invitados. No se guardó, para no crear juntas a nombre de una cuenta real.
- El menú con varios administradores atendidos no se probó en el navegador (local solo atiende a uno); lo cubren las pruebas unitarias.
- Sin errores en la consola.
