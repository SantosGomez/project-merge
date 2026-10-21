# Spec 002 — Backend con autenticación y datos
Estado: implementada (cambios 1 y 2 implementados y aprobados por el reviewer; cambio 3 previsto, sin spec aprobada)

## Contexto y objetivo

La spec 001 (maqueta navegable de las vistas) está aprobada e implementada al 100% con datos en memoria y sin backend. Para pasar de la maqueta a una aplicación real se necesita un backend que almacene usuarios y sesiones, que autentique a los perfiles definidos, y que exponga operaciones de lectura y escritura sobre contadores y casos.

Objetivo: definir qué debe hacer el backend para soportar (1) el inicio de sesión con credenciales y la gestión de sesiones, (2) la lectura de contadores, casos y conteos de casos por estado, (3) la escritura de datos: registro de caso por el contador autenticado y cambio de estado y prioridad de sus propios casos, y (4) la gestión de sesiones y de altas de usuarios. Todo bajo los principios de la constitución: contraseñas con Argon2id antes de almacenar, fechas en hora local, compatibilidad hacia atrás, nunca perder una sesión activa, y textos de interfaz y mensajes en español.

Cambio 1 (aprobado), posterior a la implementación y previo al desarrollo del frontend funcional (spec 003): al contrastar el backend con lo que necesita el frontend se detectaron dos defectos. (1) La lista de contadores que recibe el administrador incluye datos de acceso (el hash de contraseña), que nunca deben salir del servidor. (2) El backend acepta peticiones desde cualquier origen, cuando solo debe aceptarlas desde los orígenes locales de desarrollo del frontend web. Además se detectaron otros dos incumplimientos: el inicio de sesión no devolvía el identificador del usuario que RF-01 ya exige, y los endpoints de administrador de conteos y de casos por contador trataban como contador a cualquier usuario existente, aunque tuviera otro rol. Este cambio añade los requisitos RF-32 a RF-35 y RNF-7, modifica RF-12, RF-14 y RF-16, y modifica el criterio de finalización 1 y el 24, y añade los criterios 26 a 29.

Cambio 2 (reparación, aprobado; se ejecuta antes del Cambio 1 y antes del frontend): la validación anterior dio por buenas pruebas del backend que en realidad no se ejecutaban, y al revisarlas se detectó que la implementación aceptaba ciertos valores fijos de prueba como credencial de acceso sin haber iniciado sesión, lo que incumple RF-04 y RF-07. Este cambio no añade requisitos: reescribe el criterio de finalización 25, añade el criterio 30 y un caso límite sobre RF-04 y RF-07.

Cambio 3 (previsto, pendiente; sin requisitos redactados todavía): agrupa defectos de robustez y de perfil detectados al revisar el backend (ver «Decisiones tomadas»). Se hará después del Cambio 2 y antes del frontend, y seguirá el flujo completo: spec, aprobación, plan y tareas, aprobación.

## Usuarios

- **Administrador**: solo consulta. Lee la lista de contadores, los casos de cada contador y los conteos de casos por estado. No registra casos, no cambia estados ni prioridades y no administra contadores.
- **Contador**: autentica con sus credenciales, lee sus propios casos, registra casos nuevos (cliente y prioridad; el estado es siempre Pendiente y el contador asignado es quien autenticó) y cambia el estado y la prioridad de los casos que le pertenecen.
- **usuarios_de_sistema**: perfil de soporte. Está autorizado, junto con el administrador, para dar de alta usuarios y restablecer contraseñas mediante los endpoints protegidos. No tiene otras capacidades definidas en esta spec.
- No existen otros perfiles.

## Historias de usuario

- HU-1. Como contador, administrador o usuarios_de_sistema, quiero iniciar sesión con mis credenciales para acceder a la aplicación con el perfil que me corresponde.
- HU-2. Como administrador, quiero leer la lista de contadores, los casos de cada contador y los conteos de casos por estado para conocer el estado de urgencia del equipo.
- HU-3. Como contador, quiero registrar un caso propio indicando cliente y prioridad para dar de alta mi trabajo, con estado Pendiente automático y yo como contador asignado.
- HU-4. Como contador, quiero cambiar el estado y la prioridad de mis propios casos para reflejar el avance del trabajo.
- HU-5. Como usuario, quiero que se me niegue el acceso a datos o funciones de otro perfil y que se me avise cuando no haya sesión o la sesión haya caducado.
- HU-6. Como usuario, quiero recibir mensajes de error claros (qué ocurrió, sobre qué dato o acción, y qué hacer) cuando falle una operación.

## Definiciones

