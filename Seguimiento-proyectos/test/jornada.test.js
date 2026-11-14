// Rebanada 15: jornada (entrada, descanso y salida) de «Mis actividades».

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { crearJornadaService } from '../src/services/jornadaService.js'
import {
  OPCIONES_JORNADA_BASE,
  PASOS,
  fechaDeHoy,
  jornadaAbierta,
  leerJornadaPlegada,
  guardarJornadaPlegada,
  minutosSinAsignar,
  puedeSalirSinDescanso,
  resumenDeJornada,
  siguientePaso,
  textoDeHorasTrabajadas,
  textoDeTiempoAsignado,
  validarHorasJornada,
} from '../src/utils/jornada.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

const dia = (entrada, salida_descanso, regreso_descanso, salida) => ({
  fecha: '2026-11-13',
  entrada: entrada ?? null,
  salida_descanso: salida_descanso ?? null,
  regreso_descanso: regreso_descanso ?? null,
  salida: salida ?? null,
})

// Api falsa: registra cada llamada y responde con el manejador recibido.
const crearApiFalsa = (responder) => {
  const llamadas = []
  const registrar = (metodo) => async (url, segundo, tercero) => {
    llamadas.push({ metodo, url, segundo, tercero })
    return responder(metodo, url, segundo)
  }
  return { llamadas, get: registrar('get'), post: registrar('post'), put: registrar('put') }
}

describe('siguientePaso: el botón único de la tarjeta', () => {
  it('sigue la secuencia entrada → descanso → regreso → salida', () => {
    assert.deepEqual(PASOS, ['entrada', 'salida_descanso', 'regreso_descanso', 'salida'])
    assert.equal(siguientePaso(null).paso, 'entrada')
    assert.equal(siguientePaso(null).etiqueta, 'Registrar entrada')
    assert.equal(siguientePaso(dia()).paso, 'entrada')
    assert.equal(siguientePaso(dia('09:00')).paso, 'salida_descanso')
    assert.equal(siguientePaso(dia('09:00')).etiqueta, 'Salir a descanso')
    assert.equal(siguientePaso(dia('09:00', '14:00')).paso, 'regreso_descanso')
    assert.equal(siguientePaso(dia('09:00', '14:00')).etiqueta, 'Regresar de descanso')
    assert.equal(siguientePaso(dia('09:00', '14:00', '15:00')).paso, 'salida')
    assert.equal(siguientePaso(dia('09:00', '14:00', '15:00')).etiqueta, 'Registrar salida')
  })

  it('con la salida registrada ya no hay paso que seguir', () => {
    assert.equal(siguientePaso(dia('09:00', null, null, '18:00')), null)
    assert.equal(siguientePaso(dia('09:00', '14:00', '15:00', '18:00')), null)
  })

  it('solo desde la entrada se puede registrar la salida sin descanso', () => {
    assert.equal(puedeSalirSinDescanso(null), false)
    assert.equal(puedeSalirSinDescanso(dia()), false)
    assert.equal(puedeSalirSinDescanso(dia('09:00')), true)
    assert.equal(puedeSalirSinDescanso(dia('09:00', '14:00')), false)
    assert.equal(puedeSalirSinDescanso(dia('09:00', null, null, '18:00')), false)
  })

  it('la jornada está abierta desde la entrada hasta la salida', () => {
    assert.equal(jornadaAbierta(null), false)
    assert.equal(jornadaAbierta(dia('09:00')), true)
    assert.equal(jornadaAbierta(dia('09:00', null, null, '18:00')), false)
  })
})

