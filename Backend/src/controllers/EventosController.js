const SessionModel = require('../models/SessionModel');
const { sesionInactiva } = require('../middlewares/authMiddleware');
const { buildError } = require('../utils/errorUtils');
const { eventos, MAX_CONEXIONES_POR_USUARIO } = require('../utils/eventos');

/**
 * Entrega un pase de un solo uso (60 s) para abrir la conexión de tiempo real.
 * El navegador no puede mandar el token en la cabecera de EventSource; así el token
 * nunca viaja en la URL.
 * @param {Object} req - Petición Express con req.user y req.jti (authenticateToken).
 * @param {Object} res - Respuesta Express.
 */
async function crearPase(req, res) {
  const pase = eventos.crearPase({ usuarioId: req.user.id, rol: req.user.rol, jti: req.jti });
  return res.status(200).json({ pase });
}

/**
 * Abre la conexión de Server-Sent Events con un pase válido y la deja abierta.
 * No pasa por authenticateToken: tenerla abierta no cuenta como actividad de la sesión.
 * En cada latido revisa que la sesión siga valiendo; si no, avisa y cierra.
 * @param {Object} req - Petición Express con query.pase.
 * @param {Object} res - Respuesta Express.
 */
async function abrirEventos(req, res) {
  const { pase } = req.query;
  const datos = typeof pase === 'string' && pase !== '' ? eventos.canjearPase(pase) : null;
  if (!datos) {
    return res.status(401).json(
      buildError('Pase no válido o vencido', 'pase de eventos', 'Recarga la página para volver a conectarte')
    );
  }

  if (eventos.contarDeUsuario(datos.usuarioId) >= MAX_CONEXIONES_POR_USUARIO) {
    return res.status(429).json(
      buildError(
        'Demasiadas conexiones abiertas',
        'tiempo real',
        `Cierra otras pestañas o equipos de tu cuenta (máximo ${MAX_CONEXIONES_POR_USUARIO}) y recarga la página`
      )
    );
  }

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx no debe juntar los mensajes en su búfer
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');

  const conexion = { ...datos, res };
  eventos.agregar(conexion);
  eventos.escribir(conexion, 'conectado', {});

  const latido = setInterval(async () => {
    res.write(':latido\n\n');
    let sesion;
    try {
      sesion = await SessionModel.obtenerSesion(datos.jti);
    } catch (err) {
      return; // Un fallo de la base no cierra la conexión; se revisa en el siguiente latido
    }
    if (!sesion || sesion.revocado || sesionInactiva(sesion, new Date())) {
      eventos.escribir(conexion, 'sesion-cerrada', {});
      res.end();
    }
  }, eventos.obtenerLatido());

  res.on('close', () => {
    clearInterval(latido);
    eventos.quitar(conexion);
  });
}

module.exports = { crearPase, abrirEventos };