- **Credenciales**: usuario y contraseña que se envían para iniciar sesión.
- **Sesión**: período durante el cual un usuario permanece identificado tras iniciar sesión válidamente. Una sesión puede caducar por tiempo de inactividad (30 minutos sin peticiones válidas), por expiración propia del token (campo exp) o por cierre voluntario del usuario; cada petición válida reinicia el temporizador de inactividad de 30 minutos, y mientras el usuario sigue usando la aplicación (realiza peticiones válidas), la sesión activa no se pierde.
- **Token de acceso**: credencial tipo JWT Bearer que el cliente envía en el encabezado Authorization de cada petición para identificar al usuario autenticado y su perfil. Tiene su propia expiración (campo exp) además de la caducidad por inactividad y el cierre voluntario.
- **Caso propio**: caso cuyo contador asignado es el usuario que inició sesión.
- **Cliente**: nombre de la persona o empresa para la que se trabaja el caso, como texto libre obligatorio. El cliente se guarda directamente en el caso; no existe una tabla de clientes separada. En un caso existente, el campo cliente no es editable: solo se pueden cambiar el estado y la prioridad.
- **Estado del caso**: avance del trabajo. Valores permitidos: Pendiente, En proceso, Finalizado. El estado inicial de todo caso nuevo es Pendiente.
- **Prioridad**: urgencia del caso, independiente del estado. Valores permitidos: Alta, Media, Baja.
- **Campos de usuario**: id, usuario, password_hash, rol, creado_en. El rol puede ser administrador, contador o usuarios_de_sistema.
- **Datos de acceso**: información con la que se autentica una cuenta y que nunca debe salir del servidor; incluye el hash de contraseña (campo password_hash) y cualquier otro dato derivado de la contraseña. No incluye el token de acceso, que solo se entrega al propio usuario al iniciar sesión (RF-01).
- **Origen permitido**: origen (esquema, host y puerto desde donde se carga el frontend) autorizado a hacer peticiones al backend. Los orígenes permitidos son únicamente los locales de desarrollo del frontend web; no se permiten otros orígenes ni la aplicación de escritorio por ahora.
- **Campos de caso**: id, contador_id, cliente, estado, prioridad, creado_en, actualizado_en.
- **Formato de fecha/hora local**: las fechas se almacenan y devuelven en hora local con formato YYYY-MM-DD HH:mm:ss (sin zona horaria, hora local del servidor).
- **Inactividad de sesión**: ausencia de peticiones válidas durante 30 minutos. Cada petición válida reinicia el temporizador de inactividad; mientras el usuario hace peticiones válidas, la sesión no caduca por inactividad.

## Requisitos funcionales

### Acceso y sesión

- RF-01: CUANDO un usuario envía credenciales válidas de una cuenta registrada, EL SISTEMA inicia una sesión y devuelve un token de acceso (JWT con campo exp), el rol del usuario y su identificador (id y nombre de usuario).
- RF-02: SI el usuario o la contraseña faltan o están vacíos o solo contienen espacios, ENTONCES EL SISTEMA rechaza el inicio de sesión e indica qué campos faltan.
- RF-03: SI las credenciales no coinciden con ninguna cuenta registrada, ENTONCES EL SISTEMA rechaza el acceso con un mensaje genérico que no revela si el usuario existe ni cuál dato falló.
- RF-04: CUANDO una petición requiere sesión y no incluye un token de acceso válido, ENTONCES EL SISTEMA rechaza la petición con un aviso de que se debe iniciar sesión.
- RF-05: CUANDO el token de acceso ha caducado por su expiración propia (campo exp), por tiempo de inactividad (30 minutos) o la sesión se cerró por acción del usuario, ENTONCES EL SISTEMA rechaza la petición con un aviso de sesión caducada y la opción de iniciar sesión de nuevo.
- RF-06: EL SISTEMA determina el perfil del usuario por la cuenta con la que inició sesión y no ofrece forma de elegir el perfil manualmente.
- RF-07: MIENTRAS no hay una sesión iniciada, EL SISTEMA no devuelve información de contadores ni de casos.

### Caducidad y cierre de sesión

- RF-25: MIENTRAS el usuario sigue usando la aplicación (realiza peticiones válidas), EL SISTEMA mantiene la sesión activa y no la caduca por inactividad; cada petición válida reinicia el temporizador de inactividad de 30 minutos, y la inactividad se mide como ausencia de peticiones válidas durante 30 minutos.
- RF-26: CUANDO el usuario cierra la sesión por acción propia, EL SISTEMA invalida el token de acceso de forma persistente en la base de datos y rechaza las peticiones posteriores que lo presenten, incluso tras reiniciar el servidor.
- RF-31: EL SISTEMA expone un comportamiento explícito de cierre de sesión; CUANDO el usuario cierra su sesión, EL SISTEMA invalida el token de acceso de forma persistente en la base de datos y las peticiones posteriores con ese token son rechazadas, incluso tras reiniciar el servidor.

