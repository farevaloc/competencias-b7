import * as almacen from '../almacen.js';
import { asignaturasDe, asignaturaDeTema } from '../acceso.js';

/**
 * Preparador para la tarea tutor de IA (Tutor Socrático de la Asignatura)
 *
 * @param {Object} cuerpo { asignaturaId, temaId, mensaje, historial }
 * @param {Object} usuario Usuario en sesión
 * @returns {Promise<Object>} Variables para la plantilla tutor.txt
 */
export default async function prepararTutor(cuerpo, usuario) {
  if (!usuario) {
    const error = new Error('Usuario no autenticado');
    error.estado = 401;
    throw error;
  }

  let { asignaturaId, temaId, mensaje, historial } = cuerpo || {};

  if (!asignaturaId && temaId) {
    asignaturaId = await asignaturaDeTema(temaId);
  }

  if (!asignaturaId) {
    const error = new Error('El identificador de la asignatura es obligatorio');
    error.estado = 400;
    throw error;
  }

  if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
    const error = new Error('El mensaje del estudiante no puede estar vacío');
    error.estado = 400;
    throw error;
  }

  // Verificar que el estudiante tenga acceso a la asignatura
  const permitidas = await asignaturasDe(usuario);
  if (!permitidas.includes(asignaturaId)) {
    const error = new Error('No tienes acceso a los contenidos de esta asignatura');
    error.estado = 403;
    throw error;
  }

  // Validar límite diario del tutor para estudiantes
  if (usuario.rol === 'estudiante') {
    const ajustes = await almacen.leerConfig('ajustes');
    const limiteDiario = Number(ajustes.limiteTutorDiario) || 40;
    const hoy = new Date().toISOString().slice(0, 10);
    const consultas = await almacen.leer('consultas-tutor');
    const conteoHoy = consultas.filter(c => c.usuarioId === usuario.id && c.dia === hoy).length;
    if (conteoHoy >= limiteDiario) {
      const error = new Error(`Has alcanzado el límite diario de ${limiteDiario} consultas con el tutor virtual. Vuelve a intentarlo mañana.`);
      error.estado = 429;
      throw error;
    }
  }

  // Cargar datos de la asignatura
  const asignaturas = await almacen.leer('asignaturas');
  const asignatura = asignaturas.find(a => a.id === asignaturaId);
  if (!asignatura) {
    const error = new Error('Asignatura no encontrada');
    error.estado = 404;
    throw error;
  }

  // Cargar unidades de la asignatura
  const todasUnidades = await almacen.leer('unidades');
  const unidadesAsig = todasUnidades
    .filter(u => u.asignaturaId === asignaturaId && u.visible !== false)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const unidadesIds = new Set(unidadesAsig.map(u => u.id));

  // Cargar temas de esas unidades
  const todosTemas = await almacen.leer('temas');
  const temasAsig = todosTemas
    .filter(t => unidadesIds.has(t.unidadId) && (usuario.rol === 'admin' || t.estado === 'publicado'))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const temasIds = new Set(temasAsig.map(t => t.id));

  // Construir temario estructurado con resúmenes y objetivos
  let temarioTexto = '';
  if (unidadesAsig.length === 0) {
    temarioTexto = '(Sin unidades publicadas actualmente)';
  } else {
    temarioTexto = unidadesAsig.map((u, i) => {
      const temasDeU = temasAsig.filter(t => t.unidadId === u.id);
      const temasStr = temasDeU.map((t, j) => {
        let detalle = `  - Tema ${i + 1}.${j + 1}: ${t.titulo}`;
        if (t.resumen) {
          detalle += `\n    Resumen formativo: ${t.resumen}`;
        }
        if (Array.isArray(t.objetivos) && t.objetivos.length > 0) {
          detalle += `\n    Objetivos: ${t.objetivos.join(', ')}`;
        }
        if (Array.isArray(t.palabrasClave) && t.palabrasClave.length > 0) {
          detalle += `\n    Palabras clave: ${t.palabrasClave.join(', ')}`;
        }
        return detalle;
      }).join('\n');

      return `Unidad ${i + 1}: ${u.titulo}\n${temasStr || '  (Sin temas)'}`;
    }).join('\n\n');
  }

  // Cargar glosario aprobado de los temas de la asignatura
  const todosGlosario = await almacen.leer('glosario');
  const glosarioAsig = todosGlosario
    .filter(g => temasIds.has(g.temaId) && g.estado === 'aprobado')
    .map(g => `- ${g.termino}: ${g.definicion}`);

  const glosarioTexto = glosarioAsig.length > 0
    ? glosarioAsig.join('\n')
    : '(Sin términos de glosario registrados)';

  // Formatear historial de mensajes
  let historialTexto = '(Inicio de la conversación)';
  if (Array.isArray(historial) && historial.length > 0) {
    historialTexto = historial.slice(-8).map(m => {
      const emisor = m.rol === 'estudiante' ? 'Estudiante' : 'Tutor Socrático';
      return `${emisor}: ${m.texto}`;
    }).join('\n');
  }

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel Académico General',
    descripcion: asignatura.descripcion || 'Sin descripción',
    temario: temarioTexto,
    glosario: glosarioTexto,
    historial: historialTexto,
    mensaje: mensaje.trim()
  };
}
