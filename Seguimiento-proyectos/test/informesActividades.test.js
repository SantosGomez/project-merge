// Rebanada 16: informes de horas de «Mis actividades» (periodo, barras, CSV y servicio).

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearInformeService } from '../src/services/informeService.js'
import {
  BOM,
  COLUMNAS_CSV,
  armarCsv,
  descargarCsv,
  escaparCampoCsv,
  horasDelBloque,
  minutosAHoras,
  neutralizarFormula,
  nombreArchivoCsv,
  periodoDelMes,
  proporcion,
  textoDeBarra,
  validarPeriodo,
} from '../src/utils/informes.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

const bloque = (cambios = {}) => ({
  id: 1,
  fecha: '2026-10-05',
  cliente_id: 1,
  cliente: 'Abarrotes López',
  tipo_id: 1,
  tipo: 'Declaración mensual',
  inicio: '2026-10-05 09:00:00',
  fin: '2026-10-05 10:30:00',
  minutos: 90,
  cobrable: true,
  manual: false,
  ...cambios,
})

// Quita el BOM y separa las líneas de un CSV sin comillas con saltos (los casos con saltos se prueban aparte).
const lineas = (csv) => csv.replace(BOM, '').split('\r\n')

describe('neutralizarFormula', () => {
  it('antepone un apóstrofo al texto que empieza con = + - @ (y tabulador o retorno)', () => {
    for (const inicio of ['=', '+', '-', '@', '\t', '\r']) {
      assert.equal(neutralizarFormula(`${inicio}SUMA(A1)`), `'${inicio}SUMA(A1)`)
    }
  })

  it('no toca el texto normal, los números ni lo vacío', () => {
    assert.equal(neutralizarFormula('Abarrotes'), 'Abarrotes')
    assert.equal(neutralizarFormula('A=B'), 'A=B')
    assert.equal(neutralizarFormula(' =x'), ' =x')
    assert.equal(neutralizarFormula(90), 90)
    assert.equal(neutralizarFormula(''), '')
  })
})

describe('escaparCampoCsv', () => {
  it('deja sin comillas lo simple', () => {
    assert.equal(escaparCampoCsv('Abarrotes López'), 'Abarrotes López')
    assert.equal(escaparCampoCsv(90), '90')
  })

  it('entrecomilla las comas, duplica las comillas y conserva los saltos de línea', () => {
    assert.equal(escaparCampoCsv('López, Hnos.'), '"López, Hnos."')
    assert.equal(escaparCampoCsv('El "Güero"'), '"El ""Güero"""')
    assert.equal(escaparCampoCsv('Línea 1\nLínea 2'), '"Línea 1\nLínea 2"')
    assert.equal(escaparCampoCsv('Línea 1\r\nLínea 2'), '"Línea 1\r\nLínea 2"')
  })

  it('neutraliza la fórmula y después entrecomilla si hace falta', () => {
    assert.equal(escaparCampoCsv('=1+1'), "'=1+1")
    assert.equal(escaparCampoCsv('=SUMA(A1,A2)'), '"\'=SUMA(A1,A2)"')
    assert.equal(escaparCampoCsv('@cliente'), "'@cliente")
  })
})

describe('minutosAHoras y horasDelBloque', () => {
  it('pasa minutos a horas decimales con dos decimales y punto', () => {
    assert.equal(minutosAHoras(90), '1.50')
    assert.equal(minutosAHoras(1), '0.02')
    assert.equal(minutosAHoras(0), '0.00')
    assert.equal(minutosAHoras(125), '2.08')
    assert.equal(minutosAHoras(null), '0.00')
  })

  it('muestra inicio y fin como HH:MM y agrega la fecha si el bloque termina otro día', () => {
    assert.deepEqual(horasDelBloque(bloque()), { inicio: '09:00', fin: '10:30' })
    assert.deepEqual(
      horasDelBloque(bloque({ inicio: '2026-10-05 23:30:00', fin: '2026-10-06 00:30:00' })),
      { inicio: '23:30', fin: '06-10-2026 00:30' },
    )
  })
})

