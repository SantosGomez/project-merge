# Spec 001 — Maqueta navegable de las vistas
Estado: aprobada

## Contexto y objetivo

El proyecto todavía no tiene pantallas propias. Antes de construir funcionalidad real se necesita una **maqueta navegable** que permita acordar qué información ve cada perfil, cómo se recorre y cómo se comporta la interfaz en sus estados (carga, vacío, error, acceso denegado, sesión caducada). El objetivo es detectar acuerdos y desacuerdos sobre las pantallas antes de invertir en desarrollo.

La maqueta se recorre con **datos de ejemplo ficticios** y no obtiene ni envía información a ningún servicio. Los cambios que se hacen durante el recorrido (registrar un caso, cambiar estado o prioridad) existen **solo mientras la maqueta permanece abierta** y se pierden al recargar o cerrar: no hay almacenamiento permanente.

Reglas de alcance que explican el porqué del recorte:

- Solo existen dos perfiles y cada uno ve un conjunto distinto de pantallas.
- Nada se crea, edita ni elimina fuera de lo previsto: no se administran contadores ni se editan o eliminan casos.
- Todo cambio se refleja en todas las pantallas que muestren ese dato **dentro de la misma sesión de la maqueta**; no se comparte entre pestañas ni sobrevive a una recarga.

**Nota de alcance — excepciones a la constitución.** Al aprobar esta spec se aceptaron dos excepciones, que valen solo para esta maqueta:

- **Principio 3 (los datos del usuario son sagrados).** No aplica: no existe almacenamiento real, los datos son de ejemplo y los cambios viven solo en la sesión abierta; la caducidad de sesión es un estado de interfaz que se provoca a voluntad para revisarlo. Cuando el proyecto incorpore almacenamiento real, esa protección deberá recuperarse en la spec correspondiente.
- **Principio 5 (Argon2id).** No aplica: la maqueta no almacena ni hashea contraseñas. Las dos contraseñas de ejemplo son ficticias y solo sirven para entrar; ningún almacenamiento real de contraseñas puede prescindir de Argon2id.

Estas notas no modifican `docs/constitution.md`: son notas de alcance de esta spec, y el resto de los principios siguen aplicando.

**Nota de alcance — campos sin esquema.** Los campos cliente y prioridad de P-4, y los casos que la maqueta crea en memoria, se aceptan como prototipo sin datos reales. El esquema o tabla correspondiente se definirá y aprobará antes de implementar la funcionalidad real; esta spec no lo crea.

## Usuarios

- **Administrador**: consulta el estado general del equipo (conteo de casos por estado de cada contador y detalle de los casos de un contador). No registra casos, no cambia estados ni prioridades y no administra contadores: en todas las pantallas que ve, los casos son de solo lectura.
- **Contador**: registra sus propios casos y actualiza el estado y la prioridad de los casos que tiene asignados.
- No existen otros perfiles en la maqueta: solo hay pantallas y datos para administrador y contador. Cualquier cuenta distinta de las dos de ejemplo se trata como credenciales no válidas (RF-4) y no da acceso a nada.

## Pantallas previstas

- **P-1 Inicio de sesión**: punto de entrada; identifica al perfil por la cuenta usada.
- **P-2 Dashboard del administrador**: todos los contadores con el conteo de sus casos por estado y, al seleccionar uno, el detalle de sus casos.
- **P-3 Directorio de contadores**: lista solo con los nombres de todos los contadores del equipo, pensada para localizar a una persona. Al elegir un nombre se abre el detalle de esa persona en P-2. No muestra conteos ni casos por sí misma.
- **P-4 Registro de caso**: formulario del contador para dar de alta un caso propio.
- **P-5 Mis casos**: casos asignados al contador que inició sesión, con posibilidad de cambiar estado y prioridad.

Son cinco pantallas (P-1 a P-5). P-2 y P-3 no se fusionan: P-2 responde "cómo está el equipo" (conteos y detalle) y P-3 responde "quién está en el equipo" (solo nombres).

### Recorrido previsto

El recorrido que debe poder completarse de extremo a extremo:

- **Del administrador**: P-1 → P-2 con los conteos de todos → seleccionar un contador en P-2 y ver su detalle → "Ver directorio" → P-3 con solo nombres → elegir un nombre → P-2 con ese contador seleccionado → control de regreso → P-3.
- **Del contador**: P-1 → P-5 con sus casos (o el mensaje de vacío si aún no tiene) → "Registrar caso" → P-4 → registrar → P-4 con la confirmación → "Ver mis casos" → P-5 ya con el caso nuevo → control de regreso → P-4.

