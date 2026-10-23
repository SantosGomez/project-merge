const assert = require('node:assert');
const crypto = require('node:crypto');
const { describe, test, before, after } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { pool, query } = require('../src/config/db');
const jwt = require('jsonwebtoken');
const { correoDeTransicion } = require('../src/models/UserModel');

/**
 * Pruebas de integración de las rutas de usuarios (userRoutes).
 * RF-28 a RF-30, RF-23, RF-45, RF-42 a RF-44, RF-05, RF-41, RNF-1, RNF-4, RNF-5, RNF-6.
 *
 * Levanta la aplicación real en un puerto libre con las rutas de autenticación y
 * de usuarios montadas. Requiere MariaDB en marcha (XAMPP, puerto 3306).
 *
 * Aislamiento (plan 9.2 y 9.3): cada ejecución crea su propio administrador y su
 * propio contador con prefijo `zz_test_`; los usuarios dados de alta por la API
 * se registran para la limpieza y el `after` borra solo lo que este proceso creó.
 */

let servidor;
let administrador;
let contador;

// Nombre único de usuario de prueba con el prefijo acordado (plan 9.3).
function nombreDePrueba(prefijo) {
  return `zz_test_${prefijo}_${crypto.randomBytes(4).toString('hex')}`;
}

async function loginAdmin() {
  return iniciarSesion(servidor.puerto, administrador.correo, administrador.password);
}

async function loginContador() {
  return iniciarSesion(servidor.puerto, contador.correo, contador.password);
}

// ---------- RF-28: admin da de alta un usuario ----------
async function testAltaUsuarioComoAdmin() {
  const token = await loginAdmin();
  const nombre = nombreDePrueba('alta');

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombre, password: 'NuevoPass1234', rol: 'contador' },
    token
  );
  // El usuario queda registrado para que la limpieza lo borre, aunque falle un aserto.
  registrarUsuarioCreado(nombre);

  assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al dar de alta usuario');
  assert.ok(
    respuesta.body.mensaje.includes('Usuario dado de alta correctamente'),
    'mensaje debe indicar alta exitosa'
  );

  // El alta deja una sola fila con ese nombre, con la contraseña hasheada con Argon2id (RF-28, RNF-1).
  const filas = await query(
    'SELECT id, usuario, password_hash, rol FROM usuarios WHERE usuario = ?',
    [nombre]
  );
  assert.strictEqual(filas.length, 1, 'debe existir una sola fila con el nombre dado de alta');
  assert.strictEqual(filas[0].usuario, nombre, 'la fila debe tener el nombre dado de alta');
  assert.ok(
    filas[0].password_hash.startsWith('$argon2id$'),
    'la contraseña debe estar hasheada con Argon2id'
  );
  assert.strictEqual(filas[0].rol, 'contador', 'la fila debe tener el rol indicado en el alta');
}

// ---------- RF-29: contador no puede dar de alta usuarios (acceso denegado) ----------
async function testAltaUsuarioComoContadorEsDenegado() {
  const token = await loginContador();
  const nombre = nombreDePrueba('denegado');

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombre, password: 'OtroPass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
  assert.ok(
    respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'),
    'mensaje debe ser de acceso denegado'
  );

  // El contador no dio de alta a nadie: no debe existir ninguna fila con ese nombre.
  const filas = await query('SELECT id FROM usuarios WHERE usuario = ?', [nombre]);
  assert.strictEqual(filas.length, 0, 'el contador no debe poder crear usuarios');
}

// ---------- RF-30: datos inválidos al dar de alta ----------
async function testAltaUsuarioDatosInvalidos() {
  const token = await loginAdmin();

  // Usuario vacío
  const r1 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: '', password: 'Pass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(r1.statusCode, 400, 'debe responder 400 con usuario vacío');

  // Contraseña corta (< 8 caracteres)
  const r2 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreDePrueba('clave_corta'), password: 'corto', rol: 'contador' },
    token
  );
  assert.strictEqual(r2.statusCode, 400, 'debe responder 400 con contraseña corta');
  assert.ok(r2.body.mensaje.includes('contraseña'), 'mensaje debe mencionar contraseña');

  // Rol no permitido
  const r3 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreDePrueba('rol_invalido'), password: 'Pass1234', rol: 'invitado' },
    token
  );
  assert.strictEqual(r3.statusCode, 400, 'debe responder 400 con rol inválido');
  assert.ok(r3.body.mensaje.includes('rol'), 'mensaje debe mencionar rol');

  // Usuario ya existe (el administrador propio de esta prueba)
  const r4 = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: administrador.usuario, password: 'Pass1234', rol: 'contador' },
    token
  );
  assert.strictEqual(r4.statusCode, 400, 'debe responder 400 si el usuario ya existe');
  assert.ok(r4.body.mensaje.includes('usuario ya existe'), 'mensaje debe indicar que el usuario ya existe');
}

