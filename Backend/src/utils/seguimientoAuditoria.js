// Seguimiento calculado de una auditoría a partir de su bitácora (rebanada 3).
// Nada de esto se guarda: se recalcula en cada lectura para que nunca quede desactualizado.

const { formatearFechaISO } = require('./dateUtils');

// Umbrales del boceto, en días naturales.
const DIAS_CRITICO = 7;
const DIAS_ATENCION = 20;
const DIAS_AUTORIDAD = 60;

// Estados de un evento que ya no dejan un plazo pendiente a nuestro cargo.
const ESTADOS_CERRADOS = ['Completado', 'Rechazado'];

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Días naturales de `hoy` a `fecha` (negativo si ya pasó), contando días de calendario local.
function diasEntre(hoy, fecha) {
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const hasta = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return Math.round((hasta - desde) / MS_POR_DIA);
}

function semaforoPorDias(dias) {
  if (dias < 0) return 'Vencido';
  if (dias <= DIAS_CRITICO) return 'Crítico';
  if (dias <= DIAS_ATENCION) return 'Atención';
  return 'En tiempo';
}

/**
 * Calcula fase actual, próximo vencimiento a nuestro cargo y semáforo.
 * - Fase actual: la más alta con algún evento; sin bitácora, la fase inicial.
 * - Próximo vencimiento: la fecha límite más cercana de los eventos sin entrega y no cerrados.
 * - Semáforo: Concluida si la auditoría está Completado; si no, por los días al próximo
 *   vencimiento (Vencido / Crítico ≤7 / Atención ≤20 / En tiempo), y Atención también si a
 *   la autoridad le quedan 60 días o menos para su fecha de vencimiento.
 * @param {{ Estado: string, FechaVencimiento: Date }} auditoria - Fila de auditorias.
 * @param {Array<Object>} eventos - Filas de auditoria_dtl con FaseNombre.
 * @param {{ id: number, nombre: string }} faseInicial - Fase que se muestra sin bitácora.
 * @param {Date} hoy - Fecha de referencia.
 * @returns {{ fase_actual: Object, proximo_vencimiento: string|null, que_vence: string|null,
 *   dias_para_vencer: number|null, semaforo: string }}
 */
function calcularSeguimiento(auditoria, eventos, faseInicial, hoy) {
  const masAvanzado = eventos.reduce((mayor, ev) => (!mayor || ev.Fase_Id > mayor.Fase_Id ? ev : mayor), null);
  const faseActual = masAvanzado ? { id: masAvanzado.Fase_Id, nombre: masAvanzado.FaseNombre } : faseInicial;

  const proximo = eventos
    .filter((ev) => ev.FechaLimite && !ev.FechaEntrega && !ESTADOS_CERRADOS.includes(ev.Estado))
    .reduce((cercano, ev) => (!cercano || ev.FechaLimite < cercano.FechaLimite ? ev : cercano), null);
  const diasParaVencer = proximo ? diasEntre(hoy, proximo.FechaLimite) : null;

  let semaforo = proximo ? semaforoPorDias(diasParaVencer) : 'En tiempo';
  if (semaforo === 'En tiempo' && diasEntre(hoy, auditoria.FechaVencimiento) <= DIAS_AUTORIDAD) {
    semaforo = 'Atención';
  }
  if (auditoria.Estado === 'Completado') semaforo = 'Concluida';

  return {
    fase_actual: faseActual,
    proximo_vencimiento: proximo ? formatearFechaISO(proximo.FechaLimite) : null,
    que_vence: proximo ? proximo.Evento : null,
    dias_para_vencer: diasParaVencer,
    semaforo,
  };
}

module.exports = { calcularSeguimiento };
