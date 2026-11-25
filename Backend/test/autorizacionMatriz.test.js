const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { describe, test, before, after, mock } = require('node:test');
const jwt = require('jsonwebtoken');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  registrarUsuarioCreado,
  crearCasoDePrueba,
  envejecerSesion,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');
const { query } = require('../src/config/db');
const { JWT_SECRET } = require('../src/config/jwt');
const { eventos } = require('../src/utils/eventos');
const { asignarAuxiliar } = require('../src/models/AuxiliarModel');

/**
 * Matriz de autorización rol × endpoint y acceso a recursos ajenos (S5).
 * Requiere MariaDB en marcha (XAMPP, puerto 3306). Solo crea y borra datos `zz_test_`.
 */

const ADMIN = 'administrador';
const CONTADOR = 'contador';
const AUXILIAR = 'auxiliar';
const SISTEMA = 'usuarios_de_sistema';
const RECEPCIONISTA = 'recepcionista';
const TODOS = [ADMIN, CONTADOR, AUXILIAR, SISTEMA, RECEPCIONISTA];
const CONTADOR_O_AUXILIAR = [CONTADOR, AUXILIAR];
const CALENDARIO = [ADMIN, CONTADOR, AUXILIAR, RECEPCIONISTA];
const ID_INEXISTENTE = 99999999;

/**
 * Tabla de todos los endpoints con autenticación por token: [método, ruta, roles permitidos, cuerpo].
 * En la ruta, `:yo` se cambia por el id de quien llama, `:x` por un id que no existe y `:fecha` por una fecha.
 * Los permitidos pueden responder 400/404 (datos vacíos o ids inexistentes), pero nunca 401 ni 403.
 */
