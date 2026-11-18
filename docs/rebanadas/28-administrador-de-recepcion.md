# 28 — Administrador que atiende la recepción, configurable por id

- **Riesgo:** alto (permisos y configuración de producción)
- **Implementa:** Claude (`implementer`, Sonnet)
- **Revisa:** Claude (`reviewer`, Opus)
- **Estado:** aprobada

## Historia

Como despacho, quiero decidir **a qué administrador atiende la recepcionista**, en lugar de que administre la agenda de todos, y que ella vea con claridad de quién es la agenda que administra.

## Decisión del usuario (2026-11-18)

- En producción, la recepcionista solo trabaja para **un administrador**: Alejandro Delgado, id **7947**.
- En la base local (XAMPP) ese administrador es el id **1**. En local también existen los administradores 7947 y 11081.
- El id se configura por variable de entorno, igual que `USUARIOS_CON_ACTIVIDADES`.

## Criterios de aceptación

### Configuración

1. **Variable `ADMINISTRADORES_DE_RECEPCION`**, que se lee en `Backend/src/config/recepcion.js` (nuevo) en cada consulta, con el mismo patrón que `config/modulos.js`:
   - **Lista de ids separados por comas** (`7947` o `1,7947`): solo esos administradores tienen secretaria.
   - **Definida pero vacía:** ningún administrador tiene secretaria.
   - **Sin definir:** en desarrollo y pruebas, todos los administradores, como hoy. En producción, ninguno; si se olvida configurarla, no se abre el acceso por accidente.
   - **Un id que no es administrador** o que no existe se ignora. No da error al arrancar.
2. **Archivos de entorno:**
   - `docker-compose.yml` pasa la variable al backend (`ADMINISTRADORES_DE_RECEPCION: ${ADMINISTRADORES_DE_RECEPCION-}`).
   - `.env.example` la documenta con `7947` como ejemplo.
   - El orquestador deja `ADMINISTRADORES_DE_RECEPCION=1` en `Backend/.env` (local) y `ADMINISTRADORES_DE_RECEPCION=7947` en el `.env` de la raíz (Docker). Los dos están en `.gitignore`.
   - `soporte-pruebas/http.js` no la fija, para que las pruebas existentes sigan viendo a todos los administradores. Las pruebas nuevas la fijan y la restauran.

### Backend

3. **Reglas de secretaria** (`utils/accesoJuntas.js`): todas las que hoy dicen «administrador» pasan a ser «administrador atendido por la recepción». Eso incluye:
   - ver completas sus juntas;
   - editar y borrar;
   - el contenido de `responder_por`;
   - la agenda completa;
   - `organizador_id` en el alta.
   - Con un administrador que no está en la lista, la recepcionista se comporta como cualquier tercero: «Ocupado» o 404, y 400 sobre `organizador` si intenta agendar a su nombre.
   - De paso se mueve a `accesoJuntas.js` la comprobación `rol !== 'administrador'` que quedó en `JuntaController.js:251` (opcional 1 de la revisión de la 27).
4. **Perfil:** `POST /auth/login` y `GET /auth/perfil` devuelven, solo para la recepcionista, `administradores_atendidos: [{ id, nombre }]`, que puede ir vacío. Los demás roles no reciben esa llave.
5. **Pruebas:**
   - con la lista `[A]`, la recepcionista administra a A y no a B;
   - con la lista vacía, no administra a nadie;
   - sin definir en `NODE_ENV=production`, no administra a nadie;
   - sin definir fuera de producción, administra a todos;
   - un id que no es administrador se ignora.
   - Se actualizan `autorizacionMatriz` e `inyeccionSql` si hace falta.

### Frontend