### Datos maestros (seed)

- RF-27: AL inicializar o configurar la base de datos (al iniciar el servidor), EL SISTEMA crea los datos maestros: al menos una cuenta de administrador y al menos una cuenta de contador, con contraseñas hasheadas y credenciales placeholder (cargadas desde otra base de datos posteriormente), solo si no existen ya; si existen, no hace nada (no sobrescribe ni falla).

### Alta de usuarios y restablecimiento de contraseñas

- RF-28: CUANDO un perfil autorizado (administrador o usuarios_de_sistema) solicita dar de alta un usuario con datos válidos, EL SISTEMA crea la cuenta, hashea su contraseña y devuelve aviso de alta exitosa; cuando solicita restablecer la contraseña de un usuario existente, EL SISTEMA hashea la nueva contraseña, la guarda y devuelve aviso de restablecimiento exitoso.
- RF-29: CUANDO un perfil no autorizado (por ejemplo, un contador) solicita dar de alta un usuario o restablecer una contraseña, ENTONCES EL SISTEMA rechaza la petición con aviso de acceso denegado.
- RF-30: SI los datos del usuario a dar de alta faltan o son inválidos (usuario vacío, contraseña con menos de 8 caracteres o rol no permitido —debe ser administrador, contador o usuarios_de_sistema), ENTONCES EL SISTEMA rechaza la alta e indica qué dato falta o es inválido.

### Perfil y acceso denegado

- RF-08: CUANDO un contador solicita datos o funciones reservados al administrador, ENTONCES EL SISTEMA rechaza la petición con un aviso de acceso denegado y le indica volver a la pantalla de su perfil.
- RF-09: CUANDO un administrador solicita registrar, cambiar o eliminar casos, ENTONCES EL SISTEMA rechaza la petición con un aviso de acceso denegado porque el perfil de administrador es de solo consulta; no existe endpoint de eliminación de casos (fuera de alcance).
- RF-10: CUANDO un contador solicita cambiar el estado o la prioridad de un caso que no le pertenece, ENTONCES EL SISTEMA rechaza la petición con un aviso de acceso denegado sobre ese caso.
- RF-11: EL SISTEMA no permite a un perfil ver información que pertenece a otro perfil, excepto lo que el administrador consulta como parte de su rol de solo lectura sobre el equipo.

### Lectura de datos

- RF-12: CUANDO un administrador solicita la lista de contadores, EL SISTEMA devuelve todos los contadores registrados, con solo los campos definidos en RF-32; si no hay contadores, devuelve un aviso de vacío que indica qué información falta (RF-24).
- RF-13: CUANDO un administrador solicita los conteos de casos por estado de cada contador, EL SISTEMA devuelve el conteo de casos en cada estado (Pendiente, En proceso, Finalizado), incluido el valor cero cuando no hay casos en un estado; si no hay contadores, devuelve un aviso de vacío (RF-24).
- RF-14: CUANDO un administrador solicita el detalle de los casos de un contador, EL SISTEMA devuelve los casos de ese contador con cliente, estado y prioridad; si el identificador no corresponde a un contador, devuelve un aviso de no encontrado (RF-16, RF-35); si no tiene casos, devuelve un aviso de vacío (RF-24).
- RF-15: CUANDO un contador solicita sus propios casos, EL SISTEMA devuelve solo los casos asignados a ese contador; si no tiene casos, devuelve un aviso de vacío que indica qué información falta (RF-24).
- RF-16: CUANDO se solicita un contador o un caso que no existe (incluido un contador inexistente en un endpoint de administrador o un identificador que no corresponde a un contador, RF-35), ENTONCES EL SISTEMA devuelve un aviso de que no se encontró la información solicitada.
- RF-35: CUANDO un administrador solicita los conteos o los casos de un identificador que no corresponde a un contador (porque no existe o porque pertenece a un usuario con otro rol), ENTONCES EL SISTEMA devuelve el aviso de no encontrado (RF-16) y no devuelve conteos ni casos.

### Escritura de datos

- RF-17: CUANDO un contador envía un registro de caso con cliente y prioridad válidos, EL SISTEMA crea el caso con estado Pendiente, asigna al contador que inició sesión como contador asignado y guarda el caso.
- RF-18: EL SISTEMA asigna automáticamente el estado Pendiente a todo caso nuevo y no permite elegir otro estado al registrar.
- RF-19: SI el cliente falta, está vacío o tiene solo espacios, ENTONCES EL SISTEMA no crea el caso e indica que el cliente es obligatorio.
- RF-20: SI la prioridad falta o no es una de las tres permitidas (Alta, Media, Baja), ENTONCES EL SISTEMA no crea el caso e indica que la prioridad es obligatoria y debe ser una de las tres permitidas.
- RF-21: SI el cliente supera los 80 caracteres tras ignorar espacios al inicio y al final, ENTONCES EL SISTEMA no crea el caso e indica el máximo permitido.
- RF-22: CUANDO un contador cambia el estado o la prioridad de uno de sus propios casos, EL SISTEMA actualiza el caso y guarda la modificación; el campo cliente no es editable, solo se pueden cambiar el estado y la prioridad.

