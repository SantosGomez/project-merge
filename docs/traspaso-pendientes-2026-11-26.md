# Traspaso de pendientes (2026-11-26)

Para continuar con **Antigravity** u **opencode** (o con otra sesión de Claude Code) lo que quedó a medias. Léelo junto con `AGENTS.md`, `MEMORY.md`, `docs/flujo-agentes.md` y los archivos de `docs/rebanadas/` que se citan. Todo lo hecho está explicado en esos archivos; este documento solo dice **dónde quedó el trabajo y qué sigue**.

> Nota de seguridad: este archivo no contiene claves ni datos personales. Los respaldos de la base están **fuera del proyecto** (`~/respaldos-seguimiento-proyectos/`) y los `.sql` nunca se versionan.

---

## 0. Estado final de esta sesión (lo más reciente)

- Rama `unificacion/fase-0`, remoto `SantosGomez/project-merge`. Al terminar la sesión se hizo **commit y push de todo lo trabajado**: rebanadas 52 a 56c. Después de eso el árbol queda limpio.
- **Rebanadas hechas y revisadas** (cada una con su archivo y su veredicto en `docs/rebanadas/`): 52, 52b (Ajustes), 53 (propuesta), 54 (tabla `cliente_contador`), 55a y 55b (corte a `cliente_contador`), 56a (API del catálogo), 56b (vincular clientes a la cartera propia), 56c (pestaña «Clientes» de Ajustes completa; Opus pidió un cambio menor, ya aplicado).
- **No se hizo nada de la 56d en adelante.** La 56d todavía **no está refinada ni aprobada** por el usuario: hay que refinarla con él antes de implementarla (ver 2.2).
- Costo de referencia: una rebanada del tamaño de la 56c costó del orden de **500 000 tokens** entre el implementer (Sonnet) y el reviewer (Opus), más lo que gasta el orquestador. La 56d es de ese tamaño o mayor: no empezarla con poco límite disponible.
- Base de pruebas `delgrow_merge` (MariaDB de XAMPP, 3306) al cierre: `clientes` = 156, `cliente_contador` = 6, 0 filas `zz_test_%`, `fk_clientes_usuario` en CASCADE, `uq_clientes_nombre` creado, `cliente_contador.asignado_en` en `DATETIME(3)`.
- Respaldos (fuera del proyecto, `~/respaldos-seguimiento-proyectos/`, un `.sql` por rebanada): `54-…`, `55-…`, `56a-…`, `56b-…` y `56c-ajustes-clientes-20261126-1613.sql`. Antes de cada rebanada nueva que toque la base, hacer uno nuevo (los anteriores no sirven si cambiaron datos).
- **Prueba rota que NO es de estas rebanadas:** `Seguimiento-proyectos/test/selectorModulos.test.js`, «el CSS usa solo variables de la paleta que existen…», falla porque `ModulosPage.vue` usa `var(--dg-texto-oscuro)` (líneas ~703 y ~741), una variable que no existe. Viene de la tarjeta de perfil del usuario. Corregir aparte, con el usuario (cambiar esas dos líneas por una variable de la paleta); mientras tanto `node --test` del frontend da 2300 de 2301.
- Trampas descubiertas hoy: `Backend/.env` repite `DB_HOST` (para el `mysqldump` usar solo la primera aparición; el primer intento salió vacío); editar un `.vue` con un diálogo abierto en el navegador dispara HMR y borra lo escrito; un heredoc de bash convirtió `\b` en el byte 0x08 en una prueba (usar `Write` o `Edit`, no heredocs, para texto con barras invertidas); el `ALTER` de una llave foránea en MariaDB exige dos sentencias.
- Cosas que dijo el implementer de la 56c y conviene recordar: la clave solo es obligatoria al **editar** si el cliente ya tenía una (muchos de los 156 no la tienen); para cambiar al principal de un cliente se quitan y se vuelven a elegir sus contadores (no hay reordenar); `GET /ajustes/contadores` devuelve también `contador_documentos`.

---

## 2. Lo que sigue, en orden

