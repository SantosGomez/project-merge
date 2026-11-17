const test = require('node:test');
const assert = require('node:assert/strict');
const { generarClave, leerVariables, reemplazarVariables, armarSql, prepararRotacion } = require('../src/utils/rotarSecretos');

const ENV = [
  '# comentario',
  'TZ=America/Matamoros',
  'DB_USER=app',
  'DB_PASSWORD=vieja1',
  'DB_ROOT_PASSWORD=vieja2',
  'JWT_SECRET=vieja3',
  'DB_ADMIN_USER=admin_wb',
  'DB_ADMIN_PASSWORD=vieja4',
  '',
].join('\n');

test('generarClave: longitud pedida, solo letras y números, y no se repite', () => {
  const a = generarClave(32);
  assert.equal(a.length, 32);
  assert.match(a, /^[A-Za-z0-9]+$/);
  assert.notEqual(a, generarClave(32));
});

test('leerVariables: ignora comentarios y líneas vacías', () => {
  assert.deepEqual(leerVariables(ENV).DB_USER, 'app');
  assert.equal(Object.hasOwn(leerVariables(ENV), '# comentario'), false);
});

test('reemplazarVariables: solo cambia las existentes y conserva el resto', () => {
  const salida = reemplazarVariables(ENV, { DB_PASSWORD: 'nueva', NO_EXISTE: 'x' });
  assert.match(salida, /^DB_PASSWORD=nueva$/m);
  assert.match(salida, /^# comentario$/m);
  assert.doesNotMatch(salida, /NO_EXISTE/);
});

test('armarSql: una sentencia por cuenta y host, con FLUSH PRIVILEGES', () => {
  const sql = armarSql([{ usuario: 'app', clave: 'abc' }]);
  assert.match(sql, /ALTER USER IF EXISTS 'app'@'%' IDENTIFIED BY 'abc';/);
  assert.match(sql, /ALTER USER IF EXISTS 'app'@'localhost' IDENTIFIED BY 'abc';/);
  assert.match(sql, /FLUSH PRIVILEGES;/);
});

test('prepararRotacion: rota todas las claves, empareja usuarios y no devuelve secretos en `rotadas`', () => {
  const { env, sql, rotadas } = prepararRotacion(ENV);
  assert.deepEqual(rotadas.sort(), ['DB_ADMIN_PASSWORD', 'DB_PASSWORD', 'DB_ROOT_PASSWORD', 'JWT_SECRET']);
  for (const vieja of ['vieja1', 'vieja2', 'vieja3', 'vieja4']) assert.doesNotMatch(env, new RegExp(vieja));
  const nueva = leerVariables(env);
  assert.match(sql, new RegExp(`'app'@'%' IDENTIFIED BY '${nueva.DB_PASSWORD}'`));
  assert.match(sql, new RegExp(`'root'@'%' IDENTIFIED BY '${nueva.DB_ROOT_PASSWORD}'`));
  assert.match(sql, new RegExp(`'admin_wb'@'%' IDENTIFIED BY '${nueva.DB_ADMIN_PASSWORD}'`));
  assert.equal(nueva.JWT_SECRET.length, 96);
  assert.equal(nueva.DB_USER, 'app');
});
