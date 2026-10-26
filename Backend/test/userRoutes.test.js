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

// Correo único de prueba (en minúsculas); se registra para que la limpieza borre la cuenta.
function correoDePrueba(prefijo) {
  const correo = `${nombreDePrueba(prefijo)}@prueba.local`;
  registrarUsuarioCreado(correo);
  return correo;
}

// Alta por la API con el token dado.
function altaPorApi(cuerpo, token) {
  return peticion(servidor.puerto, 'POST', '/usuarios', cuerpo, token);
}

// ---------- RF-28: admin da de alta una cuenta con nombre y correo ----------
async function testAltaUsuarioComoAdmin() {
  const token = await loginAdmin();
  const correo = correoDePrueba('alta');

  const respuesta = await altaPorApi(
    { nombre: '  Ana Karen Ramírez  ', correo: `  ${correo.toUpperCase()}  `, password: 'NuevoPass1234', rol: 'contador' },
    token
  );

  assert.strictEqual(respuesta.statusCode, 201, 'debe responder 201 al dar de alta la cuenta');
  assert.ok(respuesta.body.mensaje.includes('Usuario dado de alta correctamente'), 'mensaje de alta exitosa');

  // Una sola fila, con el correo recortado y en minúsculas y la contraseña con Argon2id (RF-28, RNF-1).
  const filas = await query('SELECT nombre, correo, password_hash, rol FROM usuarios WHERE correo = ?', [correo]);
  assert.strictEqual(filas.length, 1, 'debe existir una sola cuenta con ese correo');
  assert.strictEqual(filas[0].nombre, 'Ana Karen Ramírez', 'el nombre se guarda sin espacios extremos');
  assert.ok(filas[0].password_hash.startsWith('$argon2id$'), 'la contraseña debe estar hasheada con Argon2id');
  assert.strictEqual(filas[0].rol, 'contador', 'la cuenta tiene el rol indicado');

  const entra = await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password: 'NuevoPass1234' });
  assert.strictEqual(entra.statusCode, 200, 'la cuenta nueva entra con su correo');
}

// ---------- RF-29: contador no puede dar de alta cuentas (acceso denegado) ----------
async function testAltaUsuarioComoContadorEsDenegado() {
  const token = await loginContador();
  const correo = correoDePrueba('denegado');

  const respuesta = await altaPorApi({ nombre: 'Denegado', correo, password: 'OtroPass1234', rol: 'contador' }, token);
  assert.strictEqual(respuesta.statusCode, 403, 'debe responder 403 para contador');
  assert.ok(
    respuesta.body.mensaje.includes('Acceso denegado') || respuesta.body.mensaje.includes('Rol insuficiente'),
    'mensaje debe ser de acceso denegado'
  );

  const filas = await query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
  assert.strictEqual(filas.length, 0, 'el contador no debe poder crear cuentas');
}

// ---------- RF-30: datos inválidos al dar de alta ----------
async function testAltaUsuarioDatosInvalidos() {
  const token = await loginAdmin();
  const valida = { nombre: 'Cuenta de prueba', password: 'Pass1234', rol: 'contador' };

  const sinNombre = await altaPorApi({ ...valida, nombre: '   ', correo: correoDePrueba('sin_nombre') }, token);
  assert.strictEqual(sinNombre.statusCode, 400, 'debe responder 400 sin nombre');
  assert.ok(sinNombre.body.mensaje.includes('nombre'), 'el mensaje debe mencionar el nombre');

  const sinCorreo = await altaPorApi({ ...valida, correo: '' }, token);
  assert.strictEqual(sinCorreo.statusCode, 400, 'debe responder 400 sin correo');
  assert.ok(sinCorreo.body.mensaje.includes('correo'), 'el mensaje debe mencionar el correo');

  registrarUsuarioCreado('sin-arroba.delgrow.mx');
  const correoRaro = await altaPorApi({ ...valida, correo: 'sin-arroba.delgrow.mx' }, token);
  assert.strictEqual(correoRaro.statusCode, 400, 'debe responder 400 con un correo no válido');
  assert.ok(correoRaro.body.mensaje.includes('correo'), 'el mensaje debe mencionar el correo');

  const corta = await altaPorApi({ ...valida, correo: correoDePrueba('clave_corta'), password: 'corto' }, token);
  assert.strictEqual(corta.statusCode, 400, 'debe responder 400 con contraseña corta');
  assert.ok(corta.body.mensaje.includes('contraseña'), 'mensaje debe mencionar contraseña');

  const rol = await altaPorApi({ ...valida, correo: correoDePrueba('rol_invalido'), rol: 'invitado' }, token);
  assert.strictEqual(rol.statusCode, 400, 'debe responder 400 con rol inválido');
  assert.ok(rol.body.mensaje.includes('rol'), 'mensaje debe mencionar rol');

  const repetido = await altaPorApi({ ...valida, correo: administrador.correo }, token);
  assert.strictEqual(repetido.statusCode, 400, 'debe responder 400 si el correo ya existe');
  assert.ok(repetido.body.mensaje.includes('correo ya existe'), 'mensaje debe indicar que el correo ya existe');
}