const MATRIZ = [
  // auth (el cierre de sesión y el cambio con contraseña asignada tienen pruebas aparte)
  ['PATCH', '/auth/mi-contrasena', TODOS, {}],
  ['GET', '/auth/perfil', TODOS],
  // casos
  ['POST', '/casos', CONTADOR_O_AUXILIAR, {}],
  ['POST', '/casos/para-auxiliar', CONTADOR_O_AUXILIAR, {}],
  ['POST', '/casos/para-mi-auxiliar', [CONTADOR], {}],
  ['PATCH', '/casos/:x', CONTADOR_O_AUXILIAR, {}],
  ['PATCH', '/casos/:x/prioridad', [ADMIN], {}],
  ['PATCH', '/casos/:x/responsable', [CONTADOR], {}],
  ['GET', '/casos/mis-casos', TODOS],
  // contadores
  ['GET', '/contadores', [ADMIN]],
  ['GET', '/contadores/resumen', [ADMIN]],
  ['GET', '/contadores/casos-importantes', [ADMIN]],
  ['GET', '/contadores/:yo/auxiliares', [CONTADOR]],
  ['GET', '/contadores/:yo/auxiliares-disponibles', [CONTADOR]],
  ['GET', '/contadores/:yo/contadores-que-me-tienen-como-auxiliar', CONTADOR_O_AUXILIAR],
  ['POST', '/contadores/:yo/auxiliares/:x', [CONTADOR]],
  ['DELETE', '/contadores/:yo/auxiliares/:x', [CONTADOR]],
  ['GET', '/contadores/:x/conteos', [ADMIN]],
  ['GET', '/contadores/:x/casos', [ADMIN]],
  ['POST', '/contadores/:x/casos', [ADMIN], {}],
  // usuarios
  ['GET', '/usuarios', [ADMIN, SISTEMA, RECEPCIONISTA]],
  ['POST', '/usuarios', [ADMIN, SISTEMA], {}],
  ['PATCH', '/usuarios/restablecer-contrasena', [ADMIN, SISTEMA], {}],
  ['GET', '/usuarios/:x/contadores', [ADMIN, SISTEMA]],
  ['PUT', '/usuarios/:x/contadores', [ADMIN, SISTEMA], {}],
  ['PATCH', '/usuarios/:x', [ADMIN, SISTEMA], {}],
  // notificaciones y eventos (cualquier sesión)
  ['GET', '/notificaciones', TODOS],
  ['PATCH', '/notificaciones/leidas', TODOS],
  ['POST', '/eventos/pase', TODOS],
  // auditorías
  ['GET', '/auditorias', [ADMIN, CONTADOR]],
  ['GET', '/auditorias/calendario', [ADMIN]],
  ['POST', '/auditorias', [ADMIN, CONTADOR], {}],
  ['GET', '/auditorias/fases', [ADMIN, CONTADOR]],
  ['GET', '/auditorias/:x', [ADMIN, CONTADOR]],
  ['PATCH', '/auditorias/:x', [ADMIN, CONTADOR], {}],
  ['GET', '/auditorias/:x/eventos', [ADMIN, CONTADOR]],
  ['POST', '/auditorias/:x/eventos', [ADMIN, CONTADOR], {}],
  ['PATCH', '/auditorias/:x/eventos/:x', [ADMIN, CONTADOR], {}],
  ['DELETE', '/auditorias/:x/eventos/:x', [ADMIN, CONTADOR]],
  ['GET', '/auditorias/:x/mensajes', [ADMIN, CONTADOR]],
  ['POST', '/auditorias/:x/mensajes', [ADMIN, CONTADOR], {}],
  // clientes, tipos y cartera
  ['GET', '/clientes', CONTADOR_O_AUXILIAR],
  ['POST', '/clientes', CONTADOR_O_AUXILIAR, {}],
  ['PATCH', '/clientes/:x', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/tipos-actividad', CONTADOR_O_AUXILIAR],
  ['POST', '/tipos-actividad', CONTADOR_O_AUXILIAR, {}],
  ['PATCH', '/tipos-actividad/:x', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/tipos-actividad/:x/clientes', CONTADOR_O_AUXILIAR],
  ['PUT', '/tipos-actividad/:x/clientes', CONTADOR_O_AUXILIAR, {}],
  // actividades, tiempo, jornadas e informes
  ['GET', '/actividades', CONTADOR_O_AUXILIAR],
  ['PUT', '/actividades/estado', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/tiempo/activo', CONTADOR_O_AUXILIAR],
  ['POST', '/tiempo/iniciar', CONTADOR_O_AUXILIAR, {}],
  ['POST', '/tiempo/detener', CONTADOR_O_AUXILIAR, {}],
  ['POST', '/tiempo/manual', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/tiempo', CONTADOR_O_AUXILIAR],
  ['DELETE', '/tiempo/:x', CONTADOR_O_AUXILIAR],
  ['GET', '/jornadas/hoy', CONTADOR_O_AUXILIAR],
  ['POST', '/jornadas/hoy/marcar', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/jornadas', CONTADOR_O_AUXILIAR],
  ['PUT', '/jornadas/ajustes', CONTADOR_O_AUXILIAR, {}],
  ['PUT', '/jornadas/:fecha', CONTADOR_O_AUXILIAR, {}],
  ['GET', '/informes/tiempo', CONTADOR_O_AUXILIAR],
  // juntas del calendario
  ['GET', '/juntas/participantes-disponibles', CALENDARIO],
  ['GET', '/juntas', CALENDARIO],
  ['GET', '/juntas/agenda/:x', CALENDARIO],
  ['POST', '/juntas', CALENDARIO, {}],
  ['GET', '/juntas/:x', CALENDARIO],
  ['PATCH', '/juntas/:x', CALENDARIO, {}],
  ['PATCH', '/juntas/:x/respuesta', CALENDARIO, {}],
  ['DELETE', '/juntas/:x', CALENDARIO],
  // módulo de documentos (unión, fase 3): entra quien tiene el módulo; aquí solo el administrador
  // lo tiene por su rol. Los permisos por rol dentro del módulo están en documentosModulo.test.js.
  ['GET', '/doc/catalogos', [ADMIN]],
  ['POST', '/doc/documentos', [ADMIN], {}],
  ['GET', '/doc/documentos', [ADMIN]],
  ['GET', '/doc/documentos/direccionamiento', [ADMIN]],
  ['GET', '/doc/documentos/entregados', [ADMIN]],
  ['POST', '/doc/documentos/:x/estado', [ADMIN], {}],
  ['POST', '/doc/documentos/:x/entrega', [ADMIN], {}],
  ['POST', '/doc/documentos/:x/archivos', [ADMIN], {}],
  ['GET', '/doc/documentos/:x/archivos/:x', [ADMIN]],
  ['GET', '/doc/clientes/frecuentes', [ADMIN]],
  ['GET', '/doc/clientes', [ADMIN]],
  ['POST', '/doc/clientes', [ADMIN], {}],
  ['GET', '/doc/clientes/:x/requeridos', [ADMIN]],
  ['POST', '/doc/clientes/:x/requeridos', [ADMIN], {}],
  ['GET', '/doc/seguimiento', [ADMIN]],
  ['GET', '/doc/usuarios', [ADMIN]],
  ['PUT', '/doc/usuarios/:x/rol', [ADMIN], {}],
];

// Endpoints sin token de acceso: el inicio de sesión y la conexión de tiempo real (con pase).
const SIN_TOKEN = [
  ['POST', '/auth/login'],
  ['GET', '/eventos'],
];
// Endpoints que dejan pasar a quien aún debe crear su contraseña.
const PERMITEN_CAMBIO_PENDIENTE = [
  ['POST', '/auth/logout'],
  ['PATCH', '/auth/contrasena'],
];

let servidor;
const cuentas = {};
const tokens = {};
let contadorA;
let contadorB;
let auxiliarDeA;
let tokenA;
let tokenB;
let tokenAuxiliarDeA;
let tokenAuxiliarAjeno;
let auxiliarAjeno;
let sistema2;
let datosA;
let secuencia = 0;

function resolverRuta(ruta, usuario) {
  return ruta
    .replace(':yo', usuario ? usuario.id : ID_INEXISTENTE)
    .replace(/:x/g, String(ID_INEXISTENTE))
    .replace(':fecha', '2026-01-01');
}

function llamar(metodo, ruta, token, cuerpo, usuario) {
  const dato = ['POST', 'PUT', 'PATCH'].includes(metodo) ? cuerpo || {} : undefined;
  return peticion(servidor.puerto, metodo, resolverRuta(ruta, usuario), dato, token);
}

function llamarEndpoint([metodo, ruta, , cuerpo], token, usuario) {
  return llamar(metodo, ruta, token, cuerpo, usuario);
}

const consultar = async (sql, params) => query(sql, params);

before(async () => {
  await prepararBaseDeDatos();
  servidor = await iniciarServidor();
  for (const rol of TODOS) {
    cuentas[rol] = await crearUsuarioDePrueba(rol);
    tokens[rol] = await iniciarSesion(servidor.puerto, cuentas[rol].correo, cuentas[rol].password);
  }
  contadorA = cuentas[CONTADOR];
  tokenA = tokens[CONTADOR];
  contadorB = await crearUsuarioDePrueba('contador');
  tokenB = await iniciarSesion(servidor.puerto, contadorB.correo, contadorB.password);
  auxiliarDeA = cuentas[AUXILIAR];
  tokenAuxiliarDeA = tokens[AUXILIAR];
  await asignarAuxiliar(contadorA.id, auxiliarDeA.id);
  auxiliarAjeno = await crearUsuarioDePrueba('auxiliar');
  tokenAuxiliarAjeno = await iniciarSesion(servidor.puerto, auxiliarAjeno.correo, auxiliarAjeno.password);
  await asignarAuxiliar(contadorB.id, auxiliarAjeno.id);
  sistema2 = await crearUsuarioDePrueba('usuarios_de_sistema');
  datosA = await crearDatosDeA();
});

after(async () => {
  await servidor.cerrar();
  await limpiarDatosDePrueba();
  await cerrarBaseDeDatos();
});

/** Crea datos del contador A en todos los módulos y devuelve sus ids. */
async function crearDatosDeA() {
  const api = async (metodo, ruta, cuerpo, token = tokenA) => {
    const r = await peticion(servidor.puerto, metodo, ruta, cuerpo, token);
    assert.ok(r.statusCode < 300, `${metodo} ${ruta} → ${r.statusCode} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  secuencia += 1;
  const cliente = (await api('POST', '/clientes', { nombre: `zz_test cliente A ${secuencia}` })).cliente;
  const tipo = (await api('POST', '/tipos-actividad', { nombre: `zz_test tipo A ${secuencia}` })).tipo;
  await api('PUT', `/tipos-actividad/${tipo.id}/clientes`, { agregar: [cliente.id] });
  const mes = new Date().toISOString().slice(0, 7);
  await api('POST', '/tiempo/manual', { cliente_id: cliente.id, tipo_id: tipo.id, mes, minutos: 30 });
  const [bloque] = await consultar('SELECT id FROM registros_tiempo WHERE usuario_id = ?', [contadorA.id]);
  await api('POST', '/jornadas/hoy/marcar', { paso: 'entrada' });
  const casoId = await crearCasoDePrueba(contadorA.id, { cliente: 'zz_test caso de A' });
  const auditoria = (
    await api('POST', '/auditorias', {
      cliente: 'zz_test cliente auditoría A',
      no_expediente: 'ZZ-TEST-A/2026',
      dependencia: 'SAT – ADAF',
      tipo_auditoria: 'Visita Domiciliaria',
      periodo_inicio: '01-01-2023',
      periodo_final: '31-12-2023',
      fecha_inicio: '15-02-2026',
      fecha_vencimiento: '15-02-2027',
    })
  ).auditoria;
  const evento = (
    await api('POST', `/auditorias/${auditoria.id}/eventos`, {
      evento: 'zz_test evento de A',
      fase_id: 2,
      fecha: '20-02-2026',
      fecha_limite: '02-03-2026',
      folio: 'ZZ-A',
      descripcion: 'zz_test descripción',
    })
  ).evento;
  await api('POST', `/auditorias/${auditoria.id}/mensajes`, { texto: 'zz_test mensaje de A' });
  return { cliente, tipo, mes, bloqueId: bloque.id, casoId, auditoria, evento, eventoId: evento && evento.id };
}

describe('matriz: la tabla cubre todas las rutas de la API', () => {
  test('cada ruta registrada en Backend/src/routes está en la matriz o en la lista de excepciones', () => {
    const fs = require('node:fs');
    const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
    const archivos = Object.fromEntries(
      [...app.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)].map((m) => [m[1], m[2]])
    );
    const montajes = [...app.matchAll(/app\.use\('(\/[\w-]+)', (\w+)\)/g)].map((m) => [m[1], archivos[m[2]]]);
    assert.ok(montajes.length >= 14, 'debe encontrar los 14 módulos de rutas');

    const registradas = [];
    for (const [prefijo, archivo] of montajes) {
      const router = require(`../src/routes/${archivo}`);
      for (const capa of router.stack.filter((c) => c.route)) {
        for (const metodo of Object.keys(capa.route.methods)) {
          const ruta = (prefijo + (capa.route.path === '/' ? '' : capa.route.path)).replace(/:\w+/g, (p) => p);
          registradas.push(`${metodo.toUpperCase()} ${ruta}`);
        }
      }
    }
    const normalizar = (ruta) => ruta.replace(/:(?!yo\b|x\b|fecha\b)\w+/g, ':p').replace(/:(yo|x|fecha)\b/g, ':p');
    const cubiertas = new Set(
      [...MATRIZ, ...SIN_TOKEN, ...PERMITEN_CAMBIO_PENDIENTE].map(([m, r]) => `${m} ${normalizar(r)}`)
    );
    const faltan = registradas.filter((r) => !cubiertas.has(r.replace(/:\w+/g, ':p')));
    assert.deepStrictEqual(faltan, [], `rutas sin cubrir en la matriz: ${faltan.join(', ')}`);
  });
});

describe('matriz: sin token y con token inválido → 401', () => {
  const protegidos = [...MATRIZ, ...PERMITEN_CAMBIO_PENDIENTE.map(([m, r]) => [m, r, TODOS])];

  test('sin cabecera Authorization, todos los endpoints con token dan 401', async () => {
    for (const ep of protegidos) {
      const r = await llamarEndpoint(ep, undefined);
      assert.strictEqual(r.statusCode, 401, `${ep[0]} ${ep[1]} sin token → ${r.statusCode}`);
    }
  });

  test('con tokens inventados, mal firmados o con otro formato, todos dan 401', async () => {
    const mal = jwt.sign({ id: 1, rol: ADMIN, jti: 'x' }, 'otro-secreto-que-no-es-el-del-servidor-123456');
    const firmaBuena = jwt.sign({ id: 1, rol: ADMIN, jti: 'jti-que-no-existe' }, JWT_SECRET, { algorithm: 'HS256' });
    const sinFirma = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(
      JSON.stringify({ id: 1, rol: ADMIN, jti: 'x' })
    ).toString('base64url')}.`;
    for (const token of ['abc', mal, firmaBuena, sinFirma]) {
      for (const ep of protegidos) {
        const r = await llamarEndpoint(ep, token);
        assert.strictEqual(r.statusCode, 401, `${ep[0]} ${ep[1]} con token falso → ${r.statusCode}`);
      }
    }
    // Formato distinto de Bearer
    const r = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, null, { Authorization: `Basic ${tokens[ADMIN]}` });
    assert.strictEqual(r.statusCode, 401);
  });
});

describe('matriz: rol × endpoint', () => {
  for (const rol of TODOS) {
    test(`${rol}: 403 donde no está permitido y ni 401 ni 403 donde sí`, async () => {
      for (const ep of MATRIZ) {
        const permitido = ep[2].includes(rol);
        const r = await llamarEndpoint(ep, tokens[rol], cuentas[rol]);
        if (permitido) {
          assert.ok(![401, 403].includes(r.statusCode), `${rol} debería poder ${ep[0]} ${ep[1]} y dio ${r.statusCode} ${JSON.stringify(r.body)}`);
        } else {
          assert.strictEqual(r.statusCode, 403, `${rol} no debería poder ${ep[0]} ${ep[1]} y dio ${r.statusCode}`);
        }
      }
    });
  }
});

describe('sesiones: revocada, inactiva y con cambio de contraseña pendiente', () => {
  test('una sesión cerrada (logout) da 401 en todos los endpoints', async () => {
    const token = await iniciarSesion(servidor.puerto, contadorB.correo, contadorB.password);
    assert.strictEqual((await peticion(servidor.puerto, 'POST', '/auth/logout', {}, token)).statusCode, 200);
    for (const ep of [...MATRIZ, ['POST', '/auth/logout', TODOS], ['PATCH', '/auth/contrasena', TODOS]]) {
      const r = await llamarEndpoint(ep, token, contadorB);
      assert.strictEqual(r.statusCode, 401, `${ep[0]} ${ep[1]} con sesión cerrada → ${r.statusCode}`);
    }
  });

  test('una sesión inactiva más de 30 minutos da 401 en todos los endpoints', async () => {
    const token = await iniciarSesion(servidor.puerto, contadorB.correo, contadorB.password);
    await envejecerSesion(token, 31);
    for (const ep of [...MATRIZ, ['POST', '/auth/logout', TODOS], ['PATCH', '/auth/contrasena', TODOS]]) {
      const r = await llamarEndpoint(ep, token, contadorB);
      assert.strictEqual(r.statusCode, 401, `${ep[0]} ${ep[1]} con sesión inactiva → ${r.statusCode}`);
    }
  });

  test('con la contraseña asignada solo se puede cambiarla o cerrar sesión: el resto da 403', async () => {
    const correo = `zz_test_pendiente_${Date.now()}@prueba.local`;
    const alta = await peticion(
      servidor.puerto,
      'POST',
      '/usuarios',
      { nombre: `zz_test_pendiente_${Date.now()}`, correo, password: 'Asignada-Clave-2026', rol: 'contador' },
      tokens[ADMIN]
    );
    assert.strictEqual(alta.statusCode, 201, JSON.stringify(alta.body));
    registrarUsuarioCreado(correo);
    const token = await iniciarSesion(servidor.puerto, correo, 'Asignada-Clave-2026');
    for (const ep of [...MATRIZ, ...SIN_TOKEN.filter(([, r]) => r === '/eventos').map(() => null)].filter(Boolean)) {
      const r = await llamarEndpoint(ep, token, { id: ID_INEXISTENTE });
      assert.strictEqual(r.statusCode, 403, `${ep[0]} ${ep[1]} con contraseña pendiente → ${r.statusCode}`);
      assert.match(JSON.stringify(r.body), /cambiar tu contraseña/);
    }
    // Las dos rutas permitidas sí dejan pasar (cambio con datos vacíos → 400, no 403)
    const cambio = await peticion(servidor.puerto, 'PATCH', '/auth/contrasena', {}, token);
    assert.strictEqual(cambio.statusCode, 400, JSON.stringify(cambio.body));
    assert.strictEqual((await peticion(servidor.puerto, 'POST', '/auth/logout', {}, token)).statusCode, 200);
  });
});

describe('/eventos: pases inventados, vencidos y reutilizados', () => {
  /** Abre la conexión SSE y devuelve el estado y el cuerpo inicial; cierra la conexión. */
  function abrirEventos(pase) {
    return new Promise((resolve, reject) => {
      const solicitud = http.get(
        { host: '127.0.0.1', port: servidor.puerto, path: `/eventos${pase === undefined ? '' : `?pase=${pase}`}`, agent: false },
        (respuesta) => {
          const trozos = [];
          respuesta.on('data', (t) => {
            trozos.push(t);
            if (respuesta.statusCode === 200) {
              respuesta.destroy();
              resolve({ statusCode: 200, cuerpo: Buffer.concat(trozos).toString('utf8') });
            }
          });
          respuesta.on('end', () => resolve({ statusCode: respuesta.statusCode, cuerpo: Buffer.concat(trozos).toString('utf8') }));
          respuesta.on('error', () => {});
        }
      );
      solicitud.on('error', reject);
    });
  }

  test('sin pase, con pase inventado o con un valor que no es texto → 401', async () => {
    assert.strictEqual((await abrirEventos()).statusCode, 401);
    assert.strictEqual((await abrirEventos('inventado')).statusCode, 401);
    assert.strictEqual((await abrirEventos('a'.repeat(64))).statusCode, 401);
    const r = await peticion(servidor.puerto, 'GET', '/eventos?pase[]=a&pase[]=b');
    assert.strictEqual(r.statusCode, 401);
    // El token de acceso no sirve como pase
    assert.strictEqual((await abrirEventos(tokens[ADMIN])).statusCode, 401);
  });

  test('un pase sirve una sola vez', async () => {
    const { body } = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, tokenB);
    const primero = await abrirEventos(body.pase);
    assert.strictEqual(primero.statusCode, 200);
    assert.strictEqual((await abrirEventos(body.pase)).statusCode, 401);
  });

  test('un pase vencido (más de 60 s) da 401', async () => {
    const { body } = await peticion(servidor.puerto, 'POST', '/eventos/pase', {}, tokenB);
    const ahora = Date.now();
    const reloj = mock.method(Date, 'now', () => ahora + 61 * 1000);
    try {
      assert.strictEqual((await abrirEventos(body.pase)).statusCode, 401);
    } finally {
      reloj.mock.restore();
    }
  });

  test('el pase queda ligado a la cuenta que lo pidió', () => {
    const pase = eventos.crearPase({ usuarioId: contadorB.id, rol: CONTADOR, jti: 'jti-prueba' });
    const datos = eventos.canjearPase(pase);
    assert.strictEqual(datos.usuarioId, contadorB.id);
    assert.strictEqual(datos.rol, CONTADOR);
  });
});

describe('IDOR: el contador B no toca los recursos del contador A', () => {
  const noEsExito = (r, etiqueta) =>
    assert.ok([403, 404].includes(r.statusCode), `${etiqueta} → ${r.statusCode} ${JSON.stringify(r.body)}`);

  test('casos: B no puede editar un caso de A (ni cambiar su estado)', async () => {
    const r = await peticion(servidor.puerto, 'PATCH', `/casos/${datosA.casoId}`, { estado: 'Finalizado' }, tokenB);
    assert.strictEqual(r.statusCode, 403);
    const [caso] = await consultar('SELECT estado FROM casos WHERE id = ?', [datosA.casoId]);
    assert.strictEqual(caso.estado, 'Pendiente');
    const lista = await peticion(servidor.puerto, 'GET', '/casos/mis-casos', null, tokenB);
    assert.ok(!JSON.stringify(lista.body).includes('zz_test caso de A'));
  });

  test('clientes: B no los lee ni los modifica', async () => {
    const r = await peticion(servidor.puerto, 'PATCH', `/clientes/${datosA.cliente.id}`, { nombre: 'robado', activo: false }, tokenB);
    noEsExito(r, 'PATCH cliente ajeno');
    const [fila] = await consultar('SELECT nombre, activo FROM clientes WHERE id = ?', [datosA.cliente.id]);
    assert.strictEqual(fila.nombre, datosA.cliente.nombre);
    assert.strictEqual(Number(fila.activo), 1);
    const lista = await peticion(servidor.puerto, 'GET', '/clientes', null, tokenB);
    assert.ok(!JSON.stringify(lista.body).includes(datosA.cliente.nombre));
  });

  test('tipos de actividad y cartera: B no los lee ni los modifica', async () => {
    const patch = await peticion(servidor.puerto, 'PATCH', `/tipos-actividad/${datosA.tipo.id}`, { nombre: 'robado' }, tokenB);
    noEsExito(patch, 'PATCH tipo ajeno');
    const leer = await peticion(servidor.puerto, 'GET', `/tipos-actividad/${datosA.tipo.id}/clientes`, null, tokenB);
    noEsExito(leer, 'GET cartera ajena');
    const quitar = await peticion(servidor.puerto, 'PUT', `/tipos-actividad/${datosA.tipo.id}/clientes`, { quitar: [datosA.cliente.id] }, tokenB);
    noEsExito(quitar, 'PUT cartera ajena (quitar)');
    const [tipo] = await consultar('SELECT nombre FROM tipos_actividad WHERE id = ?', [datosA.tipo.id]);
    assert.strictEqual(tipo.nombre, datosA.tipo.nombre);
    const cartera = await consultar('SELECT * FROM cartera_actividad WHERE tipo_id = ?', [datosA.tipo.id]);
    assert.strictEqual(cartera.length, 1, 'la cartera de A sigue intacta');
    const lista = await peticion(servidor.puerto, 'GET', '/tipos-actividad', null, tokenB);
    assert.ok(!JSON.stringify(lista.body).includes(datosA.tipo.nombre));
  });

  test('cartera: B no puede meter clientes de A en su propio tipo ni clientes suyos en el tipo de A', async () => {
    secuencia += 1;
    const tipoB = (await peticion(servidor.puerto, 'POST', '/tipos-actividad', { nombre: `zz_test tipo B ${secuencia}` }, tokenB)).body.tipo;
    const clienteB = (await peticion(servidor.puerto, 'POST', '/clientes', { nombre: `zz_test cliente B ${secuencia}` }, tokenB)).body.cliente;
    await peticion(servidor.puerto, 'PUT', `/tipos-actividad/${tipoB.id}/clientes`, { agregar: [datosA.cliente.id] }, tokenB);
    assert.deepStrictEqual(await consultar('SELECT * FROM cartera_actividad WHERE tipo_id = ?', [tipoB.id]), []);
    await peticion(servidor.puerto, 'PUT', `/tipos-actividad/${datosA.tipo.id}/clientes`, { agregar: [clienteB.id] }, tokenB);
    const deA = await consultar('SELECT cliente_id FROM cartera_actividad WHERE tipo_id = ?', [datosA.tipo.id]);
    assert.deepStrictEqual(deA.map((f) => f.cliente_id), [datosA.cliente.id]);
  });

  test('registros de tiempo: B no ve, borra ni inicia cronómetros con datos de A', async () => {
    const borrar = await peticion(servidor.puerto, 'DELETE', `/tiempo/${datosA.bloqueId}`, null, tokenB);
    noEsExito(borrar, 'DELETE bloque ajeno');
    assert.strictEqual((await consultar('SELECT id FROM registros_tiempo WHERE id = ?', [datosA.bloqueId])).length, 1);
    const lista = await peticion(
      servidor.puerto,
      'GET',
      `/tiempo?cliente_id=${datosA.cliente.id}&tipo_id=${datosA.tipo.id}&mes=${datosA.mes}`,
      null,
      tokenB
    );
    assert.ok(lista.statusCode >= 400 || JSON.stringify(lista.body).indexOf('"minutos":30') === -1, 'B no ve bloques de A');
    const iniciar = await peticion(
      servidor.puerto, 'POST', '/tiempo/iniciar', { cliente_id: datosA.cliente.id, tipo_id: datosA.tipo.id, mes: datosA.mes }, tokenB
    );
    assert.ok(iniciar.statusCode >= 400, `iniciar con datos ajenos → ${iniciar.statusCode}`);
    const manual = await peticion(
      servidor.puerto, 'POST', '/tiempo/manual', { cliente_id: datosA.cliente.id, tipo_id: datosA.tipo.id, mes: datosA.mes, minutos: 10 }, tokenB
    );
    assert.ok(manual.statusCode >= 400, `tiempo manual con datos ajenos → ${manual.statusCode}`);
    const estado = await peticion(
      servidor.puerto, 'PUT', '/actividades/estado', { cliente_id: datosA.cliente.id, tipo_id: datosA.tipo.id, mes: datosA.mes, hecha: true }, tokenB
    );
    assert.ok(estado.statusCode >= 400, `marcar actividad ajena → ${estado.statusCode}`);
    assert.strictEqual((await consultar('SELECT id FROM registros_tiempo WHERE usuario_id = ?', [contadorB.id])).length, 0);
    const informe = await peticion(servidor.puerto, 'GET', `/informes/tiempo?mes=${datosA.mes}`, null, tokenB);
    assert.ok(!JSON.stringify(informe.body).includes(datosA.cliente.nombre));
  });

  test('jornadas: cada quien solo tiene la suya', async () => {
    const hoyB = await peticion(servidor.puerto, 'GET', '/jornadas/hoy', null, tokenB);
    assert.strictEqual(hoyB.statusCode, 200);
    assert.ok(!JSON.stringify(hoyB.body).match(/"entrada":"\d/), 'B no hereda la entrada de A');
    const corregir = await peticion(servidor.puerto, 'PUT', '/jornadas/2026-01-05', { entrada: '09:00', salida: '18:00' }, tokenB);
    assert.ok(corregir.statusCode < 500);
    const deA = await consultar('SELECT fecha FROM jornadas WHERE usuario_id = ? AND fecha = ?', [contadorA.id, '2026-01-05']);
    assert.strictEqual(deA.length, 0, 'corregir un día de B no crea ni cambia filas de A');
    await consultar('DELETE FROM jornadas WHERE usuario_id = ?', [contadorB.id]);
  });

  test('auditorías: B (no asignado) no las lee, edita ni usa su bitácora y su chat', async () => {
    const id = datosA.auditoria.id;
    const lista = await peticion(servidor.puerto, 'GET', '/auditorias', null, tokenB);
    assert.ok(!JSON.stringify(lista.body).includes('ZZ-TEST-A/2026'));
    const casos = [
      ['GET', `/auditorias/${id}`],
      ['PATCH', `/auditorias/${id}`, { cliente: 'robado' }],
      ['GET', `/auditorias/${id}/eventos`],
      ['POST', `/auditorias/${id}/eventos`, { evento: 'intruso', fase_id: 2, fecha: '20-02-2026' }],
      ['PATCH', `/auditorias/${id}/eventos/${datosA.eventoId}`, { evento: 'robado' }],
      ['DELETE', `/auditorias/${id}/eventos/${datosA.eventoId}`],
      ['GET', `/auditorias/${id}/mensajes`],
      ['POST', `/auditorias/${id}/mensajes`, { texto: 'intruso' }],
    ];
    for (const [metodo, ruta, cuerpo] of casos) {
      const r = await peticion(servidor.puerto, metodo, ruta, cuerpo, tokenB);
      assert.strictEqual(r.statusCode, 403, `${metodo} ${ruta} → ${r.statusCode} ${JSON.stringify(r.body)}`);
    }
    const [aud] = await consultar('SELECT * FROM auditorias WHERE Id_Auditoria = ?', [id]).catch(() => [null]);
    if (aud) assert.notStrictEqual(aud.Cliente, 'robado');
    assert.strictEqual((await consultar('SELECT 1 FROM auditoria_dtl WHERE Id_AudDtl = ?', [datosA.eventoId])).length, 1);
    assert.strictEqual((await consultar("SELECT 1 FROM auditoria_mensajes WHERE Mensaje = 'intruso'")).length, 0);
    assert.strictEqual((await consultar("SELECT 1 FROM auditoria_dtl WHERE Evento = 'intruso'")).length, 0);
  });

  test('auditorías: un evento de otra auditoría no se toca usando una auditoría propia', async () => {
    secuencia += 1;
    const propia = (
      await peticion(servidor.puerto, 'POST', '/auditorias', {
        cliente: `zz_test propia B ${secuencia}`,
        no_expediente: 'ZZ-TEST-B/2026',
        dependencia: 'SAT – ADAF',
        tipo_auditoria: 'Visita Domiciliaria',
        periodo_inicio: '01-01-2023',
        periodo_final: '31-12-2023',
        fecha_inicio: '15-02-2026',
        fecha_vencimiento: '15-02-2027',
      }, tokenB)
    ).body.auditoria;
    const borrar = await peticion(servidor.puerto, 'DELETE', `/auditorias/${propia.id}/eventos/${datosA.eventoId}`, null, tokenB);
    assert.strictEqual(borrar.statusCode, 404);
    const editar = await peticion(servidor.puerto, 'PATCH', `/auditorias/${propia.id}/eventos/${datosA.eventoId}`, { evento: 'robado' }, tokenB);
    assert.strictEqual(editar.statusCode, 404);
    assert.strictEqual((await consultar('SELECT 1 FROM auditoria_dtl WHERE Id_AudDtl = ? AND Evento = ?', [datosA.eventoId, 'zz_test evento de A'])).length, 1);
  });

  test('auxiliares: B no ve ni cambia los auxiliares de A', async () => {
    const rutas = [
      ['GET', `/contadores/${contadorA.id}/auxiliares`],
      ['GET', `/contadores/${contadorA.id}/auxiliares-disponibles`],
      ['GET', `/contadores/${contadorA.id}/contadores-que-me-tienen-como-auxiliar`],
      ['POST', `/contadores/${contadorA.id}/auxiliares/${auxiliarAjeno.id}`],
      ['DELETE', `/contadores/${contadorA.id}/auxiliares/${auxiliarDeA.id}`],
    ];
    for (const [metodo, ruta] of rutas) {
      const r = await peticion(servidor.puerto, metodo, ruta, metodo === 'POST' ? {} : undefined, tokenB);
      assert.strictEqual(r.statusCode, 403, `${metodo} ${ruta} → ${r.statusCode}`);
    }
    const vinculos = await consultar('SELECT * FROM contador_auxiliar WHERE auxiliar_id = ?', [auxiliarDeA.id]);
    assert.strictEqual(vinculos.length, 1);
    assert.strictEqual(Number(vinculos[0].contador_id), contadorA.id);
  });

  test('notificaciones: B no lee ni marca los avisos de A', async () => {
    // El administrador le asigna un caso a A: genera un aviso nuevo (la matriz ya marcó como leídos los anteriores)
    const asignar = await peticion(
      servidor.puerto, 'POST', `/contadores/${contadorA.id}/casos`,
      { cliente: 'zz_test asignado a A', prioridad: 'Media', fecha_vencimiento: '31-12-2030' }, tokens[ADMIN]
    );
    assert.strictEqual(asignar.statusCode, 201, JSON.stringify(asignar.body));
    const deA = await peticion(servidor.puerto, 'GET', '/notificaciones', null, tokenA);
    assert.ok(deA.body.no_leidas > 0, 'A tiene avisos sin leer');
    const deB = await peticion(servidor.puerto, 'GET', '/notificaciones', null, tokenB);
    const idsDeA = new Set(deA.body.notificaciones.map((n) => n.id));
    assert.ok(deB.body.notificaciones.every((n) => !idsDeA.has(n.id)));
    await peticion(servidor.puerto, 'PATCH', '/notificaciones/leidas', {}, tokenB);
    const despues = await peticion(servidor.puerto, 'GET', '/notificaciones', null, tokenA);
    assert.strictEqual(despues.body.no_leidas, deA.body.no_leidas);
  });

  test('el administrador tampoco usa los datos personales de A (clientes, tiempo, jornadas)', async () => {
    for (const ruta of ['/clientes', '/tipos-actividad', '/tiempo/activo', '/jornadas/hoy', '/informes/tiempo', `/contadores/${contadorA.id}/auxiliares`]) {
      const r = await peticion(servidor.puerto, 'GET', ruta, null, tokens[ADMIN]);
      assert.strictEqual(r.statusCode, 403, `${ruta} como administrador → ${r.statusCode}`);
    }
  });
});

describe('IDOR: el auxiliar solo edita el estado de los casos de su contador', () => {
  const parche = (casoId, cuerpo, token = tokenAuxiliarDeA) =>
    peticion(servidor.puerto, 'PATCH', `/casos/${casoId}`, cuerpo, token);

  test('el auxiliar de A cambia el estado de un caso de A', async () => {
    const r = await parche(datosA.casoId, { estado: 'En proceso' });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const [caso] = await consultar('SELECT estado FROM casos WHERE id = ?', [datosA.casoId]);
    assert.strictEqual(caso.estado, 'En proceso');
  });

  test('el auxiliar de A no cambia otros campos de ese caso', async () => {
    const antes = (await consultar('SELECT cliente, prioridad, importante FROM casos WHERE id = ?', [datosA.casoId]))[0];
    for (const cuerpo of [{ cliente: 'otro' }, { prioridad: 'Alta' }, { descripcion: 'cambio' }]) {
      const r = await parche(datosA.casoId, cuerpo);
      assert.strictEqual(r.statusCode, 403, JSON.stringify(cuerpo) + JSON.stringify(r.body));
    }
    const despues = (await consultar('SELECT cliente, prioridad, importante FROM casos WHERE id = ?', [datosA.casoId]))[0];
    assert.deepStrictEqual(despues, antes);
  });

  test('el auxiliar no marca «Importante»: ni en el caso de A ni al crear casos', async () => {
    assert.strictEqual((await parche(datosA.casoId, { importante: true })).statusCode, 403);
    assert.strictEqual((await parche(datosA.casoId, { importante: false })).statusCode, 403);
    const propio = await crearCasoDePrueba(auxiliarDeA.id, { cliente: 'zz_test caso propio de auxiliar' });
    assert.strictEqual((await parche(propio, { importante: true })).statusCode, 403);
    const crear = await peticion(servidor.puerto, 'POST', '/casos', { cliente: 'zz_test x', prioridad: 'Media', importante: true }, tokenAuxiliarDeA);
    assert.strictEqual(crear.statusCode, 403);
    const paraContador = await peticion(
      servidor.puerto, 'POST', '/casos/para-auxiliar', { cliente: 'zz_test x', prioridad: 'Media', importante: true, contador_id: contadorA.id }, tokenAuxiliarDeA
    );
    assert.strictEqual(paraContador.statusCode, 403);
    const [fila] = await consultar('SELECT importante FROM casos WHERE id = ?', [datosA.casoId]);
    assert.strictEqual(Number(fila.importante), 0);
  });

  test('un auxiliar de otro contador no toca los casos de A', async () => {
    const r = await parche(datosA.casoId, { estado: 'Finalizado' }, tokenAuxiliarAjeno);
    assert.strictEqual(r.statusCode, 403);
    const [caso] = await consultar('SELECT estado FROM casos WHERE id = ?', [datosA.casoId]);
    assert.notStrictEqual(caso.estado, 'Finalizado');
  });

  test('el auxiliar no entra a auditorías ni gestiona auxiliares', async () => {
    for (const [metodo, ruta] of [
      ['GET', '/auditorias'],
      ['GET', `/auditorias/${datosA.auditoria.id}`],
      ['GET', `/contadores/${auxiliarDeA.id}/auxiliares`],
      ['POST', `/contadores/${auxiliarDeA.id}/auxiliares/${auxiliarAjeno.id}`],
    ]) {
      const r = await peticion(servidor.puerto, metodo, ruta, metodo === 'POST' ? {} : undefined, tokenAuxiliarDeA);
      assert.strictEqual(r.statusCode, 403, `${metodo} ${ruta} → ${r.statusCode}`);
    }
  });
});

describe('escalada de privilegios por la API de usuarios', () => {
  const patchUsuario = (id, cuerpo, token) => peticion(servidor.puerto, 'PATCH', `/usuarios/${id}`, cuerpo, token);

  test('usuarios_de_sistema no puede cambiar su propio rol a administrador (ni el administrador el suyo)', async () => {
    for (const rol of [SISTEMA, ADMIN]) {
      const cuenta = cuentas[rol];
      const r = await patchUsuario(cuenta.id, { nombre: cuenta.nombre, correo: cuenta.correo, rol: ADMIN === rol ? SISTEMA : ADMIN }, tokens[rol]);
      assert.strictEqual(r.statusCode, 400, `${rol}: ${JSON.stringify(r.body)}`);
      const [fila] = await consultar('SELECT rol FROM usuarios WHERE id = ?', [cuenta.id]);
      assert.strictEqual(fila.rol, rol);
    }
  });

  test('ni contador ni auxiliar pueden usar la API de usuarios', async () => {
    for (const rol of [CONTADOR, AUXILIAR]) {
      const propio = cuentas[rol];
      for (const [metodo, ruta, cuerpo] of [
        ['GET', '/usuarios'],
        ['POST', '/usuarios', { nombre: 'zz_test x', correo: 'zz_test_x@prueba.local', password: 'Clave-Segura-2026', rol: ADMIN }],
        ['PATCH', `/usuarios/${propio.id}`, { nombre: propio.nombre, correo: propio.correo, rol: ADMIN }],
        ['PATCH', '/usuarios/restablecer-contrasena', { correo: cuentas[ADMIN].correo, password: 'Clave-Segura-2026' }],
      ]) {
        const r = await peticion(servidor.puerto, metodo, ruta, cuerpo, tokens[rol]);
        assert.strictEqual(r.statusCode, 403, `${rol} ${metodo} ${ruta} → ${r.statusCode}`);
      }
      const [fila] = await consultar('SELECT rol FROM usuarios WHERE id = ?', [propio.id]);
      assert.strictEqual(fila.rol, rol);
    }
    assert.strictEqual((await consultar("SELECT 1 FROM usuarios WHERE correo = 'zz_test_x@prueba.local'")).length, 0);
  });

  test('nunca se exponen hashes de contraseña: ni en el directorio, ni en el perfil ni en el alta', async () => {
    const directorio = await peticion(servidor.puerto, 'GET', '/usuarios', null, tokens[SISTEMA]);
    assert.strictEqual(directorio.statusCode, 200);
    const texto = JSON.stringify(directorio.body);
    assert.ok(!/password|hash|argon2/i.test(texto), 'el directorio no trae hash');
    const perfil = await peticion(servidor.puerto, 'GET', '/auth/perfil', null, tokens[SISTEMA]);
    assert.ok(!/password|hash|argon2/i.test(JSON.stringify(perfil.body)));
    const login = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: cuentas[SISTEMA].correo, password: cuentas[SISTEMA].password });
    assert.ok(!/password_hash|argon2/i.test(JSON.stringify(login.body)));
  });

  test('PATCH /usuarios/:id ignora campos de contraseña y de estado que no son del formulario', async () => {
    const objetivo = await crearUsuarioDePrueba('contador');
    const [antes] = await consultar('SELECT password_hash, debe_cambiar_contrasena FROM usuarios WHERE id = ?', [objetivo.id]);
    const r = await patchUsuario(
      objetivo.id,
      {
        nombre: objetivo.nombre,
        correo: objetivo.correo,
        rol: CONTADOR,
        password_hash: 'x'.repeat(40),
        password: 'Otra-Clave-Muy-Larga-2026',
        debe_cambiar_contrasena: true,
        id: cuentas[ADMIN].id,
      },
      tokens[SISTEMA]
    );
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    const [despues] = await consultar('SELECT password_hash, debe_cambiar_contrasena FROM usuarios WHERE id = ?', [objetivo.id]);
    assert.strictEqual(despues.password_hash, antes.password_hash);
    assert.strictEqual(despues.debe_cambiar_contrasena, antes.debe_cambiar_contrasena);
    // Y la contraseña original sigue valiendo
    await iniciarSesion(servidor.puerto, objetivo.correo, objetivo.password);
  });

  test('cambiar el rol de una cuenta cierra sus sesiones: el token viejo no conserva el rol anterior', async () => {
    const objetivo = await crearUsuarioDePrueba('auxiliar');
    const tokenViejo = await iniciarSesion(servidor.puerto, objetivo.correo, objetivo.password);
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/auth/perfil', null, tokenViejo)).statusCode, 200);
    const r = await patchUsuario(objetivo.id, { nombre: objetivo.nombre, correo: objetivo.correo, rol: SISTEMA }, tokens[ADMIN]);
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.body));
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/auth/perfil', null, tokenViejo)).statusCode, 401);
    // El token viejo (rol auxiliar) tampoco abre rutas del nuevo rol
    assert.strictEqual((await peticion(servidor.puerto, 'GET', '/usuarios', null, tokenViejo)).statusCode, 401);
  });

  test('el rol de una cuenta no se puede cambiar a un valor inventado', async () => {
    const objetivo = await crearUsuarioDePrueba('contador');
    for (const rol of ['superadmin', 'ADMINISTRADOR', '', null, ['administrador'], { rol: 'administrador' }]) {
      const r = await patchUsuario(objetivo.id, { nombre: objetivo.nombre, correo: objetivo.correo, rol }, tokens[SISTEMA]);
      assert.strictEqual(r.statusCode, 400, `rol ${JSON.stringify(rol)} → ${r.statusCode}`);
    }
    const [fila] = await consultar('SELECT rol FROM usuarios WHERE id = ?', [objetivo.id]);
    assert.strictEqual(fila.rol, CONTADOR);
    assert.ok(sistema2.id);
  });
});

