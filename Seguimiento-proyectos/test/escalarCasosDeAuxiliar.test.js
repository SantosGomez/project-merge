// Escalar casos de un auxiliar: el auxiliar no marca «Importante»; lo hace su contador y así
// el administrador lo ve en el detalle del contador y en el directorio.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { usuarioAFila } from '../src/utils/filasVista.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')
const plantillaDe = (fuente) => fuente.split('<script')[0]
const scriptDe = (fuente) => fuente.slice(fuente.indexOf('<script'), fuente.indexOf('<style'))

const casoItem = leer('../src/components/CasoItem.vue')
const myCases = leer('../src/pages/MyCasesPage.vue')
const formulario = leer('../src/components/CaseFormDialog.vue')
const detalleContador = leer('../src/components/DetalleContador.vue')
const directorio = leer('../src/pages/CountersDirectoryPage.vue')
const dialogo = leer('../src/components/CasosDeAuxiliarDialog.vue')

describe('El auxiliar no marca «Importante»', () => {
  it('CasoItem oculta la estrella cuando no se puede marcar', () => {
    assert.match(
      scriptDe(casoItem),
      /puedeMarcarImportante:\s*\{[^}]*default:\s*true/s,
      'prop con true por defecto',
    )
    assert.match(
      plantillaDe(casoItem),
      /v-if="!soloLectura && !soloCambiaEstado && puedeMarcarImportante"[^>]*class="caso-item__estrella"/,
      'la estrella depende de la prop',
    )
  })

  it('«Mis casos» no deja marcar al auxiliar y se lo explica', () => {
    assert.match(plantillaDe(myCases), /:puede-marcar-importante="!session\.esAuxiliar"/)
    assert.match(
      plantillaDe(myCases),
      /solo tu contador puede marcar un caso como importante/i,
      'texto de ayuda',
    )
  })

  it('el formulario no muestra «Caso importante» al auxiliar', () => {
    const plantilla = plantillaDe(formulario)
    const grupo = plantilla.slice(
      plantilla.lastIndexOf('<div', plantilla.indexOf('label="Caso importante"') - 60),
    )
    assert.match(
      grupo.slice(0, 200),
      /v-if="!session\.esAuxiliar"/,
      'el grupo del interruptor se oculta',
    )
  })
})

describe('El administrador ve los casos escalados', () => {
  it('el detalle del contador dice de qué auxiliar es cada caso escalado', () => {
    assert.match(
      plantillaDe(detalleContador),
      /:contador-autenticado-id="contador\.id"/,
      'CasoItem recibe al contador',
    )
    assert.match(
      scriptDe(casoItem),
      /Caso de un auxiliar de este contador/,
      'ayuda para el administrador',
    )
  })

  it('el directorio ofrece «Ver casos importantes» en las cuentas de auxiliar', () => {
    const fila = usuarioAFila({ id: 5, nombre: 'Aux', correo: 'a@b.c', rol: 'auxiliar' })
    assert.equal(fila.puedeVerCasosDeAuxiliar, true)
    assert.equal(usuarioAFila({ id: 6, rol: 'contador' }).puedeVerCasosDeAuxiliar, false)
    assert.equal(
      usuarioAFila({ id: 6, rol: 'contador' }).puedeVerCasos,
      true,
      'el contador sigue igual',
    )

    const plantilla = plantillaDe(directorio)
    const botones =
      plantilla.match(/v-if="props\.row\.puedeVerCasosDeAuxiliar && session\.esAdministrador"/g) ??
      []
    assert.equal(botones.length, 2, 'en la tabla y en la tarjeta de celular')
    assert.match(plantilla, /@click="abrirCasosDeAuxiliar\(props\.row\)"/)
    assert.match(plantilla, /<CasosDeAuxiliarDialog/)
  })

  it('el diálogo carga solo los casos importantes del auxiliar y permite cambiar la prioridad', () => {
    const plantilla = plantillaDe(dialogo)
    const script = scriptDe(dialogo)
    assert.match(script, /getCasosPorContador\(props\.cuenta\.id, \{ soloImportantes: true \}\)/)
    assert.match(script, /cambiarPrioridadComoAdmin\(caso\.id, prioridad\)/)
    assert.match(plantilla, /<DetalleContador/, 'reutiliza el detalle del dashboard')
    assert.match(plantilla, /auxiliar/, 'DetalleContador en modo auxiliar')
    assert.match(plantilla, /transition-show="dialogo-entra"/)
    assert.match(
      plantilla,
      /Un auxiliar no puede marcar casos como importantes/,
      'explica la regla',
    )
    assert.doesNotMatch(
      dialogo.slice(dialogo.indexOf('<style')),
      /#[0-9a-fA-F]{3,6}\b/,
      'sin hexadecimales',
    )
  })

  it('el detalle adapta sus textos cuando la cuenta es un auxiliar', () => {
    assert.match(scriptDe(detalleContador), /auxiliar:\s*\{\s*type:\s*Boolean/, 'prop auxiliar')
    assert.match(plantillaDe(detalleContador), /Este auxiliar no tiene casos importantes/)
  })
})
