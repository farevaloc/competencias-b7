import * as almacen from '../almacen.js';
import { estudiantesDe } from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  if (usuario.rol === 'docente') {
    const misEstudiantes = await estudiantesDe(usuario.id);
    return lista.filter(p => misEstudiantes.includes(p.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(p => p.usuarioId === usuario.id);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const resultado = { ...datos };

  if (usuario && usuario.id) {
    resultado.usuarioId = usuario.id;
  }

  if (!resultado.temaId) {
    const error = new Error('El temaId es obligatorio para registrar progreso');
    error.estado = 400;
    throw error;
  }

  const existentes = await almacen.leer('progreso-temas');
  const duplicado = existentes.some(p =>
    p.usuarioId === resultado.usuarioId &&
    p.temaId === resultado.temaId &&
    (!anterior || p.id !== anterior.id)
  );

  if (duplicado) {
    const error = new Error('El progreso de este tema ya está registrado para este usuario');
    error.estado = 400;
    throw error;
  }

  return resultado;
}

export default {
  filtrarLista,
  antesDeGuardar
};
