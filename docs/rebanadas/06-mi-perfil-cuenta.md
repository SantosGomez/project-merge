# 06 — «Mi perfil»: mi cuenta y «Mis auxiliares» en la misma vista

- **Riesgo:** medio (endpoint nuevo de solo lectura de la cuenta propia, ruta nueva y cambio del menú; sin cambios de tabla ni de permisos existentes)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Sonnet, instancia nueva)
- **Estado:** refinada

## Historia

Como contador o auxiliar, quiero abrir «Mi perfil» desde mi nombre al pie del menú para ver los datos de mi cuenta y, si soy contador, gestionar ahí mismo a mis auxiliares.

## Criterios de aceptación

1. **`GET /auth/perfil`** (con `authenticateToken`) devuelve 200 con `{ id, nombre, correo, rol, creado_en, ultimo_acceso_en }` de la cuenta de la sesión; las fechas en hora local `YYYY-MM-DD HH:mm:ss` (`formatLocalDate`), `ultimo_acceso_en` puede ser `null`. Nunca devuelve `password_hash` ni datos de otra cuenta. Sin token: 401.
2. **Ruta `perfil`** (nombre `mi-perfil`, título «Mi perfil», perfiles contador y auxiliar) pinta la vista existente `pages/ContadorAuxiliaresPage.vue` modificada (no se crea otra página ni se renombra el archivo). `contador/auxiliares` solo redirige a `mi-perfil`.
3. **Sección «Mi cuenta»** (primera de la vista): avatar con iniciales, nombre, rol legible (`formatearRol`) y, con icono por campo, «Correo», «Cuenta creada el» (`DD-MM-AAAA`) y «Último inicio de sesión» (`DD-MM-AAAA HH:mm`; si es `null`, «Sin registro»). Mientras carga se muestra el nombre y el rol de la sesión con esqueletos en los demás datos; si falla, un mensaje de tres partes con «Reintentar» dentro de la sección, sin tumbar el resto de la vista.
4. **Sección «Mis auxiliares»**: solo para el contador; es la lista actual movida tal cual (mismo texto de ayuda, botón «Agregar auxiliar», lista, estado vacío, confirmación al quitar y avisos). El auxiliar no la ve ni se piden sus datos.
5. **Menú lateral**: desaparece el ítem «Mis auxiliares». Para contador y auxiliar, el bloque del usuario al pie (iniciales, nombre y rol) es un enlace a «Mi perfil» (`aria-label="Ir a mi perfil"`, estado activo y `aria-current` en esa ruta, foco celeste como los demás ítems, sigue viéndose solo el avatar en el menú compacto y conserva el tooltip del nombre). Para administrador y usuario de sistema el bloque queda como hoy, sin enlace.
6. El botón «Ver mis auxiliares» de la pestaña «Mi equipo» (`ContadorDashboardPage.vue`) lleva a `mi-perfil`.

## Archivos autorizados

- `Backend/src/controllers/authController.js`, `Backend/src/routes/authRoutes.js`, `Backend/src/models/UserModel.js` (solo si `findById` no trae las columnas) y una prueba nueva en `Backend/test/`.
- `Seguimiento-proyectos/src/services/authService.js` (función `obtenerPerfil`), `src/pages/ContadorAuxiliaresPage.vue`, `src/router/index.js`, `src/layouts/MaquetaLayout.vue`, `src/pages/ContadorDashboardPage.vue` (solo el destino del botón).
- `Seguimiento-proyectos/test/`: prueba nueva `miPerfil.test.js` y el ajuste de los asertos que exigían la ruta o el ítem anterior (`revisionAuxiliaresUI.test.js`, `rolAuxiliar.test.js`, `layout-drawer-check.js`, y los que fallen por el mismo motivo). Se cambian porque cambia el requisito; deben seguir exigiendo que el auxiliar no gestione auxiliares.

Fuera de esta lista, el implementer para y pregunta.

## Notas del orquestador

