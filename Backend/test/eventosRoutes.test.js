const assert = require('node:assert');
const http = require('node:http');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { crearRegistroEventos, eventos } = require('../src/utils/eventos');

/**
 * Tiempo real con Server-Sent Events: el servidor avisa a la app sin que tenga que recargar.
 * - POST /eventos/pase (con sesión) entrega un pase de un solo uso que dura 60 s;
 * - GET /eventos?pase=… deja la conexión abierta y manda los avisos;
 * - la conexión no cuenta como actividad y se cierra si la sesión deja de valer.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306).
 */

let servidor;
let administrador;
let contador;
let otroContador;
let tokenAdmin;
let tokenContador;
let tokenOtro;
const abiertas = [];

const VENCE = '2099-12-31';

/** Pide un pase con la sesión indicada. */
async function pedirPase(token) {
  const respuesta = await peticion(servidor.puerto, 'POST', '/eventos/pase', null, token);
  assert.strictEqual(respuesta.statusCode, 200, 'el pase se entrega con sesión');
  return respuesta.body.pase;
}

/**
 * Abre GET /eventos y va juntando lo que llega: eventos con nombre y datos, y latidos.
 * @returns {Promise<Object>} estado, cabeceras, eventos, latidos y utilidades para esperar.
 */
function abrirEventos(pase) {
  return new Promise((resolve, reject) => {
    const solicitud = http.get(
      { host: '127.0.0.1', port: servidor.puerto, path: `/eventos?pase=${encodeURIComponent(pase)}`, agent: false },
      (respuesta) => {
        const conexion = {
          estado: respuesta.statusCode,
          cabeceras: respuesta.headers,
          eventos: [],
          latidos: 0,
          cuerpo: '',
          terminada: false,
          esperando: [],
        };
        let pendiente = '';
        const revisarEsperas = () => {
          conexion.esperando = conexion.esperando.filter((espera) => {
            const evento = conexion.eventos.find((e) => e.nombre === espera.nombre && !espera.vistos.includes(e));
            if (evento || (espera.nombre === 'fin' && conexion.terminada)) {
              clearTimeout(espera.temporizador);
              espera.resolver(evento ?? true);
              return false;
            }
            return true;
          });
        };
        respuesta.setEncoding('utf8');
        respuesta.on('data', (trozo) => {
          conexion.cuerpo += trozo;
          pendiente += trozo;
          const bloques = pendiente.split('\n\n');
          pendiente = bloques.pop();
          for (const bloque of bloques) {
            if (bloque.startsWith(':')) {
              conexion.latidos += 1;
              continue;
            }
            const nombre = /^event: (.+)$/m.exec(bloque)?.[1];
            const datos = /^data: (.+)$/m.exec(bloque)?.[1];
            if (nombre) conexion.eventos.push({ nombre, datos: datos ? JSON.parse(datos) : null });
          }
          revisarEsperas();
        });
        respuesta.on('end', () => {
          conexion.terminada = true;
          revisarEsperas();
        });
        /** Espera un evento con ese nombre (o 'fin' para el cierre); null si no llega a tiempo. */
        conexion.esperar = (nombre, ms = 1500) =>
          new Promise((resolver) => {
            const espera = { nombre, resolver, vistos: [] };
            espera.temporizador = setTimeout(() => {
              conexion.esperando = conexion.esperando.filter((e) => e !== espera);
              resolver(null);
            }, ms);
            conexion.esperando.push(espera);
            revisarEsperas();
          });
        conexion.cerrar = () => solicitud.destroy();
        abiertas.push(conexion);
        resolve(conexion);
      }
    );
    solicitud.on('error', reject);
  });
}

// ---------- El pase ----------
async function testPaseSoloConSesion() {
  const sinSesion = await peticion(servidor.puerto, 'POST', '/eventos/pase');
  assert.strictEqual(sinSesion.statusCode, 401);

  const pase = await pedirPase(tokenContador);
  assert.match(pase, /^[0-9a-f]{64}$/, 'pase aleatorio de 32 bytes en hexadecimal');
}

