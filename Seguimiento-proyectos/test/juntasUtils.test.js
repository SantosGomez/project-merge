// Utilidades puras del calendario de juntas (rebanada 21b): rango visible, periodo, fechas del
// formulario, respuesta de los invitados y colocación de las juntas en la cuadrícula.
// Los valores esperados están calculados a mano contra el calendario de noviembre de 2026.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  administraAAdministrador,
  altaDesdeDirectorio,
  agendaInicialDeRecepcion,
  armarFechaHora,
  campoDeErrorJunta,
  claveDeJunta,
  distribuirSolapadas,
  esJuntaOcupada,
  etiquetaDeJuntaOcupada,
  etiquetaFueraDeHorario,
  etiquetaRespuesta,
  invitadoInicialDeAlta,
  formatearFechaISO,
  horaDeFechaHora,
  horaEnElDia,
  horarioDeJunta,
  juntasDelDia,
  juntasPorDia,
  leerAgendaDeUrl,
  leerVistaDeUrl,
  marcasDeJunta,
  mesesDelAnio,
  moverPeriodo,
  notaDeRecorte,
  organizadorDeAlta,
  parsearFechaISO,
  puedeAgendarDesdeDirectorio,
  rangoVisible,
  segmentoDelDia,
  semanaMuestraFinDeSemana,
  textoAdministradoresAtendidos,
  textoDiaConJuntas,
  textoDiaDelMes,
  textoPeriodo,
  validarFormularioJunta,
  vistaInicial,
  MAX_CLIENTE,
  MAX_LUGAR,
  enlaceDeLugar,
  etiquetaModalidad,
} from '../src/utils/juntas.js'

describe('fechas sin desplazamiento de zona horaria', () => {
  it('parsea y formatea una fecha AAAA-MM-DD como día local', () => {
    const fecha = parsearFechaISO('2026-11-18')
    assert.equal(fecha.getDate(), 18)
    assert.equal(fecha.getMonth(), 10)
    assert.equal(formatearFechaISO(fecha), '2026-11-18')
  })

  it('rechaza fechas que no existen o con otro formato', () => {
    assert.equal(parsearFechaISO('2026-02-30'), null)
    assert.equal(parsearFechaISO('18-11-2026'), null)
    assert.equal(parsearFechaISO(undefined), null)
  })
})

describe('rangoVisible', () => {
  it('mes: del lunes de la semana del día 1 al domingo de la semana del último día', () => {
    // 1 nov 2026 es domingo y 30 nov es lunes.
    assert.deepEqual(rangoVisible('mes', '2026-11-18'), {
      desde: '2026-10-26',
      hasta: '2026-12-06',
    })
  })

  it('mes: un mes que empieza en lunes y termina en domingo no agrega semanas', () => {
    // 1 jun 2026 es lunes y 30 jun es martes; febrero 2027 empieza en lunes y termina en domingo.
    assert.deepEqual(rangoVisible('mes', '2027-02-10'), {
      desde: '2027-02-01',
      hasta: '2027-02-28',
    })
  })

  it('semana: de lunes a domingo, aunque la fecha sea domingo', () => {
    assert.deepEqual(rangoVisible('semana', '2026-11-18'), {
      desde: '2026-11-16',
      hasta: '2026-11-22',
    })
    assert.deepEqual(rangoVisible('semana', '2026-11-22'), {
      desde: '2026-11-16',
      hasta: '2026-11-22',
    })
  })

  it('día: solo ese día, también en fin de semana', () => {
    assert.deepEqual(rangoVisible('dia', '2026-11-21'), {
      desde: '2026-11-21',
      hasta: '2026-11-21',
    })
  })

  it('cruza el cambio de año', () => {
    assert.deepEqual(rangoVisible('semana', '2026-12-31'), {
      desde: '2026-12-28',
      hasta: '2027-01-03',
    })
  })
})

describe('moverPeriodo', () => {
  it('semana y día avanzan y retroceden por días, cruzando mes', () => {
    assert.equal(moverPeriodo('semana', '2026-11-30', 1), '2026-12-07')
    assert.equal(moverPeriodo('semana', '2026-11-02', -1), '2026-10-26')
    assert.equal(moverPeriodo('dia', '2026-11-30', 1), '2026-12-01')
  })

  it('mes conserva el día y, si el mes nuevo es más corto, usa su último día', () => {
    assert.equal(moverPeriodo('mes', '2026-11-18', 1), '2026-12-18')
    assert.equal(moverPeriodo('mes', '2026-12-31', 1), '2027-01-31')
    assert.equal(moverPeriodo('mes', '2026-03-31', -1), '2026-02-28')
  })
})

describe('textoPeriodo', () => {
  it('mes', () => {
    assert.equal(textoPeriodo('mes', '2026-11-18'), 'noviembre de 2026')
  })

  it('semana de lunes a viernes dentro de un mes', () => {
    assert.equal(textoPeriodo('semana', '2026-11-18'), '16 – 20 de noviembre de 2026')
  })

  it('semana que cruza de mes y de año', () => {
    assert.equal(textoPeriodo('semana', '2026-11-30'), '30 de noviembre – 4 de diciembre de 2026')
    assert.equal(
      textoPeriodo('semana', '2026-12-31'),
      '28 de diciembre de 2026 – 1 de enero de 2027',
    )
  })

  it('día con su nombre', () => {
    assert.equal(textoPeriodo('dia', '2026-11-18'), 'miércoles 18 de noviembre de 2026')
    assert.equal(textoPeriodo('dia', '2026-11-21'), 'sábado 21 de noviembre de 2026')
  })
})

