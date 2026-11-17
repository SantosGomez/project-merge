/**
 * Inverso de respaldarBd.js: descifra un respaldo y lo escribe como .sql o lo restaura en la BD.
 *
 * Uso:
 *   RESPALDO_FRASE="..." node Backend/soporte-pruebas/restaurarBd.js <archivo.sql.cifrado> [--restaurar]
 *
 * Sin `--restaurar` escribe el `.sql` junto al respaldo (fuera del proyecto; guárdalo con cuidado
 * y bórralo al terminar). Con `--restaurar` envía el SQL por la entrada estándar de `mariadb` dentro del
 * contenedor db (credenciales del entorno del contenedor, nunca en argumentos). SOBRESCRIBE los datos.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { descifrar } = require('./respaldarBd');

function principal() {
  const [archivo, opcion] = process.argv.slice(2);
  if (!archivo) throw new Error('Indica el archivo .sql.cifrado a descifrar.');
  const sql = descifrar(fs.readFileSync(archivo), process.env.RESPALDO_FRASE);
  if (opcion === '--restaurar') {
    const raiz = path.resolve(__dirname, '..', '..');
    const resultado = spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'db', 'sh', '-c', 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -u root "$MARIADB_DATABASE"'],
      { cwd: raiz, input: sql, maxBuffer: 1024 * 1024 * 1024 },
    );
    if (resultado.error || resultado.status !== 0) {
      throw new Error(`No se pudo restaurar: ${resultado.stderr || resultado.error}`);
    }
    console.log('Base restaurada.');
    return;
  }
  const destino = archivo.replace(/\.cifrado$/, '');
  fs.writeFileSync(destino, sql, { mode: 0o600 });
  console.log(`Respaldo descifrado en: ${destino}`);
}

try {
  principal();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