### Errores y respuestas

- RF-23: CUANDO cualquier operación falla, EL SISTEMA devuelve un mensaje de error con tres partes: qué ocurrió, sobre qué dato o acción, y qué debe hacer el usuario a continuación.
- RF-24: SI no hay información que mostrar en una consulta, EL SISTEMA devuelve un aviso de vacío que indica qué información falta (casos del contador sin casos, lista de contadores, conteos de un contador sin casos).

### Protección de datos de acceso

- RF-32: CUANDO un administrador solicita la lista de contadores, EL SISTEMA devuelve de cada contador únicamente su identificador (id) y su nombre de usuario (usuario), y ningún otro campo.
- RF-33: EL SISTEMA no incluye datos de acceso (hash de contraseña ni ningún dato derivado de la contraseña) en ninguna respuesta, ni de éxito ni de error, de ninguna operación.

### Orígenes permitidos (CORS)

- RF-34: EL SISTEMA acepta peticiones de otros orígenes únicamente cuando proceden de un origen local de desarrollo del frontend web; CUANDO una petición procede de cualquier otro origen, ENTONCES EL SISTEMA la rechaza y no autoriza a ese origen a leer la respuesta; CUANDO una petición no declara ningún origen (herramientas de prueba, scripts, pruebas automáticas), EL SISTEMA la acepta, porque la restricción de origen protege al navegador del usuario y no sustituye al token de acceso como control de acceso (RF-04 sigue aplicando).

## Requisitos no funcionales

- RNF-1: Las contraseñas se hashean con Argon2id antes de almacenarse en la base de datos (principio de seguridad obligatorio).
- RNF-2: Las fechas se almacenan y devuelven en hora local con formato YYYY-MM-DD HH:mm:ss.
- RNF-3: Se mantiene compatibilidad hacia atrás con los datos del seed y los de la espec 001.
- RNF-4: Nunca se pierde una sesión activa mientras el usuario esté usando la aplicación. La caducidad solo aplica por tiempo de inactividad (30 minutos) o por cierre voluntario del usuario.
- RNF-5: Los mensajes del backend y los errores se expresan en español y no son ambiguos.
- RNF-6: Todo mensaje de error contiene las tres partes exigidas: qué ocurrió, sobre qué dato o acción, y qué hacer.
- RNF-7: Los datos de acceso nunca salen del servidor: ninguna respuesta del backend contiene el hash de contraseña ni datos derivados de la contraseña (principio de seguridad; refuerza RNF-1).

## Casos límite

- Sin sesión: leer o escribir sin token de acceso válido → aviso de que se debe iniciar sesión.
- Credenciales vacías o solo espacios en login → se señalan los campos faltantes y no se inicia sesión.
- Credenciales incorrectas → mensaje genérico de credenciales no válidas, sin indicar cuál dato falló.
- Mayúsculas y minúsculas: la comparación de credenciales distingue mayúsculas y minúsculas.
- Token con expiración propia (campo exp) vencida → aviso de sesión caducada.
- Sesión caducada por inactividad (30 minutos sin peticiones válidas) → aviso de sesión caducada y opción de iniciar sesión de nuevo.
- Sesión activa con peticiones válidas → cada petición válida reinicia el temporizador de 30 minutos y la sesión no se caduca por inactividad.
- Cierre de sesión por acción del usuario → el token queda invalidado de forma persistente en la base de datos y las peticiones posteriores con ese token son rechazadas, incluso tras reiniciar el servidor.
- Contador sin casos al consultar → mensaje de vacío con la información que falta.
- Lista de contadores vacía o conteos de un contador sin casos → aviso de vacío que indica qué información falta.
- Registro con cliente de exactamente 80 caracteres → se acepta; con 81 caracteres → se rechaza e indica el máximo permitido.
- Caso en estado Finalizado → se puede cambiar su estado a Pendiente o En proceso y su prioridad a cualquiera de las tres, sin restricción.
- Cambio de estado o prioridad de caso ajeno → acceso denegado.
- Intento de cambiar el cliente de un caso existente → no es editable, solo se pueden cambiar estado y prioridad.
- Rol no permitido al dar de alta un usuario → se rechaza la alta indicando que el rol es inválido.
- Contraseña al dar de alta con menos de 8 caracteres → se rechaza la alta indicando que la contraseña es inválida.
- Perfil no autorizado (contador) que solicita alta de usuario o restablecimiento de contraseña → acceso denegado.
- Seed con usuarios ya existentes → no hace nada (no sobrescribe ni falla).
- Lista de contadores solicitada por el administrador → cada contador trae solo id y usuario; nunca el hash de contraseña ni la fecha de creación ni el rol (RF-32, RF-33).
- Petición desde un origen no permitido (otro sitio web, otro puerto local no autorizado o la aplicación de escritorio) → se rechaza y no se autoriza a ese origen a leer la respuesta (RF-34).
- Petición desde un origen local de desarrollo del frontend web → se acepta con normalidad (RF-34).
- Petición que no declara origen (herramientas de prueba, scripts, pruebas automáticas) → se acepta, pero si el endpoint requiere sesión sigue exigiendo un token de acceso válido (RF-34, RF-04).
- Conteos o casos de un identificador que no es de un contador (inexistente, o de un administrador o de usuarios_de_sistema) → aviso de no encontrado, sin devolver datos (RF-35).
- Respuesta de error de cualquier operación → tampoco contiene datos de acceso (RF-33).
- Petición protegida con un valor de token que no fue emitido por el inicio de sesión (valores fijos de prueba, inventados, mal formados o firmados con otro secreto) → se rechaza con el aviso de iniciar sesión; no existe ninguna credencial de acceso que no pase por el inicio de sesión (RF-04, RF-07).
- Identificador de contador con texto mezclado con números o no numérico en un endpoint de administrador → se trata como identificador que no corresponde a un contador: aviso de no encontrado (RF-35).