describe('vista y fecha de la URL', () => {
  it('sin vista elige Día en menos de 600 px y Semana en el resto', () => {
    assert.equal(vistaInicial(599), 'dia')
    assert.equal(vistaInicial(600), 'semana')
  })

  it('respeta una vista y una fecha válidas', () => {
    assert.deepEqual(leerVistaDeUrl({ vista: 'mes', fecha: '2026-11-18' }, 1200, '2026-11-20'), {
      vista: 'mes',
      fecha: '2026-11-18',
    })
  })

  it('ignora vistas o fechas inválidas y usa hoy y la vista por ancho', () => {
    assert.deepEqual(
      leerVistaDeUrl({ vista: 'trimestre', fecha: '2026-02-31' }, 375, '2026-11-20'),
      {
        vista: 'dia',
        fecha: '2026-11-20',
      },
    )
    assert.deepEqual(leerVistaDeUrl({}, 1200, '2026-11-20'), {
      vista: 'semana',
      fecha: '2026-11-20',
    })
  })
})

describe('armarFechaHora', () => {
  it('une DD-MM-AAAA y HH:mm en AAAA-MM-DD HH:mm', () => {
    assert.equal(armarFechaHora('18-11-2026', '09:30'), '2026-11-18 09:30')
    assert.equal(armarFechaHora(' 01-12-2026 ', '19:00'), '2026-12-01 19:00')
  })

  it('devuelve null si la fecha o la hora no son válidas', () => {
    assert.equal(armarFechaHora('31-02-2026', '09:00'), null)
    assert.equal(armarFechaHora('18-11-2026', '24:00'), null)
    assert.equal(armarFechaHora('18-11-2026', '9:5'), null)
    assert.equal(armarFechaHora('', ''), null)
  })
})

describe('etiquetaRespuesta', () => {
  it('traduce cada respuesta a texto', () => {
    assert.equal(etiquetaRespuesta('pendiente'), 'Pendiente')
    assert.equal(etiquetaRespuesta('aceptada'), 'Aceptó')
    assert.equal(etiquetaRespuesta('rechazada'), 'Rechazó')
  })

  it('una respuesta desconocida se muestra como Pendiente', () => {
    assert.equal(etiquetaRespuesta('otra'), 'Pendiente')
  })
})

describe('horaDeFechaHora', () => {
  it('toma HH:mm de la hora local que devuelve la API', () => {
    assert.equal(horaDeFechaHora('2026-11-18 09:05:00'), '09:05')
    assert.equal(horaDeFechaHora('2026-11-18 19:30'), '19:30')
  })
})

describe('horarioDeJunta', () => {
  it('una junta de un solo día muestra solo las horas', () => {
    assert.equal(
      horarioDeJunta({ inicio: '2026-11-18 09:00:00', fin: '2026-11-18 10:30:00' }),
      '09:00 – 10:30',
    )
  })

  it('una junta que cruza la medianoche muestra la fecha de cada extremo', () => {
    assert.equal(
      horarioDeJunta({ inicio: '2026-11-18 17:00:00', fin: '2026-11-19 09:00:00' }),
      '18-11-2026 17:00 – 19-11-2026 09:00',
    )
  })

  it('una junta fuera del horario laboral conserva su hora real', () => {
    assert.equal(
      horarioDeJunta({ inicio: '2026-11-18 07:00:00', fin: '2026-11-18 20:15:00' }),
      '07:00 – 20:15',
    )
  })
})

describe('campoDeErrorJunta', () => {
  it('lee el campo de la parte «sobre X» del mensaje del backend', () => {
    const queHacer = 'Elige una hora de fin posterior a la de inicio'
    assert.equal(
      campoDeErrorJunta(`El fin no es posterior al inicio sobre fin: ${queHacer}`),
      'fin',
    )
    assert.equal(
      campoDeErrorJunta('Falta el título de la junta sobre título: Escribe el título'),
      'titulo',
    )
    assert.equal(
      campoDeErrorJunta(
        'La descripción supera los 1000 caracteres sobre descripción: Escribe una descripción más corta',
      ),
      'descripcion',
    )
    assert.equal(
      campoDeErrorJunta('La fecha y hora de inicio no son válidas sobre inicio: Escribe la fecha'),
      'inicio',
    )
    assert.equal(
      campoDeErrorJunta(
        'Falta elegir a los invitados sobre participantes: Elige entre 1 y 50 invitados',
      ),
      'participantes',
    )
  })

  it('un error que no es de un campo del formulario devuelve null', () => {
    assert.equal(
      campoDeErrorJunta(
        'El rango de fechas es incorrecto sobre rango de fechas: Envía desde y hasta',
      ),
      null,
    )
    assert.equal(campoDeErrorJunta('No se pudo conectar con el servidor'), null)
    assert.equal(campoDeErrorJunta(undefined), null)
  })
})

describe('segmentoDelDia: lo que se pinta de una junta en un día, de 8:00 a 19:00', () => {
  const junta = (inicio, fin) => ({ id: 1, inicio, fin })

  it('una junta dentro del horario ocupa de su inicio a su fin, en minutos del día', () => {
    assert.deepEqual(
      segmentoDelDia(junta('2026-11-18 09:00:00', '2026-11-18 10:30:00'), '2026-11-18'),
      {
        desde: 540,
        hasta: 630,
        recortadaAntes: false,
        recortadaDespues: false,
      },
    )
  })

  it('se recorta al borde de la vista cuando empieza antes de las 8:00 o termina después de las 19:00', () => {
    assert.deepEqual(
      segmentoDelDia(junta('2026-11-18 07:00:00', '2026-11-18 09:00:00'), '2026-11-18'),
      {
        desde: 480,
        hasta: 540,
        recortadaAntes: true,
        recortadaDespues: false,
      },
    )
    assert.deepEqual(
      segmentoDelDia(junta('2026-11-18 18:00:00', '2026-11-18 20:00:00'), '2026-11-18'),
      {
        desde: 1080,
        hasta: 1140,
        recortadaAntes: false,
        recortadaDespues: true,
      },
    )
  })

  it('una junta fuera del horario o de otro día no aparece', () => {
    assert.equal(
      segmentoDelDia(junta('2026-11-18 06:00:00', '2026-11-18 08:00:00'), '2026-11-18'),
      null,
    )
    assert.equal(
      segmentoDelDia(junta('2026-11-18 19:00:00', '2026-11-18 20:00:00'), '2026-11-18'),
      null,
    )
    assert.equal(
      segmentoDelDia(junta('2026-11-18 09:00:00', '2026-11-18 10:00:00'), '2026-11-19'),
      null,
    )
  })

  it('una junta que cruza la medianoche se ve en los dos días', () => {
    const cruza = junta('2026-11-18 17:00:00', '2026-11-19 09:00:00')
    assert.deepEqual(segmentoDelDia(cruza, '2026-11-18'), {
      desde: 1020,
      hasta: 1140,
      recortadaAntes: false,
      recortadaDespues: true,
    })
    assert.deepEqual(segmentoDelDia(cruza, '2026-11-19'), {
      desde: 480,
      hasta: 540,
      recortadaAntes: true,
      recortadaDespues: false,
    })
  })

  it('una junta que termina justo a las 00:00 del día siguiente no cuenta en ese día', () => {
    assert.equal(
      segmentoDelDia(junta('2026-11-18 22:00:00', '2026-11-19 00:00:00'), '2026-11-19'),
      null,
    )
  })
})

