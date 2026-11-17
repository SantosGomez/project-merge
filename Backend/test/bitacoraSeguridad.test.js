const assert = require('node:assert');
const { describe, test, before, after, beforeEach, afterEach } = require('node:test');
const bitacora = require('../src/utils/bitacoraSeguridad');
const { crearApp } = require('../src/app');
const { pool } = require('../src/config/db');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Pruebas de la bitácora de seguridad (S6): formato JSON de una línea por evento, nunca
 * secretos, correo enmascarado, errores sin `sql`, y eventos de punta a punta con la app real.
 * Requiere MariaDB (XAMPP, puerto 3306); las cuentas llevan el prefijo `zz_test_`.
 */

let lineas;
let restaurar;
const eventos = (nombre) => lineas.map((l) => JSON.parse(l)).filter((e) => e.evento === nombre);

beforeEach(() => {
  lineas = [];
  restaurar = bitacora.configurarSalida((linea) => lineas.push(linea));
});
afterEach(() => restaurar());

describe('registrar', () => {
  test('escribe una sola línea JSON con ts, evento, nivel, usuarioId, rol e ip', () => {
    const req = { ip: '10.0.0.5', user: { id: 7, rol: 'contador' } };
    bitacora.registrar('prueba_evento', req, { motivo: 'x' });
    assert.strictEqual(lineas.length, 1);
    assert.ok(!lineas[0].includes('\n'));
    const e = JSON.parse(lineas[0]);
    assert.strictEqual(e.evento, 'prueba_evento');
    assert.strictEqual(e.nivel, 'info');
    assert.strictEqual(e.usuarioId, 7);
    assert.strictEqual(e.rol, 'contador');
    assert.strictEqual(e.ip, '10.0.0.5');
    assert.strictEqual(e.motivo, 'x');
    assert.ok(!Number.isNaN(Date.parse(e.ts)));
  });

  test('enmascara el correo y descarta contraseñas, tokens, hashes y cuerpos', () => {
    bitacora.registrar('prueba_evento', { ip: '1.1.1.1', body: { password: 'Secreta12345' } }, {
      correo: 'santos@delgrow.mx',
      password: 'Secreta12345',
      password_hash: '$argon2id$v=19$abc',
      token: 'eyJhbGciOi.abc.def',
      authorization: 'Bearer eyJ',
      body: { a: 1 },
      sql: 'SELECT 1',
    });
    const texto = lineas[0];
    const e = JSON.parse(texto);
    assert.strictEqual(e.correo, 's***@delgrow.mx');
    for (const prohibido of ['Secreta12345', 'argon2id', 'eyJ', 'santos@', 'SELECT', 'body', 'sql']) {
      assert.ok(!texto.includes(prohibido), `no debe contener ${prohibido}`);
    }
  });

  test('un correo no válido no se escribe', () => {
    bitacora.registrar('prueba_evento', null, { correo: 'sin-arroba' });
    assert.strictEqual(JSON.parse(lineas[0]).correo, '***');
  });
});

describe('registrarError', () => {
  test('guarda solo name, message limpio, code, status y ruta; nunca sql ni valores', () => {
    const err = new Error("Duplicate entry 'ana@x.mx' for key 'correo'");
    err.code = 'ER_DUP_ENTRY';
    err.sql = "INSERT INTO usuarios VALUES ('ana@x.mx','$argon2id$hash')";
    err.sqlMessage = "Duplicate entry 'ana@x.mx' for key 'correo'";
    err.status = 503;
    const req = {
      method: 'POST',
      originalUrl: '/usuarios?token=abc',
      body: { password: 'Secreta12345' },
      headers: { authorization: 'Bearer zzz' },
    };
    bitacora.registrarError(err, req);
    const texto = lineas[0];
    const e = JSON.parse(texto);
    assert.strictEqual(e.evento, 'error_interno');
    assert.strictEqual(e.nivel, 'error');
    assert.strictEqual(e.code, 'ER_DUP_ENTRY');
    assert.strictEqual(e.status, 503);
    assert.strictEqual(e.metodo, 'POST');
    assert.strictEqual(e.ruta, '/usuarios');
    for (const prohibido of ['ana@x.mx', 'argon2id', 'INSERT', 'Secreta12345', 'zzz', 'token=abc']) {
      assert.ok(!texto.includes(prohibido), `no debe contener ${prohibido}`);
    }
  });

  test('tolera valores que no son Error', () => {
    bitacora.registrarError('texto suelto', undefined);
    assert.strictEqual(JSON.parse(lineas[0]).evento, 'error_interno');
  });
});

