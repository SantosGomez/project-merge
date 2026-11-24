# Plan: unir status-conta y Proyecto-documentos

**Objetivo:** un solo sistema para el despacho, con un solo login, una sola base de datos y varios módulos.

- **Base:** `status-conta` (ya publicado en Docker). Recepción de documentos entra como un módulo más.
- **Selector de módulos:** al entrar, el usuario ve tarjetas con los módulos que tiene permitidos (por ejemplo "Seguimiento contable" y "Recepción de documentos"). Arriba de la pantalla hay un botón para cambiar de módulo sin volver a iniciar sesión. Si alguien tiene permiso para un solo módulo, se salta el selector y entra directo.
- **Datos:** los usuarios y los clientes son los mismos en los dos sistemas.
- **Portal de clientes:** queda para después. Primero tiene que funcionar todo y luego se agregan funciones poco a poco.

## Diferencias entre los dos proyectos

| | status-conta | Proyecto-documentos |
|---|---|---|
| Servidor | Express | `node:http` sin framework |
| Sesión | JWT | Cookie firmada |
| Contraseñas | argon2 | scrypt (`node:crypto`) |
| Roles | Lista fija en `usuarios.rol` (administrador, contador, usuarios_de_sistema, auxiliar, recepcionista) | Tabla `roles` (Administrador, Contador, Recepcionista, Cliente, Practicante, Sistemas) |
| Usuario | `correo`, `password_hash` | `usuario` + `email`, `password`, `firma_path`, `activo`, `cliente_id` |
| Clientes | Cada cliente pertenece a un usuario (`usuario_id`, `nombre`, `rfc`) | `clave`, `rfc`, `razon_social`, `contador_id`, `estado` |
| Frontend | Vue 3 + Quasar (`Seguimiento-proyectos`) | Vue 3 + Quasar + Vite (`Frontend`) |

---

## Fase 0: Preparación (no toca producción) ✅ 2026-11-24
- [x] Respaldar completas las dos bases de datos (en Docker y en desarrollo). Están en `respaldos/` junto con los archivos subidos de documentos (`storage`). Esa carpeta no entra a git.
- [x] Copiar status-conta a esta carpeta (Proyecto-Merge) con todo su historial de git. El remoto se llama `status-conta` y apunta a la carpeta local. El trabajo va en la rama `unificacion/fase-0`.
- [x] Sacar las listas de usuarios y de clientes de los dos sistemas y compararlas. El detalle con nombres está en `respaldos/fase0/comparacion.md`.

### Lo que encontramos en la fase 0

**Usuarios** (36 en status-conta y 42 en documentos)
- 33 coinciden por correo. Ninguno tiene el mismo nombre con otro correo.
- 3 están solo en status-conta: 2 administradores y 1 contador. Se quedan como están.
- 9 están solo en documentos: 8 son cuentas de prueba (`test`, `ejemplo.com`, etc.) que **no se migran**, y 1 es un practicante real que sí se migra.
- 18 de los 33 tienen un rol diferente en cada sistema:
  - `usuarios_de_sistema` ↔ `Sistemas` (4): es el mismo rol con otro nombre.
  - `auxiliar` ↔ `Contador` (8) y `auxiliar` ↔ `Practicante` (6): ⚠️ **hay que decidir qué rol queda.** Propuesta: guardar un solo rol, y que el permiso para entrar al módulo de documentos salga de `usuario_modulos`.

**Clientes** (8 en status-conta y 151 en documentos)
- Los 8 de status-conta son del mismo contador. 5 coinciden por nombre con documentos (no por RFC) y 3 no existen en documentos: se agregan.
- En documentos, 150 de 151 clientes no tienen RFC y ninguno tiene contador asignado. La tabla unida usa la `clave` y la razón social; el RFC y el contador se llenan después.
- El cliente 1 de documentos ("Cliente Test") es de prueba y no se migra.
- ⚠️ La tabla `casos` de status-conta (49 registros) guarda el cliente como **texto libre**, sin ligarlo a `clientes`. Hay que decidir si en la fase 1 se liga o si sigue como texto.
- `cartera_actividad`, `actividades_mes` y `registros_tiempo` sí se ligan a `clientes.id`, pero casi no tienen datos (1, 1 y 2 registros). Cambiar la tabla de clientes es menos riesgoso de lo que pensábamos.

