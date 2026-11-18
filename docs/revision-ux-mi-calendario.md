# Revisión de UX/UI de «Mi Calendario» (2026-11-18)

Es una revisión de solo lectura: no se modificó ningún archivo del proyecto.

- **Material revisado:** 58 capturas, a 1280 px y a 375 px, con cuentas y juntas `zz_test_` que cubren todos los estados. Los datos ya se borraron.
- **Revisiones en paralelo:**
  - `impeccable`: UX y accesibilidad. Puntuación Nielsen de **26/40 (aceptable)**.
  - `emil-design-eng`: interacción y movimiento.
  - `frontend-design` con la skill local `UI`: dirección visual y componentes inspirados en Uiverse.

**Lo que ya funciona bien:**
- El estado de cada junta siempre va con texto.
- Los `aria-label` están completos.
- Los diálogos siguen el patrón de movimiento del proyecto.
- El formulario cumple «¿Descartar los cambios?» y el foco al primer error.
- No hay errores en la consola ni en la red.

## Hallazgos agrupados

Las severidades y la evidencia (capturas y archivo:línea) están en los reportes de cada revisión. Aquí se juntan los hallazgos que coinciden y se marcan los que **contradicen una decisión ya tomada (⚠)**.

### A. Bugs y cosas que no se ven

1. **Juntas fuera de 8:00 a 19:00:** desaparecen en Semana y Día sin ningún aviso (06:30, 19:30, 22:00–01:30). En «Ver agenda de», la persona parece libre. `segmentoDelDia` ya calcula el recorte, pero el calendario no lo usa.
   - **Propuesta:** etiquetas «Antes de las 8:00 · 06:30 …» y «Después de las 19:00 · …» en la franja de arriba del día. En los bloques recortados, «↑ empieza 07:00» o «↓ sigue hasta 20:00».
2. **Fin de semana:** la vista Semana no lo muestra, así que el aviso de una junta en sábado lleva a un día que no se ve. ⚠ La 21b y la 25 decidieron mostrar de lunes a viernes. Hay dos opciones:
   - un aviso «Tienes juntas el fin de semana · Ver en Mes»;
   - mostrar sábado y domingo solo cuando tengan algo.
3. **Mes, juntas que cruzan la medianoche:** el día siguiente sale con «22:00»; debe decir «Hasta 01:30».
4. **Hover:** al pasar el mouse sobre una junta «Por confirmar» o «Cancelada», se pinta de azul y se pierde el color de su estado. En táctil, ese hover se queda pegado.
5. **«Responder» en la agenda de otra persona:** se refiere a quien mira, no al dueño de la agenda. A la recepcionista se le esconde justo su tarea: «Responder por A».
6. **Campana:**
   - el badge se corta en móvil;
   - tiene dos barras de scroll y tapa «Nueva junta»;
   - pide los avisos 2 o 3 veces por cada carga, porque reacciona a `route.fullPath`.

### B. Formulario y ficha

7. **Botones bajo el pliegue:** en el formulario, «Crear junta» y «Cancelar» quedan debajo del pliegue con 800 px de alto, sobre todo para la recepcionista y al editar.
   - Hay que dejar el pie fijo y el scroll solo en el cuerpo, como en la ficha.
   - Las ayudas deben quedar justo bajo su campo (prop `hint`).
8. **Ficha en móvil:** la descripción se lee una palabra por línea, hay un scroll dentro de otro y el pie tapa «Invitados». Por debajo de 600 px debe ir en una sola columna. ⚠ La regla de los 120 px de scroll interno se mantendría solo en escritorio.
9. **Encabezado en mayúsculas:** «RESPONDER POR {NOMBRE}» pone también el nombre en mayúsculas.
10. **«Editar» desde la ficha:** cierra un diálogo y abre otro al mismo tiempo, y el foco de teclado se pierde al cerrar.

### C. Legibilidad del calendario

11. **Bloques de 30 minutos y juntas encimadas:** la hora queda cortada. Hace falta una variante compacta de una sola línea: «11:30 Llamada…».
12. **Vista Mes:**
    - las marcas tapan el título;
    - no hay «+N más»: debe mostrar como máximo 3 elementos por día y abrir la vista Día con el resto.
13. **Vencimientos:** se cortan en Semana y se confunden con juntas. La propuesta es una «pestaña de expediente», con icono y en 2 líneas.
14. **Colores que se confunden:**
    - «Cancelada» se ve como la prioridad Alta, en rojo. Propuesta: neutra, en gris y tachada.
    - «Por confirmar» se ve como la prioridad Media, en amarillo. Propuesta: rayado.