async function testPaseInvalidoOUsadoResponde401() {
  for (const ruta of ['/eventos', '/eventos?pase=', '/eventos?pase=inventado']) {
    const respuesta = await peticion(servidor.puerto, 'GET', ruta);
    assert.strictEqual(respuesta.statusCode, 401, `${ruta} debe responder 401`);
    assert.match(respuesta.body.mensaje, /pase/);
  }

  const pase = await pedirPase(tokenContador);
  const primera = await abrirEventos(pase);
  assert.strictEqual(primera.estado, 200);
  const segunda = await peticion(servidor.puerto, 'GET', `/eventos?pase=${pase}`);
  assert.strictEqual(segunda.statusCode, 401, 'el pase es de un solo uso');
  primera.cerrar();
}

function testPaseVenceA60Segundos() {
  let ahora = 1_000_000;
  const registro = crearRegistroEventos({ ahora: () => ahora });
  const datos = { usuarioId: 1, rol: 'contador', jti: 'x' };

  const vigente = registro.crearPase(datos);
  ahora += 60_000;
  assert.deepStrictEqual(registro.canjearPase(vigente), datos, 'a los 60 s todavía vale');

  const vencido = registro.crearPase(datos);
  ahora += 60_001;
  assert.strictEqual(registro.canjearPase(vencido), null, 'pasados 60 s ya no');
}

// ---------- La conexión ----------
async function testConexionAbiertaConCabecerasSse() {
  const conexion = await abrirEventos(await pedirPase(tokenContador));

  assert.strictEqual(conexion.estado, 200);
  assert.match(conexion.cabeceras['content-type'], /^text\/event-stream/);
  assert.match(conexion.cabeceras['cache-control'], /no-cache/);
  assert.strictEqual(conexion.cabeceras['x-accel-buffering'], 'no', 'Nginx no debe juntar los mensajes');
  assert.ok(await conexion.esperar('conectado'), 'avisa que quedó conectada');
  conexion.cerrar();
}

async function testConexionNoCuentaComoActividad() {
  const token = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
  const jti = jwt.decode(token).jti;
  // Pedir el pase sí cuenta como actividad; después se fija una marca conocida
  const pase = await pedirPase(token);
  const marca = await query("SELECT DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 5 MINUTE), '%Y-%m-%d %H:%i:%s') AS valor");
  await query('UPDATE sesiones SET ultima_actividad = ? WHERE jti = ?', [marca[0].valor, jti]);

  const conexion = await abrirEventos(pase);
  await conexion.esperar('conectado');
  const [fila] = await query("SELECT DATE_FORMAT(ultima_actividad, '%Y-%m-%d %H:%i:%s') AS ultima FROM sesiones WHERE jti = ?", [jti]);
  assert.strictEqual(fila.ultima, marca[0].valor, 'abrir la conexión no renueva la sesión');
  conexion.cerrar();
}

// ---------- Avisos ----------
async function testAdministradorSeEnteraDeCasosNuevosYEditados() {
  const admin = await abrirEventos(await pedirPase(tokenAdmin));
  const otro = await abrirEventos(await pedirPase(tokenOtro));
  await admin.esperar('conectado');
  await otro.esperar('conectado');

  const alta = await peticion(
    servidor.puerto,
    'POST',
    '/casos',
    { cliente: 'zz_test Cliente en vivo', prioridad: 'Media', fecha_vencimiento: VENCE },
    tokenContador
  );
  assert.strictEqual(alta.statusCode, 201);
  const aviso = await admin.esperar('caso-actualizado');
  assert.ok(aviso, 'el administrador recibe el aviso del caso nuevo');
  assert.deepStrictEqual(aviso.datos, { casoId: alta.body.caso.id, contadorId: contador.id });

  admin.eventos.length = 0;
  const edicion = await peticion(servidor.puerto, 'PATCH', `/casos/${alta.body.caso.id}`, { estado: 'En proceso' }, tokenContador);
  assert.strictEqual(edicion.statusCode, 200);
  assert.ok(await admin.esperar('caso-actualizado'), 'y también de la edición');

  assert.strictEqual(
    otro.eventos.filter((e) => e.nombre === 'caso-actualizado').length,
    0,
    'otro contador no recibe avisos de casos ajenos'
  );
  admin.cerrar();
  otro.cerrar();
}