- Decisiones del usuario (2026-11-11): reutilizar la vista de «Mis auxiliares» en vez de crear otra; endpoint nuevo para los datos de la cuenta; la sección se llama «Mis auxiliares» (no «Mi equipo»).
- Diseño (impeccable, modo Operate, «El expediente ordenado»): precisión y calma, nada decorativo. Cada sección es un `q-card flat bordered` (radius 8 px, borde `--dg-borde`) con título de sección `h2` de 1.1rem/600. En escritorio (≥1024 px) dos columnas: «Mi cuenta» a la izquierda (ancho fijo ~340 px) y el resto a la derecha; por debajo, una sola columna en este orden: cuenta, auxiliares. Filas de dato con icono `text-dg-texto-tenue`, etiqueta en `--dg-texto-secundario` 0.85rem y valor en `--dg-texto`; el correo largo se corta con `overflow-wrap: anywhere`. La vista deja de tener su propio `h1` «Mis auxiliares» (el título de la página ya lo pone el layout).
- Movimiento (emil): la vista no anima su entrada; botones con `.boton-presionable`; diálogos con `dialogo-entra`/`dialogo-sale` como ya están. Sin animaciones nuevas.
- Fechas: nunca `new Date('AAAA-MM-DD')`; usar las utilidades de `dateUtils.js`/`fechasCaso.js`.
- Costuras de prueba: backend, la ruta HTTP con `soporte-pruebas/http.js`; frontend, `authService.obtenerPerfil` con api falsa, `decidirAcceso`/rutas, y el contenido de la plantilla como en `revisionAuxiliaresUI.test.js`.
- **NO entra:** cambiar contraseña (07), cartera de clientes (08), «Apoyas a» del auxiliar (09), perfil para administrador o usuario de sistema, editar nombre o correo.
- Trampas: pruebas del backend por archivo (todas juntas se cuelgan); `verificarPruebas.js` da «FALLA» solo por `MINIMOS`; solo cuentas `zz_test_` (hay 12 de antes: deben seguir siendo 12); nada en segundo plano; varios `.vue` usan CRLF; `session.id` es texto.
- Puertas: Backend `node --test` del archivo nuevo y de `authRoutes`, más `node soporte-pruebas/verificarPruebas.js`. Frontend `npm run lint:check`, `npm run build`, `node --test`. El navegador lo verifica el orquestador.

---

## Reporte del implementer

Claude, agente `implementer` (Sonnet), 2026-11-11. Resumido por el orquestador.

1. Rebanada completada: criterios 1 a 6.
2. Archivos modificados: backend `AuthController.js` (`obtenerPerfil`; 404 si la cuenta ya no existe), `authRoutes.js` (`GET /auth/perfil`), `test/miPerfil.test.js` (nuevo); frontend `authService.js` (`obtenerPerfil`), `ContadorAuxiliaresPage.vue`, `router/index.js` (ruta `mi-perfil`; `contador/auxiliares` redirige y pierde su nombre), `MaquetaLayout.vue` (sin ítem «Mis auxiliares»; el bloque del usuario es `router-link` para quien trabaja casos), `ContadorDashboardPage.vue` (destino del botón), `test/miPerfil.test.js` (nuevo, 17 pruebas) y ajustes en `revisionAuxiliaresUI`, `rolAuxiliar`, `layout-drawer-check` y `revisionMenuLateral` (8 ítems en lugar de 9).
3. Pruebas en rojo: backend `actual: 404, expected: 200`; frontend 15 de 17 en rojo (no existían `obtenerPerfil`, la ruta, la sección «Mi cuenta» ni el enlace del pie).
4. Puertas: backend `miPerfil` 3/3, `authRoutes` 19/19, `verificarPruebas.js` 403 pruebas y 0 fallidas (FALLA solo por `MINIMOS`); frontend lint y build en verde, `node --test` 1115/1115. 12 filas `zz_test_%`, como al inicio.
5. Decisiones no cubiertas: el perfil se carga en la propia página (estado local); el último inicio se arma con `fechaParaFormulario` + la hora del texto, sin `new Date`.
6. Para la memoria: ruta `mi-perfil` y `GET /auth/perfil`.

## Veredicto del reviewer (vuelta 1)

Claude, agente `reviewer` (Sonnet, instancia nueva), 2026-11-11. Resumido por el orquestador.

VEREDICTO: APROBADO

- Los 6 criterios se cumplen. `GET /auth/perfil` busca por `req.user.id` y arma el JSON con seis campos explícitos: no puede salir `password_hash`.
- El auxiliar no ve ni pide «Mis auxiliares»; el enlace del pie solo existe con `session.trabajaCasos`.
- Los asertos ajustados cambian solo por el requisito nuevo. Puertas repetidas: backend 3/3 y 19/19, `verificarPruebas.js` 0 fallidas, frontend lint, build y 1115/1115; 12 filas `zz_test_%`.

Opcional (no bloquea): prueba de que `/auth/perfil` devuelve la cuenta propia habiendo otras; las pruebas de plantilla por expresión regular son frágiles ante renombres.