Los controles de navegación que hacen posible este recorrido son: "Ver directorio" en P-2, la selección de un nombre en P-3, "Registrar caso" en P-5 (también cuando P-5 no tiene casos), "Ver mis casos" en P-4 y el control de regreso de RF-40 en toda pantalla interna. No existe ningún control que lleve a una pantalla de otro perfil.

## Historias de usuario

- HU-1. Como administrador, quiero iniciar sesión para llegar a la pantalla que resume el trabajo del equipo.
- HU-2. Como administrador, quiero ver por cada contador cuántos casos tiene en cada estado para detectar dónde se acumula el trabajo.
- HU-3. Como administrador, quiero seleccionar un contador y ver el detalle de sus casos (cliente, estado, prioridad) para entender su carga concreta.
- HU-4. Como administrador, quiero recorrer el directorio de contadores para ubicar a una persona y abrir su detalle.
- HU-5. Como contador, quiero iniciar sesión para ver los casos que tengo asignados.
- HU-6. Como contador, quiero registrar un caso propio indicando cliente y prioridad.
- HU-7. Como contador, quiero ver y actualizar el estado y la prioridad de mis casos.
- HU-8. Como usuario, quiero que se me impida ver pantallas o datos que no corresponden a mi perfil.
- HU-9. Como usuario, quiero ver mensajes claros cuando la información está cargando, no existe, falla o mi sesión caducó.
- HU-10. Como usuario, quiero reconocer la urgencia de un caso por su etiqueta de prioridad (texto + color) sin depender del color.
- HU-11. Como usuario, quiero navegar entre pantallas y regresar a la anterior sin perderme.

## Definiciones

- **Caso**: unidad de trabajo asignada a un contador y asociada a un cliente.
- **Cliente**: nombre de la persona o empresa para la que se trabaja el caso. Texto libre obligatorio: se ignoran los espacios al inicio y al final, y el texto restante debe tener entre 1 y 80 caracteres visibles, contando también los espacios interiores y los caracteres especiales. 80 caracteres se aceptan y 81 no.
- **Estado del caso**: avance del trabajo. Valores permitidos y únicos: **Pendiente**, **En proceso**, **Finalizado**. El estado inicial de todo caso nuevo es **Pendiente**.
- **Prioridad**: urgencia del caso, **independiente** del estado. Valores permitidos y únicos: **Alta**, **Media**, **Baja**. Cualquier combinación de estado y prioridad es válida.
- **Etiqueta de prioridad**: representación de la prioridad como texto ("Alta", "Media", "Baja") acompañado de un color. El texto siempre está presente; el color nunca es el único portador del significado.
- **Contador**: miembro del equipo que atiende casos y es el único que registra y actualiza casos.
- **Administrador**: usuario de solo consulta sobre el trabajo del equipo.
- **Cuenta de ejemplo**: usuario ficticio con el que se entra a la maqueta; su perfil determina qué pantallas ve. Existen exactamente dos: `admin` con contraseña `admin123` (perfil administrador) y `contador` con contraseña `contador123` (perfil contador). Las contraseñas son ficticias y solo sirven para entrar (excepción al Principio 5 anotada en el Contexto). La maqueta no define ninguna otra cuenta.
- **Credenciales**: usuario y contraseña tal como se escriben en P-1. Se ignoran los espacios al inicio y al final; un valor vacío o compuesto solo por espacios cuenta como campo faltante; la comparación distingue mayúsculas y minúsculas.
- **Pantalla principal del perfil**: P-2 para el perfil administrador y P-5 para el perfil contador. Es la pantalla que se abre al iniciar sesión y el destino que ofrece el aviso de acceso denegado.
- **Dirección de una pantalla**: texto único que identifica cada pantalla y que se puede escribir o pegar en la barra de direcciones del navegador para abrirla sin usar los controles de la maqueta. Es la vía prevista para comprobar el acceso denegado y la falta de sesión (RF-5, RF-6). El botón "atrás" del navegador no es una dirección: no abre una pantalla concreta y no forma parte del recorrido previsto (RF-40).
- **Sesión simulada**: estado de "usuario dentro de la maqueta" mientras esta permanece abierta. No caduca por tiempo ni por inactividad: solo caduca cuando el usuario activa el control "Simular caducidad".
- **Control de simulación**: control visible, identificado con el texto "Simular..." para no confundirlo con una acción real, que permite revisar un estado de interfaz a voluntad. Existen dos y están disponibles en todas las pantallas internas (P-2 a P-5): **"Simular caducidad"** y **"Simular error"**.
- **Carga simulada**: espera de aproximadamente un segundo que la maqueta muestra al abrir cada pantalla con datos, con el fin de revisar el estado de carga.
- **Datos de una pantalla**: información de ejemplo que la pantalla necesita para mostrarse: en P-2, los contadores con sus conteos y, al seleccionar uno, sus casos; en P-3, los nombres de los contadores; en P-4, el contador que registra y las opciones de prioridad; en P-5, los casos del contador que inició sesión. Los datos de ejemplo incluyen siempre a la cuenta `contador` como miembro del equipo, por lo que P-2 y P-3 nunca se quedan sin contadores que mostrar. Además, al empezar la maqueta la cuenta `contador` no tiene casos y hay al menos otro contador con casos repartidos entre los tres estados, de modo que se puedan ver tanto los conteos en "0" como los estados vacíos de P-5 (RF-34) y del detalle de un contador sin casos (RF-14). Los datos incluyen también un contador de nombre largo con caracteres especiales, un caso con cliente de nombre largo y caracteres especiales, y suficientes contadores y casos para que P-2, P-3 y el detalle de un contador con muchos casos tengan más filas de las que caben en una ventana de 1024 × 768 px. La cuenta `contador` permanece sin casos, así que P-5 no se usa para comprobar el desbordamiento.
- **Pantalla interna**: cualquiera de P-2 a P-5; requiere sesión iniciada.
- **Estado de interfaz**: representación de la pantalla mientras carga, cuando no hay información (vacío), cuando falla (error), cuando el acceso no está permitido (acceso denegado) y cuando la sesión caducó.
- **Cambio en memoria**: modificación válida solo durante la sesión actual de la maqueta; no se conserva al recargar, cerrar o abrir otra pestaña.
- **Conteo**: número de casos de un contador en un estado concreto. Se muestra siempre, incluido el valor "0".
- **Detalle de casos**: lista de los casos de un contador con cliente, estado y prioridad.
- **Orden de la información**: no forma parte de esta spec; se muestra en el orden de los datos de ejemplo.

