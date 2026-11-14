// Rebanada 14: cronómetro y bloques de tiempo de «Mis actividades».

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createPinia, setActivePinia } from 'pinia'

import { crearTiempoService } from '../src/services/tiempoService.js'
import { crearCronometroStore } from '../src/stores/cronometro.js'
import {
  agruparPorTipo,
  formatearCronometro,
  formatearDuracion,
  minutosDelMes,
  parsearHoraDelServidor,
  segundosEntre,
  totalesDelMes,
  validarMinutosManual,
} from '../src/utils/actividades.js'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => readFileSync(ruta(relativa), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]

// Api falsa: registra cada llamada y responde con el manejador recibido.
const crearApiFalsa = (responder) => {
  const llamadas = []
  const registrar = (metodo) => async (url, segundo) => {
    llamadas.push({ metodo, url, segundo })
    return responder(metodo, url, segundo)
  }
  return {
    llamadas,
    get: registrar('get'),
    post: registrar('post'),
    delete: registrar('delete'),
  }
}

const bloque = (extra = {}) => ({
  id: 1,
  cliente_id: 10,
  tipo_id: 5,
  mes: '2026-11',
  inicio: '2026-11-13 09:00:00',
  fin: null,
  minutos: null,
  cobrable: false,
  manual: false,
  cliente: 'Abarrotes',
  tipo: 'IVA',
  ...extra,
})

describe('formatearDuracion', () => {
  it('escribe minutos, horas y horas con minutos', () => {
    assert.equal(formatearDuracion(0), '0 min')
    assert.equal(formatearDuracion(1), '1 min')
    assert.equal(formatearDuracion(45), '45 min')
    assert.equal(formatearDuracion(60), '1 h')
    assert.equal(formatearDuracion(80), '1 h 20 min')
    assert.equal(formatearDuracion(125), '2 h 5 min')
    assert.equal(formatearDuracion(1440), '24 h')
  })

  it('trata lo que no es un número válido como cero', () => {
    assert.equal(formatearDuracion(undefined), '0 min')
    assert.equal(formatearDuracion(null), '0 min')
    assert.equal(formatearDuracion(-3), '0 min')
  })
})

describe('formatearCronometro', () => {
  it('da H:MM:SS con minutos y segundos de dos cifras', () => {
    assert.equal(formatearCronometro(0), '0:00:00')
    assert.equal(formatearCronometro(5), '0:00:05')
    assert.equal(formatearCronometro(69), '0:01:09')
    assert.equal(formatearCronometro(3661), '1:01:01')
    assert.equal(formatearCronometro(10 * 3600 + 59), '10:00:59')
    assert.equal(formatearCronometro(-4), '0:00:00')
  })
})

describe('hora del servidor', () => {
  it('lee AAAA-MM-DD HH:mm:ss como hora local sin usar new Date(texto)', () => {
    const fecha = parsearHoraDelServidor('2026-11-13 09:05:07')
    assert.equal(fecha.getFullYear(), 2026)
    assert.equal(fecha.getMonth(), 10)
    assert.equal(fecha.getDate(), 13)
    assert.equal(fecha.getHours(), 9)
    assert.equal(fecha.getMinutes(), 5)
    assert.equal(fecha.getSeconds(), 7)
    assert.equal(parsearHoraDelServidor('no es fecha'), null)
    assert.equal(parsearHoraDelServidor(null), null)
  })

  it('segundosEntre calcula el tiempo transcurrido con las horas del servidor', () => {
    assert.equal(segundosEntre('2026-11-13 09:00:00', '2026-11-13 09:01:30'), 90)
    assert.equal(segundosEntre('2026-11-13 23:59:30', '2026-11-14 00:00:30'), 60)
    assert.equal(segundosEntre('2026-11-13 09:00:10', '2026-11-13 09:00:00'), 0, 'nunca negativo')
    assert.equal(segundosEntre('x', '2026-11-13 09:00:00'), 0)
  })
})

