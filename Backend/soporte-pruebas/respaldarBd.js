/**
 * Respaldo cifrado de la base de datos (sin dependencias).
 *
 * Uso (desde la raíz del proyecto):
 *   RESPALDO_FRASE="frase larga y secreta" node Backend/soporte-pruebas/respaldarBd.js
 *
 * - Ejecuta `mariadb-dump` DENTRO del contenedor `db` (docker compose exec); la contraseña la lee
 *   el contenedor de su propio entorno, así que nunca aparece en los argumentos del proceso.
 * - Cifra con AES-256-GCM; la clave se deriva con scrypt de la frase en `RESPALDO_FRASE`.
 * - Escribe el archivo `.sql.cifrado` FUERA del proyecto: `RESPALDO_CARPETA` o, por omisión,
 *   `~/respaldos-seguimiento-proyectos`.
 * Para descifrar o restaurar: `restaurarBd.js`.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const MAGIA = Buffer.from('DGRB1');
const LONGITUD_SAL = 16;
const LONGITUD_IV = 12;
const LONGITUD_ETIQUETA = 16;
const LONGITUD_MINIMA_FRASE = 12;
const PARAMETROS_SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derivarClave(frase, sal) {
  return crypto.scryptSync(frase, sal, 32, PARAMETROS_SCRYPT);
}

function validarFrase(frase) {
  if (typeof frase !== 'string' || frase.length < LONGITUD_MINIMA_FRASE) {
    throw new Error(
      `Falta RESPALDO_FRASE o es muy corta. Define una frase de al menos ${LONGITUD_MINIMA_FRASE} caracteres en la variable de entorno RESPALDO_FRASE.`,
    );
  }
}

/**
 * Cifra un búfer con AES-256-GCM.
 * Formato: magia(5) | sal(16) | iv(12) | etiqueta(16) | texto cifrado.
 * @param {Buffer} datos - contenido en claro.
 * @param {string} frase - frase de cifrado.
 * @returns {Buffer} contenido cifrado.
 */
function cifrar(datos, frase) {
  validarFrase(frase);
  const sal = crypto.randomBytes(LONGITUD_SAL);
  const iv = crypto.randomBytes(LONGITUD_IV);
  const cifrador = crypto.createCipheriv('aes-256-gcm', derivarClave(frase, sal), iv);
  cifrador.setAAD(MAGIA);
  const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()]);
  return Buffer.concat([MAGIA, sal, iv, cifrador.getAuthTag(), cifrado]);
}

/**
 * Descifra un búfer producido por `cifrar`. Lanza error si la frase es otra o si se alteró un byte.
 * @param {Buffer} paquete - contenido cifrado.
 * @param {string} frase - frase de cifrado.
 * @returns {Buffer} contenido en claro.
 */
function descifrar(paquete, frase) {
  validarFrase(frase);
  const inicioCifrado = MAGIA.length + LONGITUD_SAL + LONGITUD_IV + LONGITUD_ETIQUETA;
  if (paquete.length < inicioCifrado || !paquete.subarray(0, MAGIA.length).equals(MAGIA)) {
    throw new Error('El archivo no es un respaldo cifrado válido.');
  }
  let pos = MAGIA.length;
  const sal = paquete.subarray(pos, (pos += LONGITUD_SAL));
  const iv = paquete.subarray(pos, (pos += LONGITUD_IV));
  const etiqueta = paquete.subarray(pos, (pos += LONGITUD_ETIQUETA));
  const descifrador = crypto.createDecipheriv('aes-256-gcm', derivarClave(frase, sal), iv);
  descifrador.setAAD(MAGIA);
  descifrador.setAuthTag(etiqueta);
  try {
    return Buffer.concat([descifrador.update(paquete.subarray(pos)), descifrador.final()]);
  } catch {
    throw new Error('No se pudo descifrar: la frase es incorrecta o el respaldo está alterado.');
  }
}

/** Carpeta de destino: fuera del proyecto, configurable con RESPALDO_CARPETA. */
function carpetaDeRespaldos(entorno = process.env) {
  return entorno.RESPALDO_CARPETA || path.join(os.homedir(), 'respaldos-seguimiento-proyectos');
}

function nombreDeRespaldo(fecha = new Date()) {
  const dos = (n) => String(n).padStart(2, '0');
  const sello = `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}-${dos(fecha.getHours())}${dos(fecha.getMinutes())}`;
  return `respaldo-${sello}.sql.cifrado`;
}

/** Ejecuta mariadb-dump dentro del contenedor db; las credenciales las toma de su entorno. */
function volcarBd(raizProyecto) {
  const resultado = spawnSync(
    'docker',
    [
      'compose', 'exec', '-T', 'db', 'sh', '-c',
      'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb-dump -u root --single-transaction --routines --events "$MARIADB_DATABASE"',
    ],
    { cwd: raizProyecto, maxBuffer: 1024 * 1024 * 1024 },
  );
  if (resultado.error || resultado.status !== 0) {
    throw new Error(`No se pudo volcar la base (¿está el contenedor db en marcha?): ${resultado.stderr || resultado.error}`);
  }
  return resultado.stdout;
}

function principal() {
  const frase = process.env.RESPALDO_FRASE;
  validarFrase(frase);
  const raiz = path.resolve(__dirname, '..', '..');
  const carpeta = path.resolve(carpetaDeRespaldos());
  if (carpeta === raiz || carpeta.startsWith(raiz + path.sep)) {
    throw new Error('La carpeta de respaldos no puede estar dentro del proyecto.');
  }
  fs.mkdirSync(carpeta, { recursive: true, mode: 0o700 });
  const volcado = volcarBd(raiz);
  const destino = path.join(carpeta, nombreDeRespaldo());
  fs.writeFileSync(destino, cifrar(volcado, frase), { mode: 0o600 });
  console.log(`Respaldo cifrado escrito en: ${destino}`);
}

if (require.main === module) {
  try {
    principal();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { cifrar, descifrar, carpetaDeRespaldos, nombreDeRespaldo };
