# Spec 003 — Frontend funcional conectado al backend
Estado: implementada

## Contexto y objetivo

La spec 001 definió una maqueta navegable con datos en memoria y sin backend. La spec 002 implementó el backend real con autenticación JWT, lectura y escritura de contadores y casos, y gestión de sesiones. Esta spec define el **frontend real que se conecta a ese backend**, reemplazando la maqueta: autenticación con credenciales reales, token de acceso almacenado en sessionStorage, caducidad de sesión por inactividad de 30 minutos medida desde el cliente, y consumo de los endpoints del backend para mostrar contadores, casos y conteos, y para permitir el registro y la actualización de casos.

Reglas de alcance que explican el porqué del recorte:

- Solo existen dos perfiles en el frontend y cada uno ve un conjunto distinto de pantallas: administrador (solo consulta) y contador (registra y actualiza sus propios casos).
- Nada se crea, edita ni elimina fuera de lo previsto: no se administran contadores ni se editan o eliminan casos desde el frontend.
- Todo cambio se refleja en todas las pantallas que muestren ese dato mientras la sesión activa permanece abierta.
- El backend permite únicamente orígenes de desarrollo web (localhost); el frontend se conecta solo a esos orígenes.

## Usuarios

- **Administrador**: consulta el estado general del equipo (conteo de casos por estado de cada contador y detalle de los casos de un contador). No registra casos, no cambia estados ni prioridades y no administra contadores: en todas las pantallas que ve, los casos son de solo lectura.
- **Contador**: autentica con sus credenciales, lee sus propios casos, registra casos nuevos (cliente y prioridad; el estado es siempre Pendiente y el contador asignado es quien autenticó) y cambia el estado y la prioridad de los casos que le pertenecen.
- No existen otros perfiles en el frontend: solo hay pantallas y datos para administrador y contador. Cualquier cuenta con un perfil distinto se trata como no autorizada y no da acceso a nada.

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

Los controles de navegación que hacen posible este recorrido son: "Ver directorio" en P-2, la selección de un nombre en P-3, "Registrar caso" en P-5 (también cuando P-5 no tiene casos), "Ver mis casos" en P-4, el control de regreso en toda pantalla interna (RF-38) y el control "Cerrar sesión" (RF-45) disponible en todas las pantallas internas (P-2 a P-5), que muestra diálogo de confirmación (RF-45) antes de ejecutar el cierre. No existe ningún control que lleve a una pantalla de otro perfil (RF-06), ni que edite o elimine casos ni contadores (RF-26). El control "Cerrar sesión" no es parte del recorrido entre pantallas: al confirmar, revoca con el backend y lleva a P-1 (RF-45/46); el control de regreso mantiene la sesión activa.

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

(HU de alta de usuarios y restablecimiento de contraseñas: queda para una spec posterior, 004 o similar. Véase Fuera de alcance.)

## Definiciones

