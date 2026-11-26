// Servicio de Ajustes: catálogo de clientes (lectura, alta, edición y contadores) y cuentas que
// pueden llevar clientes. Sin Vue, sin Quasar y sin stores; la api se puede inyectar en pruebas.

import { api as apiPorDefecto, crearErrorInesperado } from './api.js'

const MAX_CLAVE = 4
const MAX_NOMBRE = 150
const MAX_TELEFONO = 20
const FORMA_RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const FORMA_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Ayuda que acompaña a todo selector de contadores: el primero de la lista es el principal. */
export const EXPLICACION_PRINCIPAL = 'El principal es quien aparece sugerido en Recepción.'

const recortar = (valor) => String(valor ?? '').trim()
/** Un dato opcional vacío viaja como null. */
const opcional = (valor) => recortar(valor) || null
const normalizarClave = (valor) => recortar(valor).toUpperCase()
const normalizarRfc = (valor) => opcional(valor)?.toUpperCase() ?? null

/**
 * Valida el formulario del cliente con las mismas reglas del backend (clave obligatoria; RFC, correo
 * y teléfono opcionales pero válidos si se escriben).
 * @param {{ clave: string, nombre: string, rfc?: string, email?: string, telefono?: string }} datos
 * @param {{ claveObligatoria?: boolean }} [opciones] - Con `false` se acepta la clave vacía (un cliente
 * antiguo sin clave puede editarse sin asignarla; el backend solo la pide si se envía).
 * @returns {{ valido: boolean, errores: Object<string, string> }} Textos listos para mostrar junto al campo.
 */
export const validarClienteCatalogo = (
  { clave, nombre, rfc, email, telefono },
  { claveObligatoria = true } = {},
) => {
  const errores = {}
  const claveLimpia = normalizarClave(clave)
  if (claveLimpia === '') {
    if (claveObligatoria)
      errores.clave = 'Escribe la clave de carpeta del cliente (hasta 4 caracteres, sin espacios).'
  } else if (claveLimpia.length > MAX_CLAVE || /\s/.test(claveLimpia)) {
    errores.clave = `La clave debe tener como máximo ${MAX_CLAVE} caracteres y sin espacios.`
  }

  const nombreLimpio = recortar(nombre)
  if (nombreLimpio === '') {
    errores.nombre = 'Escribe la razón social o el nombre del cliente.'
  } else if (nombreLimpio.length > MAX_NOMBRE) {
    errores.nombre = `La razón social supera los ${MAX_NOMBRE} caracteres. Escribe una más corta.`
  }

  const rfcLimpio = normalizarRfc(rfc)
  if (rfcLimpio !== null && !FORMA_RFC.test(rfcLimpio)) {
    errores.rfc =
      'El RFC debe tener 12 o 13 caracteres, como ABC010101XY1. Corrígelo o déjalo vacío.'
  }

  const correo = opcional(email)
  if (correo !== null && (correo.length > MAX_NOMBRE || !FORMA_CORREO.test(correo))) {
    errores.email =
      'Escribe un correo con formato válido, como contacto@empresa.com, o déjalo vacío.'
  }

  const telefonoLimpio = opcional(telefono)
  if (telefonoLimpio !== null && telefonoLimpio.length > MAX_TELEFONO) {
    errores.telefono = `El teléfono no puede superar los ${MAX_TELEFONO} caracteres.`
  }

  return { valido: Object.keys(errores).length === 0, errores }
}

/**
 * Datos del formulario ya limpios, como los guarda el backend (clave en mayúsculas; opcionales vacíos en null).
 * @param {{ clave: string, nombre: string, rfc?: string, email?: string, telefono?: string }} datos
 */
const limpiarDatos = (datos) => ({
  clave: normalizarClave(datos.clave),
  nombre: recortar(datos.nombre),
  rfc: normalizarRfc(datos.rfc),
  email: opcional(datos.email),
  telefono: opcional(datos.telefono),
})

/**
 * Compara el formulario con el cliente que se abrió y devuelve solo los campos que cambiaron
 * (el PATCH borra un dato opcional con null, así que nunca se reenvía lo que no se tocó).
 * @param {Object} actual - Cliente tal como llegó de la lista.
 * @param {Object} formulario - Valores actuales del formulario.
 * @returns {Object} Solo los campos distintos, normalizados.
 */
export const cambiosDeCliente = (actual, formulario) => {
  const antes = limpiarDatos(actual)
  const despues = limpiarDatos(formulario)
  return Object.fromEntries(
    Object.entries(despues).filter(([campo, valor]) => valor !== antes[campo]),
  )
}

// La parte «sobre X» de los errores del backend (nombre, clave, rfc, correo, teléfono, contadores).
const CAMPO_POR_SOBRE = Object.freeze({
  nombre: 'nombre',
  clave: 'clave',
  rfc: 'rfc',
  correo: 'email',
  telefono: 'telefono',
  contadores: 'contadores',
})

/**
 * Campo del formulario al que se refiere un error del backend (formato «… sobre X: …»).
 * @param {string} mensaje - Mensaje del error.
 * @returns {string|null} nombre, clave, rfc, email, telefono o contadores; null si no es de un campo.
 */
export const campoDeErrorCliente = (mensaje) => {
  const sobre = / sobre ([^:]+):/i.exec(String(mensaje ?? ''))
  if (!sobre) return null
  const nombre = sobre[1].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  return CAMPO_POR_SOBRE[nombre] ?? null
}

