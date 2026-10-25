import * as almacen from './almacen.js';

export async function gruposDe(usuario) {
  if (!usuario) return [];
  const distributivo = await almacen.leer('distributivo');

  // Administrador tiene acceso a todos los grupos
  if (usuario.rol === 'admin') {
    return distributivo;
  }

  // Docente: grupos donde es el docente asignado
  if (usuario.rol === 'docente') {
    return distributivo.filter(d => d.docenteId === usuario.id);
  }

  // Estudiante: grupos donde figura en la lista de estudiantes
  if (usuario.rol === 'estudiante') {
    return distributivo.filter(d => Array.isArray(d.estudiantes) && d.estudiantes.includes(usuario.id));
  }

  return [];
}

export async function asignaturasDe(usuario) {
  if (!usuario) return [];

  // Administrador ve todas las asignaturas
  if (usuario.rol === 'admin') {
    const asignaturas = await almacen.leer('asignaturas');
    return asignaturas.map(a => a.id);
  }

  // Docente o estudiante: asignaturas vinculadas a sus grupos
  const grupos = await gruposDe(usuario);
  const ids = [...new Set(grupos.map(g => g.asignaturaId).filter(Boolean))];
  return ids;
}

export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find(t => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  return unidad.asignaturaId;
}

export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !asignaturaId) return false;

  if (usuario.rol === 'admin') {
    return true;
  }

  if (usuario.rol === 'docente') {
    const grupos = await gruposDe(usuario);
    return grupos.some(g => g.asignaturaId === asignaturaId);
  }

  return false;
}

export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const gruposDocente = distributivo.filter(d => d.docenteId === docenteId);

  const idsEstudiantes = new Set();
  for (const g of gruposDocente) {
    if (Array.isArray(g.estudiantes)) {
      for (const estId of g.estudiantes) {
        if (estId) idsEstudiantes.add(estId);
      }
    }
  }

  return Array.from(idsEstudiantes);
}

export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const gruposEstudiante = distributivo.filter(d => Array.isArray(d.estudiantes) && d.estudiantes.includes(estudianteId));

  const idsDocentes = new Set();
  for (const g of gruposEstudiante) {
    if (g.docenteId) idsDocentes.add(g.docenteId);
  }

  return Array.from(idsDocentes);
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
