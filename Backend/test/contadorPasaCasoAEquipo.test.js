const assert = require('node:assert');
const { describe, test, before, after, mock } = require('node:test');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  crearCasoDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');
const { eventos } = require('../src/utils/eventos');
const { query } = require('../src/config/db');

/**
 * Pruebas de integración: el contador pasa un caso existente dentro de su equipo
 * (PATCH /casos/:id/responsable). Requiere MariaDB en marcha (XAMPP, puerto 3306).
 * Solo crea y borra datos `zz_test_` de este proceso.
 */

let servidor;
let contador;
let auxiliarA;
let auxiliarB;
let otroContador;
let auxiliarAjeno;
let administrador;
let recepcionista;
let sistema;
let tokenContador;

const filaDelCaso = async (id) => (await query('SELECT * FROM casos WHERE id = ?', [id]))[0];
const avisosDe = (usuarioId) => query('SELECT caso_id, mensaje, leida FROM notificaciones WHERE usuario_id = ? ORDER BY id', [usuarioId]);
const pasar = (id, cuerpo, token = tokenContador) =>
  peticion(servidor.puerto, 'PATCH', `/casos/${id}/responsable`, cuerpo, token);

/** Crea un caso con datos poco comunes (importante, en proceso, observaciones) para detectar cambios colaterales. */
async function crearCasoCompleto(duenioId, cliente) {
  const id = await crearCasoDePrueba(duenioId, { cliente, estado: 'En proceso', prioridad: 'Alta' });
  await query(
    "UPDATE casos SET importante = 1, observaciones = 'zz_test obs', descripcion = 'zz_test desc', fecha_inicio = '2026-11-02', fecha_vencimiento = '2026-11-25' WHERE id = ?",
    [id]
  );
  return id;
}

