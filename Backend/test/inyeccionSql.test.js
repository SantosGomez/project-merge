const assert = require('node:assert');
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

/**
 * Suite de inyección SQL por HTTP (rebanada S3). Envía payloads de inyección en el cuerpo,
 * la ruta y la query de los endpoints que reciben texto, ids, fechas o filtros, y comprueba:
 * nunca 5xx, nunca texto de error SQL, nunca datos de otro usuario y tablas intactas.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa cuentas `zz_test_`.
 */

const MARCA_AJENA = 'zz_test_secreto_ajeno_S3';

// Payloads de texto: pueden ir en rutas, query y cuerpo.
const PAYLOADS_TEXTO = [
  "' OR '1'='1",
  "'; DROP TABLE usuarios;--",
  '1 UNION SELECT id, correo, password_hash, 4, 5 FROM usuarios',
  '1 OR 1=1',
  "\" OR \"\"=\"",
  "admin'--",
  '%27%20OR%201%3D1',
  '😀ñ漢字\u0000‮',
  '9'.repeat(400),
  '1;SELECT SLEEP(0)',
];

// Payloads que solo existen en el cuerpo JSON (tipos que no son texto).
const PAYLOADS_TIPADOS = [
  { nombre: 'objeto', valor: { a: 1 } },
  { nombre: 'objeto con operador', valor: { $ne: 1 } },
  { nombre: 'arreglo', valor: [1, 2] },
  { nombre: 'arreglo anidado', valor: [[1, 'x']] },
  { nombre: 'número gigante', valor: 1e308 },
  { nombre: 'entero enorme', valor: 99999999999999999999999999 },
  { nombre: 'negativo', valor: -1 },
  { nombre: 'booleano', valor: true },
];

// Campos de cuerpo que reciben los endpoints (unión de los de todos los módulos).
const CAMPOS = [
  'cliente', 'estado', 'prioridad', 'fecha_inicio', 'fecha_vencimiento', 'descripcion', 'observaciones',
  'observacion', 'importante', 'nombre', 'correo', 'password', 'rol', 'rfc', 'activo', 'regla_vencimiento',
  'dia_del_mes', 'titulo', 'inicio', 'fin', 'participantes', 'cobrable', 'agregar', 'quitar', 'contadores', 'contador_id', 'no_expediente', 'dependencia',
  'tipo_auditoria', 'estatal', 'evento', 'fase_id', 'fecha', 'hecha', 'texto', 'cliente_id', 'tipo_id', 'mes',
  'minutos', 'paso', 'jornada_base_minutos', 'entrada', 'salida', 'descanso_inicio', 'descanso_fin',
];

// Parámetros de query que leen los GET (unión).
const FILTROS = ['cliente_id', 'tipo_id', 'mes', 'desde', 'hasta', 'importantes', 'estado', 'q', 'pase', 'limite'];

const ERROR_SQL = /sql|syntax|ER_[A-Z_]+|mariadb|mysql|stack|at .*\.js:\d+/i;

let servidor;
let contador;
let ajeno;
let administrador;
let sistema;
let tokens;
let instantaneaInicial;

/**
 * Foto de lo que un ataque dañaría: la lista de tablas y las cuentas reales (no `zz_test_`).
 * @returns {Promise<{tablas: string, cuentas: Object}>}
 */
async function instantanea() {
  const tablas = await query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY 1');
  const [cuentas] = await query(
    `SELECT COUNT(*) AS n, BIT_XOR(CRC32(CONCAT_WS('|', id, correo, rol, password_hash))) AS h
       FROM usuarios WHERE correo NOT LIKE 'zz\\_test\\_%'`
  );
  return { tablas: tablas.map((f) => f.t).join(','), cuentas: { n: Number(cuentas.n), h: String(cuentas.h) } };
}

/**
 * Comprueba una respuesta: sin 5xx, sin texto de error SQL y sin datos ajenos.
 * @param {{statusCode: number, body: any}} respuesta - Respuesta a revisar.
 * @param {string} contexto - Descripción de la petición para el mensaje de fallo.
 * @param {string} rol - Rol con el que se hizo la petición.
 */