describe('armarCsv', () => {
  it('empieza con el BOM UTF-8 y el encabezado de nueve columnas, separado por comas', () => {
    const csv = armarCsv([])
    assert.equal(csv.charCodeAt(0), 0xfeff)
    assert.deepEqual(COLUMNAS_CSV, [
      'Fecha',
      'Cliente',
      'Tipo',
      'Inicio',
      'Fin',
      'Minutos',
      'Horas',
      'Cobrable',
      'A mano',
    ])
    assert.equal(csv, `${BOM}Fecha,Cliente,Tipo,Inicio,Fin,Minutos,Horas,Cobrable,A mano`)
  })

  it('arma una fila por bloque, en el orden recibido, con Sí o No', () => {
    const csv = armarCsv([
      bloque(),
      bloque({ id: 2, fecha: '2026-10-04', minutos: 45, cobrable: false, manual: true }),
    ])
    assert.deepEqual(lineas(csv), [
      'Fecha,Cliente,Tipo,Inicio,Fin,Minutos,Horas,Cobrable,A mano',
      '2026-10-05,Abarrotes López,Declaración mensual,09:00,10:30,90,1.50,Sí,No',
      '2026-10-04,Abarrotes López,Declaración mensual,09:00,10:30,45,0.75,No,Sí',
    ])
  })

  it('escapa comas y comillas, neutraliza fórmulas y conserva saltos de línea dentro de un nombre', () => {
    const csv = armarCsv([
      bloque({ cliente: 'López, Hnos. "Sur"', tipo: '=HIPERVINCULO("x")' }),
      bloque({ cliente: 'Primera línea\nSegunda línea', tipo: '-Revisión' }),
      bloque({ cliente: '+52 55', tipo: '@tipo' }),
    ])
    const cuerpo = csv.replace(BOM, '')
    assert.ok(cuerpo.includes('"López, Hnos. ""Sur"""'))
    assert.ok(cuerpo.includes('"\'=HIPERVINCULO(""x"")"'))
    assert.ok(cuerpo.includes('"Primera línea\nSegunda línea"'))
    assert.ok(cuerpo.includes(",'-Revisión,"))
    assert.ok(cuerpo.includes(",'+52 55,'@tipo,"))
    // Ningún campo de texto queda empezando con un carácter de fórmula
    assert.ok(
      !/(^|,)[=+\-@]/m.test(
        cuerpo
          .split('\r\n')
          .slice(1)
          .join('\r\n')
          .replace(/"[^"]*"/g, '""'),
      ),
    )
  })
})

describe('nombreArchivoCsv', () => {
  it('usa actividades_AAAA-MM-DD_a_AAAA-MM-DD.csv con el periodo filtrado', () => {
    assert.equal(
      nombreArchivoCsv('2026-11-01', '2026-11-30'),
      'actividades_2026-11-01_a_2026-11-30.csv',
    )
  })
})

describe('descargarCsv', () => {
  it('crea un Blob UTF-8 con el contenido, dispara la descarga con el nombre y libera la dirección', () => {
    const eventos = []
    const enlace = {
      click() {
        eventos.push('click')
      },
      remove() {
        eventos.push('remove')
      },
    }
    const documento = {
      createElement: (etiqueta) => {
        eventos.push(`crear:${etiqueta}`)
        return enlace
      },
      body: {
        appendChild: () => eventos.push('agregar'),
      },
    }
    let blobRecibido = null
    const urlApi = {
      createObjectURL: (blob) => {
        blobRecibido = blob
        return 'blob:prueba'
      },
      revokeObjectURL: (url) => eventos.push(`liberar:${url}`),
    }
    descargarCsv(`${BOM}a,b`, 'actividades_2026-11-01_a_2026-11-30.csv', { documento, urlApi })
    assert.equal(enlace.href, 'blob:prueba')
    assert.equal(enlace.download, 'actividades_2026-11-01_a_2026-11-30.csv')
    assert.match(blobRecibido.type, /^text\/csv/)
    assert.deepEqual(eventos, ['crear:a', 'agregar', 'click', 'remove', 'liberar:blob:prueba'])
  })

  it('el Blob lleva los bytes EF BB BF al inicio (BOM) y el texto en UTF-8', async () => {
    let blobRecibido = null
    descargarCsv(armarCsv([bloque()]), 'x.csv', {
      documento: {
        createElement: () => ({ click() {}, remove() {} }),
        body: { appendChild() {} },
      },
      urlApi: {
        createObjectURL: (blob) => {
          blobRecibido = blob
          return 'blob:x'
        },
        revokeObjectURL() {},
      },
    })
    const bytes = new Uint8Array(await blobRecibido.arrayBuffer())
    assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf])
    assert.ok(new TextDecoder().decode(bytes.slice(3)).includes('Abarrotes López'))
  })
})

