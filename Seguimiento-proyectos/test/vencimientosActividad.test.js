// Rebanada 12: vencimientos de las actividades (regla por tipo y etiquetas en la lista del mes).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearTipoActividadService } from '../src/services/tipoActividadService.js'
import {
  REGLAS_VENCIMIENTO,
  agruparPorTipo,
  contarVencidas,
  estadoDeVencimiento,
  etiquetaDeRegla,
  nombreAccesibleDeRenglon,
  ordenarPorVencimiento,
  textoDeVencimiento,
  validarDatosTipo,
} from '../src/utils/actividades.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

const crearApiFalsa = (responder) => {
  const llamadas = []
  const registrar = (metodo) => async (url, cuerpo) => {
    llamadas.push({ metodo, url, cuerpo })
    return responder(metodo, url, cuerpo)
  }
  return { llamadas, get: registrar('get'), post: registrar('post'), patch: registrar('patch') }
}

const fila = (cliente, vence, hecha = false, extra = {}) => ({
  tipo_id: 1,
  tipo: 'Tipo',
  cliente_id: cliente.length,
  cliente,
  vence,
  falta_rfc: false,
  hecha,
  ...extra,
})

describe('regla de vencimiento del tipo', () => {
  it('ofrece las cuatro opciones, «Sin fecha» primero', () => {
    assert.deepEqual(
      REGLAS_VENCIMIENTO.map((opcion) => opcion.value),
      ['ninguna', 'dia_del_mes', 'fin_de_mes', 'dia_17_rfc'],
    )
    assert.deepEqual(
      REGLAS_VENCIMIENTO.map((opcion) => opcion.label),
      ['Sin fecha', 'Día fijo del mes', 'Fin de mes', 'Día 17 según el RFC del cliente'],
    )
  })

  it('etiquetaDeRegla dice la regla en texto', () => {
    assert.equal(
      etiquetaDeRegla({ regla_vencimiento: 'dia_del_mes', dia_del_mes: 3 }),
      'Vence el día 3',
    )
    assert.equal(
      etiquetaDeRegla({ regla_vencimiento: 'fin_de_mes', dia_del_mes: null }),
      'Vence a fin de mes',
    )
    assert.equal(etiquetaDeRegla({ regla_vencimiento: 'dia_17_rfc' }), 'Vence el 17 según el RFC')
    assert.equal(etiquetaDeRegla({ regla_vencimiento: 'ninguna' }), 'Sin fecha de vencimiento')
    assert.equal(etiquetaDeRegla({}), 'Sin fecha de vencimiento')
  })

  it('validarDatosTipo pide el día solo con «Día fijo del mes» y lo limita de 1 a 28', () => {
    assert.equal(validarDatosTipo({ nombre: 'A' }).valido, true, 'sin regla es «Sin fecha»')
    assert.equal(
      validarDatosTipo({ nombre: 'A', regla_vencimiento: 'fin_de_mes', dia_del_mes: '' }).valido,
      true,
    )
    for (const dia of ['', null, undefined, '0', '29', '3.5', 'x', -1]) {
      const resultado = validarDatosTipo({
        nombre: 'A',
        regla_vencimiento: 'dia_del_mes',
        dia_del_mes: dia,
      })
      assert.equal(resultado.valido, false, String(dia))
      assert.match(resultado.errores.dia_del_mes, /1 a 28/)
      assert.match(resultado.errores.dia_del_mes, /Fin de mes/)
    }
    for (const dia of ['1', 28, '15', ' 7 ']) {
      assert.equal(
        validarDatosTipo({ nombre: 'A', regla_vencimiento: 'dia_del_mes', dia_del_mes: dia })
          .valido,
        true,
        String(dia),
      )
    }
  })
})

