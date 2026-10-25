import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { mostrarLogros } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

let temaActual = null;
let nivelesEstado = [];

// Estado de la sesión de evaluación activa
let sesionActiva = null; // { sesionId, nivel, preguntas, indiceActual }

async function iniciar() {
  ui.cargando(true);
  try {
    temaActual = await obtenerTemaActividad();
    await cargarEstadoNiveles();
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar la actividad', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function cargarEstadoNiveles() {
  if (!temaActual) return;
  try {
    const data = await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(temaActual.id)}`);
    nivelesEstado = Array.isArray(data.niveles) ? data.niveles : [];
    renderizarNiveles();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar los niveles del quiz', 'error');
  }
}

function renderizarNiveles() {
  const contenedor = document.getElementById('contenido');

  contenedor.innerHTML = `
    <header class="quiz-cabecera">
      <div class="quiz-cabecera__fila">
        <h1 class="quiz-cabecera__titulo">Quiz por niveles</h1>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btnCambiarTema">
          Cambiar tema
        </button>
      </div>

      <div class="quiz-tema-activo">
        <div>
          <span style="font-size: var(--tamano-xs); color: var(--texto-suave); text-transform: uppercase;">Tema en estudio</span>
          <h2 style="font-size: var(--tamano-l); color: var(--primario); margin: 2px 0 0 0;">
            ${ui.escapar(temaActual.titulo)}
          </h2>
        </div>
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--texto btn--pequeno">
          📖 Leer resumen del tema →
        </a>
      </div>
    </header>

    <section aria-label="Niveles cognitivos del quiz">
      <p style="color: var(--texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espaciado-s);">
        Demuestra tu dominio progresando a través de los 5 niveles basados en la Taxonomía de Bloom. Necesitas un <strong>70%</strong> para aprobar y desbloquear el siguiente nivel y su diploma correspondiente.
      </p>

      <div class="quiz-niveles-grid">
        ${nivelesEstado.map(n => renderizarTarjetaNivel(n)).join('')}
      </div>
    </section>
  `;

  // Event Listeners
  document.getElementById('btnCambiarTema').addEventListener('click', async () => {
    // Limpiar el parámetro de la URL para forzar el selector
    const url = new URL(window.location.href);
    url.searchParams.delete('temaId');
    window.history.replaceState({}, '', url.toString());
    await iniciar();
  });

  contenedor.querySelectorAll('.btn-iniciar-nivel').forEach(btn => {
    btn.addEventListener('click', () => {
      const nivel = Number(btn.dataset.nivel);
      iniciarQuiz(nivel);
    });
  });

  contenedor.querySelectorAll('.btn-descargar-diploma').forEach(btn => {
    btn.addEventListener('click', () => {
      const nivel = Number(btn.dataset.nivel);
      generarDiploma({ tipo: 'nivel-quiz', temaId: temaActual.id, nivel });
    });
  });
}

function renderizarTarjetaNivel(n) {
  const badgeClase = `tarjeta-nivel__estado-badge--${n.estado}`;
  const estadoTexto = n.estado === 'aprobado' ? '✓ Aprobado' : (n.estado === 'disponible' ? '🔓 Disponible' : '🔒 Bloqueado');
  const pct = Number(n.mejorPorcentaje) || 0;

  return `
    <article class="tarjeta-nivel tarjeta-nivel--${n.estado}" id="nivel-card-${n.nivel}">
      <div>
        <div class="tarjeta-nivel__cabecera">
          <div>
            <span class="tarjeta-nivel__numero">Nivel ${n.nivel}</span>
            <h3 class="tarjeta-nivel__nombre">${ui.escapar(n.nombre)}</h3>
          </div>
          <span class="tarjeta-nivel__estado-badge ${badgeClase}">${estadoTexto}</span>
        </div>

        <div style="margin-top: var(--espaciado-m);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="tarjeta-nivel__porcentaje">Mejor puntaje</span>
            <strong style="font-size: var(--tamano-s); color: ${pct >= 70 ? 'var(--exito)' : 'var(--texto)'};">${pct}%</strong>
          </div>
          <div class="tarjeta-nivel__barra">
            <div class="tarjeta-nivel__barra-llenado" style="width: ${pct}%;"></div>
          </div>
        </div>
      </div>

      <div class="tarjeta-nivel__acciones">
        ${n.estado === 'disponible' ? `
          <button type="button" class="btn btn--primario btn-iniciar-nivel" data-nivel="${n.nivel}">
            Iniciar Quiz
          </button>
        ` : ''}

        ${n.estado === 'aprobado' ? `
          <button type="button" class="btn btn--secundario btn-iniciar-nivel" data-nivel="${n.nivel}">
            Repetir Quiz
          </button>
          <button type="button" class="btn btn--texto btn-descargar-diploma" data-nivel="${n.nivel}">
            🎓 Descargar diploma
          </button>
        ` : ''}

        ${n.estado === 'bloqueado' ? `
          <button type="button" class="btn btn--secundario" disabled>
            Bloqueado
          </button>
        ` : ''}
      </div>
    </article>
  `;
}

/**
 * Inicia la sesión de evaluación para un nivel
 */
async function iniciarQuiz(nivel) {
  ui.cargando(true);
  try {
    const data = await api.llamar('POST', '/api/quiz/iniciar', {
      temaId: temaActual.id,
      nivel
    });

    if (!data.sesionId || !Array.isArray(data.preguntas) || data.preguntas.length === 0) {
      throw new Error('No se pudieron obtener preguntas para esta sesión de quiz.');
    }

    sesionActiva = {
      sesionId: data.sesionId,
      nivel,
      preguntas: data.preguntas,
      indiceActual: 0
    };

    renderizarPreguntaActiva();
  } catch (err) {
    ui.aviso(err.message || 'Error al iniciar el quiz', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Renderiza la pregunta actual con barra de progreso y opciones adaptadas al tipo
 */
function renderizarPreguntaActiva() {
  const contenedor = document.getElementById('contenido');
  const { preguntas, indiceActual, nivel } = sesionActiva;
  const preg = preguntas[indiceActual];
  const total = preguntas.length;
  const progresoPct = Math.round(((indiceActual + 1) / total) * 100);

  let opcionesHtml = '';

  if (preg.tipo === 'opcion') {
    opcionesHtml = `
      <div class="quiz-opciones-lista" role="radiogroup" aria-label="Opciones de respuesta">
        ${preg.opciones.map((opc, i) => `
          <label class="quiz-opcion-label" for="opcion_${i}">
            <input type="radio" name="respuestaQuiz" id="opcion_${i}" value="${i}" class="quiz-opcion-radio">
            <span>${ui.escapar(opc)}</span>
          </label>
        `).join('')}
      </div>
    `;
  } else if (preg.tipo === 'vf') {
    opcionesHtml = `
      <div class="quiz-vf-contenedor" role="radiogroup" aria-label="Verdadero o Falso">
        <button type="button" class="quiz-vf-btn" data-valor="true" id="btnVFVerdadero">
          <span style="font-size: var(--tamano-2xl);" aria-hidden="true">✓</span>
          <span>Verdadero</span>
        </button>
        <button type="button" class="quiz-vf-btn" data-valor="false" id="btnVFFalso">
          <span style="font-size: var(--tamano-2xl);" aria-hidden="true">✗</span>
          <span>Falso</span>
        </button>
      </div>
      <input type="hidden" id="inputVFSeleccion" value="">
    `;
  } else if (preg.tipo === 'completar') {
    opcionesHtml = `
      <div class="quiz-completar-contenedor">
        <label for="txtCompletar" style="display: block; font-weight: var(--peso-seminegrita); margin-bottom: var(--espaciado-xs);">
          Escribe la palabra o frase que completa el enunciado:
        </label>
        <input type="text" id="txtCompletar" class="quiz-completar-input" placeholder="Tu respuesta..." autocomplete="off">
      </div>
    `;
  }

  contenedor.innerHTML = `
    <div class="quiz-evaluacion">
      <div class="quiz-progreso">
        <div class="quiz-progreso__meta">
          <span>Nivel ${nivel} · Pregunta ${indiceActual + 1} de ${total}</span>
          <span>${progresoPct}%</span>
        </div>
        <div class="quiz-progreso__barra">
          <div class="quiz-progreso__relleno" style="width: ${progresoPct}%;"></div>
        </div>
      </div>

      <div class="quiz-enunciado">
        ${ui.escapar(preg.enunciado)}
      </div>

      <form id="formRespuestaQuiz">
        ${opcionesHtml}

        <div class="quiz-acciones-pie">
          <button type="button" class="btn btn--texto btn--pequeno" id="btnCancelarQuiz">
            Abandonar quiz
          </button>
          <button type="submit" class="btn btn--primario" id="btnResponder">
            Responder
          </button>
        </div>
      </form>
    </div>
  `;

  // Manejo de interacción según tipo
  if (preg.tipo === 'vf') {
    const btnV = document.getElementById('btnVFVerdadero');
    const btnF = document.getElementById('btnVFFalso');
    const inputHidden = document.getElementById('inputVFSeleccion');

    btnV.addEventListener('click', () => {
      btnV.classList.add('quiz-vf-btn--seleccionado');
      btnF.classList.remove('quiz-vf-btn--seleccionado');
      inputHidden.value = 'true';
    });

    btnF.addEventListener('click', () => {
      btnF.classList.add('quiz-vf-btn--seleccionado');
      btnV.classList.remove('quiz-vf-btn--seleccionado');
      inputHidden.value = 'false';
    });
  }

  // Cancelar quiz
  document.getElementById('btnCancelarQuiz').addEventListener('click', async () => {
    const ok = await ui.confirmar('¿Estás seguro de que deseas salir del quiz? Tu progreso en esta sesión no se guardará.');
    if (ok) {
      sesionActiva = null;
      renderizarNiveles();
    }
  });

  // Enviar respuesta
  document.getElementById('formRespuestaQuiz').addEventListener('submit', async (e) => {
    e.preventDefault();

    let respuestaUsuario = null;

    if (preg.tipo === 'opcion') {
      const radio = document.querySelector('input[name="respuestaQuiz"]:checked');
      if (!radio) {
        ui.aviso('Por favor selecciona una de las opciones', 'advertencia');
        return;
      }
      respuestaUsuario = Number(radio.value);
    } else if (preg.tipo === 'vf') {
      const valor = document.getElementById('inputVFSeleccion').value;
      if (!valor) {
        ui.aviso('Por favor selecciona Verdadero o Falso', 'advertencia');
        return;
      }
      respuestaUsuario = valor === 'true';
    } else if (preg.tipo === 'completar') {
      const input = document.getElementById('txtCompletar');
      const txt = input ? input.value.trim() : '';
      if (!txt) {
        ui.aviso('Por favor ingresa tu respuesta', 'advertencia');
        return;
      }
      respuestaUsuario = txt;
    }

    ui.cargando(true);
    try {
      const resultadoRespuesta = await api.llamar('POST', '/api/quiz/responder', {
        sesionId: sesionActiva.sesionId,
        preguntaId: preg.id,
        respuesta: respuestaUsuario
      });

      // Mostrar retroalimentación inmediata
      await mostrarRetro({
        correcto: resultadoRespuesta.correcto,
        explicacion: resultadoRespuesta.retroalimentacion,
        sugerencia: !resultadoRespuesta.correcto ? `La respuesta correcta es: ${resultadoRespuesta.correcta}` : null,
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
      });

      // Avanzar a la siguiente pregunta o finalizar
      sesionActiva.indiceActual += 1;
      if (sesionActiva.indiceActual < sesionActiva.preguntas.length) {
        renderizarPreguntaActiva();
      } else {
        await finalizarQuiz();
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al enviar respuesta', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

/**
 * Finaliza la sesión de quiz y presenta resumen, logros y diploma
 */
async function finalizarQuiz() {
  ui.cargando(true);
  try {
    const fin = await api.llamar('POST', '/api/quiz/finalizar', {
      sesionId: sesionActiva.sesionId
    });

    const nivelFinalizado = sesionActiva.nivel;
    sesionActiva = null;

    // Mostrar resumen formativo
    const accion = await mostrarResumen({
      titulo: `Resultados del Nivel ${nivelFinalizado} · ${fin.aprobado ? '¡Aprobado!' : 'No alcanzado'}`,
      aciertos: fin.aciertos,
      errores: fin.total - fin.aciertos,
      recomendaciones: fin.repasar,
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
    });

    // Si aprobó, mostrar logros e insignias ganadas
    if (fin.aprobado) {
      mostrarLogros(fin);

      // Ofrecer descarga inmediata del diploma
      const deseaDiploma = await ui.confirmar('¡Has aprobado el nivel con éxito! ¿Deseas descargar tu diploma oficial en PDF ahora mismo?');
      if (deseaDiploma) {
        await generarDiploma({
          tipo: 'nivel-quiz',
          temaId: temaActual.id,
          nivel: nivelFinalizado
        });
      }
    } else if (accion === 'repetir') {
      // Si no aprobó y pulsa repetir, iniciar nuevo intento con preguntas frescas
      await iniciarQuiz(nivelFinalizado);
      return;
    }

    // Actualizar estados de niveles en la interfaz
    await cargarEstadoNiveles();
  } catch (err) {
    ui.aviso(err.message || 'Error al finalizar el quiz', 'error');
    await cargarEstadoNiveles();
  } finally {
    ui.cargando(false);
  }
}

iniciar();