## Requisitos funcionales

### Acceso y sesión

- RF-1: CUANDO un usuario abre la maqueta sin sesión iniciada, EL SISTEMA muestra P-1.
- RF-2: CUANDO un usuario envía el usuario y la contraseña de una cuenta de ejemplo, EL SISTEMA abre la pantalla principal del perfil de esa cuenta: P-2 si es administrador (`admin` / `admin123`) y P-5 si es contador (`contador` / `contador123`).
- RF-3: SI envía P-1 con el usuario o la contraseña faltantes (vacíos o con solo espacios), ENTONCES EL SISTEMA señala cada campo faltante y no avanza.
- RF-4: SI envía credenciales no vacías que no corresponden a ninguna cuenta de ejemplo, o que corresponderían a un perfil distinto de administrador o contador (regla defensiva: la maqueta no define ninguna cuenta así), ENTONCES EL SISTEMA muestra un mensaje genérico de credenciales no válidas, no indica cuál de los dos datos falló y no avanza.
- RF-5: SI un usuario sin sesión intenta abrir una pantalla interna, ENTONCES EL SISTEMA lo lleva a P-1 con un aviso de que debe iniciar sesión.
- RF-6: SI un usuario con sesión accede directamente a la dirección de una pantalla de otro perfil (la maqueta no ofrece ningún control que lleve a ella), ENTONCES EL SISTEMA muestra acceso denegado y ofrece volver a la pantalla principal de su perfil.
- RF-7: CUANDO el usuario activa el control "Simular caducidad" en una pantalla interna, EL SISTEMA cierra la sesión, deja de mostrar los datos de esa pantalla y muestra un aviso de sesión caducada con un acceso a P-1; mientras no se envíen credenciales de nuevo no hay sesión activa, así que volver a entrar exige iniciar sesión otra vez.
- RF-8: EL SISTEMA determina el perfil por la cuenta con la que se inicia sesión y no ofrece ninguna forma de elegir el perfil manualmente.
- RF-9: MIENTRAS no hay sesión iniciada, EL SISTEMA no muestra información de contadores ni de casos.
- RF-10: CUANDO un usuario con sesión vuelve a P-1 mediante el control de regreso, EL SISTEMA no cierra su sesión; SI envía credenciales válidas de otra cuenta, ENTONCES EL SISTEMA cierra la sesión anterior y aplica el perfil de la nueva cuenta. Este cierre no se produce tras una caducidad, porque entonces ya no hay sesión (RF-7).

### Dashboard del administrador

