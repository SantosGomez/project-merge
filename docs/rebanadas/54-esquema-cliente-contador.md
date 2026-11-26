# 54 — Esquema del catálogo de clientes: tabla `cliente_contador` (fase *expand*)

- **Riesgo:** alto (migración de esquema sobre una tabla con datos y llaves foráneas)
- **Implementa:** Claude (Sonnet, `implementer`)
- **Revisa:** Claude (Opus, `reviewer`, instancia nueva; no hay Fable)
- **Estado:** aprobada (Opus); implementada con la llave en CASCADE; sin commit

## Historia

Como despacho, quiero que cada cliente pueda tener varios contadores y que el catálogo de clientes deje de depender de una sola columna (`clientes.usuario_id`), para compartir un solo catálogo entre Seguimiento y Documentos. Esta rebanada solo prepara el esquema y copia los datos; nadie la usa todavía.

## Alcance

Solo base de datos (`seed.js`), pruebas del esquema y respaldo. No cambia ninguna pantalla, ruta, controlador ni modelo: el comportamiento de la app es idéntico antes y después. `clientes.usuario_id` sigue siendo la fuente de verdad hasta la rebanada 55.

## Criterios de aceptación

1. Existe la tabla `cliente_contador` (`cliente_id INT NOT NULL`, `usuario_id INT NOT NULL`, `asignado_en DATETIME NOT NULL`), con `PRIMARY KEY (cliente_id, usuario_id)`, un índice por `usuario_id` y llaves foráneas a `clientes(id)` y `usuarios(id)`, ambas con `ON DELETE CASCADE` (borrar una cuenta o un cliente solo quita la asignación). Mismo motor, charset y colación que `clientes` y `usuarios`.
2. La migración es idempotente y repetible (patrón de `migrarUnificacion()` en `seed.js`): `CREATE TABLE IF NOT EXISTS` y el relleno con `INSERT IGNORE … SELECT id, usuario_id, <ahora> FROM clientes WHERE usuario_id IS NOT NULL`. Correr el seed dos veces seguidas no falla ni duplica filas. No borra ni modifica ninguna fila de `clientes`, `usuarios` ni de las tablas que apuntan a clientes.
3. Nadie lee ni escribe `cliente_contador` todavía: sin cambios en modelos, controladores, rutas, módulo de documentos ni frontend. Un comentario en `seed.js` dice que es una copia que solo agrega y que la rebanada 55 hace el corte (con una resincronización completa).
4. **Llave `clientes.usuario_id → usuarios`: se queda en `ON DELETE CASCADE`** (decisión revisada el 2026-11-26). Se había confirmado `SET NULL`, pero la implementación mostró que la app nunca borra cuentas (solo lo hacen las pruebas y el deshacer del importador) y que con `SET NULL` cada corrida de la suite deja ~125 clientes huérfanos, porque varias pruebas dependían del `CASCADE`. La llave se retira sola cuando `usuario_id` salga en la fase de cierre (*contract*). Esta rebanada no cambia esa llave y la base de pruebas se devuelve a `CASCADE`.
5. Pruebas nuevas en `Backend/test/` (y su entrada en `MINIMOS` de `soporte-pruebas/verificarPruebas.js`), con datos `zz_test_` y 0 filas al terminar:
   - la tabla, su PK, sus índices y sus llaves foráneas con las cascadas del criterio 1;
   - el relleno copia a los clientes con `usuario_id` y omite a los que tienen NULL;
   - la migración corrida dos veces no cambia el número de filas;
   - borrar una cuenta quita sus filas de `cliente_contador`; borrar un cliente quita sus filas; la llave `fk_clientes_usuario` sigue en `CASCADE` (criterio 4).
6. **Respaldo antes de migrar:** volcado completo de `delgrow_merge` con `mariadb-dump` (o `mysqldump` de XAMPP) a una carpeta fuera del proyecto (`~/respaldos-seguimiento-proyectos/54-esquema-cliente-contador-AAAA-MM-DD.sql`), sin imprimir credenciales y sin versionar el archivo. Si no se puede respaldar, el implementer para y avisa.
7. Puertas del backend en `Backend/`: `node --test --test-concurrency=1` por archivo, `node soporte-pruebas/verificarPruebas.js` y `src/modulos/documentos/**/*.test.mjs`. Una ruta nueva no hay: no se toca `autorizacionMatriz.test.js`. Con MariaDB de XAMPP (3306); si no responde, parar y avisar.

## Archivos autorizados

- `Backend/src/utils/seed.js` (solo la migración nueva y la llamada desde donde se encadenan las migraciones)
- `Backend/test/esquemaClienteContador.test.js` (nuevo) y `Backend/soporte-pruebas/verificarPruebas.js` (`MINIMOS`)
- `Backend/soporte-pruebas/bd.js` solo si la limpieza de datos de prueba necesita cubrir `cliente_contador` (avisar antes)

Fuera de esta lista, el implementer para y pregunta. Nada de frontend.

## Notas del orquestador