// ---------- RF-45, criterio 40: correo repetido que solo difiere en mayúsculas ----------
async function testAltaDuplicadaConOtraCapitalizacionRechaza() {
  const token = await loginAdmin();

  const respuesta = await altaPorApi(
    { nombre: 'Duplicado', correo: contador.correo.toUpperCase(), password: 'Pass1234', rol: 'contador' },
    token
  );

  assert.strictEqual(respuesta.statusCode, 400, 'debe responder 400 si el correo solo difiere en mayúsculas');
  assert.ok(respuesta.body.mensaje.includes('correo ya existe'), 'mensaje debe indicar que el correo ya existe');

  const filas = await query('SELECT id FROM usuarios WHERE correo = ?', [contador.correo]);
  assert.strictEqual(filas.length, 1, 'no debe crearse una segunda cuenta con el mismo correo');
}

// Correo de prueba de la longitud exacta indicada (termina en @prueba.local).
function correoDeLongitud(longitud) {
  const dominio = '@prueba.local';
  const base = nombreDePrueba('largo');
  const correo = (base + 'x'.repeat(longitud)).slice(0, longitud - dominio.length) + dominio;
  registrarUsuarioCreado(correo);
  return correo;
}

// ---------- RF-30: máximo de 150 caracteres del nombre y del correo ----------
async function testAltaConNombreDemasiadoLargoRechaza() {
  const token = await loginAdmin();
  const base = { password: 'Pass12345', rol: 'contador' };

  const correoLargo = correoDeLongitud(151);
  const largo = await altaPorApi({ ...base, nombre: 'Correo largo', correo: correoLargo }, token);
  assert.strictEqual(largo.statusCode, 400, 'un correo de 151 caracteres debe responder 400');
  assert.ok(String(largo.body.mensaje).includes('150'), 'el mensaje debe indicar el máximo de 150 caracteres');

  const nombreLargo = await altaPorApi({ ...base, nombre: 'N'.repeat(151), correo: correoDePrueba('nombre_largo') }, token);
  assert.strictEqual(nombreLargo.statusCode, 400, 'un nombre de 151 caracteres debe responder 400');
  assert.ok(String(nombreLargo.body.mensaje).includes('150'), 'el mensaje debe indicar el máximo de 150 caracteres');

  const correoJusto = correoDeLongitud(150);
  const justo = await altaPorApi({ ...base, nombre: 'N'.repeat(150), correo: correoJusto }, token);
  assert.strictEqual(justo.statusCode, 201, 'nombre y correo de exactamente 150 caracteres se aceptan');
  const filas = await query('SELECT id FROM usuarios WHERE correo = ?', [correoJusto]);
  assert.strictEqual(filas.length, 1, 'la cuenta de 150 caracteres debe existir');
}

// ---------- Apoyos del restablecimiento de contraseña (RF-42 a RF-44) ----------

const queryOriginal = pool.query.bind(pool);

/**
 * Pide el restablecimiento de la contraseña de una cuenta por su correo (historia 9b).
 * @param {string} correo - Correo de la cuenta a restablecer; va en el cuerpo, no en la ruta.
 * @param {Object} cuerpo - Resto del cuerpo, normalmente { password }.
 * @param {string} token - Token del solicitante.
 */
function restablecer(correo, cuerpo, token) {
  return peticion(servidor.puerto, 'PATCH', '/usuarios/restablecer-contrasena', { correo, ...cuerpo }, token);
}

