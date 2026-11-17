/**
 * Detector de secretos para el hook pre-commit (sin dependencias).
 * Funciones puras: reciben texto y devuelven hallazgos; no leen ni imprimen valores de secretos.
 */
const path = require('node:path');

// Una línea con este marcador se ignora (para datos de prueba evidentes).
const MARCADOR_PERMITIR = 'hook:permitir-secreto';

const PATRONES_LINEA = [
  {
    motivo: 'JWT_SECRET con valor',
    regex: /(?:^|[^A-Za-z0-9_])JWT_SECRET\s*=\s*(\S+)/,
    comprobarValor: true,
  },
  {
    motivo: 'contraseña (PASSWORD=) con valor',
    regex: /(?:^|[^A-Za-z0-9_])[A-Za-z0-9_]*PASSWORD\s*=\s*(\S+)/,
    comprobarValor: true,
  },
  {
    motivo: 'frase de respaldo (RESPALDO_FRASE=) con valor',
    regex: /(?:^|[^A-Za-z0-9_])RESPALDO_FRASE\s*=\s*(\S+)/,
    comprobarValor: true,
  },
  {
    motivo: 'clave privada',
    regex: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY(?: BLOCK)?-----/,
    comprobarValor: false,
  },
];

// Valores que son plantillas o referencias, no secretos reales.
const VALOR_DE_PLANTILLA = /^["']?(?:$|cambiar|generar|tu_|<|\$|…|\.{3}|x{3,}|\*{3,}|\{\{)/i;

/**
 * Indica si la ruta de un archivo no debe commitearse nunca.
 * @param {string} ruta - ruta relativa al repositorio.
 * @returns {string|null} motivo, o null si se permite.
 */
function archivoProhibido(ruta) {
  const nombre = path.posix.basename(ruta.replace(/\\/g, '/'));
  if (nombre === '.env.example') return null;
  if (nombre === '.env' || nombre.startsWith('.env.')) return 'archivo de variables de entorno (.env)';
  if (/\.sql$/i.test(nombre)) return 'volcado o respaldo de base de datos (.sql)';
  if (/\.sql\.cifrado$/i.test(nombre)) return 'respaldo de base de datos (.sql.cifrado)';
  if (nombre === 'cuentas.local.json' || /\.local\.json$/i.test(nombre)) return 'datos locales de cuentas (.local.json)';
  if (/\.(pem|key|p12|pfx)$/i.test(nombre)) return 'llave o certificado privado';
  return null;
}

/**
 * Revisa una línea de texto.
 * @param {string} linea - contenido de la línea.
 * @returns {string|null} motivo, o null si no hay nada sospechoso.
 */
function lineaSospechosa(linea) {
  if (linea.includes(MARCADOR_PERMITIR)) return null;
  for (const patron of PATRONES_LINEA) {
    const coincidencia = patron.regex.exec(linea);
    if (!coincidencia) continue;
    if (patron.comprobarValor && VALOR_DE_PLANTILLA.test(coincidencia[1])) continue;
    return patron.motivo;
  }
  return null;
}

/**
 * Revisa las líneas AÑADIDAS de un diff unificado (`git diff --cached --unified=0`).
 * @param {string} diff - texto del diff.
 * @returns {{archivo: string, linea: number, motivo: string}[]} hallazgos (sin el valor del secreto).
 */
function revisarDiff(diff) {
  const hallazgos = [];
  let archivo = '';
  let numero = 0;
  for (const texto of diff.split(/\r?\n/)) {
    if (texto.startsWith('+++ ')) {
      archivo = texto.slice(4).replace(/^b\//, '');
    } else if (texto.startsWith('@@')) {
      const m = /\+(\d+)/.exec(texto);
      numero = m ? Number(m[1]) : 0;
    } else if (texto.startsWith('+')) {
      const motivo = lineaSospechosa(texto.slice(1));
      if (motivo) hallazgos.push({ archivo, linea: numero, motivo });
      numero += 1;
    }
  }
  return hallazgos;
}

module.exports = { archivoProhibido, lineaSospechosa, revisarDiff, MARCADOR_PERMITIR };