- **Caso**: unidad de trabajo asignada a un contador y asociada a un cliente.
- **Cliente**: nombre de la persona o empresa para la que se trabaja el caso. Texto libre obligatorio: se ignoran los espacios al inicio y al final, y el texto restante debe tener entre 1 y 80 caracteres visibles, contando también los espacios interiores y los caracteres especiales. 80 caracteres se aceptan y 81 no.
- **Estado del caso**: avance del trabajo. Valores permitidos y únicos: **Pendiente**, **En proceso**, **Finalizado**. El estado inicial de todo caso nuevo es **Pendiente**.
- **Prioridad**: urgencia del caso, **independiente** del estado. Valores permitidos y únicos: **Alta**, **Media**, **Baja**. Cualquier combinación de estado y prioridad es válida.
- **Etiqueta de prioridad**: representación de la prioridad como texto ("Alta", "Media", "Baja") acompañado de un color. El texto siempre está presente; el color nunca es el único portador del significado.
- **Contador**: miembro del equipo que atiende casos y es el único que registra y actualiza casos.
- **Administrador**: usuario de solo consulta sobre el trabajo del equipo.
- **Cuenta de usuario**: cuenta registrada en el backend con rol administrador, contador o usuarios_de_sistema. Solo las cuentas con rol administrador o contador tienen pantallas en esta spec.
- **Credenciales**: usuario y contraseña tal como se escriben en P-1. Se ignoran los espacios al inicio y al final; un valor vacío o compuesto solo por espacios cuenta como campo faltante; la comparación distingue mayúsculas y minúsculas.
- **Pantalla principal del perfil**: P-2 para el perfil administrador y P-5 para el perfil contador. Es la pantalla que se abre al iniciar sesión y el destino que ofrece el aviso de acceso denegado.
- **Dirección de una pantalla**: texto único que identifica cada pantalla y que se puede escribir o pegar en la barra de direcciones del navegador para abrirla sin usar los controles de la aplicación. Es la vía prevista para comprobar el acceso denegado y la falta de sesión. El botón "atrás" del navegador no es una dirección: no abre una pantalla concreta y no forma parte del recorrido previsto.
- **Token de acceso**: credencial tipo JWT Bearer que el cliente envía en el encabezado Authorization de cada petición para identificar al usuario autenticado y su perfil. Tiene su propia expiración (campo exp) además de la caducidad por inactividad y el cierre de la pestaña.
- **sessionStorage**: almacén del navegador exclusivo de la pestaña abierta. El token de acceso se guarda aquí al iniciar sesión y permanece mientras la pestaña siga abierta (sobrevive a recargas de página, pero se limpia al cerrar la pestaña). Cada pestaña tiene su propio sessionStorage, por lo que no se comparten sesiones entre pestañas.
- **Sesión**: período durante el cual un usuario permanece identificado tras iniciar sesión válidamente. Una sesión puede caducar por inactividad de 30 minutos medida desde el cliente, por expiración propia del token (campo exp) o por cierre de la pestaña del navegador. **Cierre de sesión voluntario**: terminación de la sesión activa porque el usuario activa el control "Cerrar sesión" (tras confirmar en un diálogo) en cualquier pantalla interna (P-2 a P-5); implica revocación con `POST /auth/logout`, eliminación del token de sessionStorage, regreso a P-1 y aviso persistente.
- **Caducidad por inactividad**: ausencia de interacción del usuario durante 30 minutos, medida desde el cliente. Cada petición válida al backend reinicia el temporizador de inactividad; mientras el usuario sigue usando la aplicación (realiza peticiones válidas), la sesión activa no se pierde por inactividad.
- **Pantalla interna**: cualquiera de P-2 a P-5; requiere sesión iniciada.
- **Estado de interfaz**: representación de la pantalla mientras carga, cuando no hay información (vacío), cuando falla (error), cuando el acceso no está permitido (acceso denegado) y cuando la sesión caducó.
- **Cambio en la sesión activa**: modificación válida mientras la sesión permanece abierta (registro de caso, cambio de estado o prioridad); se refleja en las pantallas correspondientes durante la sesión activa.

## Requisitos funcionales

### Acceso y sesión

- RF-01: CUANDO un usuario abre la aplicación sin sesión iniciada, EL SISTEMA muestra P-1.
- RF-02: CUANDO un usuario envía credenciales válidas en P-1, EL SISTEMA inicia sesión, almacena el token de acceso en sessionStorage y abre la pantalla principal del perfil de esa cuenta: P-2 si es administrador y P-5 si es contador.
- RF-03: SI envía P-1 con el usuario o la contraseña faltantes (vacíos o con solo espacios), ENTONCES EL SISTEMA señala cada campo faltante y no avanza.
- RF-04: SI envía credenciales no vacías que no coinciden con ninguna cuenta registrada, ENTONCES EL SISTEMA muestra un mensaje genérico de credenciales no válidas, no indica cuál de los dos datos falló y no avanza.
- RF-05: SI un usuario sin sesión intenta abrir una pantalla interna (P-2 a P-5), ENTONCES EL SISTEMA lo lleva a P-1 con un aviso de que debe iniciar sesión.
- RF-06: SI un usuario con sesión accede directamente a la dirección de una pantalla de otro perfil (la aplicación no ofrece ningún control que lleve a ella), ENTONCES EL SISTEMA muestra acceso denegado y ofrece volver a la pantalla principal de su perfil.
- RF-07: MIENTRAS no hay interacción del usuario durante 30 minutos (inactividad medida desde el cliente), EL SISTEMA considera la sesión caducada, elimina el token de sessionStorage, cierra la sesión y muestra un aviso de sesión caducada con un acceso a P-1; mientras no se envíen credenciales de nuevo no hay sesión activa, así que volver a entrar exige iniciar sesión otra vez.
- RF-08: CUANDO un usuario inicia sesión con una cuenta, EL SISTEMA determina el perfil por esa cuenta y no ofrece ninguna forma de elegir el perfil manualmente.
- RF-09: MIENTRAS no hay sesión iniciada, EL SISTEMA no muestra información de contadores ni de casos.
- RF-10: CUANDO un usuario con sesión vuelve a P-1 mediante el control de regreso, EL SISTEMA no cierra su sesión; SI envía credenciales válidas de otra cuenta, ENTONCES EL SISTEMA cierra la sesión anterior con `POST /auth/logout` (best-effort), reemplaza el token en sessionStorage y aplica el perfil de la nueva cuenta. Este cierre no se produce tras una caducidad, porque entonces ya no hay sesión (RF-07).
- RF-45: CUANDO el usuario activa el control "Cerrar sesión" (disponible solo en P-2 a P-5 mientras haya sesión, siempre con ese mismo nombre, accesible por teclado con foco visible, área táctil ≥ 44 × 44 px y con ayuda contextual, RNF-02, RNF-03, RNF-07), EL SISTEMA muestra un diálogo de confirmación con dos acciones: "Cerrar sesión" y "Cancelar". SI el usuario confirma, ENTONCES se ejecuta RF-46. SI cancela, ENTONCES la sesión y la pantalla siguen igual; el contenido escrito en formularios no se pierde ni cambia nada de la sesión activa.
- RF-46: CUANDO el usuario confirma el diálogo de cierre, EL SISTEMA llama a `POST /auth/logout` (revocación persistente en el backend), elimina el token de sessionStorage, cierra la sesión y lleva a P-1 con un aviso persistente de que la sesión se cerró; después no se muestra información de contadores ni de casos (RF-09). El aviso permanece visible como texto hasta la siguiente acción del usuario (escribir o enviar credenciales en P-1).
- RF-47: SI `POST /auth/logout` falla por error de red o del servidor, ENTONCES EL SISTEMA cierra igualmente la sesión local (elimina el token), lleva a P-1 y muestra un aviso persistente con las tres partes de RNF-01: qué ocurrió: la sesión se cerró en este equipo pero no se pudo confirmar la revocación en el servidor; sobre qué: el cierre de sesión; qué hacer: iniciar sesión de nuevo cuando desee usar la aplicación. El usuario no ve datos internos sin una nueva sesión activa (RF-09).

