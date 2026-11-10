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
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración: el auxiliar solo puede cambiar el estado de los casos
 * que le comparte su contador; el resto de los campos sigue siendo del dueño.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo usa y borra datos `zz_test_`.
 */

let servidor;
let dueno;
let auxiliar;
let tokenDueno;
let tokenAuxiliar;

async function casoDelDueno(datos = {}) {
  return crearCasoDePrueba(dueno.id, {
    cliente: 'zz_test caso del dueño',
    estado: 'Pendiente',
    ...datos,
  });
}

async function casoActual(casoId) {
  const [fila] = await query(
    'SELECT cliente, estado, prioridad, importante FROM casos WHERE id = ?',
    [casoId]
  );
  return fila;
}

async function patch(casoId, cuerpo, token) {
  return peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, cuerpo, token);
}

describe('el auxiliar solo cambia el estado', () => {
  before(async () => {
    await prepararBaseDeDatos();
    dueno = await crearUsuarioDePrueba('contador');
    auxiliar = await crearUsuarioDePrueba('auxiliar');
    await asignarAuxiliar(dueno.id, auxiliar.id);
    servidor = await iniciarServidor();
    tokenDueno = await iniciarSesion(servidor.puerto, dueno.correo, dueno.password);
    tokenAuxiliar = await iniciarSesion(servidor.puerto, auxiliar.correo, auxiliar.password);
  });

  after(async () => {
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('el auxiliar sí puede cambiar el estado', async () => {
    const casoId = await casoDelDueno();

    const respuesta = await patch(casoId, { estado: 'En proceso' }, tokenAuxiliar);

    assert.strictEqual(respuesta.statusCode, 200, 'el estado es editable por el auxiliar');
    assert.strictEqual((await casoActual(casoId)).estado, 'En proceso');
  });

  test('el auxiliar no puede cambiar el cliente', async () => {
    const casoId = await casoDelDueno();
    const antes = await casoActual(casoId);

    const respuesta = await patch(casoId, { cliente: 'zz_test cliente cambiado' }, tokenAuxiliar);

    assert.strictEqual(respuesta.statusCode, 403, 'el cliente es solo del dueño');
    assert.match(respuesta.body.mensaje, /solo puedes cambiar el estado/i);
    assert.strictEqual((await casoActual(casoId)).cliente, antes.cliente, 'el cliente no cambió');
  });

  test('el auxiliar no puede cambiar prioridad, fechas, textos ni importante', async () => {
    const camposAjenos = [
      { prioridad: 'Alta' },
      { fecha_inicio: '2026-11-02' },
      { fecha_vencimiento: '2026-12-01' },
      { descripcion: 'zz_test descripción' },
      { observaciones: 'zz_test observaciones' },
      { importante: true },
    ];

    for (const cuerpo of camposAjenos) {
      const casoId = await casoDelDueno();
      const respuesta = await patch(casoId, cuerpo, tokenAuxiliar);
      assert.strictEqual(
        respuesta.statusCode,
        403,
        `el campo ${Object.keys(cuerpo)[0]} queda fuera del alcance del auxiliar`
      );
    }
  });

  test('un cambio mixto de estado y otro campo no guarda nada', async () => {
    const casoId = await casoDelDueno();
    const antes = await casoActual(casoId);

    const respuesta = await patch(
      casoId,
      { estado: 'Finalizado', prioridad: 'Alta' },
      tokenAuxiliar
    );

    assert.strictEqual(respuesta.statusCode, 403, 'el cambio mixto se rechaza completo');
    const despues = await casoActual(casoId);
    assert.strictEqual(despues.estado, antes.estado, 'el estado no cambió a medias');
    assert.strictEqual(despues.prioridad, antes.prioridad, 'la prioridad no cambió a medias');
  });

  test('el dueño sigue editando todos los campos', async () => {
    const casoId = await casoDelDueno();

    const respuesta = await patch(
      casoId,
      { cliente: 'zz_test cliente del dueño editado', prioridad: 'Alta', importante: true },
      tokenDueno
    );

    assert.strictEqual(respuesta.statusCode, 200, 'el dueño conserva la edición completa');
    const despues = await casoActual(casoId);
    assert.strictEqual(despues.cliente, 'zz_test cliente del dueño editado');
    assert.strictEqual(despues.prioridad, 'Alta');
    assert.strictEqual(despues.importante, 1);
  });
});