// Código de estado del login de la cuenta con ese correo.
async function estadoDelLogin(correo, password) {
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

  const respuesta = await restablecer(cuenta.correo, { password: nueva }, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'debe responder 200 al restablecer la contraseña');
  assert.ok(
    respuesta.body.mensaje && respuesta.body.mensaje.includes('Contraseña restablecida'),
    'debe incluir el aviso de restablecimiento exitoso'
  );
  afirmarSinDatosDeAcceso(respuesta.body);

  const filas = await query('SELECT password_hash FROM usuarios WHERE id = ?', [cuenta.id]);
  assert.ok(filas[0].password_hash.startsWith('$argon2id$'), 'la contraseña nueva debe guardarse con Argon2id');
  assert.strictEqual(await estadoDelLogin(cuenta.correo, cuenta.password), 401, 'la contraseña anterior ya no debe servir');
  assert.strictEqual(await estadoDelLogin(cuenta.correo, nueva), 200, 'la contraseña nueva debe servir');

  // Todas las sesiones previas quedan invalidadas (criterio 43).
  await afirmarSesionCaducada(sesionUno, 'primera sesión');
  await afirmarSesionCaducada(sesionDos, 'segunda sesión');

  // Si no se puede guardar la contraseña, responde 503 y la contraseña actual sigue sirviendo (criterios 41 y 43).
  const otra = 'OtraClave2026';
  const conFallo = await conFalloDeBd(
    (sql) => sql.startsWith('UPDATE usuarios SET password_hash'),
    () => restablecer(cuenta.correo, { password: otra }, tokenAdmin)
  );
  assert.strictEqual(conFallo.statusCode, 503, 'un fallo al guardar la contraseña debe responder 503');
  assert.match(String(conFallo.body.mensaje), /^.+ sobre .+: .+$/, 'el 503 debe tener las tres partes');
  assert.strictEqual(await estadoDelLogin(cuenta.correo, nueva), 200, 'tras el fallo, la contraseña actual debe seguir sirviendo');

  // Con el pool restaurado, el restablecimiento real vuelve a funcionar.
  const reintento = await restablecer(cuenta.correo, { password: otra }, tokenAdmin);
  assert.strictEqual(reintento.statusCode, 200, 'el restablecimiento debe funcionar de nuevo sin el fallo');
  assert.strictEqual(await estadoDelLogin(cuenta.correo, otra), 200, 'la contraseña del reintento debe servir');
}

// ---------- RF-43, RF-29, criterios 39 y 44: no encontrado, acceso denegado y cuenta propia ----------
async function testRestablecerNoEncontradoDenegadoYPropio() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const nueva = 'NuevaClave2026';

  const inexistente = await restablecer(`${nombreDePrueba('no_existe')}@prueba.local`, { password: nueva }, tokenAdmin);
  assert.strictEqual(inexistente.statusCode, 404, 'una cuenta inexistente debe responder 404');
  assert.strictEqual(
    inexistente.body.mensaje,
    'No se encontró una cuenta con ese correo sobre correo: Verifique que el correo esté bien escrito',
    'el aviso debe decir que no hay una cuenta con ese correo'
  );

  const comoContador = await restablecer(cuenta.correo, { password: nueva }, await loginContador());
  assert.strictEqual(comoContador.statusCode, 403, 'un contador debe recibir acceso denegado');

  assert.strictEqual(
    await estadoDelLogin(cuenta.correo, cuenta.password),
    200,
    'ninguno de los intentos debe cambiar la contraseña de la cuenta'
  );

  // Un usuarios_de_sistema restablece su propia cuenta y entra con la nueva (criterio 44).
  const sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
  const tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
  const propia = await restablecer(sistema.correo, { password: nueva }, tokenSistema);
  assert.strictEqual(propia.statusCode, 200, 'usuarios_de_sistema debe poder restablecer su propia contraseña');
  assert.strictEqual(await estadoDelLogin(sistema.correo, nueva), 200, 'debe poder entrar con la contraseña nueva');
}

// ---------- Historia 9b: el correo se escribe como en el login ----------
async function testRestablecerConCorreoEnMayusculasYEspacios() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const nueva = 'NuevaClave2026';

  const respuesta = await restablecer(`  ${cuenta.correo.toUpperCase()}  `, { password: nueva }, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'el correo con mayúsculas y espacios debe encontrar la cuenta');
  assert.strictEqual(await estadoDelLogin(cuenta.correo, nueva), 200, 'la cuenta debe entrar con la contraseña nueva');
}