### Token y gestión de la sesión

- RF-42: CUANDO un usuario inicia sesión válidamente en P-1, EL SISTEMA guarda el token de acceso en sessionStorage de la pestaña actual y, MIENTRAS la sesión esté activa, envía ese token en el encabezado Authorization como Bearer en cada petición al backend; la expiración propia del token (campo exp) se respeta y, al expirar, la sesión se considera caducada.
- RF-43: CUANDO la sesión caduca por inactividad de 30 minutos medida desde el cliente, EL SISTEMA elimina el token de sessionStorage, cierra la sesión y muestra un aviso de sesión caducada con acceso a P-1; lo mismo ocurre si el token expira por su campo exp mientras la pestaña permanece abierta. MIENTRAS el usuario sigue usando la aplicación (realiza peticiones válidas), la sesión activa no se pierde por inactividad.
- RF-44: CUANDO el usuario cierra la pestaña del navegador, EL SISTEMA limpia sessionStorage, la sesión queda cerrada y la aplicación vuelve a P-1 al abrirse de nuevo; cada pestaña tiene su propio sessionStorage, por lo que los cambios de una pestaña no se propagan a otra; al recargar la página, el token permanece en sessionStorage y la aplicación valida el token con el backend antes de mostrar la pantalla principal del perfil.

### Dashboard del administrador

- RF-11: CUANDO el administrador inicia sesión, EL SISTEMA muestra P-2 con todos los contadores registrados.
- RF-12: CUANDO el administrador abre P-2, EL SISTEMA muestra, por cada contador, el conteo de sus casos en cada estado (Pendiente, En proceso, Finalizado) y muestra el valor "0" cuando no hay casos en ese estado.
- RF-13: CUANDO el administrador selecciona un contador, EL SISTEMA muestra el detalle de los casos de ese contador con cliente, estado y prioridad (etiqueta de texto + color); el administrador no dispone de ningún control para modificar el estado ni la prioridad.
- RF-14: SI el contador seleccionado no tiene casos, ENTONCES EL SISTEMA muestra un mensaje de que ese contador no tiene casos.
- RF-15: CUANDO el administrador cambia de contador seleccionado, EL SISTEMA reemplaza el detalle anterior por el del nuevo contador.

### Directorio de contadores

- RF-16: CUANDO el administrador abre P-3, EL SISTEMA muestra solo el nombre de todos los contadores registrados, sin conteos ni casos.
- RF-17: CUANDO el administrador selecciona un nombre en P-3, EL SISTEMA abre P-2 con ese contador ya seleccionado y muestra el detalle de casos definido en RF-13.

### Registro de casos

