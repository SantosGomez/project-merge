const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración de las respuestas de la API.
 * RF-01, RF-12, RF-32, RF-33, RF-42, RNF-7, criterios 1, 26 y 27.
 *
 * Levanta la aplicación real en un puerto libre y hace peticiones HTTP reales.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306, base delgrow_contadores).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio administrador,
 * contador y usuario de sistema con prefijo `zz_test_`; el usuario dado de alta
 * por la API se registra para la limpieza y el `after` cierra el servidor, borra
 * solo lo que este proceso creó y cierra el pool.
 */

let servidor;
let administrador;
let contador;
let usuarioSistema;
let tokenAdmin;
let tokenContador;
let tokenSistema;

async function iniciarSesionDe(usuario) {
  return iniciarSesion(servidor.puerto, usuario.usuario, usuario.password);
}

/**
 * Calcula un id de usuario que no existe: el máximo actual más un margen amplio.
 * Evita depender de un número fijo (aislamiento, plan 9.3).
 * @returns {Promise<number>} Id de usuario inexistente.
 */
async function idDeUsuarioInexistente() {
  const filas = await query('SELECT COALESCE(MAX(id), 0) + 1000 AS id FROM usuarios');
  return Number(filas[0].id);
}

/**
 * Calcula un id de caso que no existe: el máximo actual más un margen amplio.
 * @returns {Promise<number>} Id de caso inexistente.
 */
async function idDeCasoInexistente() {
  const filas = await query('SELECT COALESCE(MAX(id), 0) + 1000 AS id FROM casos');
  return Number(filas[0].id);
}

/**
 * Busca datos de acceso (hash de contraseña o cualquier dato derivado) en una
 * respuesta ya interpretada como JSON (RF-33, RNF-7).
 * @param {string} etiqueta - Operación que produjo la respuesta.
 * @param {Object} respuesta - Respuesta de `peticion` ({statusCode, body}).
 * @returns {string[]} Descripción de cada fuga encontrada.
 */
function fugasDeDatosDeAcceso(etiqueta, respuesta) {
  const texto = JSON.stringify(respuesta.body === undefined ? null : respuesta.body);
  const encontrados = [];
  if (texto.includes('password_hash')) {
    encontrados.push(`${etiqueta}: contiene password_hash`);
  }
  if (texto.includes('$argon2')) {
    encontrados.push(`${etiqueta}: contiene $argon2`);
  }
  return encontrados;
}

// ---------- RF-01, criterio 1: el login devuelve el id numérico del usuario ----------
async function testLoginDevuelveIdNumerico() {
  const casos = [
    { etiqueta: 'administrador', cuenta: administrador, rol: 'administrador', token: tokenAdmin },
    { etiqueta: 'contador', cuenta: contador, rol: 'contador', token: tokenContador },
    { etiqueta: 'usuario de sistema', cuenta: usuarioSistema, rol: 'usuarios_de_sistema', token: tokenSistema },
  ];

  for (const { etiqueta, cuenta, rol, token } of casos) {
    const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', {
      usuario: cuenta.usuario,
      password: cuenta.password,
    });

    assert.strictEqual(respuesta.statusCode, 200, `el login de ${etiqueta} debe responder 200`);
    assert.ok(respuesta.body.token, `el login de ${etiqueta} debe incluir el token de acceso`);
    assert.strictEqual(respuesta.body.rol, rol, `el login de ${etiqueta} debe incluir su rol`);
    assert.strictEqual(respuesta.body.usuario, cuenta.usuario, `el login de ${etiqueta} debe incluir su usuario`);

    // RF-01 y criterio 1: el identificador es un número y es el de la cuenta que inició sesión.
    assert.ok(
      Number.isInteger(respuesta.body.id),
      `el login de ${etiqueta} debe incluir el id numérico del usuario (RF-01)`
    );
    assert.strictEqual(
      respuesta.body.id,
      cuenta.id,
      `el login de ${etiqueta} debe devolver el id de su propia cuenta`
    );
    assert.ok(token, `la sesión de ${etiqueta} debe haberse iniciado para las demás comprobaciones`);

    // La respuesta del login tampoco puede incluir el hash ni datos derivados (RF-33).
    assert.deepStrictEqual(
      fugasDeDatosDeAcceso(`login de ${etiqueta}`, respuesta),
      [],
      `el login de ${etiqueta} no debe incluir datos de acceso (RNF-7)`
    );
  }
}