describe('juntasDelDia', () => {
  it('en el mes incluye toda junta que toca el día, aunque esté fuera del horario laboral, y ordena por hora', () => {
    const juntas = [
      { id: 3, inicio: '2026-11-18 15:00:00', fin: '2026-11-18 16:00:00' },
      { id: 1, inicio: '2026-11-17 23:00:00', fin: '2026-11-18 01:00:00' },
      { id: 2, inicio: '2026-11-18 06:00:00', fin: '2026-11-18 07:00:00' },
      { id: 4, inicio: '2026-11-19 09:00:00', fin: '2026-11-19 10:00:00' },
    ]
    assert.deepEqual(
      juntasDelDia(juntas, '2026-11-18').map((j) => j.id),
      [1, 2, 3],
    )
  })
})

describe('distribuirSolapadas', () => {
  it('juntas que no se tocan quedan en una sola columna', () => {
    const r = distribuirSolapadas([
      { id: 'a', desde: 540, hasta: 600 },
      { id: 'b', desde: 600, hasta: 660 },
    ])
    assert.deepEqual(
      r.map(({ id, columna, columnas }) => [id, columna, columnas]),
      [
        ['a', 0, 1],
        ['b', 0, 1],
      ],
    )
  })

  it('dos juntas que se cruzan se reparten en dos columnas', () => {
    const r = distribuirSolapadas([
      { id: 'a', desde: 540, hasta: 660 },
      { id: 'b', desde: 600, hasta: 720 },
    ])
    assert.deepEqual(
      r.map(({ id, columna, columnas }) => [id, columna, columnas]),
      [
        ['a', 0, 2],
        ['b', 1, 2],
      ],
    )
  })

  it('una tercera que cabe en la columna libre reutiliza la primera', () => {
    const r = distribuirSolapadas([
      { id: 'a', desde: 540, hasta: 600 },
      { id: 'b', desde: 570, hasta: 720 },
      { id: 'c', desde: 600, hasta: 660 },
    ])
    assert.deepEqual(
      r.map(({ id, columna, columnas }) => [id, columna, columnas]),
      [
        ['a', 0, 2],
        ['b', 1, 2],
        ['c', 0, 2],
      ],
    )
  })
})

describe('validarFormularioJunta', () => {
  const valido = {
    titulo: 'Revisión semanal',
    fecha: '18-11-2026',
    horaInicio: '09:00',
    horaFin: '10:00',
    descripcion: '',
    participantes: [4],
  }

  it('un formulario completo no tiene errores', () => {
    assert.deepEqual(validarFormularioJunta(valido), {})
  })

  it('pide título, fecha y horas, pero no exige invitados', () => {
    const errores = validarFormularioJunta({
      titulo: '   ',
      fecha: '',
      horaInicio: '',
      horaFin: '',
      descripcion: '',
      participantes: [],
    })
    assert.deepEqual(Object.keys(errores), ['titulo', 'fecha', 'horaInicio', 'horaFin'])
    assert.equal(errores.titulo, 'Escribe el título de la junta.')
  })

  it('cliente, modalidad y lugar son opcionales y respetan sus máximos', () => {
    assert.equal(MAX_CLIENTE, 150)
    assert.equal(MAX_LUGAR, 255)
    assert.deepEqual(validarFormularioJunta({ ...valido, cliente: '', lugar: '   ' }), {})
    assert.deepEqual(
      validarFormularioJunta({ ...valido, cliente: 'c'.repeat(150), lugar: 'l'.repeat(255) }),
      {},
    )
    const errores = validarFormularioJunta({
      ...valido,
      cliente: 'c'.repeat(151),
      lugar: 'l'.repeat(256),
    })
    assert.deepEqual(Object.keys(errores), ['cliente', 'lugar'])
    assert.equal(errores.cliente, 'El cliente supera los 150 caracteres permitidos.')
    assert.equal(errores.lugar, 'El lugar supera los 255 caracteres permitidos.')
  })

  it('una junta sin invitados (lista vacía o ausente) es válida; más de 50 sigue siendo un error', () => {
    assert.deepEqual(validarFormularioJunta({ ...valido, participantes: [] }), {})
    assert.deepEqual(validarFormularioJunta({ ...valido, participantes: undefined }), {})
    assert.equal(
      validarFormularioJunta({ ...valido, participantes: Array.from({ length: 51 }, (_, i) => i) })
        .participantes,
      'Puedes invitar a 50 personas como máximo.',
    )
  })

  it('respeta el máximo del título (150) y de la descripción (1000)', () => {
    assert.deepEqual(validarFormularioJunta({ ...valido, titulo: 'a'.repeat(150) }), {})
    assert.equal(
      validarFormularioJunta({ ...valido, titulo: 'a'.repeat(151) }).titulo,
      'El título supera los 150 caracteres permitidos.',
    )
    assert.deepEqual(validarFormularioJunta({ ...valido, descripcion: 'a'.repeat(1000) }), {})
    assert.equal(
      validarFormularioJunta({ ...valido, descripcion: 'a'.repeat(1001) }).descripcion,
      'La descripción supera los 1000 caracteres permitidos.',
    )
  })

  it('el fin debe ser posterior al inicio', () => {
    assert.equal(
      validarFormularioJunta({ ...valido, horaFin: '09:00' }).horaFin,
      'La hora de fin debe ser posterior a la de inicio.',
    )
    assert.equal(
      validarFormularioJunta({ ...valido, horaFin: '08:30' }).horaFin,
      'La hora de fin debe ser posterior a la de inicio.',
    )
  })

  it('máximo 50 invitados', () => {
    const muchos = Array.from({ length: 51 }, (_, i) => i + 1)
    assert.equal(
      validarFormularioJunta({ ...valido, participantes: muchos }).participantes,
      'Puedes invitar a 50 personas como máximo.',
    )
  })

  it('una fecha inexistente o una hora mal escrita se señalan en su campo', () => {
    assert.equal(
      validarFormularioJunta({ ...valido, fecha: '31-02-2026' }).fecha,
      'Escribe la fecha como DD-MM-AAAA.',
    )
    assert.equal(
      validarFormularioJunta({ ...valido, horaInicio: '9:5' }).horaInicio,
      'Escribe la hora como HH:mm, por ejemplo 09:30.',
    )
  })
})

