import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * servidor/ganchos/canciones.js
 * Reglas de negocio y control de acceso para la colección canciones.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];

  // Administrador ve todas las canciones
  if (usuario.rol === 'admin') {
    return lista;
  }

  const permitidas = await asignaturasDe(usuario);
  if (!permitidas || permitidas.length === 0) {
    return [];
  }

  const [temas, unidades] = await Promise.all([
    almacen.leer('temas'),
    almacen.leer('unidades')
  ]);

  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));
  const mapaTemas = new Map(temas.map(t => [t.id, t]));

  return lista.filter(cancion => {
    if (!cancion.temaId) return false;
    const tema = mapaTemas.get(cancion.temaId);
    if (!tema || !tema.unidadId) return false;
    const unidad = mapaUnidades.get(tema.unidadId);
    if (!unidad || !unidad.asignaturaId) return false;

    // Estudiante: además la unidad debe ser visible y el tema publicado
    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false || tema.estado !== 'publicado') {
        return false;
      }
    }

    return permitidas.includes(unidad.asignaturaId);
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio para la canción');
    error.estado = 400;
    throw error;
  }

  if (!datos.titulo || typeof datos.titulo !== 'string' || !datos.titulo.trim()) {
    const error = new Error('El título de la canción es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!datos.autoria || typeof datos.autoria !== 'string' || !datos.autoria.trim()) {
    const error = new Error('La autoría es obligatoria');
    error.estado = 400;
    throw error;
  }

  if (!datos.licencia || typeof datos.licencia !== 'string' || !datos.licencia.trim()) {
    const error = new Error('La licencia es obligatoria');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para gestionar canciones en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
