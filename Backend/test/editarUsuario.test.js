const assert = require('node:assert');
const { describe, test, before, after } = require('node:test');
const crypto = require('node:crypto');
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
 * PATCH /usuarios/:id — el despacho modifica una cuenta existente desde el directorio
 * (nombre, correo, rol y, si es auxiliar, el contador que apoya; nunca la contraseña).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let sistema;
let tokenSistema;
let tokenAdmin;
let tokenContador;

const pedir = (metodo, ruta, cuerpo, token = tokenSistema) => peticion(servidor.puerto, metodo, ruta, cuerpo, token);
const cuentaEnBd = async (id) => (await query('SELECT * FROM usuarios WHERE id = ?', [id]))[0];
const contadoresDe = async (auxiliarId) =>
  (await query('SELECT contador_id FROM contador_auxiliar WHERE auxiliar_id = ?', [auxiliarId])).map((f) =>
    Number(f.contador_id)
  );
const vincular = (contadorId, auxiliarId) =>
  query('INSERT INTO contador_auxiliar (contador_id, auxiliar_id, asignado_en) VALUES (?, ?, NOW())', [
    contadorId,
    auxiliarId,
  ]);
const ultimoAvisoDe = async (usuarioId) => {
  const filas = await query(
    'SELECT mensaje FROM notificaciones WHERE usuario_id = ? ORDER BY creado_en DESC, id DESC LIMIT 1',
    [usuarioId]
  );
  return filas.length > 0 ? filas[0].mensaje : null;
};
const nombreDePrueba = () => `zz_test_editado_${crypto.randomBytes(4).toString('hex')}`;
/** Datos completos de una cuenta tal como los manda el diálogo, con cambios opcionales. */
const datosDe = (cuenta, rol, cambios = {}) => ({ nombre: cuenta.nombre, correo: cuenta.correo, rol, ...cambios });