- RF-18: CUANDO el contador abre P-4, EL SISTEMA muestra un formulario con cliente (texto libre) y prioridad (Alta, Media, Baja); el estado es Pendiente y el contador asignado es el contador que registra, ambos mostrados como información no editable.
- RF-19: CUANDO el contador abre P-4, EL SISTEMA presenta las tres prioridades con su etiqueta de texto y color.
- RF-20: CUANDO el contador envía un registro con cliente y prioridad válidos, EL SISTEMA crea el caso con estado Pendiente, asigna al contador que inició sesión como contador asignado, guarda el caso a través del backend, muestra una confirmación de que quedó registrado, deja el formulario vacío en P-4 y ofrece el control "Ver mis casos" (RF-41) para verlo en P-5.
- RF-21: SI el contador envía el registro sin cliente o con solo espacios, ENTONCES EL SISTEMA indica que el cliente es obligatorio y no agrega el caso.
- RF-22: SI el contador envía el registro sin prioridad elegida, ENTONCES EL SISTEMA indica que la prioridad es obligatoria y no agrega el caso.
- RF-23: SI el cliente supera los 80 caracteres, ENTONCES EL SISTEMA indica el máximo permitido y no agrega el caso.
- RF-24: CUANDO se agrega un caso, EL SISTEMA lo muestra en P-5 y en el detalle y los conteos de P-2 durante la sesión activa.
- RF-25: CUANDO el contador registra un caso, EL SISTEMA asigna el caso al contador que lo registra y no aplica ninguna regla de reparto de casos.
- RF-26: CUANDO el contador usa P-4 o P-5, EL SISTEMA no ofrece controles para editar o eliminar casos, ni para crear, editar o eliminar contadores.

### Vista del contador

- RF-27: CUANDO el contador inicia sesión, EL SISTEMA muestra P-5 con los casos asignados a él.
- RF-28: CUANDO el contador abre P-5, EL SISTEMA muestra, por cada caso, el cliente, el estado y la prioridad (etiqueta de texto + color).
- RF-29: CUANDO el contador cambia el estado de un caso, EL SISTEMA actualiza el caso y los conteos de P-2 en la sesión activa.
- RF-30: CUANDO el contador cambia la prioridad de un caso, EL SISTEMA actualiza la etiqueta mostrada en P-5 y en el detalle de P-2 en la sesión activa.
- RF-31: CUANDO el contador quiere cambiar el estado o la prioridad de un caso, EL SISTEMA permite cambiar el estado y la prioridad en cualquier momento, incluido un caso en estado **Finalizado**, sin restricciones ni confirmaciones adicionales.
- RF-32: MIENTRAS el usuario es contador, EL SISTEMA solo muestra los casos asignados a él.
- RF-33: SI el contador no tiene casos, ENTONCES EL SISTEMA muestra un mensaje de que no tiene casos registrados y el control "Registrar caso" (RF-40) para crear el primero.

### Estados de interfaz

- RF-34: CUANDO el usuario abre una pantalla que muestra datos (P-2, P-3, P-4 o P-5), EL SISTEMA muestra un indicador de carga mientras obtiene los datos del backend y, hasta terminar, no muestra datos incompletos ni datos anteriores.
- RF-35: SI no hay información que mostrar en una pantalla, ENTONCES EL SISTEMA muestra un mensaje de vacío que indica qué información falta. Los estados vacíos previstos son P-5 sin casos (RF-33) y el detalle de un contador sin casos (RF-14).
- RF-36: CUANDO una operación de lectura o escritura falla por error de red o del servidor, EL SISTEMA muestra un mensaje de error con las tres partes comprobables (qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario a continuación) y ofrece reintentar; al reintentar, EL SISTEMA repite la operación y vuelve a mostrar lo que corresponda: los datos o el mensaje de vacío. En P-4 el error impide ver el formulario. En P-2 el detalle seleccionado no se conserva: al recuperarse, P-2 se muestra sin contador seleccionado.
- RF-37: CUANDO un cambio de estado o de prioridad se completa, EL SISTEMA lo confirma visualmente.
- RF-38: CUANDO el usuario está en una pantalla interna (P-2 a P-5), EL SISTEMA ofrece un control para volver a la pantalla anterior del recorrido.

### Navegación

- RF-39: CUANDO el administrador activa el control "Ver directorio" en P-2, EL SISTEMA abre P-3.
- RF-40: CUANDO el contador está en P-5, EL SISTEMA ofrece el control "Registrar caso" tanto si la lista tiene casos como si está vacía; CUANDO el contador lo activa, EL SISTEMA abre P-4.
- RF-41: CUANDO el contador activa el control "Ver mis casos" en P-4, EL SISTEMA abre P-5.

## Requisitos no funcionales

