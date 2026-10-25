import { estudiantesDe } from '../acceso.js';

/**
 * servidor/ganchos/intentos.js
 * Filtrado de intentos: docente solo ve los de sus estudiantes, estudiante solo los propios.
 */
export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    return lista.filter(item => misEstudiantes.includes(item.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(item => item.usuarioId === usuario.id);
  }

  return [];
}

export default {
  filtrarLista
};
