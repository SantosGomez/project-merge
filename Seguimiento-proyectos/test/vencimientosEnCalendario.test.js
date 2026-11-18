// Vencimientos de casos en el calendario de juntas (rebanada 25): qué casos cuentan, cómo se
// nombran, a dónde llevan y cómo se recuerda el interruptor. Valores calculados a mano contra
// noviembre de 2026 (el 18 es miércoles).

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  destinoDeVencimiento,
  guardarMostrarVencimientos,
  leerMostrarVencimientos,
  marcasDeVencimiento,
  nombreAccesibleDeVencimiento,
  puedeVerVencimientos,
  textoDeVencimiento,
  vencimientosDeAuditorias,
  vencimientosDeCasos,
  vencimientosDelDia,
} from '../src/utils/vencimientosEnCalendario.js'

const caso = (extra) => ({
  id: 7,
  cliente: 'Cliente Uno',
  estado: 'pendiente',
  prioridad: 'alta',
  importante: 0,
  fecha_vencimiento: '2026-11-18',
  ...extra,
})

const crearAlmacen = () => {
  const datos = new Map()
  return {
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
  }
}

describe('puedeVerVencimientos', () => {
  it('administrador, contador y auxiliar sí; recepcionista y el resto no', () => {
    for (const rol of ['administrador', 'contador', 'auxiliar']) {
      assert.equal(puedeVerVencimientos(rol), true, rol)
    }
    for (const rol of ['recepcionista', 'usuarios_de_sistema', null, undefined]) {
      assert.equal(puedeVerVencimientos(rol), false, String(rol))
    }
  })
})

describe('vencimientosDeCasos', () => {
  it('toma el cliente, la prioridad, si es importante y el día de vencimiento', () => {
    assert.deepEqual(vencimientosDeCasos([caso({ importante: 1, prioridad: 'media' })]), [
      {
        clave: 'vence-7',
        tipo: 'caso',
        casoId: 7,
        cliente: 'Cliente Uno',
        prioridad: 'media',
        importante: true,
        vence: '2026-11-18',
      },
    ])
  })

  it('deja fuera los casos finalizados y los que no tienen una fecha real', () => {
    const resultado = vencimientosDeCasos([
      caso({ id: 1, estado: 'finalizado' }),
      caso({ id: 2, fecha_vencimiento: null }),
      caso({ id: 3, fecha_vencimiento: '2026-02-30' }),
      caso({ id: 4, fecha_vencimiento: 'mañana' }),
      caso({ id: 5, estado: 'en_proceso' }),
    ])
    assert.deepEqual(
      resultado.map((v) => v.casoId),
      [5],
    )
  })

  it('acepta la fecha con hora y no la desplaza de día', () => {
    const [vencimiento] = vencimientosDeCasos([caso({ fecha_vencimiento: '2026-11-18 00:00:00' })])
    assert.equal(vencimiento.vence, '2026-11-18')
  })

  it('una lista ausente da una lista vacía', () => {
    assert.deepEqual(vencimientosDeCasos(undefined), [])
  })
})

describe('vencimientosDelDia', () => {
  const lista = vencimientosDeCasos([
    caso({ id: 1, cliente: 'Zeta' }),
    caso({ id: 2, cliente: 'alfa' }),
    caso({ id: 3, cliente: 'Otro', fecha_vencimiento: '2026-11-19' }),
  ])

  it('devuelve solo lo de ese día, por nombre del cliente', () => {
    assert.deepEqual(
      vencimientosDelDia(lista, '2026-11-18').map((v) => v.cliente),
      ['alfa', 'Zeta'],
    )
  })

  it('un día sin vencimientos da una lista vacía', () => {
    assert.deepEqual(vencimientosDelDia(lista, '2026-11-20'), [])
  })
})

describe('textos del vencimiento', () => {
  const [normal] = vencimientosDeCasos([caso()])
  const [importante] = vencimientosDeCasos([caso({ importante: 1, prioridad: 'baja' })])

  it('el texto visible es «Vence: {cliente}»', () => {
    assert.equal(textoDeVencimiento(normal), 'Vence: Cliente Uno')
  })

  it('las marcas llevan la prioridad con texto y «Importante» solo si lo es', () => {
    assert.deepEqual(marcasDeVencimiento(normal), ['Alta'])
    assert.deepEqual(marcasDeVencimiento(importante), ['Baja', 'Importante'])
  })

  it('el nombre accesible dice el día, el cliente, la prioridad y a dónde lleva', () => {
    assert.equal(
      nombreAccesibleDeVencimiento(normal, 'contador'),
      'Vence el 18 de noviembre: Cliente Uno, prioridad Alta. Abre el caso en «Mis casos».',
    )
    assert.equal(
      nombreAccesibleDeVencimiento(importante, 'administrador'),
      'Vence el 18 de noviembre: Cliente Uno, prioridad Baja, importante. Abre ese día en tu resumen.',
    )
  })
})