describe('el contador pasa un caso a su equipo', () => {
  before(async () => {
    await prepararBaseDeDatos();
    contador = await crearUsuarioDePrueba('contador');
    auxiliarA = await crearUsuarioDePrueba('auxiliar');
    auxiliarB = await crearUsuarioDePrueba('auxiliar');
    otroContador = await crearUsuarioDePrueba('contador');
    auxiliarAjeno = await crearUsuarioDePrueba('auxiliar');
    administrador = await crearUsuarioDePrueba('administrador');
    recepcionista = await crearUsuarioDePrueba('recepcionista');
    sistema = await crearUsuarioDePrueba('usuarios_de_sistema');
    await asignarAuxiliar(contador.id, auxiliarA.id);
    await asignarAuxiliar(contador.id, auxiliarB.id);
    await asignarAuxiliar(otroContador.id, auxiliarAjeno.id);
    servidor = await iniciarServidor();
    tokenContador = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
  });

  after(async () => {
    mock.restoreAll();
    await servidor.cerrar();
    await limpiarDatosDePrueba();
    await cerrarBaseDeDatos();
  });

  test('pasa un caso propio a un auxiliar: solo cambia contador_id y avisa al que lo recibe', async () => {
    const id = await crearCasoCompleto(contador.id, 'zz_test caso propio');
    const antes = await filaDelCaso(id);
    const aUsuario = mock.method(eventos, 'enviarAUsuario', () => {});
    const aRol = mock.method(eventos, 'enviarARol', () => {});

    const respuesta = await pasar(id, { responsable_id: auxiliarA.id });

    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    assert.strictEqual(respuesta.body.mensaje, 'Caso pasado correctamente');
    assert.strictEqual(respuesta.body.caso.id, id);
    assert.strictEqual(respuesta.body.caso.contador_id, auxiliarA.id);

    const despues = await filaDelCaso(id);
    const { contador_id: _c1, actualizado_en: _a1, ...restoAntes } = antes;
    const { contador_id: _c2, actualizado_en: _a2, ...restoDespues } = despues;
    assert.strictEqual(despues.contador_id, auxiliarA.id);
    assert.deepStrictEqual(restoDespues, restoAntes, 'ningún otro campo cambia');
    assert.strictEqual(despues.importante, 1, 'la marca Importante se conserva');

    const avisos = await avisosDe(auxiliarA.id);
    assert.strictEqual(avisos.length, 1);
    assert.strictEqual(avisos[0].caso_id, id);
    assert.strictEqual(avisos[0].mensaje, `${contador.nombre} te pasó el caso «zz_test caso propio».`);
    assert.strictEqual((await avisosDe(contador.id)).length, 0, 'el contador no se avisa a sí mismo');

    assert.ok(aUsuario.mock.calls.some((c) => c.arguments[0] === auxiliarA.id && c.arguments[1] === 'aviso-nuevo'));
    assert.ok(aRol.mock.calls.some((c) => c.arguments[0] === 'administrador' && c.arguments[1] === 'caso-actualizado'));
    mock.restoreAll();
  });

  test('mueve un caso de un auxiliar a otro: avisa a quien lo recibe y a quien lo pierde', async () => {
    const id = await crearCasoCompleto(auxiliarA.id, 'zz_test caso entre auxiliares');
    const avisosAAntes = (await avisosDe(auxiliarA.id)).length;
    const aUsuario = mock.method(eventos, 'enviarAUsuario', () => {});

    const respuesta = await pasar(id, { responsable_id: auxiliarB.id });
    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    assert.strictEqual((await filaDelCaso(id)).contador_id, auxiliarB.id);

    const recibe = await avisosDe(auxiliarB.id);
    assert.strictEqual(recibe.at(-1).mensaje, `${contador.nombre} te pasó el caso «zz_test caso entre auxiliares».`);
    const pierde = await avisosDe(auxiliarA.id);
    assert.strictEqual(pierde.length, avisosAAntes + 1);
    assert.strictEqual(pierde.at(-1).caso_id, id);
    assert.strictEqual(
      pierde.at(-1).mensaje,
      `${contador.nombre} te quitó el caso «zz_test caso entre auxiliares» y se lo pasó a ${auxiliarB.nombre}.`
    );
    const destinatarios = aUsuario.mock.calls.filter((c) => c.arguments[1] === 'aviso-nuevo').map((c) => c.arguments[0]);
    assert.ok(destinatarios.includes(auxiliarA.id) && destinatarios.includes(auxiliarB.id), 'SSE a ambos');
    mock.restoreAll();
  });

  test('regresa un caso del auxiliar al contador: avisa solo al auxiliar, con texto «a su lista»', async () => {
    const id = await crearCasoCompleto(auxiliarB.id, 'zz_test caso regresado');
    const avisosContadorAntes = (await avisosDe(contador.id)).length;

    const respuesta = await pasar(id, { responsable_id: contador.id });
    assert.strictEqual(respuesta.statusCode, 200, JSON.stringify(respuesta.body));
    assert.strictEqual((await filaDelCaso(id)).contador_id, contador.id);

    const pierde = await avisosDe(auxiliarB.id);
    assert.strictEqual(
      pierde.at(-1).mensaje,
      `${contador.nombre} te quitó el caso «zz_test caso regresado» y lo regresó a su lista.`
    );
    assert.strictEqual((await avisosDe(contador.id)).length, avisosContadorAntes, 'el contador no recibe aviso');
  });

  test('si el nuevo dueño ya es el dueño actual responde 400 y no avisa', async () => {
    const propio = await crearCasoDePrueba(contador.id, { cliente: 'zz_test mismo dueño propio' });
    const delAuxiliar = await crearCasoDePrueba(auxiliarA.id, { cliente: 'zz_test mismo dueño auxiliar' });
    const avisosAntes = (await avisosDe(auxiliarA.id)).length;

    const r1 = await pasar(propio, { responsable_id: contador.id });
    assert.strictEqual(r1.statusCode, 400);
    assert.ok(r1.body.mensaje.includes('El caso ya es de esa persona'), r1.body.mensaje);
    const r2 = await pasar(delAuxiliar, { responsable_id: auxiliarA.id });
    assert.strictEqual(r2.statusCode, 400);
    assert.strictEqual((await avisosDe(auxiliarA.id)).length, avisosAntes);
  });

  test('un destino fuera del equipo responde 400 sobre «responsable» y no cambia nada', async () => {
    const id = await crearCasoDePrueba(contador.id, { cliente: 'zz_test destino ajeno' });
    const destinos = [otroContador.id, auxiliarAjeno.id, administrador.id, 99999999, 'abc', '1 OR 1=1', undefined, null, {}, [1], -1];
    for (const responsable_id of destinos) {
      const respuesta = await pasar(id, { responsable_id });
      assert.strictEqual(respuesta.statusCode, 400, `responsable_id ${JSON.stringify(responsable_id)}`);
      assert.ok(respuesta.body.mensaje.includes('responsable'), respuesta.body.mensaje);
    }
    assert.strictEqual((await filaDelCaso(id)).contador_id, contador.id);
    assert.strictEqual((await avisosDe(auxiliarAjeno.id)).length, 0);
  });

  test('un caso de otro contador o de un auxiliar ajeno responde 404 y no cambia', async () => {
    const deOtro = await crearCasoDePrueba(otroContador.id, { cliente: 'zz_test caso ajeno' });
    const deAuxiliarAjeno = await crearCasoDePrueba(auxiliarAjeno.id, { cliente: 'zz_test caso de auxiliar ajeno' });
    for (const id of [deOtro, deAuxiliarAjeno, 99999999, 'abc']) {
      const respuesta = await pasar(id, { responsable_id: auxiliarA.id });
      assert.strictEqual(respuesta.statusCode, 404, `caso ${id}`);
      assert.ok(respuesta.body.mensaje.includes('No se encontró el caso'), respuesta.body.mensaje);
    }
    assert.strictEqual((await filaDelCaso(deOtro)).contador_id, otroContador.id);
    assert.strictEqual((await filaDelCaso(deAuxiliarAjeno)).contador_id, auxiliarAjeno.id);
  });

  test('auxiliar, administrador, recepcionista y sistema no pueden usar la ruta (403)', async () => {
    const id = await crearCasoDePrueba(auxiliarA.id, { cliente: 'zz_test sin permiso' });
    for (const cuenta of [auxiliarA, administrador, recepcionista, sistema]) {
      const token = await iniciarSesion(servidor.puerto, cuenta.correo, cuenta.password);
      const respuesta = await pasar(id, { responsable_id: contador.id }, token);
      assert.strictEqual(respuesta.statusCode, 403, cuenta.nombre);
    }
    assert.strictEqual((await filaDelCaso(id)).contador_id, auxiliarA.id);
  });

  test('sin sesión responde 401', async () => {
    const respuesta = await pasar(1, { responsable_id: contador.id }, null);
    assert.strictEqual(respuesta.statusCode, 401);
  });

  const CaseModel = require('../src/models/CaseModel');
  const AuxiliarModel = require('../src/models/AuxiliarModel');

  test('cambiarResponsable no cambia nada si el dueño anterior ya no es el leído', async () => {
    const id = await crearCasoDePrueba(contador.id, { cliente: 'zz_test dueño desactualizado' });
    const cambio = await CaseModel.cambiarResponsable(id, {
      anteriorId: auxiliarA.id,
      nuevoId: contador.id,
      contadorId: contador.id,
    });
    assert.strictEqual(cambio, false);
    assert.strictEqual((await filaDelCaso(id)).contador_id, contador.id);
  });

  test('cambiarResponsable no cambia nada si el destino ya no es auxiliar del contador', async () => {
    const id = await crearCasoDePrueba(contador.id, { cliente: 'zz_test destino desvinculado' });
    await query('DELETE FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?', [contador.id, auxiliarA.id]);
    try {
      const cambio = await CaseModel.cambiarResponsable(id, {
        anteriorId: contador.id,
        nuevoId: auxiliarA.id,
        contadorId: contador.id,
      });
      assert.strictEqual(cambio, false);
      assert.strictEqual((await filaDelCaso(id)).contador_id, contador.id);
    } finally {
      await asignarAuxiliar(contador.id, auxiliarA.id);
    }
  });

  test('cambiarResponsable cambia solo si todo coincide y lo dice', async () => {
    const id = await crearCasoDePrueba(contador.id, { cliente: 'zz_test cambio válido' });
    const cambio = await CaseModel.cambiarResponsable(id, {
      anteriorId: contador.id,
      nuevoId: auxiliarA.id,
      contadorId: contador.id,
    });
    assert.strictEqual(cambio, true);
    assert.strictEqual((await filaDelCaso(id)).contador_id, auxiliarA.id);
  });

  test('si el equipo cambió entre la lectura y el UPDATE responde 409 sin avisos ni SSE', async () => {
    const id = await crearCasoDePrueba(contador.id, { cliente: 'zz_test carrera' });
    const avisosAntes = (await avisosDe(auxiliarA.id)).length;
    // La lectura del equipo aún ve al auxiliar, pero ya no está vinculado en la base
    const equipoViejo = [{ id: auxiliarA.id, nombre: auxiliarA.nombre }];
    mock.method(AuxiliarModel, 'listarAuxiliares', async () => equipoViejo);
    await query('DELETE FROM contador_auxiliar WHERE contador_id = ? AND auxiliar_id = ?', [contador.id, auxiliarA.id]);
    const aUsuario = mock.method(eventos, 'enviarAUsuario', () => {});
    const aRol = mock.method(eventos, 'enviarARol', () => {});
    try {
      const respuesta = await peticion(servidor.puerto, 'PATCH', `/casos/${id}/responsable`, { responsable_id: auxiliarA.id }, tokenContador);
      assert.strictEqual(respuesta.statusCode, 409, JSON.stringify(respuesta.body));
      assert.ok(respuesta.body.mensaje.includes('El caso cambió mientras lo pasabas'), respuesta.body.mensaje);
      assert.strictEqual((await filaDelCaso(id)).contador_id, contador.id);
      assert.strictEqual((await avisosDe(auxiliarA.id)).length, avisosAntes);
      assert.strictEqual(aUsuario.mock.calls.length, 0);
      assert.strictEqual(aRol.mock.calls.length, 0);
    } finally {
      mock.restoreAll();
      await asignarAuxiliar(contador.id, auxiliarA.id);
    }
  });
});