describe('periodoDelMes', () => {
  it('va del día 1 al último día del mes en DD-MM-AAAA', () => {
    assert.deepEqual(periodoDelMes(new Date(2026, 10, 13)), {
      desde: '01-11-2026',
      hasta: '30-11-2026',
    })
    assert.deepEqual(periodoDelMes(new Date(2026, 9, 31)), {
      desde: '01-10-2026',
      hasta: '31-10-2026',
    })
    assert.deepEqual(periodoDelMes(new Date(2028, 1, 10)), {
      desde: '01-02-2028',
      hasta: '29-02-2028',
    })
  })
})

describe('validarPeriodo', () => {
  it('acepta un periodo y lo entrega como AAAA-MM-DD', () => {
    const resultado = validarPeriodo({ desde: '01-11-2026', hasta: '30-11-2026' })
    assert.equal(resultado.valido, true)
    assert.equal(resultado.desde, '2026-11-01')
    assert.equal(resultado.hasta, '2026-11-30')
  })

  it('acepta un solo día y exactamente 366 días', () => {
    assert.equal(validarPeriodo({ desde: '13-11-2026', hasta: '13-11-2026' }).valido, true)
    assert.equal(validarPeriodo({ desde: '01-01-2024', hasta: '31-12-2024' }).valido, true)
  })

  it('pide cada fecha si falta o no es una fecha real', () => {
    const vacio = validarPeriodo({ desde: '', hasta: '' })
    assert.equal(vacio.valido, false)
    assert.match(vacio.errores.desde, /Desde/)
    assert.match(vacio.errores.hasta, /Hasta/)
    assert.match(
      validarPeriodo({ desde: '31-02-2026', hasta: '01-03-2026' }).errores.desde,
      /DD-MM-AAAA/,
    )
    assert.match(
      validarPeriodo({ desde: '01-03-2026', hasta: '2026-03-05' }).errores.hasta,
      /DD-MM-AAAA/,
    )
    assert.match(
      validarPeriodo({ desde: '1-3-2026', hasta: '05-03-2026' }).errores.desde,
      /DD-MM-AAAA/,
    )
  })

  it('rechaza «Desde» posterior a «Hasta»', () => {
    const resultado = validarPeriodo({ desde: '02-11-2026', hasta: '01-11-2026' })
    assert.equal(resultado.valido, false)
    assert.match(resultado.errores.hasta, /igual o posterior/)
  })

  it('rechaza más de 366 días', () => {
    const resultado = validarPeriodo({ desde: '01-01-2024', hasta: '01-01-2025' })
    assert.equal(resultado.valido, false)
    assert.match(resultado.errores.hasta, /366/)
    assert.equal(validarPeriodo({ desde: '01-01-2026', hasta: '02-01-2027' }).valido, false)
  })
})

describe('barras: proporción y texto', () => {
  it('la proporción va de 0 a 1 y es 0 sin total', () => {
    assert.equal(proporcion(30, 120), 0.25)
    assert.equal(proporcion(120, 120), 1)
    assert.equal(proporcion(10, 0), 0)
    assert.equal(proporcion(500, 120), 1)
  })

  it('el texto de la barra trae las horas y el porcentaje', () => {
    assert.equal(textoDeBarra({ minutos: 150, porcentaje: 45 }), '2 h 30 min · 45 %')
    assert.equal(textoDeBarra({ minutos: 45, porcentaje: 5 }), '45 min · 5 %')
  })
})