describe('agenda de otra persona', () => {
  const publica = {
    id: null,
    titulo: 'Cierre de mes',
    inicio: '2026-11-18 09:00:00',
    fin: '2026-11-18 10:00:00',
    organizador: { nombre: 'Ana Pérez' },
    privada: false,
    ocupado: true,
  }
  const privada = {
    id: null,
    titulo: 'Ocupado',
    inicio: '2026-11-18 11:00:00',
    fin: '2026-11-18 12:00:00',
    privada: true,
    ocupado: true,
  }
  const completa = { id: 7, titulo: 'Mía', participantes: [], estado: 'confirmada' }

  it('esJuntaOcupada solo es verdadera para los bloques ajenos de la agenda', () => {
    assert.equal(esJuntaOcupada(publica), true)
    assert.equal(esJuntaOcupada(privada), true)
    assert.equal(esJuntaOcupada(completa), false)
    assert.equal(esJuntaOcupada(null), false)
  })

  it('etiquetaDeJuntaOcupada dice «Ocupado» si es privada y «título · organiza nombre» si es pública', () => {
    assert.equal(etiquetaDeJuntaOcupada(privada), 'Ocupado')
    assert.equal(etiquetaDeJuntaOcupada(publica), 'Cierre de mes · organiza Ana Pérez')
  })

  it('claveDeJunta usa el id y, sin él, distingue los bloques ajenos por su posición', () => {
    assert.equal(claveDeJunta(completa, 0), 7)
    assert.notEqual(claveDeJunta(publica, 0), claveDeJunta(publica, 1))
    assert.notEqual(claveDeJunta(publica, 0), claveDeJunta(completa, 0))
  })

  it('claveDeJunta distingue bloques ajenos de días distintos aunque tengan el mismo índice', () => {
    const otroDia = { ...publica, inicio: '2026-11-19 09:00:00', fin: '2026-11-19 10:00:00' }
    assert.notEqual(claveDeJunta(publica, 0), claveDeJunta(otroDia, 0))
  })

  it('un bloque ajeno no lleva marcas de estado ni «Responder» y su horario se calcula', () => {
    assert.deepEqual(marcasDeJunta(publica, 5), [])
    assert.equal(horarioDeJunta(privada), '11:00 – 12:00')
  })

  it('leerAgendaDeUrl devuelve el id de otra persona y null para lo inválido o la propia cuenta', () => {
    assert.equal(leerAgendaDeUrl({ agenda: '12' }, 5), '12')
    assert.equal(leerAgendaDeUrl({ agenda: '5' }, 5), null)
    assert.equal(leerAgendaDeUrl({ agenda: 5 }, '5'), null)
    for (const malo of ['abc', '0', '-3', '1.5', '', '12abc', ['3', '4'], undefined, null]) {
      assert.equal(leerAgendaDeUrl({ agenda: malo }, 5), null, String(malo))
    }
    assert.equal(leerAgendaDeUrl(undefined, 5), null)
  })
})