- RNF-01: EL SISTEMA usa en toda la interfaz los términos de la sección Definiciones, nombra cada acción siempre igual y todo mensaje de error contiene tres partes comprobables: qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario a continuación. No se admiten mensajes que solo digan "Error".
- RNF-02: EL SISTEMA se usa sin desplazamiento horizontal desde 360 px de ancho, presenta una sola columna por debajo de 600 px, una sola columna con ancho máximo de 720 px centrada entre 600 px y 1023 px, y varias columnas a partir de 1024 px, y ofrece controles táctiles con un área de al menos 44 × 44 px.
- RNF-03: EL SISTEMA ofrece texto de ayuda contextual en, como mínimo: las tres prioridades (qué significa cada una), los tres estados (qué significa cada uno), cada conteo (qué está contando), el campo cliente, el campo prioridad, el registro de un caso, el mensaje de acceso denegado y el de sesión caducada; esa ayuda se muestra con puntero, con foco de teclado y con toque en pantallas táctiles.
- RNF-04: EL SISTEMA identifica cada pantalla con un título visible y distinto.
- RNF-05: EL SISTEMA no muestra a un perfil información que pertenece a otro, ni siquiera como conteo o nombre.
- RNF-06: EL SISTEMA muestra la prioridad como texto acompañado de color: **Alta** en rojo, **Media** en ámbar y **Baja** en verde, con un contraste mínimo de 4.5:1 entre texto y fondo y sin usar el color como único portador del significado.
- RNF-07: EL SISTEMA permite completar todo el recorrido solo con teclado, con foco visible en todo momento, etiqueta textual asociada a cada campo y avisos de carga, error, acceso denegado, sesión caducada y cambio confirmado expresados como texto.
- RNF-08: EL SISTEMA muestra los nombres largos o con caracteres especiales completos, ajustando el texto a varias líneas, sin recortar información esencial.
- RNF-09: EL SISTEMA muestra las listas largas (muchos contadores o muchos casos) con desplazamiento vertical y sin paginación.

## Casos límite

