# 55a — Corte a `cliente_contador`, parte 1: escrituras y modelo

- **Riesgo:** alto (toca el alta y la edición de clientes en Seguimiento y en Documentos, y el importador)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada (Opus); sin commit

## Contexto

La 55 original se detuvo en el inventario: 16 lugares leen o escriben `clientes.usuario_id` (6 de Seguimiento, 8 de Documentos y 2 del importador). Se divide en **escrituras primero** (esta) y **lecturas después** (55b), para que el invariante valga siempre: mientras las lecturas siguen usando `usuario_id`, esa columna queda sincronizada como «contador principal» y nada cambia a la vista.

Corrección al documento anterior: `ActividadMesModel`, `InformeTiempoModel`, `RegistroTiempoModel` y `TipoActividadModel` filtran por el `usuario_id` de sus propias tablas (no el de `clientes`): no hay nada que cambiar en ellos.

## Historia

Como despacho, quiero que toda alta y edición de clientes (en Mis actividades, en Documentos y en el importador) mantenga la tabla `cliente_contador` al día desde un solo punto, para poder asignar varios contadores sin filas viejas ni columnas desincronizadas.

## Criterios de aceptación

1. **Modelo único** `Backend/src/models/ClienteContadorModel.js` (CommonJS, usable también desde los `.mjs` de documentos, por ejemplo recibiendo una función `ejecutar(sql, params)` o una conexión): `contadoresDe(clienteId)`, `principalDe(clienteId)`, `reemplazarContadores(clienteId, usuarioIds)`, `agregarContador(clienteId, usuarioId)` y `quitarContador(clienteId, usuarioId)`. Cada escritura cambia `cliente_contador` y `clientes.usuario_id` **en una transacción** (con *rollback* completo si falla a la mitad).
2. **Invariante:** para todo cliente, `clientes.usuario_id` es NULL si no tiene filas en `cliente_contador`, o es el **principal** (menor `asignado_en`; a igualdad, menor `usuario_id`). `asignado_en` de una fila nueva es la hora de la asignación.
3. **Escrituras que pasan por el modelo** (puntos del inventario): `ClienteModel.crear` (alta de «Mis actividades», `INSERT … usuario_id`); alta y edición de clientes de Documentos en `clientes.mjs` (`POST` y `PATCH /doc/clientes`: siguen recibiendo un solo `contadorId`, que fija el conjunto en `[contadorId]`, o vacío si es null); el importador `importarDocumentos.js` al insertar o ligar clientes con contador, y `--deshacer` sin dejar filas sueltas (comprobar las cascadas).
4. **Sin cambios visibles:** las lecturas, las respuestas de la API y el frontend quedan igual (las respuestas aún no incluyen `contadores`: eso es la 55b). `ClienteModel.actualizar` (`WHERE … usuario_id`) y todas las lecturas se quedan como están.
5. **Seed:** se conserva solo el `INSERT IGNORE` de la 54. **No** se agrega una resincronización que borre filas de `cliente_contador` (borraría asignaciones múltiples cuando existan).
6. **Pruebas** (datos `zz_test_`, 0 filas al terminar y `clientes` en 156): modelo (invariante en alta, reemplazo, agregar, quitar, principal con varios contadores, *rollback*); `crear` de Mis actividades deja su fila; alta y edición de documentos dejan el conjunto en `[contadorId]` o vacío; el importador y su `--deshacer`. Las pruebas existentes pasan **sin relajar asertos**; si una debe cambiar, el implementer lo reporta y explica por qué. Las pruebas que ya escriben `clientes.usuario_id` a mano pueden dejar la fila sin pareja: eso lo ajusta la 55b, no esta.
7. **Respaldo:** ya existe el de esta tanda (`~/respaldos-seguimiento-proyectos/55-corte-cliente-contador-2026-11-26.sql`, 296 181 bytes); no hace falta repetirlo.
8. **Puertas** en `Backend/`: `node --test --test-concurrency=1` por archivo (modelo nuevo, `esquemaClienteContador`, `clientes`, `carteraActividad`, `tiposActividad`, `actividadesMes`, `registrosTiempo`, `informesTiempo`, `ajustes`, `autorizacionMatriz`, `seed`, `documentosModulo`, `unificacion`, `contadoresDeAuxiliar`), `src/modulos/documentos/**/*.test.mjs` y `node soporte-pruebas/verificarPruebas.js`. Después de las pruebas, en el navegador con cuentas `zz_test_` (contador y administrador): crear un cliente en «Mis actividades», y crear y editar uno en «Clientes» de documentos, comprobando en la base (SELECT) que `cliente_contador` y `usuario_id` coinciden. `clientes` en 156 y 0 filas `zz_test_%` al terminar.