// ---------- RF-12, RF-32, criterio 26: la lista de contadores solo trae id y usuario ----------
async function testListaDeContadoresSoloIdYUsuario() {
  const respuesta = await peticion(servidor.puerto, 'GET', '/contadores', null, tokenAdmin);

  assert.strictEqual(respuesta.statusCode, 200, 'el administrador debe recibir 200 al listar contadores');
  assert.ok(Array.isArray(respuesta.body.contadores), 'la respuesta debe incluir el array de contadores');

  // Se afirma sobre los contadores propios de esta prueba, nunca sobre la lista completa.
  const propios = respuesta.body.contadores.filter(
    (fila) => fila.usuario === contador.usuario || fila.usuario === usuarioSistema.usuario
  );
  const propio = propios.find((fila) => fila.usuario === contador.usuario);
  assert.ok(propio, 'la lista debe incluir el contador propio creado en esta prueba');

  // RF-32: cada contador tiene exactamente las claves id y usuario, ninguna otra.
  assert.deepStrictEqual(
    Object.keys(propio).sort(),
    ['id', 'usuario'],
    'cada contador de la lista debe tener exactamente las claves id y usuario (RF-12, RF-32)'
  );

  // La misma comprobación para cada fila devuelta: ni hash, ni rol, ni fecha de creación.
  const clavesDeCadaFila = respuesta.body.contadores.map((fila) => Object.keys(fila).sort().join(','));
  assert.deepStrictEqual(
    [...new Set(clavesDeCadaFila)],
    ['id,usuario'],
    'ningún contador de la lista puede traer campos distintos de id y usuario (RF-32)'
  );
}