## Fase 1: Una sola base de datos ✅ 2026-11-24 (probada en copia, falta producción)
El esquema lo agrega `migrarUnificacion()` en `Backend/src/utils/seed.js`. Corre solo al arrancar el backend, como las demás migraciones de status-conta, se puede repetir y no borra datos. Los datos los trae `Backend/src/utils/importarDocumentos.js`. Las pruebas están en `Backend/test/unificacion.test.js`.
- [x] **Tablas de documentos:** `empresas`, `departamentos`, `tipos_documento`, `documentos`, `documento_archivos`, `documento_historial`, `cliente_doc_requeridos` y `contador_folio`, con el mismo esquema que tenían allá. Los catálogos (2 empresas, 4 departamentos y 5 tipos de documento) se siembran si están vacíos.
- [x] **Usuarios:** se juntan por correo. Se agregó `usuarios.alias`, que es el nombre corto con el que entraban a documentos. No se llama `usuario` porque una migración vieja de status-conta borra cualquier columna con ese nombre.
- [x] **Roles (lo que acordamos):** cada persona conserva **un solo rol general**, el de status-conta. Su rol dentro del módulo de documentos (contador, practicante, sistemas…) se guarda en `usuario_modulos.rol`. No hizo falta agregar roles al ENUM de `usuarios`.
- [x] **Permisos:** la tabla `usuario_modulos` (usuario, módulo, rol dentro del módulo). Toda cuenta que no tenga ningún módulo recibe `seguimiento`.
- [x] **Clientes:** un solo catálogo. `usuario_id` (el contador) ahora es opcional, y se agregaron `clave`, `email` y `telefono`. Las pantallas actuales de status-conta siguen viendo solo los clientes de cada contador, así que no cambian.
- [x] **Importar y deshacer:** con `node src/utils/importarDocumentos.js` se importa y con `--deshacer` se revierte. Cada fila queda en `unificacion_mapa`, así que correrlo dos veces no duplica nada.
- [x] **Probado en una copia:** la base de prueba es el contenedor `merge-prueba-db` en el puerto 3308, con los respaldos de la fase 0 cargados. Resultados:
  - **Usuarios:** 33 se ligaron, 1 se insertó (el practicante que solo estaba en documentos) y 8 de prueba se omitieron.
  - **Clientes:** 5 se ligaron, 145 se insertaron y 1 de prueba se omitió.
  - Deshacer deja la base como estaba. Al volver a importar sale lo mismo.
- [x] **Pruebas del backend:** 877 en total, con 15 nuevas. Las 2 que fallan ya fallaban antes de los cambios, por cosas de la base de prueba: la zona horaria y la tabla `usuarios_respaldo_5c`, que nunca existió en producción.

**Lo que se decidió no hacer en esta fase:**
- **Documentos:** no se importan. Los 24 que hay en la base de desarrollo son de prueba (todos registrados por cuentas de prueba, y 22 de ellos del "Cliente Test"). El folio empieza de nuevo.
- **`firma_path` y `activo` en usuarios:** se agregan en la fase 2 o 3, cuando el código los use.
- **`cliente_id` y el rol cliente:** se agregan cuando llegue el portal.
- **Llave de `clientes` → `usuarios`:** sigue con borrado en cascada. La app nunca borra usuarios, así que no afecta. Si algún día se borra un contador, sus clientes se irían con él; conviene cambiarla a `SET NULL` en la fase 3.

**Pendientes para decidir:**
- [x] **Administradores en documentos (decidido el 2026-11-24): sí, automáticamente.** `modulosDeUsuario()` en `Backend/src/models/UsuarioModuloModel.js` le da a todo administrador el módulo de documentos con rol administrador, aunque no esté en `usuario_modulos`. Es una regla por rol, no una fila en la tabla: un administrador nuevo lo tiene desde el primer momento y, si deja de ser administrador, lo pierde. Si la tabla le da otro rol en documentos, gana la tabla. El login de la fase 2 usará esta función.
- [ ] **Casos:** ¿se ligan a `clientes.id` o siguen guardando el cliente como texto? Se puede decidir más adelante, no detiene nada.
- [ ] **Importación en producción (fase 5):** hay que apuntar `DOCS_DB_*` a la base de XAMPP (`dca_documentos`) y correr el import una sola vez, después de arrancar el backend nuevo.

