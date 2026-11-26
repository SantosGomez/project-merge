# 53 — Propuesta del catálogo único de clientes (solo documentación)

- **Riesgo:** ninguno (no toca código ni base de datos)
- **Estado:** decidida por el usuario el 2026-11-26 (ver «Decisiones tomadas»); falta aprobar la rebanada 54
- **Sale de aquí:** las rebanadas 54 a 57 con criterios concretos

## Dónde estamos (medido el 2026-11-26 en la base de pruebas `delgrow_merge`)

| Dato | Valor |
|---|---|
| Clientes en `clientes` | 156 (todos activos) |
| Sin contador (`usuario_id` NULL), importados de documentos | 150 |
| Con contador (cartera propia de «Mis actividades») | 6, de un solo contador |
| Con clave de carpeta / con RFC | 151 / 1 |
| Nombres repetidos / RFC repetidos | 0 / 0 |
| Filas que apuntan a `clientes` | `cartera_actividad` 12, `actividades_mes` 1, `registros_tiempo` 1, `documentos` 4 |
| `casos.cliente` (texto libre) | 33 filas, 33 nombres distintos, 30 sin coincidencia exacta en el catálogo |
| `auditorias.Cliente` (texto libre) | 11 filas, 9 sin coincidencia exacta |
| `juntas.cliente` (texto libre) | 0 filas |

Es una base de pruebas: sirve para dimensionar, no para decidir. Antes de la rebanada 54 hay que medir lo mismo en producción (con respaldo previo).

## Qué está mal hoy

1. **`clientes.usuario_id` significa dos cosas.** Para «Mis actividades» es el dueño de una lista personal; para documentos es el contador (y es opcional). Una misma columna con dos reglas.
2. **La restricción `UNIQUE (usuario_id, nombre)` no protege el catálogo común.** Con `usuario_id` NULL, MariaDB permite repetir el mismo nombre sin límite. Hoy no hay repetidos, pero nada lo impide.
3. **Borrar una cuenta borra clientes.** `ON DELETE CASCADE` desde `usuarios` elimina sus clientes y, en cascada, su cartera y sus tiempos. En un catálogo compartido eso es peligroso.
4. **Dos contadores del mismo cliente hoy necesitan dos filas** (una por cada lista personal): es la raíz de los duplicados que se vendrían.
5. **Casos, auditorías y juntas guardan el cliente como texto libre**, por eso 30 de 33 casos y 9 de 11 auditorías no coinciden con el catálogo.

## Modelo propuesto

- **`clientes`: un catálogo sin dueño.** Clave, nombre, RFC, correo, teléfono, estado y fechas. `usuario_id` se conserva durante la transición (*expand*) y se retira al final (*contract*).
- **`cliente_contador`** (cliente_id, usuario_id, asignado_en; PK en las dos columnas): quién atiende a cada cliente. Un cliente puede tener varios contadores y un contador varios clientes. Se llena al inicio con los 6 que hoy tienen `usuario_id`.
- **«Mi cartera» y «Mis actividades»** pasan a leer los clientes asignados al contador en `cliente_contador`, en lugar de `clientes.usuario_id`. Por verificar en la 54: cómo se relacionan `cartera_actividad` y `actividades_mes` con el contador (los tipos de actividad siguen siendo por persona).
- **Borrar una cuenta no borra clientes:** se quitan solo sus filas de `cliente_contador`.
- **`casos`, `auditorias` y `juntas`:** columna nueva `cliente_id INT NULL` con índice. El texto libre se conserva mientras haya filas sin mapear. La clave foránea y el `NOT NULL` solo llegan al final, cuando el 100 % esté mapeado.
- **Pantalla:** el formulario de caso, auditoría y junta cambia el texto libre por un selector con búsqueda sobre el catálogo (con «Cliente nuevo» solo para quien pueda crear).
- **Catálogos fijos** (`Dependencia`, `TipoAud`) y renombrado a `snake_case`: se descartan por ahora; el costo supera el beneficio.

## Decisiones tomadas (2026-11-26)

1. **Alta de clientes:** administrador, sistemas y recepcionista, en Ajustes. El contador elige del catálogo y pide el alta si falta.
2. **Varios contadores por cliente:** sí (`cliente_contador`, muchos a muchos).
3. **Casos y auditorías sin coincidencia:** mapeo asistido por pantalla; nunca automático.
4. **Fusión de duplicados:** no se construye ahora (0 repetidos en 156); entra solo si el mapeo la pide.
5. **Clave y RFC:** la clave es obligatoria al dar de alta, el RFC no.

## Decisiones que se pidieron al usuario (texto original)

1. **¿Quién da de alta clientes?** Hoy el contador crea los suyos en «Mis actividades» y la recepcionista no puede. Recomendación: administrador, sistemas y recepcionista (en Ajustes); el contador elige del catálogo y pide el alta.
2. **¿Un cliente puede tener varios contadores?** Recomendación: sí.
3. **Los 30 casos y 9 auditorías sin coincidencia:** ¿se da de alta el cliente que falte, o se deja `cliente_id` vacío con el texto original? Recomendación: mapeo asistido por pantalla (se propone la coincidencia más parecida y una persona confirma), nunca automático.
4. **¿Hace falta una herramienta de fusión de duplicados?** Hoy no hay repetidos (0 de 156). Recomendación: no construirla ahora; entra solo si el mapeo de casos y auditorías la pide.
5. **Clave de carpeta y RFC:** 5 clientes no tienen clave y 155 no tienen RFC. ¿Son obligatorios al dar de alta? Recomendación: la clave sí (la usan las carpetas de documentos), el RFC no.

## Rebanadas que salen de esta propuesta (una a la vez, en serie)

| # | Rebanada | Riesgo | Revisa |
|---|---|---|---|
| 54 | Esquema *expand*: `cliente_contador` con relleno desde `usuario_id`, sin quitar nada; todo idempotente en `seed.js` | Alto | Opus |
| 55 | API del catálogo (alta, edición, estado, asignación de contadores) y permisos por rol | Alto | Opus |
| 56 | Pestaña «Clientes» de Ajustes completa (alta, edición, asignar contadores) y «Mi cartera» leyendo `cliente_contador` | Medio | Sonnet |
| 57 | `cliente_id` en `casos`, `auditorias` y `juntas` + selector con búsqueda + mapeo asistido | Alto | Opus |
| 58 | Firmas en Base64 a archivos (independiente de las anteriores) | Alto | Opus |

## Riesgos

- Cambiar a qué se refiere `usuario_id` afecta «Mis actividades», la cartera y los informes de tiempo: se necesita una prueba que fije el comportamiento actual antes de la 54.
- La base de producción puede traer cientos de clientes por contador y nombres repetidos: medir antes de tocar.
- Los avisos y cascadas de `ON DELETE` se revisan tabla por tabla antes de cambiar nada.
- Todo respaldo de `db_datos` y del volumen de adjuntos antes de producción (ver `docs/seguridad-despliegue.md`).