describe('tipoActividadService con vencimiento', () => {
  it('crearTipo envía la regla y el día solo cuando se reciben', async () => {
    const api = crearApiFalsa((metodo, url, cuerpo) => ({ data: { tipo: { id: 9, ...cuerpo } } }))
    const servicio = crearTipoActividadService({ api })
    await servicio.crearTipo({
      nombre: ' Declaración ',
      cobrable: true,
      regla_vencimiento: 'dia_del_mes',
      dia_del_mes: 3,
    })
    assert.deepEqual(api.llamadas[0].cuerpo, {
      nombre: 'Declaración',
      cobrable: true,
      regla_vencimiento: 'dia_del_mes',
      dia_del_mes: 3,
    })
    await servicio.crearTipo({ nombre: 'Otro', cobrable: false, regla_vencimiento: 'fin_de_mes' })
    assert.deepEqual(api.llamadas[1].cuerpo, {
      nombre: 'Otro',
      cobrable: false,
      regla_vencimiento: 'fin_de_mes',
    })
  })

  it('actualizarTipo envía la regla y el día', async () => {
    const api = crearApiFalsa(() => ({ data: { tipo: { id: 4 } } }))
    await crearTipoActividadService({ api }).actualizarTipo(4, {
      regla_vencimiento: 'dia_del_mes',
      dia_del_mes: 12,
    })
    assert.deepEqual(api.llamadas[0].cuerpo, { regla_vencimiento: 'dia_del_mes', dia_del_mes: 12 })
  })
})

describe('«Vencida» y «Vence pronto» de un renglón', () => {
  const hoy = '2026-11-13'

  it('un renglón pendiente cuya fecha ya pasó está vencido', () => {
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-12'), hoy), 'vencida')
    assert.equal(estadoDeVencimiento(fila('A', '2025-01-02'), hoy), 'vencida')
  })

  it('vence pronto de hoy a 3 días después (mismo umbral que los casos)', () => {
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-13'), hoy), 'pronto')
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-16'), hoy), 'pronto')
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-17'), hoy), null)
    assert.equal(
      estadoDeVencimiento(fila('A', '2026-12-02'), '2026-11-29'),
      'pronto',
      'cruza de mes',
    )
  })

  it('lo hecho y lo que no tiene fecha no llevan etiqueta', () => {
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-01', true), hoy), null)
    assert.equal(estadoDeVencimiento(fila('A', '2026-11-14', true), hoy), null)
    assert.equal(estadoDeVencimiento(fila('A', null), hoy), null)
  })

  it('contarVencidas cuenta solo lo pendiente y pasado', () => {
    const renglones = [
      fila('A', '2026-11-01'),
      fila('B', '2026-11-02', true),
      fila('C', '2026-11-20'),
      fila('D', null),
      fila('E', '2026-10-30'),
    ]
    assert.equal(contarVencidas(renglones, hoy), 2)
    assert.equal(contarVencidas([], hoy), 0)
  })

  it('textoDeVencimiento escribe DD-MM-AAAA sin pasar por Date', () => {
    assert.equal(textoDeVencimiento('2026-11-20'), 'Vence 20-11-2026')
    assert.equal(textoDeVencimiento('2024-01-02'), 'Vence 02-01-2024')
    assert.equal(textoDeVencimiento(null), '')
  })

  it('el nombre accesible incluye cliente, tipo, fecha y etiqueta', () => {
    const base = fila('Acme', '2026-11-12', false, { tipo: 'Revisión' })
    assert.equal(
      nombreAccesibleDeRenglon(base, hoy),
      'Marcar como hecha: Acme, Revisión. Vence 12-11-2026. Vencida.',
    )
    assert.equal(
      nombreAccesibleDeRenglon(fila('Acme', '2026-11-15', false, { tipo: 'Revisión' }), hoy),
      'Marcar como hecha: Acme, Revisión. Vence 15-11-2026. Vence pronto.',
    )
    assert.equal(
      nombreAccesibleDeRenglon(fila('Acme', '2026-12-30', false, { tipo: 'Revisión' }), hoy),
      'Marcar como hecha: Acme, Revisión. Vence 30-12-2026.',
    )
    assert.equal(
      nombreAccesibleDeRenglon(fila('Acme', null, false, { tipo: 'Revisión' }), hoy),
      'Marcar como hecha: Acme, Revisión.',
    )
    assert.equal(
      nombreAccesibleDeRenglon(
        fila('Acme', null, false, { tipo: 'Revisión', falta_rfc: true }),
        hoy,
      ),
      'Marcar como hecha: Acme, Revisión. Falta el RFC del cliente.',
    )
  })
})

