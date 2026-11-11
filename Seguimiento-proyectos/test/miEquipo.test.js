// Pestaña «Mi equipo» de «Mi resumen»: el contador ve a sus auxiliares como el administrador ve
// a los contadores (cifras del equipo, una fila por auxiliar y el detalle de sus casos).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { resumenDeAuxiliares } from '../src/utils/resumenMisCasos.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))

const HOY = '2026-11-11'
const caso = (id, contadorId, estado, datos = {}) => ({
  id,
  contador_id: contadorId,
  estado,
  prioridad: 'media',
  fecha_vencimiento: '2026-12-01',
  actualizado_en: '2026-11-10 09:00:00',
  ...datos,
})

describe('resumenDeAuxiliares', () => {
  const auxiliares = [
    { id: 20, nombre: 'Beto' },
    { id: 21, nombre: 'Ana' },
    { id: 22, nombre: 'Carla' },
  ]
  const casos = [
    caso(1, 9, 'pendiente'), // del propio contador: no cuenta en el equipo
    caso(2, 20, 'pendiente'),
    caso(3, 20, 'en_proceso', { prioridad: 'alta' }),
    caso(4, 20, 'finalizado'),
    caso(5, '21', 'en_proceso', { fecha_vencimiento: '2026-11-01' }), // vencido; id como texto
    caso(6, 5, 'pendiente'), // de un contador al que se apoya: tampoco cuenta
  ]

  it('cuenta solo los casos de los auxiliares, uno por fila, con ceros para quien no tiene', () => {
    const { filas } = resumenDeAuxiliares(casos, auxiliares, HOY)
    const porNombre = Object.fromEntries(filas.map((fila) => [fila.nombre, fila]))

    assert.deepEqual(
      [
        porNombre.Beto.resumen.pendiente,
        porNombre.Beto.resumen.en_proceso,
        porNombre.Beto.resumen.finalizado,
      ],
      [1, 1, 1],
    )
    assert.equal(porNombre.Beto.resumen.alta_abiertos, 1)
    assert.equal(porNombre.Ana.resumen.vencidos, 1)
    assert.deepEqual(
      porNombre.Ana.casos.map((c) => c.id),
      [5],
    )
    assert.equal(porNombre.Carla.resumen.abiertos, 0)
    assert.deepEqual(porNombre.Carla.casos, [])
  })

  it('el total del equipo suma a todos los auxiliares y deja fuera los casos del contador', () => {
    const { equipo } = resumenDeAuxiliares(casos, auxiliares, HOY)
    assert.equal(equipo.pendiente, 1)
    assert.equal(equipo.en_proceso, 2)
    assert.equal(equipo.finalizado, 1)
    assert.equal(equipo.abiertos, 3)
    assert.equal(equipo.vencidos, 1)
    assert.equal(equipo.alta_abiertos, 1)
  })

  it('lo urgente primero: más vencidos, luego más abiertos, luego por nombre', () => {
    const { filas } = resumenDeAuxiliares(casos, auxiliares, HOY)
    assert.deepEqual(
      filas.map((fila) => fila.nombre),
      ['Ana', 'Beto', 'Carla'],
    )
  })

  it('sin auxiliares o sin casos no falla', () => {
    assert.deepEqual(resumenDeAuxiliares(casos, [], HOY).filas, [])
    assert.equal(resumenDeAuxiliares(null, auxiliares, HOY).equipo.abiertos, 0)
    assert.equal(resumenDeAuxiliares(undefined, undefined, HOY).filas.length, 0)
  })
})

describe('pestaña «Mi equipo» en «Mi resumen»', () => {
  const pagina = leer('../src/pages/ContadorDashboardPage.vue')
  const componente = leer('../src/components/MiEquipo.vue')

  it('solo la ve el contador que tiene auxiliares', () => {
    assert.match(
      scriptDe(pagina),
      /session\.esContador && auxiliares\.total > 0/,
      'condición de la pestaña',
    )
    assert.match(
      plantillaDe(pagina),
      /<q-tab v-if="tieneEquipo" name="equipo"[^>]*label="Mi equipo"/,
    )
    assert.match(plantillaDe(pagina), /<q-tab-panel v-if="tieneEquipo" name="equipo"/)
    assert.match(
      scriptDe(pagina),
      /auxiliares\.cargarAuxiliares\(/,
      'carga los auxiliares al entrar',
    )
  })

  it('reutiliza las tarjetas del equipo y la fila de caso, con todas sus acciones', () => {
    const plantilla = plantillaDe(componente)
    assert.match(plantilla, /<ResumenEquipo/, 'tarjetas y dona del equipo')
    assert.match(plantilla, /<CasoItem/, 'fila de caso de «Mis casos»')
    for (const evento of ['alternar-importante', 'cambiar-estado', 'editar', 'ver']) {
      assert.match(plantilla, new RegExp(`@${evento}=`), `emite ${evento}`)
    }
    assert.doesNotMatch(plantilla, /solo-lectura/, 'el contador edita los casos de su auxiliar')
  })

  it('cada auxiliar muestra sus tres conteos con texto y se puede elegir con teclado', () => {
    const plantilla = plantillaDe(componente)
    assert.match(plantilla, /:aria-pressed=/, 'la fila elegida se anuncia')
    assert.match(plantilla, /v-for="estado in STATUSES"/, 'un conteo por estado')
    assert.match(plantilla, /STATUS_LABELS\[estado\]/, 'el número lleva su etiqueta')
    assert.match(plantilla, /<q-tooltip/, 'ayuda contextual')
  })

  it('la página guarda los cambios con el store y abre «Ver» y «Editar»', () => {
    const plantilla = plantillaDe(pagina)
    assert.match(plantilla, /<MiEquipo/)
    assert.match(plantilla, /@editar="abrirEdicion"/)
    assert.match(plantilla, /@ver="abrirDetalle"/)
    assert.match(plantilla, /<CasoDetalleDialog/)
    assert.match(scriptDe(pagina), /cases\.actualizarCaso\(casoId, cambios\)/)
  })

  it('no usa colores sueltos', () => {
    assert.doesNotMatch(componente.slice(componente.indexOf('<style')), /#[0-9a-fA-F]{3,6}\b/)
  })
})
