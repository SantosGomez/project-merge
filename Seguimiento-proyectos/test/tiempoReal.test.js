// Pruebas estáticas: cada pantalla escucha los avisos de tiempo real y se actualiza sola.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => (existsSync(ruta(relativa)) ? readFileSync(ruta(relativa), 'utf8') : '')

describe('Tiempo real en las pantallas', () => {
  it('el layout abre la conexión con sesión, la cierra al salir y caduca la sesión si el servidor lo pide', () => {
    const layout = leer('../src/layouts/MaquetaLayout.vue')
    assert.match(layout, /from '\.\.\/services\/eventosService\.js'/)
    assert.match(layout, /if \(session\.autenticado && !session\.sesionCaducada\) \{[\s\S]*?eventos\.conectar\(\)/)
    assert.match(layout, /watch\(\s*\(\) => session\.autenticado,[\s\S]*?eventos\.desconectar\(\)/)
    assert.match(layout, /eventos\.escuchar\('sesion-cerrada', \(\) => session\.caducarSesion\(\)\)/)
    assert.match(layout, /onBeforeUnmount\(\(\) => \{[\s\S]*?eventos\.desconectar\(\)/)
  })

  it('la campanita se actualiza al instante con «aviso-nuevo» y al reconectarse; el respaldo es cada 5 minutos', () => {
    const campana = leer('../src/components/CampanaAvisos.vue')
    assert.match(campana, /eventos\.escuchar\('aviso-nuevo', cargar\)/)
    assert.match(campana, /eventos\.escuchar\('reconectado', cargar\)/)
    assert.match(campana, /setInterval\(cargar, 5 \* 60 \* 1000\)/)
    assert.doesNotMatch(campana, /setInterval\(cargar, 60 \* 1000\)/)
  })

  it('el dashboard del administrador recarga resumen y contador al llegar «caso-actualizado»', () => {
    const dashboard = leer('../src/pages/AdminDashboardPage.vue')
    assert.match(dashboard, /eventos\.escuchar\('caso-actualizado', \(\{ contadorId \}\) => \{[\s\S]*?cargarResumen\(\)[\s\S]*?contadoresStore\.refrescarEnSilencio\(contadorId\)/)
    assert.match(dashboard, /eventos\.escuchar\('reconectado', \(\) => \{[\s\S]*?cargarResumen\(\)[\s\S]*?contadoresStore\.refrescarEnSilencio\(\)/)
    assert.match(dashboard, /onBeforeUnmount\(/, 'deja de escuchar al salir de la pantalla')
  })

  it('Nginx deja pasar /api/eventos sin búfer y con la conexión abierta hasta 1 hora', () => {
    const nginx = leer('../nginx/default.conf')
    const inicio = nginx.indexOf('location /api/eventos {')
    assert.ok(inicio > 0, 'hay una ubicación propia para el tiempo real')
    assert.ok(inicio < nginx.indexOf('location /api/ {'), 'va antes de la de la API para que se note a simple vista')
    const bloque = nginx.slice(inicio, nginx.indexOf('}', inicio))
    assert.match(bloque, /proxy_pass http:\/\/backend:3000\/eventos;/)
    assert.match(bloque, /proxy_buffering off;/)
    assert.match(bloque, /proxy_cache off;/)
    assert.match(bloque, /proxy_read_timeout 1h;/)
    assert.match(bloque, /proxy_http_version 1\.1;/)
    assert.match(bloque, /proxy_set_header Connection '';/)
    assert.match(bloque, /proxy_set_header X-Forwarded-For \$ip_cliente;/, 'misma IP real que el resto de la API')
  })

  it('«Mis casos» del contador se actualiza cuando el administrador cambia una prioridad', () => {
    const misCasos = leer('../src/pages/MyCasesPage.vue')
    assert.match(misCasos, /eventos\.escuchar\('aviso-nuevo', \(\) => cases\.refrescarEnSilencio\(\)\)/)
    assert.match(misCasos, /eventos\.escuchar\('reconectado', \(\) => cases\.refrescarEnSilencio\(\)\)/)
    assert.match(misCasos, /onBeforeUnmount\(/)
  })
})
