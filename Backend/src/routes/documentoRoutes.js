const express = require('express');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../utils/asyncHandler');
const { pool, query } = require('../config/db');
const { modulosDeUsuario } = require('../models/UsuarioModuloModel');

// El código del módulo viene de Proyecto-documentos y es ESM (.mjs); Node lo carga con require().
const { hayAcceso } = require('../modulos/documentos/logica/errores.mjs');
const { rutaCatalogos } = require('../modulos/documentos/rutas/catalogos.mjs');
const { rutaClientes, rutaCrearCliente, rutaConsultarCliente, rutaEditarCliente } = require('../modulos/documentos/rutas/clientes.mjs');
const { rutaClientesFrecuentes } = require('../modulos/documentos/rutas/clientesFrecuentes.mjs');
const { rutaConsultarRequeridos, rutaCrearRequerido } = require('../modulos/documentos/rutas/requeridos.mjs');
const { rutaSeguimiento } = require('../modulos/documentos/rutas/seguimiento.mjs');
const {
  rutaDocumentos,
  rutaListaDocumentos,
  rutaListaDireccionamiento,
  rutaListaEntregados,
  rutaCambiarEstado,
  rutaEntregarDocumento,
  rutaSubirArchivo,
  rutaDescargarArchivo,
} = require('../modulos/documentos/rutas/documentos.mjs');

/**
 * Módulo «Recepción de documentos» (unión con Proyecto-documentos, fase 3), montado en /doc.
 *
 * - La sesión es la de status-conta (token y cookie). Entra quien tiene el módulo de documentos
 *   (`usuario_modulos` o, si es administrador, por su rol); los demás reciben 403.
 * - Cada ruta pide el mismo permiso que en documentos (`hayAcceso` de errores.mjs), con el rol
 *   que la cuenta tiene dentro del módulo.
 * - Las respuestas conservan el formato de documentos ({ error, mensaje }) para su frontend.
 * - Este router va antes del `express.json` de 100 kb de la app: las firmas en base64 piden hasta
 *   2 MiB y la subida de archivos llega en crudo.
 */

// Rol del módulo (minúsculas, como en usuario_modulos) → nombre que usan los permisos de documentos.
const ROL_DOCUMENTOS = {
  administrador: 'Administrador',
  contador: 'Contador',
  recepcionista: 'Recepcionista',
  practicante: 'Practicante',
  sistemas: 'Sistemas',
  cliente: 'Cliente',
};
const ROLES_ASIGNABLES = Object.keys(ROL_DOCUMENTOS).filter((rol) => rol !== 'cliente');
const LIMITE_ARCHIVO = 25 * 1024 * 1024;
const carpetaAdjuntos = () => process.env.CARPETA_ADJUNTOS || './storage';

const router = express.Router();

function sinPermiso(res, mensaje) {
  return res.status(403).json({ error: 'SIN_PERMISO', mensaje });
}

/** Deja en req.documentos el rol de la cuenta dentro del módulo; sin módulo, 403. */
async function conModuloDocumentos(req, res, next) {
  const modulos = await modulosDeUsuario({ id: req.user.id, rol: req.user.rol });
  const documentos = modulos.find((m) => m.modulo === 'documentos');
  const rol = documentos && ROL_DOCUMENTOS[documentos.rol];
  if (!rol) {
    return sinPermiso(res, 'Tu cuenta no tiene acceso a Recepción de documentos.');
  }
  req.documentos = { id: req.user.id, rol };
  return next();
}

/** Exige al menos uno de los permisos de documentos. */
function permiso(acciones, mensaje) {
  return (req, res, next) =>
    acciones.some((accion) => hayAcceso(req.documentos.rol, accion)) ? next() : sinPermiso(res, mensaje);
}

/** Envía el `{ status, body, headers, archivo }` que devuelven las rutas de documentos. */
function responder(res, { status = 200, body = null, headers = {}, archivo } = {}) {
  res.set(headers);
  if (archivo) {
    res.status(status);
    res.set('Content-Type', archivo.mimeType);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(archivo.nombre)}"`);
    return res.end(archivo.buffer);
  }
  if (body === null) return res.status(status).end();
  return res.status(status).json(body);
}

const manejar = (fn) => asyncHandler(async (req, res) => responder(res, await fn(req)));
const id = (valor) => Number(valor);

router.use(authenticateToken, asyncHandler(conModuloDocumentos));

// Subida en crudo (antes del parser JSON): el nombre llega en la URL, nunca en una cabecera.
router.post(
  '/documentos/:id/archivos',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para subir archivos.'),
  express.raw({ type: () => true, limit: LIMITE_ARCHIVO }),
  manejar((req) => {
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const nombreOriginal = req.query.nombreOriginal || '';
    const tipo = req.headers['content-type'];
    const mimeType = req.query.mimeType || (tipo ? String(tipo).split(';')[0].trim() : null);
    return rutaSubirArchivo(pool, carpetaAdjuntos(), id(req.params.id), nombreOriginal, mimeType, contenido, req.documentos.id);
  })
);

router.use(express.json({ limit: '2mb' }));

router.get('/catalogos', manejar(() => rutaCatalogos(pool)));

