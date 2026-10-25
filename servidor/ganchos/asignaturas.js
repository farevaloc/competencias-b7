import { asignaturasDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  const permitidas = await asignaturasDe(usuario);
  return lista.filter(a => permitidas.includes(a.id));
}

export default {
  filtrarLista
};
