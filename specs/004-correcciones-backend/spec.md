# Spec 004 — Correcciones del backend (robustez, restablecimiento de contraseña, fechas y mayúsculas)
Estado: completada (T1-T32 implementadas; validación SDD final del revisor independiente: APROBADO; 162/162 pruebas, verificador 162 de 159 OK)

## Contexto y objetivo

DelGrow Estado Contadores es la herramienta con la que el equipo conoce el estado de urgencia de los casos de sus contadores. La spec 002 definió e implementó el backend con autenticación, sesiones, lectura de contadores, casos y conteos, y escritura de casos; sus Cambios 1 y 2 están implementados y aprobados por el reviewer.

Al revisar ese backend ya implementado se detectaron seis incumplimientos o huecos: (1) entradas no textuales en el inicio de sesión (por ejemplo, un usuario o una contraseña enviados como número) que dejan la petición sin respuesta y pueden llegar a detener el proceso del servidor, de modo que este deja de atender peticiones; (2) errores de base de datos que se ignoran al registrar la sesión, al actualizar su actividad y al revocarla, de modo que un cierre de sesión podría avisar de éxito sin haber invalidado el token; (3) el rol de contador no se exige al cambiar el estado o la prioridad de un caso, de modo que un administrador o un usuarios_de_sistema puede recibir «no encontrado» sobre un caso inexistente en lugar de acceso denegado; (4) el restablecimiento de contraseñas que ya exigía la spec 002 (RF-28 y su criterio 9) no está implementado: hoy solo existe el alta de usuarios; (5) las fechas de las respuestas se devuelven como cadenas ISO en UTC (por ejemplo, «2026-10-20T20:42:21.000Z») y no en hora local con el formato «YYYY-MM-DD HH:mm:ss»; y (6) el nombre de usuario del inicio de sesión no distingue mayúsculas y minúsculas, porque la comparación en la base de datos no las distingue.

El usuario aprobó corregir esos seis puntos y añadió cuatro extensiones: la regla de entradas no textuales se aplica a todos los endpoints con cuerpo (alta de usuario, restablecimiento de contraseña, registro de caso y cambio de caso, además del inicio de sesión); cada inicio de sesión emite un token propio e independiente (RF-41), sin el cual el registro de sesión del segundo inicio de sesión del mismo usuario fallaría siempre; el alta rechaza los nombres de usuario duplicados que solo se diferencian en mayúsculas y minúsculas (RF-45), de modo que no pueden coexistir cuentas como «Ana» y «ana»; y todo fallo interno responde con el aviso de servicio no disponible sin detener el servidor (RF-47, RNF-8).

Objetivo: dejar el backend en un estado en el que toda petición reciba siempre respuesta, ningún éxito se confirme sin haberse guardado, las fechas se devuelvan en hora local, el acceso se compare exactamente, el restablecimiento de contraseña exista y un perfil sin permiso de escritura no pueda deducir qué casos existen.

Esta spec se separó de la spec 002 para cerrar 002 con los Cambios 1 y 2 y no seguir ampliándola; su contenido es exactamente el que el usuario aprobó como Cambio 3 de la spec 002.

### Relación con la spec 002

- **Dependencia:** esta spec presupone la spec 002 implementada y aprobada en sus Cambios 1 y 2 (autenticación, sesiones, lectura de contadores, casos y conteos, escritura de casos, protección de datos de acceso y orígenes permitidos). No repite ese alcance: solo corrige y añade lo que aquí se describe.
- **Numeración:** los identificadores continúan la numeración de la spec 002 (RF-01 a RF-35 y RNF-1 a RNF-7 ya existen y no se reenumeran).
- **Requisitos:** esta spec define RF-36 a RF-48 y RNF-8, y reescribe por completo RF-05, RF-09, RF-16, RF-30, RF-41, RNF-2 y RNF-4. Cuando esta spec se implemente, este texto es el vigente y sustituye a cualquier redacción anterior de la spec 002.
- **Criterios:** esta spec añade los criterios de finalización 31 a 44 y reescribe por completo los criterios 9, 13 y 23. Los demás criterios de la spec 002 no cambian y, junto con estos, forman el cierre del backend.

## Usuarios

- **Administrador**: solo consulta. Lee la lista de contadores, los casos de cada contador y los conteos de casos por estado. No registra casos, no cambia estados ni prioridades y no administra contadores. Está autorizado, junto con usuarios_de_sistema, para dar de alta usuarios y restablecer contraseñas.
- **Contador**: autentica con sus credenciales, lee sus propios casos, registra casos nuevos y cambia el estado y la prioridad de los casos que le pertenecen.
- **usuarios_de_sistema**: perfil de soporte. Está autorizado, junto con el administrador, para dar de alta usuarios y restablecer contraseñas. No tiene otras capacidades definidas.
- No existen otros perfiles.

