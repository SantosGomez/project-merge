// Pruebas estáticas: la app se instala como PWA (Chrome en celular y PC) y se abre
// sin barra de dirección, con la identidad DelGrow y sin servir versiones viejas.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const ruta = (relativa) => fileURLToPath(new URL(relativa, import.meta.url))
const leer = (relativa) => (existsSync(ruta(relativa)) ? readFileSync(ruta(relativa), 'utf8') : '')

/** Ancho y alto de un PNG leídos de su cabecera IHDR. */
const medidasPng = (relativa) => {
  const datos = readFileSync(ruta(relativa))
  return [datos.readUInt32BE(16), datos.readUInt32BE(20)]
}

describe('PWA: manifest', () => {
  const manifest = JSON.parse(leer('../src-pwa/manifest.json') || '{}')

  it('se abre como app independiente, sin barra de dirección ni pantalla completa', () => {
    assert.equal(manifest.display, 'standalone')
    // Hay que declararlo: si falta, Quasar pone ['fullscreen', 'minimal-ui'] y ocultaría la barra del sistema
    assert.deepEqual(manifest.display_override, ['standalone'])
    assert.equal(manifest.start_url, './')
    assert.equal(manifest.scope, './')
  })

  it('lleva el nombre, idioma y colores de la app', () => {
    assert.equal(manifest.name, 'Seguimiento de Contadores')
    assert.equal(manifest.short_name, 'Seguimiento')
    assert.equal(manifest.lang, 'es')
    assert.equal(manifest.theme_color, '#111e30', 'el azul del menú ($primary)')
    assert.equal(manifest.background_color, '#111e30')
    assert.notEqual(manifest.orientation, 'portrait', 'no se bloquea en vertical')
  })

  it('declara íconos DelGrow de 192 y 512 px (normal y maskable) que existen con esa medida', () => {
    const tamanos = manifest.icons.map((icono) => icono.sizes)
    assert.ok(tamanos.includes('192x192') && tamanos.includes('512x512'))
    assert.ok(manifest.icons.some((icono) => icono.purpose === 'maskable'))
    assert.ok(!manifest.icons.some((icono) => icono.purpose === 'monochrome'), 'sin ícono monocromático de Quasar')
    for (const icono of manifest.icons) {
      const [ancho, alto] = medidasPng(`../public/${icono.src}`)
      assert.equal(`${ancho}x${alto}`, icono.sizes, icono.src)
    }
  })
})

describe('PWA: service worker y etiquetas', () => {
  const config = leer('../quasar.config.js')

  it('el service worker no intercepta la API ni guarda los logos pesados', () => {
    assert.match(config, /extendPWAGenerateSWOptions\s*\(cfg\)\s*\{[\s\S]*?navigateFallbackDenylist\.push\(\/\^\\\/api\\\/\/\)/)
    assert.match(config, /globIgnores\.push\([^)]*'logos\/\*\*'/)
  })

  it('las etiquetas del head no apuntan a íconos de Quasar que ya no existen', () => {
    assert.match(config, /injectPWAMetaTags\s*\(\{\s*pwaManifest\s*\}\)/)
    assert.doesNotMatch(config, /safari-pinned-tab|apple-icon-120x120/)
    for (const archivo of ['safari-pinned-tab.svg', 'apple-icon-120x120.png', 'icon-monochrome-512x512.png']) {
      assert.equal(existsSync(ruta(`../public/icons/${archivo}`)), false, `${archivo} es de Quasar`)
    }
  })
})

describe('PWA: publicación en Docker', () => {
  it('el Dockerfile instala src-pwa, compila en modo pwa y sirve dist/pwa', () => {
    const dockerfile = leer('../Dockerfile')
    assert.match(dockerfile, /COPY src-pwa\/package\.json src-pwa\/package-lock\.json \.\/src-pwa\//)
    assert.match(dockerfile, /npm ci --ignore-scripts --prefix src-pwa/)
    assert.match(dockerfile, /npx quasar build -m pwa/)
    assert.match(dockerfile, /COPY --from=compilacion \/app\/dist\/pwa \/usr\/share\/nginx\/html/)
  })

  it('no se copian los node_modules de ninguna carpeta a la imagen', () => {
    assert.match(leer('../.dockerignore'), /^\*\*\/node_modules$/m)
  })

  it('Nginx nunca guarda en caché el service worker ni el manifest, para que cada despliegue llegue', () => {
    const nginx = leer('../nginx/default.conf')
    for (const archivo of ['sw.js', 'manifest.json']) {
      assert.match(nginx, new RegExp(`location = /${archivo.replace('.', '\\.')} \\{\\s*add_header Cache-Control "no-cache";`))
    }
  })
})
