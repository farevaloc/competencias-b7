/**
 * servidor/ganchos/noticias.js
 * Reglas de negocio y filtrado para la colección noticias.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];

  // Docentes y administradores pueden ver borradores y publicadas
  if (usuario.rol === 'admin' || usuario.rol === 'docente') {
    return lista;
  }

  // Estudiantes y otros usuarios con sesión solo ven las publicadas
  return lista.filter(n => n.estado === 'publicado');
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const resultado = { ...datos };

  // Fija autorId al crear
  if (!anterior) {
    if (usuario && usuario.id) {
      resultado.autorId = usuario.id;
    }
  } else {
    // Preserva el autor original si no viene especificado
    resultado.autorId = anterior.autorId || resultado.autorId;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  if (resultado.estado === 'publicado') {
    const eraPublicado = anterior && anterior.estado === 'publicado' && anterior.fechaPublicacion;
    if (!eraPublicado) {
      resultado.fechaPublicacion = new Date().toISOString();
    } else {
      resultado.fechaPublicacion = anterior.fechaPublicacion;
    }
  } else {
    // Si es borrador y no tiene fecha previa o fue revertido a borrador
    if (!anterior || anterior.estado !== 'publicado') {
      resultado.fechaPublicacion = null;
    }
  }

  return resultado;
}

export default {
  filtrarLista,
  antesDeGuardar
};