## Historias de usuario

- HU-7. Como usuario, quiero que un dato enviado con un tipo incorrecto reciba un error claro y que la petición nunca quede colgada ni detenga el servidor, para poder corregir el dato y seguir trabajando.
- HU-8. Como usuario, quiero que un fallo interno se informe como servicio no disponible y que nunca se me confirme un éxito que no quedó guardado, para no perder una sesión activa ni creer que una operación se completó.
- HU-9. Como administrador o usuarios_de_sistema, quiero restablecer la contraseña de una cuenta existente sin conocer la anterior y sin dejar sesiones abiertas con la contraseña antigua, para devolver el acceso a quien lo perdió.
- HU-10. Como usuario, quiero que las fechas lleguen en hora local con el formato acordado, para leerlas sin conversiones ni desfases.
- HU-11. Como usuario, quiero que mi nombre de usuario se compare exactamente, para que nadie acceda con una capitalización distinta de la registrada.
- HU-12. Como usuario sin permiso de escritura, quiero que se me deniegue el acceso antes de saber si un caso existe, para que la respuesta no revele información del equipo.

## Definiciones

- **Entrada inválida**: dato de la petición con un tipo o una forma que no se esperan: un dato que debe ser texto (usuario, contraseña, rol, cliente, prioridad o estado) enviado como número, objeto, lista o booleano, o un cuerpo que no se puede interpretar como JSON bien formado. Un dato nulo o ausente no es entrada inválida: se trata como dato que falta.
- **Fallo interno**: error inesperado del servidor al atender una operación (por ejemplo, un fallo de la base de datos) que no se debe a los datos que envió el usuario.
- **Fallo de persistencia de sesión**: fallo interno en el que la base de datos no permite registrar, consultar, renovar o invalidar una sesión; es un caso particular de fallo interno.
- **Aviso de servicio no disponible**: mensaje de error de tres partes que indica que el servicio no pudo completar la operación y que debe intentarlo de nuevo en unos momentos. Es el aviso que se devuelve ante un fallo interno.
- **Avisos del backend**: mensajes de tres partes que se distinguen por su significado y por el código HTTP con el que responden. **Entrada inválida** → **400**. **Sin sesión, sesión caducada o credenciales incorrectas** → **401**. **Acceso denegado** → **403**. **No encontrado** (la información solicitada —contador, caso o cuenta— no existe) → **404**. **Servicio no disponible** (fallo interno) → **503**. Ninguna respuesta usa el código 500.
- **Datos de acceso**: información con la que se autentica una cuenta y que nunca debe salir del servidor; incluye el hash de contraseña y cualquier otro dato derivado de la contraseña. No incluye el token de acceso, que solo se entrega al propio usuario al iniciar sesión.
- **Restablecimiento de contraseña**: sustitución de la contraseña de una cuenta existente por una nueva, sin exigir la contraseña anterior, realizada por un perfil autorizado (administrador o usuarios_de_sistema).
- **Hora local**: hora del servidor, con formato YYYY-MM-DD HH:mm:ss, sin marca de zona horaria y sin formato ISO.
- **Nombre de usuario exacto**: nombre comparado carácter por carácter, con las mismas mayúsculas y minúsculas con las que se registró la cuenta.

## Requisitos funcionales

### Acceso y sesión

- RF-36: SI el nombre de usuario que se envía al iniciar sesión no coincide exactamente, carácter por carácter y con las mismas mayúsculas y minúsculas, con el nombre registrado de una cuenta, ENTONCES EL SISTEMA rechaza el acceso con el mensaje genérico de credenciales no válidas (RF-03) y no inicia sesión; la contraseña también se compara distinguiendo mayúsculas y minúsculas, y las cuentas del seed solo entran con su nombre exacto (RNF-3).

### Entradas y respuestas