- **Sin sesión**: abrir la aplicación o una pantalla interna sin sesión → P-1 (RF-01, RF-05).
- **Campos vacíos en P-1**: uno o ambos campos vacíos o con solo espacios → se señalan los faltantes y no avanza (RF-03).
- **Credenciales inválidas**: datos no vacíos que no coinciden con ninguna cuenta registrada → mensaje genérico de credenciales no válidas y no avanza (RF-04).
- **Mayúsculas y minúsculas**: la comparación de credenciales distingue mayúsculas y minúsculas.
- **Perfil no reconocido**: credenciales válidas de un perfil sin pantalla en esta spec (por ejemplo, usuarios_de_sistema) no son credenciales inválidas (RF-04 no aplica). El frontend muestra acceso denegado con un aviso de que el perfil no tiene pantalla asignada y ofrece volver a P-1 para iniciar sesión con otra cuenta.
- **Credenciales válidas de otro perfil estando ya dentro**: al enviarlas de nuevo en P-1 se cierra la sesión anterior y se aplica el perfil nuevo (RF-10).
- **Caducidad por inactividad (30 minutos sin interacción, medida desde el cliente)**: sesión caducada, token eliminado de sessionStorage, aviso de sesión caducada con acceso a P-1, hay que iniciar sesión otra vez (RF-07).
- **Caducidad con un formulario a medio llenar**: aviso de sesión caducada; el contenido no escrito no se conserva (RF-07).
- **Caducidad durante la carga**: el aviso de caducidad sustituye al indicador de carga y no llega a mostrarse ningún dato (RF-07, RF-34).
- **Credenciales válidas reenviadas tras una caducidad**: P-1 alcanzado por caducidad no tiene sesión, así que el envío se comporta como un inicio de sesión normal (RF-07, RF-10).
- **Recargar la página**: la sesión se mantiene (el token permanece en sessionStorage mientras la pestaña esté abierta), la aplicación recarga y valida el token con el backend; si el token es válido, se vuelve a la pantalla principal del perfil (RF-42).
- **Cerrar la pestaña**: sessionStorage se limpia, la sesión queda cerrada y la aplicación vuelve a P-1 (RF-44).
- **Abrir otra pestaña**: la pestaña nueva empieza en P-1 sin sesión (sessionStorage es independiente por pestaña) y los cambios de una pestaña no se propagan a otra (RF-44).
- **Contador accede directamente a P-2 o P-3** → acceso denegado (RF-06).
- **Administrador accede directamente a P-4 o P-5** → acceso denegado (RF-06).
- **Registro sin cliente** → error, no se agrega (RF-21).
- **Registro sin prioridad** → error, no se agrega (RF-22).
- **Límite de longitud del cliente**: 80 caracteres se aceptan, 81 no; los espacios interiores y los caracteres especiales cuentan; un texto solo con espacios se rechaza (RF-21, RF-23).
- **Registro válido** → confirmación, formulario vacío en P-4 y control "Ver mis casos" (RF-20, RF-41).
- **Contador sin casos al entrar por primera vez** → P-5 muestra el mensaje de vacío y el control para registrar, sin lista (RF-33, RF-40).
- **Contador con casos que abre P-4 y vuelve a P-5** → ve su lista completa, con el caso nuevo incluido (RF-40, RF-41).
- **Contador sin casos seleccionado en P-2** → mensaje de vacío propio de esa selección (RF-14).
- **Conteo en cero** → se muestra "0", nunca en blanco (RF-12).
- **Muchos contadores** → desplazamiento vertical en P-3, sin paginación (RNF-09).
- **Muchos casos** → desplazamiento vertical en P-2 y en el detalle de un contador con muchos casos, sin paginación (RNF-09).
- **Nombres largos o con caracteres especiales** → se muestran completos, sin truncar (RNF-08).
- **Caso Finalizado** → se puede cambiar su estado a Pendiente o En proceso y su prioridad, sin restricción (RF-31).
- **Prioridad Alta con estado Finalizado** → combinación válida; se muestra la etiqueta Alta y el estado Finalizado, sin aviso ni bloqueo (prioridad independiente del estado).
- **Registrar un caso y volver a P-5** → el caso sigue presente durante la sesión activa, porque no hay eliminación (RF-24, RF-41).
- **Error de red o del servidor** → mensaje de error con las tres partes y opción de reintentar; al reintentar se repite la operación (RF-36).
- **Error durante la carga** → el mensaje de error sustituye al indicador de carga y no llega a mostrarse ningún dato (RF-34, RF-36).
- **Error en P-2 con un detalle ya seleccionado** → el detalle deja de mostrarse y al reintentar P-2 vuelve sin contador seleccionado, para no mostrar información obsoleta (RF-36, RF-13).
- **Error en P-4** → no se muestra el formulario y al reintentar aparece con el contador asignado y las opciones de prioridad (RF-18, RF-36).
- **Error en P-5 sin casos** → primero el error y, al reintentar, el mensaje de vacío (RF-33, RF-36).
- **Fallo al cambiar estado o prioridad** → el backend lo rechaza y el frontend muestra el mensaje de error con reintentar (RF-29, RF-30, RF-36).
- **Botón "atrás" del navegador** → la navegación prevista se hace con los controles propios de la aplicación; el botón del navegador no forma parte del recorrido previsto (RF-38).
- **Cerrar sesión voluntario (RF-45)** → al activar el control aparece el diálogo de confirmación (RF-45); si confirma, se ejecuta RF-46 (revoca, borra token, va a P-1, aviso persistente, sin datos internos) y el contenido no escrito en formularios no se conserva (como en caducidad, RF-07); si cancela, la sesión, la pantalla y cualquier contenido escrito en formularios siguen igual. El control está disponible en P-2 a P-5, siempre con ese mismo nombre, con acceso por teclado, foco visible, área táctil ≥ 44 × 44 px y tooltip (RNF-02, RNF-03, RNF-07); no aparece en P-1.
- **Cerrar sesión con backend caído (RF-47)** → si `POST /auth/logout` falla por red o servidor, el sistema cierra la sesión local igual, lleva a P-1 con aviso persistente de tres partes (RNF-01) que indica cierre local y recomienda iniciar sesión de nuevo; la sesión queda cerrada y no hay datos internos (RF-09).
- **Cerrar sesión con dirección interna pegada** → tras confirmar el cierre, al abrir la dirección de P-2/P-3/P-4/P-5 sin sesión, el sistema lleva a P-1 con aviso de que debe iniciar sesión (RF-05).
- **Cerrar sesión y regresar con botón de navegador** → el botón "atrás" no restaura la sesión; si el token ya no está en sessionStorage, la pantalla interna muestra P-1 con aviso (RF-05, RF-09).
- **Cerrar sesión durante una carga** → si hay una carga en curso al confirmar el cierre, la carga se descarta; al ir a P-1 no llega a mostrarse ningún dato incompleto (como en caducidad, RF-07).
- **Cerrar sesión con la sesión ya caducada** → si la sesión ya caducó (token eliminado por inactividad o `exp`), el control "Cerrar sesión" no está disponible porque no hay sesión activa; la pantalla interna muestra el aviso de sesión caducada (RF-07) y lleva a P-1.
- **Cancelar el diálogo de confirmación** → la sesión y la pantalla siguen igual; cualquier contenido escrito en formularios se conserva y la sesión activa permanece abierta.

## Fuera de alcance

- Pantallas de alta de usuarios y restablecimiento de contraseñas para administrador y usuarios_de_sistema: quedan para una spec posterior (004 o similar).
- Controles de simulación ("Simular caducidad" y "Simular error" de la spec 001): eliminados, no forman parte de esta spec.
- Persistencia de sesión entre pestañas del navegador: sessionStorage es independiente por pestaña; los cambios de una pestaña no se propagan a otra.
- Cierre de sesión persistente del token en el backend (revocación): pertenece al backend (spec 002); para el cierre voluntario (RF-45) el frontend sí llama a `POST /auth/logout` (revoca persistente), pero sigue sin gestionar revocaciones globales ni restablecimientos de contraseña; la caducidad por inactividad y el cierre de la pestaña siguen siendo solo eliminar el token del cliente (sin llamada al backend).
- Búsqueda, filtros, ordenación, paginación y exportación.
- Notificaciones, recordatorios, reportes e históricos de cambios.
- Indicadores de prioridad distintos de la etiqueta de texto + color, e iconos o animaciones decorativas.
- Conexión con orígenes CORS distintos de localhost desarrollo (el backend permite únicamente orígenes de desarrollo web).

