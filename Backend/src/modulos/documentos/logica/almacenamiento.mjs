// Dónde y cómo se guardan en disco los archivos de una recepción (adjuntos y
// acuse). La estructura sigue la de `##RECEPCION DE PAPELERIA_CLIENTES`, con un
// nivel de año para no mezclar el noviembre de un año con el del siguiente:
//
//   {clave} {razón social} / {año} / {MM MES} / {folio} / {archivo}
//   0001 ACME TRANSLOGISTICS SA DE CV / 2026 / 11 NOVIEMBRE / DCA-2026-10016 / factura.pdf
//
// El mes sale del PERIODO del documento, no del día en que se recibió.

import fs from 'node:fs/promises';
import path from 'node:path';

/** Caracteres que Windows no admite en un nombre de archivo o carpeta. */
const CARACTERES_PROHIBIDOS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** Las carpetas de mes, con el mismo nombre que las que crea el script de carpetas. */
const MESES = [
  '01 ENERO', '02 FEBRERO', '03 MARZO', '04 ABRIL', '05 MAYO', '06 JUNIO',
  '07 JULIO', '08 AGOSTO', '09 SEPTIEMBRE', '10 OCTUBRE', '11 NOVIEMBRE', '12 DICIEMBRE',
];

/**
 * Limpia un nombre para que sea seguro en disco: sin separadores de ruta ni
 * caracteres prohibidos, sin puntos ni espacios al final (Windows los descarta
 * en silencio) y nunca «.» ni «..», que apuntarían a otra carpeta.
 * @param {string} nombre - Nombre original.
 * @returns {string} Nombre saneado, nunca vacío.
 */
export const sanitizarNombreArchivo = (nombre) => {
  const limpio = String(nombre ?? '')
    .replace(CARACTERES_PROHIBIDOS, '_')
    .trim()
    .replace(/[. ]+$/, '');
  return limpio || 'archivo';
};

/**
 * Carpeta del mes a partir del periodo `AAAA-MM`.
 * @param {string} periodo
 * @returns {string} p. ej. `11 NOVIEMBRE`.
 */
export const carpetaDeMes = (periodo) => {
  const coincidencia = /^\d{4}-(\d{2})$/.exec(String(periodo ?? ''));
  const mes = coincidencia ? Number(coincidencia[1]) : 0;
  if (mes < 1 || mes > 12) throw new Error(`Periodo inválido: ${periodo}`);
  return MESES[mes - 1];
};

/** Nombre de la carpeta de un cliente nuevo: `{clave} {razón social}`, o `sin-clave`. */
export const nombreCarpetaCliente = (clave, razonSocial) => {
  const claveLimpia = clave ? String(clave).trim() : '';
  if (!claveLimpia) return 'sin-clave';
  const razon = razonSocial ? String(razonSocial).trim() : '';
  return razon ? sanitizarNombreArchivo(`${claveLimpia} ${razon}`) : claveLimpia;
};

/**
 * Carpeta del cliente dentro de la carpeta base. Si ya existe una que empiece
 * con su clave (`0001 …`) se usa esa, aunque la razón social haya cambiado,
 * para no crear una carpeta duplicada. Si no, se propone el nombre nuevo.
 * @param {string} carpetaBase
 * @param {string|null} clave
 * @param {string|null} razonSocial
 * @returns {Promise<string>} Nombre de la carpeta del cliente.
 */
export const buscarCarpetaCliente = async (carpetaBase, clave, razonSocial) => {
  const propuesta = nombreCarpetaCliente(clave, razonSocial);
  if (propuesta === 'sin-clave') return propuesta;
  const claveLimpia = String(clave).trim();

  let entradas = [];
  try {
    entradas = await fs.readdir(carpetaBase, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const existente = entradas.find(
    (e) => e.isDirectory() && (e.name === claveLimpia || e.name.startsWith(`${claveLimpia} `))
  );
  return existente ? existente.name : propuesta;
};

/**
 * Segmentos de la carpeta del documento, relativos a la carpeta base.
 * @param {{ carpetaCliente: string, periodo: string, folio: string }} datos
 * @returns {string[]} `[cliente, año, mes, folio]`.
 */
export const segmentosCarpeta = ({ carpetaCliente, periodo, folio }) => [
  carpetaCliente,
  String(periodo).slice(0, 4),
  carpetaDeMes(periodo),
  sanitizarNombreArchivo(folio),
];

/**
 * Ruta relativa (con separadores del sistema) del archivo dentro de la carpeta base.
 * @param {{ carpetaCliente: string, periodo: string, folio: string, nombreOriginal: string }} datos
 * @returns {string}
 */
export const rutaRelativaArchivo = ({ carpetaCliente, periodo, folio, nombreOriginal }) =>
  path.join(...segmentosCarpeta({ carpetaCliente, periodo, folio }), sanitizarNombreArchivo(nombreOriginal));

/**
 * Crea la carpeta si no existe y escribe el archivo SIN pisar uno que ya esté:
 * si el nombre está ocupado, prueba `nombre (2).ext`, `nombre (3).ext`…
 * @param {string} carpetaBase - Ruta absoluta o relativa de la raíz.
 * @param {string} rutaRelativa - Ruta relativa deseada dentro de la raíz.
 * @param {Buffer|Uint8Array} contenido - Bytes a escribir.
 * @returns {Promise<{ absoluto: string, rutaRelativa: string }>} Dónde quedó de verdad.
 */
export const escribirArchivo = async (carpetaBase, rutaRelativa, contenido) => {
  const carpeta = path.dirname(rutaRelativa);
  const extension = path.extname(rutaRelativa);
  const base = path.basename(rutaRelativa, extension);
  await fs.mkdir(path.resolve(carpetaBase, carpeta), { recursive: true });

  for (let intento = 1; ; intento++) {
    const nombre = intento === 1 ? `${base}${extension}` : `${base} (${intento})${extension}`;
    const relativa = path.join(carpeta, nombre);
    const absoluto = path.resolve(carpetaBase, relativa);
    try {
      // `wx` falla si el archivo ya existe: así dos archivos iguales nunca se pisan.
      await fs.writeFile(absoluto, contenido, { flag: 'wx' });
      return { absoluto, rutaRelativa: relativa };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
};

/**
 * Lee un archivo del disco.
 * @param {string} carpetaBase - Raíz.
 * @param {string} rutaRelativa - Ruta relativa.
 * @returns {Promise<Buffer>} Contenido.
 */
export const leerArchivo = async (carpetaBase, rutaRelativa) => {
  const absoluto = path.resolve(carpetaBase, rutaRelativa);
  return fs.readFile(absoluto);
};
