# 42 — «Tu próxima junta» y línea de la hora actual en «Mi Calendario»

- **Riesgo:** medio (comportamiento nuevo con temporizadores; solo frontend, sin endpoint nuevo)
- **Implementa:** Claude (orquestador, TDD), en la rama `experimento`
- **Revisa:** Claude (`reviewer-ligero`)
- **Estado:** hecha (sin commit)

## Historia

Como usuario de «Mi Calendario», quiero ver cuánto falta para mi próxima junta y en qué hora del día voy, para llegar a tiempo sin tener que buscarla en el calendario.

## Criterios de aceptación

1. **Línea de la hora actual** (`CalendarioJuntas.vue`, vistas Semana y Día): línea horizontal en `acento` con un punto al inicio, solo en la columna de hoy y solo si la hora está dentro del horario visible (`HORA_INICIO_VISTA`–`HORA_FIN_VISTA`). Se recoloca sola cada 30 s. No recibe clics (`pointer-events: none`) y es decorativa (`aria-hidden`). Mes y Año no la tienen.
2. **«Tu próxima junta»** (`components/ProximaJunta.vue`, arriba de la barra de «Mi Calendario»):
   - Cuentan las juntas propias (organizas o te invitaron) que no estén canceladas ni rechazadas por ti; los bloques «Ocupado» no cuentan.
   - Si hay una en curso: «En curso · termina a las HH:mm».
   - Si no, la que empieza antes dentro de las próximas 24 h: «empieza en HH:MM:SS» con la cuenta regresiva en `ContadorRodante`.
   - Sin ninguna, la franja no aparece.
   - «Ver» abre la ficha de esa junta (la misma de un clic en el calendario).
   - Los datos se piden aparte (`GET /juntas` de hoy a mañana) porque el calendario solo carga el periodo visible; se releen al montar, al volver a la ventana, cada 5 minutos y después de guardar, borrar o responder una junta.
   - Un fallo al releer no se presenta: se conserva lo que se veía.
   - La recepcionista ve la de su propia agenda.
3. La lógica vive en `utils/proximaJunta.js` (funciones puras con el «ahora» inyectado) con pruebas en `test/proximaJunta.test.js`.

## Archivos autorizados

- `Seguimiento-proyectos/src/utils/proximaJunta.js` (nuevo)
- `Seguimiento-proyectos/src/components/ProximaJunta.vue` (nuevo)
- `Seguimiento-proyectos/src/components/CalendarioJuntas.vue`
- `Seguimiento-proyectos/src/pages/JuntasPage.vue`
- `Seguimiento-proyectos/test/proximaJunta.test.js` (nuevo)

Sin dependencias nuevas ni cambios en el backend. Usa `ContadorRodante.vue` (prueba en `experimento`, sin commit todavía).

## Notas del orquestador

- Pedido del usuario (2026-11-23) tras probar el Counter de Vue Bits; aprobó la propuesta tal cual («Sí, así»).
- Una prueba de la rebanada 26 prohíbe la palabra «encima» en el calendario (nombre de una lógica vieja): el comentario de la línea dice «sobre».

## Reporte

- Frontend: `node --test` 1850/1850 (10 nuevas), eslint limpio, build OK; los archivos nuevos pasan `prettier --check`.
- Navegador (3011 + 9012, Playwright a 1280 px y 390 px, contador `zz_test_` con una junta de prueba a las 11:50): la franja mostró «Tu próxima junta · Empieza en 00:19:42» con el segundero rodando; la línea marcó las 11:30 en la columna de hoy; «Ver» abrió la ficha; adelantando la junta, la franja pasó a «Tu junta en curso · Termina a las 12:30»; en móvil la franja se acomoda en dos renglones.
- Revisión (`reviewer`): aprobada, sin hallazgos necesarios. Se aplicaron dos opcionales: la cuenta regresiva redondea hacia arriba (nunca «00:00:00» antes de empezar; prueba nueva) y la línea se recoloca al volver a la ventana. Frontend 1851/1851.
- Opcionales sin aplicar: el odómetro rueda hacia atrás si cambia dos veces en menos de ~600 ms o si no llega `transitionend` (pestaña oculta); pasada la medianoche, una junta de las 00:xx de pasado mañana tarda hasta 5 min en aparecer; el reloj de la línea corre también en Mes y Año.
