const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Fase 3 de la unión: el módulo «Recepción de documentos» dentro de status-conta, en /doc.
 * Usa la sesión de status-conta; entra quien tiene el módulo (o es administrador) y cada ruta pide
 * el mismo permiso que en Proyecto-documentos según el rol dentro del módulo.
 */

const FIRMA = 'data:image/png;base64,iVBORw0KGgo=';
const PERIODO = '2091-11';

let servidor;
let carpeta;
const cuentas = {};
const tokens = {};
let clienteId;
const documentosCreados = [];

async function darModulo(usuarioId, rol) {
  await query(
    "INSERT INTO usuario_modulos (usuario_id, modulo, rol) VALUES (?, 'documentos', ?) ON DUPLICATE KEY UPDATE rol = VALUES(rol)",
    [usuarioId, rol]
  );
}

function pedir(quien, metodo, ruta, cuerpo) {
  return peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[quien]);
}

/** Petición con cuerpo crudo (subida de archivos). */
function subir(quien, ruta, contenido, tipo) {
  return new Promise((resolve, reject) => {
    const solicitud = http.request(
      {
        host: '127.0.0.1',
        port: servidor.puerto,
        path: ruta,
        method: 'POST',
        agent: false,
        headers: { Authorization: `Bearer ${tokens[quien]}`, 'Content-Type': tipo, 'Content-Length': contenido.length },
      },
      (respuesta) => {
        const partes = [];
        respuesta.on('data', (p) => partes.push(p));
        respuesta.on('end', () => {
          const texto = Buffer.concat(partes).toString('utf8');
          resolve({ statusCode: respuesta.statusCode, body: texto ? JSON.parse(texto) : null });
        });
      }
    );
    solicitud.on('error', reject);
    solicitud.end(contenido);
  });
}

/** Descarga con el cuerpo en bruto. */
function descargar(quien, ruta) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: servidor.puerto, path: ruta, agent: false, headers: { Authorization: `Bearer ${tokens[quien]}` } }, (r) => {
        const partes = [];
        r.on('data', (p) => partes.push(p));
        r.on('end', () => resolve({ statusCode: r.statusCode, headers: r.headers, buffer: Buffer.concat(partes) }));
      })
      .on('error', reject);
  });
}

async function catalogo() {
  const [empresa] = await query('SELECT id FROM empresas ORDER BY id LIMIT 1');
  const [tipo] = await query('SELECT id FROM tipos_documento ORDER BY id LIMIT 1');
  const [departamento] = await query('SELECT id FROM departamentos ORDER BY id LIMIT 1');
  return { empresaId: empresa.id, tipoDocId: tipo.id, departamentoId: departamento.id };
}

async function recepcionar(quien, extra = {}) {
  const respuesta = await pedir(quien, 'POST', '/doc/documentos', {
    clienteId,
    ...(await catalogo()),
    asunto: 'Estados de cuenta',
    prioridad: 'MEDIA',
    periodo: PERIODO,
    viaEntrega: 'PRESENCIAL',
    observaciones: null,
    fechaLimiteSla: null,
    firmaCliente: FIRMA,
    firmaRecep: FIRMA,
    adjuntos: [],
    ...extra,
  });
  if (respuesta.body && respuesta.body.id) documentosCreados.push(respuesta.body.id);
  return respuesta;
}

before(async () => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-modulo-'));
  process.env.CARPETA_ADJUNTOS = carpeta;
  await prepararBaseDeDatos();
  servidor = await iniciarServidor();

  const roles = {
    admin: ['administrador', null],
    sistemas: ['usuarios_de_sistema', 'sistemas'],
    recepcion: ['recepcionista', 'recepcionista'],
    contador: ['auxiliar', 'contador'],
    otroContador: ['contador', 'contador'],
    practicante: ['auxiliar', 'practicante'],
    sinModulo: ['contador', null],
  };
  for (const [quien, [rolGeneral, rolModulo]] of Object.entries(roles)) {
    cuentas[quien] = await crearUsuarioDePrueba(rolGeneral);
    if (rolModulo) await darModulo(cuentas[quien].id, rolModulo);
    tokens[quien] = await iniciarSesion(servidor.puerto, cuentas[quien].correo, cuentas[quien].password);
  }

  const resultado = await query(
    "INSERT INTO clientes (usuario_id, clave, nombre, rfc, activo, creado_en) VALUES (?, NULL, ?, NULL, 1, NOW())",
    [cuentas.otroContador.id, `ZZ Cliente Documentos ${Date.now()}`]
  );
  clienteId = resultado.insertId;
});