## Fase 2: Un solo login ✅ 2026-11-24
- [x] Se queda el login de status-conta (Express, JWT y argon2), en el mismo `POST /auth/login`.
- [x] **Contraseñas:** `verifyPassword` (`Backend/src/utils/passwordUtils.js`) acepta argon2 y también el formato de documentos (`scrypt$N$sal$hash`). Al entrar con una contraseña scrypt, se vuelve a guardar en argon2. Nadie tiene que cambiar su contraseña. Lo comprobé con contraseñas generadas por el código real de Proyecto-documentos. Un hash roto da 401 en vez de error del servidor.
- [x] **Correo o alias:** el campo `correo` del login acepta las dos cosas. Si lleva @ se busca por correo; si no, por alias, sin importar mayúsculas ni espacios. La pantalla de login ahora dice "Correo o usuario".
- [x] **Módulos:** el login y `GET /auth/perfil` devuelven `modulos: [{ modulo, rol }]`.
- [x] **Cuentas nuevas:** toda cuenta que se crea nace con el módulo de seguimiento (`UserModel.create`).
- [x] **Pruebas:** `Backend/test/loginUnico.test.js` (8). Backend: 886 pruebas, y fallan solo las 2 de siempre por la base de prueba. Frontend: 1873 de 1873.

**Notas:**
- El frontend todavía no guarda `modulos` en la sesión. Lo hará la fase 4, cuando exista el selector de módulos.
- El límite de intentos fallidos cuenta por separado el correo y el alias de una misma persona. Es un detalle menor.
- La pantalla de login cambió de texto, pero no la revisé en el navegador.
- `npm run lint:check` del frontend no detecta problemas de formato, porque le falta `--check` a prettier (el mismo error que ya se corrigió en documentos). Hay archivos con formato pendiente desde antes de la unión.

## Fase 3: Pasar el backend de documentos a status-conta
- [ ] Las rutas de `Proyecto-documentos/Backend/src/rutas` pasan a Express con la misma estructura de status-conta: `documentoRoutes`, `documentoController` y `documentoModel`.
- [ ] La lógica que no depende del servidor se copia casi igual: `semaforo`, `folio`, `estadosDocumento`, `cumplimiento`, `validacion`, etc. Sus pruebas también se pasan.
- [ ] **Archivos subidos:** el contenedor del backend es de solo lectura, así que se necesita un volumen de Docker para guardar las firmas y los PDF. ⚠️ Si no se hace, se pierden los archivos.

## Fase 4: Pasar el frontend y armar el portal
- [ ] Crear la pantalla para elegir módulo y el botón para cambiarlo.
- [ ] Pasar las pantallas de documentos a `Seguimiento-proyectos/src/pages/documentos/`: Dashboard, Clientes, Recepción (`IndexPage`) y Direccionamiento.
- [ ] Juntar `UsersPage` con el directorio de usuarios que ya existe.
- [ ] Juntar los estilos (colores y tipografía) para que se vean como una sola app.
- [ ] Pasar `SeguimientoPage` (el portal del cliente), pero dejarla apagada.

## Fase 5: Probar y publicar
- [ ] Probar con una copia de los datos reales, con cada rol y en los dos módulos.
- [ ] Publicar en una ventana de mantenimiento: respaldo, migración, nuevo build en Docker y revisión.
- [ ] Dejar Proyecto-documentos solo de consulta un tiempo y después archivarlo.

## Fase 6 en adelante: poco a poco
- [ ] Activar el portal para clientes.
- [ ] Agregar módulos nuevos usando el mismo selector.

---

## Riesgos principales
1. Juntar la tabla de clientes sin romper los casos y actividades actuales.
2. No perder los archivos subidos cuando entren al contenedor (volumen de Docker).
3. Los usuarios que no coincidan por correo.
