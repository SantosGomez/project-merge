// Pruebas estáticas del panel de chat de la auditoría (experimento, rebanada 2).
// No montan Vue: comprueban que el panel usa componentes de Quasar, textos en español,
// colores de la paleta y que la tarjeta y la ficha lo abren.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) => readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8')

const chat = leer('../src/components/ChatAuditoria.vue')
const plantilla = chat.split('<script')[0]
const script = chat.slice(chat.indexOf('<script'), chat.indexOf('</script>'))
const estilos = chat.slice(chat.indexOf('<style'))
const tarjeta = leer('../src/components/AuditoriaItem.vue')
const ficha = leer('../src/pages/AuditoriaFichaPage.vue')

describe('Panel de chat de la auditoría', () => {
  it('es un panel lateral derecho de altura completa', () => {
    assert.match(plantilla, /<q-dialog[\s\S]*?position="right"[\s\S]*?full-height/)
    assert.match(plantilla, /aria-labelledby="chat-auditoria-titulo"/)
    assert.match(plantilla, /id="chat-auditoria-titulo"/)
  })

  it('muestra cada mensaje con q-chat-message: los propios a la derecha', () => {
    assert.match(plantilla, /<q-chat-message/)
    assert.match(plantilla, /:sent="esPropio\(mensaje\)"/)
    assert.match(plantilla, /:name="mensaje\.autor\.nombre"/)
    assert.match(plantilla, /:stamp="mensaje\.fechaHora"/)
    assert.match(script, /mensaje\.autor\.id === Number\(session\.id\)/, 'el id de la sesión se guarda como texto')
  })

  it('las burbujas usan colores de la paleta', () => {
    const colores = [...plantilla.matchAll(/(?:bg|text)-color="[^"]*"/g)].map((m) => m[0])
    assert.ok(colores.length > 0, 'las burbujas declaran sus colores')
    for (const color of colores) assert.match(color, /dg-|primary/, `${color} viene de la paleta`)
    assert.doesNotMatch(estilos, /#[0-9a-fA-F]{3,8}\b/, 'sin hexadecimales en el componente')
  })

  it('el campo de texto limita a 1000 caracteres y el botón «Enviar» tiene tooltip', () => {
    assert.match(plantilla, /<q-input[\s\S]*?maxlength="1000"[\s\S]*?counter/)
    assert.match(plantilla, /label="Enviar"/)
    assert.match(plantilla, /<q-tooltip>Envía el mensaje a todos los participantes de la auditoría\.<\/q-tooltip>/)
    assert.match(plantilla, /:disable="!puedeEnviar"/)
  })

  it('Enter envía y Mayús+Enter hace salto de línea', () => {
    assert.match(plantilla, /@keydown\.enter\.exact\.prevent="enviar"/)
  })

  it('tiene estados de carga, error y chat vacío', () => {
    assert.match(plantilla, /<ScreenLoader/)
    assert.match(plantilla, /<ErrorState/)
    assert.match(plantilla, /Todavía no hay mensajes/)
  })

  it('carga los mensajes al abrirse y usa el servicio de auditorías', () => {
    assert.match(
      script,
      /import \{ enviarMensaje, listarMensajes, mensajeDeBackend \} from '\.\.\/services\/auditoriaService\.js'/,
    )
    assert.match(script, /watch\(\s*\(\) => props\.modelValue/)
  })
})

describe('Botón «Mensajes» que abre el chat', () => {
  it('la tarjeta de la auditoría lo ofrece', () => {
    assert.match(tarjeta, /label="Mensajes"/)
    assert.match(tarjeta, /emit\('abrir-chat'\)/)
  })

  it('la ficha lo ofrece y monta el panel', () => {
    assert.match(ficha, /label="Mensajes"/)
    assert.match(ficha, /<ChatAuditoria/)
  })
})

describe('Mensajes del chat en tiempo real', () => {
  it('escucha el aviso «mensaje-auditoria» y, al reconectar, recarga el chat', () => {
    assert.match(script, /import \{ eventos \} from '\.\.\/services\/eventosService\.js'/)
    assert.match(script, /eventos\.escuchar\('mensaje-auditoria', alRecibirMensaje\)/)
    assert.match(script, /eventos\.escuchar\('reconectado', recargarSiAbierto\)/)
    assert.match(script, /onBeforeUnmount\(/, 'deja de escuchar al desmontarse')
  })

  it('solo agrega mensajes de su auditoría y sin repetir los que ya tiene', () => {
    assert.match(script, /datos\.auditoriaId !== props\.auditoriaId/)
    assert.match(script, /mensajes\.value\.some\(\(m\) => m\.id === nuevo\.id\)/)
    assert.match(script, /mensajeDeBackend\(datos\.mensaje\)/)
  })
})