15. **Marcas que faltan en el calendario:** «Privada» y «Solo tú» (junta sin invitados).
16. **Bloques ajenos:**
    - «Ocupado» se lee como deshabilitado; se propone un rayado neutro con candado;
    - «organiza {nombre}» se corta; debe ir en su propia línea.
17. **Foco y tooltips:**
    - el anillo de foco cambia según el elemento; debe ser uno solo, en `--dg-foco`;
    - el tooltip de «Mostrar vencimientos» mide 1060 px;
    - los tooltips de «Anterior / Hoy / Siguiente» saltan en cada pulsación. Hace falta `max-width` y un retraso de 500 ms.

### D. Carga y respuesta a lo que haces

18. **Cambio de periodo:** cada cambio desmonta el calendario y pone un loader. La página se encoge y en móvil el scroll vuelve al lunes. Propuesta: mantener el calendario a la vista con una barra fina de progreso y opacidad.
19. **Aviso «No tienes juntas»:** empuja el calendario unos 50 px. Debe ir dentro de la tarjeta.
20. **Guardar o borrar:** el calendario se actualiza hasta que llega la recarga. Debe usar la junta que devuelve la API y quitarla o ponerla al instante.
21. **Después de crear o editar:** hay que llevarte a la junta y resaltarla unos 3 s, como «Mis casos».
22. **Al responder:** sobra el aviso «Respuesta guardada.», porque el botón marcado ya lo confirma.

### E. Cabecera y móvil

23. **Jerarquía de la cabecera:**
    - **fila 1:** el periodo en grande, ‹ Hoy › y «Nueva junta»;
    - **fila 2:** la vista, «Ver agenda de» y el interruptor de vencimientos.
    - Componente propuesto: `BarraPeriodo`.
24. **Texto de guía:** debe depender de la vista y de la agenda. Hoy dice «Consulta tus juntas» en la agenda de otra persona y habla de «huecos» en Mes y Año, que no tienen.
25. **Selector «Ver agenda de»:** el nombre se corta y aparece «(Administrador) (lo administras)». Hace falta un slot con el nombre y, debajo, el rol.
26. **Aviso de la recepcionista:** mide unos 100 px y muestra «Ver su agenda» aunque ya estás en ella. Debe ir en una sola línea y ocultar el botón cuando sobra.
27. **Móvil:** hay unos 450 px de controles antes del calendario. Propuesta:
    - «Nueva junta» como botón flotante;
    - ‹ › solo con icono;
    - las opciones de la vista plegadas;
    - Semana y Mes reutilizando la tira de semana de `CalendarioAdministrador`.

### F. Vista Año

28. **Teclado y tamaño:** hay 365 paradas de Tab y los días miden 36 px. Hace falta un solo día enfocable con flechas y 44 px.
29. **Mes actual:** abre en enero aunque estemos en noviembre; debe abrir desplazado al mes actual.
30. **Peso visual:** todos los días se ven igual. Propuesta: intensidad según el número de juntas y hoy con un anillo.

### G. Movimiento reducido

31. **`prefers-reduced-motion`:** no cubre `jump-down` (selectores, tooltips y campana) ni el `shake` del diálogo. Debe quitar el desplazamiento y dejar el fundido.

## Componentes nuevos propuestos

Necesitan aprobación, porque son archivos nuevos:

- **`BloqueJunta.vue`:** un solo bloque para Semana, Día y Mes, con variantes por estado y modo compacto.
- **`MarcaJunta.vue`:** píldora con icono y texto («Responder», «Privada», «Solo tú», «Por confirmar»).
- **`BarraPeriodo.vue`:** la cabecera del calendario. Se podría reutilizar en el calendario del administrador.

Todos usan solo colores de `$dg-colores`; no hace falta un color nuevo.

## Propuesta de rebanadas

| Rebanada | Contenido | Riesgo |
|---|---|---|
| 29 | Bugs y lo que no se ve: A1, A3, A4, A5, A6 y A2 (según tu decisión) | Medio |
| 30 | Formulario y ficha: B7 a B10 | Bajo |
| 31 | Carga y respuesta: D18 a D22 | Medio |
| 32 | Legibilidad del calendario y componentes `BloqueJunta`/`MarcaJunta`: C11 a C17 | Medio |
| 33 | Cabecera, móvil y vista Año: E23 a E27, F28 a F30, G31 | Medio |
