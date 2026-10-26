# Backlog — Seguimiento de Proyectos

## Context
Mejora de UI/UX del layout de «Seguimiento de Proyectos» (estado de los casos de los contadores de DelGrow), para que mantenga la identidad visual de las demás apps de DelGrow.
Stack: Quasar v2 (Vue 3) + Express + MariaDB; Electron para el .exe de Windows.
Expensive decisions: modelo de roles (ya existe: administrador, contador y usuarios_de_sistema).

## Backlog
1. Como usuario, quiero un menú lateral oscuro de altura completa con el logo, «Grupo DelGrow S.C.» y «Seguimiento de Proyectos», para reconocer la app como parte de DelGrow.
2. Como usuario, quiero ver en el menú solo las opciones de mi rol, agrupadas en secciones («Administración» o «Mis casos»), para no entrar en pantallas que me niegan el acceso. Requires: #1
3. Como usuario, quiero ver al pie del menú mis iniciales, mi nombre y mi rol, para saber con qué sesión estoy trabajando. Requires: #1
4. Como usuario, quiero cerrar sesión desde el pie del menú, con la confirmación de siempre, para salir sin buscar el botón en otro lugar. Requires: #3
5. Como usuario de escritorio, quiero trabajar sin la barra superior, con el título y el botón «Volver» dentro de la página, para tener más espacio y un diseño limpio. Requires: #4
6. Como usuario de celular, quiero una barra superior delgada con el botón de menú y el nombre de la página, para poder abrir la navegación en pantallas pequeñas. Requires: #5
7. Como usuario de escritorio, quiero que el menú quede compacto, solo con iconos, y se despliegue al pasar el cursor, para ganar espacio sin perder la navegación. Requires: #1
8. Como usuario de escritorio, quiero fijar o soltar el menú abierto con un clic en el logo y que se recuerde la próxima vez, para elegir cómo prefiero trabajar. Requires: #7
9. Como usuario de sistema, quiero una sección «Usuarios» en el menú para dar de alta cuentas y restablecer contraseñas, para administrar el acceso sin ver los casos de los contadores. Requires: #2
   - 9b. Como usuario de sistema, quiero restablecer la contraseña de una cuenta escribiendo su correo en la sección «Usuarios», para devolverle el acceso a quien la olvidó sin ver los casos de los contadores. Requires: 9a

Notas acordadas:
- #2: solo administrador («Administración») y contador («Mis casos»). `usuarios_de_sistema` no ve «Administración»: hoy no tiene pantallas y las rutas de contadores exigen administrador; su sección llega con la #9.
- 9b: el correo va en el cuerpo (`PATCH /usuarios/restablecer-contrasena` con `{ correo, password }`), sin campo de confirmación; sin listar cuentas, sin pantalla para el administrador y sin envío de correos.
- #8: el logo muestra cursor de mano y un tooltip («Fijar menú abierto» / «Volver a menú compacto») y se activa también con el teclado.

## Pendiente aparte
- Pantallas de alta de usuarios y de restablecer contraseña (el backend ya existe): las cubre la #9 para `usuarios_de_sistema`. Si el administrador también debe usarlas, se decide al refinar la #9.