## Fuera de alcance

- Pantallas y navegación del frontend (pertenecen a la spec 001 y a futuras specs de frontend).
- Creación de la primera cuenta de administrador y de los contadores: se realiza mediante un seed al iniciar/configurar la base de datos. Las altas posteriores de usuarios se hacen mediante un endpoint protegido accesible solo desde un perfil autorizado (administrador o usuarios_de_sistema).
- Búsqueda, filtros, ordenación, paginación y exportación de datos.
- Notificaciones, recordatorios, reportes e históricos de cambios.
- Eliminación de casos: no existe endpoint de eliminación; RF-09 solo rechaza al administrador si intenta eliminar casos (fuera de alcance).
- Cualquier funcionalidad que no sea inicio de sesión, lectura de contadores/casos/conteos, registro de caso, cambio de estado/prioridad de casos propios, caducidad y cierre de sesión, y alta de usuarios y restablecimiento de contraseñas protegidos.

## Criterios de finalización

Esta spec queda lista para aprobación cuando se verifiquen, sobre el backend implementado, las siguientes comprobaciones:

1. Iniciar sesión con credenciales válidas de contador, administrador y usuarios_de_sistema devuelve un token (JWT con campo exp), el rol, el identificador (id) y el nombre de usuario; la respuesta incluye explícitamente el id (RF-01, RF-06).
2. Enviar login con campos vacíos o solo espacios rechaza el acceso e indica los campos faltantes (RF-02).
3. Enviar credenciales incorrectas devuelve un mensaje genérico sin revelar cuál dato falló (RF-03).
4. Leer contadores, casos o conteos sin sesión devuelve aviso de iniciar sesión (RF-04, RF-07).
5. Usar un token con expiración vencida, un token revocado o un token inactivo durante 30 minutos devuelve aviso de sesión caducada (RF-05).
6. Mientras el usuario sigue usando la aplicación (peticiones válidas), cada petición válida reinicia el temporizador de inactividad de 30 minutos y la sesión activa no se pierde por inactividad (RF-25, RNF-4).
7. Cerrar la sesión por acción del usuario invalida el token de forma persistente en la base de datos; las peticiones posteriores con ese token son rechazadas incluso tras reiniciar el servidor (RF-26, RF-31, RNF-4).
8. Al iniciar/configurar la base de datos se crean los datos maestros (al menos un administrador y al menos un contador) con contraseñas hasheadas y credenciales placeholder; si los usuarios ya existen, el seed no hace nada (RF-27).
9. Un perfil autorizado (administrador o usuarios_de_sistema) da de alta un usuario con datos válidos y/o restablece la contraseña de un usuario existente, y recibe aviso de éxito (RF-28).
10. Un perfil no autorizado (contador) que solicita alta de usuario o restablecimiento de contraseña recibe acceso denegado (RF-29).
11. Datos de alta de usuario faltantes o inválidos (incluido rol no permitido o contraseña con menos de 8 caracteres) son rechazados indicando qué dato falta o es inválido (RF-30).
12. Un contador que solicita funciones de administrador recibe acceso denegado (RF-08, RF-09, RF-11).
13. Un administrador que intenta registrar, cambiar o eliminar casos recibe acceso denegado (solo consulta; no existe endpoint de eliminación) (RF-09).
14. Un contador que intenta cambiar un caso ajeno recibe acceso denegado sobre ese caso (RF-10).
15. El administrador lee la lista de contadores (o aviso de vacío si no hay), los conteos por estado (con ceros incluidos) y el detalle de casos de un contador (RF-12, RF-13, RF-14).
16. El contador lee solo sus propios casos (o aviso de vacío si no tiene) (RF-15).
17. Solicitar un contador o un caso que no existe, incluido un contador inexistente en un endpoint de administrador, devuelve aviso de no encontrado (RF-16).
18. Registrar un caso con cliente y prioridad válidos crea el caso con estado Pendiente y el contador autenticado como asignado (RF-17, RF-18).
19. Registrar sin cliente, sin prioridad, con prioridad inválida o con cliente de más de 80 caracteres rechaza el caso con mensaje que identifica el dato (RF-19, RF-20, RF-21).
20. Cambiar estado y prioridad de un caso propio, incluido uno Finalizado, actualiza el caso; el campo cliente no es editable (RF-22).
21. Cualquier operación fallida devuelve error con las tres partes (qué, sobre qué, qué hacer) en español (RF-23, RNF-5, RNF-6).
22. Las contraseñas almacenadas se hashean con Argon2id (RNF-1).
23. Las fechas se devuelven en hora local con formato YYYY-MM-DD HH:mm:ss (RNF-2).
24. El backend acepta peticiones de otros orígenes únicamente desde los orígenes locales de desarrollo del frontend web y rechaza las de cualquier otro origen (RF-34).
25. Las pruebas del backend se registran con el ejecutor de pruebas nativo y `node --test` ejecuta pruebas reales en cada archivo de prueba: ningún archivo se carga sin ejecutar al menos una prueba; todas las pruebas pasan; no hay ninguna omitida, pendiente ni experimental suelta (principio Tests como puerta).
26. La lista de contadores que recibe el administrador contiene de cada contador únicamente id y usuario (RF-12, RF-32).
27. Ninguna respuesta de ninguna operación (inicio de sesión, cierre de sesión, alta de usuario, lista de contadores, conteos, casos de un contador, casos propios, registro y cambio de caso, y respuestas de error) contiene el hash de contraseña ni datos derivados de la contraseña (RF-33, RNF-7).
28. Una petición desde un origen no permitido es rechazada; una desde un origen local de desarrollo del frontend web es aceptada; una que no declara origen es aceptada pero, en un endpoint protegido, sigue exigiendo token de acceso válido (RF-34, RF-04).
29. Un administrador que solicita conteos o casos de un identificador inexistente o de un usuario que no es contador (administrador o usuarios_de_sistema) recibe aviso de no encontrado y ningún dato (RF-35, RF-16).
30. Una petición a un endpoint protegido con un valor de token que no fue emitido por el inicio de sesión (incluidos valores fijos de prueba, inventados, mal formados o firmados con otro secreto) devuelve el aviso de iniciar sesión y ningún dato; la única forma de obtener acceso es iniciar sesión con credenciales válidas, y las pruebas de autenticación y de perfiles usan solo tokens emitidos por el inicio de sesión (RF-04, RF-07).