- RF-11: CUANDO el administrador inicia sesión, EL SISTEMA muestra P-2 con todos los contadores de ejemplo.
- RF-12: EL SISTEMA muestra, por cada contador, el conteo de sus casos en cada estado (Pendiente, En proceso, Finalizado) y muestra el valor "0" cuando no hay casos en ese estado.
- RF-13: CUANDO el administrador selecciona un contador, EL SISTEMA muestra el detalle de los casos de ese contador con cliente, estado y prioridad (etiqueta de texto + color); el administrador no dispone de ningún control para modificar el estado ni la prioridad.
- RF-14: SI el contador seleccionado no tiene casos, ENTONCES EL SISTEMA muestra un mensaje de que ese contador no tiene casos.
- RF-15: CUANDO el administrador cambia de contador seleccionado, EL SISTEMA reemplaza el detalle anterior por el del nuevo contador.

### Directorio de contadores

- RF-16: CUANDO el administrador abre P-3, EL SISTEMA muestra solo el nombre de todos los contadores de ejemplo, sin conteos ni casos.
- RF-17: CUANDO el administrador selecciona un nombre en P-3, EL SISTEMA abre P-2 con ese contador ya seleccionado y muestra el detalle de casos definido en RF-13.
- RF-18: EL SISTEMA incluye siempre a la cuenta `contador` entre los contadores de ejemplo, por lo que P-2 y P-3 nunca se muestran sin contadores; el único estado vacío previsto en P-2 es el detalle de un contador sin casos (RF-14).

### Registro de casos

- RF-19: CUANDO el contador abre P-4, EL SISTEMA muestra un formulario con cliente (texto libre) y prioridad (Alta, Media, Baja); el estado es **Pendiente** y el contador asignado es el contador que registra, ambos mostrados como información no editable.
- RF-20: EL SISTEMA presenta las tres prioridades con su etiqueta de texto y color.
- RF-21: CUANDO el contador envía un registro con cliente y prioridad válidos, EL SISTEMA agrega el caso a los casos del contador, muestra una confirmación de que quedó registrado, deja el formulario vacío en P-4 y ofrece el control "Ver mis casos" (RF-44) para verlo en P-5.
- RF-22: SI el contador envía el registro sin cliente o con solo espacios, ENTONCES EL SISTEMA indica que el cliente es obligatorio y no agrega el caso.
- RF-23: SI el contador envía el registro sin prioridad elegida, ENTONCES EL SISTEMA indica que la prioridad es obligatoria y no agrega el caso.
- RF-24: SI el cliente supera los 80 caracteres, ENTONCES EL SISTEMA indica el máximo permitido y no agrega el caso.
- RF-25: CUANDO se agrega un caso, EL SISTEMA lo muestra en P-5 y en el detalle y los conteos de P-2 durante la misma sesión de la maqueta.
- RF-26: EL SISTEMA asigna el caso al contador que lo registra y no aplica ninguna regla de reparto de casos.
- RF-27: EL SISTEMA no ofrece controles para editar o eliminar casos, ni para editar, crear o eliminar contadores.

### Vista del contador

- RF-28: CUANDO el contador inicia sesión, EL SISTEMA muestra P-5 con los casos asignados a él.
- RF-29: EL SISTEMA muestra, por cada caso, el cliente, el estado y la prioridad (etiqueta de texto + color).
- RF-30: CUANDO el contador cambia el estado de un caso, EL SISTEMA actualiza el estado mostrado en P-5 y los conteos de P-2 en la misma sesión de la maqueta.
- RF-31: CUANDO el contador cambia la prioridad de un caso, EL SISTEMA actualiza la etiqueta mostrada en P-5 y en el detalle de P-2 en la misma sesión de la maqueta.
- RF-32: EL SISTEMA permite cambiar el estado y la prioridad en cualquier momento, incluido un caso en estado **Finalizado**, sin restricciones ni confirmaciones adicionales.
- RF-33: MIENTRAS el usuario es contador, EL SISTEMA solo muestra los casos asignados a él.
- RF-34: SI el contador no tiene casos, ENTONCES EL SISTEMA muestra un mensaje de que no tiene casos registrados y el control "Registrar caso" (RF-43) para crear el primero.

### Estados de interfaz