- RF-37: SI un dato que debe ser texto (usuario, contraseña, rol, cliente, prioridad o estado) llega con otro tipo (número, objeto, lista o booleano), ENTONCES EL SISTEMA rechaza la petición como entrada inválida con un mensaje de error de tres partes que indica qué dato es inválido y que debe enviarse como texto, no ejecuta la operación y responde siempre a la petición, que nunca queda pendiente sin respuesta; la misma regla se aplica al inicio de sesión, al alta de usuario, al restablecimiento de contraseña, al registro de caso y al cambio de caso. SI el cuerpo de la petición no es un JSON bien formado, ENTONCES EL SISTEMA responde con un error de entrada inválida de tres partes que indica que el cuerpo no es válido y que debe enviarse un JSON bien formado, no con un error interno del servidor. Un dato nulo o ausente se trata como dato que falta.
- RF-47: SI una operación falla por un fallo interno (por ejemplo, un fallo de la base de datos al buscar el usuario en el inicio de sesión, al leer casos o al guardar un caso), ENTONCES EL SISTEMA responde con el aviso de servicio no disponible (error de tres partes), no confirma ningún éxito que no haya quedado guardado, no deja la petición sin respuesta y no detiene el servidor, que sigue atendiendo las peticiones siguientes. RF-38, RF-39 y RF-40 son casos particulares de esta regla.

### Fallos al gestionar la sesión

- RF-38: SI al iniciar sesión con credenciales válidas no se puede registrar la sesión de forma persistente (fallo de persistencia de sesión), ENTONCES EL SISTEMA no devuelve token de acceso, no confirma el inicio de sesión y responde con el aviso de servicio no disponible (caso particular de RF-47); nunca entrega un token al que no corresponda una sesión registrada.
- RF-39: SI al cerrar la sesión no se puede invalidar el token de forma persistente, ENTONCES EL SISTEMA no confirma el cierre de sesión y responde con el aviso de servicio no disponible, indicando que la sesión no se cerró y que debe intentarlo de nuevo; el cierre solo se confirma cuando la invalidación quedó guardada.
- RF-40: SI al atender una petición con token válido no se puede consultar o renovar la sesión (fallo de persistencia de sesión), ENTONCES EL SISTEMA no atiende la operación, responde con el aviso de servicio no disponible, no avisa de sesión caducada y no invalida la sesión, de modo que el mismo token vuelve a servir cuando la base de datos se recupera (RNF-4).

### Token propio por inicio de sesión

- RF-41: CUANDO un usuario inicia sesión, EL SISTEMA emite un token de acceso propio, distinto de cualquier otro emitido antes e independiente del resto, incluso si el mismo usuario inicia sesión varias veces en el mismo instante; cerrar o caducar una sesión no afecta a las demás sesiones del mismo usuario, salvo el restablecimiento de la contraseña del usuario, que invalida todas sus sesiones (RF-42).

### Alta de usuarios y restablecimiento de contraseñas

- RF-42: CUANDO un perfil autorizado (administrador o usuarios_de_sistema) solicita restablecer la contraseña de una cuenta existente, EL SISTEMA identifica esa cuenta por el nombre de usuario exacto recibido, comparado con las mismas mayúsculas y minúsculas que en el inicio de sesión (RF-36), guarda la contraseña nueva hasheada con Argon2id (RNF-1), deja de aceptar la contraseña anterior para iniciar sesión, acepta la nueva, invalida todas las sesiones activas de la cuenta afectada (los tokens emitidos antes dejan de servir y el usuario debe iniciar sesión de nuevo con la contraseña nueva) y responde con el aviso de restablecimiento exitoso, sin ningún dato de acceso. El restablecimiento no exige la contraseña anterior: es un restablecimiento, no un cambio de contraseña. La cuenta a restablecer puede ser cualquier cuenta existente, de cualquier rol, incluidas las cuentas del seed y la propia del solicitante.
- RF-43: SI el nombre de usuario recibido para restablecer una contraseña no corresponde a ninguna cuenta existente (porque no existe o porque se envía con otra capitalización), ENTONCES EL SISTEMA devuelve el aviso de no encontrado y no cambia ninguna cuenta.
- RF-44: SI la contraseña nueva falta, está vacía, solo contiene espacios, no es texto (RF-37) o tiene menos de 8 caracteres, ENTONCES EL SISTEMA rechaza el restablecimiento indicando que la contraseña es inválida y no cambia la contraseña actual (misma regla que el alta).
- RF-45: SI el nombre de usuario del alta coincide con el de una cuenta existente sin distinguir mayúsculas y minúsculas, ENTONCES EL SISTEMA rechaza el alta indicando que el usuario ya existe y no crea una cuenta nueva (mismo aviso que hoy); el sistema no puede tener dos cuentas que solo se diferencien en mayúsculas y minúsculas (por ejemplo, «Ana» y «ana»).

### Perfil y acceso denegado