describe('textos de horas trabajadas y tiempo asignado', () => {
  it('compara con la jornada base y avisa las horas extra', () => {
    assert.deepEqual(textoDeHorasTrabajadas({ minutos: 370, baseMinutos: 480, cerrada: false }), {
      texto: 'Llevas 6 h 10 min de 8 h',
      extra: false,
    })
    assert.deepEqual(textoDeHorasTrabajadas({ minutos: 555, baseMinutos: 480, cerrada: false }), {
      texto: '1 h 15 min extra',
      extra: true,
    })
    assert.equal(
      textoDeHorasTrabajadas({ minutos: 480, baseMinutos: 480, cerrada: false }).texto,
      'Completaste tus 8 h',
    )
    assert.equal(
      textoDeHorasTrabajadas({ minutos: 0, baseMinutos: 480, cerrada: false }).texto,
      'Llevas 0 min de 8 h',
    )
    assert.equal(
      textoDeHorasTrabajadas({ minutos: 370, baseMinutos: 510, cerrada: true }).texto,
      'Trabajaste 6 h 10 min de 8 h 30 min',
    )
    assert.equal(
      textoDeHorasTrabajadas({ minutos: 555, baseMinutos: 480, cerrada: true }).texto,
      '1 h 15 min extra',
    )
  })

  it('lo sin asignar nunca es negativo', () => {
    assert.equal(minutosSinAsignar(370, 120), 250)
    assert.equal(minutosSinAsignar(100, 130), 0, 'más tiempo en actividades que jornada: 0')
    assert.equal(minutosSinAsignar(0, 0), 0)
  })

  it('el texto de tiempo asignado dice cuánto está asignado y cuánto no', () => {
    assert.equal(
      textoDeTiempoAsignado({ trabajados: 370, asignados: 120 }),
      'Asignado a actividades: 2 h · Sin asignar: 4 h 10 min',
    )
    assert.equal(
      textoDeTiempoAsignado({ trabajados: 0, asignados: 0 }),
      'Asignado a actividades: 0 min · Sin asignar: 0 min',
    )
  })

  it('el resumen de la tarjeta plegada dice en qué va el día', () => {
    assert.equal(resumenDeJornada(null, 0), 'Aún no registras tu entrada.')
    assert.equal(resumenDeJornada(dia('09:00'), 40), 'Entrada 09:00 · llevas 40 min de trabajo')
    assert.equal(
      resumenDeJornada(dia('09:00', '14:00'), 300),
      'En descanso desde las 14:00 · llevas 5 h de trabajo',
    )
    assert.equal(
      resumenDeJornada(dia('09:00', null, null, '17:30'), 510),
      'Jornada cerrada: trabajaste 8 h 30 min',
    )
  })
})

describe('validarHorasJornada', () => {
  it('acepta lo vacío y el orden correcto', () => {
    assert.equal(validarHorasJornada(dia()).valido, true)
    assert.equal(validarHorasJornada(dia('09:00')).valido, true)
    assert.equal(validarHorasJornada(dia('09:00', '14:00', '15:00', '18:00')).valido, true)
    assert.equal(validarHorasJornada(dia('09:00', null, null, '18:00')).valido, true)
    assert.equal(validarHorasJornada(dia('09:00', '09:00', '09:00', '09:00')).valido, true)
  })

  it('rechaza el orden equivocado, el regreso sin salida y lo que no es una hora', () => {
    const orden = validarHorasJornada(dia('09:00', '14:00', '13:00', '18:00'))
    assert.equal(orden.valido, false)
    assert.match(orden.errores.regreso_descanso, /igual o posterior a la de salida a descanso/)

    const salida = validarHorasJornada(dia('09:00', null, null, '08:00'))
    assert.match(salida.errores.salida, /igual o posterior a la de entrada/)

    const regreso = validarHorasJornada(dia('09:00', null, '15:00'))
    assert.match(regreso.errores.regreso_descanso, /salida a descanso/)

    const sinEntrada = validarHorasJornada(dia(null, null, null, '18:00'))
    assert.match(sinEntrada.errores.entrada, /Falta la entrada/)

    for (const mala of ['9:00', '24:00', '09:60', 'abc', '0900']) {
      const formato = validarHorasJornada(dia(mala))
      assert.equal(formato.valido, false, mala)
      assert.match(formato.errores.entrada, /HH:MM/)
    }
  })

  it('entrega las horas limpias (vacío como null)', () => {
    const resultado = validarHorasJornada({
      entrada: ' 09:00 ',
      salida_descanso: '',
      regreso_descanso: null,
      salida: '',
    })
    assert.equal(resultado.valido, true)
    assert.deepEqual(resultado.horas, {
      entrada: '09:00',
      salida_descanso: null,
      regreso_descanso: null,
      salida: null,
    })
  })
})