## Archivos autorizados

- Nuevo: `Backend/src/models/ClienteContadorModel.js`, su prueba en `Backend/test/` y su entrada en `MINIMOS` de `soporte-pruebas/verificarPruebas.js`.
- `Backend/src/models/ClienteModel.js` (solo `crear`), `Backend/src/modulos/documentos/rutas/clientes.mjs` (solo alta y edición) y `Backend/src/utils/importarDocumentos.js`.
- Sus pruebas: `Backend/test/clientes.test.js`, `unificacion.test.js` y `src/modulos/documentos/rutas/clientes.test.mjs`, solo para cubrir lo nuevo y reportando cada cambio.

Nada de frontend, rutas, permisos ni lecturas. Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Lo que viene en la **55b**: lecturas y la respuesta `contadores`.
- Trampas: `db.js` solo acepta parámetros primitivos; las pruebas del backend van en serie y por archivo; el navegador solo después de las pruebas (`limpiarDatosDePrueba` borra avisos con `zz_test_`); `clientes` con `usuario_id` NULL no se borran en cascada: las pruebas deben limpiarse por nombre `zz_test_%`.

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Opus, sin hallazgos que bloqueen). Detalle al final de este archivo.

## Reporte del implementer (resumen)

- **Modelo nuevo** `Backend/src/models/ClienteContadorModel.js` (CommonJS; `contadoresDe`, `principalDe`, `reemplazarContadores`, `agregarContador`, `quitarContador`, `enTransaccionDePool`): cada función acepta al final una función `ejecutar` ligada a la transacción de quien llama; sin ella abre la suya. `asignado_en` = `NOW()` en filas nuevas. Usa `ON DUPLICATE KEY UPDATE` y no `INSERT IGNORE` para que un error de llave foránea provoque rollback.
- **Escrituras:** `ClienteModel.crear` (INSERT + `agregarContador` en transacción; conserva `usuario_id` para la unicidad y el 409); `clientes.mjs` alta y edición (INSERT/UPDATE + `reemplazarContadores(id, [contadorId] o [])` en transacción; el UPDATE va antes del modelo para evitar un falso 409; el modelo se carga con `createRequire`); `importarDocumentos.js` (al ligar un cliente con contador asegura su fila; `--deshacer` igual, las cascadas limpian).
- **Pruebas:** nueva `test/clienteContadorModel.test.js` (13); `clientes.test.js` +1 (14); `unificacion.test.js` +1 y asertos nuevos en «deshacer» (19); `clientes.test.mjs` +4 (309/309 en documentos); `MINIMOS` actualizado. En rojo antes: módulo inexistente, sin SQL sobre `cliente_contador`, sin fila tras el alta o el ligado.
- **Un cambio a una prueba existente:** en `clientes.test.mjs` el doble `poolEdicion` detectaba el UPDATE con `sql.includes('UPDATE clientes')`; el UPDATE de sincronización del modelo también lo contiene, y se cambió a `sql.includes('UPDATE clientes') && sql.includes('SET clave')`. Ningún aserto cambió.
- **Puertas:** 15 archivos del backend en verde por archivo, documentos 309/309, `verificarPruebas.js` 89 archivos y 934 pruebas (mínimo 835), 0 fallidas. Navegador (cuentas `zz_test_`): Mis actividades lista y agrega clientes; «Clientes» de documentos 158 con los 2 de prueba; ficha y «Editar» guardan conservando el contador; alta de documentos por API (201) y PATCH con contador null (200); `cliente_contador` y `usuario_id` coinciden. `clientes` 156 → 156 y `cliente_contador` 6 → 6; 0 filas incoherentes; 0 `zz_test_%`.
- **Decisiones del implementer:** los INSERT y UPDATE siguen escribiendo `usuario_id = contadorId` (por la unicidad `(usuario_id, nombre)` y las pruebas existentes) y el modelo lo deja igual; con `reemplazarContadores([x, y])` en la misma asignación el principal es el de menor `usuario_id` (relevante para la 56); las pruebas que escriben `usuario_id` a mano (`documentosModulo`, `ajustes`, `esquemaClienteContador`, `documentos.test.mjs`) siguen dejando clientes sin fila pareja y se ajustan en la 55b.
- Verificado por el orquestador: `clientes` 156, `cliente_contador` 6, 0 `zz_test_`, llave en CASCADE; el árbol solo tiene archivos autorizados.