describe('validarMinutosManual', () => {
  it('acepta enteros de 1 a 1440 (también escritos como texto)', () => {
    assert.deepEqual(validarMinutosManual('25'), { valido: true, minutos: 25 })
    assert.deepEqual(validarMinutosManual(' 1 '), { valido: true, minutos: 1 })
    assert.deepEqual(validarMinutosManual(1440), { valido: true, minutos: 1440 })
  })

  it('rechaza vacío, cero, negativos, decimales, texto y más de 1440, y dice qué corregir', () => {
    for (const valor of [
      '',
      '   ',
      null,
      undefined,
      '0',
      '-5',
      '1.5',
      '2,5',
      'abc',
      '1441',
      1441,
    ]) {
      const resultado = validarMinutosManual(valor)
      assert.equal(resultado.valido, false, String(valor))
      assert.match(resultado.error, /1 y 1440/)
    }
  })
})

describe('minutos por grupo y por mes', () => {
  const actividades = [
    { tipo_id: 1, tipo: 'Alfa', tipo_activo: true, cliente_id: 10, hecha: false, minutos: 80 },
    { tipo_id: 1, tipo: 'Alfa', tipo_activo: true, cliente_id: 11, hecha: true, minutos: 10 },
    { tipo_id: 2, tipo: 'Beta', tipo_activo: true, cliente_id: 10, hecha: false, minutos: 0 },
  ]

  it('cada grupo trae la suma de los minutos de sus renglones', () => {
    const grupos = agruparPorTipo(actividades)
    assert.deepEqual(
      grupos.map((g) => [g.tipo, g.minutos]),
      [
        ['Alfa', 90],
        ['Beta', 0],
      ],
    )
  })

  it('minutosDelMes suma los grupos sin cambiar totalesDelMes', () => {
    const grupos = agruparPorTipo(actividades)
    assert.equal(minutosDelMes(grupos), 90)
    assert.equal(minutosDelMes([]), 0)
    assert.deepEqual(totalesDelMes(grupos), { hechas: 1, total: 3 })
  })

  it('un renglón sin el campo minutos cuenta como cero', () => {
    const grupos = agruparPorTipo([{ tipo_id: 1, tipo: 'A', tipo_activo: true, hecha: false }])
    assert.equal(grupos[0].minutos, 0)
  })
})