describe('jornada base y fecha de hoy', () => {
  it('ofrece de 1 a 16 horas en medias horas', () => {
    assert.equal(OPCIONES_JORNADA_BASE.length, 31)
    assert.deepEqual(OPCIONES_JORNADA_BASE[0], { label: '1 h', value: 60 })
    assert.deepEqual(OPCIONES_JORNADA_BASE[1], { label: '1 h 30 min', value: 90 })
    assert.deepEqual(OPCIONES_JORNADA_BASE.at(-1), { label: '16 h', value: 960 })
    assert.ok(OPCIONES_JORNADA_BASE.some((o) => o.value === 480 && o.label === '8 h'))
  })

  it('la fecha de hoy se arma con partes locales, sin new Date(texto)', () => {
    assert.equal(fechaDeHoy(new Date(2026, 10, 5, 23, 59)), '2026-11-05')
    assert.equal(fechaDeHoy(new Date(2026, 0, 1, 0, 0)), '2026-01-01')
  })
})

describe('plegado de la tarjeta (se recuerda en el equipo)', () => {
  const crearAlmacen = (inicial = {}) => {
    const datos = { ...inicial }
    return { getItem: (k) => datos[k] ?? null, setItem: (k, v) => (datos[k] = String(v)), datos }
  }

  it('guarda y lee si quedó plegada; por defecto está desplegada', () => {
    const almacen = crearAlmacen()
    assert.equal(leerJornadaPlegada(almacen), false)
    guardarJornadaPlegada(true, almacen)
    assert.equal(leerJornadaPlegada(almacen), true)
    guardarJornadaPlegada(false, almacen)
    assert.equal(leerJornadaPlegada(almacen), false)
  })

  it('un almacén bloqueado o ausente no rompe la pantalla', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    assert.equal(leerJornadaPlegada(roto), false)
    assert.doesNotThrow(() => guardarJornadaPlegada(true, roto))
    assert.equal(leerJornadaPlegada(null), false)
    assert.doesNotThrow(() => guardarJornadaPlegada(true, null))
  })
})

describe('jornadaService', () => {
  const respuestaHoy = {
    jornada: null,
    minutos_trabajados: 0,
    minutos_actividades: 0,
    jornada_base_minutos: 480,
    ahora: '2026-11-13 09:00:00',
  }

  it('obtenerHoy pide /jornadas/hoy y valida la forma', async () => {
    const api = crearApiFalsa(async () => ({ data: respuestaHoy }))
    const servicio = crearJornadaService({ api })
    assert.deepEqual(await servicio.obtenerHoy(), respuestaHoy)
    assert.equal(api.llamadas[0].url, '/jornadas/hoy')

    const mala = crearJornadaService({
      api: crearApiFalsa(async () => ({ data: { jornada: null } })),
    })
    await assert.rejects(mala.obtenerHoy(), (e) => typeof e.mensaje === 'string')
  })

  it('marcarPaso envía solo el paso y devuelve la jornada', async () => {
    const api = crearApiFalsa(async () => ({ data: { jornada: dia('09:00') } }))
    const servicio = crearJornadaService({ api })
    const jornada = await servicio.marcarPaso('entrada')
    assert.equal(jornada.entrada, '09:00')
    assert.deepEqual(api.llamadas[0], {
      metodo: 'post',
      url: '/jornadas/hoy/marcar',
      segundo: { paso: 'entrada' },
      tercero: undefined,
    })
  })

  it('listarMes pide el mes y devuelve la lista', async () => {
    const api = crearApiFalsa(async () => ({ data: { jornadas: [dia('09:00')] } }))
    const servicio = crearJornadaService({ api })
    const jornadas = await servicio.listarMes('2026-11')
    assert.equal(jornadas.length, 1)
    assert.deepEqual(api.llamadas[0].segundo, { params: { mes: '2026-11' } })
  })

  it('corregir envía las cuatro horas a /jornadas/:fecha; 204 devuelve null', async () => {
    const horas = {
      entrada: '09:00',
      salida_descanso: null,
      regreso_descanso: null,
      salida: '17:00',
    }
    const api = crearApiFalsa(async () => ({ status: 200, data: { jornada: dia('09:00') } }))
    const servicio = crearJornadaService({ api })
    assert.equal((await servicio.corregir('2026-11-12', horas)).entrada, '09:00')
    assert.equal(api.llamadas[0].url, '/jornadas/2026-11-12')
    assert.deepEqual(api.llamadas[0].segundo, horas)

    const vaciaApi = crearApiFalsa(async () => ({ status: 204, data: '' }))
    assert.equal(await crearJornadaService({ api: vaciaApi }).corregir('2026-11-12', {}), null)
  })

  it('guardarAjustes envía los minutos de la jornada base', async () => {
    const api = crearApiFalsa(async () => ({ data: { jornada_base_minutos: 510 } }))
    const servicio = crearJornadaService({ api })
    assert.equal(await servicio.guardarAjustes(510), 510)
    assert.equal(api.llamadas[0].url, '/jornadas/ajustes')
    assert.deepEqual(api.llamadas[0].segundo, { jornada_base_minutos: 510 })
  })
})