- RF-35: CUANDO el usuario abre una pantalla que muestra datos (P-2, P-3, P-4 o P-5), EL SISTEMA muestra un indicador de carga durante aproximadamente un segundo mientras obtiene los datos de esa pantalla y, hasta terminar, no muestra datos incompletos ni datos anteriores.
- RF-36: SI no hay información que mostrar en una pantalla, ENTONCES EL SISTEMA muestra un mensaje de vacío que indica qué información falta. Los estados vacíos previstos son P-5 sin casos (RF-34) y el detalle de un contador sin casos (RF-14).
- RF-37: CUANDO el usuario activa el control "Simular error" en una pantalla interna, EL SISTEMA sustituye lo que se estuviera mostrando (datos, detalle o mensaje de vacío) por un mensaje de error que indica que no se pudieron obtener los datos y ofrece reintentar; al reintentar, EL SISTEMA repite la carga simulada y vuelve a mostrar lo que corresponda: los datos de ejemplo o el mensaje de vacío. En P-4 el error impide ver el formulario. En P-2 el detalle seleccionado no se conserva: al recuperarse, P-2 se muestra sin contador seleccionado.
- RF-38: EL SISTEMA ofrece en todas las pantallas internas (P-2 a P-5) los controles visibles "Simular caducidad" y "Simular error", identificados con ese texto para no confundirlos con acciones reales, tanto si la pantalla muestra datos como si muestra un vacío o un error.
- RF-39: CUANDO un cambio de estado o de prioridad se completa, EL SISTEMA lo confirma visualmente; la maqueta no contempla fallo de un cambio porque no consulta ningún servicio.
- RF-40: EL SISTEMA ofrece en cada pantalla interna un control para volver a la pantalla anterior del recorrido.
- RF-41: MIENTRAS la maqueta permanece abierta, EL SISTEMA conserva los cambios realizados; al recargar o cerrar, EL SISTEMA cierra la sesión, vuelve a P-1 y restablece los datos de ejemplo.

### Navegación

- RF-42: CUANDO el administrador activa el control "Ver directorio" en P-2, EL SISTEMA abre P-3.
- RF-43: EL SISTEMA ofrece el control "Registrar caso" en P-5 tanto si la lista tiene casos como si está vacía; CUANDO el contador lo activa, EL SISTEMA abre P-4.
- RF-44: CUANDO el contador activa el control "Ver mis casos" en P-4, EL SISTEMA abre P-5.

### Datos de ejemplo

- RF-45: EL SISTEMA usa un único conjunto de datos de ejemplo que contiene: la cuenta `contador` sin casos al empezar; al menos otro contador con casos en los tres estados; un contador con nombre largo y caracteres especiales; un caso cuyo cliente tiene nombre largo y caracteres especiales; y filas suficientes para que P-2, P-3 y el detalle de un contador con muchos casos desborden una ventana de 1024 × 768 px, sin que la cuenta `contador` deje de estar sin casos.

## Requisitos no funcionales

- RNF-1: EL SISTEMA usa en toda la interfaz los términos de la sección Definiciones, nombra cada acción siempre igual y todo mensaje de error contiene tres partes comprobables: qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario a continuación. No se admiten mensajes que solo digan "Error".
- RNF-2: EL SISTEMA se usa sin desplazamiento horizontal desde 360 px de ancho, presenta una sola columna por debajo de 600 px, una sola columna con ancho máximo de 720 px centrada entre 600 px y 1023 px, y varias columnas a partir de 1024 px, y ofrece controles táctiles con un área de al menos 44 × 44 px.
- RNF-3: EL SISTEMA ofrece texto de ayuda contextual en, como mínimo: las tres prioridades (qué significa cada una), los tres estados (qué significa cada uno), cada conteo (qué está contando), el campo cliente, el campo prioridad, el registro de un caso, los controles "Simular caducidad" y "Simular error" (qué estado reproducen), el mensaje de acceso denegado y el de sesión caducada; esa ayuda se muestra con puntero, con foco de teclado y con toque en pantallas táctiles.
- RNF-4: EL SISTEMA usa solo datos de ejemplo ficticios y no incluye datos personales reales.
- RNF-5: EL SISTEMA identifica cada pantalla con un título visible y distinto.
- RNF-6: EL SISTEMA no muestra a un perfil información que pertenece a otro, ni siquiera como conteo o nombre.
- RNF-7: EL SISTEMA muestra la prioridad como texto acompañado de color: **Alta** en rojo, **Media** en ámbar y **Baja** en verde, con un contraste mínimo de 4.5:1 entre texto y fondo y sin usar el color como único portador del significado.
- RNF-8: EL SISTEMA permite completar todo el recorrido solo con teclado, con foco visible en todo momento, etiqueta textual asociada a cada campo y avisos de carga, error, acceso denegado, sesión caducada y cambio confirmado expresados como texto.
- RNF-9: EL SISTEMA muestra los nombres largos o con caracteres especiales completos, ajustando el texto a varias líneas, sin recortar información esencial.
- RNF-10: EL SISTEMA muestra las listas largas (muchos contadores o muchos casos) con desplazamiento vertical y sin paginación.

## Casos límite