describe('eventos de la app real', () => {
  let servidor;
  let contador;
  let admin;

  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    admin = await crearUsuarioDePrueba('administrador');
    servidor = await iniciarServidor(
      crearApp({ limitarLogin: true, limitarPeticiones: false, origenesPermitidos: ['http://localhost:9000'] })
    );
  });
  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('login exitoso y fallido, sin revelar contraseñas ni correo completo', async () => {
    await peticion(servidor.puerto, 'POST', '/auth/login', { correo: contador.correo, password: 'incorrecta-123' });
    await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'noexiste@zz.test', password: 'incorrecta-123' });
    const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    assert.strictEqual(eventos('login_fallido').length, 2);
    const ok = eventos('login_exitoso');
    assert.strictEqual(ok.length, 1);
    assert.strictEqual(ok[0].usuarioId, contador.id);
    assert.strictEqual(ok[0].rol, 'contador');
    const todo = lineas.join('\n');
    assert.ok(!todo.includes(contador.correo));
    assert.ok(!todo.includes(contador.password));
    assert.ok(!todo.includes(token));
  });

  test('cierre de sesión, sesión revocada y 403 por rol', async () => {
    const token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
    const prohibido = await peticion(servidor.puerto, 'GET', '/usuarios', undefined, token);
    assert.strictEqual(prohibido.statusCode, 403);
    const denegado = eventos('acceso_denegado');
    assert.strictEqual(denegado.length, 1);
    assert.strictEqual(denegado[0].usuarioId, contador.id);
    assert.strictEqual(denegado[0].metodo, 'GET');

    await peticion(servidor.puerto, 'POST', '/auth/logout', {}, token);
    assert.strictEqual(eventos('logout').length, 1);
    const tras = await peticion(servidor.puerto, 'GET', '/auth/perfil', undefined, token);
    assert.strictEqual(tras.statusCode, 401);
    assert.strictEqual(eventos('sesion_rechazada')[0].motivo, 'revocada');
  });

  test('alta, cambio de rol y de correo, y restablecimiento por el despacho', async () => {
    const token = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    const correo = `zz_test_bitacora_${Date.now()}@prueba.local`;
    registrarUsuarioCreado(correo);
    const alta = await peticion(
      servidor.puerto,
      'POST',
      '/usuarios',
      { nombre: 'zz_test_bitacora', correo, password: 'ClaveLarga-2026-xx', rol: 'contador' },
      token
    );
    assert.strictEqual(alta.statusCode, 201, JSON.stringify(alta.body));
    assert.strictEqual(eventos('usuario_creado').length, 1);

    const [filas] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    const id = filas[0].id;
    const nuevoCorreo = `zz_test_bitacora2_${Date.now()}@prueba.local`;
    registrarUsuarioCreado(nuevoCorreo);
    const edicion = await peticion(
      servidor.puerto,
      'PATCH',
      `/usuarios/${id}`,
      { nombre: 'zz_test_bitacora', correo: nuevoCorreo, rol: 'auxiliar' },
      token
    );
    assert.strictEqual(edicion.statusCode, 200, JSON.stringify(edicion.body));
    assert.strictEqual(eventos('usuario_rol_cambiado').length, 1);
    assert.strictEqual(eventos('usuario_correo_cambiado').length, 1);

    const reset = await peticion(
      servidor.puerto,
      'PATCH',
      '/usuarios/restablecer-contrasena',
      { correo: nuevoCorreo, password: 'OtraClaveLarga-2026' },
      token
    );
    assert.strictEqual(reset.statusCode, 200, JSON.stringify(reset.body));
    assert.strictEqual(eventos('password_restablecida').length, 1);
    const todo = lineas.join('\n');
    assert.ok(!todo.includes('ClaveLarga-2026') && !todo.includes('OtraClaveLarga'));
  });

  test('cambio de contraseña propia', async () => {
    const usuario = await crearUsuarioDePrueba('contador');
    const token = await iniciarSesion(servidor.puerto, usuario.correo, usuario.password);
    const r = await peticion(
      servidor.puerto,
      'PATCH',
      '/auth/mi-contrasena',
      { password_actual: usuario.password, password: 'NuevaClaveLarga-2026' },
      token
    );
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual(eventos('password_cambiada_propia').length, 1);
  });

  test('origen rechazado por el guardia de CORS', async () => {
    const r = await peticion(servidor.puerto, 'GET', '/casos', undefined, undefined, { Origin: 'http://malo.example' });
    assert.strictEqual(r.statusCode, 403);
    const e = eventos('origen_rechazado');
    assert.strictEqual(e.length, 1);
    assert.strictEqual(e[0].origen, 'http://malo.example');
    assert.strictEqual(eventos('acceso_denegado').length, 0);
  });

  test('bloqueo por cuenta (429) y por IP', async () => {
    const correo = 'bloqueo@zz.test';
    for (let i = 0; i < 6; i += 1) {
      await peticion(servidor.puerto, 'POST', '/auth/login', { correo, password: 'incorrecta-123' });
    }
    assert.ok(eventos('login_bloqueado').some((e) => e.motivo === 'cuenta'));
    for (let i = 0; i < 12; i += 1) {
      await peticion(servidor.puerto, 'POST', '/auth/login', { correo: `otro${i}@zz.test`, password: 'incorrecta-123' });
    }
    assert.ok(eventos('login_bloqueado').some((e) => e.motivo === 'ip'));
  });

  test('límite global de peticiones', async () => {
    const app = crearApp({ limitarLogin: false, limitesPeticiones: { global: 2 } });
    const s = await iniciarServidor(app);
    try {
      for (let i = 0; i < 4; i += 1) await peticion(s.puerto, 'GET', '/nada');
      assert.ok(eventos('rate_limit_global').length >= 1);
    } finally {
      await s.cerrar();
    }
  });
});