describe('servicio de tiempo', () => {
  it('lee el cronómetro activo y la hora del servidor', async () => {
    const api = crearApiFalsa(() => ({
      data: { activo: bloque(), ahora: '2026-11-13 09:10:00' },
    }))
    const servicio = crearTiempoService({ api })
    const respuesta = await servicio.obtenerActivo()
    assert.equal(api.llamadas[0].url, '/tiempo/activo')
    assert.equal(respuesta.activo.id, 1)
    assert.equal(respuesta.ahora, '2026-11-13 09:10:00')
  })

  it('acepta que no haya cronómetro en marcha', async () => {
    const api = crearApiFalsa(() => ({ data: { activo: null, ahora: '2026-11-13 09:10:00' } }))
    const respuesta = await crearTiempoService({ api }).obtenerActivo()
    assert.equal(respuesta.activo, null)
  })

  it('rechaza una respuesta sin la hora del servidor', async () => {
    const api = crearApiFalsa(() => ({ data: { activo: null } }))
    await assert.rejects(crearTiempoService({ api }).obtenerActivo(), {
      estado: 'respuesta_inesperada',
    })
  })

  it('inicia con el renglón y devuelve lo detenido', async () => {
    const api = crearApiFalsa(() => ({
      data: {
        activo: bloque({ id: 2 }),
        detenido: bloque({ id: 1, minutos: 3 }),
        ahora: '2026-11-13 09:10:00',
      },
    }))
    const respuesta = await crearTiempoService({ api }).iniciar({
      cliente_id: 10,
      tipo_id: 5,
      mes: '2026-11',
    })
    assert.deepEqual(api.llamadas[0], {
      metodo: 'post',
      url: '/tiempo/iniciar',
      segundo: { cliente_id: 10, tipo_id: 5, mes: '2026-11' },
    })
    assert.equal(respuesta.activo.id, 2)
    assert.equal(respuesta.detenido.id, 1)
  })

  it('detiene y devuelve el bloque guardado', async () => {
    const api = crearApiFalsa(() => ({ data: { bloque: bloque({ minutos: 7 }) } }))
    const guardado = await crearTiempoService({ api }).detener()
    assert.equal(api.llamadas[0].url, '/tiempo/detener')
    assert.equal(guardado.minutos, 7)
  })

  it('lista los bloques de un renglón con los filtros en la consulta', async () => {
    const api = crearApiFalsa(() => ({ data: { bloques: [bloque({ minutos: 5 })] } }))
    const lista = await crearTiempoService({ api }).listarBloques({
      cliente_id: 10,
      tipo_id: 5,
      mes: '2026-11',
    })
    assert.equal(api.llamadas[0].url, '/tiempo')
    assert.deepEqual(api.llamadas[0].segundo, {
      params: { cliente_id: 10, tipo_id: 5, mes: '2026-11' },
    })
    assert.equal(lista.length, 1)
  })

  it('agrega tiempo a mano y borra un bloque', async () => {
    const api = crearApiFalsa((metodo) =>
      metodo === 'post'
        ? { data: { bloque: bloque({ minutos: 25, manual: true }) } }
        : { data: { ok: true } },
    )
    const servicio = crearTiempoService({ api })
    const creado = await servicio.agregarManual({
      cliente_id: 10,
      tipo_id: 5,
      mes: '2026-11',
      minutos: 25,
    })
    assert.equal(creado.manual, true)
    assert.deepEqual(api.llamadas[0].segundo, {
      cliente_id: 10,
      tipo_id: 5,
      mes: '2026-11',
      minutos: 25,
    })
    await servicio.borrarBloque(9)
    assert.equal(api.llamadas[1].metodo, 'delete')
    assert.equal(api.llamadas[1].url, '/tiempo/9')
  })

  it('rechaza una respuesta sin el bloque', async () => {
    const api = crearApiFalsa(() => ({ data: {} }))
    await assert.rejects(crearTiempoService({ api }).detener(), { estado: 'respuesta_inesperada' })
  })
})