6. **Sesión:** el store guarda `administradoresAtendidos` desde el login y el perfil, y lo limpia al cerrar sesión.
7. **«Mi Calendario» para la recepcionista:**
   - **Aviso visible arriba:** «Administras la agenda de {nombre}», o «de {nombre} y {nombre}» si son varios. Incluye el botón «Ver su agenda», que abre `?agenda={id}`.
   - **Si no administra a nadie:** «No tienes asignada la agenda de ningún administrador. Pídele al despacho que la configure».
   - **Al entrar sin `?agenda=`:** si administra exactamente a un administrador, la pantalla abre directamente la agenda de él.
   - **«Ver agenda de»:** sigue listando a todos, pero junto al administrador que atiende aparece «(lo administras)».
   - Los permisos de cada junta siguen viniendo del backend (`puede_editar`, `responder_por`); el frontend no los deduce.
8. **Estilo:** Quasar, paleta `$dg-colores`, textos en tú y sin tooltips dentro del calendario. Funciona a 375 px.
9. **Datos de prueba:** solo cuentas `zz_test_`. Al terminar quedan 0 filas `zz_test_%` y 0 juntas y avisos de prueba. Los datos del usuario no se tocan.

## Archivos autorizados

Backend:
- `src/config/recepcion.js` (nuevo)
- `src/utils/accesoJuntas.js`, `src/controllers/JuntaController.js`, `src/models/JuntaModel.js` y `src/controllers/AuthController.js` (solo la llave del perfil)
- `test/recepcionAdministradores.test.js` (nuevo), `test/accesoJuntas.test.js`, `test/recepcionistaJuntas.test.js`, `test/authRoutes.test.js`, `test/autorizacionMatriz.test.js` e `test/inyeccionSql.test.js`
- `soporte-pruebas/verificarPruebas.js` (`MINIMOS`)
- `docker-compose.yml` (solo la variable) y `.env.example`

Frontend:
- `src/stores/session.js` y `src/services/authService.js` (si guarda el perfil)
- `src/pages/JuntasPage.vue` y `src/utils/juntas.js`
- `test/juntas*.test.js`, `test/rolRecepcionista.test.js` y las pruebas de sesión que fallen, sin debilitarlas

Fuera de esta lista, el implementer para y pregunta. **No hay cambios de esquema.** El implementer no edita los `.env`; los ajusta el orquestador.

## Notas del orquestador

- **Producción:** antes de publicar hay que confirmar en la base de Docker que el id 7947 tiene rol `administrador`. Si no lo tiene, la recepcionista no administrará a nadie y verá el aviso de que no tiene ninguna agenda asignada.
- Puertas:
  - Backend: `node --test --test-concurrency=1` por archivo y `verificarPruebas.js`.
  - Frontend: `lint:check`, `prettier --check` de lo tocado, `build` y `node --test`.
- Navegador, con el backend 3011 y `ADMINISTRADORES_DE_RECEPCION` igual al id de un administrador `zz_test_` (A), creando además otro administrador `zz_test_` (B):
  - la recepcionista entra y cae en la agenda de A, con el aviso «Administras la agenda de A»;
  - en la agenda de B ve sus juntas privadas solo como «Ocupado» y no puede agendar a nombre de B;
  - comprobar en escritorio y a 375 px.

---

## Reporte del implementer

1. **Rebanada completada:** sí, backend y frontend, sin cambios de esquema.
   - La variable se lee en `config/recepcion.js` (`administradorEsAtendido`).
   - Si no está definida, se abre fuera de producción y se cierra en producción. Si está vacía, nadie. Si trae una lista, solo esos ids.
2. **Archivos:**
   - Backend:
     - Nuevos: `config/recepcion.js` y `test/recepcionAdministradores.test.js` (11).
     - `accesoJuntas.js`: `esAdministradorAtendido` y `puedeAgendarANombreDe`. Además, `veAgendaCompleta` ahora recibe `{id, rol}` del dueño de la agenda.
     - `JuntaController.js`: `resolverOrganizador` ya no repite la comprobación de rol.
     - `JuntaModel.js` y `AuthController.js`: `administradores_atendidos` en el login y en el perfil.
     - Pruebas `accesoJuntas` (18), `recepcionistaJuntas` y `autorizacionMatriz`; `MINIMOS`; `docker-compose.yml` y `.env.example`.
   - Frontend: `session.js`, `authService.js`, `juntas.js`, `JuntasPage.vue` y 4 archivos de pruebas.
