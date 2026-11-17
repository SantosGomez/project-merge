const assert = require('node:assert');
const http = require('node:http');
const { describe, test, before, after } = require('node:test');
const { crearApp } = require('../src/app');
const { crearRegistroEventos } = require('../src/utils/eventos');
const { validarPasswordNueva, parseListaDeIds } = require('../src/utils/validationUtils');
const {
  prepararBaseDeDatos,
  crearUsuarioDePrueba,
  limpiarDatosDePrueba,
  cerrarBaseDeDatos,
} = require('../soporte-pruebas/bd');
const { iniciarServidor, peticion, iniciarSesion } = require('../soporte-pruebas/http');

/**
 * Límites de entrada y resistencia a DoS (S4): tamaño del JSON, límite global de peticiones por IP
 * (más estricto en escrituras), tope de conexiones de tiempo real por usuario y topes de longitud.
 * Requiere MariaDB en marcha (XAMPP, puerto 3306) solo para la parte de eventos.
 */

describe('tamaño del cuerpo JSON', () => {
  let servidor;
  before(async () => {
    servidor = await iniciarServidor();
  });
  after(async () => {
    await servidor.cerrar();
  });

  test('un cuerpo mayor de 100 kb responde 413 con mensaje en tres partes', async () => {
    const r = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'a@b.mx', password: 'x'.repeat(120 * 1024) });
    assert.strictEqual(r.statusCode, 413);
    assert.match(r.body.mensaje, /^Cuerpo de la petición demasiado grande sobre .+: .+/);
  });

  test('un cuerpo de unos 50 kb sigue pasando el límite de tamaño', async () => {
    const r = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'a@b.mx', password: 'x'.repeat(50 * 1024) });
    assert.notStrictEqual(r.statusCode, 413);
  });
});

describe('límite de peticiones por IP', () => {
  test('el límite global responde 429 en tres partes al pasarse', async () => {
    const servidor = await iniciarServidor(
      crearApp({ limitarLogin: false, limitarPeticiones: true, limitesPeticiones: { global: 3, escritura: 100 } })
    );
    try {
      for (let i = 0; i < 3; i++) {
        const r = await peticion(servidor.puerto, 'GET', '/ruta-inexistente');
        assert.strictEqual(r.statusCode, 404, `petición ${i + 1}`);
      }
      const bloqueada = await peticion(servidor.puerto, 'GET', '/ruta-inexistente');
      assert.strictEqual(bloqueada.statusCode, 429);
      assert.match(bloqueada.body.mensaje, /^Demasiadas peticiones sobre .+: .+/);
    } finally {
      await servidor.cerrar();
    }
  });

  test('las escrituras tienen un límite más estricto que las lecturas', async () => {
    const servidor = await iniciarServidor(
      crearApp({ limitarLogin: false, limitarPeticiones: true, limitesPeticiones: { global: 100, escritura: 2 } })
    );
    try {
      for (let i = 0; i < 2; i++) {
        const r = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'a@b.mx', password: 'x' });
        assert.notStrictEqual(r.statusCode, 429, `escritura ${i + 1}`);
      }
      const bloqueada = await peticion(servidor.puerto, 'POST', '/auth/login', { correo: 'a@b.mx', password: 'x' });
      assert.strictEqual(bloqueada.statusCode, 429);
      assert.match(bloqueada.body.mensaje, /^Demasiadas escrituras sobre .+: .+/);
      const lectura = await peticion(servidor.puerto, 'GET', '/ruta-inexistente');
      assert.strictEqual(lectura.statusCode, 404, 'las lecturas siguen pasando');
    } finally {
      await servidor.cerrar();
    }
  });

  test('apagado con limitarPeticiones: false no limita', async () => {
    const servidor = await iniciarServidor(
      crearApp({ limitarLogin: false, limitarPeticiones: false, limitesPeticiones: { global: 1, escritura: 1 } })
    );
    try {
      for (let i = 0; i < 4; i++) {
        const r = await peticion(servidor.puerto, 'GET', '/ruta-inexistente');
        assert.strictEqual(r.statusCode, 404);
      }
    } finally {
      await servidor.cerrar();
    }
  });
});