## Decisiones tomadas

- ¿Quiénes son los perfiles de usuario y qué puede hacer cada uno? → administrador (solo consulta), contador (autentica, lee sus casos, registra casos, cambia estado/prioridad de los suyos) y usuarios_de_sistema (soporte, autorizado para dar de alta usuarios y restablecer contraseñas junto con el administrador). No existen otros perfiles. (Decisión del usuario #3)
- ¿Qué roles pueden dar de alta usuarios y restablecer contraseñas mediante el endpoint protegido? → administrador y usuarios_de_sistema (no contador). (Decisión del usuario #4)
- ¿Cuánto dura el tiempo de inactividad antes de caducar la sesión? → 30 minutos sin peticiones válidas; cada petición válida reinicia el temporizador de inactividad, y mientras el usuario hace peticiones válidas, la sesión no caduca por inactividad. (Decisión del usuario #1 + derivada RF-25)
- ¿El token JWT tiene expiración propia? → Sí, el token es JWT con campo exp, además de la caducidad por inactividad y el cierre voluntario. (Decisión del usuario #2)
- ¿Qué devuelve el login? → token de acceso, rol del usuario e identificador (id y nombre de usuario). (Decisión derivada RF-01)
- ¿Qué credenciales usa el seed y qué hace si los usuarios ya existen? → credenciales placeholder (cargadas desde otra base de datos posteriormente); si los usuarios ya existen, el seed no hace nada (no sobrescribe ni falla, solo inserta si faltan). (Decisiones del usuario #5 y #6)
- ¿Cuándo corre el seed? → al iniciar/configurar la base de datos (al arrancar el servidor), solo si no existen los usuarios. (Decisión derivada)
- ¿Dónde se persiste la revocación de tokens? → en la base de datos, no solo en memoria; una sesión cerrada voluntariamente queda invalidada incluso tras reiniciar el servidor. (Decisión del usuario #7 + derivada RNF-4/RF-26)
- ¿Se declara CORS en el backend? → Sí, la spec declara que el backend configura y aplica CORS. (Decisión del usuario #1; la parte "los orígenes se definen en la implementación" queda sustituida por la decisión del cambio sobre RF-34.)
- ¿Hay un RF explícito de cierre de sesión? → Sí, RF-31 define el cierre de sesión como comportamiento explícito: el usuario cierra su sesión y el sistema invalida el token persistentemente en la base de datos. (Decisión del usuario #3)
- ¿Cuál es la regla de contraseña mínima al dar de alta un usuario? → mínimo 8 caracteres; si tiene menos, se rechaza la alta indicando que el dato es inválido. (Decisión del usuario #4)
- ¿Puede usuarios_de_sistema restablecer contraseñas? → Sí, usuarios_de_sistema puede dar de alta usuarios y restablecer contraseñas junto con el administrador (RF-28, RF-29, RF-30 actualizados). (Decisión del usuario #8)
- ¿Es editable el campo cliente de un caso existente? → No; solo se pueden cambiar el estado y la prioridad. (Decisión del usuario #8)
- ¿Existe eliminación de casos? → No, fuera de alcance; no existe endpoint de eliminación y RF-09 solo rechaza al administrador si intenta eliminar. (Decisión del usuario #9)
- ¿Dónde se organiza el código de rutas? → un archivo por módulo: authRoutes.js, caseRoutes.js, counterRoutes.js y userRoutes.js en backend/src/routes/. (Decisión del usuario #10)
- ¿Cuál es el formato de fecha/hora local? → hora local con formato YYYY-MM-DD HH:mm:ss. (Decisión derivada)
- ¿A qué consultas vacías se aplica RF-24? → a consultas que devuelven listas vacías: casos del contador sin casos, lista de contadores, conteos de un contador sin casos. (Decisión derivada)
- ¿Cómo se resuelve la tensión entre RF-25 y la inactividad? → mientras el usuario sigue usando la aplicación (peticiones válidas), la sesión no caduca por inactividad; cada petición válida reinicia el temporizador de 30 minutos y la inactividad se mide por ausencia de peticiones válidas durante 30 minutos. (Decisión derivada)
- ¿Qué se devuelve cuando un contador no existe en un endpoint de administrador? → aviso de no encontrado (404-equivalente). (Decisión derivada RF-16; ampliada por RF-35 a identificadores de usuarios que no son contador.)
- ¿Se agrega alcance adicional más allá de lo decidido? → No; se empieza poco a poco y no se agrega alcance adicional. (Decisión del usuario #11)
- ¿Se incluye el pool de conexiones en la spec? → No; es una decisión de implementación y no forma parte de esta especificación.
- Cambio: ¿La lista de contadores puede exponer el hash de contraseña u otros datos de acceso? → No. Los datos de acceso nunca salen del servidor en ninguna respuesta (RF-33, RNF-7), y la lista de contadores devuelve solo id y usuario (RF-32), el mínimo que necesita el frontend para identificar a cada contador. Porqué: el backend entregaba filas completas de usuarios, con el hash de contraseña incluido, lo que es una fuga de datos sensibles. (Decisión del usuario, cambio previo a la spec 003.)
- Cambio: ¿Qué orígenes puede aceptar el backend? → únicamente los locales de desarrollo del frontend web; ni la aplicación de escritorio ni otros orígenes por ahora (RF-34). Porqué: aceptar cualquier origen permite que cualquier sitio web consulte la API desde el navegador de un usuario con sesión; se restringe al mínimo necesario y se ampliará con un cambio de spec cuando se requiera la versión de escritorio. (Decisión del usuario, cambio previo a la spec 003.)
- Cambio: ¿Se aceptan las peticiones que no declaran origen (herramientas de prueba, scripts, pruebas automáticas)? → Sí. Porqué: la restricción de origen protege al navegador del usuario y no es un control de acceso; el control de acceso sigue siendo el token (RF-04), y así se pueden hacer pruebas automáticas y manuales sin un navegador. (Decisión del usuario, RF-34.)
- Cambio: ¿Qué orígenes locales exactos se aceptan? → se deja al plan; la spec solo exige "orígenes locales de desarrollo del frontend web". Porqué: es un detalle de implementación. (Decisión del usuario.)
- Cambio: ¿Qué hacer con el identificador que RF-01 exige en el inicio de sesión? → se detectó que la implementación no devolvía el id; se corrige en este mismo cambio como incumplimiento de RF-01, sin requisito nuevo. Porqué: el requisito ya existía y el frontend necesita el id del usuario. (Decisión del usuario; criterio 1 reforzado.)
- Cambio: ¿Qué campos tiene cada contador en la lista de contadores? → solo id y usuario (RF-32). Porqué: es el mínimo para identificar y mostrar a cada contador. (Decisión del usuario.)
- Cambio: ¿Qué pasa si el administrador solicita conteos o casos de un identificador que no es de un contador? → aviso de no encontrado (RF-35). Porqué: la implementación trataba como contador a cualquier usuario existente, lo que devolvía datos para identificadores de administradores o de usuarios_de_sistema, que no son contadores. (Decisión del usuario.)
- Cambio 1: ¿Cómo se trata un identificador de contador con texto mezclado con números (por ejemplo "2abc") o no numérico? → como un identificador que no corresponde a un contador: aviso de no encontrado (RF-35). Porqué: de lo contrario la base de datos lo interpretaría como el número que aparece al principio y devolvería datos de otro contador. (Decisión del usuario: se mantiene.)
- Cambio 2: ¿Se reparan las pruebas del backend antes de construir el frontend? → Sí, mediante un bloque de reparación previo al frontend que hace que todos los archivos de prueba se registren con el ejecutor nativo y ejecuten pruebas reales, sin paquetes nuevos (criterio 25 reescrito). Porqué: la validación anterior dio por buenas pruebas que no se ejecutaban (los archivos se cargaban y contaban como correctos sin comprobar nada), de modo que el criterio de la puerta de pruebas se cumplía solo en apariencia. (Decisión del usuario.)
- Cambio 2: ¿Qué se hace con los valores fijos de prueba que el backend aceptaba como credencial de acceso? → se eliminan ya, dentro del bloque de reparación; las pruebas de autenticación y de perfiles se rehacen usando solo tokens emitidos por el inicio de sesión (criterio 30). Porqué: se detectó una puerta trasera: ciertos valores fijos daban acceso sin iniciar sesión, lo que incumple RF-04 y RF-07. No es un requisito nuevo, sino un incumplimiento de la implementación; por eso no se añade ningún RF y se refuerzan los criterios. (Decisión del usuario.)
- Cambio 2: ¿Qué se hace con el experimento de pruebas suelto que falla siempre? → se elimina. Porqué: no es una prueba del proyecto y hace fallar la ejecución completa, lo que impide cumplir el criterio 25. (Decisión del usuario.)
- Cambio 2: ¿Cómo se cuenta el máximo de 10 tareas? → por bloque de cambio dentro de esta spec: el Cambio 1 y la reparación (Cambio 2) son bloques de cambio de la spec 002 y no se abre una spec nueva. Porqué: modifican requisitos de la misma spec y comparten su criterio de cierre. (Decisión del usuario.)
- Cambio 3 (previsto): ¿Qué defectos de robustez y de perfil se tratarán aparte y cuándo? → se agrupan en un Cambio 3 de esta spec, que se hará después del Cambio 2 y antes del frontend, con el flujo completo (spec, aprobación, plan y tareas, aprobación). Incluye: (1) entradas no textuales en el inicio de sesión (por ejemplo un usuario o una contraseña enviados como número) que dejan la petición colgada sin respuesta; (2) los errores de base de datos que se ignoran al registrar la sesión, actualizar su actividad y revocarla, de modo que un cierre de sesión podría avisar de éxito sin haber invalidado el token (RF-26, RF-31); (3) el rol de contador exigido al cambiar el estado o la prioridad de un caso, para que un administrador o un usuarios_de_sistema reciba siempre acceso denegado (RF-09) y no «no encontrado» sobre un caso inexistente. Porqué: son defectos de la implementación detectados al revisar el backend; se separan de los Cambios 1 y 2 para no mezclar alcances y se resuelven antes del frontend para que este se construya sobre un backend robusto. (Decisión del usuario; sin requisitos redactados hasta su propia spec.)

## Dudas abiertas

- [NECESITA ACLARACIÓN] RF-28 y el criterio 9 exigen que un perfil autorizado pueda restablecer la contraseña de un usuario existente, pero la implementación solo permite dar de alta usuarios. Opciones: (a) implementar el restablecimiento de contraseñas en un cambio posterior de esta spec; (b) retirar el restablecimiento de RF-28 y del criterio 9 y moverlo a otra spec. No bloquea los Cambios 1 y 2.
