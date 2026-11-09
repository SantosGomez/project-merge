// Aviso emergente de mensajes nuevos del chat de auditorías (experimento).
// El ref vive aquí para que el layout sepa qué chat está abierto sin depender del panel.

import { ref } from 'vue'

/** ID de la auditoría cuyo panel de chat está abierto en esta pestaña (null = ninguno). */
export const auditoriaConChatAbierto = ref(null)

/** Caracteres del mensaje que se muestran en el aviso emergente. */
const RECORTE = 120

/**
 * Decide si un mensaje recibido en vivo merece aviso emergente y arma su texto.
 * Solo avisa a contadores, nunca por un mensaje propio ni si ya ve ese chat.
 * @param {{ auditoriaId: number, cliente: string, mensaje: Object }} datos - aviso del servidor.
 * @param {{ esContador: boolean, usuarioId: string|number, chatAbiertoId: number|null }} contexto
 * @returns {{ auditoriaId: number, titulo: string, texto: string }|null}
 */
export const avisoDeMensaje = (datos, { esContador, usuarioId, chatAbiertoId }) => {
  const autor = datos?.mensaje?.autor
  if (!esContador || !autor || autor.id === Number(usuarioId) || chatAbiertoId === datos.auditoriaId) {
    return null
  }
  const texto = String(datos.mensaje.texto ?? '').replace(/\s+/g, ' ')
  return {
    auditoriaId: datos.auditoriaId,
    titulo: `${autor.nombre} escribió en la auditoría de ${datos.cliente}`,
    texto: texto.length > RECORTE ? `${texto.slice(0, RECORTE).trimEnd()}…` : texto,
  }
}
