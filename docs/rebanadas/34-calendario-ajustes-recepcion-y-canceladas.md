# 34 — «Mi Calendario»: canceladas para la recepcionista, «Solo tú» visible y canceladas en rojo

- **Riesgo:** medio (cambia lo que devuelve la agenda para la secretaria y el estilo de los bloques)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet)
- **Estado:** aprobada

## Lo que reportó el usuario

1. La recepcionista **no ve las juntas canceladas**; las «Por confirmar» sí se ven.
2. **«Solo tú» no se ve**; «+N más» sí.
3. Quiere que **«Cancelada» sea roja**, para que se entienda que se rechazó o se canceló.

## Diagnóstico del orquestador

1. `JuntaModel.agendaDe` (`Backend/src/models/JuntaModel.js`, aprox. líneas 146–158) **siempre** excluye las juntas canceladas y aquellas en las que el dueño rechazó. Es la regla de la 23: no ocupan su horario. Pero la recepcionista, en la agenda del administrador que atiende (`veAgendaCompleta`), las administra y necesita verlas.
2. En `BloqueJunta.vue`, el **modo compacto oculta todas las marcas**. Se activa por alto (45 px o menos) o por ancho (`@container`, unos 120 px), y basta con que la semana muestre sábado y domingo para que las columnas queden angostas. Además, «Solo tú» (`marcasDeVisibilidad` en `utils/juntas.js`) no tiene sentido cuando quien mira no es el organizador, como la recepcionista en la agenda del administrador.
3. La 32 dejó «Cancelada» en tono neutro (gris). El usuario lo cambia a rojo.

## Criterios de aceptación

1. **Agenda completa de la secretaria:**
   - Cuando `veAgendaCompleta(consultante, dueno)` es verdadero (recepcionista sobre un administrador que atiende), `GET /juntas/agenda/:usuarioId` también devuelve las juntas `cancelada` y aquellas donde el dueño respondió `rechazada`, completas.
   - Para cualquier otro consultante la regla de la 23 no cambia: sin canceladas ni rechazadas, y con la privacidad de siempre.
   - Lleva pruebas en `agendaJuntas.test.js` o `recepcionistaJuntas.test.js` para los dos casos.
2. **Texto de la marca de una junta sin invitados:** «Solo tú» si quien mira es el organizador y «Sin invitados» en cualquier otro caso. Va en `marcasDeJunta`, con prueba.
3. **Marcas en modo compacto:**
   - Ya no se ocultan: se muestran **solo como iconos** (`MarcaJunta` con `solo-icono`) al final de la línea, como máximo 2, y conservan el `aria-label` completo.
   - Si no caben, se prioriza el estado («Cancelada» o «Por confirmar») y después la respuesta.
   - Se comprueba en una semana con sábado y domingo visibles y en bloques de 30 minutos.
4. **Cancelada en rojo:**
   - El bloque y la etiqueta de Mes usan `--dg-error-fondo`, el borde izquierdo `--dg-error` y el texto en `--dg-error` (o el par de texto sobre fondo de error que ya está en la paleta), con el título tachado.
   - La marca «Cancelada» de `MarcaJunta` lleva tono de error (icono `event_busy`).
   - El hover de una cancelada conserva el rojo.
   - Si hace falta un par de contraste nuevo, se agrega a `test/paletaColores.test.js`.
   - **Para que no se confunda con el vencimiento de prioridad Alta:** el vencimiento conserva su forma de pestaña con icono `flag` y sin borde izquierdo. La junta cancelada conserva el borde izquierdo, el tachado y el texto «Cancelada».
5. **«Rechazó» en la ficha:** el chip «Rechazó» de cada invitado pasa a rojo (tono de error), con su texto.
6. **Se mantiene:** sin tooltips dentro del calendario, colores solo de `$dg-colores`, textos en tú, responsivo hasta 375 px y todo lo de las rebanadas 29 a 33.

## Archivos autorizados