describe('PATCH /usuarios/:id (editar cuenta)', () => {
  before(async () => {
    await prepararBaseDeDatos();
    sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    const admin = await crearUsuarioDePrueba('administrador');
    const contador = await crearUsuarioDePrueba('contador');
    servidor = await iniciarServidor();
    tokenSistema = await iniciarSesion(servidor.puerto, sistema.correo, sistema.password);
    tokenAdmin = await iniciarSesion(servidor.puerto, admin.correo, admin.password);
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('cambia nombre, correo y rol; recorta y guarda el correo en minúsculas', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const nombre = nombreDePrueba();
    const respuesta = await pedir('PATCH', `/usuarios/${cuenta.id}`, {
      nombre: `  ${nombre}  `,
      correo: `  ${nombre.toUpperCase()}@Prueba.Local `,
      rol: 'usuarios_de_sistema',
    });
    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    assert.strictEqual(respuesta.body.mensaje, 'Usuario actualizado correctamente');
    assert.deepStrictEqual(respuesta.body.usuario, {
      id: cuenta.id,
      nombre,
      correo: `${nombre}@prueba.local`,
      rol: 'usuarios_de_sistema',
    });
    const guardada = await cuentaEnBd(cuenta.id);
    assert.strictEqual(guardada.nombre, nombre);
    assert.strictEqual(guardada.correo, `${nombre}@prueba.local`);
    assert.strictEqual(guardada.rol, 'usuarios_de_sistema');
  });

  test('nunca cambia la contraseña aunque llegue en el cuerpo', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const antes = await cuentaEnBd(cuenta.id);
    const respuesta = await pedir('PATCH', `/usuarios/${cuenta.id}`, {
      ...datosDe(cuenta, 'contador'),
      password: 'OtraClave999',
    });
    assert.strictEqual(respuesta.statusCode, 200);
    const despues = await cuentaEnBd(cuenta.id);
    assert.strictEqual(despues.password_hash, antes.password_hash);
    assert.strictEqual(despues.debe_cambiar_contrasena, antes.debe_cambiar_contrasena);
    // La persona sigue entrando con su contraseña de siempre
    await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
  });

  test('valida nombre, correo y rol con los mismos avisos que el alta', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const ruta = `/usuarios/${cuenta.id}`;
    const casos = [
      [{ nombre: '   ' }, 'Falta el nombre sobre nombre: Escribe el nombre de la persona'],
      [{ correo: '' }, 'Falta el correo sobre correo: Escribe el correo de la cuenta'],
      [{ correo: 'sin-arroba' }, 'Correo no válido sobre correo: Escribe un correo como nombre@delgrow.mx'],
      [{ nombre: 'a'.repeat(151) }, 'El nombre supera el máximo de caracteres sobre nombre: El nombre debe tener máximo 150 caracteres'],
      [{ nombre: 5 }, 'Dato inválido sobre nombre: debe enviarse como texto'],
      [{ rol: 'jefe' }, 'Rol no válido sobre rol: Usa uno de estos: administrador, contador, auxiliar o usuario de sistema'],
      [{ rol: 7 }, 'Dato inválido sobre rol: El rol debe enviarse como texto'],
    ];
    for (const [cambio, mensaje] of casos) {
      const respuesta = await pedir('PATCH', ruta, datosDe(cuenta, 'contador', cambio));
      assert.strictEqual(respuesta.statusCode, 400, JSON.stringify(cambio));
      assert.strictEqual(respuesta.body.mensaje, mensaje);
    }
    assert.strictEqual((await cuentaEnBd(cuenta.id)).nombre, cuenta.nombre, 'nada se guarda si hay errores');
  });

  test('un correo de otra cuenta da 400 «ya existe»; el propio se puede conservar', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const otra = await crearUsuarioDePrueba('contador');
    const repetido = await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador', { correo: otra.correo.toUpperCase() }));
    assert.strictEqual(repetido.statusCode, 400);
    assert.strictEqual(
      repetido.body.mensaje,
      'El correo ya existe sobre correo: Usa otro correo o restablece la contraseña de esa cuenta'
    );
    const propio = await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador'));
    assert.strictEqual(propio.statusCode, 200);
  });

  test('una cuenta que no existe o un id no válido da 404', async () => {
    for (const id of ['999999999', 'abc', '0']) {
      const respuesta = await pedir('PATCH', `/usuarios/${id}`, { nombre: 'x', correo: 'x@prueba.local', rol: 'contador' });
      assert.strictEqual(respuesta.statusCode, 404, `id ${id}`);
      assert.match(respuesta.body.mensaje, /^.+ sobre .+: .+$/);
    }
  });

  test('solo el administrador o el usuario de sistema pueden editar', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const sinPermiso = await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador'), tokenContador);
    assert.strictEqual(sinPermiso.statusCode, 403);
    const sinSesion = await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador'), null);
    assert.strictEqual(sinSesion.statusCode, 401);
    const nombre = nombreDePrueba();
    const admin = await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador', { nombre }), tokenAdmin);
    assert.strictEqual(admin.statusCode, 200);
    assert.strictEqual((await cuentaEnBd(cuenta.id)).nombre, nombre);
  });

  test('puedes cambiar tu nombre, pero no tu propio rol', async () => {
    const nombre = nombreDePrueba();
    const propio = await pedir('PATCH', `/usuarios/${sistema.id}`, datosDe(sistema, 'usuarios_de_sistema', { nombre }));
    assert.strictEqual(propio.statusCode, 200);
    sistema.nombre = nombre;
    const rol = await pedir('PATCH', `/usuarios/${sistema.id}`, datosDe(sistema, 'administrador'));
    assert.strictEqual(rol.statusCode, 400);
    assert.strictEqual(
      rol.body.mensaje,
      'No puedes cambiar tu propio rol sobre rol: Pide a otro usuario de sistema que lo cambie'
    );
    assert.strictEqual((await cuentaEnBd(sistema.id)).rol, 'usuarios_de_sistema');
  });

  test('un contador con auxiliares no puede dejar de ser contador (409)', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const auxiliar = await crearUsuarioDePrueba('auxiliar');
    await vincular(contador.id, auxiliar.id);
    const respuesta = await pedir('PATCH', `/usuarios/${contador.id}`, datosDe(contador, 'auxiliar'));
    assert.strictEqual(respuesta.statusCode, 409);
    assert.strictEqual(
      respuesta.body.mensaje,
      'El contador tiene auxiliares sobre rol: Cambia primero el contador que apoya cada uno de sus auxiliares'
    );
    assert.strictEqual((await cuentaEnBd(contador.id)).rol, 'contador');
  });

  test('una cuenta con casos no pasa a administrador ni a usuario de sistema (409), pero sí a auxiliar', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    await crearCasoDePrueba(contador.id);
    for (const rol of ['administrador', 'usuarios_de_sistema']) {
      const respuesta = await pedir('PATCH', `/usuarios/${contador.id}`, datosDe(contador, rol));
      assert.strictEqual(respuesta.statusCode, 409, rol);
      assert.strictEqual(
        respuesta.body.mensaje,
        'La cuenta tiene casos sobre rol: Elige contador o auxiliar, o reasigna sus casos antes de cambiar el rol'
      );
    }
    const auxiliar = await pedir('PATCH', `/usuarios/${contador.id}`, datosDe(contador, 'auxiliar'));
    assert.strictEqual(auxiliar.statusCode, 200);
    const casos = await query('SELECT COUNT(*) AS n FROM casos WHERE contador_id = ?', [contador.id]);
    assert.strictEqual(Number(casos[0].n), 1, 'los casos se quedan con la cuenta');
  });

  test('un auxiliar que deja de serlo pierde su vínculo y se avisa a los dos', async () => {
    const contador = await crearUsuarioDePrueba('contador');
    const auxiliar = await crearUsuarioDePrueba('auxiliar');
    await vincular(contador.id, auxiliar.id);
    const respuesta = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'contador'));
    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    assert.deepStrictEqual(await contadoresDe(auxiliar.id), []);
    assert.strictEqual((await cuentaEnBd(auxiliar.id)).rol, 'contador');
    assert.strictEqual(await ultimoAvisoDe(contador.id), `${auxiliar.nombre} ya no es tu auxiliar.`);
    assert.strictEqual(await ultimoAvisoDe(auxiliar.id), `Ya no apoyas a ${contador.nombre} con sus casos.`);
  });

  test('cambia el contador que apoya un auxiliar y lo vincula al pasar a auxiliar', async () => {
    const contadorUno = await crearUsuarioDePrueba('contador');
    const contadorDos = await crearUsuarioDePrueba('contador');
    const auxiliar = await crearUsuarioDePrueba('auxiliar');
    await vincular(contadorUno.id, auxiliar.id);

    const cambio = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'auxiliar', { contadores: [contadorDos.id] }));
    assert.strictEqual(cambio.statusCode, 200, JSON.stringify(cambio.body));
    assert.deepStrictEqual(await contadoresDe(auxiliar.id), [contadorDos.id]);
    assert.strictEqual(await ultimoAvisoDe(contadorDos.id), `${auxiliar.nombre} ahora es tu auxiliar.`);

    // Sin `contadores` en el cuerpo, el vínculo no se toca
    const sinCampo = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'auxiliar'));
    assert.strictEqual(sinCampo.statusCode, 200);
    assert.deepStrictEqual(await contadoresDe(auxiliar.id), [contadorDos.id]);

    const vaciar = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'auxiliar', { contadores: [] }));
    assert.strictEqual(vaciar.statusCode, 200);
    assert.deepStrictEqual(await contadoresDe(auxiliar.id), []);

    const nuevo = await crearUsuarioDePrueba('usuarios_de_sistema');
    const alPasar = await pedir('PATCH', `/usuarios/${nuevo.id}`, datosDe(nuevo, 'auxiliar', { contadores: [contadorUno.id] }));
    assert.strictEqual(alPasar.statusCode, 200, JSON.stringify(alPasar.body));
    assert.deepStrictEqual(await contadoresDe(nuevo.id), [contadorUno.id]);
  });

  test('rechaza más de un contador, una cuenta que no es contador o la propia cuenta', async () => {
    const contadorUno = await crearUsuarioDePrueba('contador');
    const contadorDos = await crearUsuarioDePrueba('contador');
    const auxiliar = await crearUsuarioDePrueba('auxiliar');
    const otroAuxiliar = await crearUsuarioDePrueba('auxiliar');
    const dos = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'auxiliar', { contadores: [contadorUno.id, contadorDos.id] }));
    assert.strictEqual(dos.statusCode, 400);
    assert.strictEqual(dos.body.mensaje, 'Un auxiliar solo puede apoyar a un contador sobre contadores: Elige un solo contador');
    const noContador = await pedir('PATCH', `/usuarios/${auxiliar.id}`, datosDe(auxiliar, 'auxiliar', { contadores: [otroAuxiliar.id] }));
    assert.strictEqual(noContador.statusCode, 400);
    assert.strictEqual(noContador.body.mensaje, 'La cuenta no es un contador sobre contadores: Elige solo cuentas con rol de contador');
    // Un contador que pasa a auxiliar no puede apoyarse a sí mismo
    const mismo = await pedir('PATCH', `/usuarios/${contadorUno.id}`, datosDe(contadorUno, 'auxiliar', { contadores: [contadorUno.id] }));
    assert.strictEqual(mismo.statusCode, 400);
    assert.strictEqual((await cuentaEnBd(contadorUno.id)).rol, 'contador');
    assert.deepStrictEqual(await contadoresDe(auxiliar.id), []);
  });

  test('al cambiar el rol se cierran las sesiones de la cuenta; al cambiar solo el nombre, no', async () => {
    const cuenta = await crearUsuarioDePrueba('contador');
    const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
    await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'contador', { nombre: nombreDePrueba() }));
    assert.strictEqual((await pedir('GET', '/auth/perfil', undefined, token)).statusCode, 200, 'sigue con sesión');
    await pedir('PATCH', `/usuarios/${cuenta.id}`, datosDe(cuenta, 'auxiliar'));
    assert.strictEqual((await pedir('GET', '/auth/perfil', undefined, token)).statusCode, 401, 'debe volver a entrar');
  });
});