## Criterios de finalización

Esta lista es, por sí sola, la comprobación completa del frontend funcional: se recorre de principio a fin sobre la aplicación terminada.

1. Abrir la aplicación sin sesión: se muestra P-1 con su título y sin ningún dato de contadores ni de casos (RF-01, RF-09).
2. Enviar P-1 con un campo vacío o con solo espacios: se señala cada campo faltante y se permanece en P-1 (RF-03).
3. Enviar credenciales incorrectas: mensaje genérico de credenciales no válidas, sin indicar cuál dato falló, y se permanece en P-1 (RF-04).
4. Enviar credenciales válidas de administrador: se abre P-2. Enviar credenciales válidas de contador: se abre P-5. Recargar la página: la sesión se mantiene mientras la pestaña esté abierta. Cerrar la pestaña: la sesión se cierra y vuelve a P-1. Activar "Cerrar sesión" en cualquier pantalla interna: se cierra la sesión, se revoca con el backend y vuelve a P-1 (RF-45, RF-46). En ningún caso se puede elegir el perfil a mano (RF-02, RF-08, RF-10, RF-42, RF-44).
5. Recorrer P-1, P-2, P-3, P-4 y P-5: cada una muestra un título visible distinto del de las demás (RNF-04).
6. Revisar los datos en P-2 y P-3: aparecen los contadores registrados; al seleccionar un contador se ve su detalle con cliente, estado y prioridad; al cambiar de contador seleccionado se reemplaza el detalle; un contador sin casos muestra su mensaje de vacío (RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17).
7. En P-2: aparecen todos los contadores con sus tres conteos, con "0" donde no hay casos; el control "Ver directorio" abre P-3; P-3 muestra solo nombres; elegir un nombre abre P-2 con ese contador seleccionado y su detalle; el control de regreso vuelve a P-3 (RF-12, RF-38, RF-39).
8. En P-5 solo aparecen casos del contador que inició sesión; al entrar por primera vez esa lista está vacía y muestra el mensaje de vacío con el control "Registrar caso"; por cada caso se ve el cliente, el estado y la prioridad (etiqueta de texto + color) (RF-27, RF-28, RF-32, RF-33).
9. El control "Registrar caso" de P-5 abre P-4 con el cliente vacío, la prioridad sin elegir, el estado Pendiente y el contador asignado, ambos no editables; en P-4 se muestran las tres prioridades con su etiqueta de texto y color (RF-18, RF-19, RF-40).
10. Enviar P-4 sin cliente, con solo espacios, con 81 caracteres y sin prioridad: cada caso muestra un mensaje que identifica el dato que falta o excede el límite y no agrega el caso (RF-21, RF-22, RF-23).
11. Enviar P-4 con 80 caracteres de cliente y prioridad elegida: aparece la confirmación, el formulario queda vacío en P-4 y el control "Ver mis casos" abre P-5 con el caso nuevo; el caso se asigna al contador que lo registra sin regla de reparto y se ve en el detalle y los conteos de P-2 durante la sesión activa (RF-20, RF-24, RF-25, RF-41).
12. En P-5, cambiar el estado y la prioridad de un caso, incluido uno en estado Finalizado: se actualizan las etiquetas y los conteos, y aparece la confirmación del cambio (RF-29, RF-30, RF-31, RF-37).
13. Con sesión de administrador no existe ningún control para cambiar el estado o la prioridad de un caso (RF-13); con sesión de contador, ninguna pantalla muestra casos ni datos de otro contador (RNF-05, RF-32); el sistema no ofrece controles para editar o eliminar casos, ni para crear, editar o eliminar contadores (RF-26).
14. Con sesión, acceder directamente a la dirección de una pantalla de otro perfil: acceso denegado con opción de volver a la pantalla principal. Se comprueban los cuatro cruces: administrador hacia P-4 y hacia P-5, y contador hacia P-2 y hacia P-3 (RF-06).
15. Sin sesión, acceder directamente a la dirección de una pantalla interna: P-1 con aviso de que debe iniciar sesión (RF-05).
16. Al abrir cada pantalla con datos (P-2, P-3, P-4 y P-5): aparece el indicador de carga mientras se obtienen los datos del backend y no se muestran datos antes de terminar (RF-34).
17. Cuando una operación falla por error de red o del servidor: aparece un mensaje de error con las tres partes exigidas (qué ocurrió, sobre qué dato o acción, y qué hacer), con opción de reintentar; al reintentar se repite la operación y vuelve lo que correspondía, datos o mensaje de vacío; en P-4 no se ve el formulario mientras hay error y en P-2 el detalle seleccionado no se conserva (RF-36, RNF-01).
18. Un cambio de estado o de prioridad se confirma visualmente al completarse (RF-37).
19. Permanecer 30 minutos sin interacción en una pantalla interna: la sesión se considera caducada, el token se elimina de sessionStorage, la pantalla deja de mostrar sus datos y el aviso lleva a P-1, donde hay que iniciar sesión otra vez (RF-07, RF-43).
20. Cerrar la pestaña del navegador: sessionStorage se limpia, la sesión queda cerrada y al abrir la aplicación de nuevo se muestra P-1 (RF-44).
21. Abrir otra pestaña: empieza en P-1 sin sesión y los cambios de una pestaña no se propagan a otra (sessionStorage independiente por pestaña) (RF-44).
22. Estados vacíos: con una cuenta de contador sin casos, P-5 muestra su mensaje y el control para registrar, y el detalle de ese mismo contador en P-2 también se ve vacío (RF-33, RF-14, RF-35).
23. El contador de nombre largo y caracteres especiales se ve completo en P-2 y P-3, y el caso con cliente de nombre largo y caracteres especiales se ve completo en el detalle de P-2; el caso registrado en el paso 11 se ve completo en P-5, donde entonces sí hay lista (RNF-08).
24. En una ventana de 1024 × 768 px, P-2, P-3 y el detalle de un contador con muchos casos se recorren con desplazamiento vertical, sin paginación y sin perder filas de vista (RNF-09).
25. Revisar que no existan controles "Simular caducidad" ni "Simular error" en ninguna pantalla: se comprueba que no aparecen en P-1 ni en las pantallas internas (decisión de eliminar controles de simulación).
26. La prioridad se distingue por texto además de por color, con contraste mínimo de 4.5:1 (RNF-06).
27. El recorrido completo se puede hacer solo con teclado, con foco visible, sin desplazamiento horizontal a 360 px de ancho, con la ayuda contextual accesible por puntero, teclado y toque (RNF-02, RNF-03, RNF-07).
28. Dentro de una misma sesión, un cambio de estado o de prioridad se refleja en P-5 y en los conteos y el detalle de P-2 (RF-24, RF-29, RF-30).
29. El token de acceso se guarda en sessionStorage al iniciar sesión, se elimina al cerrar la pestaña, al caducar la sesión por inactividad o al activar "Cerrar sesión" (RF-42, RF-43, RF-44, RF-45, RF-46).
30. Todos los requisitos funcionales RF-01 a RF-47 y los requisitos no funcionales RNF-01 a RNF-09 se comprueban individualmente en los pasos anteriores y la spec queda lista para su aprobación.
31. El control "Cerrar sesión" aparece en P-2 a P-5 (no en P-1) con el mismo nombre, accesible por teclado con foco visible, área táctil ≥ 44 × 44 px y con tooltip (RNF-02, RNF-03, RNF-07); al activarlo muestra el diálogo de confirmación; al confirmar cierra la sesión con revocación (RF-46) y al cancelar no cambia nada; si `POST /auth/logout` falla, el cierre local sigue con aviso persistente de tres partes (RF-47, RNF-01).