/**
 * Opciones del selector de contadores: las cuentas elegibles más las que el cliente ya tiene y dejaron
 * de serlo (se muestran para poder quitarlas; guardarlas daría error).
 * @param {Array<{ id: number, nombre: string, contador_documentos: boolean }>} elegibles
 * @param {Array<{ id: number, nombre: string }>} actuales - Contadores que ya tiene el cliente.
 * @returns {Array<{ value: number, label: string, sinRolDocumentos: boolean, yaNoElegible: boolean }>}
 */
export const opcionesDeContadores = (elegibles, actuales = []) => {
  const opciones = elegibles.map((cuenta) => ({
    value: cuenta.id,
    label: cuenta.nombre,
    sinRolDocumentos: !cuenta.contador_documentos,
    yaNoElegible: false,
  }))
  for (const cuenta of actuales) {
    if (!opciones.some((opcion) => opcion.value === cuenta.id)) {
      opciones.push({
        value: cuenta.id,
        label: cuenta.nombre,
        sinRolDocumentos: true,
        yaNoElegible: true,
      })
    }
  }
  return opciones
}

/**
 * Aviso para cuando el principal (el primero de la selección) no tiene rol Contador en Documentos.
 * @param {number[]} seleccion - Ids elegidos, en orden.
 * @param {Array<{ value: number, label: string, sinRolDocumentos: boolean }>} opciones
 * @returns {string|null} El texto del aviso, o null si no hace falta.
 */
export const avisoPrincipalSinRolDocumentos = (seleccion, opciones) => {
  const principal = opciones.find((opcion) => opcion.value === seleccion[0])
  if (!principal?.sinRolDocumentos) return null
  return `${principal.label} no tiene el rol de Contador en Documentos: Recepción no lo propondrá como contador de este cliente. Puedes darle ese rol en «Acceso a módulos» o poner de principal a otra persona.`
}

/**
 * Crea el servicio de Ajustes con api inyectable.
 * @param {Object} [opciones] - inyección para pruebas.
 * @param {Object} [opciones.api] - instancia de axios (o api falsa).
 * @returns {Object} funciones del servicio de Ajustes.
 */
export const crearAjustesService = (opciones = {}) => {
  const api = opciones.api ?? apiPorDefecto

  const leerCliente = (data) => {
    if (!data?.cliente) throw crearErrorInesperado('el cliente guardado')
    return data.cliente
  }

  /**
   * GET /ajustes/clientes: todos los clientes del catálogo, activos primero.
   * @returns {Promise<Array<{ id: number, clave: string|null, nombre: string, rfc: string|null,
   * email: string|null, telefono: string|null, activo: boolean, contador_id: number|null,
   * contador_nombre: string|null, contadores: Array<{ id: number, nombre: string }> }>>}
   */
  const listarClientes = async () => {
    const { data } = await api.get('/ajustes/clientes')
    if (!Array.isArray(data?.clientes)) throw crearErrorInesperado('la lista de clientes')
    return data.clientes
  }

  /**
   * GET /ajustes/contadores: cuentas que pueden llevar clientes, por nombre.
   * @returns {Promise<Array<{ id: number, nombre: string, rol: string, contador_documentos: boolean }>>}
   */
  const listarContadoresElegibles = async () => {
    const { data } = await api.get('/ajustes/contadores')
    if (!Array.isArray(data?.contadores)) throw crearErrorInesperado('la lista de contadores')
    return data.contadores
  }

  /**
   * POST /ajustes/clientes: da de alta un cliente; el primero de `contadores` queda como principal.
   * @param {{ clave: string, nombre: string, rfc?: string, email?: string, telefono?: string,
   * contadores?: number[] }} datos
   * @returns {Promise<Object>} el cliente creado.
   */
  const crearCliente = async (datos) => {
    const { data } = await api.post('/ajustes/clientes', {
      ...limpiarDatos(datos),
      contadores: datos.contadores ?? [],
    })
    return leerCliente(data)
  }

  /**
   * PATCH /ajustes/clientes/:id: cambia solo los campos recibidos (el backend borra un opcional con null).
   * @param {number} id - Id del cliente.
   * @param {Object} cambios - clave, nombre, rfc, email, telefono o activo.
   * @returns {Promise<Object>} el cliente actualizado.
   */
  const editarCliente = async (id, cambios) => {
    const { data } = await api.patch(`/ajustes/clientes/${id}`, cambios)
    return leerCliente(data)
  }

  /**
   * PUT /ajustes/clientes/:id/contadores: reemplaza la lista completa (puede ir vacía); el primero es el principal.
   * @param {number} id - Id del cliente.
   * @param {number[]} contadores - Ids de las cuentas, en orden.
   * @returns {Promise<Object>} el cliente con su nueva lista.
   */
  const reemplazarContadores = async (id, contadores) => {
    const { data } = await api.put(`/ajustes/clientes/${id}/contadores`, { contadores })
    return leerCliente(data)
  }

  return {
    listarClientes,
    listarContadoresElegibles,
    crearCliente,
    editarCliente,
    reemplazarContadores,
  }
}

// Servicio por defecto con la instancia de axios real.
const servicioPorDefecto = crearAjustesService()

export const listarClientes = servicioPorDefecto.listarClientes
export const listarContadoresElegibles = servicioPorDefecto.listarContadoresElegibles
export const crearCliente = servicioPorDefecto.crearCliente
export const editarCliente = servicioPorDefecto.editarCliente
export const reemplazarContadores = servicioPorDefecto.reemplazarContadores