// ---------- RF-45, criterio 40: duplicado que solo difiere en mayúsculas ----------
async function testAltaDuplicadaConOtraCapitalizacionRechaza() {
  const token = await loginAdmin();
  const nombreEnMayusculas = contador.usuario.toUpperCase();

  const respuesta = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreEnMayusculas, password: 'Pass1234', rol: 'contador' },
    token
  );
  // Por si el alta llegara a crearse, la limpieza la borra.
  registrarUsuarioCreado(nombreEnMayusculas);

  assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 si el nombre solo difiere en mayúsculas');
  assert.ok(respuesta.body.mensaje.includes('usuario ya existe'), 'mensaje debe indicar que el usuario ya existe');

  const filas = await query('SELECT id FROM usuarios WHERE LOWER(usuario) = LOWER(?)', [contador.usuario]);
  assert.strictEqual(filas.length, 1, 'no debe crearse una segunda cuenta con el mismo nombre');
}

// Nombre de prueba de la longitud exacta indicada, con el prefijo `zz_test_`.
function nombreDeLongitud(longitud) {
  const base = nombreDePrueba('largo');
  return (base + 'x'.repeat(longitud)).slice(0, longitud);
}

// ---------- RF-30, criterio 42: máximo de 100 caracteres del nombre de usuario ----------
async function testAltaConNombreDemasiadoLargoRechaza() {
  const token = await loginAdmin();

  const nombreLargo = nombreDeLongitud(101);
  // Si la base de datos truncara el nombre, la fila tendría sus primeros 100 caracteres.
  const truncado = nombreLargo.slice(0, 100);
  const largo = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreLargo, password: 'Pass12345', rol: 'contador' },
    token
  );
  registrarUsuarioCreado(nombreLargo);
  registrarUsuarioCreado(truncado);

  assert.strictEqual(largo.statusCode, 400, 'un nombre de 101 caracteres debe responder 400');
  assert.ok(String(largo.body.mensaje).includes('100'), 'el mensaje debe indicar el máximo de 100 caracteres');
  const filasLargo = await query('SELECT id FROM usuarios WHERE usuario IN (?, ?)', [nombreLargo, truncado]);
  assert.strictEqual(filasLargo.length, 0, 'no debe crearse ninguna cuenta con el nombre largo');

  const nombreJusto = nombreDeLongitud(100);
  const justo = await peticion(
    servidor.puerto,
    'POST',
    '/usuarios',
    { usuario: nombreJusto, password: 'Pass12345', rol: 'contador' },
    token
  );
  registrarUsuarioCreado(nombreJusto);

  assert.strictEqual(justo.statusCode, 201, 'un nombre de exactamente 100 caracteres debe aceptarse');
  const filasJusto = await query('SELECT id FROM usuarios WHERE usuario = ?', [nombreJusto]);
  assert.strictEqual(filasJusto.length, 1, 'la cuenta de 100 caracteres debe existir');
}

// ---------- Apoyos del restablecimiento de contraseña (RF-42 a RF-44) ----------

const queryOriginal = pool.query.bind(pool);

/**
 * Pide el restablecimiento de la contraseña de una cuenta.
 * @param {string} nombre - Nombre de usuario de la cuenta a restablecer.
 * @param {Object} cuerpo - Cuerpo de la petición, normalmente { password }.
 * @param {string} token - Token del solicitante.
 */
function restablecer(nombre, cuerpo, token) {
  return peticion(
    servidor.puerto,
    'PATCH',
    `/usuarios/${encodeURIComponent(nombre)}/restablecer-contrasena`,
    cuerpo,
    token
  );
}

