// Validaciones y orden de las listas de «Mis actividades» (clientes y tipos de actividad propios).
// Funciones puras, sin Vue ni navegador.

/** Longitudes máximas que acepta el backend. */
export const MAX_NOMBRE_CLIENTE = 150
export const MAX_NOMBRE_TIPO = 120

// RFC de empresa (12) o de persona física (13): 3-4 letras, fecha AAMMDD y homoclave de 3 caracteres.
const FORMA_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/

const recortar = (valor) => (typeof valor === 'string' ? valor.trim() : '')

/**
 * RFC como lo guarda el backend: recortado y en mayúsculas; vacío queda en null.
 * @param {*} rfc - Texto escrito en el formulario.
 * @returns {string|null}
 */
export const normalizarRfc = (rfc) => recortar(rfc).toUpperCase() || null

/**
 * Valida el nombre y el RFC opcional de un cliente.
 * @param {{ nombre: string, rfc: string }} datos - Valores del formulario.
 * @returns {{ valido: boolean, errores: { nombre?: string, rfc?: string } }} Textos listos para mostrar junto al campo.
 */
export const validarDatosCliente = ({ nombre, rfc }) => {
  const errores = {}
  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe el nombre del cliente.'
  } else if (nombreLimpio.length > MAX_NOMBRE_CLIENTE) {
    errores.nombre = `El nombre supera los ${MAX_NOMBRE_CLIENTE} caracteres. Escribe uno más corto.`
  }

  const rfcNormalizado = normalizarRfc(rfc)
  if (rfcNormalizado !== null && !FORMA_RFC.test(rfcNormalizado)) {
    errores.rfc =
      'El RFC debe tener 12 o 13 caracteres, como ABC010101XY1. Corrígelo o déjalo vacío.'
  }
  return { valido: Object.keys(errores).length === 0, errores }
}

/**
 * Valida el nombre de un tipo de actividad.
 * @param {{ nombre: string }} datos - Valores del formulario.
 * @returns {{ valido: boolean, errores: { nombre?: string } }}
 */
export const validarDatosTipo = ({ nombre }) => {
  const errores = {}
  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe el nombre del tipo de actividad.'
  } else if (nombreLimpio.length > MAX_NOMBRE_TIPO) {
    errores.nombre = `El nombre supera los ${MAX_NOMBRE_TIPO} caracteres. Escribe uno más corto.`
  }
  return { valido: Object.keys(errores).length === 0, errores }
}

/**
 * Lista nueva con el elemento reemplazado (mismo id) o agregado, con los activos primero y cada
 * grupo por nombre sin distinguir mayúsculas ni acentos, igual que la ordena el backend.
 * @param {Array<{ id: number, nombre: string, activo: boolean }>} lista - Lista actual (no se modifica).
 * @param {{ id: number, nombre: string, activo: boolean }} elemento - Elemento guardado.
 * @returns {Array<Object>}
 */
export const mezclarEnLista = (lista, elemento) =>
  [...lista.filter((actual) => actual.id !== elemento.id), elemento].sort(
    (a, b) =>
      Number(b.activo) - Number(a.activo) ||
      a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }) ||
      a.id - b.id,
  )