describe('informeService', () => {
  const respuestaValida = {
    resumen: {
      minutos_total: 0,
      minutos_cobrables: 0,
      minutos_no_cobrables: 0,
      dias_con_tiempo: 0,
      jornada: null,
    },
    por_cliente: [],
    por_tipo: [],
    bloques: [],
    jornadas: [],
  }

  const crearApiFalsa = (responder) => {
    const llamadas = []
    return {
      llamadas,
      get: async (url, opciones) => {
        llamadas.push({ url, opciones })
        return responder(url, opciones)
      },
    }
  }

  it('pide GET /informes/tiempo con el periodo y solo los filtros elegidos', async () => {
    const api = crearApiFalsa(async () => ({ data: respuestaValida }))
    const servicio = crearInformeService({ api })
    const informe = await servicio.obtenerTiempo({ desde: '2026-11-01', hasta: '2026-11-30' })
    assert.deepEqual(informe, respuestaValida)
    assert.equal(api.llamadas[0].url, '/informes/tiempo')
    assert.deepEqual(api.llamadas[0].opciones.params, { desde: '2026-11-01', hasta: '2026-11-30' })

    await servicio.obtenerTiempo({
      desde: '2026-11-01',
      hasta: '2026-11-30',
      cliente_id: 4,
      tipo_id: null,
    })
    assert.deepEqual(api.llamadas[1].opciones.params, {
      desde: '2026-11-01',
      hasta: '2026-11-30',
      cliente_id: 4,
    })
  })

  it('rechaza una respuesta sin la forma esperada con el error de tres partes', async () => {
    const servicio = crearInformeService({
      api: crearApiFalsa(async () => ({ data: { resumen: {}, bloques: [] } })),
    })
    await assert.rejects(
      () => servicio.obtenerTiempo({ desde: '2026-11-01', hasta: '2026-11-30' }),
      (error) => error.estado === 'respuesta_inesperada' && /informe de horas/.test(error.mensaje),
    )
  })
})

describe('vista «Informes» de Mis actividades', () => {
  it('existen el componente, el servicio y la utilidad', () => {
    assert.ok(existsSync(ruta('../src/components/InformesActividades.vue')))
    assert.ok(existsSync(ruta('../src/services/informeService.js')))
    assert.ok(existsSync(ruta('../src/utils/informes.js')))
  })

  it('el conmutador tiene cuatro vistas y «Informes» va en ?vista=informes', () => {
    const fuente = leer('../src/components/MisActividades.vue')
    assert.match(fuente, /label: 'Informes', value: 'informes'/)
    assert.match(fuente, /const VISTAS = \['calendario', 'catalogos', 'informes'\]/)
    assert.match(plantillaDe(fuente), /<InformesActividades\s+v-else-if="vista === 'informes'"/)
    for (const etiqueta of ['Lista del mes', 'Calendario', 'Clientes y tipos']) {
      assert.ok(fuente.includes(`label: '${etiqueta}'`))
    }
  })

  it('el informe usa componentes de Quasar, tooltips, estados y descarga del CSV', () => {
    const fuente = leer('../src/components/InformesActividades.vue')
    const plantilla = plantillaDe(fuente)
    for (const etiqueta of [
      'q-card',
      'q-input',
      'q-select',
      'q-date',
      'q-btn',
      'q-linear-progress',
      'q-table',
      'q-tooltip',
    ]) {
      assert.ok(plantilla.includes(`<${etiqueta}`), etiqueta)
    }
    assert.match(plantilla, /label="Este mes"/)
    assert.match(plantilla, /label="Descargar CSV"/)
    assert.match(plantilla, /Reintentar|@retry/)
    assert.match(fuente, /No registraste tiempo en este periodo\./)
    assert.match(fuente, /armarCsv/)
    assert.match(fuente, /descargarCsv/)
    assert.match(fuente, /obtenerTiempo/)
    // Sin importes ni tarifas
    assert.doesNotMatch(plantilla, /tarifa|importe/i)
  })

  it('no usa colores sueltos: solo la paleta dg-*', () => {
    const estilos = leer('../src/components/InformesActividades.vue').split('<style')[1] ?? ''
    assert.doesNotMatch(estilos, /#[0-9a-fA-F]{3,8}\b/)
  })
})