describe('orden dentro del grupo', () => {
  it('primero lo pendiente por fecha (vencido arriba, sin fecha al final) y luego lo hecho', () => {
    const renglones = [
      fila('Ana', null),
      fila('Beto', '2026-11-20'),
      fila('Carla', '2026-11-05', true),
      fila('Dani', '2026-11-02'),
      fila('Eva', '2026-11-20'),
      fila('Fer', null, true),
      fila('Gus', '2026-11-10'),
    ]
    assert.deepEqual(
      ordenarPorVencimiento(renglones).map((r) => r.cliente),
      ['Dani', 'Gus', 'Beto', 'Eva', 'Ana', 'Carla', 'Fer'],
    )
  })

  it('no modifica la lista recibida y mantiene el orden por cliente en los empates', () => {
    const renglones = [fila('Zeta', '2026-11-20'), fila('Alfa', '2026-11-20')]
    const copia = [...renglones]
    const ordenados = ordenarPorVencimiento(renglones)
    assert.deepEqual(renglones, copia)
    assert.deepEqual(
      ordenados.map((r) => r.cliente),
      ['Zeta', 'Alfa'],
      'los empates conservan el orden de llegada (el backend ya los entrega por cliente)',
    )
  })

  it('agruparPorTipo ordena los renglones de cada grupo', () => {
    const grupos = agruparPorTipo([
      fila('Ana', null),
      fila('Beto', '2026-11-02'),
      fila('Carla', '2026-11-01', true, { tipo_id: 2, tipo: 'Otro' }),
      fila('Dani', '2026-11-03', false, { tipo_id: 2, tipo: 'Otro' }),
    ])
    assert.deepEqual(
      grupos[0].renglones.map((r) => r.cliente),
      ['Beto', 'Ana'],
    )
    assert.deepEqual(
      grupos[1].renglones.map((r) => r.cliente),
      ['Dani', 'Carla'],
    )
  })
})

describe('pantallas con vencimientos', () => {
  const lista = plantillaDe(leer('../src/components/ListaDelMes.vue'))
  const listaCompleta = leer('../src/components/ListaDelMes.vue')
  const formulario = plantillaDe(leer('../src/components/TipoActividadFormDialog.vue'))
  const formularioCompleto = leer('../src/components/TipoActividadFormDialog.vue')
  const tipos = plantillaDe(leer('../src/components/MisTiposActividad.vue'))

  it('la lista del mes muestra la fecha, las etiquetas y el aviso de RFC con su tooltip', () => {
    assert.match(lista, /Vencida/)
    assert.match(lista, /Vence pronto/)
    assert.match(lista, /textoDeVencimiento\(renglon\.vence\)/)
    assert.match(lista, /Falta el RFC del cliente/)
    assert.match(lista, /Clientes y tipos/, 'el tooltip dice dónde capturar el RFC')
    assert.match(lista, /nombreAccesibleDeRenglon\(renglon, hoy\)/)
  })

  it('el encabezado del mes dice cuántas están vencidas cuando hay alguna', () => {
    assert.match(lista, /totalVencidas > 0/)
    assert.match(lista, /vencidas/)
  })

  it('recarga y recalcula «hoy» al volver a la ventana', () => {
    assert.match(listaCompleta, /hoy\.value = hoyLocal\(\)/)
  })

  it('el formulario del tipo tiene «Vencimiento» y pide el día solo con «Día fijo del mes»', () => {
    assert.match(formulario, /Vencimiento/)
    assert.match(formulario, /<q-select/)
    assert.match(formulario, /REGLAS_VENCIMIENTO/)
    assert.match(formulario, /v-if="form\.regla_vencimiento === 'dia_del_mes'"/)
    assert.match(formulario, /Fin de mes/, 'la ayuda manda a «Fin de mes» para el último día')
    assert.match(formulario, /<label for="tipo-dia"/)
    assert.match(formulario, /<label for="tipo-vencimiento"/)
    assert.match(
      formulario,
      /<q-tooltip v-if="!selectorAbierto"/,
      'con la lista abierta el tooltip taparía la primera opción',
    )
    assert.match(formularioCompleto, /regla_vencimiento: form\.regla_vencimiento/)
    assert.match(formularioCompleto, /hayDatosSinGuardar/)
  })

  it('la fila del tipo muestra su regla en texto', () => {
    assert.match(tipos, /etiquetaDeRegla\(tipo\)/)
  })
})
