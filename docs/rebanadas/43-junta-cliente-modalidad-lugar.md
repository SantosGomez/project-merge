# 43 — Cliente, modalidad y lugar en las juntas de «Mi Calendario»

- **Riesgo:** alto (cambio de esquema en `juntas` y datos que no deben llegar a terceros)
- **Implementa:** Claude (`implementer`, sonnet)
- **Revisa:** Claude (`reviewer`, opus)
- **Estado:** aprobada (sin commit)

## Historia

Como persona que agenda una junta en «Mi Calendario», quiero indicar el cliente a tratar, si es presencial o virtual y el lugar, para que los invitados sepan de qué cliente se hablará y dónde será.

## Criterios de aceptación

1. **Tabla** (`seed.js`, junto a la migración de `privada` de la rebanada 23, con `ADD COLUMN IF NOT EXISTS`, nunca DROP): `juntas.cliente VARCHAR(150) NULL`, `juntas.modalidad ENUM('presencial','virtual') NULL`, `juntas.lugar VARCHAR(255) NULL`. Las juntas ya guardadas quedan con los tres en NULL.
2. **API** (`POST /juntas` y `PATCH /juntas/:id`): aceptan `cliente`, `modalidad` y `lugar`, los tres **opcionales**. Vacío o ausente → `null`. `cliente` ≤150 y `lugar` ≤255 caracteres tras recortar espacios; `modalidad` solo `presencial` o `virtual` (otro valor → 400 con error en tres partes de `buildError`, con la parte «sobre» nombrando el campo para que el frontend lo ponga junto al campo). Las respuestas de la junta (`armarJuntas`) traen `cliente`, `modalidad` y `lugar`.
3. **Privacidad**: siguen la regla de la descripción. Un tercero (agenda de otra persona, `JuntaModel` línea ~139) nunca los recibe, ni en juntas públicas ni privadas. Prueba de backend que lo compruebe.
4. **Formulario** (`JuntaFormDialog.vue`, alta y edición), tres campos nuevos, sin asterisco:
   - **Cliente a tratar**: `q-input` de texto libre (máx. 150, contador). A su lado (slot `append` o botón junto al campo) un botón «Elegir de mis clientes» que abre una lista (`q-menu` con búsqueda sin tildes y `q-list`) de los clientes **activos** de `listarClientes()` (`clienteService.js`); al elegir uno se copia su nombre al campo, que sigue editable. El botón solo aparece si la cuenta es contador o auxiliar con `session.actividadesHabilitadas`; administradores y recepcionista solo escriben. La lista se pide al abrir el menú (o al abrir el diálogo, una vez); si falla, mensaje dentro del menú con «Reintentar»; sin clientes activos: «Aún no tienes clientes activos en tu cartera.». Tooltip en el botón.
   - **Modalidad**: Presencial / Virtual (`q-btn-toggle` con `clearable`, o equivalente de Quasar), opcional, con tooltip/ayuda.
   - **Lugar**: `q-input` (máx. 255, contador). Placeholder según la modalidad: presencial «Por ejemplo: Sala de juntas o dirección», virtual «Por ejemplo: enlace de Teams o Meet», sin modalidad «Dónde será la junta».
   - Los tres entran en `fotoDelFormulario` (para «¿Descartar los cambios?»), se precargan al editar, se validan en `validarFormularioJunta` (`utils/juntas.js`) con los mismos límites y los errores de la API caen en su campo (`CAMPO_DE_FORMULARIO` / `campoDeErrorJunta`).
   - Orden: Título · Fecha · Horas · **Cliente a tratar** · **Modalidad** · **Lugar** · Invitados · Descripción · Privada. Responsivo (una columna en móvil).
5. **Ficha** (`JuntaDetalleDialog.vue`): muestra Cliente, Modalidad («Presencial»/«Virtual») y Lugar con icono por campo, siguiendo el patrón de la ficha. Vacíos: «Sin cliente», «Sin indicar», «Sin lugar» con el estilo `detalle-vacio`. Si la modalidad es virtual y el lugar empieza con `http://` o `https://`, el lugar se muestra como enlace que abre en otra pestaña (`target="_blank"`, `rel="noopener noreferrer"`).
6. `juntaService.js` envía y recibe los tres campos.

## Archivos autorizados

- `Backend/src/utils/seed.js`
- `Backend/src/utils/validacionJuntas.js`
- `Backend/src/models/JuntaModel.js`
- `Backend/src/controllers/JuntaController.js` (solo si hace falta para pasar los campos)
- `Backend/test/juntas.test.js`, `Backend/test/validacionJuntas.test.js`, `Backend/test/agendaJuntas.test.js` (o un archivo nuevo de prueba, que entonces va en `MINIMOS` de `soporte-pruebas/verificarPruebas.js`)
- `Seguimiento-proyectos/src/components/JuntaFormDialog.vue`
- `Seguimiento-proyectos/src/components/JuntaDetalleDialog.vue`
- `Seguimiento-proyectos/src/utils/juntas.js`
- `Seguimiento-proyectos/src/services/juntaService.js`
- `Seguimiento-proyectos/test/` (pruebas de `juntas.js`, del servicio y de texto de los componentes)