describe('vista de año (rebanada 25)', () => {
  it('rangoVisible: del 1 de enero al 31 de diciembre, que cabe en los 400 días de la API', () => {
    assert.deepEqual(rangoVisible('anio', '2026-11-18'), {
      desde: '2026-01-01',
      hasta: '2026-12-31',
    })
    assert.deepEqual(rangoVisible('anio', '2028-02-29'), {
      desde: '2028-01-01',
      hasta: '2028-12-31',
    })
  })

  it('moverPeriodo: de año en año, conservando el día y usando el 28 de febrero si no existe el 29', () => {
    assert.equal(moverPeriodo('anio', '2026-11-18', 1), '2027-11-18')
    assert.equal(moverPeriodo('anio', '2026-11-18', -1), '2025-11-18')
    assert.equal(moverPeriodo('anio', '2028-02-29', 1), '2029-02-28')
  })

  it('textoPeriodo: solo el año', () => {
    assert.equal(textoPeriodo('anio', '2026-11-18'), '2026')
  })

  it('leerVistaDeUrl acepta ?vista=anio incluso en celular', () => {
    assert.deepEqual(leerVistaDeUrl({ vista: 'anio', fecha: '2026-11-18' }, 375, '2026-01-01'), {
      vista: 'anio',
      fecha: '2026-11-18',
    })
  })

  it('textoDiaDelMes: «18 de noviembre»', () => {
    assert.equal(textoDiaDelMes('2026-11-18'), '18 de noviembre')
    assert.equal(textoDiaDelMes('2026-01-01'), '1 de enero')
  })

  it('mesesDelAnio: 12 meses con sus semanas de lunes a domingo y huecos fuera del mes', () => {
    const meses = mesesDelAnio(2026)
    assert.equal(meses.length, 12)
    assert.deepEqual(
      meses.map((m) => m.nombre),
      [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ],
    )
    // 1 ene 2026 es jueves.
    assert.deepEqual(meses[0].semanas[0], [
      null,
      null,
      null,
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ])
    // 1 nov 2026 es domingo y el 30 es lunes: seis semanas.
    const noviembre = meses[10].semanas
    assert.equal(noviembre.length, 6)
    assert.deepEqual(noviembre[0], [null, null, null, null, null, null, '2026-11-01'])
    assert.deepEqual(noviembre[5], ['2026-11-30', null, null, null, null, null, null])
    // Febrero 2026 empieza en domingo y termina en sábado: cinco semanas.
    assert.equal(meses[1].semanas.length, 5)
    assert.equal(meses[1].semanas[4][5], '2026-02-28')
  })

  it('mesesDelAnio: cada día del año sale una sola vez (365 en 2026, 366 en 2028)', () => {
    const contar = (anio) =>
      mesesDelAnio(anio)
        .flatMap((m) => m.semanas.flat())
        .filter(Boolean).length
    assert.equal(contar(2026), 365)
    assert.equal(contar(2028), 366)
  })

  it('juntasPorDia: cuenta las juntas que tocan cada día del año y recorta lo que cae en otro año', () => {
    const junta = (inicio, fin) => ({ id: 1, inicio, fin })
    const juntas = [
      junta('2026-11-18 09:00:00', '2026-11-18 10:00:00'),
      junta('2026-11-18 11:00:00', '2026-11-18 12:00:00'),
      junta('2026-11-19 17:00:00', '2026-11-20 09:00:00'),
      // Termina a medianoche: no toca el 21.
      junta('2026-11-20 15:00:00', '2026-11-21 00:00:00'),
      junta('2026-12-31 22:00:00', '2027-01-01 02:00:00'),
      junta('2027-03-01 09:00:00', '2027-03-01 10:00:00'),
    ]
    assert.deepEqual(juntasPorDia(juntas, 2026), {
      '2026-11-18': 2,
      '2026-11-19': 1,
      '2026-11-20': 2,
      '2026-12-31': 1,
    })
    assert.deepEqual(juntasPorDia([], 2026), {})
  })

  it('textoDiaConJuntas: «18 de noviembre: 2 juntas», «1 junta» y «sin juntas»', () => {
    assert.equal(textoDiaConJuntas('2026-11-18', 2), '18 de noviembre: 2 juntas')
    assert.equal(textoDiaConJuntas('2026-11-18', 1), '18 de noviembre: 1 junta')
    assert.equal(textoDiaConJuntas('2026-11-18', 0), '18 de noviembre: sin juntas')
  })
})

describe('recepcionista como secretaria en la agenda de un administrador (rebanada 27)', () => {
  const ATENDIDOS = [{ id: 7, nombre: 'Ana Administradora' }]
  const admin = { id: 7, nombre: 'Ana Administradora', rol: 'administrador' }
  const contador = { id: 8, nombre: 'Carlos Contador', rol: 'contador' }

  it('organizadorDeAlta: solo la recepcionista con la agenda de un administrador agenda a su nombre', () => {
    assert.deepEqual(organizadorDeAlta('recepcionista', admin, ATENDIDOS), {
      id: 7,
      nombre: 'Ana Administradora',
    })
    assert.equal(organizadorDeAlta('recepcionista', contador, ATENDIDOS), null)
    assert.equal(organizadorDeAlta('recepcionista', null, ATENDIDOS), null)
    assert.equal(organizadorDeAlta('contador', admin, ATENDIDOS), null)
    assert.equal(organizadorDeAlta('administrador', admin, ATENDIDOS), null)
    assert.equal(organizadorDeAlta('auxiliar', admin, ATENDIDOS), null)
  })

  it('invitadoInicialDeAlta: invita a la persona de la agenda, salvo que se agende a nombre de ella', () => {
    assert.equal(invitadoInicialDeAlta('recepcionista', admin, ATENDIDOS), null)
    assert.deepEqual(invitadoInicialDeAlta('recepcionista', contador, ATENDIDOS), contador)
    assert.deepEqual(invitadoInicialDeAlta('contador', admin, ATENDIDOS), admin)
    assert.equal(invitadoInicialDeAlta('contador', null, ATENDIDOS), null)
  })
})