async function testContadorRecibeAvisoCuandoElAdministradorCambiaLaPrioridad() {
  const casoId = await crearCasoDePrueba(contador.id, { cliente: 'zz_test Prioridad en vivo', prioridad: 'Media' });
  const duenio = await abrirEventos(await pedirPase(tokenContador));
  const otro = await abrirEventos(await pedirPase(tokenOtro));
  await duenio.esperar('conectado');
  await otro.esperar('conectado');

  const cambio = await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}/prioridad`, { prioridad: 'Alta' }, tokenAdmin);
  assert.strictEqual(cambio.statusCode, 200);

  const aviso = await duenio.esperar('aviso-nuevo');
  assert.ok(aviso, 'el dueño del caso recibe el aviso al instante');
  assert.deepStrictEqual(aviso.datos, { casoId });
  assert.strictEqual(otro.eventos.filter((e) => e.nombre === 'aviso-nuevo').length, 0, 'nadie más lo recibe');
  duenio.cerrar();
  otro.cerrar();
}

// ---------- Cierre de la conexión ----------
async function testCerrarSesionCierraLaConexion() {
  const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  const conexion = await abrirEventos(await pedirPase(token));
  await conexion.esperar('conectado');

  const salida = await peticion(servidor.puerto, 'POST', '/auth/logout', null, token);
  assert.strictEqual(salida.statusCode, 200);
  assert.ok(await conexion.esperar('fin'), 'cerrar sesión termina la conexión de esa sesión');
}

async function testLatidoYSesionRevocadaPorOtroLado() {
  eventos.configurarLatido(40);
  try {
    const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    const conexion = await abrirEventos(await pedirPase(token));
    await conexion.esperar('conectado');
    await new Promise((listo) => setTimeout(listo, 150));
    assert.ok(conexion.latidos >= 2, 'manda latidos para que el túnel no corte la conexión');

    // Restablecer la contraseña revoca sus sesiones: el siguiente latido lo detecta
    await query('UPDATE sesiones SET revocado = 1 WHERE jti = ?', [jwt.decode(token).jti]);
    assert.ok(await conexion.esperar('sesion-cerrada'), 'avisa que la sesión ya no vale');
    assert.ok(await conexion.esperar('fin'), 'y cierra la conexión');
  } finally {
    eventos.configurarLatido();
  }
}

async function testAdministradorSeEnteraDeCambiosEnAuditorias() {
  const admin = await abrirEventos(await pedirPase(tokenAdmin));
  const otro = await abrirEventos(await pedirPase(tokenOtro));
  await admin.esperar('conectado');
  await otro.esperar('conectado');

  // Cada escritura en una auditoría o en su bitácora avisa a los administradores
  const esperarAviso = async (respuesta, estado, que) => {
    assert.strictEqual(respuesta.statusCode, estado, que);
    const aviso = await admin.esperar('auditoria-actualizada');
    assert.ok(aviso, `el administrador recibe el aviso: ${que}`);
    admin.eventos.length = 0;
    return aviso;
  };

  const alta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'zz_test Auditoría en vivo',
      no_expediente: 'ZZ-VIVO-1',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Visita Domiciliaria',
      estatal: false,
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
    },
    tokenContador
  );
  const avisoAlta = await esperarAviso(alta, 201, 'auditoría registrada');
  const auditoriaId = alta.body.auditoria.id;
  assert.deepStrictEqual(avisoAlta.datos, { auditoriaId });

  await esperarAviso(
    await peticion(servidor.puerto, 'PATCH', `/auditorias/${auditoriaId}`, { estado: 'En Proceso' }, tokenContador),
    200,
    'auditoría editada'
  );

  const evento = await peticion(
    servidor.puerto,
    'POST',
    `/auditorias/${auditoriaId}/eventos`,
    { evento: 'Acta parcial', fase_id: 2, fecha: '20-02-2026', fecha_limite: '02-03-2026' },
    tokenContador
  );
  await esperarAviso(evento, 201, 'evento registrado');
  const eventoId = evento.body.evento.id;

  await esperarAviso(
    await peticion(
      servidor.puerto,
      'PATCH',
      `/auditorias/${auditoriaId}/eventos/${eventoId}`,
      { fecha_entrega: '01-03-2026', estado: 'Completado' },
      tokenContador
    ),
    200,
    'evento editado'
  );
  await esperarAviso(
    await peticion(servidor.puerto, 'DELETE', `/auditorias/${auditoriaId}/eventos/${eventoId}`, null, tokenContador),
    200,
    'evento borrado'
  );

  assert.strictEqual(
    otro.eventos.filter((e) => e.nombre === 'auditoria-actualizada').length,
    0,
    'un contador no recibe avisos de auditorías'
  );
  admin.cerrar();
  otro.cerrar();
}

async function testContadoresAsignadosSeEnteranDeCambiosEnAuditorias() {
  const tercero = await crearUsuarioDePrueba('contador');
  const tokenTercero = await iniciarSesion(servidor.puerto, tercero.correo, tercero.password);
  const admin = await abrirEventos(await pedirPase(tokenAdmin));
  const asignado = await abrirEventos(await pedirPase(tokenContador));
  const otro = await abrirEventos(await pedirPase(tokenOtro));
  const ajeno = await abrirEventos(await pedirPase(tokenTercero));
  const conexiones = [admin, asignado, otro, ajeno];
  for (const conexion of conexiones) await conexion.esperar('conectado');

  /** Comprueba quién recibió el aviso de la auditoría y vacía lo recibido para el siguiente paso. */
  const revisarAvisos = async (auditoriaId, reciben, noReciben, que) => {
    for (const conexion of reciben) {
      const aviso = await conexion.esperar('auditoria-actualizada');
      assert.ok(aviso, `recibe el aviso: ${que}`);
      assert.deepStrictEqual(aviso.datos, { auditoriaId });
    }
    for (const conexion of noReciben) {
      assert.strictEqual(await conexion.esperar('auditoria-actualizada', 200), null, `no recibe el aviso: ${que}`);
    }
    for (const conexion of conexiones) conexion.eventos.length = 0;
  };

  // El administrador registra una auditoría asignada al contador
  const alta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'zz_test Auditoría asignada en vivo',
      no_expediente: 'ZZ-VIVO-2',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Revisión de gabinete',
      estatal: false,
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
      contadores: [contador.id],
    },
    tokenAdmin
  );
  assert.strictEqual(alta.statusCode, 201);
  const auditoriaId = alta.body.auditoria.id;
  await revisarAvisos(auditoriaId, [admin, asignado], [otro, ajeno], 'auditoría asignada');

  // El contador registra un evento en la bitácora
  const evento = await peticion(
    servidor.puerto,
    'POST',
    `/auditorias/${auditoriaId}/eventos`,
    { evento: 'Acta parcial', fase_id: 2, fecha: '20-02-2026', fecha_limite: '02-03-2026' },
    tokenContador
  );
  assert.strictEqual(evento.statusCode, 201);
  await revisarAvisos(auditoriaId, [admin, asignado], [otro, ajeno], 'evento registrado');

  // El administrador la reasigna: se entera quien la deja y quien la recibe
  const reasignada = await peticion(
    servidor.puerto,
    'PATCH',
    `/auditorias/${auditoriaId}`,
    { contadores: [otroContador.id] },
    tokenAdmin
  );
  assert.strictEqual(reasignada.statusCode, 200);
  await revisarAvisos(auditoriaId, [admin, asignado, otro], [ajeno], 'auditoría reasignada');

  // El nuevo asignado borra el evento: el anterior ya no se entera
  const borrado = await peticion(
    servidor.puerto,
    'DELETE',
    `/auditorias/${auditoriaId}/eventos/${evento.body.evento.id}`,
    null,
    tokenOtro
  );
  assert.strictEqual(borrado.statusCode, 200);
  await revisarAvisos(auditoriaId, [admin, otro], [asignado, ajeno], 'evento borrado');

  for (const conexion of conexiones) conexion.cerrar();
}

async function testParticipantesRecibenMensajesDelChat() {
  const admin = await abrirEventos(await pedirPase(tokenAdmin));
  const asignado = await abrirEventos(await pedirPase(tokenContador));
  const otro = await abrirEventos(await pedirPase(tokenOtro));
  const conexiones = [admin, asignado, otro];
  for (const conexion of conexiones) await conexion.esperar('conectado');

  const alta = await peticion(
    servidor.puerto,
    'POST',
    '/auditorias',
    {
      cliente: 'zz_test Auditoría con chat en vivo',
      no_expediente: 'ZZ-VIVO-CHAT',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Revisión de gabinete',
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
      contadores: [contador.id],
    },
    tokenAdmin
  );
  assert.strictEqual(alta.statusCode, 201);
  const auditoriaId = alta.body.auditoria.id;

  const enviado = await peticion(
    servidor.puerto,
    'POST',
    `/auditorias/${auditoriaId}/mensajes`,
    { texto: 'Ya subí los contratos.' },
    tokenContador
  );
  assert.strictEqual(enviado.statusCode, 201);

  // Llega a todos los que pueden ver el chat (también a las otras pestañas de quien escribe)
  for (const conexion of [admin, asignado]) {
    const aviso = await conexion.esperar('mensaje-auditoria');
    assert.ok(aviso, 'recibe el mensaje en vivo');
    assert.deepStrictEqual(aviso.datos, {
      auditoriaId,
      cliente: 'zz_test Auditoría con chat en vivo',
      mensaje: enviado.body.nuevo_mensaje,
    });
  }
  assert.strictEqual(await otro.esperar('mensaje-auditoria', 200), null, 'un contador no asignado no lo recibe');
  assert.strictEqual(await asignado.esperar('aviso-nuevo', 200), null, 'quien escribe no recibe aviso en su campana');

  // Si escribe el administrador, la campana del contador asignado se actualiza en vivo
  const delAdmin = await peticion(
    servidor.puerto,
    'POST',
    `/auditorias/${auditoriaId}/mensajes`,
    { texto: 'Revisa el acta.' },
    tokenAdmin
  );
  assert.strictEqual(delAdmin.statusCode, 201);
  assert.deepStrictEqual((await asignado.esperar('aviso-nuevo'))?.datos, { auditoriaId });
  assert.strictEqual(await admin.esperar('aviso-nuevo', 200), null, 'el administrador no tiene campana del chat');

  for (const conexion of conexiones) conexion.cerrar();
}

describe('tiempo real con Server-Sent Events', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    otroContador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    tokenOtro = await iniciarSesion(servidor.puerto, otroContador.correo, otroContador.password);
  });

  after(async () => {
    for (const conexion of abiertas) conexion.cerrar();
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el pase solo se entrega con sesión', testPaseSoloConSesion);
  test('sin pase, con uno inventado o ya usado responde 401', testPaseInvalidoOUsadoResponde401);
  test('el pase vence a los 60 segundos', testPaseVenceA60Segundos);
  test('la conexión abre con cabeceras de SSE y avisa «conectado»', testConexionAbiertaConCabecerasSse);
  test('tener la conexión abierta no cuenta como actividad de la sesión', testConexionNoCuentaComoActividad);
  test('el administrador se entera al instante de casos nuevos y editados', testAdministradorSeEnteraDeCasosNuevosYEditados);
  test('el contador recibe el aviso cuando el administrador cambia la prioridad', testContadorRecibeAvisoCuandoElAdministradorCambiaLaPrioridad);
  test('el administrador se entera al instante de cambios en auditorías y su bitácora', testAdministradorSeEnteraDeCambiosEnAuditorias);
  test('los contadores asignados se enteran al instante de cambios en sus auditorías', testContadoresAsignadosSeEnteranDeCambiosEnAuditorias);
  test('los participantes de una auditoría reciben al instante los mensajes del chat', testParticipantesRecibenMensajesDelChat);
  test('cerrar sesión cierra la conexión de esa sesión', testCerrarSesionCierraLaConexion);
  test('hay latidos y una sesión revocada cierra la conexión', testLatidoYSesionRevocadaPorOtroLado);
});
