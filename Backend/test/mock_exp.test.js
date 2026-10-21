const assert = require('node:assert');
const test = require('node:test');

test.describe('mock CJS experiment', () => {
  test.it('mock errorUtils module', async (t) => {
    const mocked = await t.mock('../src/utils/errorUtils.js', {
      buildError: function (a, b, c) { return { mensaje: 'MOCK:' + a }; },
    });
    const { buildError } = require(mocked.exports);
    const r = buildError('hola', 'mundo', 'haz x');
    assert.strictEqual(r.mensaje, 'MOCK:hola');
    console.log('MOCK RESULT:', JSON.stringify(r));
  });
});