describe('JornadaDeHoy y JornadaFormDialog (plantillas)', () => {
  it('los archivos de la rebanada existen', () => {
    for (const archivo of [
      '../src/components/JornadaDeHoy.vue',
      '../src/components/JornadaFormDialog.vue',
      '../src/services/jornadaService.js',
      '../src/utils/jornada.js',
    ]) {
      assert.ok(existsSync(ruta(archivo)), archivo)
    }
  })

  it('la tarjeta va arriba de «Mis actividades», antes de las vistas y del conmutador', () => {
    const plantilla = plantillaDe(leer('../src/components/MisActividades.vue'))
    const jornada = plantilla.indexOf('<JornadaDeHoy')
    assert.ok(jornada > -1)
    assert.ok(jornada < plantilla.indexOf('<q-btn-toggle'), 'antes del conmutador de vistas')
    assert.ok(jornada < plantilla.indexOf('<ListaDelMes'))
    assert.ok(jornada < plantilla.indexOf('<CalendarioActividades'))
    assert.match(plantilla, /<JornadaDeHoy\s*\/>/, 'sin v-if: visible en todas las vistas')
  })

  it('la tarjeta tiene el botón del paso, «Corregir horas», jornada base y recuerda el plegado', () => {
    const fuente = leer('../src/components/JornadaDeHoy.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /Mi jornada de hoy/)
    assert.match(plantilla, /<q-expansion-item/)
    assert.match(plantilla, /siguiente\.etiqueta/)
    assert.match(plantilla, /Registrar salida/)
    assert.match(plantilla, /Corregir horas/)
    assert.match(plantilla, /Jornada base/)
    assert.match(plantilla, /<JornadaFormDialog/)
    assert.match(fuente, /guardarJornadaPlegada/)
    assert.match(fuente, /leerJornadaPlegada/)
    assert.match(fuente, /visibilitychange/)
    assert.match(plantilla, /<q-tooltip/)
    assert.doesNotMatch(
      plantilla,
      /#[0-9a-fA-F]{3,6}\b/,
      'colores desde la paleta, sin hexadecimales',
    )
  })

  it('el diálogo protege los cambios sin guardar y no usa new Date(texto)', () => {
    const fuente = leer('../src/components/JornadaFormDialog.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /:persistent="guardando \|\| hayDatosSinGuardar"/)
    assert.match(plantilla, /@shake="pedirDescartar"/)
    assert.match(plantilla, /dialogo-entra/)
    assert.match(plantilla, /for="jornada-fecha"/)
    assert.match(plantilla, /aria-hidden="true" class="required-mark"/)
    assert.match(fuente, /focus: 'cancel'/)
    assert.match(fuente, /enfocarPrimerError/)
    assert.doesNotMatch(fuente, /new Date\(\s*['"`]/)
    assert.doesNotMatch(fuente, /new Date\([a-zA-Z.]*(fecha|texto)[a-zA-Z.]*\)/)
  })
})