- RF-46: CUANDO un perfil que no es contador (administrador o usuarios_de_sistema) solicita registrar un caso o cambiar el estado o la prioridad de un caso, EL SISTEMA comprueba el perfil antes de buscar el caso y rechaza la petición con aviso de acceso denegado, exista el caso o no (precisa RF-09), de modo que la respuesta no revela qué casos existen; solo cuando el perfil es contador se comprueba si el caso existe (RF-16) y si le pertenece (RF-10).

### Fechas y hora local

- RF-48: CUANDO el sistema devuelve una fecha en una respuesta (por ejemplo, «creado_en» o «actualizado_en» de un caso, o cualquier otro campo de fecha), EL SISTEMA la devuelve como texto con el formato de hora local «YYYY-MM-DD HH:mm:ss», sin marca de zona horaria, sin sufijo «Z» y sin formato ISO (RNF-2).

### Requisitos existentes que esta spec reescribe

- RF-05: CUANDO el token de acceso ha caducado por su expiración propia (campo exp), por tiempo de inactividad (30 minutos), la sesión se cerró por acción del usuario o la contraseña del usuario fue restablecida (RF-42), ENTONCES EL SISTEMA rechaza la petición con un aviso de sesión caducada y la opción de iniciar sesión de nuevo.
- RF-09: CUANDO un administrador o un usuarios_de_sistema solicita registrar, cambiar o eliminar casos, ENTONCES EL SISTEMA rechaza la petición con un aviso de acceso denegado porque ninguno de esos dos perfiles escribe casos (el de administrador es de solo consulta y el de usuarios_de_sistema es de soporte); no existe endpoint de eliminación de casos (fuera de alcance).
- RF-16: CUANDO se solicita un contador o un caso que no existe (incluido un contador inexistente en un endpoint de administrador o un identificador que no corresponde a un contador, RF-35), ENTONCES EL SISTEMA devuelve un aviso de que no se encontró la información solicitada; salvo cuando el perfil no es contador, que recibe aviso de acceso denegado (RF-46).
- RF-30: SI los datos del usuario a dar de alta faltan o son inválidos (usuario vacío, usuario de más de 100 caracteres, contraseña con menos de 8 caracteres o rol no permitido —debe ser administrador, contador o usuarios_de_sistema), ENTONCES EL SISTEMA rechaza el alta e indica qué dato falta o es inválido; cuando el nombre de usuario supera el máximo, indica ese máximo de 100 caracteres y el usuario nunca recibe un error interno ni un error de la base de datos por ese dato.

RF-41 se reescribe completo y figura arriba, en «Token propio por inicio de sesión»; el plan lo cuenta entre los requisitos modificados porque su redacción sustituye a cualquier borrador anterior.

## Requisitos no funcionales

- RNF-2: Las fechas se almacenan y devuelven en hora local con formato YYYY-MM-DD HH:mm:ss, como texto y sin marca de zona horaria ni formato ISO.
- RNF-4: Nunca se pierde una sesión activa mientras el usuario esté usando la aplicación. La caducidad solo aplica por tiempo de inactividad (30 minutos), por cierre voluntario del usuario o por el restablecimiento de la contraseña del usuario, que invalida todas sus sesiones (RF-42).
- RNF-8: Ninguna petición queda sin respuesta y el servidor no se detiene: una entrada inválida (RF-37) o un fallo interno (RF-38 a RF-40, RF-47) produce siempre una respuesta, de éxito o de error de tres partes, y el servidor sigue atendiendo las peticiones siguientes.

## Casos límite