describe('juntas: organizador_id y en_nombre_de son solo de la recepcionista', () => {
  // La recepcionista solo atiende al administrador configurado (rebanada 28): aquí, el de la matriz.
  let listaOriginal;
  before(() => {
    listaOriginal = process.env.ADMINISTRADORES_DE_RECEPCION;
    process.env.ADMINISTRADORES_DE_RECEPCION = String(cuentas[ADMIN].id);
  });
  after(() => {
    if (listaOriginal === undefined) delete process.env.ADMINISTRADORES_DE_RECEPCION;
    else process.env.ADMINISTRADORES_DE_RECEPCION = listaOriginal;
  });

  const cuerpoJunta = (extra) => ({
    titulo: 'zz_test junta de matriz',
    inicio: '2036-01-12 09:00',
    fin: '2036-01-12 10:00',
    ...extra,
  });

  test('organizador_id: solo la recepcionista lo usa; los demás roles reciben 403 y la recepcionista 201 o 400', async () => {
    for (const rol of [ADMIN, CONTADOR, AUXILIAR]) {
      const r = await peticion(servidor.puerto, 'POST', '/juntas', cuerpoJunta({ organizador_id: cuentas[ADMIN].id }), tokens[rol]);
      assert.strictEqual(r.statusCode, 403, rol);
    }
    const bien = await peticion(
      servidor.puerto,
      'POST',
      '/juntas',
      cuerpoJunta({ organizador_id: cuentas[ADMIN].id }),
      tokens[RECEPCIONISTA]
    );
    assert.strictEqual(bien.statusCode, 201, JSON.stringify(bien.body));
    assert.strictEqual(bien.body.junta.creado_por.id, cuentas[ADMIN].id);
    const mal = await peticion(
      servidor.puerto,
      'POST',
      '/juntas',
      cuerpoJunta({ organizador_id: cuentas[CONTADOR].id }),
      tokens[RECEPCIONISTA]
    );
    assert.strictEqual(mal.statusCode, 400);
    const sistemaIntento = await peticion(servidor.puerto, 'POST', '/juntas', cuerpoJunta({ organizador_id: cuentas[ADMIN].id }), tokens[SISTEMA]);
    assert.strictEqual(sistemaIntento.statusCode, 403);
  });

  test('en_nombre_de: solo la recepcionista responde por un administrador invitado; los demás reciben 403', async () => {
    const junta = await peticion(
      servidor.puerto,
      'POST',
      '/juntas',
      cuerpoJunta({ participantes: [cuentas[ADMIN].id, cuentas[AUXILIAR].id] }),
      tokens[CONTADOR]
    );
    assert.strictEqual(junta.statusCode, 201, JSON.stringify(junta.body));
    const ruta = `/juntas/${junta.body.junta.id}/respuesta`;
    const cuerpo = { respuesta: 'aceptada', en_nombre_de: cuentas[ADMIN].id };
    for (const rol of [ADMIN, AUXILIAR]) {
      assert.strictEqual((await peticion(servidor.puerto, 'PATCH', ruta, cuerpo, tokens[rol])).statusCode, 403, rol);
    }
    assert.strictEqual((await peticion(servidor.puerto, 'PATCH', ruta, cuerpo, tokens[CONTADOR])).statusCode, 403);
    const ok = await peticion(servidor.puerto, 'PATCH', ruta, cuerpo, tokens[RECEPCIONISTA]);
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    const [fila] = await consultar('SELECT respuesta FROM junta_participantes WHERE junta_id = ? AND usuario_id = ?', [
      junta.body.junta.id,
      cuentas[ADMIN].id,
    ]);
    assert.strictEqual(fila.respuesta, 'aceptada');
  });
});