## Dudas abiertas

Todas resueltas. No quedan dudas abiertas en esta spec.

## Decisiones tomadas

- Se eliminan los controles de simulación ("Simular caducidad" y "Simular error") de la spec 001; no forman parte de esta spec. (Decisión del usuario #1)
- El token de acceso se almacena en sessionStorage y la caducidad se detecta por inactividad de 30 minutos medida desde el cliente; cada petición válida reinicia el temporizador de inactividad. Al cerrar la pestaña, sessionStorage se limpia y la sesión queda cerrada. (Decisión del usuario #2)
- Las pantallas de alta de usuarios y restablecimiento de contraseñas quedan para una spec posterior (004 o similar); no forman parte de esta spec. (Decisión del usuario #3)
- El backend permite únicamente orígenes de desarrollo web (localhost); el frontend se conecta solo a esos orígenes. (Decisión del usuario #4)
- Se añade el control "Cerrar sesión" (RF-45, RF-46, RF-47): "si el usuario requiere cerrar sesion y no solo se expire el token el usuario debe poder hacerlo cuando el mismo lo requiera" (decisión del usuario #5). El control está en P-2 a P-5 (no en P-1), siempre con ese mismo nombre, con diálogo de confirmación (confirmar / cancelar): confirmar revoca con `POST /auth/logout` (best-effort), borra sessionStorage, lleva a P-1 con aviso persistente; cancelar no cambia la sesión ni los datos escritos; si el backend falla, el cierre local sigue con aviso persistente de tres partes (RNF-01). La caducidad por inactividad y el cierre de pestaña siguen sin llamar al backend (solo borran el token del cliente).