- Inicio de sesión con el usuario o la contraseña enviados como número, objeto, lista o booleano → error de entrada inválida con las tres partes; la petición no queda colgada y el servidor sigue atendiendo peticiones (RF-37, RNF-8); con usuario o contraseña nulos → se tratan como campos que faltan.
- Alta de usuario, restablecimiento de contraseña, registro de caso o cambio de caso con un dato de texto enviado con otro tipo → error de entrada inválida que indica el dato (RF-37).
- Cuerpo de la petición que no es un JSON bien formado → error de entrada inválida de tres partes, no error interno del servidor (RF-37).
- Fallo de la base de datos al registrar la sesión durante el inicio de sesión → no se devuelve token y se informa de que el servicio no está disponible (RF-38).
- Fallo de la base de datos al invalidar el token durante el cierre de sesión → no se confirma el cierre; al recuperarse la base de datos, el reintento sí lo confirma y el token queda rechazado (RF-39).
- Fallo de la base de datos al consultar o renovar la sesión en una petición con token válido → no se avisa de sesión caducada, la sesión no se invalida y el mismo token vuelve a servir al recuperarse la base de datos (RF-40, RNF-4).
- Dos inicios de sesión del mismo usuario en el mismo instante → dos tokens distintos e independientes; cerrar la sesión de uno no invalida el otro (RF-41).
- Mayúsculas y minúsculas: el inicio de sesión distingue mayúsculas y minúsculas, tanto en el nombre de usuario como en la contraseña; la comprobación de duplicados del alta NO las distingue, y el almacenamiento impide que existan dos cuentas que solo se diferencien en mayúsculas (RF-36, RF-45).
- Administrador o usuarios_de_sistema que cambia el estado o la prioridad de un caso que no existe → acceso denegado, no «no encontrado» (RF-46, RF-09); contador que cambia un caso que no existe → no encontrado (RF-16); administrador o usuarios_de_sistema que registra un caso → acceso denegado (RF-46).
- Restablecimiento de la contraseña de un usuario existente con contraseña nueva válida → la contraseña anterior deja de iniciar sesión, la nueva inicia sesión y la respuesta no contiene datos de acceso (RF-42).
- Restablecimiento de la contraseña de un usuario que no existe → aviso de no encontrado y ninguna cuenta cambia (RF-43).
- Nombre de usuario del restablecimiento enviado con otra capitalización (por ejemplo, «ana» cuando la cuenta es «Ana») → aviso de no encontrado y ninguna cuenta cambia (RF-43, RF-36).
- Restablecimiento con contraseña nueva ausente, vacía, solo con espacios, no textual o de menos de 8 caracteres → se rechaza indicando que la contraseña es inválida y la contraseña actual no cambia (RF-44).
- Contador que solicita restablecer una contraseña → acceso denegado.
- Alta de usuario con un nombre que ya existe en otra capitalización → se rechaza indicando que el usuario ya existe y no se crea una cuenta nueva (RF-45).
- Alta de usuario con un nombre de más de 100 caracteres → se rechaza indicando el máximo de 100 caracteres; nunca llega al usuario un error interno ni un error de la base de datos por ese dato (RF-30).
- Restablecimiento de la contraseña de una cuenta → todas las sesiones activas de esa cuenta quedan invalidadas y el usuario puede volver a entrar de inmediato con la contraseña nueva (RF-42, RF-05, RF-41, RNF-4).
- Fallo interno en cualquier operación (por ejemplo, la base de datos al buscar el usuario en el inicio de sesión, al leer casos o al guardar un caso) → aviso de servicio no disponible con las tres partes, la petición recibe respuesta y el servidor sigue atendiendo (RF-47, RNF-8).
- Respuesta con fechas (casos de un contador, casos propios) → las fechas vienen como texto «YYYY-MM-DD HH:mm:ss», no como cadena ISO en UTC (RF-48, RNF-2).

## Fuera de alcance

- El alcance ya implementado por los Cambios 1 y 2 de la spec 002: no se reabre ni se repite aquí.
- Pantallas y navegación del frontend: pertenecen a la spec 001 y a la spec 003.
- Que un contador o cualquier otro usuario cambie su propia contraseña con su contraseña actual: solo administrador y usuarios_de_sistema restablecen contraseñas.
- Recuperación de contraseña por correo, enlace o código: el restablecimiento lo hace un perfil autorizado desde el backend; no se envían correos ni se generan códigos.
- Cambios en la estructura de datos o en la forma de almacenar usuarios, casos o sesiones: esta spec corrige comportamiento, no el modelo de datos.
- Búsqueda, filtros, ordenación, paginación, exportación, notificaciones, recordatorios, reportes e históricos de cambios.
- Cualquier funcionalidad que no sea la corrección de los seis puntos y las cuatro extensiones descritas en el contexto.

## Criterios de finalización

Esta spec queda lista para aprobación cuando se verifiquen, sobre el backend implementado, las siguientes comprobaciones:

