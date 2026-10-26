import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Asignatura', roles: ['estudiante', 'docente', 'admin'] });

const asignaturaId = util.parametro('id');
const contenedor = document.getElementById('contenido');

if (!asignaturaId) {
  contenedor.innerHTML = `
    <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
      No se especificó ninguna asignatura.
      <br><a href="/paginas/asignaturas.html" class="enlace">Ir a Mis asignaturas</a>
    </div>
  `;
} else {
  cargarAsignatura();
}

async function cargarAsignatura() {
  ui.cargando(true);
  try {
    const [asignaturas, unidades, temas, progreso] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    const asignatura = asignaturas.find(a => a.id === asignaturaId);
    if (!asignatura) {
      contenedor.innerHTML = `
        <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
          La asignatura solicitada no existe o no tienes acceso a ella.
          <br><a href="/paginas/asignaturas.html" class="enlace">Volver a Mis asignaturas</a>
        </div>
      `;
      return;
    }

    // Filtrar unidades visibles de esta asignatura y ordenar por orden
    const misUnidades = unidades
      .filter(u => u.asignaturaId === asignaturaId && u.visible !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // Conjunto de temas revisados por el usuario
    const temasRevisadosIds = new Set(progreso.map(p => p.temaId));

    // Renderizar unidades y temas
    let unidadesHtml = '';

    if (misUnidades.length === 0) {
      unidadesHtml = `
        <div class="vacio">
          <div class="vacio__icono">📂</div>
          <h2 class="vacio__titulo">No hay unidades disponibles</h2>
          <p class="vacio__texto">Esta asignatura aún no contiene unidades visibles de estudio.</p>
        </div>
      `;
    } else {
      unidadesHtml = misUnidades.map((unidad, idxUnidad) => {
        // Temas de esta unidad ordenados por campo orden
        const temasDeUnidad = temas
          .filter(t => t.unidadId === unidad.id)
          .sort((a, b) => (a.orden || 0) - (b.orden || 0));

        let temasListaHtml = '';
        if (temasDeUnidad.length === 0) {
          temasListaHtml = `
            <li class="tema-item" style="justify-content: center; color: var(--texto-suave);">
              <em>No hay temas disponibles en esta unidad.</em>
            </li>
          `;
        } else {
          temasListaHtml = temasDeUnidad.map((tema, idxTema) => {
            const revisado = temasRevisadosIds.has(tema.id);
            const numeroTema = `${idxUnidad + 1}.${idxTema + 1}`;
            const usuarioSesion = sesion.usuarioActual();
            const esDocente = usuarioSesion && (usuarioSesion.rol === 'docente' || usuarioSesion.rol === 'admin');

            let botonesAcciones = '';
            if (esDocente) {
              botonesAcciones = `
                <a href="/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--primario btn--pequeno" title="Crear o editar preguntas y cuestionarios para este tema">
                  📝 Gestionar Quiz
                </a>
                <a href="/paginas/quiz.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno" title="Probar el Quiz como estudiante">
                  👁️ Probar
                </a>
                <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--texto btn--pequeno">
                  Estudiar
                </a>
              `;
            } else {
              botonesAcciones = `
                ${revisado
                  ? `<span class="insignia insignia--revisado">Revisado ✓</span>`
                  : `<span class="insignia insignia--pendiente">Pendiente</span>`
                }
                <a href="/paginas/quiz.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--primario btn--pequeno" title="Rendir el Quiz por niveles de este tema">
                  🎯 Iniciar Quiz
                </a>
                <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario btn--pequeno">
                  Estudiar
                </a>
              `;
            }

            return `
              <li class="tema-item">
                <div class="tema-item__info">
                  <span class="tema-item__orden">${numeroTema}</span>
                  <div>
                    <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="tema-item__titulo">
                      ${ui.escapar(tema.titulo)}
                    </a>
                    ${tema.estado === 'borrador' ? '<span class="chip" style="margin-left: var(--espaciado-xs); font-size: 10px;">Borrador</span>' : ''}
                  </div>
                </div>

                <div class="tema-item__acciones">
                  ${botonesAcciones}
                </div>
              </li>
            `;
          }).join('');
        }

        return `
          <section class="tarjeta-unidad" aria-labelledby="unidad-titulo-${unidad.id}">
            <header class="tarjeta-unidad__cabecera">
              <h2 id="unidad-titulo-${unidad.id}" class="tarjeta-unidad__titulo">
                Unidad ${idxUnidad + 1}: ${ui.escapar(unidad.titulo)}
              </h2>
              <span class="chip">${temasDeUnidad.length} temas</span>
            </header>
            <ul class="temas-lista">
              ${temasListaHtml}
            </ul>
          </section>
        `;
      }).join('');
    }

    // Calcular estadísticas globales de la asignatura
    const todosTemasAsignatura = temas.filter(t =>
      misUnidades.some(u => u.id === t.unidadId) && (t.estado === 'publicado' || !t.estado)
    );
    const totalPublicados = todosTemasAsignatura.length;
    const totalRevisados = todosTemasAsignatura.filter(t => temasRevisadosIds.has(t.id)).length;
    const porcentajeGlobal = totalPublicados > 0 ? Math.round((totalRevisados / totalPublicados) * 100) : 0;

    // Generar sugerencias dinámicas basadas en los temas y unidades de la asignatura
    const preguntasSugeridas = [];
    if (todosTemasAsignatura.length > 0) {
      const t1 = todosTemasAsignatura[0];
      preguntasSugeridas.push(`¿Cómo se aplica "${t1.titulo}" en un caso práctico?`);
      if (todosTemasAsignatura.length > 1) {
        const t2 = todosTemasAsignatura[1];
        preguntasSugeridas.push(`¿Qué relación existe entre "${t1.titulo}" y "${t2.titulo}"?`);
      }
    }
    if (misUnidades.length > 0) {
      preguntasSugeridas.push(`¿Cuáles son los desafíos clave de la Unidad 1: ${misUnidades[0].titulo}?`);
    }
    preguntasSugeridas.push('Pon a prueba mi razonamiento sobre este contenido.');

    contenedor.innerHTML = `
      <section class="asignatura-seccion">
        <!-- Migas de pan -->
        <nav class="migas" aria-label="Ruta de exploración">
          <ol>
            <li><a href="/paginas/asignaturas.html">Mis asignaturas</a></li>
            <li class="migas__separador">/</li>
            <li class="migas__actual" aria-current="page">${ui.escapar(asignatura.nombre)}</li>
          </ol>
        </nav>

        <!-- Cabecera de asignatura -->
        <header class="asignatura-detalle-cabecera">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espaciado-m); flex-wrap: wrap;">
            <div>
              <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">
                ${ui.escapar(asignatura.nombre)}
              </h1>
              ${asignatura.nivel ? `<span class="chip" style="margin-top: var(--espaciado-xs);">${ui.escapar(asignatura.nivel)}</span>` : ''}
            </div>
            <div style="min-width: 200px; display: flex; flex-direction: column; gap: var(--espaciado-xs);">
              <div style="display: flex; justify-content: space-between; font-size: var(--tamano-xs); color: var(--texto-suave);">
                <span>Avance general</span>
                <strong>${porcentajeGlobal}% (${totalRevisados}/${totalPublicados})</strong>
              </div>
              <div class="progreso" role="progressbar" aria-valuenow="${porcentajeGlobal}" aria-valuemin="0" aria-valuemax="100">
                <span class="progreso-barra" style="width: ${porcentajeGlobal}%;"></span>
              </div>
            </div>
          </div>
          ${asignatura.descripcion ? `<p style="color: var(--texto-suave); font-size: var(--tamano-s); margin: 0;">${ui.escapar(asignatura.descripcion)}</p>` : ''}
        </header>

        <!-- Tarjeta y panel del Tutor Socrático -->
        <section class="tutor-banner" aria-labelledby="tutor-titulo">
          <div class="tutor-banner__cabecera">
            <div class="tutor-banner__identidad">
              <div class="tutor-avatar-circulo" aria-hidden="true">🏛️</div>
              <div class="tutor-banner__titulos">
                <h2 id="tutor-titulo" class="tutor-banner__titulo">
                  Tutor Virtual Socrático
                  <span class="chip chip--exito" style="font-size: 11px;">IA Activa</span>
                </h2>
                <p class="tutor-banner__descripcion">
                  Tu mentor interactivo para reflexionar, deducir y dominar los contenidos curriculares mediante el método socrático.
                </p>
              </div>
            </div>
            <div class="tutor-banner__acciones">
              <button type="button" class="btn btn--primario" id="btn-toggle-tutor" aria-expanded="false" aria-controls="panel-tutor-chat">
                💬 Conversar con el Tutor
              </button>
            </div>
          </div>

          <div class="tutor-sugerencias-bloque">
            <span class="tutor-sugerencias-rotulo">💡 Sugerencias de reflexión rápida:</span>
            <div class="tutor-pills">
              ${preguntasSugeridas.map(p => `
                <button type="button" class="tutor-pill" data-pregunta="${ui.escapar(p)}">
                  ${ui.escapar(p)}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Panel interactivo de Chat -->
          <div id="panel-tutor-chat" class="tutor-chat-panel" style="display: none;" role="region" aria-label="Chat del Tutor Socrático">
            <header class="tutor-chat-cabecera">
              <div class="tutor-chat-info">
                <span class="tutor-estado-punto" aria-hidden="true"></span>
                <div>
                  <h3 class="tutor-chat-titulo-texto">Tutor Socrático · ${ui.escapar(asignatura.nombre)}</h3>
                  <p class="tutor-chat-subtexto">Razonamiento guiado · Contenido curricular delimitado</p>
                </div>
              </div>
              <div class="tutor-chat-herramientas">
                <button type="button" class="tutor-btn-accion" id="btn-reiniciar-tutor" title="Reiniciar sesión de conversación">
                  🔄 Reiniciar
                </button>
                <button type="button" class="tutor-btn-accion" id="btn-cerrar-tutor" title="Ocultar panel del tutor">
                  ✖ Ocultar
                </button>
              </div>
            </header>

            <div class="tutor-chat-mensajes" id="tutor-mensajes-lista" aria-live="polite">
              <!-- Mensajes insertados dinámicamente -->
            </div>

            <footer class="tutor-chat-pie">
              <form class="tutor-chat-form" id="form-tutor-chat">
                <textarea
                  id="input-tutor-mensaje"
                  class="tutor-chat-textarea"
                  rows="1"
                  placeholder="Escribe tu reflexión, duda o respuesta (Enter para enviar)..."
                  aria-label="Mensaje para el tutor socrático"
                  required
                ></textarea>
                <button type="submit" class="btn btn--primario" id="btn-enviar-tutor" title="Enviar mensaje">
                  Enviar ➜
                </button>
              </form>
              <div class="tutor-chat-nota">
                <span>💡 El tutor socrático te orientará con preguntas para que deduzcas el concepto por ti mismo.</span>
              </div>
            </footer>
          </div>
        </section>

        <!-- Botón flotante accesible al desplazarse -->
        <button type="button" class="tutor-btn-flotante" id="btn-flotante-tutor" aria-label="Abrir tutor virtual socrático" title="Abrir tutor virtual socrático">
          <span>🏛️</span>
          <span>Tutor Socrático</span>
        </button>

        <!-- Tarjeta de Quiz y Cuestionarios -->
        <section class="tarjeta" style="background: var(--superficie); border: 1px solid var(--borde); border-radius: var(--radio-l); padding: var(--espaciado-l); box-shadow: var(--sombra-1);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espaciado-m);">
            <div style="display: flex; align-items: center; gap: var(--espaciado-m);">
              <div style="font-size: var(--tamano-2xl); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--superficie-suave); border-radius: var(--radio-completo);" aria-hidden="true">🎯</div>
              <div>
                <h2 style="font-size: var(--tamano-m); color: var(--primario); margin: 0; font-weight: var(--peso-negrita);">
                  Cuestionarios y Quiz por Niveles
                </h2>
                <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin: 2px 0 0 0;">
                  ${sesion.usuarioActual() && (sesion.usuarioActual().rol === 'docente' || sesion.usuarioActual().rol === 'admin')
                    ? 'Crea, genera con IA y administra los cuestionarios de cada tema para evaluar a los estudiantes.'
                    : 'Avanza a través de los 5 niveles cognitivos de Bloom, gana puntos de gamificación y obtén diplomas.'}
                </p>
              </div>
            </div>
            <div style="display: flex; gap: var(--espaciado-s); flex-wrap: wrap;">
              ${sesion.usuarioActual() && (sesion.usuarioActual().rol === 'docente' || sesion.usuarioActual().rol === 'admin') ? `
                <a href="/paginas/banco-preguntas.html" class="btn btn--primario">
                  📝 Banco de Preguntas / Crear Quiz
                </a>
              ` : ''}
              <a href="/paginas/quiz.html" class="btn btn--secundario">
                🎯 Ir a Quiz
              </a>
            </div>
          </div>
        </section>

        <!-- Listado de unidades -->
        <div class="asignatura-unidades-lista">
          ${unidadesHtml}
        </div>
      </section>
    `;

    // Inicializar controlador del chat socrático
    iniciarTutorSocratico(asignatura);
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar la asignatura: ${ui.escapar(err.message)}
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

/**
 * Controlador de la interfaz del Tutor Socrático
 */
function iniciarTutorSocratico(asignatura) {
  const panelChat = document.getElementById('panel-tutor-chat');
  const btnToggle = document.getElementById('btn-toggle-tutor');
  const btnFlotante = document.getElementById('btn-flotante-tutor');
  const btnCerrar = document.getElementById('btn-cerrar-tutor');
  const btnReiniciar = document.getElementById('btn-reiniciar-tutor');
  const formChat = document.getElementById('form-tutor-chat');
  const inputText = document.getElementById('input-tutor-mensaje');
  const btnEnviar = document.getElementById('btn-enviar-tutor');
  const listaMensajes = document.getElementById('tutor-mensajes-lista');
  const pills = document.querySelectorAll('.tutor-pill');

  if (!panelChat || !btnToggle) return;

  // Estado de la conversación en la sesión actual
  let historial = [];
  let enviando = false;

  const MENSAJE_BIENVENIDA = `¡Hola! Soy tu **Tutor Virtual Socrático** para la asignatura de **${asignatura.nombre}**.\n\nMi objetivo es acompañarte en tu razonamiento: en lugar de entregarte respuestas directas o soluciones resueltas, te guiaré con preguntas orientadoras, pistas y analogías para que deduzcas los conceptos por ti mismo.\n\n¿Qué tema o inquietud de nuestras unidades te gustaría explorar y analizar hoy?`;

  function scrollAlFinal() {
    listaMensajes.scrollTop = listaMensajes.scrollHeight;
  }

  function renderizarMensaje(emisor, texto, esInicial = false) {
    const fila = document.createElement('div');
    fila.className = `tutor-mensaje-fila tutor-mensaje-fila--${emisor}`;

    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const avatarHtml = emisor === 'tutor'
      ? `<div class="tutor-mini-avatar" aria-hidden="true">🏛️</div>`
      : `<div class="tutor-mini-avatar tutor-mini-avatar--estudiante" aria-hidden="true">👤</div>`;

    const contenidoFormateado = util.formatoBasico(texto);

    fila.innerHTML = `
      ${avatarHtml}
      <div class="tutor-burbuja">
        <div>${contenidoFormateado}</div>
        <div class="tutor-burbuja-meta">
          <span>${emisor === 'tutor' ? 'Tutor Socrático' : 'Tú'}</span>
          <time>${horaStr}</time>
        </div>
      </div>
    `;

    listaMensajes.appendChild(fila);
    scrollAlFinal();
  }

  function mostrarPensando(mostrar) {
    const indicadorExistente = document.getElementById('indicador-tutor-pensando');
    if (mostrar && !indicadorExistente) {
      const pensando = document.createElement('div');
      pensando.id = 'indicador-tutor-pensando';
      pensando.className = 'tutor-pensando';
      pensando.innerHTML = `
        <span class="tutor-pensando__texto">El tutor está formulando una pregunta reflexiva</span>
        <div class="tutor-puntos-animados" aria-hidden="true">
          <span class="tutor-punto"></span>
          <span class="tutor-punto"></span>
          <span class="tutor-punto"></span>
        </div>
      `;
      listaMensajes.appendChild(pensando);
      scrollAlFinal();
    } else if (!mostrar && indicadorExistente) {
      indicadorExistente.remove();
    }
  }

  function reiniciarConversacion() {
    historial = [];
    listaMensajes.innerHTML = '';
    renderizarMensaje('tutor', MENSAJE_BIENVENIDA, true);
  }

  function abrirPanel(abrir = true) {
    if (abrir) {
      panelChat.style.display = 'flex';
      btnToggle.setAttribute('aria-expanded', 'true');
      btnToggle.innerHTML = '▲ Ocultar Tutor';
      inputText.focus();
      scrollAlFinal();
    } else {
      panelChat.style.display = 'none';
      btnToggle.setAttribute('aria-expanded', 'false');
      btnToggle.innerHTML = '💬 Conversar con el Tutor';
    }
  }

  // Inicializar con mensaje de bienvenida
  reiniciarConversacion();

  // Eventos de toggle
  btnToggle.addEventListener('click', () => {
    const estaVisible = panelChat.style.display !== 'none';
    abrirPanel(!estaVisible);
  });

  btnFlotante.addEventListener('click', () => {
    abrirPanel(true);
    panelChat.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  btnCerrar.addEventListener('click', () => {
    abrirPanel(false);
  });

  btnReiniciar.addEventListener('click', () => {
    if (confirm('¿Deseas reiniciar la conversación con el tutor?')) {
      reiniciarConversacion();
    }
  });

  // Ajuste automático de altura del textarea
  inputText.addEventListener('input', () => {
    inputText.style.height = 'auto';
    inputText.style.height = `${Math.min(inputText.scrollHeight, 120)}px`;
  });

  // Envío con tecla Enter (sin Shift)
  inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formChat.requestSubmit();
    }
  });

  // Enviar mensaje
  async function procesarEnvio(texto) {
    const mensajeLimpio = (texto || '').trim();
    if (!mensajeLimpio || enviando) return;

    enviando = true;
    inputText.value = '';
    inputText.style.height = 'auto';
    inputText.disabled = true;
    btnEnviar.disabled = true;

    // Mostrar mensaje del estudiante
    renderizarMensaje('estudiante', mensajeLimpio);
    historial.push({ rol: 'estudiante', texto: mensajeLimpio });

    // Mostrar indicador animado de pensamiento socrático
    mostrarPensando(true);

    try {
      const respuestaIA = await api.ia('tutor', {
        asignaturaId: asignatura.id,
        mensaje: mensajeLimpio,
        historial: historial.slice(-8)
      });

      mostrarPensando(false);

      const textoRespuesta = respuestaIA?.respuesta || '¿Podrías reformular tu idea para analizarla con mayor precisión?';
      renderizarMensaje('tutor', textoRespuesta);
      historial.push({ rol: 'tutor', texto: textoRespuesta });
    } catch (err) {
      mostrarPensando(false);
      let mensajeError = 'No fue posible obtener una respuesta en este momento. Intenta de nuevo.';
      if (err.estado === 429) {
        mensajeError = err.message || 'Has alcanzado el límite diario de consultas con el tutor. Podrás continuar mañana.';
      } else if (err.message) {
        mensajeError = `Error: ${err.message}`;
      }
      renderizarMensaje('tutor', `⚠️ ${mensajeError}`);
    } finally {
      enviando = false;
      inputText.disabled = false;
      btnEnviar.disabled = false;
      inputText.focus();
      scrollAlFinal();
    }
  }

  formChat.addEventListener('submit', (e) => {
    e.preventDefault();
    procesarEnvio(inputText.value);
  });

  // Sugerencias rápidas (pills)
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      const pregunta = pill.getAttribute('data-pregunta');
      if (pregunta) {
        abrirPanel(true);
        procesarEnvio(pregunta);
      }
    });
  });
}