router.post(
  '/documentos',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para recepcionar documentos.'),
  manejar((req) => rutaDocumentos(pool, req.body || {}, req.documentos.id))
);
router.get(
  '/documentos',
  permiso(['ver_directorio'], 'Tu cuenta no tiene permisos para ver los documentos recibidos.'),
  manejar((req) => rutaListaDocumentos(pool, req.query, req.documentos))
);
router.get(
  '/documentos/direccionamiento',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para ver los documentos por entregar.'),
  manejar(() => rutaListaDireccionamiento(pool))
);
router.get(
  '/documentos/entregados',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para ver los documentos entregados.'),
  manejar((req) => rutaListaEntregados(pool, req.query))
);
router.post(
  '/documentos/:id/estado',
  permiso(['cambiar_estado'], 'Tu cuenta no tiene permisos para cambiar el estado de los documentos.'),
  manejar((req) => rutaCambiarEstado(pool, id(req.params.id), req.body || {}, req.documentos.id, req.documentos.rol))
);
router.post(
  '/documentos/:id/entrega',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para entregar documentos al contador.'),
  manejar((req) => rutaEntregarDocumento(pool, id(req.params.id), req.body || {}, req.documentos.id))
);
router.get(
  '/documentos/:id/archivos/:archivoId',
  permiso(['ver_seguimiento'], 'Tu cuenta no tiene permisos para descargar archivos.'),
  manejar((req) =>
    rutaDescargarArchivo(
      pool,
      carpetaAdjuntos(),
      id(req.params.id),
      id(req.params.archivoId),
      req.documentos.id,
      req.documentos.rol,
      null // el portal de clientes (rol Cliente) todavía no está activo
    )
  )
);

router.get(
  '/clientes/frecuentes',
  permiso(['registrar_recepcion'], 'Tu cuenta no tiene permisos para recepcionar documentos.'),
  manejar(() => rutaClientesFrecuentes(pool))
);
router.get(
  '/clientes',
  permiso(['ver_directorio'], 'Tu cuenta no tiene permisos para ver el directorio de clientes.'),
  manejar((req) => rutaClientes(pool, req.query))
);
router.post(
  '/clientes',
  permiso(['crear_cliente'], 'Tu cuenta no tiene permisos para registrar clientes.'),
  manejar((req) => rutaCrearCliente(pool, req.body || {}))
);
router.get(
  '/clientes/:id',
  permiso(['ver_directorio'], 'Tu cuenta no tiene permisos para ver el expediente del cliente.'),
  manejar((req) => rutaConsultarCliente(pool, id(req.params.id)))
);
router.patch(
  '/clientes/:id',
  permiso(['crear_cliente'], 'Tu cuenta no tiene permisos para editar clientes.'),
  manejar((req) => rutaEditarCliente(pool, id(req.params.id), req.body || {}))
);
router.get(
  '/clientes/:id/requeridos',
  permiso(['ver_directorio', 'ver_seguimiento'], 'Tu cuenta no tiene permisos para ver los documentos requeridos.'),
  manejar((req) => rutaConsultarRequeridos(pool, id(req.params.id), req.query))
);
router.post(
  '/clientes/:id/requeridos',
  permiso(['registrar_recepcion', 'administrar_usuarios'], 'Tu cuenta no tiene permisos para cambiar los documentos requeridos.'),
  manejar((req) => rutaCrearRequerido(pool, id(req.params.id), req.body || {}))
);

router.get(
  '/seguimiento',
  permiso(['ver_seguimiento'], 'Tu cuenta no tiene permisos para ver el seguimiento.'),
  manejar((req) => rutaSeguimiento(pool, req.query, null, req.documentos.rol))
);

// Quién entra al módulo y con qué rol (reemplaza la administración de usuarios de documentos:
// las cuentas se crean y editan en el directorio de status-conta).
router.get(
  '/usuarios',
  permiso(['administrar_usuarios'], 'Tu cuenta no tiene permisos para administrar el acceso.'),
  manejar(async () => {
    const filas = await query(
      `SELECT u.id, u.nombre, u.correo, u.alias, u.rol, m.rol AS rolDocumentos
         FROM usuarios u
         LEFT JOIN usuario_modulos m ON m.usuario_id = u.id AND m.modulo = 'documentos'
        ORDER BY u.nombre ASC, u.id ASC`
    );
    const usuarios = filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      correo: f.correo,
      alias: f.alias,
      rolDocumentos: f.rolDocumentos || (f.rol === 'administrador' ? 'administrador' : null),
      porRol: !f.rolDocumentos && f.rol === 'administrador',
    }));
    return { status: 200, body: { usuarios, roles: ROLES_ASIGNABLES } };
  })
);
router.put(
  '/usuarios/:id/rol',
  permiso(['administrar_usuarios'], 'Tu cuenta no tiene permisos para administrar el acceso.'),
  manejar(async (req) => {
    const usuarioId = id(req.params.id);
    const rol = req.body ? req.body.rol : undefined;
    if (rol !== null && !ROLES_ASIGNABLES.includes(rol)) {
      return {
        status: 400,
        body: { error: 'DATOS_INVALIDOS', mensaje: `El rol debe ser uno de: ${ROLES_ASIGNABLES.join(', ')}, o null para quitar el acceso.` },
      };
    }
    const existe = await query('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
    if (existe.length === 0) {
      return { status: 404, body: { error: 'NO_ENCONTRADO', mensaje: 'No existe esa cuenta.' } };
    }
    if (rol === null) {
      await query("DELETE FROM usuario_modulos WHERE usuario_id = ? AND modulo = 'documentos'", [usuarioId]);
    } else {
      await query(
        "INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', ?) ON DUPLICATE KEY UPDATE rol = VALUES(rol)",
        [usuarioId, rol]
      );
    }
    return { status: 200, body: { id: usuarioId, rolDocumentos: rol } };
  })
);

module.exports = router;