9. Un perfil autorizado (administrador o usuarios_de_sistema) da de alta un usuario con datos válidos y restablece la contraseña de una cuenta existente, identificada por su nombre de usuario exacto, y en ambos casos recibe aviso de éxito (RF-28, RF-42).
13. Un administrador o un usuarios_de_sistema que intenta registrar, cambiar o eliminar casos recibe acceso denegado (perfiles de solo consulta y de soporte; no existe endpoint de eliminación) (RF-09, RF-46).
23. Las fechas que devuelve cualquier respuesta (por ejemplo, «creado_en» y «actualizado_en» de los casos) son texto con el formato de hora local YYYY-MM-DD HH:mm:ss, sin marca de zona horaria ni formato ISO (RF-48, RNF-2).
31. Iniciar sesión con el nombre de usuario en distinta capitalización (por ejemplo, una cuenta «Ana» frente a «ana») devuelve el mismo mensaje genérico de credenciales incorrectas y no inicia sesión; con la capitalización exacta, el acceso es correcto (RF-36, RF-03). La contraseña se compara distinguiendo mayúsculas y minúsculas, de modo que una contraseña que solo difiere en mayúsculas o minúsculas no abre sesión. Las cuentas del seed siguen entrando únicamente con su nombre exacto (RF-36, RNF-3).
32. Enviar al inicio de sesión, al alta de usuario, al restablecimiento de contraseña, al registro de caso y al cambio de caso un dato de texto con otro tipo (número, objeto, lista o booleano), y enviar a cualquier endpoint con cuerpo un cuerpo que no es un JSON bien formado, devuelve un error de entrada inválida con las tres partes que indica el dato o el cuerpo y nunca un error interno del servidor; la petición siempre recibe respuesta y el servidor sigue atendiendo las peticiones siguientes (RF-37, RNF-8).
33. Si la base de datos no permite registrar la sesión durante un inicio de sesión con credenciales válidas, no se devuelve token y se devuelve un error de tres partes que indica que el servicio no está disponible (RF-38).
34. Si la base de datos no permite invalidar el token durante un cierre de sesión, no se confirma el cierre y se devuelve un error de tres partes; al recuperarse la base de datos, el reintento sí lo confirma y el token queda rechazado (RF-39).
35. Si la base de datos no permite consultar o renovar la sesión en una petición con token válido, la respuesta no es un aviso de sesión caducada sino un error de tres partes de servicio no disponible, la sesión no se invalida y el mismo token vuelve a servir al recuperarse la base de datos (RF-40, RNF-4).
36. Dos inicios de sesión del mismo usuario, incluso en el mismo instante, devuelven tokens distintos e independientes; cerrar la sesión de uno no invalida el otro (RF-41).
37. Un administrador o un usuarios_de_sistema que registra un caso o cambia el estado o la prioridad de un caso, exista o no, recibe acceso denegado; un contador que cambia un caso que no existe recibe no encontrado (RF-46, RF-09, RF-16).
38. Un perfil autorizado restablece la contraseña de una cuenta existente, identificada por su nombre de usuario exacto (un nombre enviado con otra capitalización se toma por no encontrado), con una contraseña nueva de 8 o más caracteres y sin aportar la contraseña anterior: recibe aviso de éxito sin datos de acceso, la contraseña nueva queda guardada con Argon2id, la contraseña anterior ya no inicia sesión y la nueva sí (RF-42, RF-43, RNF-1).
39. Restablecer la contraseña con un nombre de usuario que no corresponde a ninguna cuenta devuelve no encontrado sin cambiar ninguna cuenta; restablecerla con una contraseña nueva ausente, vacía, solo con espacios, no textual o de menos de 8 caracteres rechaza la petición indicando que la contraseña es inválida y no cambia la contraseña actual; un contador que lo solicita recibe acceso denegado (RF-43, RF-44, RF-29).
40. Dar de alta un usuario cuyo nombre coincide con el de una cuenta existente sin distinguir mayúsculas y minúsculas se rechaza indicando que el usuario ya existe y no se crea ninguna cuenta nueva; no pueden coexistir dos cuentas que solo se diferencien en mayúsculas y minúsculas (RF-45).
41. Provocando un fallo interno en cualquier operación (por ejemplo, la base de datos al buscar el usuario en el inicio de sesión, al leer casos y al guardar un caso), la petición recibe el aviso de servicio no disponible con las tres partes, no se confirma ningún éxito que no quedó guardado y el servidor atiende la petición siguiente (RF-47, RNF-8).
42. Dar de alta un usuario con un nombre de más de 100 caracteres se rechaza como dato inválido indicando el máximo de 100 caracteres; el usuario no recibe un error interno ni un error de la base de datos por ese dato (RF-30).
43. Tras restablecer la contraseña de una cuenta, todas las sesiones activas de esa cuenta quedan invalidadas: los tokens emitidos antes reciben el aviso de sesión caducada y el usuario puede volver a entrar de inmediato con la contraseña nueva. Fuera de un restablecimiento, cerrar o caducar una sesión sigue sin afectar a las demás sesiones del mismo usuario (RF-42, RF-05, RF-41, RNF-4).
44. Un perfil autorizado (administrador o usuarios_de_sistema) puede restablecer la contraseña de cualquier cuenta existente, incluidas las cuentas del seed y la propia del solicitante: tras el restablecimiento, esa cuenta puede iniciar sesión de inmediato con la contraseña nueva, y el nombre de usuario con el que se identifica la cuenta es el exacto (RF-42, RF-27, RNF-3).

