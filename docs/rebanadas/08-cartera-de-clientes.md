# 08 — «Mi cartera de clientes» en «Mi perfil»

- **Riesgo:** medio (lógica nueva de agrupación en el frontend; sin backend ni tabla)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet, instancia nueva)
- **Estado:** refinada

## Historia

Como contador o auxiliar, quiero ver en «Mi perfil» la lista de clientes con los que trabajo y cuántos casos abiertos tengo con cada uno, para saber de un vistazo cómo está mi cartera.

## Criterios de aceptación

1. `carteraDeClientes(casos, usuarioId)` (`utils/carteraClientes.js`) toma solo los casos propios (`contador_id` igual al usuario, comparando como número) y los agrupa por cliente sin distinguir mayúsculas, acentos ni espacios de sobra («Ácme », «acme» y «ACME» son un solo cliente). Cada cliente devuelve `{ clave, nombre, abiertos, finalizados, total, importante }`: `nombre` es la forma escrita en el caso más reciente, `abiertos` cuenta Pendiente y En proceso, `importante` es true si tiene algún caso abierto marcado «Importante».
2. Orden: primero los que tienen casos abiertos (más abiertos arriba), después por nombre alfabético en español; los clientes sin casos abiertos van al final.
3. La sección «Mi cartera de clientes» de la vista muestra el total («12 clientes»; «1 cliente»), y por cliente: nombre, «n abiertos» / «Sin casos abiertos», «n finalizados» y el chip «Importante» (icono + texto) cuando aplica. Lista con `q-list`/`q-item`; con más de 8 clientes la lista tiene scroll interno (alto máximo ~420 px) y un campo «Buscar cliente» que filtra sin acentos.
4. Estados: cargando (los casos aún no llegan), error con «Reintentar», y vacío («Todavía no tienes clientes» / «Aparecerán aquí cuando registres casos.» con acción «Ir a mis casos»). Búsqueda sin resultados: «Ningún cliente coincide con "…"».
5. El texto de ayuda de la sección dice que la cartera se arma con los clientes de tus casos (no es un catálogo aparte).

## Archivos autorizados

- `Seguimiento-proyectos/src/utils/carteraClientes.js` (nuevo), `src/pages/ContadorAuxiliaresPage.vue`, `src/components/CarteraClientes.vue` (nuevo, solo si la página queda demasiado larga), pruebas nuevas en `Seguimiento-proyectos/test/`.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisión del usuario (2026-11-11): la cartera se deriva de `casos.cliente`; no hay tabla de clientes. Una cartera con clientes sin casos requeriría tabla nueva y se propondría aparte.
- Los casos salen del store `cases` (el que usa «Mis casos» / «Mi resumen»); ya trae los de los auxiliares del contador y los del dueño para el auxiliar, por eso se filtra por `contador_id`. Reutilizar la normalización sin acentos que ya exista (`filtrarContadores` u otra) antes de escribir una nueva.
- Diseño: misma tarjeta de sección que la 06, en la columna derecha debajo de «Mis auxiliares». Las cifras alineadas a la derecha con `font-variant-numeric: tabular-nums`. Solo «Importante» lleva color (regla de la voz urgente); el color nunca va solo. Los valores esperados de las pruebas son literales, no recalculados.
- **NO entra:** abrir «Mis casos» filtrado por cliente, editar el nombre del cliente, unir clientes a mano, cartera para el administrador.
- Trampas y puertas del frontend: las de la rebanada 06 (`npm run lint:check`, `npm run build`, `node --test`).

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: criterios 1 a 5, solo frontend.
2. Archivos modificados: `src/utils/carteraClientes.js` (nuevo), `test/carteraClientes.test.js` (nuevo, 6 pruebas con valores literales), `src/pages/ContadorAuxiliaresPage.vue`. No hizo falta `CarteraClientes.vue`.
3. Pruebas en rojo: un ciclo por comportamiento (agrupar, nombre y conteos, importante, orden), cada uno en rojo por el aserto.
4. Puertas: lint, build y `node --test` 1137/1137 en verde.
5. Decisiones no cubiertas: `claveDeCliente` propia (la normalización de `filtrosCasos.js` es privada y no colapsa espacios internos); «caso más reciente» = mayor `creado_en`; el buscador reutiliza `filtrarContadores`; la vista llama `cases.cargarCasos()` al montarse; la columna derecha es `perfil-page__derecha`.
6. Para la memoria: lo anterior.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet, instancia nueva), 2026-11-11, revisada junto con la 09. Resumido por el orquestador.

VEREDICTO: APROBADO

- `carteraDeClientes` compara ids como número, solo cuenta «Importante» en casos abiertos, ordena estable y no muta el store; las pruebas usan valores literales.
- `cases.cargarCasos()` desde «Mi perfil» no rompe «Mis casos» ni «Mi resumen» (guardia de versión y recarga al montarse). Puertas: lint, build y 1142/1142.

Opcional (no bloquea): pruebas de plantilla para los criterios 3 y 4; un cliente nulo se mostraría como «null» (el cliente es obligatorio); el aviso de búsqueda sin resultados con `role="status"` puede no anunciarse; indentación del bloque `perfil-page__derecha`.

## Verificación en navegador (orquestador, 2026-11-11)

Con `backend-experimento-3011` + `frontend-experimento-9012` y cuentas `zz_test_perfil_*` creadas y borradas (quedan las 12 de antes). Contador en escritorio (1280 px) y móvil (375 px): 13 casos de prueba dieron 10 clientes («Ácme Industrial», «acme industrial » y «ACME INDUSTRIAL» como uno, con 2 abiertos, 1 finalizado e «Importante»); buscador visible; sin desborde horizontal. Ajuste del orquestador: los `q-avatar` medían 15 px por un `font-size` en su clase; ahora usan las props `size` y `font-size`. No se vieron en navegador los estados vacío, de error ni la búsqueda sin resultados.