Fuera de esta lista, el implementer para y pregunta. Sin dependencias nuevas, sin endpoint nuevo, sin tocar las rutas ni el backend de clientes.

## Notas del orquestador

- Pedido del usuario (2026-11-24). Decisiones aprobadas por el usuario:
  - Guardar solo el **nombre** del cliente (texto), sin `cliente_id`: si el cliente se renombra después, la junta conserva el nombre de ese día.
  - Catálogo solo para quien tiene cartera (contador/auxiliar con «Mis actividades»); los demás escriben a mano. No se crea un catálogo general.
  - Los tres campos son opcionales.
  - Privacidad igual que la descripción.
- No entra: mostrar cliente/modalidad/lugar en los bloques del calendario (`BloqueJunta.vue`), filtros por cliente, ni en «Tu próxima junta».
- Trampas: MariaDB no está en modo estricto (validar en el backend, no confiar en el ENUM). `db.js` solo acepta primitivos. Varios `.vue` usan CRLF: usar Edit. Colores solo de la paleta. Textos en tú y en español. Datos de prueba con `zz_test_`, 0 filas al final. Correr el backend con `node --test --test-concurrency=1` y por archivo.

---

## Reporte del implementer

1. Rebanada completada: sí (falta navegador, lo hace el orquestador).
2. Archivos modificados: `seed.js`, `validacionJuntas.js`, `JuntaModel.js` y pruebas `validacionJuntas`/`juntas`/`agendaJuntas` (backend); `utils/juntas.js` (`MAX_CLIENTE`, `MAX_LUGAR`, `etiquetaModalidad`, `enlaceDeLugar`), `juntaService.js`, `JuntaFormDialog.vue`, `JuntaDetalleDialog.vue` y pruebas `juntasUtils`/`juntasServicio`/`juntasFormularioFichaCarga` (frontend). `JuntaController.js` sin cambios.
3. Prueba en rojo: por aserto en todas (campos ausentes, límites y modalidad inválida aceptados, columnas inexistentes). La de privacidad de `agendaJuntas` se escribió junto con el código.
4. Puertas: backend 866/866 y `verificarPruebas` OK; frontend lint, build, 1883/1883 y prettier de los 7 archivos en verde; 0 filas `zz_test_%`.
5. Decisiones no cubiertas: error «sobre modalidad»; modalidad en blanco → null; botón con `session.trabajaCasos && session.actividadesHabilitadas`; nombre elegido recortado a 150; Cliente a lo ancho y Modalidad/Lugar en dos columnas; `MINIMOS` de `validacionJuntas.test.js` sigue en 14 (hay 16).
6. Para la memoria: cliente como texto sin `cliente_id`; los tres campos siguen la privacidad de la descripción; el lugar se enlaza solo si es virtual y empieza con http(s).

## Veredicto del reviewer (vuelta 1)

VEREDICTO: APROBADA (`reviewer`, opus). Puertas en verde: backend 866/866, frontend 1883/1883, lint y prettier; 0 filas `zz_test_%`.

Opcionales sin aplicar:
1. `JuntaFormDialog.vue`: el error de modalidad va en un `<p role="alert">` y `enfocarPrimerError` no lo alcanza (casi imposible: el servicio nunca envía una modalidad inválida).
2. `JuntaFormDialog.vue`: `aria-haspopup="listbox"` en un `q-menu` con `q-list`; sería `menu`.
3. `validacionJuntas.js`: una modalidad con espacios (`" virtual "`) da 400 en vez de recortarse.
4. `verificarPruebas.js`: los mínimos de juntas siguen en 16/10/14 (hay 17/11/16).
5. `JuntaModel.js`: el JSDoc de `crear` y `actualizar` no menciona los campos nuevos.

## Verificación en navegador (orquestador, 2026-11-24)

3011 + 9012, contador `zz_test_` con dos clientes. Con `USUARIOS_CON_ACTIVIDADES=7917` (el `.env`) el botón no aparece, como se espera; con el módulo abierto (configuración temporal, ya quitada) apareció «Elegir de mis clientes», la búsqueda «alamo» encontró «Álamo», al elegirlo se copió el nombre y el lugar cambió de ejemplo con «Virtual». La junta se guardó; la ficha mostró Cliente, Modalidad y el enlace del lugar; «Editar» precargó los tres. En 375 px: una columna, el botón bajo el campo, sin desplazamiento horizontal. Sin errores de consola propios. 0 filas `zz_test_%` al final.