3. **Prueba en rojo:**
   - `recepcionAdministradores`: faltaba el módulo y luego 8 pruebas fallaron por aserto.
   - Frontend: `juntasUtils`, `sessionStore` (5), `authService` (2) y `juntasPantalla` fallaron por aserto o por un import inexistente.
4. **Puertas:**
   - Backend: 841 pruebas (mínimo 752).
   - Frontend: `lint` y `build` en verde; `node --test` 1613/1613.
   - `prettier --check`: en rojo solo en archivos que ya fallaban antes de esta rebanada.
   - Navegador, con un backend 3011 propio que fijaba la variable en el entorno del proceso:
     - la recepcionista entra directo a la agenda de A, con el aviso «Administras la agenda de A»;
     - en la agenda de B ve las privadas como «Ocupado» y no aparece «Organiza»;
     - «(lo administras)» sale solo junto a A;
     - con la lista vacía aparece el aviso de que no tiene agenda asignada;
     - a 375 px no hay scroll horizontal.
   - Datos de prueba: quedan 0. Siguen las juntas 264, 523 y 787 del usuario, y la 1505, «Junta con CocaCola», que creó una cuenta real (41169) durante la sesión. No se tocaron.
5. **Decisiones no cubiertas:**
   - `Backend/.env` trae `=1` y dotenv lo carga en las pruebas, así que las pruebas que necesitan «todos los administradores» quitan o fijan la variable ellas mismas.
   - `administradoresAtendidos` vive en la memoria del store; no se guarda en sessionStorage.
   - Mensaje nuevo: «La persona elegida no es un administrador que atiendas».
   - Con varios administradores atendidos, hay un botón por cada uno.
6. **Para la memoria:**
   - La recepcionista solo administra a los ids de `ADMINISTRADORES_DE_RECEPCION`.
   - Trampa: dotenv carga `Backend/.env` en las pruebas.
   - Antes de desplegar, confirmar que el id 7947 es administrador en la base de Docker.

## Veredicto del reviewer (vuelta 1)

**VEREDICTO: APROBADO** (Opus, 2026-11-18, sin modificar archivos).

- Se cumplen los 9 criterios.
- Todas las reglas de la secretaria pasan por `esAdministradorAtendido`; no queda ninguna comprobación de rol suelta que funcione como permiso.
- Con un administrador no atendido, la recepcionista ve «Ocupado» y recibe 404 al consultar o responder, y 400 sobre organizador si intenta agendar a su nombre.
- La llave nueva del perfil solo la recibe la recepcionista.
- Las pruebas restauran siempre la variable.
- Puertas: backend 166/166 en los 9 archivos y `verificarPruebas.js` OK con 841 pruebas; frontend `lint` y `build` en verde y `node --test` 1613/1613.
- No probó en el navegador.

**Opcionales:**

1. Formato del `module.exports` en `accesoJuntas.js:109`. **Aplicado por el orquestador:** `accesoJuntas` sigue en 18/18.
2. Algunos comentarios del controlador y del modelo todavía dicen «un administrador» donde la regla ahora es «un administrador atendido».
3. En `recepcionAdministradores.test.js`, editar una junta de B acepta 403 o 404; se podría fijar en 404.
4. Si `GET /auth/perfil` falla por la red, la pantalla puede mostrar por un momento el aviso de «sin agenda asignada».
5. Antes de publicar, confirmar en Docker que el id 7947 es administrador.

## Cierre del orquestador

- `AGENTS.md` ya dice que la recepcionista atiende solo a los administradores de `ADMINISTRADORES_DE_RECEPCION`.
- `Backend/.env` queda en `1` y el `.env` de la raíz en `7947`.
- En el navegador me apoyo en la prueba del implementer.
- **Prueba real del usuario:** en la base hay una junta, «Junta con CocaCola», que la recepcionista real 41169 agendó a nombre de la administradora 1. Es la prueba que hizo el usuario con la cuenta real.
- **Estado:** aprobada (2026-11-18).
