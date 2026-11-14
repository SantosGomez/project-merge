// Rebanada 13: calendario de vencimientos dentro de «Mis actividades».

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearActividadService } from '../src/services/actividadService.js'
import {
  diaInicialDelCalendario,
  esDiaInhabil,
  estadoDelDia,
  fechaDeCalendario,
  fechaParaCalendario,
  renglonesDelCalendario,
  resumenDeDias,
  textoSinFecha,
  tituloDeDia,
} from '../src/utils/actividades.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

const renglon = (cliente_id, vence, hecha = false, extra = {}) => ({
  tipo_id: 1,
  tipo: 'IVA',
  cliente_id,
  cliente: `Cliente ${cliente_id}`,
  vence,
  hecha,
  ...extra,
})

describe('fechas del calendario (texto, sin Date de texto)', () => {
  it('convierte entre AAAA-MM-DD y AAAA/MM/DD', () => {
    assert.equal(fechaParaCalendario('2026-11-16'), '2026/11/16')
    assert.equal(fechaDeCalendario('2026/11/16'), '2026-11-16')
  })
})

describe('renglonesDelCalendario', () => {
  it('une el mes y el anterior, deja solo lo que vence en el mes mostrado y marca de qué mes viene', () => {
    const delMes = [renglon(1, '2026-11-10'), renglon(2, '2026-12-01'), renglon(3, null)]
    const delAnterior = [renglon(4, '2026-11-02'), renglon(5, '2026-10-31'), renglon(6, null)]
    const { conFecha, sinFecha } = renglonesDelCalendario('2026-11', delMes, delAnterior)
    assert.deepEqual(
      conFecha.map((r) => [r.cliente_id, r.mes]),
      [
        [1, '2026-11'],
        [4, '2026-10'],
      ],
    )
    assert.equal(sinFecha, 1, 'solo cuenta las sin fecha del mes mostrado')
  })
})

describe('resumenDeDias y estadoDelDia', () => {
  const hoy = '2026-11-13'

  it('un día con pendientes ya vencidas es «vencida», aunque haya otras por vencer o hechas', () => {
    const dias = resumenDeDias(
      [renglon(1, '2026-11-12'), renglon(2, '2026-11-12', true), renglon(3, '2026-11-12')],
      hoy,
    )
    assert.equal(dias['2026-11-12'], 'vencida')
  })

  it('un día con pendientes sin vencer es «por-vencer» y no depende de qué tan lejos esté', () => {
    const dias = resumenDeDias(
      [renglon(1, '2026-11-20'), renglon(2, '2026-11-20', true), renglon(3, '2026-11-14')],
      hoy,
    )
    assert.equal(dias['2026-11-20'], 'por-vencer')
    assert.equal(dias['2026-11-14'], 'por-vencer')
  })

  it('un día con todo hecho es «hecha», aunque la fecha ya pasara', () => {
    const dias = resumenDeDias(
      [renglon(1, '2026-11-05', true), renglon(2, '2026-11-05', true)],
      hoy,
    )
    assert.equal(dias['2026-11-05'], 'hecha')
  })

  it('estadoDelDia devuelve null si el día no tiene vencimientos', () => {
    assert.equal(estadoDelDia([], hoy), null)
  })
})

describe('esDiaInhabil', () => {
  const festivos = ['2026-11-16']

  it('sábados, domingos y festivos son inhábiles', () => {
    assert.equal(esDiaInhabil('2026-11-14', festivos), true, 'sábado')
    assert.equal(esDiaInhabil('2026-11-15', festivos), true, 'domingo')
    assert.equal(esDiaInhabil('2026-11-16', festivos), true, 'festivo en lunes')
  })

  it('un día entre semana que no es festivo es hábil', () => {
    assert.equal(esDiaInhabil('2026-11-13', festivos), false)
    assert.equal(esDiaInhabil('2026-11-17', festivos), false)
  })
})

describe('tituloDeDia', () => {
  it('escribe el día de la semana y la fecha en español', () => {
    assert.equal(tituloDeDia('2026-11-13'), 'Viernes 13 de noviembre de 2026')
    assert.equal(tituloDeDia('2026-11-01'), 'Domingo 1 de noviembre de 2026')
  })
})