- **Sin sesión**: abrir la maqueta o una pantalla interna sin sesión → P-1 (RF-1, RF-5).
- **Campos vacíos en P-1**: uno o ambos campos vacíos o con solo espacios → se señalan los faltantes y no avanza (RF-3).
- **Credenciales inválidas**: datos no vacíos que no corresponden a ninguna cuenta de ejemplo → mensaje genérico de credenciales no válidas y no avanza (RF-4).
- **Mayúsculas y minúsculas**: `Admin` o `ADMIN123` no son válidos; la comparación distingue mayúsculas y minúsculas (Definiciones: Credenciales, RF-4).
- **Perfil no reconocido**: regla defensiva; con las dos cuentas definidas no se puede provocar. Si existiera una cuenta con otro perfil, se trataría como credenciales no válidas (RF-4).
- **Credenciales válidas de otro perfil estando ya dentro**: al enviarlas de nuevo en P-1 se cierra la sesión anterior y se aplica el perfil nuevo (RF-10).
- **Credenciales válidas reenviadas tras una caducidad**: P-1 alcanzado por caducidad no tiene sesión, así que el envío se comporta como un inicio de sesión normal y RF-10 no aplica (RF-7, RF-10).
- **Caducidad en pantalla interna** → se provoca con el control "Simular caducidad": la sesión queda cerrada, la pantalla deja de mostrar sus datos y aparece el aviso con acceso a P-1; para volver a entrar hay que iniciar sesión otra vez (RF-7, RF-38).
- **Sin caducidad por tiempo ni inactividad**: permanecer 5 minutos en una pantalla interna sin usar los controles de simulación: la sesión sigue activa y la pantalla sigue mostrando sus datos (Definiciones: Sesión simulada, RF-7).
- **Caducidad con un formulario a medio llenar** → aviso de sesión caducada; el contenido no escrito no se conserva (RF-7).
- **Caducidad durante la carga de aproximadamente un segundo** → el aviso de caducidad sustituye al indicador de carga y no llega a mostrarse ningún dato (RF-7, RF-35).
- **Controles de simulación en P-1**: no se ofrecen, porque P-1 no tiene sesión ni datos que mostrar; se comprueba que no aparecen (RF-38).
- **Contador accede directamente a P-2 o P-3** → acceso denegado (RF-6).
- **Administrador accede directamente a P-4 o P-5** → acceso denegado (RF-6).
- **Registro sin cliente** → error, no se agrega (RF-22).
- **Registro sin prioridad** → error, no se agrega (RF-23).
- **Límite de longitud del cliente**: 80 caracteres se aceptan, 81 no; los espacios interiores y los caracteres especiales cuentan; un texto solo con espacios se rechaza (RF-22, RF-24).
- **Registro válido** → confirmación, formulario vacío en P-4 y control "Ver mis casos" (RF-21, RF-44).
- **Contador sin casos al entrar por primera vez** → P-5 muestra el mensaje de vacío y el control "Registrar caso", sin lista (RF-34, RF-43).
- **Contador con casos que abre P-4 y vuelve a P-5** → ve su lista completa, con el caso nuevo incluido (RF-43, RF-44).
- **Contador sin casos seleccionado en P-2** → mensaje de vacío propio de esa selección; al empezar, el contador `contador` sirve para verlo (RF-14).
- **Listas sin contadores en P-2 o P-3**: se recorren las dos pantallas completas y siempre aparece al menos la cuenta `contador`; no existe ningún control que permita dejar esas listas sin contadores (RF-45, RF-27).
- **Conteo en cero** → se muestra "0", nunca en blanco (RF-12).
- **Muchos contadores** → desplazamiento vertical en P-3, sin paginación (RNF-10).
- **Muchos casos** → desplazamiento vertical en P-2 y en el detalle de un contador con muchos casos, sin paginación (RNF-10); la cuenta `contador` sigue sin casos, así que P-5 no se usa para esta comprobación.
- **Nombres largos o con caracteres especiales** → se muestran completos, sin truncar (RNF-9).
- **Caso Finalizado** → se puede cambiar su estado a Pendiente o En proceso y su prioridad, sin restricción (RF-32).
- **Prioridad Alta con estado Finalizado** → combinación válida; se muestra la etiqueta Alta y el estado Finalizado, sin aviso ni bloqueo (Definiciones: prioridad independiente del estado).
- **Registrar un caso y volver a P-5** → el caso sigue presente durante la sesión, porque no hay eliminación ni persistencia que lo pierda (RF-41, RF-44).
- **Recargar** → la sesión se cierra, la maqueta vuelve a P-1 y los datos vuelven a los de ejemplo (RF-41).
- **Abrir otra pestaña** → la pestaña nueva empieza en P-1 sin sesión y los cambios de una pestaña no se propagan a otra (RF-41).
- **Error simulado** → se provoca con el control "Simular error" en P-2, P-3, P-4 o P-5, muestra mensaje con reintento y al reintentar se recuperan los datos de ejemplo (RF-37); P-1 no obtiene datos, por lo que no tiene el control.
- **Error simulado durante la carga de aproximadamente un segundo** → el mensaje de error sustituye al indicador de carga y no llega a mostrarse ningún dato (RF-35, RF-37).
- **Error simulado en P-2 con un detalle ya seleccionado** → el detalle deja de mostrarse y al reintentar P-2 vuelve sin contador seleccionado, para no mostrar información obsoleta (RF-37, RF-13).
- **Error simulado en P-4** → no se muestra el formulario y al reintentar aparece con el contador asignado y las opciones de prioridad (RF-19, RF-37).
- **Error simulado en P-5 sin casos** → primero el error y, al reintentar, el mensaje de vacío (RF-34, RF-37).
- **Fallo al cambiar estado o prioridad** → no se contempla en la maqueta (RF-39).
- **Botón "atrás" del navegador** → la navegación prevista se hace con los controles propios de la maqueta; el botón del navegador no forma parte del recorrido previsto (RF-40).