describe('administrador que atiende la recepcionista (rebanada 28)', () => {
  const admin = { id: 7, nombre: 'Ana Administradora', rol: 'administrador' }
  const otroAdmin = { id: 9, nombre: 'Beto Administrador', rol: 'administrador' }
  const contador = { id: 8, nombre: 'Carlos Contador', rol: 'contador' }
  const atendidos = [{ id: 7, nombre: 'Ana Administradora' }]

  it('administraAAdministrador: la persona es administrador y está en la lista de atendidos', () => {
    assert.equal(administraAAdministrador(admin, atendidos), true)
    assert.equal(administraAAdministrador(otroAdmin, atendidos), false)
    assert.equal(administraAAdministrador(contador, [{ id: 8, nombre: 'Carlos Contador' }]), false)
    assert.equal(administraAAdministrador(null, atendidos), false)
    assert.equal(administraAAdministrador(admin, []), false)
    assert.equal(administraAAdministrador(admin, undefined), false)
  })

  it('organizadorDeAlta e invitadoInicialDeAlta: con un administrador que no atiende, es una persona más', () => {
    assert.equal(organizadorDeAlta('recepcionista', otroAdmin, atendidos), null)
    assert.deepEqual(invitadoInicialDeAlta('recepcionista', otroAdmin, atendidos), otroAdmin)
    assert.deepEqual(organizadorDeAlta('recepcionista', admin, atendidos), {
      id: 7,
      nombre: 'Ana Administradora',
    })
    assert.equal(organizadorDeAlta('recepcionista', admin, []), null)
  })

  it('textoAdministradoresAtendidos: uno, varios o ninguno', () => {
    assert.equal(
      textoAdministradoresAtendidos(atendidos),
      'Administras la agenda de Ana Administradora',
    )
    assert.equal(
      textoAdministradoresAtendidos([...atendidos, { id: 9, nombre: 'Beto Administrador' }]),
      'Administras la agenda de Ana Administradora y Beto Administrador',
    )
    assert.equal(
      textoAdministradoresAtendidos([
        { id: 1, nombre: 'A' },
        { id: 2, nombre: 'B' },
        { id: 3, nombre: 'C' },
      ]),
      'Administras la agenda de A, B y C',
    )
    assert.equal(
      textoAdministradoresAtendidos([]),
      'No tienes asignada la agenda de ningún administrador. Pídele al despacho que la configure.',
    )
  })

  it('agendaInicialDeRecepcion: solo con exactamente un administrador y sin agenda ni junta en la URL', () => {
    assert.equal(agendaInicialDeRecepcion('recepcionista', atendidos, {}), '7')
    assert.equal(agendaInicialDeRecepcion('recepcionista', atendidos, { agenda: '9' }), null)
    assert.equal(agendaInicialDeRecepcion('recepcionista', atendidos, { juntaId: '5' }), null)
    assert.equal(agendaInicialDeRecepcion('recepcionista', [], {}), null)
    assert.equal(
      agendaInicialDeRecepcion('recepcionista', [...atendidos, { id: 9, nombre: 'Beto' }], {}),
      null,
    )
    assert.equal(agendaInicialDeRecepcion('contador', atendidos, {}), null)
  })
})

// --- rebanada 29: lo que no se veía en el calendario ----------------------------------------------

describe('horaEnElDia: la hora de la junta en el mes', () => {
  const cruzaMedianoche = {
    inicio: '2026-11-18 22:00:00',
    fin: '2026-11-19 01:30:00',
  }

  it('el día en que empieza muestra su hora de inicio', () => {
    assert.equal(horaEnElDia(cruzaMedianoche, '2026-11-18'), '22:00')
  })

  it('el día de continuación dice «Hasta» y la hora de fin, no la de inicio', () => {
    assert.equal(horaEnElDia(cruzaMedianoche, '2026-11-19'), 'Hasta 01:30')
  })
})

describe('etiquetaFueraDeHorario: juntas que no caben de 8:00 a 19:00', () => {
  const junta = (inicio, fin, titulo = 'Cierre') => ({ titulo, inicio, fin })

  it('una junta entera antes de las 8:00 dice «Antes de las 8:00 · hora título»', () => {
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 06:30:00', '2026-11-18 07:30:00'), '2026-11-18'),
      'Antes de las 8:00 · 06:30 Cierre',
    )
  })

  it('una junta entera después de las 19:00 dice «Después de las 19:00 · hora título»', () => {
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 19:30:00', '2026-11-18 20:30:00'), '2026-11-18'),
      'Después de las 19:00 · 19:30 Cierre',
    )
  })

  it('una junta que termina justo a las 8:00 o empieza justo a las 19:00 también cae fuera', () => {
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 07:00:00', '2026-11-18 08:00:00'), '2026-11-18'),
      'Antes de las 8:00 · 07:00 Cierre',
    )
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 19:00:00', '2026-11-18 19:30:00'), '2026-11-18'),
      'Después de las 19:00 · 19:00 Cierre',
    )
  })

  it('una que cruza la medianoche: «Después» el primer día y «Antes … Hasta» el siguiente', () => {
    const noche = junta('2026-11-18 22:00:00', '2026-11-19 01:30:00')
    assert.equal(etiquetaFueraDeHorario(noche, '2026-11-18'), 'Después de las 19:00 · 22:00 Cierre')
    assert.equal(
      etiquetaFueraDeHorario(noche, '2026-11-19'),
      'Antes de las 8:00 · Hasta 01:30 Cierre',
    )
  })

  it('una junta dentro del horario, recortada o de otro día no lleva etiqueta de este tipo', () => {
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 09:00:00', '2026-11-18 10:00:00'), '2026-11-18'),
      null,
    )
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 07:00:00', '2026-11-18 09:00:00'), '2026-11-18'),
      null,
    )
    assert.equal(
      etiquetaFueraDeHorario(junta('2026-11-18 06:30:00', '2026-11-18 07:30:00'), '2026-11-19'),
      null,
    )
  })

  it('un bloque ajeno usa su texto de ocupado (sin título ni ficha)', () => {
    const privada = {
      ocupado: true,
      privada: true,
      inicio: '2026-11-18 06:30:00',
      fin: '2026-11-18 07:30:00',
    }
    assert.equal(etiquetaFueraDeHorario(privada, '2026-11-18'), 'Antes de las 8:00 · 06:30 Ocupado')
  })
})