- Datos medidos en la base de pruebas (2026-11-26): 156 clientes, 6 con `usuario_id` (de un solo contador), 150 sin contador. El relleno deja 6 filas.
- **No** se agrega aquí un índice único por nombre de cliente: en producción puede haber nombres repetidos entre contadores y hay que medirlo antes. Entra en la 55 con validación en la API.
- Producción (Docker, 3307) no se toca: el esquema llegará con el despliegue de la fase 5 (el seed migra). Antes de ese despliegue: respaldar `db_datos` y medir lo mismo que aquí.
- Trampas: `limpiarDatosDePrueba` y los borrados de pruebas deben tolerar la tabla nueva (las FK en cascada ya la limpian al borrar cuenta o cliente); la tubería de PowerShell daña los acentos en los volcados: hacer el volcado dentro de Bash o con redirección de archivo del propio cliente; los `.sql` nunca se versionan.
- No entra: lectura o escritura de `cliente_contador`, API del catálogo, pantallas, `cliente_id` en casos/auditorías/juntas (rebanadas 55 a 57).

---

## Reporte del implementer


## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (Opus, sin defectos que bloqueen). Detalle al final de este archivo.

## Reporte del implementer (resumen, con la corrección a CASCADE)

- Respaldo previo: `~/respaldos-seguimiento-proyectos/54-esquema-cliente-contador-2026-11-26.sql` (293 776 bytes, fuera del proyecto, sin versionar).
- `seed.js`: `migrarClienteContador()` (llamada al final de `migrarUnificacion()`): `CREATE TABLE IF NOT EXISTS cliente_contador` (PK compuesta, índice por `usuario_id`, FK a `clientes` y `usuarios` con CASCADE) e `INSERT IGNORE ... SELECT` de los clientes con `usuario_id`. La llave `fk_clientes_usuario` no se toca (sigue en CASCADE).
- Pruebas: `Backend/test/esquemaClienteContador.test.js` (6; `MINIMOS` = 6). En rojo antes: `ER_NO_SUCH_TABLE`; tras la corrección, la prueba de la llave falló con `actual 'SET NULL'` hasta devolver la base a CASCADE.
- Hallazgo: con `SET NULL` las pruebas dejaban ~125 clientes huérfanos por corrida (dependían del CASCADE). Decisión del usuario: volver a CASCADE y borrar esos 125 (borrados por el orquestador con un DELETE acotado que abortaba si el conteo no era 125).
- Puertas: `esquemaClienteContador` 6, `autorizacionMatriz` 39, `ajustes` 4, `clientes` 13, `seed` 29, `carteraActividad` 8, `tiposActividad` 13, `actividadesMes` 14, `documentosModulo` 17, `contadoresDeAuxiliar` 10, `registrosTiempo` 13, `informesTiempo` 14, documentos `.test.mjs` 305/305, `verificarPruebas.js` 88 archivos y 919 pruebas, 0 fallidas. `clientes` = 156 antes y después de la suite; 0 filas `zz_test_%`.
- Verificado por el orquestador: `fk_clientes_usuario` en CASCADE, `clientes` = 156, `cliente_contador` = 6 filas, 0 `zz_test_`; el diff de `seed.js` coincide con lo descrito.
- Trampa: en MariaDB cambiar la regla de una FK exige dos ALTER (soltar y crear); en uno solo da el error 121.

## Detalle del veredicto del reviewer (Opus)

VEREDICTO: APROBADA. Esquema real verificado (tipos, PK, índice, FK con CASCADE, InnoDB utf8mb4_general_ci); migración solo con `CREATE TABLE IF NOT EXISTS` e `INSERT IGNORE`; checksum de `clientes` idéntico tras ~15 corridas del seed; los 6 clientes con `usuario_id` (374 a 378 y 10100, del usuario 2) copiados y solo ellos; 6/6 pruebas nuevas, que fallan sin el cambio (la del criterio 4 protege contra un retroceso de la llave); nadie lee ni escribe `cliente_contador`; solo archivos autorizados; puertas del backend en verde (88 archivos, 919 pruebas, 0 fallidas); respaldo fuera del repositorio, completo y anterior a la migración; `clientes` en 156 y 0 filas `zz_test_`.

Opcionales: la prueba «borrar una cuenta» no aísla la llave `fk_cliente_contador_usuario` (la regla sí se verifica en la prueba del esquema); `MINIMOS` sin orden alfabético.

Observaciones para la rebanada 55 (no son defectos):
- `INSERT IGNORE` solo agrega: una reasignación (`clientes.mjs` ~462-467) deja al contador anterior y suma el nuevo; un cliente en NULL conserva su fila; las altas (`ClienteModel.js:96`, `clientes.mjs:250`, `importarDocumentos.js:159`) no aparecen hasta que el seed corre otra vez. El corte necesita una resincronización completa y transaccional, y escribir solo en `cliente_contador` después.
- `asignado_en` tiene la hora de la migración, no la de la asignación real.
- En producción el importador corre después del seed: los clientes importados con contador no tendrán fila hasta resincronizar.
- Hay una unicidad por contador y razón social en `clientes` (`clientes.mjs` ~475) que cambia de sentido con varios contadores; replantearla en la 55 junto con el índice por nombre pendiente.
- Consultas con contador fijo (`ClienteModel.js:128`, `WHERE id = ? AND usuario_id = ?`) pasan a JOIN o EXISTS sobre `cliente_contador`.

No verificado: causa exacta del cambio de checksum de `usuarios` (la migración no escribe ahí), restauración del respaldo, producción.