function verificarRespuesta(respuesta, contexto, rol) {
  assert.ok(respuesta.statusCode < 500, `${contexto}: respondió ${respuesta.statusCode} ${JSON.stringify(respuesta.body)}`);
  const texto = typeof respuesta.body === 'string' ? respuesta.body : JSON.stringify(respuesta.body ?? '');
  assert.ok(!ERROR_SQL.test(texto), `${contexto}: la respuesta filtra detalles técnicos: ${texto.slice(0, 200)}`);
  // El administrador y el sistema ven por diseño datos de todos; el aislamiento se exige a los demás.
  if (rol === 'contador' || rol === 'anonimo') {
    assert.ok(!texto.includes(MARCA_AJENA), `${contexto}: la respuesta trae datos de otro usuario`);
    assert.ok(!texto.includes(ajeno.correo), `${contexto}: la respuesta trae el correo de otro usuario`);
  }
  assert.ok(!/password_hash|\$argon2/.test(texto), `${contexto}: la respuesta trae hashes de contraseña`);
}

/**
 * Cuerpo con todos los campos igual al payload.
 * @param {*} valor - Payload.
 * @returns {Object}
 */
function cuerpoConTodo(valor) {
  return Object.fromEntries(CAMPOS.map((campo) => [campo, valor]));
}

// Endpoints: [método, ruta con {P} donde va el payload, rol, ¿lleva cuerpo?]
const ENDPOINTS = [
  ['POST', '/auth/login', 'anonimo', true],
  ['GET', '/usuarios', 'sistema', false],
  ['POST', '/usuarios', 'sistema', true],
  ['PATCH', '/usuarios/{P}', 'sistema', true],
  ['GET', '/casos/mis-casos', 'contador', false],
  ['POST', '/casos', 'contador', true],
  ['PATCH', '/casos/{P}', 'contador', true],
  ['PATCH', '/casos/{P}/prioridad', 'administrador', true],
  ['GET', '/contadores', 'administrador', false],
  ['GET', '/contadores/resumen', 'administrador', false],
  ['GET', '/contadores/casos-importantes', 'administrador', false],
  ['GET', '/contadores/{P}/casos', 'administrador', false],
  ['GET', '/contadores/{P}/conteos', 'administrador', false],
  ['POST', '/contadores/{P}/casos', 'administrador', true],
  ['GET', '/contadores/{P}/auxiliares', 'contador', false],
  ['GET', '/clientes', 'contador', false],
  ['POST', '/clientes', 'contador', true],
  ['PATCH', '/clientes/{P}', 'contador', true],
  ['GET', '/tipos-actividad', 'contador', false],
  ['POST', '/tipos-actividad', 'contador', true],
  ['PATCH', '/tipos-actividad/{P}', 'contador', true],
  ['GET', '/tipos-actividad/{P}/clientes', 'contador', false],
  ['PUT', '/tipos-actividad/{P}/clientes', 'contador', true],
  ['GET', '/auditorias', 'administrador', false],
  ['GET', '/auditorias/calendario', 'administrador', false],
  ['POST', '/auditorias', 'administrador', true],
  ['GET', '/auditorias/{P}', 'administrador', false],
  ['PATCH', '/auditorias/{P}', 'administrador', true],
  ['GET', '/auditorias/{P}/eventos', 'administrador', false],
  ['POST', '/auditorias/{P}/eventos', 'administrador', true],
  ['PATCH', '/auditorias/{P}/eventos/{P}', 'administrador', true],
  ['DELETE', '/auditorias/{P}/eventos/{P}', 'administrador', false],
  ['GET', '/auditorias/{P}/mensajes', 'administrador', false],
  ['POST', '/auditorias/{P}/mensajes', 'administrador', true],
  ['GET', '/actividades', 'contador', false],
  ['PUT', '/actividades/estado', 'contador', true],
  ['GET', '/tiempo/activo', 'contador', false],
  ['POST', '/tiempo/iniciar', 'contador', true],
  ['POST', '/tiempo/detener', 'contador', true],
  ['POST', '/tiempo/manual', 'contador', true],
  ['GET', '/tiempo', 'contador', false],
  ['DELETE', '/tiempo/{P}', 'contador', false],
  ['GET', '/jornadas', 'contador', false],
  ['GET', '/jornadas/hoy', 'contador', false],
  ['POST', '/jornadas/hoy/marcar', 'contador', true],
  ['PUT', '/jornadas/ajustes', 'contador', true],
  ['PUT', '/jornadas/{P}', 'contador', true],
  ['GET', '/informes/tiempo', 'contador', false],
  ['GET', '/notificaciones', 'contador', false],
  ['GET', '/juntas/participantes-disponibles', 'contador', false],
  ['GET', '/juntas', 'contador', false],
  ['POST', '/juntas', 'contador', true],
  ['GET', '/juntas/{P}', 'contador', false],
  ['PATCH', '/juntas/{P}', 'contador', true],
  ['PATCH', '/juntas/{P}/respuesta', 'contador', true],
  ['DELETE', '/juntas/{P}', 'contador', false],
];

