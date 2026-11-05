// Pruebas del servicio de auditorías (rebanada 1 del módulo de auditorías).
// Sin red: se inyecta una api falsa que registra las llamadas y devuelve
// respuestas con la forma real del backend.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearAuditoriaService, mensajeDeBackend as mensajeDeBackendApi } from '../src/services/auditoriaService.js'

// Api falsa con manejadores por método; registra todas las llamadas.
const crearApiFalsa = (manejadores = {}) => {
  const llamadas = []
  const responder = async (metodo, url, cuerpo) => {
    llamadas.push({ metodo, url, cuerpo })
    const manejador = manejadores[metodo]
    if (!manejador) {
      throw new Error(`sin manejador para ${metodo}`)
    }
    return manejador(url, cuerpo)
  }
  return {
    llamadas,
    get: (url) => responder('GET', url),
    post: (url, cuerpo) => responder('POST', url, cuerpo),
    patch: (url, cuerpo) => responder('PATCH', url, cuerpo),
  }
}

// Auditoría tal como la devuelve GET/POST/PATCH /auditorias.
const auditoriaDeBackend = (extra = {}) => ({
  id: 7,
  cliente: 'Cliente Ejemplo A, S.A. de C.V.',
  no_expediente: 'VDM-001/2026',
  dependencia: 'SAT – ADAF',
  tipo_auditoria: 'Visita Domiciliaria',
  estatal: false,
  periodo_inicio: '2023-01-01',
  periodo_final: '2023-12-31',
  estado: 'Pendiente',
  fecha_inicio: '2026-02-15',
  fecha_vencimiento: '2027-02-15',
  descripcion: null,
  observacion: 'Preparar contabilidad',
  contadores: [{ id: 3, nombre: 'Brenda Chávez' }],
  fase_actual: { id: 2, nombre: 'Fase 2 · Requerimientos y desarrollo' },
  proximo_vencimiento: '2026-11-05',
  que_vence: 'Requerimiento adicional de información',
  dias_para_vencer: 6,
  semaforo: 'Crítico',
  creado_por: 3,
  creado_en: '2026-10-29 10:00:00',
  actualizado_en: '2026-10-29 11:30:00',
  ...extra,
})

// Datos tal como los captura el formulario (fechas DD-MM-AAAA).
const formulario = (extra = {}) => ({
  cliente: 'Cliente Ejemplo A, S.A. de C.V.',
  noExpediente: 'VDM-001/2026',
  dependencia: 'SAT – ADAF',
  tipoAud: 'Visita Domiciliaria',
  estatal: false,
  periodoInicio: '01-01-2023',
  periodoFinal: '31-12-2023',
  fechaInicio: '15-02-2026',
  fechaVencimiento: '15-02-2027',
  descripcion: '',
  observacion: 'Preparar contabilidad',
  ...extra,
})

test('listarAuditorias hace GET /auditorias y entrega las fechas como DD-MM-AAAA', async () => {
  const api = crearApiFalsa({ GET: async () => ({ data: { auditorias: [auditoriaDeBackend()] } }) })

  const [auditoria] = await crearAuditoriaService({ api }).listarAuditorias()

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/auditorias', cuerpo: undefined }])
  assert.deepEqual(auditoria, {
    id: 7,
    cliente: 'Cliente Ejemplo A, S.A. de C.V.',
    noExpediente: 'VDM-001/2026',
    dependencia: 'SAT – ADAF',
    tipoAud: 'Visita Domiciliaria',
    estatal: false,
    periodoInicio: '01-01-2023',
    periodoFinal: '31-12-2023',
    estado: 'Pendiente',
    fechaInicio: '15-02-2026',
    fechaVencimiento: '15-02-2027',
    descripcion: '',
    observacion: 'Preparar contabilidad',
    contadores: [{ id: 3, nombre: 'Brenda Chávez' }],
    faseActual: { id: 2, nombre: 'Fase 2 · Requerimientos y desarrollo' },
    proximoVencimiento: '05-11-2026',
    queVence: 'Requerimiento adicional de información',
    diasParaVencer: 6,
    semaforo: 'Crítico',
    actualizadoEn: '2026-10-29 11:30:00',
  })
})

test('listarAuditorias deja sin próximo vencimiento a la auditoría sin plazos pendientes', async () => {
  const api = crearApiFalsa({
    GET: async () => ({
      data: {
        auditorias: [
          auditoriaDeBackend({ proximo_vencimiento: null, que_vence: null, dias_para_vencer: null, semaforo: 'En tiempo' }),
        ],
      },
    }),
  })

  const [auditoria] = await crearAuditoriaService({ api }).listarAuditorias()

  assert.equal(auditoria.proximoVencimiento, '')
  assert.equal(auditoria.queVence, '')
  assert.equal(auditoria.diasParaVencer, null)
  assert.equal(auditoria.semaforo, 'En tiempo')
})