// ---------- Historia 9b, RF-37: correo faltante o que no es texto ----------
async function testRestablecerSinCorreoOConCorreoNoTextual() {
  const tokenAdmin = await loginAdmin();
  const cuenta = await crearUsuarioDePrueba('contador');
  const falta = 'Falta el correo sobre correo: Escriba el correo de la cuenta';
  const noTexto = 'Dato inválido sobre correo: debe enviarse como texto';

  const casos = [
    ['ausente', undefined, falta],
    ['vacío', '', falta],
    ['solo espacios', '   ', falta],
    ['número', 12345, noTexto],
    ['lista', [cuenta.correo], noTexto],
  ];
  for (const [descripcion, correo, mensaje] of casos) {
    const respuesta = await restablecer(correo, { password: 'NuevaClave2026' }, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 400, `correo ${descripcion}: debe responder 400`);
    assert.strictEqual(respuesta.body.mensaje, mensaje, `correo ${descripcion}: el aviso va sobre el correo`);
  }

  assert.strictEqual(
    await estadoDelLogin(cuenta.correo, cuenta.password),
    200,
    'la contraseña actual debe seguir sirviendo tras los rechazos'
  );
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
    const respuesta = await restablecer(cuenta.correo, cuerpo, tokenAdmin);
    assert.strictEqual(respuesta.statusCode, 400, `contraseña ${descripcion}: debe responder 400`);
    assert.match(
      String(respuesta.body.mensaje),
      /contraseña inválida/i,
      `contraseña ${descripcion}: el mensaje debe indicar que la contraseña es inválida`
    );
  }

  assert.strictEqual(
    await estadoDelLogin(cuenta.correo, cuenta.password),
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

  const [seed] = await query('SELECT id, password_hash FROM usuarios WHERE correo = ?', ['contador_seed@prueba.local']);
  assert.ok(seed, 'la cuenta contador_seed debe existir');
  const sesionesSeed = await query('SELECT jti, revocado FROM sesiones WHERE usuario_id = ?', [seed.id]);
  const tokensSeed = [];

  try {
    const administradorResp = await restablecer(otroAdministrador.correo, { password: nueva }, tokenSolicitante);
    assert.strictEqual(administradorResp.statusCode, 200, 'debe poder restablecerse una cuenta de administrador');
    assert.strictEqual(administradorResp.body.cuentaPropia, false, 'otra cuenta no es la propia');
    assert.strictEqual(await estadoDelLogin(otroAdministrador.correo, nueva), 200, 'el administrador debe entrar con la nueva');

    const seedResp = await restablecer('contador_seed@prueba.local', { password: nueva }, tokenSolicitante);
    assert.strictEqual(seedResp.statusCode, 200, 'debe poder restablecerse una cuenta del seed');
    const loginSeed = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'contador_seed@prueba.local', password: nueva });
    if (loginSeed.body.token) tokensSeed.push(loginSeed.body.token);
    assert.strictEqual(loginSeed.statusCode, 200, 'contador_seed debe entrar con la nueva');

    // La cuenta propia va al final porque invalida el token del solicitante.
    const propia = await restablecer(solicitante.correo, { password: nueva }, tokenSolicitante);
    assert.strictEqual(propia.statusCode, 200, 'el administrador debe poder restablecer su propia contraseña');
    assert.strictEqual(propia.body.cuentaPropia, true, 'avisa que se restableció la cuenta de quien lo pidió');
    await afirmarSesionCaducada(tokenSolicitante, 'cuenta propia');
    assert.strictEqual(await estadoDelLogin(solicitante.correo, nueva), 200, 'debe entrar con su contraseña nueva');
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
    () => restablecer(cuenta.correo, { password: nueva }, tokenAdmin)
  );
  assert.strictEqual(conFallo.statusCode, 503, 'un fallo al revocar las sesiones debe responder 503');
  assert.match(String(conFallo.body.mensaje), /^.+ sobre .+: .+$/, 'el 503 debe tener las tres partes');

  const reintento = await restablecer(cuenta.correo, { password: nueva }, tokenAdmin);
  assert.strictEqual(reintento.statusCode, 200, 'el reintento debe completar el restablecimiento');
  await afirmarSesionCaducada(sesionUno, 'primera sesión tras el reintento');
  await afirmarSesionCaducada(sesionDos, 'segunda sesión tras el reintento');
}