// Código de estado del login de la cuenta con ese nombre (entra con su correo de acceso).
async function estadoDelLogin(nombre, password) {
  const correo = correoDeTransicion(nombre);
  const respuesta = await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password });
  return respuesta.statusCode;
}

// Comprueba que la respuesta no contiene ningún dato de acceso (RF-33, RF-42).
function afirmarSinDatosDeAcceso(cuerpo) {
  const texto = JSON.stringify(cuerpo);
  for (const dato of ['password_hash', '$argon2', 'token', 'password']) {
    assert.ok(!texto.includes(dato), `la respuesta no debe incluir «${dato}»`);
  }
}

// Comprueba que un token emitido antes del restablecimiento ya no sirve (RF-05, criterio 43).
async function afirmarSesionCaducada(token, contexto) {
  const respuesta = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, token);
  assert.strictEqual(respuesta.statusCode, 401, `${contexto}: el token anterior debe recibir 401`);
  assert.ok(
    respuesta.body.mensaje && respuesta.body.mensaje.includes('Sesión caducada'),
    `${contexto}: el aviso debe ser de sesión caducada`
  );
}

/**
 * Ejecuta la petición con la sentencia indicada fallando en la base de datos y
 * restaura el pool pase lo que pase (plan 10.3.3).
 * @param {(sql: string) => boolean} condicion - Sentencia que debe fallar.
 * @param {() => Promise<any>} hacerPeticion - Petición que se envía durante el fallo.
 */
async function conFalloDeBd(condicion, hacerPeticion) {
  pool.query = (sql, ...resto) => {
    const texto = typeof sql === 'string' ? sql : sql && sql.sql;
    if (typeof texto === 'string' && condicion(texto)) {
      return Promise.reject(new Error('fallo de BD simulado'));
    }
    return queryOriginal(sql, ...resto);
  };
  try {
    return await hacerPeticion();
  } finally {
    pool.query = queryOriginal;
  }
}

// ---------- RF-42, RF-05, criterios 38 y 43: restablecimiento correcto ----------
async function testRestablecerContrasenaCorrecto() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const sesionUno = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  const sesionDos = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  const nueva = 'NuevaClave2026';

  const respuesta = await restablecer(cuenta.usuario, { password: nueva }, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 al restablecer la contraseña');
  assert.ok(
    respuesta.body.mensaje && respuesta.body.mensaje.includes('Contraseña restablecida'),
    'debe incluir el aviso de restablecimiento exitoso'
  );
  afirmarSinDatosDeAcceso(respuesta.body);

  const filas = await query('SELECT password_hash FROM usuarios WHERE id = ?', [cuenta.id]);
  assert.ok(filas[0].password_hash.startsWith('$argon2id$'), 'la contraseña nueva debe guardarse con Argon2id');
  assert.strictEqual(await estadoDelLogin(cuenta.usuario, cuenta.password), 401, 'la contraseña anterior ya no debe servir');
  assert.strictEqual(await estadoDelLogin(cuenta.usuario, nueva), 200, 'la contraseña nueva debe servir');

  // Todas las sesiones previas quedan invalidadas (criterio 43).
  await afirmarSesionCaducada(sesionUno, 'primera sesión');
  await afirmarSesionCaducada(sesionDos, 'segunda sesión');

  // Si no se puede guardar la contraseña, responde 503 y la contraseña actual sigue sirviendo (criterios 41 y 43).
  const otra = 'OtraClave2026';
  const conFallo = await conFalloDeBd(
    (sql) => sql.startsWith('UPDATE usuarios SET password_hash'),
    () => restablecer(cuenta.usuario, { password: otra }, tokenAdmin)
  );
  assert.strictEqual(conFallo.statusCode, 503, 'un fallo al guardar la contraseña debe responder 503');
  assert.match(String(conFallo.body.mensaje), /^.+ sobre .+: .+$/, 'el 503 debe tener las tres partes');
  assert.strictEqual(await estadoDelLogin(cuenta.usuario, nueva), 200, 'tras el fallo, la contraseña actual debe seguir sirviendo');

  // Con el pool restaurado, el restablecimiento real vuelve a funcionar.
  const reintento = await restablecer(cuenta.usuario, { password: otra }, tokenAdmin);
  assert.strictEqual(reintento.statusCode, 200, 'el restablecimiento debe funcionar de nuevo sin el fallo');
  assert.strictEqual(await estadoDelLogin(cuenta.usuario, otra), 200, 'la contraseña del reintento debe servir');
}