describe('notaDeRecorte: bloques que empiezan antes o terminan después del horario', () => {
  it('empieza antes de las 8:00: «Empieza {hora real}»', () => {
    assert.equal(
      notaDeRecorte({ inicio: '2026-11-18 07:00:00', fin: '2026-11-18 09:00:00' }, '2026-11-18'),
      'Empieza 07:00',
    )
  })

  it('termina después de las 19:00: «Sigue hasta {hora real}»', () => {
    assert.equal(
      notaDeRecorte({ inicio: '2026-11-18 18:00:00', fin: '2026-11-18 20:00:00' }, '2026-11-18'),
      'Sigue hasta 20:00',
    )
  })

  it('recortado por ambos lados dice las dos cosas', () => {
    assert.equal(
      notaDeRecorte({ inicio: '2026-11-18 07:00:00', fin: '2026-11-18 20:00:00' }, '2026-11-18'),
      'Empieza 07:00 · Sigue hasta 20:00',
    )
  })

  it('si el otro extremo cae en otro día, lo dice con su fecha', () => {
    const cruza = { inicio: '2026-11-18 18:00:00', fin: '2026-11-19 09:00:00' }
    assert.equal(notaDeRecorte(cruza, '2026-11-18'), 'Sigue hasta 19-11-2026 09:00')
    const llega = { inicio: '2026-11-18 07:00:00', fin: '2026-11-18 09:00:00' }
    assert.equal(notaDeRecorte(llega, '2026-11-18'), 'Empieza 07:00')
    const vieneDeAyer = { inicio: '2026-11-17 18:00:00', fin: '2026-11-18 09:00:00' }
    assert.equal(notaDeRecorte(vieneDeAyer, '2026-11-18'), 'Empieza 17-11-2026 18:00')
  })

  it('un bloque que cabe en el horario no lleva nota', () => {
    assert.equal(
      notaDeRecorte({ inicio: '2026-11-18 09:00:00', fin: '2026-11-18 10:00:00' }, '2026-11-18'),
      '',
    )
  })
})

describe('semanaMuestraFinDeSemana y textoPeriodo con fin de semana', () => {
  const juntaEl = (dia) => ({ inicio: `${dia} 10:00:00`, fin: `${dia} 11:00:00` })

  it('sin nada en sábado ni domingo se queda de lunes a viernes', () => {
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [juntaEl('2026-11-18')], []), false)
  })

  it('una junta en sábado o en domingo agrega el fin de semana', () => {
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [juntaEl('2026-11-21')], []), true)
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [juntaEl('2026-11-22')], []), true)
  })

  it('un vencimiento en sábado o en domingo también', () => {
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [], ['2026-11-21']), true)
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [], ['2026-11-22']), true)
  })

  it('lo de otra semana no cuenta', () => {
    assert.equal(
      semanaMuestraFinDeSemana('2026-11-18', [juntaEl('2026-11-28')], ['2026-11-29']),
      false,
    )
  })

  it('una junta del viernes que cruza a sábado agrega el fin de semana', () => {
    const noche = { inicio: '2026-11-20 22:00:00', fin: '2026-11-21 01:00:00' }
    assert.equal(semanaMuestraFinDeSemana('2026-11-18', [noche], []), true)
  })

  it('el periodo llega al domingo cuando se muestra el fin de semana', () => {
    assert.equal(textoPeriodo('semana', '2026-11-18', true), '16 – 22 de noviembre de 2026')
    assert.equal(textoPeriodo('semana', '2026-11-18', false), '16 – 20 de noviembre de 2026')
    assert.equal(
      textoPeriodo('semana', '2026-11-30', true),
      '30 de noviembre – 6 de diciembre de 2026',
    )
  })
})

describe('marcasDeJunta en la agenda de otra persona', () => {
  const invitada = (participantes, responderPor = []) => ({
    estado: 'confirmada',
    participantes,
    responder_por: responderPor,
  })

  it('en tu agenda (sin agenda ajena) «Responder» sigue igual', () => {
    const junta = invitada([{ id: 3, respuesta: 'pendiente' }])
    assert.deepEqual(marcasDeJunta(junta, 3), ['Responder'])
    assert.deepEqual(marcasDeJunta(junta, 3, null), ['Responder'])
  })

  it('la recepcionista en la agenda de un administrador con respuesta pendiente: «Responder por {nombre}»', () => {
    const junta = invitada(
      [{ id: 7, respuesta: 'pendiente' }],
      [{ id: 7, nombre: 'Ana Pérez', respuesta: 'pendiente' }],
    )
    assert.deepEqual(marcasDeJunta(junta, 3, '7'), ['Responder por Ana Pérez'])
  })

  it('si ese administrador ya respondió, no hay marca de respuesta', () => {
    const junta = invitada(
      [{ id: 7, respuesta: 'aceptada' }],
      [{ id: 7, nombre: 'Ana Pérez', respuesta: 'aceptada' }],
    )
    assert.deepEqual(marcasDeJunta(junta, 3, '7'), [])
  })

  it('responder_por de otro administrador distinto al de la agenda no cuenta', () => {
    const junta = invitada(
      [{ id: 8, respuesta: 'pendiente' }],
      [{ id: 8, nombre: 'Luis Gómez', respuesta: 'pendiente' }],
    )
    assert.deepEqual(marcasDeJunta(junta, 3, '7'), [])
  })

  it('en otra agenda ajena, si tu invitación está pendiente dice «Tu respuesta pendiente»', () => {
    const junta = invitada([{ id: 3, respuesta: 'pendiente' }])
    assert.deepEqual(marcasDeJunta(junta, 3, '7'), ['Tu respuesta pendiente'])
  })

  it('el estado sigue yendo primero y un bloque ocupado no lleva marcas', () => {
    const junta = {
      ...invitada(
        [{ id: 7, respuesta: 'pendiente' }],
        [{ id: 7, nombre: 'Ana Pérez', respuesta: 'pendiente' }],
      ),
      estado: 'por_confirmar',
    }
    assert.deepEqual(marcasDeJunta(junta, 3, '7'), ['Por confirmar', 'Responder por Ana Pérez'])
    assert.deepEqual(marcasDeJunta({ ocupado: true }, 3, '7'), [])
  })
})