describe('diaInicialDelCalendario', () => {
  const dias = { '2026-11-20': 'por-vencer', '2026-11-05': 'hecha' }

  it('es hoy si pertenece al mes mostrado', () => {
    assert.equal(diaInicialDelCalendario('2026-11', '2026-11-13', dias), '2026-11-13')
  })

  it('si hoy es de otro mes, es el primer día con vencimientos', () => {
    assert.equal(diaInicialDelCalendario('2026-11', '2026-12-02', dias), '2026-11-05')
  })

  it('si no hay vencimientos ni es el mes de hoy, es el día 1', () => {
    assert.equal(diaInicialDelCalendario('2026-11', '2026-12-02', {}), '2026-11-01')
  })
})

describe('textoSinFecha', () => {
  it('no dice nada si no hay actividades sin fecha', () => {
    assert.equal(textoSinFecha(0), '')
  })

  it('cuenta en singular y en plural y manda a la «Lista del mes»', () => {
    assert.match(textoSinFecha(1), /^1 actividad de este mes no tiene fecha de vencimiento/)
    assert.match(textoSinFecha(1), /Lista del mes/)
    assert.match(textoSinFecha(3), /^3 actividades de este mes no tienen fecha de vencimiento/)
  })
})

describe('actividadService: festivos', () => {
  const apiCon = (data) => ({ get: async () => ({ data }) })

  it('listarActividades devuelve también los festivos del mes', async () => {
    const servicio = crearActividadService({
      api: apiCon({ mes: '2026-11', festivos: ['2026-11-16'], actividades: [] }),
    })
    assert.deepEqual(await servicio.listarActividades('2026-11'), {
      mes: '2026-11',
      festivos: ['2026-11-16'],
      actividades: [],
    })
  })

  it('si el servidor no manda festivos, quedan como lista vacía', async () => {
    const servicio = crearActividadService({ api: apiCon({ mes: '2026-11', actividades: [] }) })
    assert.deepEqual((await servicio.listarActividades('2026-11')).festivos, [])
  })
})

describe('«Mis actividades»: tercera vista «Calendario»', () => {
  const fuente = leer('../src/components/MisActividades.vue')
  const plantilla = plantillaDe(fuente)

  it('el conmutador ofrece Lista del mes, Calendario y Clientes y tipos, y la vista va en ?vista=calendario', () => {
    assert.match(
      fuente,
      /label: 'Lista del mes'[\s\S]*label: 'Calendario'[\s\S]*label: 'Clientes y tipos'/,
    )
    assert.match(fuente, /'calendario'/)
    assert.match(plantilla, /<CalendarioActividades/)
    assert.match(fuente, /\.\.\.route\.query/, 'conserva ?mes= al cambiar de vista')
  })
})

describe('componente CalendarioActividades', () => {
  const ubicacion = '../src/components/CalendarioActividades.vue'

  it('existe y usa un q-date con semana desde el lunes, español, puntos de color y leyenda', () => {
    assert.ok(existsSync(ruta(ubicacion)))
    const fuente = leer(ubicacion)
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /<q-date/)
    assert.match(plantilla, /:first-day-of-week="1"/)
    assert.match(plantilla, /:events=/)
    assert.match(plantilla, /:event-color=/)
    assert.match(fuente, /Pendientes vencidas/, 'leyenda con texto para cada color')
    assert.match(fuente, /Pendientes por vencer/, 'leyenda con texto para cada color')
    assert.match(fuente, /Todo hecho/, 'leyenda con texto para cada color')
    assert.match(plantilla, /Día inhábil/)
    assert.match(plantilla, /Nada vence este día\./)
  })

  it('tiene carga, error con reintento, hecha con casilla, tooltips y recarga en silencio', () => {
    const fuente = leer(ubicacion)
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /<ScreenLoader/)
    assert.match(plantilla, /<ErrorState/)
    assert.match(plantilla, /<EmptyState/)
    assert.match(plantilla, /@retry/)
    assert.match(plantilla, /<q-checkbox/)
    assert.match(plantilla, /Hecha/)
    assert.match(plantilla, /Vencida/)
    assert.match(plantilla, /Vence pronto/)
    assert.match(plantilla, /<q-tooltip>/)
    assert.match(fuente, /route\.query\.mes/)
    assert.match(fuente, /visibilitychange/)
    assert.match(fuente, /removeEventListener\('visibilitychange'/)
    assert.doesNotMatch(fuente, /new Date\('/)
    assert.doesNotMatch(fuente, /#[0-9a-fA-F]{3,6}\b/, 'colores solo de la paleta dg-*')
  })
})
