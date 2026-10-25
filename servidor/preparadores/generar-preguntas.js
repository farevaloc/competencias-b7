import * as almacen from '../almacen.js';
import { asignaturaDeTema, puedeEditarAsignatura } from '../acceso.js';

const NIVELES_BLOOM = {
  1: '1 Recordar',
  2: '2 Comprender',
  3: '3 Aplicar',
  4: '4 Analizar',
  5: '5 Evaluar'
};

/**
 * Preparador de datos para la plantilla generar-preguntas.txt
 *
 * @param {Object} cuerpo { temaId, nivel, cantidad }
 * @param {Object} usuario Usuario en sesión
 * @returns {Promise<Object>} Datos para rellenar la plantilla de prompt
 */
export default async function prepararGenerarPreguntas(cuerpo, usuario) {
  if (!usuario) {
    const error = new Error('Usuario no autenticado');
    error.estado = 401;
    throw error;
  }

  const { temaId } = cuerpo || {};
  const nivel = Number(cuerpo?.nivel);
  const cantidad = Number(cuerpo?.cantidad) || 5;

  if (!temaId) {
    const error = new Error('El campo temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (isNaN(nivel) || nivel < 1 || nivel > 5) {
    const error = new Error('El nivel debe ser un número entero entre 1 y 5');
    error.estado = 400;
    throw error;
  }

  if (isNaN(cantidad) || cantidad < 5 || cantidad > 15) {
    const error = new Error('La cantidad de preguntas debe estar entre 5 y 15');
    error.estado = 400;
    throw error;
  }

  // 1. Verificar si el usuario puede editar la asignatura del tema
  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('Tema no encontrado o no vinculado a una asignatura');
    error.estado = 404;
    throw error;
  }

  const puede = await puedeEditarAsignatura(usuario, asignaturaId);
  if (!puede) {
    const error = new Error('No tienes permisos para editar preguntas de este tema');
    error.estado = 403;
    throw error;
  }

  // 2. Obtener datos de asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find(a => a.id === asignaturaId);
  const nombreAsignatura = asignatura ? asignatura.nombre : '';
  const nivelEducativo = asignatura ? (asignatura.nivel || '') : '';

  // 3. Obtener datos del tema
  const temas = await almacen.leer('temas');
  const tema = temas.find(t => t.id === temaId);
  if (!tema) {
    const error = new Error('Tema no encontrado');
    error.estado = 404;
    throw error;
  }

  let contenido = tema.resumen || '';
  if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
    contenido += `\n\nObjetivos:\n- ${tema.objetivos.join('\n- ')}`;
  }
  if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
    contenido += `\n\nEjemplos:\n- ${tema.ejemplos.join('\n- ')}`;
  }
  if (Array.isArray(tema.erroresFrecuentes) && tema.erroresFrecuentes.length > 0) {
    contenido += `\n\nErrores frecuentes:\n- ${tema.erroresFrecuentes.join('\n- ')}`;
  }

  // 4. Glosario ("término: definición")
  const todosGlosario = await almacen.leer('glosario');
  const glosarioTema = todosGlosario
    .filter(g => g.temaId === temaId && g.estado === 'aprobado')
    .map(g => `${g.termino}: ${g.definicion}`)
    .join('\n');

  // 5. Nivel cognitivo Bloom
  const nivelBloom = NIVELES_BLOOM[nivel] || `${nivel}`;

  // 6. Preguntas existentes de ese nivel (enunciados)
  const todasPreguntas = await almacen.leer('preguntas');
  const existentesArr = todasPreguntas
    .filter(p => p.temaId === temaId && Number(p.nivel) === nivel && p.enunciado)
    .map(p => `- ${p.enunciado}`);
  const existentes = existentesArr.length > 0 ? existentesArr.join('\n') : '(Ninguna)';

  return {
    asignatura: nombreAsignatura,
    nivel: nivelEducativo,
    tema: tema.titulo || '',
    contenido: contenido.trim(),
    glosario: glosarioTema || '(Sin glosario)',
    nivelBloom,
    cantidad,
    existentes
  };
}