describe('store del cronómetro', () => {
  let ahoraMs
  const crear = (servicio) => {
    setActivePinia(createPinia())
    return crearCronometroStore({ tiempoService: servicio, reloj: () => ahoraMs })()
  }

  beforeEach(() => {
    ahoraMs = 1_000_000
  })

  it('al cargar calcula el tiempo con la hora del servidor, no con el reloj del equipo', async () => {
    const store = crear({
      obtenerActivo: async () => ({ activo: bloque(), ahora: '2026-11-13 09:10:00' }),
    })
    await store.cargarActivo()
    assert.equal(store.activo.id, 1)
    assert.equal(store.segundos, 600, 'diez minutos según el servidor')
    ahoraMs += 5000
    store.actualizarReloj()
    assert.equal(store.segundos, 605, 'avanza con el reloj local desde que llegó la respuesta')
  })

  it('avisa cuando lleva más de 10 horas en marcha', async () => {
    const store = crear({
      obtenerActivo: async () => ({ activo: bloque(), ahora: '2026-11-13 19:00:00' }),
    })
    await store.cargarActivo()
    assert.equal(store.masDeDiezHoras, false, 'exactamente 10 horas aún no')
    ahoraMs += 1000
    store.actualizarReloj()
    assert.equal(store.masDeDiezHoras, true)
  })

  it('sin cronómetro el tiempo es cero y no hay aviso', async () => {
    const store = crear({
      obtenerActivo: async () => ({ activo: null, ahora: '2026-11-13 09:10:00' }),
    })
    await store.cargarActivo()
    assert.equal(store.activo, null)
    assert.equal(store.segundos, 0)
    assert.equal(store.masDeDiezHoras, false)
  })

  it('iniciar deja el nuevo activo, informa lo detenido y avisa a las listas', async () => {
    const store = crear({
      iniciar: async () => ({
        activo: bloque({ id: 2 }),
        detenido: bloque({ id: 1, minutos: 4 }),
        ahora: '2026-11-13 09:00:30',
      }),
    })
    const antes = store.cambios
    const resultado = await store.iniciar({ cliente_id: 10, tipo_id: 5, mes: '2026-11' })
    assert.equal(resultado.ok, true)
    assert.equal(resultado.detenido.id, 1)
    assert.equal(store.activo.id, 2)
    assert.equal(store.segundos, 30)
    assert.equal(store.cambios, antes + 1)
  })

  it('un fallo al iniciar no toca el cronómetro que ya estaba en marcha', async () => {
    const error = {
      estado: 'solicitud_invalida',
      mensaje: 'Qué ocurrió: x. Sobre: y. Qué hacer: z.',
    }
    const store = crear({
      obtenerActivo: async () => ({ activo: bloque(), ahora: '2026-11-13 09:10:00' }),
      iniciar: async () => {
        throw error
      },
    })
    await store.cargarActivo()
    const resultado = await store.iniciar({ cliente_id: 10, tipo_id: 6, mes: '2026-11' })
    assert.equal(resultado.ok, false)
    assert.equal(resultado.error.mensaje, error.mensaje)
    assert.equal(store.activo.id, 1)
  })

  it('detener limpia el activo y avisa a las listas', async () => {
    const store = crear({
      obtenerActivo: async () => ({ activo: bloque(), ahora: '2026-11-13 09:10:00' }),
      detener: async () => bloque({ minutos: 10, fin: '2026-11-13 09:10:00' }),
    })
    await store.cargarActivo()
    const antes = store.cambios
    const resultado = await store.detener()
    assert.equal(resultado.ok, true)
    assert.equal(resultado.bloque.minutos, 10)
    assert.equal(store.activo, null)
    assert.equal(store.cambios, antes + 1)
  })

  it('si al detener ya no había nada (404), se limpia igual y se relee', async () => {
    const store = crear({
      obtenerActivo: async () => ({ activo: bloque(), ahora: '2026-11-13 09:10:00' }),
      detener: async () => {
        throw {
          estado: 'no_encontrado',
          codigoHttp: 404,
          mensaje: 'Qué ocurrió: a. Sobre: b. Qué hacer: c.',
        }
      },
    })
    await store.cargarActivo()
    const resultado = await store.detener()
    assert.equal(resultado.ok, false)
    assert.equal(store.activo, null)
  })

  it('un fallo al leer en silencio no borra el cronómetro que se mostraba', async () => {
    let falla = false
    const store = crear({
      obtenerActivo: async () => {
        if (falla) throw { estado: 'red', mensaje: 'Qué ocurrió: a. Sobre: b. Qué hacer: c.' }
        return { activo: bloque(), ahora: '2026-11-13 09:10:00' }
      },
    })
    await store.cargarActivo()
    falla = true
    const resultado = await store.cargarActivo()
    assert.equal(resultado.ok, false)
    assert.equal(store.activo.id, 1)
  })

  it('registrarCambio avisa a las listas sin tocar el cronómetro', async () => {
    const store = crear({})
    const antes = store.cambios
    store.registrarCambio()
    assert.equal(store.cambios, antes + 1)
  })
})