describe('agendar junta desde el directorio (rebanada 36)', () => {
  const contador = { id: 5, nombre: 'Carlos Ruiz', rolClave: 'contador' }
  const sistema = { id: 9, nombre: 'Sistema', rolClave: 'usuarios_de_sistema' }
  const adminAtendido = { id: 1, nombre: 'Ana Pérez', rolClave: 'administrador' }
  const otroAdmin = { id: 2, nombre: 'Luis Soto', rolClave: 'administrador' }

  describe('puedeAgendarDesdeDirectorio', () => {
    it('el administrador y la recepcionista lo ven en las cuentas que usan el calendario', () => {
      for (const rolClave of ['administrador', 'contador', 'auxiliar', 'recepcionista']) {
        assert.equal(puedeAgendarDesdeDirectorio('administrador', { id: 5, rolClave }, 1), true)
        assert.equal(puedeAgendarDesdeDirectorio('recepcionista', { id: 5, rolClave }, 8), true)
      }
    })

    it('los demás roles no lo ven', () => {
      for (const rol of ['contador', 'auxiliar', 'usuarios_de_sistema', null]) {
        assert.equal(puedeAgendarDesdeDirectorio(rol, contador, 1), false)
      }
    })

    it('no sale en la fila del usuario de sistema ni en la de quien tiene la sesión', () => {
      assert.equal(puedeAgendarDesdeDirectorio('administrador', sistema, 1), false)
      assert.equal(puedeAgendarDesdeDirectorio('administrador', contador, '5'), false)
      assert.equal(puedeAgendarDesdeDirectorio('administrador', contador, 5), false)
    })
  })

  describe('altaDesdeDirectorio', () => {
    it('el administrador organiza y la persona de la fila va invitada', () => {
      assert.deepEqual(altaDesdeDirectorio('administrador', contador, []), [
        {
          organizador: null,
          invitadoInicial: { id: 5, nombre: 'Carlos Ruiz', rol: 'contador' },
          texto: 'Carlos Ruiz',
        },
      ])
    })

    it('la recepcionista con la fila de un administrador que atiende agenda a nombre de él, sin invitados', () => {
      assert.deepEqual(
        altaDesdeDirectorio('recepcionista', adminAtendido, [{ id: 1, nombre: 'Ana Pérez' }]),
        [
          {
            organizador: { id: 1, nombre: 'Ana Pérez' },
            invitadoInicial: null,
            texto: 'Ana Pérez',
          },
        ],
      )
    })

    it('con un administrador atendido, la fila de otra persona va invitada y el organizador es él', () => {
      assert.deepEqual(
        altaDesdeDirectorio('recepcionista', contador, [{ id: 1, nombre: 'Ana Pérez' }]),
        [
          {
            organizador: { id: 1, nombre: 'Ana Pérez' },
            invitadoInicial: { id: 5, nombre: 'Carlos Ruiz', rol: 'contador' },
            texto: 'Ana Pérez',
          },
        ],
      )
      // Un administrador que no atiende también va como invitado.
      assert.equal(
        altaDesdeDirectorio('recepcionista', otroAdmin, [{ id: 1, nombre: 'Ana Pérez' }])[0]
          .invitadoInicial.id,
        2,
      )
    })

    it('con varios administradores atendidos hay una opción por cada uno, para el menú «A nombre de…»', () => {
      const atendidos = [
        { id: 1, nombre: 'Ana Pérez' },
        { id: 2, nombre: 'Luis Soto' },
      ]
      const opciones = altaDesdeDirectorio('recepcionista', contador, atendidos)
      assert.deepEqual(
        opciones.map((o) => [o.texto, o.organizador.id, o.invitadoInicial.id]),
        [
          ['Ana Pérez', 1, 5],
          ['Luis Soto', 2, 5],
        ],
      )
    })

    it('con varios atendidos, la fila de uno de ellos se agenda directo a nombre de él', () => {
      const atendidos = [
        { id: 1, nombre: 'Ana Pérez' },
        { id: 2, nombre: 'Luis Soto' },
      ]
      assert.deepEqual(altaDesdeDirectorio('recepcionista', adminAtendido, atendidos), [
        { organizador: { id: 1, nombre: 'Ana Pérez' }, invitadoInicial: null, texto: 'Ana Pérez' },
      ])
    })

    it('sin administradores atendidos la junta queda a nombre de la recepcionista con la fila invitada', () => {
      assert.deepEqual(altaDesdeDirectorio('recepcionista', contador, []), [
        {
          organizador: null,
          invitadoInicial: { id: 5, nombre: 'Carlos Ruiz', rol: 'contador' },
          texto: 'Carlos Ruiz',
        },
      ])
    })
  })
})

describe('campoDeErrorJunta con cliente, modalidad y lugar', () => {
  it('lleva cada error de la API a su campo', () => {
    const mensaje = (campo) => `El valor no es válido sobre ${campo}: Corrígelo`
    assert.equal(campoDeErrorJunta(mensaje('cliente')), 'cliente')
    assert.equal(campoDeErrorJunta(mensaje('modalidad')), 'modalidad')
    assert.equal(campoDeErrorJunta(mensaje('lugar')), 'lugar')
  })
})

describe('modalidad y lugar de la ficha', () => {
  it('etiquetaModalidad traduce el valor guardado y deja vacío lo demás', () => {
    assert.equal(etiquetaModalidad('presencial'), 'Presencial')
    assert.equal(etiquetaModalidad('virtual'), 'Virtual')
    assert.equal(etiquetaModalidad(null), '')
    assert.equal(etiquetaModalidad('otra'), '')
  })

  it('enlaceDeLugar solo devuelve el enlace si es virtual y empieza con http:// o https://', () => {
    const virtual = (lugar) => ({ modalidad: 'virtual', lugar })
    assert.equal(enlaceDeLugar(virtual('https://meet.example/x')), 'https://meet.example/x')
    assert.equal(enlaceDeLugar(virtual('  http://meet.example/x  ')), 'http://meet.example/x')
    assert.equal(enlaceDeLugar(virtual('javascript:alert(1)')), null)
    assert.equal(enlaceDeLugar(virtual('Sala de Teams')), null)
    assert.equal(enlaceDeLugar(virtual(null)), null)
    assert.equal(enlaceDeLugar({ modalidad: 'presencial', lugar: 'https://x.example' }), null)
    assert.equal(enlaceDeLugar({ modalidad: null, lugar: 'https://x.example' }), null)
  })
})