// ---------- RF-43, RF-29, criterios 39 y 44: no encontrado, acceso denegado y cuenta propia ----------
async function testRestablecerNoEncontradoDenegadoYPropio() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const nueva = 'NuevaClave2026';

  const inexistente = await restablecer(nombreDePrueba('no_existe'), { password: nueva }, tokenAdmin);
  assert.strictEqual(inexistente.statusCode, 404, 'una cuenta inexistente debe responder 404');
  assert.ok(inexistente.body.mensaje.includes('No se encontró'), 'el aviso debe ser de no encontrado');

  const otraCapitalizacion = await restablecer(cuenta.usuario.toUpperCase(), { password: nueva }, tokenAdmin);
  assert.strictEqual(otraCapitalizacion.statusCode, 404, 'el nombre con otra capitalización debe tomarse por no encontrado');
  assert.ok(otraCapitalizacion.body.mensaje.includes('No se encontró'), 'el aviso debe ser de no encontrado');

  const comoContador = await restablecer(cuenta.usuario, { password: nueva }, await loginContador());
  assert.strictEqual(comoContador.statusCode, 403, 'un contador debe recibir acceso denegado');

  assert.strictEqual(
    await estadoDelLogin(cuenta.usuario, cuenta.password),
    200,
    'ninguno de los intentos debe cambiar la contraseña de la cuenta'
  );

  // Un usuarios_de_sistema restablece su propia cuenta y entra con la nueva (criterio 44).
  const sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
  const tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
  const propia = await restablecer(sistema.usuario, { password: nueva }, tokenSistema);
  assert.strictEqual(propia.statusCode, 200, 'usuarios_de_sistema debe poder restablecer su propia contraseña');
  assert.strictEqual(await estadoDelLogin(sistema.usuario, nueva), 200, 'debe poder entrar con la contraseña nueva');
}

// ---------- RF-44, RF-37, criterio 39: contraseña nueva inválida ----------
async function testRestablecerConContrasenaInvalida() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');

  const casos = [
    ['ausente', {}],
    ['vacía', { password: '' }],
    ['solo espacios', { password: '        ' }],
    ['número', { password: 12345678 }],
    ['lista', { password: ['ClaveLarga1'] }],
    ['de 7 caracteres', { password: 'Clave12' }],
  ];
  for (const [descripcion, cuerpo] of casos) {
    const respuesta = await restablecer(cuenta.usuario, cuerpo, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 400, `contraseña ${descripcion}: debe responder 400`);
    assert.match(
      String(respuesta.body.mensaje),
      /contraseña inválida/i,
      `contraseña ${descripcion}: el mensaje debe indicar que la contraseña es inválida`
    );
  }

  assert.strictEqual(
    await estadoDelLogin(cuenta.usuario, cuenta.password),
    200,
    'la contraseña actual debe seguir sirviendo tras los rechazos'
  );
}

