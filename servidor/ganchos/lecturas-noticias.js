import * as almacen from '../almacen.js';

/**
 * servidor/ganchos/lecturas-noticias.js
 * Reglas de negocio y filtrado para la colección lecturas-noticias.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  return lista.filter(item => item.usuarioId === usuario.id);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const resultado = { ...datos };

  if (usuario && usuario.id) {
    resultado.usuarioId = usuario.id;
  }

  if (!resultado.noticiaId) {
    const error = new Error('El noticiaId es obligatorio para registrar la lectura');
    error.estado = 400;
    throw error;
  }

  const lecturas = await almacen.leer('lecturas-noticias');
  const duplicado = lecturas.some(l =>
    l.usuarioId === resultado.usuarioId &&
    l.noticiaId === resultado.noticiaId &&
    (!anterior || l.id !== anterior.id)
  );

  if (duplicado) {
    const error = new Error('La lectura de esta noticia ya está registrada');
    error.estado = 400;
    throw error;
  }

  return resultado;
}

export default {
  filtrarLista,
  antesDeGuardar
};
