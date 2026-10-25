import * as api from './api.js';

export async function registrarEvento(tipo, recurso = null) {
  return api.llamar('POST', '/api/eventos', { tipo, recurso });
}
