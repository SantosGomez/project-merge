/*
 * Rebanada 42: «Tu próxima junta» y la línea de la hora actual en «Mi Calendario».
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  cuentaRegresiva,
  minutosDesdeInicioDeVista,
  proximaJunta,
} from '../src/utils/proximaJunta.js'

const YO = 7
const ahora = new Date(2026, 10, 23, 10, 0, 0) // 23-11-2026 10:00:00 local

const junta = (id, inicio, fin, extra = {}) => ({
  id,
  titulo: `Junta ${id}`,
  inicio,
  fin,
  estado: 'confirmada',
  participantes: [],
  soy_organizador: true,
  ...extra,
})

describe('proximaJunta', () => {
  it('elige la que empieza antes dentro de las próximas 24 h', () => {
    const resultado = proximaJunta(
      [
        junta(1, '2026-11-23 15:00:00', '2026-11-23 16:00:00'),
        junta(2, '2026-11-23 10:30:00', '2026-11-23 11:00:00'),
      ],
      ahora,
      YO,
    )
    assert.equal(resultado.junta.id, 2)
    assert.equal(resultado.enCurso, false)
    assert.equal(resultado.segundos, 30 * 60)
  })

  it('una en curso gana a la siguiente y cuenta hasta su fin', () => {
    const resultado = proximaJunta(
      [
        junta(1, '2026-11-23 10:15:00', '2026-11-23 11:00:00'),
        junta(2, '2026-11-23 09:30:00', '2026-11-23 10:45:00'),
      ],
      ahora,
      YO,
    )
    assert.equal(resultado.junta.id, 2)
    assert.equal(resultado.enCurso, true)
    assert.equal(resultado.segundos, 45 * 60)
  })

  it('ignora canceladas, rechazadas por ti, bloques «Ocupado» y las ya terminadas', () => {
    const resultado = proximaJunta(
      [
        junta(1, '2026-11-23 10:10:00', '2026-11-23 11:00:00', { estado: 'cancelada' }),
        junta(2, '2026-11-23 10:20:00', '2026-11-23 11:00:00', {
          soy_organizador: false,
          participantes: [{ id: YO, respuesta: 'rechazada' }],
        }),
        { inicio: '2026-11-23 10:25:00', fin: '2026-11-23 11:00:00', ocupado: true },
        junta(3, '2026-11-23 08:00:00', '2026-11-23 09:00:00'),
        junta(4, '2026-11-23 12:00:00', '2026-11-23 13:00:00', {
          soy_organizador: false,
          participantes: [{ id: YO, respuesta: 'pendiente' }],
          estado: 'por_confirmar',
        }),
      ],
      ahora,
      YO,
    )
    assert.equal(resultado.junta.id, 4)
  })

  it('redondea hacia arriba: a menos de un segundo de empezar todavía marca 1 s, no 0', () => {
    const casi = new Date(2026, 10, 23, 10, 29, 59, 600)
    const resultado = proximaJunta([junta(1, '2026-11-23 10:30:00', '2026-11-23 11:00:00')], casi, YO)
    assert.equal(resultado.enCurso, false)
    assert.equal(resultado.segundos, 1)
  })

  it('no hay próxima si la siguiente empieza en más de 24 h', () => {
    assert.equal(
      proximaJunta([junta(1, '2026-11-24 10:00:01', '2026-11-24 11:00:00')], ahora, YO),
      null,
    )
    assert.equal(proximaJunta([], ahora, YO), null)
  })
})

describe('cuentaRegresiva', () => {
  it('da HH:MM:SS con ceros a la izquierda', () => {
    assert.equal(cuentaRegresiva(30 * 60), '00:30:00')
    assert.equal(cuentaRegresiva(23 * 3600 + 59 * 60 + 5), '23:59:05')
    assert.equal(cuentaRegresiva(0), '00:00:00')
  })

  it('nunca es negativa', () => {
    assert.equal(cuentaRegresiva(-12), '00:00:00')
  })
})

describe('minutosDesdeInicioDeVista (línea de la hora actual)', () => {
  it('cuenta los minutos desde el inicio de la vista', () => {
    assert.equal(minutosDesdeInicioDeVista(new Date(2026, 10, 23, 10, 15), 8, 19), 135)
  })

  it('no hay línea antes ni después del horario visible', () => {
    assert.equal(minutosDesdeInicioDeVista(new Date(2026, 10, 23, 7, 59), 8, 19), null)
    assert.equal(minutosDesdeInicioDeVista(new Date(2026, 10, 23, 19, 1), 8, 19), null)
    assert.equal(minutosDesdeInicioDeVista(new Date(2026, 10, 23, 19, 0), 8, 19), 660)
  })
})

describe('Rebanada 42: conexión en las vistas', () => {
  const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

  it('el calendario pinta la línea solo en la columna de hoy y sin clics', () => {
    const calendario = leer('../src/components/CalendarioJuntas.vue')
    assert.match(
      calendario,
      /<div\s+v-if="scope\.timestamp\.date === hoyDeLaLinea && minutosDeLaLinea !== null"\s+class="linea-ahora"[^>]*aria-hidden="true"/,
    )
    assert.match(calendario, /\.linea-ahora\s*\{[^}]*pointer-events:\s*none/)
  })

  it('«Mi Calendario» muestra «Tu próxima junta» y la refresca tras guardar, borrar o responder', () => {
    const pagina = leer('../src/pages/JuntasPage.vue')
    assert.match(pagina, /<ProximaJunta ref="proximaJunta" @ver="abrirDetalle" \/>/)
    assert.ok((pagina.match(/proximaJunta\.value\?\.recargar\(\)/g) ?? []).length >= 3)
  })

  it('en escritorio la tarjeta se ajusta a su contenido (máx. 520 px), no a todo el ancho', () => {
    const tarjeta = leer('../src/components/ProximaJunta.vue')
    assert.match(
      tarjeta,
      /@media \(min-width: 600px\)\s*\{\s*\.proxima-junta\s*\{[^}]*width:\s*fit-content;[^}]*max-width:\s*520px;/,
    )
  })
})
