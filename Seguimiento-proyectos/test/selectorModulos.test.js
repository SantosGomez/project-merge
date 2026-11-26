// Selector de módulos (rebanada 52b): botón «Ajustes» solo para administrador, sistemas y
// recepcionista, tarjetas apagadas con aviso cuando no hay acceso y estilos sin valores sueltos.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const leer = (relativa) =>
  readFileSync(fileURLToPath(new URL(relativa, import.meta.url)), 'utf8').replace(/\r\n/g, '\n')

describe('Selector de módulos: botón «Ajustes»', () => {
  const pagina = leer('../src/pages/ModulosPage.vue')

  it('solo se muestra a quien puede abrir Ajustes y lleva texto, tooltip y aria-label', () => {
    const inicio = pagina.indexOf('class="boton-ajustes')
    assert.ok(inicio >= 0, 'falta el botón')
    const boton = pagina.slice(
      pagina.lastIndexOf('<q-btn', inicio),
      pagina.indexOf('</q-btn>', inicio),
    )
    assert.match(boton, /v-if="veAjustes"/)
    assert.match(boton, /aria-label="Ajustes"/)
    assert.match(boton, /@click="abrirAjustes"/)
    assert.match(boton, /<span class="boton-ajustes__texto">Ajustes<\/span>/)
    assert.match(boton, /<q-tooltip>Usuarios y clientes del despacho<\/q-tooltip>/)
    assert.match(pagina, /const veAjustes = computed\(\(\) => puedeAbrirAjustes\(session\.rol\)\)/)
  })

  it('abrirAjustes está definida y navega a la ruta ajustes', () => {
    assert.match(
      pagina,
      /const abrirAjustes = \(\) => \{?[^}]*router\.push\(\{ name: 'ajustes' \}\)/s,
    )
  })

  it('conserva el estilo del usuario: círculo de 45 px que se expande al pasar el mouse, como «Cerrar sesión»', () => {
    assert.match(pagina, /\.boton-ajustes \{[^}]*width: 45px;[^}]*border-radius: 50%/s)
    assert.match(pagina, /\.boton-ajustes__texto \{[^}]*width: 0;[^}]*opacity: 0/s)
    assert.match(
      pagina,
      /\.boton-ajustes:hover,\s*\.boton-ajustes:focus-visible \{[^}]*width: 168px;[^}]*border-radius: 40px/s,
    )
    // En pantallas táctiles no hay hover: ahí el botón se ve abierto, con su texto.
    const tactil = pagina.slice(pagina.indexOf('@media (hover: none)'))
    assert.match(tactil, /\.boton-ajustes \{[^}]*width: 168px/s)
    assert.match(tactil, /\.boton-ajustes__texto \{[^}]*opacity: 1/s)
  })

  it('el CSS usa solo variables de la paleta que existen y el movimiento reducido tiene todas sus comas', () => {
    assert.doesNotMatch(pagina, /--dg-primary|--dg-texto-oscuro/)
    assert.doesNotMatch(
      pagina,
      /outline:[^;]*--dg-anillo-foco/,
      'esa variable es una sombra, no un color',
    )
    assert.equal(
      (pagina.match(/focus-visible \{\s*outline: 3px solid var\(--dg-foco\)/g) ?? []).length,
      3,
      'tarjeta de módulo, botón Ajustes y botón del perfil',
    )
    assert.match(pagina, /\.boton-cerrar-sesion__texto,\s*\.boton-ajustes,\s*\.tarjeta-perfil \{/)
    assert.doesNotMatch(pagina, /transition:\s*all/)
    assert.doesNotMatch(pagina, /#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('Selector de módulos: tarjeta de perfil', () => {
  const pagina = leer('../src/pages/ModulosPage.vue')

  it('toda la tarjeta es un enlace a «Mi perfil» y solo la ve quien trabaja casos', () => {
    assert.match(
      pagina,
      /<RouterLink\s+v-if="session\.trabajaCasos"\s+class="tarjeta-perfil boton-presionable"\s+:to="\{ name: 'mi-perfil' \}"\s+aria-label="Ir a mi perfil"/,
    )
    const inicio = pagina.indexOf('class="tarjeta-perfil boton-presionable"')
    const tarjeta = pagina.slice(inicio, pagina.indexOf('</RouterLink>', inicio))
    assert.match(tarjeta, /<span class="tarjeta-perfil__boton">Ver perfil<\/span>/)
    assert.doesNotMatch(tarjeta, /<q-btn/, 'un botón dentro del enlace sería un control anidado')
  })

  it('muestra el nombre y el rol general con un ícono de avatar y sin hexadecimales', () => {
    assert.match(pagina, /\{\{ nombrePerfil \}\}/)
    assert.match(pagina, /\{\{ rolPerfil \}\}/)
    assert.match(
      pagina,
      /const nombrePerfil = computed\(\(\) => session\.nombreVisible \|\| 'Tu cuenta'\)/,
    )
    assert.match(pagina, /const rolPerfil = computed\(\(\) => formatearRol\(session\.rol\)\)/)
    assert.match(pagina, /<q-icon name="person"/)
    assert.doesNotMatch(pagina, /#[0-9a-fA-F]{3,8}\b/)
  })

  it('en escritorio va fija en la esquina de la pantalla y en horizontal', () => {
    const escritorio = pagina.slice(pagina.indexOf('@media (min-width: 1200px)'))
    assert.match(
      escritorio,
      /\.tarjeta-perfil \{[^}]*position: fixed;[^}]*top: 24px;[^}]*right: 24px;/s,
    )
    assert.match(escritorio, /\.tarjeta-perfil \{[^}]*flex-wrap: nowrap;/s)
  })

  it('en pantallas angostas se queda en el flujo, debajo del saludo', () => {
    assert.match(pagina, /\.tarjeta-perfil \{[^}]*max-width: 340px;/s)
    assert.match(pagina, /\.tarjeta-perfil \{[^}]*flex-wrap: wrap;/s)
    assert.doesNotMatch(pagina, /@media \(max-width: 899px\)/)
  })
})

describe('Selector de módulos: tarjetas sin acceso', () => {
  const pagina = leer('../src/pages/ModulosPage.vue')

  it('las dos tarjetas se muestran siempre y la que no tiene acceso queda apagada y enfocable', () => {
    assert.match(pagina, /tieneAccesoSeguimiento\(session\.modulos, session\.rol\)/)
    assert.match(pagina, /Boolean\(session\.rolDocumentos\)/)
    assert.match(pagina, /:aria-disabled="modulo\.tieneAcceso \? undefined : 'true'"/)
    assert.match(pagina, /modulo-tarjeta--sin-acceso/)
    assert.doesNotMatch(pagina, /(?<!aria-)disabled/, 'un botón disabled no recibe foco')
  })

  it('al pulsarla avisa con $q.notify y no navega', () => {
    assert.match(pagina, /\$q\.notify\(/)
    assert.match(pagina, /mensajeSinAccesoModulo\(modulo\.nombre\)/)
    assert.match(pagina, /@click="modulo\.tieneAcceso \? undefined : avisarSinAcceso\(modulo\)"/)
  })
})