## Decisiones tomadas

- ¿Qué defectos y huecos se tratan y cuándo? → los seis incumplimientos del contexto y las cuatro extensiones, en una spec propia (004) que se hace después de cerrada la spec 002 con los Cambios 1 y 2. Porqué: son defectos de la implementación detectados al revisar el backend; separarlos deja la spec 002 cerrada con lo ya implementado y evita seguir ampliándola. (Decisión del usuario.)
- ¿Se implementa el restablecimiento de contraseñas? → Sí. Porqué: la spec 002 ya lo exigía (RF-28 y su criterio 9) y la implementación solo permite dar de alta usuarios, de modo que no había forma de recuperar el acceso de una cuenta. (Decisión del usuario: «Implementarlo».)
- ¿Se añaden las fechas a esta spec? → Sí, como corrección del incumplimiento de RNF-2 y del criterio 23. Porqué: el frontend necesita leerlas en hora local, con el mismo formato con el que se guardan. (Decisión del usuario.)
- ¿Se añade la distinción de mayúsculas y minúsculas en el nombre de usuario? → Sí. Porqué: el caso límite de la spec 002 afirma que la comparación de credenciales distingue mayúsculas y minúsculas, pero la comparación en la base de datos no lo hace, de modo que «ADMIN_SEED» concede acceso a «admin_seed». (Decisión del usuario.)
- ¿Se aplica la regla de entradas no textuales a todos los endpoints con cuerpo? → Sí: al inicio de sesión, al alta de usuario, al restablecimiento de contraseña, al registro de caso y al cambio de caso. Un dato que debe ser texto y llega con otro tipo se rechaza con un error de entrada inválida de tres partes que indica el dato y que debe enviarse como texto; un cuerpo que no es un JSON bien formado se rechaza igual, como entrada inválida y no como error interno del servidor. Un dato nulo o ausente sigue tratándose como dato que falta (RF-37, criterio 32). (Decisión del usuario: «Confirmar todas».)
- ¿Qué ocurre cuando la base de datos falla al gestionar la sesión? → nunca se confirma un éxito que no quedó guardado: en el inicio de sesión no se devuelve token (RF-38); en el cierre de sesión no se confirma el cierre (RF-39); y al atender una petición con token válido, si no se puede consultar o renovar la sesión, no se atiende la operación, se informa de que el servicio no está disponible, no se avisa de sesión caducada y la sesión no se invalida, de modo que el mismo token vuelve a servir cuando la base de datos se recupera (RF-40). Porqué: antes el error se ignoraba en silencio; avisar de «sesión caducada» por un fallo de la base de datos haría perder una sesión activa contra RNF-4, y un cierre de sesión que avisa de éxito sin invalidar el token incumple RF-26 y RF-31. (Decisión del usuario: «Confirmar todas».)
- ¿Cada inicio de sesión emite su propio token? → Sí: tokens distintos e independientes, incluso en el mismo instante (RF-41). Porqué: hoy dos inicios de sesión del mismo usuario en el mismo segundo producen el mismo token, el segundo registro de sesión falla con un error de clave duplicada que se ignoraba y las dos sesiones compartían estado (por ejemplo, cerrar una invalidaba la otra); sin tokens propios, el registro de sesión del segundo inicio de sesión fallaría siempre. (Decisión del usuario: «Confirmar todas».)
- ¿Puede haber dos cuentas que solo se diferencian en mayúsculas y minúsculas? → No: el alta rechaza con el aviso «el usuario ya existe» cualquier nombre que coincida con el de una cuenta existente sin distinguir mayúsculas y minúsculas, y «Ana» y «ana» no pueden coexistir (RF-45, criterio 40). Porqué: el inicio de sesión distingue mayúsculas y minúsculas (RF-36) y el almacenamiento impide dos cuentas equivalentes, de modo que no hace falta cambiar la estructura de datos. (Decisión del usuario: «Confirmar todas».)
- ¿Cuál es el invariante de mayúsculas y minúsculas? → el inicio de sesión distingue mayúsculas y minúsculas, en el nombre de usuario y en la contraseña (RF-36); la comprobación de duplicados del alta NO las distingue (RF-45); el almacenamiento sigue impidiendo dos cuentas que solo difieran en mayúsculas; y las cuentas del seed siguen entrando únicamente con su nombre exacto (RNF-3). La spec fija el comportamiento observable, no el cómo lo garantiza el almacenamiento. (Decisión derivada de RF-36, RF-45 y RNF-3.)
- ¿Cuál es el máximo del nombre de usuario en el alta? → 100 caracteres, el límite que admite el almacenamiento del nombre de usuario; no es el del cliente (RF-21 fija 80). Con más, el alta se rechaza como dato inválido indicando ese máximo de 100 caracteres, y el usuario nunca recibe un error interno ni un error de la base de datos por ese dato (RF-30, criterio 42). (Decisión del usuario: «Confirmar todas».)
- ¿Qué responde el backend ante cualquier otro fallo interno? → el aviso de servicio no disponible (tres partes), sin confirmar ningún éxito que no haya quedado guardado, la petición siempre recibe respuesta y el servidor no se detiene (RF-47, RNF-8, criterio 41). (Decisión del usuario: «Confirmar todas».)
- ¿Cómo se identifica la cuenta a la que se restablece la contraseña? → por su nombre de usuario exacto, comparado con las mismas mayúsculas y minúsculas que el inicio de sesión (RF-36); y no se exige la contraseña anterior, porque es un restablecimiento y no un cambio de contraseña (RF-42, RF-43). (Decisión del usuario: «Por nombre de usuario exacto».)
- ¿Qué pasa con las sesiones activas de la cuenta cuya contraseña se restablece? → se invalidan todas: los tokens emitidos antes dejan de servir, el usuario recibe el aviso de sesión caducada y debe iniciar sesión de nuevo con la contraseña nueva, aunque puede volver a entrar de inmediato con ella. Es una excepción documentada a RNF-4 y a RF-05, y también a la regla de RF-41 de que cerrar o caducar una sesión no afecta a las demás sesiones del mismo usuario (RF-42, RF-05, RF-41, RNF-4, criterio 43). (Decisión del usuario: «Se invalidan todas».)
- ¿Cómo se solicita el restablecimiento? → mediante una operación PATCH sobre el nombre de usuario de la cuenta, con la contraseña nueva en el cuerpo (`{ password }`). Alternativa descartada: una operación POST con el usuario y la contraseña en el cuerpo, que duplica en el cuerpo el dato que ya identifica la ruta. (Decisión del usuario.)
- ¿Cómo se consiguen las fechas en hora local? → formateando la fecha en el momento de construir la respuesta, sin cambiar cómo se guardan ni cómo se leen las fechas de las sesiones (que siguen siendo fechas reales para medir la inactividad). Alternativa descartada: configurar la base de datos para que devuelva todas las fechas como texto, lo que rompería la medición de inactividad. (Decisión del usuario.)
- ¿Cómo se compara el nombre de usuario en el inicio de sesión? → con una comparación exacta en la aplicación, sin cambiar el esquema ni la colación de la base de datos (prohibido sin consultar). Alternativa descartada: forzar la colación en cada consulta, que depende de la colación real. (Decisión del usuario.)
- ¿Qué código recibe un fallo interno? → 503 (servicio no disponible); ninguna respuesta usa 500. Si alguna prueba existente afirma un 500, se reajusta a 503 en la tarea que corresponda. (Decisión del usuario.)
- ¿Qué queda fuera de alcance con el restablecimiento? → que un contador o cualquier otro usuario cambie su propia contraseña con su contraseña actual, y la recuperación por correo, enlace o código: el restablecimiento lo hace un perfil autorizado desde el backend. (Decisión del usuario: «Confirmar todas».)
- ¿Cuál es la «hora local» de RNF-2 y RF-48? → la hora local del servidor; se mantiene la definición existente y no se añade ninguna zona horaria configurable. (Decisión del usuario.)
- ¿Cuándo se comprueba el rol en el cambio de estado o la prioridad de un caso? → antes de buscar el caso: un perfil que no es contador recibe acceso denegado exista el caso o no (RF-46), y RF-09 se precisa para que alcance también al usuarios_de_sistema. (Decisión derivada del punto 3 del contexto.)

## Dudas abiertas

Sin dudas abiertas: el contenido de esta spec es el que el usuario aprobó como Cambio 3 de la spec 002, incluida la tabla de códigos HTTP, el restablecimiento sobre cualquier cuenta (seed y propia del solicitante) y las cuatro extensiones. Las preguntas del plan (ruta del restablecimiento, forma de las fechas, código de los fallos internos y comparación exacta del usuario) quedaron decididas por el usuario y constan en «Decisiones tomadas».
