// Pruebas de la etiqueta y el color del estado de un documento (estadoDocumentoVista.js).
// Se ejecutan con `node --test` desde `Seguimiento-proyectos/`, sin dependencias: el módulo
// es JavaScript puro y no importa Vue ni Quasar.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { estiloDeEstadoDocumento } from './estadoDocumentoVista.js'

// Los cinco valores del ENUM `documentos.estado` (Backend/schema.sql), con lo que debe ver el
// usuario. `fondo` es el color del punto de los selectores; `chip` son las clases de la píldora
// clara (texto y borde del color del estado, contraste en `test/paletaColores.test.js`).
test('los cinco estados de la base salen en español con su píldora', () => {
  const esperado = {
    RECEPCIONADO: {
      etiqueta: 'Recepcionado',
      fondo: 'bg-info',
      chip: 'chip-doc chip-doc--recepcionado',
      icono: 'move_to_inbox',
    },
    EN_PROCESO: {
      etiqueta: 'En proceso',
      fondo: 'bg-info',
      chip: 'chip-doc chip-doc--en-proceso',
      icono: 'find_in_page',
    },
    PENDIENTE_CLIENTE: {
      etiqueta: 'Pendiente del cliente',
      fondo: 'bg-warning',
      chip: 'chip-doc chip-doc--pendiente',
      icono: 'schedule',
    },
    COMPLETADO: {
      etiqueta: 'Completado',
      fondo: 'bg-positive',
      chip: 'chip-doc chip-doc--completado',
      icono: 'check_circle',
    },
    CANCELADO: {
      etiqueta: 'Cancelado',
      fondo: 'bg-negative',
      chip: 'chip-doc chip-doc--cancelado',
      icono: 'cancel',
    },
  }

  for (const [estado, estilo] of Object.entries(esperado)) {
    assert.deepEqual(estiloDeEstadoDocumento(estado), estilo, estado)
  }
})

// Falla hacia el lado seguro: un estado que no es de los cinco no puede verse como terminado.
// Sale neutro y dice que no se reconoce.
test('un estado desconocido sale neutro, nunca como completado', () => {
  const neutro = {
    etiqueta: 'Estado no reconocido',
    fondo: 'bg-secondary-white-alternative',
    chip: 'chip-doc chip-doc--neutro',
    icono: 'help',
  }

  for (const estado of ['APROBADO', 'completado', '', null, undefined]) {
    assert.deepEqual(estiloDeEstadoDocumento(estado), neutro, String(estado))
  }
})