/**
 * Hace la petición de un endpoint con el payload en la ruta, en la query o en el cuerpo.
 * Las rutas con id solo reciben payloads que no empiezan con dígito cuando cambian datos,
 * para no tocar por error una cuenta real si algún día se leyera con parseInt.
 */
async function enviar(endpoint, { ruta, consulta, cuerpo }) {
  const [metodo, plantilla, rol] = endpoint;
  const token = tokens[rol];
  let url = plantilla.replace(/\{P\}/g, ruta ?? '1');
  if (consulta !== undefined) url += `?${consulta}`;
  return peticion(servidor.puerto, metodo, url, cuerpo, token);
}

before(async () => {
  await prepararBaseDeDatos();
  contador = await crearUsuarioDePrueba('contador');
  ajeno = await crearUsuarioDePrueba('contador');
  administrador = await crearUsuarioDePrueba('administrador');
  sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
  await crearCasoDePrueba(ajeno.id, { cliente: MARCA_AJENA });
  servidor = await iniciarServidor();
  tokens = {
    anonimo: null,
    contador: await iniciarSesion(servidor.puerto, contador.correo, contador.password),
    administrador: await iniciarSesion(servidor.puerto, administrador.correo, administrador.password),
    sistema: await iniciarSesion(servidor.puerto, sistema.correo, sistema.password),
  };
  instantaneaInicial = await instantanea();
});

after(async () => {
  if (servidor) await servidor.cerrar();
  await limpiarDatosDePrueba();
  await cerrarBaseDeDatos();
});