### 2.1 (HECHA) Rebanada 56c: pestaña «Clientes» de Ajustes completa
Documento: `docs/rebanadas/56c-ajustes-clientes-completa.md` (**aprobada por el usuario**; riesgo alto; implementa Sonnet, revisa Opus).
- Backend (parece empezado): `email` y `telefono` en `GET /ajustes/clientes`, la recepcionista con `requireAltaClientes` en esa ruta, y `GET /ajustes/contadores` (cuentas que pueden llevar clientes según `puedeLlevarClientes`), con filas en `autorizacionMatriz.test.js`.
- Frontend (pendiente): `ClienteCatalogoDialog.vue` (alta y edición de datos) y `ContadoresClienteDialog.vue` (selección múltiple; el primero es el principal; avisa si el principal no tiene rol Contador en Documentos), acciones por fila (editar datos, contadores, activar o desactivar con confirmación), «Nuevo cliente», columna «Contador» con «+N», errores junto al campo, y `ajustesService.js` con `crearCliente`, `editarCliente`, `reemplazarContadores` y `listarContadoresElegibles`. La recepcionista ve la lista (solo lectura) y «Nuevo cliente», sin las acciones de edición.
- Después: respaldo, pruebas del backend (por archivo, en serie), pruebas y lint del frontend, **navegador real con tres cuentas `zz_test_`** (administrador, sistemas y recepcionista; escritorio, 375 y 320 px), revisión con un reviewer de modelo grande, `MEMORY.md` y commit.

### 2.2 Rebanada 56d (por refinar con el usuario antes de implementar)
Frontend, riesgo alto. **Cierra la restricción de seguridad de la 56b** (ver 3).
- «Mi perfil» (contador y auxiliar): «Mi cartera de clientes» deja de armarse con el texto de los casos (rebanada 08, `utils/carteraClientes.js`) y pasa a ser la del catálogo con `GET /clientes/mi-cartera`; botón «Vincular clientes» (buscador con `GET /clientes/catalogo` y `POST /clientes/vinculos`) y «Quitar de mi cartera» (`DELETE /clientes/vinculos/:clienteId`, solo el vínculo propio; avisar que un cliente inactivo no se puede volver a vincular). Las cifras de casos por cliente se calculan por coincidencia de nombre hasta la 57.
- Documentos: quitar «Editar» y «Nuevo cliente» de Clientes (la ficha queda de solo lectura con un aviso de que los cambios se hacen en Ajustes). **La edición y el alta de clientes son exclusivas de Ajustes.**
- «Mis actividades»: el contador deja de crear, editar y desactivar clientes (lista de solo lectura con un texto que dice que lo pida a administración).
- Retirar las rutas viejas: `PATCH` y `POST /doc/clientes`, y `POST` y `PATCH /clientes` de Seguimiento. Antes comprobar que nada del frontend las use (`servicios/cliente.js` de Documentos, `clienteService`/`tipoActividadService` de «Mis actividades»). Con ellas desaparecen los mensajes 409 engañosos de «Mis actividades» y de Documentos.
- Pendiente de decisión: cómo avisa la UI cuando el principal de un cliente no tiene rol Contador en Documentos.

### 2.3 Rebanada 56e (producción)
Antes de publicar la fase 5: **fusionar nombres de cliente repetidos** con script de vista previa (propone cuál se queda —el que tenga documentos, clave o sea más antiguo—, mueve sus referencias y borra el sobrante solo si el usuario aprueba cada grupo) y resolver el orden entre el índice único `uq_clientes_nombre` (lo crea el seed al arrancar si no hay repetidos) y el importador `importarDocumentos.js` (si `dca_documentos` trae razones sociales repetidas, el `INSERT` da `ER_DUP_ENTRY` y se cancela la importación entera: importar antes del índice o ligar y consolidar en el importador). Antes de cualquier cosa en producción: contar repetidos allá en solo lectura (con permiso del usuario) y respaldar `db_datos` y el volumen `adjuntos`.

### 2.4 Rebanada 57
`cliente_id` en `casos`, `auditorias` y `juntas` (columna nueva `INT NULL` con índice, FK al final), selector con búsqueda en los formularios y **mapeo asistido** de los casos y auditorías que no coinciden con el catálogo (30 de 33 casos y 9 de 11 auditorías en la base de pruebas; nunca automático; no hay herramienta de fusión). Patrón *expand and contract*: el texto libre se conserva hasta mapear todo.

