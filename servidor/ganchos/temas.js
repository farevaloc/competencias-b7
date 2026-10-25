import * as almacen from '../almacen.js';
import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  let resultado = lista.filter(t => {
    const unidad = mapaUnidades.get(t.unidadId);
    return unidad && permitidas.includes(unidad.asignaturaId);
  });

  if (usuario.rol === 'estudiante') {
    resultado = resultado.filter(t => {
      const unidad = mapaUnidades.get(t.unidadId);
      return unidad && unidad.visible !== false && t.estado === 'publicado';
    });
  }

  return resultado;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos.unidadId || (anterior && anterior.unidadId);
  let asignaturaId = null;

  if (unidadId) {
    const unidades = await almacen.leer('unidades');
    const unidad = unidades.find(u => u.id === unidadId);
    if (unidad) {
      asignaturaId = unidad.asignaturaId;
    }
  }

  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar temas en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