after(async () => {
  if (documentosCreados.length > 0) {
    const marcas = documentosCreados.map(() => '?').join(', ');
    await query(`DELETE FROM cliente_doc_requeridos WHERE documento_id IN (${marcas}) OR cliente_id = ?`, [...documentosCreados, clienteId]);
    await query(`DELETE FROM documentos WHERE id IN (${marcas})`, documentosCreados);
  }
  await query('DELETE FROM cliente_doc_requeridos WHERE cliente_id = ?', [clienteId]);
  await query('DELETE FROM clientes WHERE id = ?', [clienteId]);
  await servidor.cerrar();
  await limpiarDatosDePrueba();
  await cerrarBaseDeDatos();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

describe('módulo de documentos: acceso', () => {
  test('sin sesión da 401', async () => {
    const r = await peticion(servidor.puerto, 'GET', '/doc/catalogos');
    assert.strictEqual(r.statusCode, 401);
  });

  test('sin el módulo da 403 aunque la sesión sea válida', async () => {
    const r = await pedir('sinModulo', 'GET', '/doc/catalogos');
    assert.strictEqual(r.statusCode, 403);
    assert.strictEqual(r.body.error, 'SIN_PERMISO');
  });

  test('el administrador entra por su rol y ve los catálogos', async () => {
    const r = await pedir('admin', 'GET', '/doc/catalogos');
    assert.strictEqual(r.statusCode, 200);
    for (const llave of ['empresas', 'tiposDocumento', 'departamentos', 'contadores', 'clientes']) {
      assert.ok(Array.isArray(r.body[llave]), llave);
    }
    const ids = r.body.contadores.map((c) => c.id);
    assert.ok(ids.includes(cuentas.contador.id), 'los contadores salen de usuario_modulos');
    assert.ok(!ids.includes(cuentas.sinModulo.id));
  });

  test('cada rol del módulo conserva sus permisos de documentos', async () => {
    assert.strictEqual((await pedir('contador', 'GET', `/doc/documentos?periodo=${PERIODO}`)).statusCode, 200);
    assert.strictEqual((await pedir('practicante', 'GET', `/doc/documentos?periodo=${PERIODO}`)).statusCode, 200);
    assert.strictEqual((await pedir('contador', 'GET', '/doc/documentos/direccionamiento')).statusCode, 403);
    assert.strictEqual((await pedir('practicante', 'POST', '/doc/documentos/1/estado', { estado: 'EN_PROCESO' })).statusCode, 403);
    assert.strictEqual((await pedir('recepcion', 'GET', `/doc/documentos?periodo=${PERIODO}`)).statusCode, 403);
    assert.strictEqual((await pedir('recepcion', 'GET', '/doc/usuarios')).statusCode, 403);
  });
});

describe('módulo de documentos: recepción de punta a punta', () => {
  let documento;

  test('la recepción registra el documento con folio, aunque las firmas pesen más de 100 kb', async () => {
    const firmaGrande = `data:image/png;base64,${'A'.repeat(300 * 1024)}`;
    const r = await recepcionar('recepcion', { firmaCliente: firmaGrande });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.ok(r.body.id);
    assert.match(r.body.folio, /^DCA-\d{4}-\d+$/);
    documento = r.body;
  });

  test('aparece en direccionamiento y en la lista del periodo, con el contador del cliente', async () => {
    const dir = await pedir('recepcion', 'GET', '/doc/documentos/direccionamiento');
    const enDir = dir.body.documentos.find((d) => d.id === documento.id);
    assert.ok(enDir, 'está por entregar');
    assert.strictEqual(enDir.contadorId, cuentas.otroContador.id, 'el contador sale de clientes.usuario_id');

    const lista = await pedir('contador', 'GET', `/doc/documentos?periodo=${PERIODO}`);
    assert.ok(lista.body.documentos.some((d) => d.id === documento.id));
  });

  test('se entrega al contador con firmas y queda en proceso', async () => {
    const sinContador = await pedir('recepcion', 'POST', `/doc/documentos/${documento.id}/entrega`, {
      contadorId: cuentas.sinModulo.id,
      firmaEntrega: FIRMA,
      firmaContador: FIRMA,
    });
    assert.strictEqual(sinContador.statusCode, 400, 'solo se entrega a quien es contador en el módulo');

    const r = await pedir('recepcion', 'POST', `/doc/documentos/${documento.id}/entrega`, {
      contadorId: cuentas.contador.id,
      firmaEntrega: FIRMA,
      firmaContador: FIRMA,
    });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const [fila] = await query('SELECT estado, contador_id FROM documentos WHERE id = ?', [documento.id]);
    assert.strictEqual(fila.estado, 'EN_PROCESO');
    assert.strictEqual(fila.contador_id, cuentas.contador.id);
  });

  test('solo el contador asignado (o el administrador) cambia el estado', async () => {
    const ajeno = await pedir('otroContador', 'POST', `/doc/documentos/${documento.id}/estado`, { estado: 'COMPLETADO' });
    assert.strictEqual(ajeno.statusCode, 403);
    const propio = await pedir('contador', 'POST', `/doc/documentos/${documento.id}/estado`, { estado: 'COMPLETADO' });
    assert.strictEqual(propio.statusCode, 200, JSON.stringify(propio.body));
  });

  test('se sube un archivo en crudo y se descarga igual', async () => {
    const contenido = Buffer.from('contenido del acuse');
    const nombre = encodeURIComponent('acuse – octubre.txt');
    const subida = await subir('recepcion', `/doc/documentos/${documento.id}/archivos?nombreOriginal=${nombre}`, contenido, 'text/plain');
    assert.ok([200, 201].includes(subida.statusCode), JSON.stringify(subida.body));
    const archivoId = subida.body.id || (subida.body.archivo && subida.body.archivo.id);
    assert.ok(archivoId, JSON.stringify(subida.body));

    const bajada = await descargar('contador', `/doc/documentos/${documento.id}/archivos/${archivoId}`);
    assert.strictEqual(bajada.statusCode, 200);
    assert.strictEqual(bajada.buffer.toString(), 'contenido del acuse');
    assert.ok(fs.readdirSync(carpeta).length > 0, 'el archivo quedó en CARPETA_ADJUNTOS');
  });

  test('el seguimiento lo encuentra por folio', async () => {
    const r = await pedir('practicante', 'GET', `/doc/seguimiento?q=${encodeURIComponent(documento.folio)}`);
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const texto = JSON.stringify(r.body);
    assert.ok(texto.includes(documento.folio));
  });

  test('el directorio de clientes y los frecuentes usan el catálogo único', async () => {
    const clientes = await pedir('contador', 'GET', `/doc/clientes?periodo=${PERIODO}`);
    assert.strictEqual(clientes.statusCode, 200);
    const propio = clientes.body.clientes.find((c) => c.id === clienteId);
    assert.ok(propio, 'aparece el cliente');
    assert.strictEqual(propio.contador, cuentas.otroContador.nombre);
    assert.strictEqual(propio.estado, 'ACTIVO');

    const frecuentes = await pedir('recepcion', 'GET', '/doc/clientes/frecuentes');
    assert.ok(frecuentes.body.clientes.some((c) => c.id === clienteId));
  });

  test('documentos requeridos: se crean y se consultan', async () => {
    const { tipoDocId } = await catalogo();
    const alta = await pedir('recepcion', 'POST', `/doc/clientes/${clienteId}/requeridos`, {
      tipoDocId,
      periodo: PERIODO,
      fechaLimite: '2091-12-10',
    });
    assert.ok([200, 201].includes(alta.statusCode), JSON.stringify(alta.body));
    const consulta = await pedir('contador', 'GET', `/doc/clientes/${clienteId}/requeridos?periodo=${PERIODO}`);
    assert.strictEqual(consulta.statusCode, 200, JSON.stringify(consulta.body));
  });
});

describe('módulo de documentos: quién entra y con qué rol', () => {
  test('el administrador ve las cuentas con su rol en documentos', async () => {
    const r = await pedir('admin', 'GET', '/doc/usuarios');
    assert.strictEqual(r.statusCode, 200);
    const porId = Object.fromEntries(r.body.usuarios.map((u) => [u.id, u]));
    assert.strictEqual(porId[cuentas.contador.id].rolDocumentos, 'contador');
    assert.strictEqual(porId[cuentas.sinModulo.id].rolDocumentos, null);
    assert.strictEqual(porId[cuentas.admin.id].rolDocumentos, 'administrador');
    assert.strictEqual(porId[cuentas.admin.id].porRol, true);
    assert.ok(!JSON.stringify(r.body).match(/password|hash/i));
  });

  test('da, cambia y quita el acceso; rechaza roles inventados', async () => {
    const id = cuentas.sinModulo.id;
    assert.strictEqual((await pedir('sistemas', 'PUT', `/doc/usuarios/${id}/rol`, { rol: 'jefe' })).statusCode, 400);
    assert.strictEqual((await pedir('sistemas', 'PUT', `/doc/usuarios/${id}/rol`, { rol: 'practicante' })).statusCode, 200);
    assert.strictEqual((await pedir('sinModulo', 'GET', `/doc/documentos?periodo=${PERIODO}`)).statusCode, 200);
    assert.strictEqual((await pedir('sistemas', 'PUT', `/doc/usuarios/${id}/rol`, { rol: null })).statusCode, 200);
    assert.strictEqual((await pedir('sinModulo', 'GET', `/doc/documentos?periodo=${PERIODO}`)).statusCode, 403);
    assert.strictEqual((await pedir('sistemas', 'PUT', '/doc/usuarios/99999999/rol', { rol: 'contador' })).statusCode, 404);
  });
});
