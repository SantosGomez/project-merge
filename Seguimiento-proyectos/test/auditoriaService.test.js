// Pruebas del servicio de auditorías (rebanada 1 del módulo de auditorías).
// Sin red: se inyecta una api falsa que registra las llamadas y devuelve
// respuestas con la forma real del backend.

import test from 'node:test'
import assert from 'node:assert/strict'

import { crearAuditoriaService } from '../src/services/auditoriaService.js'

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
    actualizadoEn: '2026-10-29 11:30:00',
  })
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