### 2.5 Rebanada 58
Firmas en Base64 de `documentos` (`firma_cliente`, `firma_recep`, `firma_contador_recep`, `firma_contador`, `LONGTEXT`) a archivos `.png` en el volumen de adjuntos, guardando solo la ruta; script de migración único y cambio de los endpoints de Recepción, Direccionamiento y del acuse en PDF. Independiente de lo anterior. Origen: análisis de Gemini en `Downloads` (solo esta parte y `cliente_id` resultaron valiosas; su premisa de «sin llaves primarias ni foráneas» es falsa para el seed).

### 2.6 Otros pendientes menores (opcionales)
- Opcionales del reviewer de la 52b (`/ajustes` sin `meta.comun`, `session.variosModulos` sin uso, etiqueta «Fijar menú abierto» en celular) y de la 55a, 55b y 56a/56b (pruebas que pasan sin el cambio: `clientesCartera.test.js:172` y `:418`, interbloqueo teórico entre `reemplazarContadores` y vincular al tomar los bloqueos en distinto orden, `leerClienteIds` acepta cadenas numéricas).
- Carrera del router tras «Acceso denegado» (`router/index.js` ~296 y `JuntasPage.vue` ~596): puede dejar a un usuario en `/juntas`. Ya existía antes.
- Cuentas de contador o auxiliar con rol Administrador en Documentos pierden «Acceso a módulos» (hoy 0 cuentas así).
- La falla intermitente de `verificarPruebas.js` (2 veces): ver 5.

## 3. Reglas que no hay que olvidar

- **No publicar la 56b sin la 56d.** Mientras exista `PATCH /clientes`, un contador que se vincule a cualquier cliente activo puede renombrarlo o desactivarlo (si tiene «Mis actividades»). Producción (fase 5) está en pausa; antes de publicar, la 56d tiene que estar hecha o `USUARIOS_CON_ACTIVIDADES` vacío.
- Decisiones del usuario (2026-11-26) sobre clientes: catálogo único sin dueño + `cliente_contador` (varios contadores); alta por administrador, sistemas y recepcionista **solo en Ajustes**; edición, renombrar, desactivar y asignar contadores solo administrador y sistemas; clave obligatoria y RFC opcional; **un solo nombre por cliente** (fusionar, no borrar repetidos); quién puede llevar clientes: `usuarios.rol` contador o auxiliar, o Contador en Documentos; el contador **vincula** clientes desde «Mi perfil» (cualquier cliente activo; quita solo el suyo); el primero de la lista de contadores es el principal.
- Entrada a la app: todos pasan por `/modulos`; «Ajustes» es un botón de ahí (administrador, sistemas y recepcionista); «Directorio» de Seguimiento solo para la recepcionista; el botón «Ajustes» conserva el estilo que el usuario diseñó (círculo que se expande).
- **Siempre preguntar antes de** tocar algo que ya funciona, agregar dependencias, archivos nuevos, cambios de estructura de datos o de lógica (`AGENTS.md`). **No hacer `push` sin preguntar.**
- No hay modelo Fable: usar Opus (riesgo alto), Sonnet (implementar y riesgo medio) y Haiku (explorar y riesgo bajo).

## 4. Cómo trabajar (flujo del proyecto)

1. Refinar la rebanada con el usuario y escribir `docs/rebanadas/NN-nombre.md` desde `docs/rebanadas/00-plantilla.md` (criterios, archivos autorizados, riesgo).
2. Implementar con TDD (prueba en rojo primero), solo en los archivos autorizados; si hace falta otro, parar y preguntar.
3. Revisar con otra instancia que **no modifique nada** (Opus si es riesgo alto). Máximo 2 vueltas de corrección; después decide el usuario.
4. Cerrar: `MEMORY.md` (solo el orquestador), veredicto en el archivo de la rebanada y propuesta de commit. Commit: `git add` de los archivos, `git commit` con mensaje descriptivo y **push solo con permiso**.
5. Con opencode (anexo de `docs/flujo-agentes.md`): `opencode run --agent reviewer --auto --title "NN-revision" "Revisa la rebanada de docs/rebanadas/NN-….md"`; en la práctica los modelos gratuitos tardan mucho más.

