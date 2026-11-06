// Aviso emergente de mensajes del chat (experimento): solo para contadores, nunca por un mensaje
// propio ni si el chat de esa auditoría ya está abierto.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

import { avisoDeMensaje } from '../src/utils/avisosChat.js'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const datos = (extra = {}) => ({
  auditoriaId: 7,
  cliente: 'Cliente Ejemplo, S.A.',
  mensaje: { id: 30, texto: 'Ya subí los contratos.', autor: { id: 3, nombre: 'Brenda Chávez' } },
  ...extra,
})

describe('avisoDeMensaje', () => {
  it('arma el aviso para un contador que no tiene abierto ese chat', () => {
    assert.deepEqual(avisoDeMensaje(datos(), { esContador: true, usuarioId: '9', chatAbiertoId: null }), {
      auditoriaId: 7,
      titulo: 'Brenda Chávez escribió en la auditoría de Cliente Ejemplo, S.A.',
      texto: 'Ya subí los contratos.',
    })
  })

  it('no avisa al administrador, por un mensaje propio ni con el chat de esa auditoría abierto', () => {
    assert.equal(avisoDeMensaje(datos(), { esContador: false, usuarioId: '9', chatAbiertoId: null }), null)
    assert.equal(avisoDeMensaje(datos(), { esContador: true, usuarioId: '3', chatAbiertoId: null }), null)
    assert.equal(avisoDeMensaje(datos(), { esContador: true, usuarioId: '9', chatAbiertoId: 7 }), null)
  })

  it('sí avisa si el chat abierto es de otra auditoría, y recorta los textos largos', () => {
    const largo = datos({ mensaje: { id: 31, texto: 'x'.repeat(200), autor: { id: 3, nombre: 'Brenda' } } })
    const aviso = avisoDeMensaje(largo, { esContador: true, usuarioId: '9', chatAbiertoId: 4 })
    assert.ok(aviso)
    assert.ok(aviso.texto.length <= 121)
    assert.ok(aviso.texto.endsWith('…'))
  })
})

describe('Conexión del aviso con la app', () => {
  const layout = leer('../src/layouts/MaquetaLayout.vue')
  const chat = leer('../src/components/ChatAuditoria.vue')
  const ficha = leer('../src/pages/AuditoriaFichaPage.vue')

  it('el layout escucha los mensajes y muestra un aviso con «Ver mensajes»', () => {
    assert.match(layout, /eventos\.escuchar\('mensaje-auditoria', alRecibirMensajeDelChat\)/)
    assert.match(layout, /avisoDeMensaje\(datos, \{/)
    assert.match(layout, /label: 'Ver mensajes'/)
    assert.match(layout, /name: 'auditoria-ficha', params: \{ id: aviso\.auditoriaId \}, query: \{ chat: '1' \}/)
  })

  it('el panel del chat avisa qué auditoría tiene abierta', () => {
    assert.match(chat, /auditoriaConChatAbierto\.value = abierto \? props\.auditoriaId : null/)
  })

  it('la ficha abre el chat cuando llega con ?chat=1', () => {
    assert.match(ficha, /watch\(\s*\(\) => route\.query\.chat/)
    assert.match(ficha, /chatAbierto\.value = true/)
  })
})
