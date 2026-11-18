const assert = require('node:assert');
const { describe, test } = require('node:test');
const {
  esSecretaria,
  permisosDeJunta,
  puedeVerCompleta,
  veAgendaCompleta,
  resolverRespuestaEnNombre,
} = require('../src/utils/accesoJuntas');

/**
 * Pruebas de la regla pura de la recepcionista como secretaria de los administradores (rebanada 27).
 * No necesitan base de datos.
 */

const recepcionista = { id: 1, rol: 'recepcionista' };
const administrador = { id: 2, rol: 'administrador' };
const contador = { id: 3, rol: 'contador' };
const auxiliar = { id: 4, rol: 'auxiliar' };

const adminInvitado = { id: 20, nombre: 'Admin invitado', rol: 'administrador', respuesta: 'aceptada' };
const adminPendiente = { id: 21, nombre: 'Admin pendiente', rol: 'administrador', respuesta: 'pendiente' };
const contadorInvitado = { id: 30, nombre: 'Contador invitado', rol: 'contador', respuesta: 'pendiente' };

function junta(organizadorId, organizadorRol, participantes = []) {
  return { organizadorId, organizadorRol, participantes };
}

describe('esSecretaria', () => {
  test('solo la recepcionista actúa como secretaria', () => {
    assert.strictEqual(esSecretaria(recepcionista), true);
    for (const otro of [administrador, contador, auxiliar, { id: 5, rol: 'usuarios_de_sistema' }]) {
      assert.strictEqual(esSecretaria(otro), false);
    }
  });
});

describe('permisosDeJunta', () => {
  test('la recepcionista edita las juntas que organiza un administrador y responde por los administradores invitados', () => {
    const permisos = permisosDeJunta(recepcionista, junta(99, 'administrador', [adminInvitado, contadorInvitado]));
    assert.strictEqual(permisos.puede_editar, true);
    assert.deepStrictEqual(permisos.responder_por, [{ id: 20, nombre: 'Admin invitado', respuesta: 'aceptada' }]);
  });

  test('en una junta de contador con un administrador invitado solo puede responder por él, no editarla', () => {
    const permisos = permisosDeJunta(recepcionista, junta(98, 'contador', [adminPendiente]));
    assert.strictEqual(permisos.puede_editar, false);
    assert.deepStrictEqual(permisos.responder_por, [{ id: 21, nombre: 'Admin pendiente', respuesta: 'pendiente' }]);
  });

  test('en juntas de contadores o auxiliares sin administradores no tiene ningún permiso', () => {
    for (const rol of ['contador', 'auxiliar']) {
      const permisos = permisosDeJunta(recepcionista, junta(97, rol, [contadorInvitado]));
      assert.strictEqual(permisos.puede_editar, false);
      assert.deepStrictEqual(permisos.responder_por, []);
    }
  });

  test('quien organiza puede editar; los demás roles nunca responden por nadie', () => {
    assert.strictEqual(permisosDeJunta(contador, junta(3, 'contador', [adminInvitado])).puede_editar, true);
    assert.strictEqual(permisosDeJunta(recepcionista, junta(1, 'recepcionista')).puede_editar, true);
    for (const usuario of [administrador, contador, auxiliar]) {
      const permisos = permisosDeJunta(usuario, junta(99, 'administrador', [adminInvitado]));
      assert.deepStrictEqual(permisos.responder_por, []);
    }
    assert.strictEqual(permisosDeJunta(contador, junta(99, 'administrador', [contadorInvitado])).puede_editar, false);
    assert.strictEqual(permisosDeJunta(administrador, junta(99, 'administrador', [])).puede_editar, false);
  });
});

describe('puedeVerCompleta', () => {
  const base = { soy_organizador: false, participantes: [], puede_editar: false, responder_por: [] };

  test('ven completa quien organiza, quien está invitado y la secretaria de una junta de administrador', () => {
    assert.strictEqual(puedeVerCompleta(contador, { ...base, soy_organizador: true }), true);
    assert.strictEqual(puedeVerCompleta(contador, { ...base, participantes: [contadorInvitado, { id: 3 }] }), true);
    assert.strictEqual(puedeVerCompleta(recepcionista, { ...base, puede_editar: true }), true);
    assert.strictEqual(
      puedeVerCompleta(recepcionista, { ...base, responder_por: [{ id: 20, nombre: 'A', respuesta: 'pendiente' }] }),
      true
    );
  });

  test('quien no participa no la ve, ni siquiera siendo contador de una junta privada de un administrador', () => {
    assert.strictEqual(puedeVerCompleta(contador, { ...base, participantes: [contadorInvitado] }), false);
    assert.strictEqual(puedeVerCompleta(recepcionista, base), false);
  });
});

describe('veAgendaCompleta', () => {
  test('solo la recepcionista que consulta la agenda de un administrador la ve completa', () => {
    assert.strictEqual(veAgendaCompleta(recepcionista, 'administrador'), true);
    assert.strictEqual(veAgendaCompleta(recepcionista, 'contador'), false);
    assert.strictEqual(veAgendaCompleta(recepcionista, 'auxiliar'), false);
    assert.strictEqual(veAgendaCompleta(contador, 'administrador'), false);
    assert.strictEqual(veAgendaCompleta(administrador, 'administrador'), false);
  });
});

describe('resolverRespuestaEnNombre', () => {
  const invitados = [adminInvitado, contadorInvitado];

  test('la recepcionista responde por un administrador invitado', () => {
    assert.deepStrictEqual(resolverRespuestaEnNombre(recepcionista, invitados, 20), { participante: adminInvitado });
    assert.deepStrictEqual(resolverRespuestaEnNombre(recepcionista, invitados, '20'), { participante: adminInvitado });
  });

  test('un administrador que no está invitado o un invitado que no es administrador dan «no invitado»', () => {
    assert.deepStrictEqual(resolverRespuestaEnNombre(recepcionista, invitados, 21), { error: 'no_invitado' });
    assert.deepStrictEqual(resolverRespuestaEnNombre(recepcionista, invitados, 30), { error: 'no_invitado' });
  });

  test('un valor que no es un id da «inválido»', () => {
    for (const valor of [null, 'abc', -1, 1.5, {}, [20], true, '']) {
      assert.deepStrictEqual(resolverRespuestaEnNombre(recepcionista, invitados, valor), { error: 'invalido' });
    }
  });

  test('cualquier otro rol que envíe en_nombre_de recibe «prohibido»', () => {
    for (const usuario of [administrador, contador, auxiliar]) {
      assert.deepStrictEqual(resolverRespuestaEnNombre(usuario, invitados, 20), { error: 'prohibido' });
    }
  });
});
