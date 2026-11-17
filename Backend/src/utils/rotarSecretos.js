const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Variables del .env de la raíz que se rotan: contraseñas de BD y secreto del JWT.
const VARIABLES_DE_CLAVE = ['DB_PASSWORD', 'DB_ROOT_PASSWORD', 'DB_ADMIN_PASSWORD', 'DB_LECTURA_PASSWORD'];
// Cada contraseña pertenece a la cuenta que nombra la variable de usuario (root siempre es «root»).
const USUARIO_DE_CLAVE = {
  DB_PASSWORD: 'DB_USER',
  DB_ROOT_PASSWORD: null,
  DB_ADMIN_PASSWORD: 'DB_ADMIN_USER',
  DB_LECTURA_PASSWORD: 'DB_LECTURA_USER',
};
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Genera una contraseña aleatoria solo con letras y números (segura dentro de SQL y de .env).
 * @param {number} [longitud=32] - cantidad de caracteres.
 * @returns {string} contraseña.
 */
function generarClave(longitud = 32) {
  let clave = '';
  for (let i = 0; i < longitud; i += 1) {
    clave += ALFABETO[crypto.randomInt(ALFABETO.length)];
  }
  return clave;
}

/**
 * Lee las variables `NOMBRE=valor` de un .env (ignora comentarios y líneas vacías).
 * @param {string} contenido - texto del .env.
 * @returns {Object<string, string>} variables.
 */
function leerVariables(contenido) {
  const variables = {};
  for (const linea of contenido.split(/\r?\n/)) {
    const coincide = /^([A-Z0-9_]+)=(.*)$/.exec(linea);
    if (coincide) variables[coincide[1]] = coincide[2];
  }
  return variables;
}

/**
 * Cambia el valor de las variables dadas dejando intactos los comentarios y el resto de líneas.
 * Solo reemplaza las que ya existen en el .env: nunca agrega variables nuevas.
 * @param {string} contenido - texto del .env.
 * @param {Object<string, string>} nuevos - valores nuevos por nombre.
 * @returns {string} texto del .env actualizado.
 */
function reemplazarVariables(contenido, nuevos) {
  return contenido
    .split('\n')
    .map((linea) => {
      const coincide = /^([A-Z0-9_]+)=/.exec(linea);
      return coincide && Object.hasOwn(nuevos, coincide[1]) ? `${coincide[1]}=${nuevos[coincide[1]]}` : linea;
    })
    .join('\n');
}

/**
 * Arma el SQL que cambia la contraseña de cada cuenta de la base (para correr como root, antes de
 * reiniciar el backend). `IF EXISTS` evita error si la cuenta no existe; se cubren los hosts % y localhost.
 * @param {Array<{usuario: string, clave: string}>} cuentas - cuentas y su contraseña nueva.
 * @returns {string} sentencias SQL.
 */
function armarSql(cuentas) {
  const sentencias = ['-- Rotación de contraseñas. Correr como root; luego actualizar el .env y reiniciar el backend.'];
  for (const { usuario, clave } of cuentas) {
    for (const host of ['%', 'localhost']) {
      sentencias.push(`ALTER USER IF EXISTS '${usuario}'@'${host}' IDENTIFIED BY '${clave}';`);
    }
  }
  sentencias.push('FLUSH PRIVILEGES;');
  return `${sentencias.join('\n')}\n`;
}

/**
 * Genera las claves nuevas y las devuelve junto con el .env actualizado y el SQL.
 * @param {string} contenidoEnv - texto del .env actual.
 * @returns {{ env: string, sql: string, rotadas: string[] }} resultado; `rotadas` solo lista nombres de variables.
 */
function prepararRotacion(contenidoEnv) {
  const actuales = leerVariables(contenidoEnv);
  const nuevos = {};
  const cuentas = [];
  for (const variable of VARIABLES_DE_CLAVE) {
    if (!Object.hasOwn(actuales, variable)) continue;
    nuevos[variable] = generarClave();
    const variableUsuario = USUARIO_DE_CLAVE[variable];
    const usuario = variableUsuario ? actuales[variableUsuario] : 'root';
    if (usuario) cuentas.push({ usuario, clave: nuevos[variable] });
  }
  if (Object.hasOwn(actuales, 'JWT_SECRET')) {
    nuevos.JWT_SECRET = crypto.randomBytes(48).toString('hex');
  }
  return { env: reemplazarVariables(contenidoEnv, nuevos), sql: armarSql(cuentas), rotadas: Object.keys(nuevos) };
}

/**
 * Uso: node src/utils/rotarSecretos.js [ruta-del-.env] [carpeta-de-salida]
 * Escribe `.env.nuevo` y `rotar-claves.sql` FUERA del proyecto (por defecto en tu carpeta de usuario)
 * y nunca muestra una clave en pantalla ni toca el .env actual.
 */
function main() {
  const rutaEnv = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', '.env'));
  const salida = path.resolve(
    process.argv[3] || path.join(os.homedir(), `rotacion-secretos-${new Date().toISOString().slice(0, 10)}`)
  );
  const { env, sql, rotadas } = prepararRotacion(fs.readFileSync(rutaEnv, 'utf8'));
  fs.mkdirSync(salida, { recursive: true });
  fs.writeFileSync(path.join(salida, '.env.nuevo'), env, { mode: 0o600 });
  fs.writeFileSync(path.join(salida, 'rotar-claves.sql'), sql, { mode: 0o600 });
  // eslint-disable-next-line no-console
  console.log(`Claves nuevas para: ${rotadas.join(', ')}\nArchivos en: ${salida}`);
}

if (require.main === module) main();

module.exports = { generarClave, leerVariables, reemplazarVariables, armarSql, prepararRotacion };
