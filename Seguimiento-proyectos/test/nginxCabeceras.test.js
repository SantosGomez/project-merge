/*
 * Verificación estática de nginx: cabeceras de seguridad y confianza en CF-Connecting-IP.
 * Lee los .conf; la sintaxis real se valida con `nginx -t` en Docker.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const read = (p) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

const principal = read('../nginx/default.conf')
const cabeceras = read('../nginx/cabeceras-seguridad.conf')
const dockerfile = read('../Dockerfile')
const compose = read('../../docker-compose.yml')

const bloque = (nombre) => {
  const i = principal.indexOf(nombre)
  assert.ok(i >= 0, `no existe ${nombre}`)
  return principal.slice(i, principal.indexOf('\n  }', i))
}

describe('nginx — cabeceras de seguridad', () => {
  it('define la CSP estricta con las directivas clave', () => {
    const csp = cabeceras.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1] ?? ''
    for (const d of [
      "default-src 'self'",
      "script-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "connect-src 'self'",
      "worker-src 'self'",
      "form-action 'self'",
    ]) {
      assert.ok(csp.includes(d), `falta ${d}`)
    }
    assert.ok(!/script-src[^;]*unsafe/.test(csp), 'script-src no admite unsafe-*')
  })

  it('define el resto de cabeceras con always', () => {
    for (const h of ['X-Frame-Options "DENY"', 'X-Content-Type-Options "nosniff"', 'Referrer-Policy', 'Permissions-Policy']) {
      assert.ok(cabeceras.includes(`add_header ${h.split(' ')[0]} `), `falta ${h}`)
    }
    assert.match(cabeceras, /X-Frame-Options "DENY" always;/)
    assert.match(cabeceras, /X-Content-Type-Options "nosniff" always;/)
  })

  it('HSTS solo con X-Forwarded-Proto https', () => {
    assert.match(principal, /map \$http_x_forwarded_proto \$hsts[\s\S]*?https\s+"max-age=/)
    assert.match(cabeceras, /add_header Strict-Transport-Security \$hsts always;/)
  })

  it('cada location estático repite las cabeceras (add_header anula las heredadas)', () => {
    for (const l of ['location /assets/', 'location = /index.html', 'location = /sw.js', 'location = /manifest.json', 'location / {']) {
      assert.match(bloque(l), /include \/etc\/nginx\/cabeceras-seguridad\.conf;/, l)
    }
  })

  it('la API no duplica las cabeceras que ya pone helmet', () => {
    assert.doesNotMatch(bloque('location /api/ '), /cabeceras-seguridad/)
    assert.doesNotMatch(bloque('location /api/eventos'), /cabeceras-seguridad/)
  })

  it('el Dockerfile copia el include', () => {
    assert.match(dockerfile, /COPY nginx\/cabeceras-seguridad\.conf \/etc\/nginx\/cabeceras-seguridad\.conf/)
  })
})

describe('nginx — IP del cliente', () => {
  it('solo confía en CF-Connecting-IP en el puerto interno del túnel', () => {
    assert.match(principal, /listen 80;/)
    assert.match(principal, /listen 8081;/)
    assert.match(principal, /map "\$server_port:\$http_cf_connecting_ip" \$ip_cliente/)
    assert.match(principal, /"~\^8081:\(\?<ip>/)
  })

  it('el túnel apunta al puerto interno y el 8081 no se publica', () => {
    assert.match(compose, /--url http:\/\/frontend:8081/)
    assert.doesNotMatch(compose, /8081:/)
  })
})
