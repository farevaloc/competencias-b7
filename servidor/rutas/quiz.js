import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { asignaturasDe, asignaturaDeTema } from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();

const NOMBRES_NIVELES = {
  1: 'Recordar',
  2: 'Comprender',
  3: 'Aplicar',
  4: 'Analizar',
  5: 'Evaluar'
};

function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  const recortado = String(texto).trim().toUpperCase();
  return recortado
    .replace(/Ñ/g, '___ENE___')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/___ENE___/g, 'Ñ');
}

function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Valida que el usuario sea estudiante y tenga acceso al tema solicitado
 */
async function validarAccesoEstudianteTema(usuario, temaId) {
  if (!usuario) {
    const error = new Error('Usuario no autenticado');
    error.estado = 401;
    throw error;
  }

  if (usuario.rol !== 'estudiante') {
    const error = new Error('Solo los estudiantes tienen acceso al motor de quiz');
    error.estado = 403;
    throw error;
  }

  if (!temaId) {
    const error = new Error('El parámetro temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const asignaturaId = await asignaturaDeTema(temaId);
  if (!asignaturaId) {
    const error = new Error('Tema no encontrado o no vinculado a una asignatura');
    error.estado = 404;
    throw error;
  }

  const permitidas = await asignaturasDe(usuario);
  if (!permitidas.includes(asignaturaId)) {
    const error = new Error('No tienes acceso al tema especificado');
    error.estado = 403;
    throw error;
  }

  return asignaturaId;
}

// 1. GET /api/quiz/estado?temaId=
router.get('/quiz/estado', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { temaId } = req.query;
    await validarAccesoEstudianteTema(req.usuario, temaId);

    // Cargar logros del estudiante para verificar el nivelQuiz en este tema
    const todosLogros = await almacen.leer('logros');
    const miLogro = todosLogros.find(l => l.usuarioId === req.usuario.id);
    const nivelAprobadoTema = (miLogro && miLogro.nivelQuiz && Number(miLogro.nivelQuiz[temaId])) || 0;

    // Cargar intentos y sesiones para calcular el mejorPorcentaje por nivel
    const todosIntentos = await almacen.leer('intentos');
    const misIntentosQuiz = todosIntentos.filter(i =>
      i.usuarioId === req.usuario.id &&
      i.actividad === 'quiz' &&
      i.temaId === temaId
    );

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const misSesiones = todasSesiones.filter(s =>
      s.usuarioId === req.usuario.id &&
      s.temaId === temaId &&
      s.finalizada
    );

    const niveles = [1, 2, 3, 4, 5].map(n => {
      // Determinar estado: el nivel 1 siempre está disponible; nivel n si el n - 1 está aprobado
      let estado = 'bloqueado';
      if (nivelAprobadoTema >= n) {
        estado = 'aprobado';
      } else if (n === 1 || nivelAprobadoTema >= n - 1) {
        estado = 'disponible';
      }

      // Calcular mejor porcentaje histórico en ese nivel
      const intentosNivel = misIntentosQuiz.filter(i => Number(i.nivel) === n);
      let mejorPct = intentosNivel.length > 0
        ? Math.max(...intentosNivel.map(i => {
            const max = i.maximo > 0 ? i.maximo : 1;
            return Math.round((i.puntaje / max) * 100);
          }))
        : 0;

      const sesionesNivel = misSesiones.filter(s => Number(s.nivel) === n);
      if (sesionesNivel.length > 0) {
        const mejorDeSesiones = Math.max(...sesionesNivel.map(s => {
          const total = Array.isArray(s.preguntasIds) ? s.preguntasIds.length : 0;
          const aciertos = Object.values(s.respuestas || {}).filter(r => r && r.correcto).length;
          return total > 0 ? Math.round((aciertos / total) * 100) : 0;
        }));
        mejorPct = Math.max(mejorPct, mejorDeSesiones);
      }

      return {
        nivel: n,
        nombre: NOMBRES_NIVELES[n],
        estado,
        mejorPorcentaje: mejorPct
      };
    });

    res.json({ niveles });
  } catch (err) {
    next(err);
  }
});

