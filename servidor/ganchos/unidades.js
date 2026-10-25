import { asignaturasDe, puedeEditarAsignatura } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  let resultado = lista.filter(u => permitidas.includes(u.asignaturaId));

  if (usuario.rol === 'estudiante') {
    resultado = resultado.filter(u => u.visible !== false);
  }

  return resultado;
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos.asignaturaId || (anterior && anterior.asignaturaId);
  const puede = await puedeEditarAsignatura(usuario, asignaturaId);

  if (!puede) {
    const error = new Error('No tienes permisos para editar unidades en esta asignatura');
    error.estado = 403;
    throw error;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