describe('topes de longitud', () => {
  test('la contraseña nueva tiene un máximo de 128 caracteres', () => {
    assert.strictEqual(validarPasswordNueva('Ab1-'.repeat(32)).valida, true, '128 caracteres vale');
    const largo = validarPasswordNueva('Ab1-'.repeat(32) + 'x');
    assert.strictEqual(largo.valida, false);
    assert.match(largo.error.mensaje, /^Contraseña inválida sobre contraseña: .*128 caracteres/);
  });

  test('el login rechaza correo o contraseña demasiado largos sin consultar la base', async () => {
    const servidor = await iniciarServidor();
    try {
      for (const cuerpo of [
        { correo: `${'a'.repeat(151)}@b.mx`, password: 'ClaveCorrecta123' },
        { correo: 'a@b.mx', password: 'x'.repeat(129) },
      ]) {
        const r = await peticion(servidor.puerto, 'POST', '/auth/login', cuerpo);
        assert.strictEqual(r.statusCode, 401);
        assert.match(r.body.mensaje, /^Credenciales no válidas sobre .+: .+/);
      }
    } finally {
      await servidor.cerrar();
    }
  });

  test('las listas de ids tienen un máximo de 500 elementos', () => {
    const ids = (n) => Array.from({ length: n }, (_, i) => i + 1);
    assert.strictEqual(parseListaDeIds(ids(500)).length, 500);
    assert.strictEqual(parseListaDeIds(ids(501)), null);
  });
});

describe('tope de conexiones de tiempo real por usuario', () => {
  test('el registro cuenta las conexiones de cada usuario y libera al quitarlas', () => {
    const registro = crearRegistroEventos();
    const a = { usuarioId: 1, res: {} };
    const b = { usuarioId: 1, res: {} };
    registro.agregar(a);
    registro.agregar(b);
    registro.agregar({ usuarioId: 2, res: {} });
    assert.strictEqual(registro.contarDeUsuario(1), 2);
    registro.quitar(a);
    assert.strictEqual(registro.contarDeUsuario(1), 1);
  });

  describe('con el servidor real', () => {
    let servidor;
    let contador;
    let otro;
    let token;
    let tokenOtro;
    const abiertas = [];

    /** Abre GET /eventos con un pase nuevo y devuelve el estado de la respuesta y su cuerpo. */
    async function abrir(tokenDeSesion) {
      const pase = (await peticion(servidor.puerto, 'POST', '/eventos/pase', null, tokenDeSesion)).body.pase;
      return new Promise((resolve, reject) => {
        const solicitud = http.get(
          { host: '127.0.0.1', port: servidor.puerto, path: `/eventos?pase=${pase}`, agent: false },
          (respuesta) => {
            const conexion = { estado: respuesta.statusCode, cuerpo: '', cerrar: () => solicitud.destroy() };
            respuesta.setEncoding('utf8');
            respuesta.on('data', (trozo) => {
              conexion.cuerpo += trozo;
            });
            abiertas.push(conexion);
            // Con 200 la conexión queda abierta: se entrega en cuanto llega el primer dato
            if (respuesta.statusCode === 200) {
              respuesta.once('data', () => resolve(conexion));
            } else {
              respuesta.on('end', () => resolve(conexion));
            }
          }
        );
        solicitud.on('error', reject);
      });
    }

    before(async () => {
      await prepararBaseDeDatos();
      contador = await crearUsuarioDePrueba('contador');
      otro = await crearUsuarioDePrueba('contador');
      servidor = await iniciarServidor();
      token = await iniciarSesion(servidor.puerto, contador.correo, contador.password);
      tokenOtro = await iniciarSesion(servidor.puerto, otro.correo, otro.password);
    });
    after(async () => {
      for (const c of abiertas) c.cerrar();
      await servidor.cerrar();
      await limpiarDatosDePrueba();
      await cerrarBaseDeDatos();
    });

    test('la sexta conexión responde 429 con mensaje claro y cerrar una libera el cupo', async () => {
      const cinco = [];
      for (let i = 0; i < 5; i++) {
        const c = await abrir(token);
        assert.strictEqual(c.estado, 200, `conexión ${i + 1}`);
        cinco.push(c);
      }
      const sexta = await abrir(token);
      assert.strictEqual(sexta.estado, 429);
      assert.match(JSON.parse(sexta.cuerpo).mensaje, /^Demasiadas conexiones abiertas sobre .+: .+/);

      const deOtro = await abrir(tokenOtro);
      assert.strictEqual(deOtro.estado, 200, 'el tope es por usuario');

      cinco[0].cerrar();
      let reintento;
      for (let i = 0; i < 20; i++) {
        reintento = await abrir(token);
        if (reintento.estado === 200) break;
        await new Promise((resolver) => setTimeout(resolver, 100));
      }
      assert.strictEqual(reintento.estado, 200, 'al cerrarse una conexión se libera el cupo');
    });
  });
});