// 2. POST /api/quiz/iniciar { temaId, nivel }
router.post('/quiz/iniciar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { temaId } = req.body;
    const nivel = Number(req.body.nivel);

    const asignaturaId = await validarAccesoEstudianteTema(req.usuario, temaId);

    if (isNaN(nivel) || nivel < 1 || nivel > 5) {
      const error = new Error('El nivel debe ser un número entero entre 1 y 5');
      error.estado = 400;
      throw error;
    }

    // Verificar que el nivel esté disponible para el estudiante
    const todosLogros = await almacen.leer('logros');
    const miLogro = todosLogros.find(l => l.usuarioId === req.usuario.id);
    const nivelAprobadoTema = (miLogro && miLogro.nivelQuiz && Number(miLogro.nivelQuiz[temaId])) || 0;

    const estaDisponible = (nivel === 1) || (nivelAprobadoTema >= nivel - 1);
    if (!estaDisponible) {
      const error = new Error(`El nivel ${nivel} aún está bloqueado. Debes aprobar primero el nivel anterior.`);
      error.estado = 400;
      throw error;
    }

    // Reglas de quiz
    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const preguntasPorNivel = (reglas.quiz && Number(reglas.quiz.preguntasPorNivel)) || 10;

    // Buscar preguntas aprobadas de ese tema y nivel
    const todasPreguntas = await almacen.leer('preguntas');
    const preguntasDisponibles = todasPreguntas.filter(p =>
      p.temaId === temaId &&
      Number(p.nivel) === nivel &&
      p.estado === 'aprobado'
    );

    if (preguntasDisponibles.length === 0) {
      const error = new Error('No hay preguntas aprobadas disponibles para este tema y nivel');
      error.estado = 400;
      throw error;
    }

    // Buscar sesiones previas del estudiante para saber qué preguntas ya vio
    const todasSesiones = await almacen.leer('quiz-sesiones');
    const misSesiones = todasSesiones.filter(s =>
      s.usuarioId === req.usuario.id &&
      s.temaId === temaId &&
      Number(s.nivel) === nivel
    );

    // Mapear última fecha en que vio cada pregunta
    const ultimaVezVista = new Map();
    for (const ses of misSesiones) {
      const fechaMs = new Date(ses.inicio || ses.fecha || 0).getTime();
      for (const pid of (ses.preguntasIds || [])) {
        const anterior = ultimaVezVista.get(pid) || 0;
        if (fechaMs > anterior) {
          ultimaVezVista.set(pid, fechaMs);
        }
      }
    }

    const noVistas = preguntasDisponibles.filter(p => !ultimaVezVista.has(p.id));
    const vistas = preguntasDisponibles
      .filter(p => ultimaVezVista.has(p.id))
      .sort((a, b) => (ultimaVezVista.get(a.id) || 0) - (ultimaVezVista.get(b.id) || 0));

    let seleccionadas = [];
    const noVistasBarajadas = barajar(noVistas);

    if (noVistasBarajadas.length >= preguntasPorNivel) {
      seleccionadas = noVistasBarajadas.slice(0, preguntasPorNivel);
    } else {
      seleccionadas = [...noVistasBarajadas];
      const faltan = preguntasPorNivel - seleccionadas.length;
      // Completar con las vistas hace más tiempo
      const adicionales = vistas.slice(0, faltan);
      seleccionadas.push(...adicionales);

      // Notificar al docente del grupo (máximo una vez al día por tema y nivel)
      try {
        const distributivo = await almacen.leer('distributivo');
        const grupo = distributivo.find(d =>
          d.asignaturaId === asignaturaId &&
          Array.isArray(d.estudiantes) &&
          d.estudiantes.includes(req.usuario.id)
        );

        if (grupo && grupo.docenteId) {
          const hoyStr = new Date().toISOString().slice(0, 10);
          const notificaciones = await almacen.leer('notificaciones');
          const yaNotificadoHoy = notificaciones.some(n =>
            n.usuarioId === grupo.docenteId &&
            n.tipo === 'alerta' &&
            n.enlace?.includes(`temaId=${temaId}`) &&
            n.mensaje?.includes(`nivel ${nivel}`) &&
            n.fecha?.startsWith(hoyStr)
          );

          if (!yaNotificadoHoy) {
            const temas = await almacen.leer('temas');
            const temaObj = temas.find(t => t.id === temaId);
            await notificar(grupo.docenteId, {
              tipo: 'alerta',
              mensaje: `El banco de preguntas para "${temaObj?.titulo || 'el tema'}" (nivel ${nivel}) tiene pocas preguntas aprobadas y debió reutilizarse contenido.`,
              enlace: `/paginas/banco-preguntas.html?temaId=${temaId}`
            });
          }
        }
      } catch (errNotif) {
        console.warn('Error al verificar o enviar notificación al docente:', errNotif.message);
      }
    }

    // Barajar la selección final
    seleccionadas = barajar(seleccionadas);

    // Crear quiz-sesión
    const nuevaSesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel,
      preguntasIds: seleccionadas.map(p => p.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    // Devolver SIN respuestas ni retroalimentación
    const preguntasPublicas = seleccionadas.map(p => ({
      id: p.id,
      tipo: p.tipo,
      enunciado: p.enunciado,
      opciones: Array.isArray(p.opciones) ? p.opciones : []
    }));

    res.json({
      sesionId: nuevaSesion.id,
      preguntas: preguntasPublicas
    });
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/quiz/responder { sesionId, preguntaId, respuesta }
router.post('/quiz/responder', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body;

    if (!sesionId || !preguntaId) {
      const error = new Error('Los campos sesionId y preguntaId son obligatorios');
      error.estado = 400;
      throw error;
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find(s => s.id === sesionId);

    if (!sesion) {
      const error = new Error('Sesión de quiz no encontrada');
      error.estado = 404;
      throw error;
    }

    if (sesion.usuarioId !== req.usuario.id) {
      const error = new Error('No tienes acceso a esta sesión de quiz');
      error.estado = 403;
      throw error;
    }

    if (sesion.finalizada) {
      const error = new Error('Esta sesión de quiz ya ha finalizado');
      error.estado = 400;
      throw error;
    }

    if (!Array.isArray(sesion.preguntasIds) || !sesion.preguntasIds.includes(preguntaId)) {
      const error = new Error('La pregunta no pertenece a esta sesión de quiz');
      error.estado = 400;
      throw error;
    }

    sesion.respuestas = sesion.respuestas || {};
    // Guarda una sola vez por pregunta
    if (sesion.respuestas[preguntaId]) {
      const error = new Error('Esta pregunta ya ha sido respondida previamente');
      error.estado = 400;
      throw error;
    }

    // Obtener la pregunta original
    const todasPreguntas = await almacen.leer('preguntas');
    const pregunta = todasPreguntas.find(p => p.id === preguntaId);
    if (!pregunta) {
      const error = new Error('Pregunta no encontrada');
      error.estado = 404;
      throw error;
    }

    let correcto = false;
    let textoCorrecta = '';

    if (pregunta.tipo === 'opcion') {
      const esperado = Number(pregunta.correcta);
      const recibido = Number(respuesta);
      correcto = !isNaN(recibido) && recibido === esperado;
      textoCorrecta = Array.isArray(pregunta.opciones) && pregunta.opciones[esperado] !== undefined
        ? String(pregunta.opciones[esperado])
        : String(pregunta.correcta);
    } else if (pregunta.tipo === 'vf') {
      const esperado = Boolean(pregunta.correcta);
      const recibido = respuesta === true || respuesta === 'true' || respuesta === 'Verdadero';
      correcto = recibido === esperado;
      textoCorrecta = esperado ? 'Verdadero' : 'Falso';
    } else if (pregunta.tipo === 'completar') {
      const respNorm = normalizar(String(respuesta ?? ''));
      const corrNorm = normalizar(String(pregunta.correcta ?? ''));
      correcto = respNorm !== '' && respNorm === corrNorm;
      textoCorrecta = String(pregunta.correcta ?? '');
    }

    sesion.respuestas[preguntaId] = {
      respuesta,
      correcto,
      fecha: new Date().toISOString()
    };

    await almacen.actualizar('quiz-sesiones', sesion.id, {
      respuestas: sesion.respuestas
    });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: textoCorrecta
    });
  } catch (err) {
    next(err);
  }
});