describe('destinoDeVencimiento', () => {
  const [vencimiento] = vencimientosDeCasos([caso()])

  it('contador y auxiliar van a «Mis casos» con ?casoId=', () => {
    for (const rol of ['contador', 'auxiliar']) {
      assert.deepEqual(destinoDeVencimiento(vencimiento, rol), {
        name: 'contador-casos',
        query: { casoId: '7' },
      })
    }
  })

  it('el administrador va a su resumen con ?dia=AAAA-MM-DD', () => {
    assert.deepEqual(destinoDeVencimiento(vencimiento, 'administrador'), {
      name: 'admin-dashboard',
      query: { dia: '2026-11-18' },
    })
  })

  it('un rol sin vencimientos no tiene destino', () => {
    assert.equal(destinoDeVencimiento(vencimiento, 'recepcionista'), null)
  })
})

const auditoria = (extra) => ({
  id: 41,
  cliente: 'Cliente Auditado',
  estado: 'En proceso',
  fechaVencimiento: '18-11-2026',
  ...extra,
})

describe('vencimientosDeAuditorias', () => {
  it('toma el cliente y el día (de DD-MM-AAAA a AAAA-MM-DD) con su identificador', () => {
    assert.deepEqual(vencimientosDeAuditorias([auditoria()]), [
      {
        clave: 'vence-auditoria-41',
        tipo: 'auditoria',
        auditoriaId: 41,
        cliente: 'Cliente Auditado',
        vence: '2026-11-18',
      },
    ])
  })

  it('deja fuera las completadas y las que no tienen una fecha real', () => {
    const resultado = vencimientosDeAuditorias([
      auditoria({ id: 1, estado: 'Completado' }),
      auditoria({ id: 2, fechaVencimiento: '' }),
      auditoria({ id: 3, fechaVencimiento: '30-02-2026' }),
      auditoria({ id: 4, fechaVencimiento: undefined }),
      auditoria({ id: 5, estado: 'Pendiente' }),
    ])
    assert.deepEqual(
      resultado.map((v) => v.auditoriaId),
      [5],
    )
  })

  it('una lista ausente da una lista vacía', () => {
    assert.deepEqual(vencimientosDeAuditorias(undefined), [])
  })

  it('el texto es «Auditoría: {cliente}», sin marcas, y se distingue de un caso por texto', () => {
    const [v] = vencimientosDeAuditorias([auditoria()])
    assert.equal(textoDeVencimiento(v), 'Auditoría: Cliente Auditado')
    assert.deepEqual(marcasDeVencimiento(v), [])
    assert.equal(
      nombreAccesibleDeVencimiento(v, 'contador'),
      'Vence el 18 de noviembre: auditoría de Cliente Auditado. Abre la ficha de la auditoría.',
    )
  })

  it('el clic lleva a la ficha de la auditoría', () => {
    const [v] = vencimientosDeAuditorias([auditoria()])
    assert.deepEqual(destinoDeVencimiento(v, 'contador'), {
      name: 'auditoria-ficha',
      params: { id: '41' },
    })
  })

  it('se mezcla con los casos del día y sigue el orden por cliente', () => {
    const lista = [
      ...vencimientosDeCasos([caso({ id: 1, cliente: 'Zeta' })]),
      ...vencimientosDeAuditorias([auditoria({ cliente: 'alfa' })]),
    ]
    assert.deepEqual(
      vencimientosDelDia(lista, '2026-11-18').map((v) => v.clave),
      ['vence-auditoria-41', 'vence-1'],
    )
  })
})

describe('interruptor «Mostrar vencimientos»', () => {
  it('está encendido por defecto', () => {
    assert.equal(leerMostrarVencimientos(5, crearAlmacen()), true)
  })

  it('se recuerda por persona', () => {
    const almacen = crearAlmacen()
    guardarMostrarVencimientos(5, false, almacen)
    assert.equal(leerMostrarVencimientos(5, almacen), false)
    assert.equal(
      leerMostrarVencimientos(6, almacen),
      true,
      'otra persona sigue con el valor por defecto',
    )
    guardarMostrarVencimientos(5, true, almacen)
    assert.equal(leerMostrarVencimientos(5, almacen), true)
  })

  it('si el almacenamiento falla al leer o al guardar, no lanza y queda encendido', () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('almacenamiento bloqueado')
      },
      setItem: () => {
        throw new Error('almacenamiento bloqueado')
      },
    }
    assert.doesNotThrow(() => guardarMostrarVencimientos(5, false, bloqueado))
    assert.equal(leerMostrarVencimientos(5, bloqueado), true)
  })

  it('sin acceso a localStorage (modo privado) tampoco lanza', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('almacenamiento bloqueado')
      },
    })
    try {
      assert.equal(leerMostrarVencimientos(5), true)
      assert.doesNotThrow(() => guardarMostrarVencimientos(5, false))
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
      else delete globalThis.localStorage
    }
  })
})
