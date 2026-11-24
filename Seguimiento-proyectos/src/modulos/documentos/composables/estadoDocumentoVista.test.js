// Pruebas de la etiqueta y el color del estado de un documento (estadoDocumentoVista.js).
// Se ejecutan con `node --test` desde `Frontend/`, sin dependencias: el módulo
// es JavaScript puro y no importa Vue ni Quasar.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { estiloDeEstadoDocumento } from './estadoDocumentoVista.js'

// Los cinco valores del ENUM `documentos.estado` (Backend/schema.sql), con lo que
// debe ver el usuario. Texto oscuro sobre los fondos claros; blanco solo sobre
// $negative (6.41:1), como manda AGENTS.md.
test('los cinco estados de la base salen en español con su color', () => {
  const esperado = {
    RECEPCIONADO: {
      etiqueta: 'Recepcionado',
      fondo: 'bg-info',
      texto: 'text-primary',
      icono: 'move_to_inbox',
    },
    EN_PROCESO: {
      etiqueta: 'En proceso',
      fondo: 'bg-info',
      texto: 'text-primary',
      icono: 'find_in_page',
    },
    PENDIENTE_CLIENTE: {
      etiqueta: 'Pendiente del cliente',
      fondo: 'bg-warning',
      texto: 'text-primary',
      icono: 'schedule',
    },
    COMPLETADO: {
      etiqueta: 'Completado',
      fondo: 'bg-positive',
      texto: 'text-primary',
      icono: 'check_circle',
    },
    CANCELADO: {
      etiqueta: 'Cancelado',
      fondo: 'bg-negative',
      texto: 'text-white',
      icono: 'cancel',
    },
  }

  for (const [estado, estilo] of Object.entries(esperado)) {
    assert.deepEqual(estiloDeEstadoDocumento(estado), estilo, estado)
  }
})

// Falla hacia el lado seguro: un estado que no es de los cinco no puede verse
// como terminado. Sale neutro y dice que no se reconoce.
test('un estado desconocido sale neutro, nunca como completado', () => {
  const neutro = {
    etiqueta: 'Estado no reconocido',
    fondo: 'bg-secondary-white-alternative',
    texto: 'text-grey-8',
    icono: 'help',
  }

  for (const estado of ['APROBADO', 'completado', '', null, undefined]) {
    assert.deepEqual(estiloDeEstadoDocumento(estado), neutro, String(estado))
  }
})