## Fuera de alcance

- Autenticación real, verificación de contraseñas, cuentas reales y cierre de sesión por seguridad.
- Cualquier cuenta o credencial distinta de las dos cuentas de ejemplo, y cualquier perfil distinto de administrador o contador.
- Estados vacíos de P-2 o P-3 por falta de contadores: no aplican, porque los datos de ejemplo incluyen siempre a la cuenta `contador`.
- Cualquier conexión con un servicio, base de datos o dispositivo externo.
- Persistencia entre recargas, cierres o pestañas, y sincronización entre pestañas (excepción al Principio 3 anotada en el Contexto).
- Caducidad automática de la sesión por tiempo o inactividad: la caducidad solo se provoca con el control de simulación.
- Alta, edición o eliminación de contadores; edición o eliminación de casos.
- Reglas de reparto o asignación automática de casos entre contadores.
- Búsqueda, filtros, ordenación, paginación y exportación.
- Notificaciones, recordatorios, reportes e históricos de cambios.
- Indicadores de prioridad distintos de la etiqueta de texto + color, e iconos o animaciones decorativas.
- Trabajo sobre servidores o comunicaciones.

## Criterios de finalización

Esta lista es, por sí sola, la comprobación completa de la maqueta: se recorre de principio a fin sobre la maqueta terminada.

