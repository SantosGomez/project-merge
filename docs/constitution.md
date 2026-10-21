# Constitución — DelGrow Estado Contadores

Principios innegociables. Toda spec, plan y tarea debe cumplirlos.

1. **La spec manda**: nada se implementa si no está en la spec activa. Si falta una decisión, se para y se pregunta.

2. **Tests como puerta**: la lógica se prueba con `node --test`, sin instalar paquetes. Prohibido avanzar con tests en rojo.

3. **Los datos del usuario son sagrados**: localStorage con compatibilidad hacia atrás y fechas siempre en hora local. Nunca se pierde una sesión.

4. **Idioma**: código en inglés; interfaz y documentación en español.

5. **Seguridad de contraseñas**: Todo hash de contraseña debe utilizar Argon2id como estándar obligatorio antes de cualquier almacenamiento en base de datos.

## Estándar de Arquitectura del Backend

1. **Estructura Modular Obligatoria:** Todo el código del servidor debe seguir estrictamente la arquitectura desacoplada en `/backend/src/`:
   - `/config/`: Variables de entorno, constantes y configuración de servicios/BD.
   - `/controllers/`: Lógica de negocio de cada módulo o endpoint.
   - `/middlewares/`: Capas de seguridad (validación JWT, Argon2id, roles) y manejo de peticiones.
   - `/models/`: Capa de datos, consultas SQL o definidores de esquemas.
   - `/routes/`: Definición y mapeo de rutas HTTP de Express.
   - `/utils/`: Funciones auxiliares y formateadores globales.

2. **Separación de Responsabilidades en el Servidor:**
   - `app.js`: Contiene únicamente la configuración de Express, middlewares globales, cabeceras CORS y el montaje de rutas.
   - `server.js`: Se limita exclusivamente a inicializar el servidor y escuchar en el puerto correspondiente.

3. **Inmutabilidad de la Estructura:** No se permite la creación de controladores o rutas planas directamente en la raíz de `/backend/`.
