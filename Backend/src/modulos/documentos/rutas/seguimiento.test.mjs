import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { rutaSeguimiento } from './seguimiento.mjs';

describe('rutaSeguimiento (portal de seguimiento del cliente)', () => {
  /**
   * Base simulada en memoria que entiende las consultas del seguimiento:
   * - documentos con su cliente, tipo, estado, etc.
   * - documento_historial para los hitos
   * - documento_archivos para los adjuntos
   * - usuarios para el contador asignado
   */
  const baseSimulada = (datos = {}) => {
    const {
      documentos = [],
      historial = [],
      archivos = [],
      usuarios = [],
      clientes = [],
    } = datos;

    const base = {
      consultas: [],
      query: async (sql, params = []) => {
        base.consultas.push({ sql, params });
        // Buscar expedientes por folio o RFC
        if (sql.includes('FROM documentos d') && sql.includes('JOIN clientes c')) {
          // params: [folioLike?, rfcLike?, clienteId?, limite]
          let paramIndex = 0;
          const terminoRaw = sql.includes('d.folio LIKE ?') ? params[paramIndex++] ?? '' : '';
          const termino = terminoRaw.replace(/%/g, '').replace(/\\(.)/g, '$1').toLowerCase();
          if (terminoRaw) paramIndex++;
          const esCliente = sql.includes('d.cliente_id = ?');
          const clienteId = esCliente ? params[paramIndex++] : null;
          const limite = sql.includes('LIMIT ?') ? params[paramIndex] : Infinity;

          let filtrados = documentos.map((doc) => {
            const cliente = clientes.find((c) => c.id === doc.cliente_id);
            const tipo = doc.tipo_nombre;
            const empresa = doc.empresa_nombre;
            const contador = usuarios.find((u) => u.id === doc.contador_id);

            return {
              id: doc.id,
              folio: doc.folio,
              cliente_id: doc.cliente_id,
              cliente: cliente?.razon_social ?? 'Desconocido',
              rfc: cliente?.rfc ?? '',
              empresa,
              tipo,
              periodo: doc.periodo,
              fechaRecepcion: doc.fecha_recepcion,
              estado: doc.estado,
              contadorId: doc.contador_id ?? null,
              contador: contador?.nombre ?? null,
            };
          });

          // Filtrar por búsqueda (folio o RFC) - sin los % de SQL
          if (termino) {
            filtrados = filtrados.filter(
              (d) => d.folio.toLowerCase().includes(termino) || d.rfc.toLowerCase().includes(termino)
            );
          }

          // Si es Cliente, filtrar por su cliente_id
          if (esCliente && clienteId) {
            filtrados = filtrados.filter((d) => d.cliente_id === clienteId);
          }

          // Ordenar por fecha de recepción descendente
          filtrados.sort((a, b) => new Date(b.fechaRecepcion) - new Date(a.fechaRecepcion));

          return [filtrados.slice(0, limite)];
        }

        // Historial de todos los documentos encontrados, en una sola consulta
        if (sql.includes('FROM documento_historial') && sql.includes('dh.documento_id IN (?)')) {
          const ids = params[0];
          const hitos = historial
            .filter((h) => ids.includes(h.documento_id))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((h) => ({
              documentoId: h.documento_id,
              titulo: h.estado_nuevo,
              fecha: h.created_at,
              comentario: h.comentarios,
              usuario: usuarios.find((u) => u.id === h.usuario_id)?.nombre ?? null,
            }));
          return [hitos];
        }

        // Archivos de todos los documentos encontrados, en una sola consulta
        if (sql.includes('FROM documento_archivos') && sql.includes('da.documento_id IN (?)')) {
          const ids = params[0];
          const docsArchivos = archivos
            .filter((a) => ids.includes(a.documento_id))
            .map((a) => ({
              documentoId: a.documento_id,
              nombre: a.nombre_original,
              tamano: a.tamano_bytes,
              fecha: a.created_at,
              mimeType: a.mimeType,
            }));
          return [docsArchivos];
        }

        throw new Error(`consulta no prevista en la base simulada: ${sql}`);
      },
    };
    return base;
  };

  /** Documento mínimo del cliente 1 con la fecha desplazada `dias` hacia atrás. */
  const documento = (id, dias = 0, extra = {}) => ({
    id,
    folio: `DCA-2026-${String(id).padStart(4, '0')}`,
    cliente_id: 1,
    tipo_nombre: 'Facturas',
    empresa_nombre: 'DCA Contadores S.C.',
    periodo: '2026-10',
    fecha_recepcion: new Date(Date.now() - dias * 86400000),
    estado: 'RECEPCIONADO',
    contador_id: null,
    ...extra,
  });
  const clienteUno = [{ id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' }];

  test('Cliente ve solo sus expedientes al buscar por folio', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [
        { id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' },
        { id: 2, razon_social: 'Cliente Dos', rfc: 'CDO120415AB4' },
      ],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
        {
          id: 2,
          folio: 'DCA-2026-0002',
          cliente_id: 2,
          tipo_nombre: 'Declaración',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: ahora,
          estado: 'RECEPCIONADO',
          contador_id: null,
        },
      ],
      usuarios: [{ id: 10, nombre: 'Contador Test' }],
    });

    // Cliente 1 busca su folio
    const res = await rutaSeguimiento(base, { q: 'DCA-2026-0001' }, 1, 'Cliente');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.expedientes.length, 1);
    assert.strictEqual(res.body.expedientes[0].folio, 'DCA-2026-0001');
    assert.strictEqual(res.body.expedientes[0].cliente, 'Cliente Uno');
  });

  test('Cliente no ve expedientes de otros clientes aunque busque por RFC ajeno', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [
        { id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' },
        { id: 2, razon_social: 'Cliente Dos', rfc: 'CDO120415AB4' },
      ],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
        {
          id: 2,
          folio: 'DCA-2026-0002',
          cliente_id: 2,
          tipo_nombre: 'Declaración',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: ahora,
          estado: 'RECEPCIONADO',
          contador_id: null,
        },
      ],
    });

    // Cliente 1 busca RFC de Cliente 2
    const res = await rutaSeguimiento(base, { q: 'CDO120415AB4' }, 1, 'Cliente');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.expedientes.length, 0, 'Cliente no debe ver expedientes de otros');
  });

  test('Contador y Administrador ven todos los expedientes al buscar', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [
        { id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' },
        { id: 2, razon_social: 'Cliente Dos', rfc: 'CDO120415AB4' },
      ],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
        {
          id: 2,
          folio: 'DCA-2026-0002',
          cliente_id: 2,
          tipo_nombre: 'Declaración',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: ahora,
          estado: 'RECEPCIONADO',
          contador_id: null,
        },
      ],
      usuarios: [{ id: 10, nombre: 'Contador Test' }],
    });

    for (const rol of ['Contador', 'Administrador']) {
      const res = await rutaSeguimiento(base, { q: '' }, 1, rol);
      assert.strictEqual(res.status, 200, rol);
      assert.strictEqual(res.body.expedientes.length, 2, rol);
    }
  });

  test('devuelve hitos del historial ordenados por fecha', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [{ id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' }],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
      ],
      historial: [
        {
          documento_id: 1,
          usuario_id: 5,
          estado_anterior: null,
          estado_nuevo: 'RECEPCIONADO',
          comentarios: 'Ingesta inicial',
          created_at: new Date(ahora.getTime() - 172800000),
        },
        {
          documento_id: 1,
          usuario_id: 5,
          estado_anterior: 'RECEPCIONADO',
          estado_nuevo: 'EN_PROCESO',
          comentarios: 'Entregado a contador',
          created_at: new Date(ahora.getTime() - 86400000),
        },
        {
          documento_id: 1,
          usuario_id: 10,
          estado_anterior: 'EN_PROCESO',
          estado_nuevo: 'COMPLETADO',
          comentarios: null,
          created_at: new Date(ahora.getTime() - 3600000),
        },
      ],
      usuarios: [
        { id: 5, nombre: 'Recepcionista' },
        { id: 10, nombre: 'Contador Test' },
      ],
    });

    const res = await rutaSeguimiento(base, { q: 'DCA-2026-0001' }, 1, 'Cliente');

    assert.strictEqual(res.status, 200);
    const expediente = res.body.expedientes[0];
    assert.ok(expediente.hitos);
    assert.strictEqual(expediente.hitos.length, 3);
    assert.strictEqual(expediente.hitos[0].titulo, 'RECEPCIONADO');
    assert.strictEqual(expediente.hitos[1].titulo, 'EN_PROCESO');
    assert.strictEqual(expediente.hitos[2].titulo, 'COMPLETADO');
    assert.strictEqual(expediente.hitos[0].comentario, 'Ingesta inicial');
    assert.strictEqual(expediente.hitos[1].comentario, 'Entregado a contador');
    assert.strictEqual(expediente.hitos[2].comentario, null);
  });

  test('devuelve archivos adjuntos con metadata', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [{ id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' }],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
      ],
      archivos: [
        {
          documento_id: 1,
          nombre_original: 'Facturas_Octubre.pdf',
          mimeType: 'application/pdf',
          tamano_bytes: 2400000,
          created_at: new Date(ahora.getTime() - 86400000),
        },
        {
          documento_id: 1,
          nombre_original: 'Facturas_Octubre.xml',
          mimeType: 'application/xml',
          tamano_bytes: 840000,
          created_at: new Date(ahora.getTime() - 86400000),
        },
      ],
    });

    const res = await rutaSeguimiento(base, { q: 'DCA-2026-0001' }, 1, 'Cliente');

    assert.strictEqual(res.status, 200);
    const expediente = res.body.expedientes[0];
    assert.ok(expediente.archivos);
    assert.strictEqual(expediente.archivos.length, 2);
    assert.strictEqual(expediente.archivos[0].nombre, 'Facturas_Octubre.pdf');
    assert.strictEqual(expediente.archivos[0].tipo, 'pdf');
    assert.strictEqual(expediente.archivos[1].tipo, 'xml');
  });

  test('al buscar por RFC devuelve todos sus expedientes, del más reciente al más antiguo', async () => {
    const ahora = new Date();
    const base = baseSimulada({
      clientes: [{ id: 1, razon_social: 'Cliente Uno', rfc: 'CNO120415AB3' }],
      documentos: [
        {
          id: 1,
          folio: 'DCA-2026-0001',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-09',
          fecha_recepcion: new Date(ahora.getTime() - 2592000000),
          estado: 'COMPLETADO',
          contador_id: 10,
        },
        {
          id: 2,
          folio: 'DCA-2026-0002',
          cliente_id: 1,
          tipo_nombre: 'Facturas',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: new Date(ahora.getTime() - 86400000),
          estado: 'EN_PROCESO',
          contador_id: 10,
        },
        {
          id: 3,
          folio: 'DCA-2026-0003',
          cliente_id: 1,
          tipo_nombre: 'Declaración',
          empresa_nombre: 'DCA Contadores S.C.',
          periodo: '2026-10',
          fecha_recepcion: ahora,
          estado: 'RECEPCIONADO',
          contador_id: null,
        },
      ],
      usuarios: [{ id: 10, nombre: 'Contador Test' }],
    });

    const res = await rutaSeguimiento(base, { q: 'CNO120415AB3' }, 1, 'Cliente');

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(
      res.body.expedientes.map((e) => e.folio),
      ['DCA-2026-0003', 'DCA-2026-0002', 'DCA-2026-0001'],
    );
    assert.strictEqual(res.body.aviso, undefined);
  });

  test('con muchos resultados devuelve los 50 más recientes y avisa', async () => {
    const documentos = Array.from({ length: 60 }, (_, i) => documento(i + 1, i));
    const base = baseSimulada({ clientes: clienteUno, documentos });

    const res = await rutaSeguimiento(base, { q: 'DCA' }, null, 'Administrador');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.expedientes.length, 50);
    assert.strictEqual(res.body.expedientes[0].folio, 'DCA-2026-0001');
    assert.match(res.body.aviso, /50 más recientes/);
  });

  test('las consultas no crecen con el número de expedientes', async () => {
    const documentos = Array.from({ length: 30 }, (_, i) => documento(i + 1, i));
    const base = baseSimulada({ clientes: clienteUno, documentos });

    const res = await rutaSeguimiento(base, { q: 'DCA' }, null, 'Administrador');

    assert.strictEqual(res.body.expedientes.length, 30);
    assert.strictEqual(base.consultas.length, 3, 'una para los documentos, una para el historial y una para los archivos');
  });

  test('los comodines de LIKE en la búsqueda se buscan como texto', async () => {
    const base = baseSimulada({ clientes: clienteUno, documentos: [documento(1)] });

    await rutaSeguimiento(base, { q: '50%_a' }, null, 'Administrador');

    assert.strictEqual(base.consultas[0].params[0], '%50\\%\\_a%');
  });

  test('clasifica cada archivo por su tipo y da un tamaño legible', async () => {
    const base = baseSimulada({
      clientes: clienteUno,
      documentos: [documento(1)],
      archivos: [
        { documento_id: 1, nombre_original: 'a.pdf', mimeType: 'application/pdf', tamano_bytes: 2400000, created_at: new Date() },
        { documento_id: 1, nombre_original: 'b.xml', mimeType: 'text/xml', tamano_bytes: 2048, created_at: new Date() },
        { documento_id: 1, nombre_original: 'c.png', mimeType: 'image/png', tamano_bytes: null, created_at: new Date() },
      ],
    });

    const res = await rutaSeguimiento(base, { q: 'DCA' }, null, 'Administrador');

    assert.deepStrictEqual(
      res.body.expedientes[0].archivos.map((a) => [a.tipo, a.tamano]),
      [['pdf', '2.3 MB'], ['xml', '2 KB'], ['otro', '—']],
    );
  });

  test('con la base caída responde 503 sin lanzar la excepción', async () => {
    const poolCaido = {
      query: async () => {
        throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      },
    };

    const res = await rutaSeguimiento(poolCaido, { q: 'DCA-2026-0001' }, 1, 'Cliente');

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, 'SIN_CONEXION');
    assert.ok(!res.body.mensaje.includes('ECONNREFUSED'), 'el mensaje no lleva detalle técnico');
  });
});