describe('inyección SQL por HTTP', () => {
  test('payloads de texto en la ruta: nunca 5xx ni datos ajenos', async () => {
    for (const endpoint of ENDPOINTS.filter((e) => e[1].includes('{P}'))) {
      for (const payload of PAYLOADS_TEXTO) {
        if (endpoint[0] !== 'GET' && /^\d/.test(payload)) continue;
        const respuesta = await enviar(endpoint, {
          ruta: encodeURIComponent(payload),
          cuerpo: endpoint[3] ? cuerpoConTodo('x') : undefined,
        });
        verificarRespuesta(respuesta, `${endpoint[0]} ${endpoint[1]} ruta=${payload.slice(0, 30)}`, endpoint[2]);
      }
    }
  });

  test('payloads de texto en la query: nunca 5xx ni datos ajenos', async () => {
    for (const endpoint of ENDPOINTS.filter((e) => e[0] === 'GET')) {
      for (const payload of PAYLOADS_TEXTO) {
        const consulta = FILTROS.map((f) => `${f}=${encodeURIComponent(payload)}`).join('&');
        const respuesta = await enviar(endpoint, { consulta });
        verificarRespuesta(respuesta, `GET ${endpoint[1]} query=${payload.slice(0, 30)}`, endpoint[2]);
      }
    }
  });

  test('objetos y arreglos en la query (a[b]=1, a[]=1): nunca 5xx', async () => {
    const formas = [
      (f) => `${f}[a]=1`,
      (f) => `${f}[]=1&${f}[]=2`,
      (f) => `${f}[$ne]=1`,
      (f) => `${f}[0][x]=1`,
    ];
    for (const endpoint of ENDPOINTS.filter((e) => e[0] === 'GET')) {
      for (const forma of formas) {
        const consulta = FILTROS.map(forma).join('&');
        const respuesta = await enviar(endpoint, { consulta });
        verificarRespuesta(respuesta, `GET ${endpoint[1]} query=${forma('f')}`, endpoint[2]);
      }
    }
  });

  test('payloads de texto en todos los campos del cuerpo: nunca 5xx ni datos ajenos', async () => {
    for (const endpoint of ENDPOINTS.filter((e) => e[3])) {
      for (const payload of PAYLOADS_TEXTO) {
        const respuesta = await enviar(endpoint, { ruta: '999999999', cuerpo: cuerpoConTodo(payload) });
        verificarRespuesta(respuesta, `${endpoint[0]} ${endpoint[1]} cuerpo=${payload.slice(0, 30)}`, endpoint[2]);
      }
    }
  });

  test('objetos, arreglos y números extremos en el cuerpo: 4xx controlado', async () => {
    for (const endpoint of ENDPOINTS.filter((e) => e[3])) {
      for (const { nombre, valor } of PAYLOADS_TIPADOS) {
        const respuesta = await enviar(endpoint, { ruta: '999999999', cuerpo: cuerpoConTodo(valor) });
        const contexto = `${endpoint[0]} ${endpoint[1]} cuerpo=${nombre}`;
        verificarRespuesta(respuesta, contexto, endpoint[2]);
        assert.ok(respuesta.statusCode >= 400, `${contexto}: aceptó el valor y respondió ${respuesta.statusCode}`);
      }
    }
  });

  test('un campo a la vez con objeto o arreglo: nunca 5xx', async () => {
    const endpoints = ENDPOINTS.filter((e) => e[3] && e[2] !== 'anonimo');
    for (const endpoint of endpoints) {
      for (const campo of CAMPOS) {
        for (const valor of [{ a: 1 }, [1, 2]]) {
          const respuesta = await enviar(endpoint, { ruta: '999999999', cuerpo: { [campo]: valor } });
          verificarRespuesta(respuesta, `${endpoint[0]} ${endpoint[1]} ${campo}=${JSON.stringify(valor)}`, endpoint[2]);
        }
      }
    }
  });

  test('login: la inyección clásica nunca inicia sesión', async () => {
    const intentos = [
      { correo: "' OR '1'='1", password: "' OR '1'='1" },
      { correo: `${contador.correo}' --`, password: 'x' },
      { correo: contador.correo, password: "' OR '1'='1" },
      { correo: { $ne: null }, password: { $ne: null } },
      { correo: [contador.correo], password: [contador.password] },
      { correo: { a: 1 }, password: 'x' },
    ];
    for (const cuerpo of intentos) {
      const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', cuerpo);
      assert.ok([400, 401, 403, 429].includes(respuesta.statusCode), `login con ${JSON.stringify(cuerpo)}: ${respuesta.statusCode}`);
      assert.ok(!(respuesta.body && respuesta.body.token), 'el login inyectado no debe emitir token');
    }
  });

  test('un id con SQL en la ruta no devuelve casos de otro contador', async () => {
    const respuesta = await peticion(
      servidor.puerto,
      'GET',
      `/contadores/${encodeURIComponent(`${ajeno.id} OR 1=1`)}/casos`,
      undefined,
      tokens.administrador
    );
    verificarRespuesta(respuesta, 'GET /contadores/:id/casos con id inyectado', 'administrador');
    assert.ok(respuesta.statusCode >= 400, `respondió ${respuesta.statusCode}`);
  });

  test('las tablas y las cuentas reales siguen intactas', async () => {
    const final = await instantanea();
    assert.strictEqual(final.tablas, instantaneaInicial.tablas, 'cambió la lista de tablas');
    assert.deepStrictEqual(final.cuentas, instantaneaInicial.cuentas, 'cambiaron las cuentas reales');
    const [cuenta] = await query('SELECT COUNT(*) AS n FROM usuarios WHERE id = ?', [contador.id]);
    assert.strictEqual(Number(cuenta.n), 1);
  });
});