- `Backend/src/models/JuntaModel.js` (solo `agendaDe`), `Backend/test/agendaJuntas.test.js` y `Backend/test/recepcionistaJuntas.test.js`
- `Seguimiento-proyectos/src/utils/juntas.js`, `src/components/BloqueJunta.vue`, `MarcaJunta.vue`, `CalendarioJuntas.vue` y `JuntaDetalleDialog.vue`
- `Seguimiento-proyectos/test/juntas*.test.js` y `test/paletaColores.test.js`

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- **Esto cambia una decisión de la 32:** la cancelada pasa de gris a rojo.
- Puertas:
  - Backend: `node --test --test-concurrency=1` en los archivos tocados y `verificarPruebas.js`.
  - Frontend: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`.
- Navegador, con la recepcionista `zz_test_` en la agenda de su administrador `zz_test_` (`ADMINISTRADORES_DE_RECEPCION` solo en el entorno del proceso):
  - una junta cancelada por el rechazo del administrador;
  - una junta sin invitados del administrador («Sin invitados»);
  - una semana con fin de semana visible;
  - las mismas juntas vistas como el administrador («Solo tú»).
- Comprobar en escritorio y a 375 px.

---

## Reporte del implementer

1. **Rebanada completada:** sí, los 6 criterios.
2. **Archivos:**
   - Backend: `JuntaModel.js` (solo `agendaDe`) y `recepcionistaJuntas.test.js`.
   - Frontend: `juntas.js`, `BloqueJunta.vue`, `MarcaJunta.vue` (tono `error`), `JuntaDetalleDialog.vue` (el icono del chip «Rechazó» ahora es rojo), `juntasLegibilidad.test.js` y `paletaColores.test.js`.
   - `CalendarioJuntas.vue` no necesitó cambios.
3. **Prueba en rojo:**
   - Backend: la recepcionista no veía la junta cancelada.
   - Frontend: fallaron 6 aserciones, sobre «Sin invitados», el rojo de la cancelada y las marcas en modo compacto.
   - Se ajustaron las pruebas que fijaban lo que había decidido la 32.
4. **Puertas:**
   - Backend: 39/39 en los archivos tocados; `verificarPruebas.js` con 842 pruebas.
   - Frontend: `lint:check` y `build` en verde; `node --test` 1749/1749.
   - Navegador (Playwright, en escritorio y a 375 px):
     - la recepcionista ve las canceladas en la agenda de su administrador;
     - en modo compacto, las marcas salen como iconos;
     - en la vista Mes, «Cancelada» sale en rojo, junto a «Sin invitados»;
     - el administrador ve «Solo tú»;
     - el chip «Rechazó» sale en rojo.
   - Se usaron los puertos 3012 y 9013 porque el 3011 estaba ocupado por un proceso ajeno.
   - Datos de prueba: 0.
5. **Decisiones no cubiertas:**
   - «Solo tú» depende de `soy_organizador`.
   - Si la recepcionista mira la agenda de un administrador que no atiende, se aplica la regla de la 23.
6. **Para la memoria:**
   - La junta cancelada va en rojo (`--dg-error*`).
   - Trampa: no usar `git stash` en esta copia de trabajo, porque cambia los finales de línea.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (`reviewer`, 2026-11-18, sin modificar archivos).

- Se cumplen los 6 criterios.
- `agendaDe` solo incluye las canceladas y las rechazadas cuando `veAgendaCompleta` es verdadero, con el SQL parametrizado. La regla de la 23 y la privacidad siguen intactas.
- Las pruebas cubren la recepcionista que atiende, un tercero y la recepcionista que no atiende, y restauran la variable.
- La cancelada usa solo `--dg-error*`. El vencimiento de prioridad Alta no se tocó.
- Puertas:
  - backend: 73/73 en los archivos de juntas y `verificarPruebas.js` OK, con 842 pruebas;
  - frontend: `lint` y `build` en verde, `node --test` 1749/1749.

**Opcionales:**
- Partir el JSDoc de `agendaDe`, que quedó en una línea larga.
- El comentario de `paletaColores.test.js` todavía dice «Cancelada neutra».

**Estado:** aprobada (2026-11-18).
