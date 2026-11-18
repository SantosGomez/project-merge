const assert = require('node:assert');
const { describe, test } = require('node:test');
const { calcularEstado, fechaYHoraDeAviso, mensajeDeInvitacion } = require('../src/utils/estadoJunta');

/**
 * Pruebas unitarias de la regla de estado de las juntas (rebanada 22): sin base de datos.
 */

const p = (rol, respuesta) => ({ rol, respuesta });

describe('calcularEstado', () => {
  test('sin administradores invitados la junta está confirmada, respondan lo que respondan', () => {
    assert.strictEqual(calcularEstado([p('contador', 'pendiente')]), 'confirmada');
    assert.strictEqual(calcularEstado([p('contador', 'rechazada'), p('auxiliar', 'pendiente')]), 'confirmada');
    assert.strictEqual(calcularEstado([]), 'confirmada');
  });

  test('con un administrador pendiente queda por confirmar', () => {
    assert.strictEqual(calcularEstado([p('administrador', 'pendiente'), p('contador', 'aceptada')]), 'por_confirmar');
  });

  test('cuando todos los administradores aceptan queda confirmada', () => {
    assert.strictEqual(calcularEstado([p('administrador', 'aceptada'), p('contador', 'pendiente')]), 'confirmada');
    assert.strictEqual(calcularEstado([p('administrador', 'aceptada'), p('administrador', 'aceptada')]), 'confirmada');
  });

  test('si algún administrador rechaza queda cancelada, aunque otro siga pendiente', () => {
    assert.strictEqual(calcularEstado([p('administrador', 'rechazada'), p('administrador', 'pendiente')]), 'cancelada');
    assert.strictEqual(calcularEstado([p('administrador', 'rechazada'), p('administrador', 'aceptada')]), 'cancelada');
  });

  test('con dos administradores, uno que acepta y otro pendiente sigue por confirmar', () => {
    assert.strictEqual(calcularEstado([p('administrador', 'aceptada'), p('administrador', 'pendiente')]), 'por_confirmar');
  });
});

describe('textos de aviso', () => {
  test('fechaYHoraDeAviso pasa AAAA-MM-DD HH:mm:ss a DD-MM-AAAA y HH:mm sin usar Date', () => {
    assert.deepStrictEqual(fechaYHoraDeAviso('2031-03-09 08:05:00'), { fecha: '09-03-2031', hora: '08:05' });
  });

  test('mensajeDeInvitacion lleva organizador, título, fecha y hora', () => {
    assert.strictEqual(
      mensajeDeInvitacion('Ana', 'Cierre', '2031-03-09 08:05:00'),
      'Ana te invitó a «Cierre» el 09-03-2031 a las 08:05'
    );
  });
});