// 4. POST /api/quiz/finalizar { sesionId }
router.post('/quiz/finalizar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { sesionId } = req.body;

    if (!sesionId) {
      const error = new Error('El campo sesionId es obligatorio');
      error.estado = 400;
      throw error;
    }

    const todasSesiones = await almacen.leer('quiz-sesiones');
    const sesion = todasSesiones.find(s => s.id === sesionId);

    if (!sesion) {
      const error = new Error('Sesión de quiz no encontrada');
      error.estado = 404;
      throw error;
    }

    if (sesion.usuarioId !== req.usuario.id) {
      const error = new Error('No tienes acceso a esta sesión de quiz');
      error.estado = 403;
      throw error;
    }

    if (sesion.finalizada) {
      const error = new Error('Esta sesión de quiz ya ha sido finalizada');
      error.estado = 400;
      throw error;
    }

    const total = Array.isArray(sesion.preguntasIds) ? sesion.preguntasIds.length : 0;
    const respuestas = sesion.respuestas || {};

    const todasPreguntas = await almacen.leer('preguntas');
    const mapaPreguntas = new Map(todasPreguntas.map(p => [p.id, p]));

    let aciertos = 0;
    const repasar = [];

    for (const pid of (sesion.preguntasIds || [])) {
      const resp = respuestas[pid];
      const preg = mapaPreguntas.get(pid);
      if (resp && resp.correcto) {
        aciertos++;
      } else {
        if (preg && preg.retroalimentacion) {
          repasar.push(preg.retroalimentacion);
        }
      }
    }

    const errores = total - aciertos;
    const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const porcentajeReq = (reglas.quiz && Number(reglas.quiz.porcentajeAprobacion)) || 70;
    const aprobado = porcentaje >= porcentajeReq;

    // Calcular duración en segundos
    const inicioMs = new Date(sesion.inicio || sesion.fecha || Date.now()).getTime();
    const duracionSeg = Math.max(0, Math.round((Date.now() - inicioMs) / 1000));

    // Marcar sesión como finalizada
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fechaFin: new Date().toISOString()
    });

    // Si aprueba, primero actualiza logros.nivelQuiz[temaId] al máximo
    if (aprobado) {
      const todosLogros = await almacen.leer('logros');
      let miLogro = todosLogros.find(l => l.usuarioId === req.usuario.id);
      if (!miLogro) {
        miLogro = {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz: {}
        };
        miLogro = await almacen.agregar('logros', miLogro);
      }
      miLogro.nivelQuiz = miLogro.nivelQuiz || {};
      const nivelPrevio = Number(miLogro.nivelQuiz[sesion.temaId]) || 0;
      miLogro.nivelQuiz[sesion.temaId] = Math.max(nivelPrevio, Number(sesion.nivel));

      await almacen.actualizar('logros', miLogro.id, {
        nivelQuiz: miLogro.nivelQuiz
      });
    }

    // En todos los casos llama a procesarIntento
    const resultadoGamificacion = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: Number(sesion.nivel),
      puntaje: aciertos,
      maximo: total,
      errores,
      duracionSeg,
      detalle: {
        aprobado
      }
    });

    res.json({
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: resultadoGamificacion.puntosGanados,
      insigniasNuevas: resultadoGamificacion.insigniasNuevas
    });
  } catch (err) {
    next(err);
  }
});

export default router;