// ---------- RF-33, RNF-7, criterio 27: barrido de respuestas sin datos de acceso ----------
async function testBarridoDeRespuestasSinDatosDeAcceso() {
  const respuestas = [];
  const guardar = (etiqueta, respuesta) => {
    respuestas.push({ etiqueta, respuesta });
    return respuesta;
  };

  // Inicio de sesión (éxito y errores 400/401)
  guardar('login de administrador', await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: administrador.usuario,
    password: administrador.password,
  }));
  guardar('login de contador', await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: contador.password,
  }));
  guardar('login de usuario de sistema', await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: usuarioSistema.usuario,
    password: usuarioSistema.password,
  }));
  guardar('login sin credenciales', await peticion(servidor.puerto, 'POST', '/auth/login', {}));
  guardar('login con contraseña incorrecta', await peticion(servidor.puerto, 'POST', '/auth/login', {
    usuario: contador.usuario,
    password: 'ContraseñaIncorrecta',
  }));

  // Cierre de sesión: token propio para no invalidar los tokens usados después.
  const tokenParaCerrar = await iniciarSesionDe(contador);
  guardar('cierre de sesión', await peticion(servidor.puerto, 'POST', '/auth/logout', null, tokenParaCerrar));
  guardar('cierre de sesión sin token', await peticion(servidor.puerto, 'POST', '/auth/logout'));

  // Lista de contadores: éxito, acceso denegado (403) y sin token (401).
  guardar('lista de contadores', await peticion(servidor.puerto, 'GET', '/contadores', null, tokenAdmin));
  guardar(
    'lista de contadores como contador',
    await peticion(servidor.puerto, 'GET', '/contadores', null, tokenContador)
  );
  guardar('lista de contadores sin token', await peticion(servidor.puerto, 'GET', '/contadores'));

  // Conteos y casos de un contador: éxito y contador inexistente (404).
  guardar(
    'conteos de un contador',
    await peticion(servidor.puerto, 'GET', `/contadores/${contador.id}/conteos`, null, tokenAdmin)
  );
  guardar(
    'casos de un contador',
    await peticion(servidor.puerto, 'GET', `/contadores/${contador.id}/casos`, null, tokenAdmin)
  );
  const contadorInexistente = await idDeUsuarioInexistente();
  guardar(
    'conteos de un contador inexistente',
    await peticion(servidor.puerto, 'GET', `/contadores/${contadorInexistente}/conteos`, null, tokenAdmin)
  );

  // Casos propios: éxito y sin token (401).
  guardar('mis casos', await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, tokenContador));
  guardar('mis casos sin token', await peticion(servidor.puerto, 'GET', '/casos/mis-casos'));

  // Alta de caso: éxito, prioridad inválida (400) y administrador (403).
  const altaCaso = guardar(
    'alta de caso',
    await peticion(servidor.puerto, 'POST', '/casos', { cliente: 'Cliente de barrido', prioridad: 'Alta' }, tokenContador)
  );
  guardar(
    'alta de caso con prioridad inválida',
    await peticion(servidor.puerto, 'POST', '/casos', { cliente: 'Cliente X', prioridad: 'Urgente' }, tokenContador)
  );
  guardar(
    'alta de caso como administrador',
    await peticion(servidor.puerto, 'POST', '/casos', { cliente: 'Cliente X', prioridad: 'Media' }, tokenAdmin)
  );

  // Cambio de caso: éxito y caso inexistente (404).
  const casoId = altaCaso.body && altaCaso.body.caso ? altaCaso.body.caso.id : 0;
  guardar(
    'cambio de caso',
    await peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, { estado: 'En proceso' }, tokenContador)
  );
  const casoInexistente = await idDeCasoInexistente();
  guardar(
    'cambio de caso inexistente',
    await peticion(servidor.puerto, 'PATCH', `/casos/${casoInexistente}`, { estado: 'Finalizado' }, tokenContador)
  );

  // Alta de usuario: éxito (con usuario de sistema) y datos inválidos (400).
  const nombreNuevo = `zz_test_alta_${crypto.randomBytes(4).toString('hex')}`;
  const altaUsuario = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreNuevo, password: 'NuevoPass1234', rol: 'contador' },
    tokenSistema
  );
  // Se registra aunque un aserto falle después, para que la limpieza lo borre.
  registrarUsuarioCreado(nombreNuevo);
  guardar('alta de usuario', altaUsuario);
  assert.strictEqual(altaUsuario.statusCode, 201, 'usuarios_de_sistema debe poder dar de alta usuarios (criterio 9)');
  guardar(
    'alta de usuario con rol inválido',
    await peticion(
      servidor.puerto,
      'POST',
      '/usuarios',
      { usuario: `zz_test_rol_${crypto.randomBytes(4).toString('hex')}`, password: 'NuevoPass1234', rol: 'invitado' },
      tokenAdmin
    )
  );

  // Restablecimiento de contraseña: éxito, contraseña inválida (400), contador (403) y cuenta inexistente (404).
  // Se usa una cuenta propia para no invalidar las sesiones que usa el resto del barrido (RF-42).
  const cuentaRestablecer = await crearUsuarioDePrueba('contador');
  const rutaRestablecer = (nombre) => `/usuarios/${encodeURIComponent(nombre)}/restablecer-contrasena`;
  const restablecimiento = guardar(
    'restablecimiento de contraseña',
    await peticion(servidor.puerto, 'PATCH', rutaRestablecer(cuentaRestablecer.usuario), { password: 'ClaveBarrido2026' }, tokenAdmin)
  );
  guardar(
    'restablecimiento con contraseña inválida',
    await peticion(servidor.puerto, 'PATCH', rutaRestablecer(cuentaRestablecer.usuario), { password: 'corta' }, tokenAdmin)
  );
  guardar(
    'restablecimiento como contador',
    await peticion(servidor.puerto, 'PATCH', rutaRestablecer(cuentaRestablecer.usuario), { password: 'ClaveBarrido2026' }, tokenContador)
  );
  guardar(
    'restablecimiento de una cuenta inexistente',
    await peticion(
      servidor.puerto,
      'PATCH',
      rutaRestablecer(`zz_test_no_existe_${crypto.randomBytes(4).toString('hex')}`),
      { password: 'ClaveBarrido2026' },
      tokenAdmin
    )
  );

  // La respuesta de éxito del restablecimiento no trae ningún dato de acceso (RF-42, RF-33).
  assert.strictEqual(restablecimiento.statusCode, 200, 'el restablecimiento del barrido debe responder 200');
  const textoRestablecimiento = JSON.stringify(restablecimiento.body);
  for (const dato of ['token', 'password']) {
    assert.ok(!textoRestablecimiento.includes(dato), `el restablecimiento no debe incluir «${dato}»`);
  }

  // Ruta inexistente (404 del servidor).
  guardar('ruta inexistente', await peticion(servidor.puerto, 'GET', '/ruta-que-no-existe', null, tokenAdmin));

  // El barrido debe cubrir las respuestas de éxito y los cuatro códigos de error habituales.
  const codigos = respuestas.map(({ respuesta }) => respuesta.statusCode);
  for (const esperado of [200, 201, 400, 401, 403, 404]) {
    assert.ok(codigos.includes(esperado), `el barrido debe incluir una respuesta ${esperado}`);
  }

  const fugas = [];
  for (const { etiqueta, respuesta } of respuestas) {
    fugas.push(...fugasDeDatosDeAcceso(etiqueta, respuesta));
  }
  assert.deepStrictEqual(
    fugas,
    [],
    'ninguna respuesta, ni de éxito ni de error, puede contener datos de acceso (RF-33, RNF-7)'
  );
}

describe('respuestas de la API', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    usuarioSistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    servidor = await iniciarServidor();
    tokenAdmin = await iniciarSesionDe(administrador);
    tokenContador = await iniciarSesionDe(contador);
    tokenSistema = await iniciarSesionDe(usuarioSistema);

    // Un caso propio para que conteos y casos de contador devuelvan datos reales.
    await crearCasoDePrueba(contador.id, { cliente: 'Cliente de respuestas', estado: 'Pendiente' });
  });

  after(async () => {
    if (servidor) {
      await servidor.cerrar();
    }
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el login de administrador, contador y usuario de sistema incluye el id numérico', testLoginDevuelveIdNumerico);
  test('la lista de contadores devuelve solo id y usuario de cada contador', testListaDeContadoresSoloIdYUsuario);
  test('ninguna respuesta de la API contiene datos de acceso', testBarridoDeRespuestasSinDatosDeAcceso);
});
