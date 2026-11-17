const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { archivoProhibido, lineaSospechosa, revisarDiff } = require('../../.githooks/detectarSecretos');

test('rechaza archivos .env, .sql y de cuentas locales; permite .env.example', () => {
  for (const ruta of ['.env', 'Backend/.env', '.env.production', 'respaldo.sql', 'a/b/volcado.SQL', 'cuentas.local.json', 'x/otra.local.json', 'llave.pem', 'r.sql.cifrado']) {
    assert.ok(archivoProhibido(ruta), ruta);
  }
  for (const ruta of ['.env.example', 'Backend/src/app.js', 'docs/seguridad-despliegue.md', 'package.json']) {
    assert.equal(archivoProhibido(ruta), null, ruta);
  }
});

test('detecta JWT_SECRET, PASSWORD y RESPALDO_FRASE con valor', () => {
  assert.ok(lineaSospechosa('JWT_SECRET=abc123def456'));
  assert.ok(lineaSospechosa('  export DB_ROOT_PASSWORD=Valor_real9'));
  assert.ok(lineaSospechosa('PASSWORD="otra clave"'));
  assert.ok(lineaSospechosa('RESPALDO_FRASE=mi-frase-larga'));
  assert.ok(lineaSospechosa('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(lineaSospechosa('-----BEGIN PRIVATE KEY-----'));
});

test('no marca plantillas, referencias ni líneas sin valor', () => {
  for (const linea of [
    'JWT_SECRET=',
    'DB_PASSWORD=cambiar_por_una_clave_larga',
    'JWT_SECRET=generar_con_el_comando_de_arriba',
    'JWT_SECRET: ${JWT_SECRET:?Defina JWT_SECRET en .env}',
    'DB_PASSWORD=${DB_PASSWORD}',
    'RESPALDO_FRASE=<tu frase>',
    'const password = req.body.password;',
    'MI_PASSWORD_HASH = x',
    'DB_PASSWORD=zzTest123 // hook:permitir-secreto',
  ]) {
    assert.equal(lineaSospechosa(linea), null, linea);
  }
});

test('revisarDiff solo mira líneas añadidas y reporta archivo y número de línea sin el valor', () => {
  const diff = [
    'diff --git a/x.txt b/x.txt',
    '--- a/x.txt',
    '+++ b/x.txt',
    '@@ -1,2 +5,3 @@',
    '+línea normal',
    ' contexto',
    '+JWT_SECRET=valorsecretoreal',
    '-DB_PASSWORD=borradaconvalor',
  ].join('\n');
  const hallazgos = revisarDiff(diff);
  assert.equal(hallazgos.length, 1);
  assert.equal(hallazgos[0].archivo, 'x.txt');
  assert.equal(hallazgos[0].linea, 6);
  assert.ok(!JSON.stringify(hallazgos).includes('valorsecretoreal'));
});

test('el hook bloquea un commit con .env y deja pasar uno limpio (repositorio temporal)', () => {
  const raiz = path.resolve(__dirname, '..', '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zz_test_hook-'));
  const git = (...a) => spawnSync('git', ['-C', dir, '-c', 'user.name=zz', '-c', 'user.email=zz@zz.test', '-c', `core.hooksPath=${path.join(raiz, '.githooks')}`, ...a], { encoding: 'utf8' });
  try {
    git('init', '-q');
    fs.writeFileSync(path.join(dir, 'ok.txt'), 'hola\n');
    git('add', 'ok.txt');
    assert.equal(git('commit', '-q', '-m', 'limpio').status, 0);

    fs.writeFileSync(path.join(dir, '.env'), 'JWT_SECRET=zzvalor123\n');
    git('add', '-f', '.env');
    const malo = git('commit', '-q', '-m', 'con secreto');
    assert.notEqual(malo.status, 0);
    assert.match(malo.stderr, /Commit rechazado/);
    assert.ok(!malo.stderr.includes('zzvalor123'), 'no debe imprimir el secreto');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