describe('componentes del cronómetro', () => {
  it('existen los componentes, el servicio y el store nuevos', () => {
    for (const archivo of [
      '../src/components/CronometroActivo.vue',
      '../src/components/TiempoRegistradoDialog.vue',
      '../src/components/RenglonActividad.vue',
      '../src/services/tiempoService.js',
      '../src/stores/cronometro.js',
    ]) {
      assert.ok(existsSync(ruta(archivo)), archivo)
    }
  })

  it('«Mis actividades» muestra el aviso fijo arriba de las tres vistas y relee en visibilitychange', () => {
    const fuente = leer('../src/components/MisActividades.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /<CronometroActivo/)
    assert.ok(
      plantilla.indexOf('<CronometroActivo') < plantilla.indexOf('<q-btn-toggle'),
      'el aviso va antes del conmutador, así se ve en las tres vistas',
    )
    assert.match(fuente, /visibilitychange/)
    assert.match(fuente, /cargarActivo/)
    assert.match(fuente, /removeEventListener\('visibilitychange'/)
  })

  it('el aviso fijo dice cliente, tipo, mes, tiempo y trae «Detener»; no anuncia cada segundo', () => {
    const fuente = leer('../src/components/CronometroActivo.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /Detener/)
    assert.match(plantilla, /activo\.cliente/)
    assert.match(plantilla, /activo\.tipo/)
    assert.match(plantilla, /etiquetaDeMes/)
    assert.match(plantilla, /role="timer"/)
    assert.doesNotMatch(
      plantilla,
      /aria-live="(polite|assertive)"[^>]*>\s*\{\{\s*formatearCronometro/,
    )
    assert.match(plantilla, /Lleva más de 10 horas en marcha; revisa si lo olvidaste\./)
    assert.match(plantilla, /<q-tooltip/)
    assert.match(fuente, /setInterval/)
    assert.match(fuente, /clearInterval/)
  })

  it('el renglón compartido trae «Iniciar»/«Detener» con su nombre accesible y el tiempo acumulado', () => {
    const fuente = leer('../src/components/RenglonActividad.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /Iniciar/)
    assert.match(plantilla, /Detener/)
    assert.match(plantilla, /aria-label/)
    assert.match(plantilla, /formatearDuracion\(renglon\.minutos\)/)
    assert.match(plantilla, /role="timer"/)
    assert.match(plantilla, /<q-tooltip/)
    assert.match(plantilla, /TiempoRegistradoDialog/)
    assert.match(fuente, /control-touch/)
  })

  it('la lista del mes y el calendario usan el renglón compartido y recargan en silencio al haber cambios', () => {
    for (const archivo of [
      '../src/components/ListaDelMes.vue',
      '../src/components/CalendarioActividades.vue',
    ]) {
      const fuente = leer(archivo)
      assert.match(plantillaDe(fuente), /<RenglonActividad/, archivo)
      assert.match(fuente, /useCronometroStore/, archivo)
      assert.match(fuente, /cambios/, archivo)
      assert.match(fuente, /silencioso: true/, archivo)
    }
  })

  it('la lista del mes muestra el total del grupo y del mes', () => {
    const plantilla = plantillaDe(leer('../src/components/ListaDelMes.vue'))
    assert.match(plantilla, /formatearDuracion\(grupo\.minutos\)/)
    assert.match(plantilla, /formatearDuracion\(minutosMes\)/)
  })

  it('el diálogo «Tiempo registrado» agrega a mano y borra con confirmación en «Cancelar»', () => {
    const fuente = leer('../src/components/TiempoRegistradoDialog.vue')
    const plantilla = plantillaDe(fuente)
    assert.match(plantilla, /Tiempo registrado/)
    assert.match(plantilla, /transition-show="dialogo-entra"/)
    assert.match(plantilla, /transition-hide="dialogo-sale"/)
    assert.match(plantilla, /:persistent=/)
    assert.match(plantilla, /for="tiempo-minutos"/)
    assert.match(plantilla, /aria-hidden="true"/)
    assert.match(fuente, /focus: 'cancel'/)
    assert.match(fuente, /hayDatosSinGuardar/)
    assert.match(fuente, /@shake|pedirDescartar/)
    assert.match(fuente, /enfocarPrimerError/)
    assert.match(fuente, /registrarCambio/)
    assert.match(plantilla, /<q-tooltip/)
  })

  it('no hay colores sueltos ni new Date de texto en los componentes nuevos', () => {
    for (const archivo of [
      '../src/components/CronometroActivo.vue',
      '../src/components/TiempoRegistradoDialog.vue',
      '../src/components/RenglonActividad.vue',
    ]) {
      const fuente = leer(archivo)
      assert.doesNotMatch(fuente, /#[0-9a-fA-F]{3,8}\b/, `${archivo}: hexadecimal suelto`)
      assert.doesNotMatch(fuente, /new Date\(['"`]/, archivo)
    }
  })
})
