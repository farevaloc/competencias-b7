export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    return lista.filter(d => d.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(d => Array.isArray(d.estudiantes) && d.estudiantes.includes(usuario.id));
  }

  return [];
}

export default {
  filtrarLista
};
