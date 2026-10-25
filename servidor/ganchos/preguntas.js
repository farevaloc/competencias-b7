import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

/**
 * servidor/ganchos/preguntas.js
 * Reglas y permisos para la colección preguntas.
 */

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  if (!usuario) return [];
  if (usuario.rol === 'admin') return lista;

  // Los estudiantes nunca leen esta colección (regla estricta)
  if (usuario.rol !== 'docente') return [];

  const permitidas = await asignaturasDe(usuario);
  const temas = await almacen.leer('temas');
  const unidades = await almacen.leer('unidades');

  const mapaTemas = new Map(temas.map(t => [t.id, t]));
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  return lista.filter(p => {
    const tema = mapaTemas.get(p.temaId);
    if (!tema) return false;
    const unidad = mapaUnidades.get(tema.unidadId);
    return unidad && permitidas.includes(unidad.asignaturaId);
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || (anterior && anterior.temaId);
  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar preguntas de esta asignatura');
    error.estado = 403;
    throw error;
  }

  // Validaciones del esquema de pregunta
  if (!datos.enunciado || typeof datos.enunciado !== 'string' || !datos.enunciado.trim()) {
    const error = new Error('El enunciado de la pregunta es obligatorio');
    error.estado = 400;
    throw error;
  }

  const nivelNum = Number(datos.nivel);
  if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
    const error = new Error('El nivel de la pregunta debe estar entre 1 y 5');
    error.estado = 400;
    throw error;
  }
  datos.nivel = nivelNum;

  const tiposValidos = ['opcion', 'vf', 'completar'];
  if (!tiposValidos.includes(datos.tipo)) {
    const error = new Error(`El tipo debe ser uno de: ${tiposValidos.join(', ')}`);
    error.estado = 400;
    throw error;
  }

  if (datos.tipo === 'opcion') {
    if (!Array.isArray(datos.opciones) || datos.opciones.length < 2) {
      const error = new Error('Las preguntas de opción deben tener al menos 2 opciones');
      error.estado = 400;
      throw error;
    }
    const idx = Number(datos.correcta);
    if (isNaN(idx) || idx < 0 || idx >= datos.opciones.length) {
      const error = new Error('El índice de la opción correcta es inválido');
      error.estado = 400;
      throw error;
    }
    datos.correcta = idx;
  } else if (datos.tipo === 'vf') {
    datos.opciones = ['Verdadero', 'Falso'];
    datos.correcta = Boolean(datos.correcta);
  } else if (datos.tipo === 'completar') {
    if (typeof datos.correcta !== 'string' || !datos.correcta.trim()) {
      const error = new Error('La respuesta correcta para completar no puede estar vacía');
      error.estado = 400;
      throw error;
    }
    datos.correcta = datos.correcta.trim();
    if (!Array.isArray(datos.opciones)) {
      datos.opciones = [];
    }
  }

  datos.origen = datos.origen === 'ia' ? 'ia' : 'docente';
  datos.estado = datos.estado === 'borrador' ? 'borrador' : 'aprobado';
  datos.retroalimentacion = typeof datos.retroalimentacion === 'string' ? datos.retroalimentacion.trim() : '';

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
