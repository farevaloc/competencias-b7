import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaTemas = new Map(temas.map(t => [t.id, t]));
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  let resultado = lista.filter(g => {
    const tema = mapaTemas.get(g.temaId);
    if (!tema) return false;
    const unidad = mapaUnidades.get(tema.unidadId);
    return unidad && permitidas.includes(unidad.asignaturaId);
  });

  if (usuario.rol === 'estudiante') {
    resultado = resultado.filter(g => {
      const tema = mapaTemas.get(g.temaId);
      if (!tema || tema.estado !== 'publicado') return false;
      const unidad = mapaUnidades.get(tema.unidadId);
      if (!unidad || unidad.visible === false) return false;
      return g.estado === 'aprobado';
    });
  }

  return resultado;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || (anterior && anterior.temaId);
  const asignaturaId = await asignaturaDeTema(temaId);

  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar términos de glosario en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