test('registrarAuditoria envía las fechas como AAAA-MM-DD y devuelve la auditoría traducida', async () => {
  const api = crearApiFalsa({ POST: async () => ({ data: { auditoria: auditoriaDeBackend() } }) })

  const auditoria = await crearAuditoriaService({ api }).registrarAuditoria(formulario({ contadores: [3, 5] }))

  assert.deepEqual(api.llamadas, [
    {
      metodo: 'POST',
      url: '/auditorias',
      cuerpo: {
        cliente: 'Cliente Ejemplo A, S.A. de C.V.',
        no_expediente: 'VDM-001/2026',
        dependencia: 'SAT – ADAF',
        tipo_auditoria: 'Visita Domiciliaria',
        estatal: false,
        periodo_inicio: '2023-01-01',
        periodo_final: '2023-12-31',
        fecha_inicio: '2026-02-15',
        fecha_vencimiento: '2027-02-15',
        descripcion: '',
        observacion: 'Preparar contabilidad',
        contadores: [3, 5],
      },
    },
  ])
  assert.equal(auditoria.fechaInicio, '15-02-2026')
})

test('registrarAuditoria no llama a la API si una fecha no existe', async () => {
  const api = crearApiFalsa()

  await assert.rejects(
    crearAuditoriaService({ api }).registrarAuditoria(formulario({ periodoFinal: '31-02-2023' })),
    (error) => {
      assert.match(error.mensaje, /fin del periodo/)
      return true
    },
  )
  assert.equal(api.llamadas.length, 0)
})

test('actualizarAuditoria hace PATCH /auditorias/:id solo con los campos que cambian', async () => {
  const api = crearApiFalsa({
    PATCH: async () => ({ data: { auditoria: auditoriaDeBackend({ estado: 'En Proceso', fecha_vencimiento: '2027-03-01' }) } }),
  })

  const auditoria = await crearAuditoriaService({ api }).actualizarAuditoria(7, {
    estado: 'En Proceso',
    fechaVencimiento: '01-03-2027',
  })

  assert.deepEqual(api.llamadas, [
    { metodo: 'PATCH', url: '/auditorias/7', cuerpo: { estado: 'En Proceso', fecha_vencimiento: '2027-03-01' } },
  ])
  assert.equal(auditoria.estado, 'En Proceso')
  assert.equal(auditoria.fechaVencimiento, '01-03-2027')
})

test('obtenerAuditoria hace GET /auditorias/:id y la traduce', async () => {
  const api = crearApiFalsa({ GET: async () => ({ data: { auditoria: auditoriaDeBackend() } }) })

  const auditoria = await crearAuditoriaService({ api }).obtenerAuditoria(7)

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/auditorias/7', cuerpo: undefined }])
  assert.equal(auditoria.fechaInicio, '15-02-2026')
  assert.equal(auditoria.semaforo, 'Crítico')
})

// Mensaje tal como lo devuelve GET/POST /auditorias/:id/mensajes (chat, experimento).
const mensajeDeBackend = (extra = {}) => ({
  id: 15,
  auditoria_id: 7,
  texto: 'Ya subí los contratos al expediente.',
  autor: { id: 3, nombre: 'Brenda Chávez', rol: 'contador' },
  creado_en: '2026-11-05 09:07:30',
  ...extra,
})

test('listarMensajes hace GET /auditorias/:id/mensajes y muestra la hora como DD-MM-AAAA HH:mm', async () => {
  const api = crearApiFalsa({
    GET: async () => ({ data: { mensajes: [mensajeDeBackend(), mensajeDeBackend({ id: 16, texto: 'Gracias' })] } }),
  })

  const mensajes = await crearAuditoriaService({ api }).listarMensajes(7)

  assert.deepEqual(api.llamadas, [{ metodo: 'GET', url: '/auditorias/7/mensajes', cuerpo: undefined }])
  assert.deepEqual(mensajes[0], {
    id: 15,
    texto: 'Ya subí los contratos al expediente.',
    autor: { id: 3, nombre: 'Brenda Chávez', rol: 'contador' },
    fechaHora: '05-11-2026 09:07',
  })
  assert.equal(mensajes[1].texto, 'Gracias')
})

test('listarMensajes lanza el error de tres partes si la respuesta no trae la lista', async () => {
  const api = crearApiFalsa({ GET: async () => ({ data: {} }) })

  await assert.rejects(crearAuditoriaService({ api }).listarMensajes(7), (error) => {
    assert.match(error.mensaje, /mensajes/)
    return true
  })
})

test('enviarMensaje hace POST /auditorias/:id/mensajes con el texto y devuelve el mensaje traducido', async () => {
  const api = crearApiFalsa({ POST: async () => ({ data: { nuevo_mensaje: mensajeDeBackend() } }) })

  const mensaje = await crearAuditoriaService({ api }).enviarMensaje(7, 'Ya subí los contratos al expediente.')

  assert.deepEqual(api.llamadas, [
    { metodo: 'POST', url: '/auditorias/7/mensajes', cuerpo: { texto: 'Ya subí los contratos al expediente.' } },
  ])
  assert.equal(mensaje.id, 15)
  assert.equal(mensaje.fechaHora, '05-11-2026 09:07')
})

test('mensajeDeBackend traduce el mensaje que llega en vivo con la misma forma que la lista', () => {
  assert.deepEqual(mensajeDeBackendApi(mensajeDeBackend()), {
    id: 15,
    texto: 'Ya subí los contratos al expediente.',
    autor: { id: 3, nombre: 'Brenda Chávez', rol: 'contador' },
    fechaHora: '05-11-2026 09:07',
  })
})
