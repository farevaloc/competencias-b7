import * as almacen from './almacen.js';

/**
 * Registra una notificación para un usuario.
 * Contrato §B: notificar(usuarioId, { tipo, mensaje, enlace })
 *
 * @param {string} usuarioId ID del destinatario
 * @param {Object} datos { tipo, mensaje, enlace }
 * @returns {Promise<Object>} Registro creado en la colección notificaciones
 */
export async function notificar(usuarioId, { tipo, mensaje, enlace }) {
  if (!usuarioId) return null;
  return almacen.agregar('notificaciones', {
    usuarioId,
    tipo: tipo || 'info',
    mensaje: mensaje || '',
    enlace: enlace || '',
    leida: false
  });
}

export default {
  notificar
};