1. Abrir la maqueta sin sesión: se muestra P-1 con su título y sin ningún dato de contadores ni de casos (RF-1, RF-9).
2. Enviar P-1 con un campo vacío o con solo espacios: se señala cada campo faltante y se permanece en P-1 (RF-3).
3. Enviar `Admin`/`admin123` y `admin`/`Admin123`: mensaje genérico de credenciales no válidas, sin indicar cuál dato falló, y se permanece en P-1 (RF-4).
4. Enviar `admin`/`admin123`: se abre P-2. Recargar la maqueta: la sesión se cierra y vuelve a P-1. Enviar `contador`/`contador123`: se abre P-5. En ningún caso se puede elegir el perfil a mano (RF-2, RF-8, RF-41).
5. Recorrer P-1, P-2, P-3, P-4 y P-5: cada una muestra un título visible distinto del de las demás (RNF-5).
6. Revisar los datos de ejemplo en P-2 y P-3: aparece siempre la cuenta `contador`, que no tiene casos; otro contador muestra casos en los tres estados; existe un contador con nombre largo y caracteres especiales; y existe un caso con cliente de nombre largo y caracteres especiales (RF-45).
7. En P-2: aparecen todos los contadores con sus tres conteos, con "0" donde no hay casos; el control "Ver directorio" abre P-3; P-3 muestra solo nombres; elegir un nombre abre P-2 con ese contador seleccionado y su detalle; el control de regreso vuelve a P-3 (RF-11, RF-12, RF-16, RF-17, RF-42, RF-40).
8. Seleccionar en P-2 el contador `contador`, que empieza sin casos: mensaje de vacío propio de la selección (RF-14).
9. En P-5 solo aparecen casos del contador que inició sesión; al entrar por primera vez esa lista está vacía y muestra el mensaje de vacío con el control "Registrar caso" (RF-28, RF-33, RF-34).
10. El control "Registrar caso" de P-5 abre P-4 con el cliente vacío, la prioridad sin elegir, el estado Pendiente y el contador asignado, ambos no editables (RF-19, RF-43).
11. Enviar P-4 sin cliente, con solo espacios, con 81 caracteres y sin prioridad: cada caso muestra un mensaje que identifica el dato que falta o excede el límite y no agrega el caso (RF-22, RF-23, RF-24).
12. Enviar P-4 con 80 caracteres de cliente y prioridad elegida: aparece la confirmación, el formulario queda vacío en P-4 y el control "Ver mis casos" abre P-5 con el caso nuevo; ese mismo caso se ve en el detalle y los conteos de P-2 durante la misma sesión (RF-21, RF-25, RF-44).
13. En P-5, cambiar el estado y la prioridad de un caso, incluido uno en estado Finalizado: se actualizan las etiquetas y los conteos, y aparece la confirmación del cambio (RF-30, RF-31, RF-32, RF-39).
14. Con sesión de administrador no existe ningún control para cambiar el estado o la prioridad de un caso (RF-13); con sesión de contador, ninguna pantalla muestra casos ni datos de otro contador (RNF-6, RF-33).
15. Con sesión, acceder directamente a la dirección de una pantalla de otro perfil: acceso denegado con opción de volver a la pantalla principal. Se comprueban los cuatro cruces: administrador hacia P-4 y hacia P-5, y contador hacia P-2 y hacia P-3 (RF-6).
16. Sin sesión, acceder directamente a la dirección de una pantalla interna: P-1 con aviso de que debe iniciar sesión (RF-5).
17. Al abrir cada pantalla con datos (P-2, P-3, P-4 y P-5): aparece el indicador de carga durante aproximadamente un segundo y no se muestran datos antes de terminar (RF-35).
18. El control "Simular error" en P-2, P-3, P-4 y P-5, incluido P-5 cuando está vacío: aparece un mensaje de error con las tres partes exigidas (qué ocurrió, sobre qué dato o acción, y qué hacer), con opción de reintentar; al reintentar se repite la carga y vuelve lo que correspondía, datos o mensaje de vacío; en P-4 no se ve el formulario mientras hay error y en P-2 el detalle seleccionado no se conserva (RF-37, RNF-1).
19. El control "Simular caducidad" en una pantalla interna: la sesión queda cerrada, la pantalla deja de mostrar sus datos y el aviso lleva a P-1, donde hay que iniciar sesión otra vez (RF-7).
20. Permanecer 5 minutos en una pantalla interna sin usar los controles de simulación: la sesión sigue activa y los datos siguen a la vista, porque la sesión no caduca por tiempo (Definiciones: Sesión simulada, RF-7).
21. Estados vacíos: con la cuenta `contador`, P-5 muestra su mensaje y el control para registrar, y el detalle de ese mismo contador en P-2 también se ve vacío (RF-34, RF-14, RF-36).
22. El contador de nombre largo y caracteres especiales se ve completo en P-2 y P-3, y el caso con cliente de nombre largo y caracteres especiales se ve completo en el detalle de P-2; el caso registrado en el paso 12 se ve completo en P-5, donde entonces sí hay lista (RNF-9).
23. En una ventana de 1024 × 768 px, P-2, P-3 y el detalle de un contador con muchos casos se recorren con desplazamiento vertical, sin paginación y sin perder filas de vista; la cuenta `contador` permanece sin casos, así que P-5 no participa en esta comprobación (RNF-10).
24. Revisar la lista completa de contadores, casos y clientes: todos son ficticios, coinciden con los datos de ejemplo definidos y ninguno es una persona real del equipo (RNF-4).
25. La prioridad se distingue por texto además de por color, con contraste mínimo de 4.5:1 (RNF-7).
26. El recorrido completo se puede hacer solo con teclado, con foco visible, sin desplazamiento horizontal a 360 px de ancho, con la ayuda contextual accesible por puntero, teclado y toque (RNF-2, RNF-3, RNF-8).
27. Dentro de una misma sesión, un cambio de estado o de prioridad se refleja en P-5 y en los conteos y el detalle de P-2; al recargar, la sesión se cierra y los datos vuelven a los de ejemplo (RF-41, RF-25, RF-30, RF-31).
28. La lógica de la maqueta (validación del registro, conteos por estado y cambios de estado y prioridad) pasa sus pruebas automatizadas en verde, sin tests fallando (constitución, Principio 2).
29. Con las 28 comprobaciones anteriores en verde y las excepciones de alcance anotadas en el Contexto (Principios 3 y 5, y campos sin esquema hasta que se defina la funcionalidad real), la spec queda lista para su aprobación.

## Dudas abiertas

- Ninguna. Todas resueltas (D-1 a D-9). Las excepciones de alcance acordadas quedaron anotadas en el Contexto: Principio 3 (sin persistencia en la maqueta), Principio 5 (contraseñas ficticias sin almacenar) y campos de P-4 sin esquema, que se definirá antes de la funcionalidad real.