// ---------- RF-42, criterio 44: cuenta de administrador, cuenta del seed y cuenta propia ----------
// Usa su propio administrador: restablecer la cuenta propia revoca el token del solicitante.
// contador_seed se deja con su hash y sus sesiones como estaban.
async function testRestablecerAdministradorSeedYPropia() {
  const solicitante = await crearUsuarioDePrueba('administrador');
  const otroAdministrador = await crearUsuarioDePrueba('administrador');
  const tokenSolicitante = await iniciarSesion(servidor.puerto, solicitante.correo, solicitante.password);
  const nueva = 'NuevaClave2026';

  const [seed] = (await query('SELECT id, usuario, password_hash FROM usuarios WHERE usuario = ?', ['contador_seed']))
    .filter((fila) => fila.usuario === 'contador_seed');
  assert.ok(seed, 'la cuenta contador_seed debe existir');
  const sesionesSeed = await query('SELECT jti, revocado FROM sesiones WHERE usuario_id = ?', [seed.id]);
  const tokensSeed = [];

  try {
    const administradorResp = await restablecer(otroAdministrador.usuario, { password: nueva }, tokenSolicitante);
    assert.strictEqual(administradorResp.statusCode, 200, 'debe poder restablecerse una cuenta de administrador');
    assert.strictEqual(await estadoDelLogin(otroAdministrador.usuario, nueva), 200, 'el administrador debe entrar con la nueva');

    const seedResp = await restablecer('contador_seed', { password: nueva }, tokenSolicitante);
    assert.strictEqual(seedResp.statusCode, 200, 'debe poder restablecerse una cuenta del seed');
    const loginSeed = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'contador_seed@prueba.local', password: nueva });
    if (loginSeed.body.token) tokensSeed.push(loginSeed.body.token);
    assert.strictEqual(loginSeed.statusCode, 200, 'contador_seed debe entrar con la nueva');

    // La cuenta propia va al final porque invalida el token del solicitante.
    const propia = await restablecer(solicitante.usuario, { password: nueva }, tokenSolicitante);
    assert.strictEqual(propia.statusCode, 200, 'el administrador debe poder restablecer su propia contraseña');
    await afirmarSesionCaducada(tokenSolicitante, 'cuenta propia');
    assert.strictEqual(await estadoDelLogin(solicitante.usuario, nueva), 200, 'debe entrar con su contraseña nueva');
  } finally {
    await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [seed.password_hash, seed.id]);
    for (const sesion of sesionesSeed.filter((fila) => Number(fila.revocado) === 0)) {
      await query('UPDATE sesiones SET revocado = 0 WHERE jti = ?', [sesion.jti]);
    }
    for (const token of tokensSeed) {
      await query('DELETE FROM sesiones WHERE jti = ?', [jwt.decode(token).jti]);
    }
  }
}

// ---------- RF-42, criterio 43: fallo al revocar las sesiones durante el restablecimiento ----------
// Riesgo aceptado en T16: tras el 503 la contraseña ya cambió; aquí solo se fija que el reintento lo completa.
async function testFalloAlRevocarSesionesYReintento() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const sesionUno = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  const sesionDos = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  const nueva = 'NuevaClave2026';

  const conFallo = await conFalloDeBd(
    (sql) => sql.startsWith('UPDATE sesiones SET revocado = 1 WHERE usuario_id'),
    () => restablecer(cuenta.usuario, { password: nueva }, tokenAdmin)
  );
  assert.strictEqual(conFallo.statusCode, 503, 'un fallo al revocar las sesiones debe responder 503');
  assert.match(String(conFallo.body.mensaje), /^.+ sobre .+: .+$/, 'el 503 debe tener las tres partes');

  const reintento = await restablecer(cuenta.usuario, { password: nueva }, tokenAdmin);
  assert.strictEqual(reintento.statusCode, 200, 'el reintento debe completar el restablecimiento');
  await afirmarSesionCaducada(sesionUno, 'primera sesión tras el reintento');
  await afirmarSesionCaducada(sesionDos, 'segunda sesión tras el reintento');
}

describe('rutas de usuarios', () => {
  before(async () => {
    await prepararBaseDeDatos();
    administrador = await crearUsuarioDePrueba('administrador');
    contador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el administrador da de alta un usuario con contraseña Argon2id', testAltaUsuarioComoAdmin);
  test('el contador no puede dar de alta usuarios', testAltaUsuarioComoContadorEsDenegado);
  test('los datos inválidos de alta responden 400', testAltaUsuarioDatosInvalidos);
  test('el alta con un nombre que solo difiere en mayúsculas responde 400', testAltaDuplicadaConOtraCapitalizacionRechaza);
  test('restablecer la contraseña la cambia con Argon2id e invalida todas las sesiones', testRestablecerContrasenaCorrecto);
  test('restablecer una cuenta inexistente responde 404, un contador recibe 403 y se puede restablecer la propia', testRestablecerNoEncontradoDenegadoYPropio);
  test('restablecer con una contraseña nueva inválida responde 400 sin cambiarla', testRestablecerConContrasenaInvalida);
  test('el alta con un nombre de más de 100 caracteres responde 400 y con 100 se acepta', testAltaConNombreDemasiadoLargoRechaza);
  test('se restablece una cuenta de administrador, una del seed y la propia del administrador', testRestablecerAdministradorSeedYPropia);
  test('si falla la revocación de sesiones responde 503 y el reintento las revoca', testFalloAlRevocarSesionesYReintento);
});