## 5. Puertas de verificación y trampas

- Backend (`Backend/`): `node --test --test-concurrency=1` **por archivo** (todo junto se cuelga; en paralelo falla al azar por la BD compartida), `src/modulos/documentos/**/*.test.mjs` y `node soporte-pruebas/verificarPruebas.js`. Cada archivo de `Backend/test` va en `MINIMOS`; una ruta nueva va en `autorizacionMatriz.test.js`. Requiere MariaDB de XAMPP en 3306 con `delgrow_merge`.
- Frontend (`Seguimiento-proyectos/`): `npm run lint:check`, `npm run build`, `node --test`, `npx prettier --check` (el árbol está en CRLF: compara contra el contenido LF; muchos archivos ya fallaban en HEAD) y navegador real si toca interfaz (escritorio y celular).
- Datos de prueba: prefijo `zz_test_` (correos `@ejemplo.com`); al terminar, **0 filas `zz_test_%`**, `clientes` = 156 y `cliente_contador` = 6. Borrar las `sesiones` antes que la cuenta. `limpiarDatosDePrueba` borra avisos que mencionen `zz_test_`: no probar en navegador mientras corren las pruebas del backend.
- **Falla intermitente de `verificarPruebas.js`** (vista en la 52 y en la 56b; la segunda corrida siempre pasa): hipótesis no confirmada: el backend del 3001 corre con **nodemon** sobre la misma base y se reinicia, corriendo el seed (con `ALTER` del ENUM de `usuarios`), cada vez que se guarda un archivo del backend; si coincide con las pruebas, el seed de la prueba (`GET_LOCK` de 30 s) falla y cancela el archivo. Para evitarlo: detener el 3001 mientras corren las pruebas.
- Servidores del navegador: backend 3001 y frontend 9001 (`.claude/launch.json`). No cerrar los del usuario. Con el panel del navegador oculto, los clics pueden fallar: mostrarlo antes de probar.
- Respaldos: `mysqldump` de XAMPP desde Git Bash o con redirección de archivo (la tubería de PowerShell daña los acentos), fuera del proyecto, sin imprimir credenciales (están en `Backend/.env`).
- MariaDB: cambiar la regla de una llave foránea exige **dos** `ALTER` (soltar y crear); en uno da el error 121. `db.js` solo acepta parámetros primitivos (para `IN`/`VALUES` armar los `?` a mano). Varios `.vue` están en CRLF y `sed` falla: usar `Edit`.
- Estilos: `--dg-anillo-foco` es una sombra, no un color (para `outline` usar `var(--dg-foco)`); `q-btn` trae un contorno global con `!important`. Colores solo de `$dg-colores`, nunca hexadecimales sueltos.

## 6. Mapa rápido del código de clientes

- Esquema: `Backend/src/utils/seed.js` (`migrarClienteContador`, `asegurarIndiceUnicoNombre`).
- Modelo único de contadores: `Backend/src/models/ClienteContadorModel.js` (`reemplazarContadores`, `agregarContador`, `quitarContador`, `puedeLlevarClientes`, `SQL_PRINCIPAL_DE_C`); regla: `clientes.usuario_id` = principal (menor `asignado_en`, luego `usuario_id`) o NULL sin filas.
- API de Ajustes: `Backend/src/routes/ajustesRoutes.js`, `controllers/AjustesController.js`; cartera propia: `routes/clienteRoutes.js`, `controllers/ClienteController.js`, `models/ClienteModel.js`; middlewares `requireAltaClientes` y `requireLlevaClientes` en `middlewares/roleMiddleware.js`.
- Documentos: `Backend/src/modulos/documentos/rutas/clientes.mjs` (ficha, alta y edición viejas), `documentos.mjs`, `catalogos.mjs`.
- Frontend: `src/components/AjustesClientes.vue`, `src/pages/AjustesPage.vue`, `src/layouts/AjustesLayout.vue`, `src/services/ajustesService.js`, `src/pages/ModulosPage.vue`, `src/utils/modulos.js`, `src/pages/ContadorAuxiliaresPage.vue` («Mi perfil» y la cartera actual), `src/modulos/documentos/components/NuevoClienteDialog.vue` (se retira en la 56d).