## Detalle del veredicto del reviewer (Opus)

VEREDICTO: APROBADA. Verificado: el invariante en agregar, quitar y reemplazar (`sincronizarPrincipal` ordena por `asignado_en ASC, usuario_id ASC`); `ON DUPLICATE KEY UPDATE` no pisa `asignado_en`; transacciones con commit, rollback y `release` en `finally`, sin anidar y sin fugas; ids y listas `IN` con parámetros primitivos; `ClienteModel.crear` y alta/edición de documentos con el UPDATE antes del modelo (sin falso 409); importador y `--deshacer` sin filas sueltas; seed sin cambios; el único cambio a una prueba existente (`clientes.test.mjs:124`) es legítimo y no relaja asertos; las pruebas nuevas fallan contra HEAD; solo archivos autorizados; base: `clientes` 156, `cliente_contador` 6, 0 incoherencias, 0 `zz_test_%`, llaves en CASCADE; puertas del backend en verde (89 archivos, 934 pruebas, 0 fallidas, documentos 309/309).

Opcionales: `enTransaccionDePool` no llama a `validarParametros` como `conTransaccion` (hoy sin riesgo); la segunda mitad de la prueba del 409 pasaría también sin transacción (el rollback ya está cubierto en `clienteContadorModel.test.js`).

Observaciones para la 55b y la 56 (también anotadas en la 55b):
- **Empates de `asignado_en`:** `DATETIME` sin fracciones; dos contadores en el mismo segundo, o en un solo `reemplazarContadores([x, y])`, dejan como principal al de menor `usuario_id` aunque haya llegado después. En la 56, usar `DATETIME(3)` o fijar explícitamente el orden del principal.
- **`uq_clientes_usuario_nombre`:** `sincronizarPrincipal` reescribe `usuario_id`; con varios contadores, quitar al principal o promover a otro puede chocar con esa unicidad (`ER_DUP_ENTRY` y rollback). La 56 tiene que replantearla.
- **CASCADE de `fk_clientes_usuario`:** con varios contadores, borrar la cuenta del principal borra el cliente entero.
- **Edición desde Documentos:** fija el conjunto en `[contadorId]` y borra a los demás contadores; la 56 debe cambiarlo antes de exponer la asignación múltiple.
- **Doble escritura de `usuario_id`:** si alguien lo escribe sin pasar por el modelo, se desincroniza; las pruebas que lo escriben a mano (`documentosModulo`, `ajustes`, `esquemaClienteContador`, `documentos.test.mjs`) se ajustan en la 55b.

No verificado: navegador (por instrucción del reviewer; el implementer sí lo probó), restauración del respaldo, producción.