// ---------- Directorio de usuarios, rebanada 1: GET /usuarios lista las cuentas sin datos de acceso ----------
async function testListarUsuariosComoAdmin() {
  const tokenAdmin = await loginAdmin(); // deja el último acceso del administrador de prueba en este instante
  const sinAcceso = await crearUsuarioDePrueba('contador'); // nunca ha iniciado sesión

  const respuesta = await peticion(servidor.puerto, 'GET', '/usuarios', null, tokenAdmin);
  assert.strictEqual(respuesta.statusCode, 200, 'el administrador debe recibir 200');
  assert.ok(Array.isArray(respuesta.body.usuarios), 'la respuesta trae la lista en «usuarios»');

  // Cada fila trae solo estos campos: nunca el hash de la contraseña ni fechas internas.
  for (const fila of respuesta.body.usuarios) {
    assert.deepStrictEqual(
      Object.keys(fila).sort(),
      ['correo', 'id', 'nombre', 'rol', 'ultimo_acceso_en'],
      'cada cuenta trae solo id, nombre, correo, rol y ultimo_acceso_en'
    );
  }
  assert.ok(!JSON.stringify(respuesta.body).includes('$argon2'), 'ningún hash en la respuesta');

  // Las cuentas propias de esta prueba están en la lista, con su rol y su correo.
  const filaAdmin = respuesta.body.usuarios.find((fila) => fila.id === administrador.id);
  const filaSinAcceso = respuesta.body.usuarios.find((fila) => fila.id === sinAcceso.id);
  assert.ok(filaAdmin && filaSinAcceso, 'la lista incluye las cuentas propias de la prueba');
  assert.strictEqual(filaAdmin.rol, 'administrador');
  assert.strictEqual(filaAdmin.correo, administrador.correo);
  assert.strictEqual(filaSinAcceso.nombre, sinAcceso.nombre);

  // Fechas como texto local YYYY-MM-DD HH:mm:ss; null si la cuenta nunca entró.
  assert.strictEqual(filaSinAcceso.ultimo_acceso_en, null, 'quien nunca entró no tiene último acceso');
  assert.match(filaAdmin.ultimo_acceso_en, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'texto sin zona horaria');
  const hace = Math.abs(Date.now() - new Date(filaAdmin.ultimo_acceso_en.replace(' ', 'T')).getTime());
  assert.ok(hace < 2 * 60 * 1000, 'es la hora local de ahora, no la UTC');
}

async function testListarUsuariosPermisos() {
  const sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
  const tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);

  const comoSistema = await peticion(servidor.puerto, 'GET', '/usuarios', null, tokenSistema);
  assert.strictEqual(comoSistema.statusCode, 200, 'el usuario de sistema puede ver el directorio');
  assert.ok(comoSistema.body.usuarios.some((fila) => fila.id === sistema.id), 've la lista completa');

  const comoContador = await peticion(servidor.puerto, 'GET', '/usuarios', null, await loginContador());
  assert.strictEqual(comoContador.statusCode, 403, 'un contador recibe acceso denegado');
  assert.strictEqual(comoContador.body.usuarios, undefined, 'y no recibe la lista');

  const sinSesion = await peticion(servidor.puerto, 'GET', '/usuarios', null, null);
  assert.strictEqual(sinSesion.statusCode, 401, 'sin sesión se responde 401');
  assert.strictEqual(sinSesion.body.usuarios, undefined, 'y no recibe la lista');
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

  test('el administrador lista las cuentas con solo id, nombre, correo, rol y último acceso local', testListarUsuariosComoAdmin);
  test('el directorio de cuentas lo ven administrador y usuario de sistema, no el contador ni quien no inició sesión', testListarUsuariosPermisos);
  test('el administrador da de alta una cuenta con nombre y correo', testAltaUsuarioComoAdmin);
  test('el contador no puede dar de alta usuarios', testAltaUsuarioComoContadorEsDenegado);
  test('los datos inválidos de alta responden 400', testAltaUsuarioDatosInvalidos);
  test('el alta con un correo que solo difiere en mayúsculas responde 400', testAltaDuplicadaConOtraCapitalizacionRechaza);
  test('restablecer la contraseña la cambia con Argon2id e invalida todas las sesiones', testRestablecerContrasenaCorrecto);
  test('restablecer una cuenta inexistente responde 404, un contador recibe 403 y se puede restablecer la propia', testRestablecerNoEncontradoDenegadoYPropio);
  test('restablecer con el correo en mayúsculas y con espacios encuentra la cuenta', testRestablecerConCorreoEnMayusculasYEspacios);
  test('restablecer sin correo o con un correo que no es texto responde 400 sin cambiar nada', testRestablecerSinCorreoOConCorreoNoTextual);
  test('restablecer con una contraseña nueva inválida responde 400 sin cambiarla', testRestablecerConContrasenaInvalida);
  test('el alta con nombre o correo de más de 150 caracteres responde 400 y con 150 se acepta', testAltaConNombreDemasiadoLargoRechaza);
  test('se restablece una cuenta de administrador, una del seed y la propia, y la respuesta indica si es la propia', testRestablecerAdministradorSeedYPropia);
  test('si falla la revocación de sesiones responde 503 y el reintento las revoca', testFalloAlRevocarSesionesYReintento);
});
