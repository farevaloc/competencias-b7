import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Banco de preguntas', roles: ['docente', 'admin'] });

const NOMBRES_NIVELES = {
  1: '1 · Recordar',
  2: '2 · Comprender',
  3: '3 · Aplicar',
  4: '4 · Analizar',
  5: '5 · Evaluar'
};

const TIPOS_TEXTO = {
  opcion: 'Opción múltiple',
  vf: 'Verdadero / Falso',
  completar: 'Completar'
};

let usuario = sesion.usuarioActual();
let temasDisponibles = [];
let temaActualId = null;
let nivelActual = 1;
let todasLasPreguntas = [];

async function iniciar() {
  ui.cargando(true);
  try {
    await cargarTemas();
    if (temasDisponibles.length > 0) {
      const paramTema = util.parametro('temaId');
      const existeParam = temasDisponibles.some(t => t.id === paramTema);
      temaActualId = existeParam ? paramTema : temasDisponibles[0].id;
      await cargarPreguntas();
    } else {
      renderizarSinTemas();
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al inicializar el banco de preguntas', 'error');
  } finally {
    ui.cargando(false);
  }
}

async function cargarTemas() {
  const [asignaturas, unidades, temas, distributivo] = await Promise.all([
    api.listar('asignaturas'),
    api.listar('unidades'),
    api.listar('temas'),
    api.listar('distributivo')
  ]);

  let asignaturasPermitidas = [];
  if (usuario.rol === 'admin') {
    asignaturasPermitidas = asignaturas.map(a => a.id);
  } else {
    const misGrupos = distributivo.filter(d => d.docenteId === usuario.id);
    asignaturasPermitidas = [...new Set(misGrupos.map(g => g.asignaturaId).filter(Boolean))];
  }

  const mapaAsig = new Map(asignaturas.map(a => [a.id, a]));
  const mapaUnid = new Map(unidades.map(u => [u.id, u]));

  temasDisponibles = temas.filter(t => {
    const unidad = mapaUnid.get(t.unidadId);
    return unidad && asignaturasPermitidas.includes(unidad.asignaturaId);
  }).map(t => {
    const unidad = mapaUnid.get(t.unidadId);
    const asig = unidad ? mapaAsig.get(unidad.asignaturaId) : null;
    return {
      ...t,
      nombreAsignatura: asig ? asig.nombre : 'Sin asignatura',
      nombreUnidad: unidad ? unidad.titulo : 'Sin unidad'
    };
  });
}

async function cargarPreguntas() {
  if (!temaActualId) return;
  try {
    todasLasPreguntas = await api.listar('preguntas', { temaId: temaActualId });
    renderizarPrincipal();
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar preguntas', 'error');
  }
}

function renderizarSinTemas() {
  const contenedor = document.getElementById('contenido');
  contenedor.innerHTML = `
    <div class="tarjeta" style="text-align: center; padding: var(--espaciado-2xl);">
      <h2 style="color: var(--primario);">No hay temas asignados</h2>
      <p style="color: var(--texto-suave); margin-top: var(--espaciado-s);">
        No tienes temas disponibles en las asignaturas que tienes asignadas.
      </p>
    </div>
  `;
}

function renderizarPrincipal() {
  const contenedor = document.getElementById('contenido');
  const temaSeleccionado = temasDisponibles.find(t => t.id === temaActualId);

  // Contar preguntas aprobadas por nivel
  const conteoAprobadas = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  todasLasPreguntas.forEach(p => {
    const n = Number(p.nivel);
    if (n >= 1 && n <= 5 && p.estado === 'aprobado') {
      conteoAprobadas[n] = (conteoAprobadas[n] || 0) + 1;
    }
  });

  const aprobadasNivelActual = conteoAprobadas[nivelActual] || 0;
  const preguntasNivel = todasLasPreguntas.filter(p => Number(p.nivel) === nivelActual);
  const totalAprobadas = Object.values(conteoAprobadas).reduce((a, b) => a + b, 0);
  const todosNivelesConPreguntas = [1, 2, 3, 4, 5].every(n => conteoAprobadas[n] > 0);

  contenedor.innerHTML = `
    <header class="banco-cabecera">
      <div class="banco-cabecera__fila">
        <div>
          <h1 class="banco-cabecera__titulo">Gestor de Cuestionarios y Quizzes</h1>
          <p style="margin: 4px 0 0 0; font-size: var(--tamano-s); color: var(--texto-suave);">
            Crea, administra y genera cuestionarios interactivos por niveles de Bloom con Inteligencia Artificial.
          </p>
        </div>
        <div style="display: flex; gap: var(--espaciado-s); flex-wrap: wrap;">
          <a href="/paginas/quiz.html?temaId=${encodeURIComponent(temaActualId)}" class="btn btn--texto" id="btnProbarQuiz" target="_blank" title="Probar el quiz de este tema como estudiante">
            👁️ Probar Quiz
          </a>
          <button type="button" class="btn btn--primario" id="btnCrearQuizIA" title="Crear o completar un quiz con IA para este tema">
            🎯 Crear Quiz con IA
          </button>
          <button type="button" class="btn btn--secundario" id="btnGenerarIA" title="Generar propuestas de preguntas con IA">
            ✨ Propuestas IA
          </button>
          <button type="button" class="btn btn--secundario" id="btnNuevaPregunta" title="Crear una pregunta manual">
            + Manual
          </button>
        </div>
      </div>

      <div class="banco-selector-tema">
        <label for="selectTema">Selecciona el tema a gestionar:</label>
        <select id="selectTema" class="campo__control">
          ${temasDisponibles.map(t => `
            <option value="${t.id}" ${t.id === temaActualId ? 'selected' : ''}>
              ${ui.escapar(t.nombreAsignatura)} → ${ui.escapar(t.titulo)}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- Banner de estado del Quiz para el tema seleccionado -->
      <div class="tarjeta" style="padding: var(--espaciado-m); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espaciado-m); border-left: 4px solid ${todosNivelesConPreguntas ? 'var(--exito)' : 'var(--advertencia)'}; background: var(--superficie);">
        <div>
          <div style="font-weight: var(--peso-negrita); font-size: var(--tamano-m);">
            ${todosNivelesConPreguntas ? '✅ Quiz Activo y Habilitado para Estudiantes' : '⚠️ Quiz Incompleto para Estudiantes'}
          </div>
          <div style="font-size: var(--tamano-xs); color: var(--texto-suave); margin-top: 2px;">
            ${todosNivelesConPreguntas
              ? `Este tema cuenta con ${totalAprobadas} preguntas aprobadas en los 5 niveles cognitivos de Bloom.`
              : `Faltan preguntas en algunos niveles. Usa "Crear Quiz con IA" para habilitar todos los niveles para los estudiantes.`}
          </div>
        </div>
        <div style="display: flex; gap: var(--espaciado-s);">
          <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearQuizBanner">
            ✨ ${todosNivelesConPreguntas ? 'Generar más preguntas' : 'Completar Quiz con IA'}
          </button>
          <a href="/paginas/quiz.html?temaId=${encodeURIComponent(temaActualId)}" class="btn btn--secundario btn--pequeno" target="_blank">
            👁️ Probar Quiz
          </a>
        </div>
      </div>
    </header>

    <!-- Pestañas de niveles cognitivos (Bloom) -->
    <nav class="banco-pestanas" role="tablist" aria-label="Niveles de preguntas">
      ${[1, 2, 3, 4, 5].map(lvl => `
        <button type="button"
          role="tab"
          class="banco-pestana ${lvl === nivelActual ? 'banco-pestana--activa' : ''}"
          aria-selected="${lvl === nivelActual}"
          data-nivel="${lvl}"
          id="tab-nivel-${lvl}">
          ${NOMBRES_NIVELES[lvl]}
          <span class="banco-pestana__contador" title="${conteoAprobadas[lvl]} aprobadas">
            ${conteoAprobadas[lvl]}
          </span>
        </button>
      `).join('')}
    </nav>

    <!-- Aviso si hay pocas preguntas aprobadas en el nivel actual -->
    ${aprobadasNivelActual < 5 ? `
      <div class="banco-aviso-aprobadas" role="status">
        <span style="font-size: var(--tamano-l);" aria-hidden="true">⚠️</span>
        <div>
          <strong>Atención:</strong> Este nivel cuenta con <strong>${aprobadasNivelActual} pregunta(s) aprobada(s)</strong>.
          Se recomienda generar preguntas con IA para que el nivel esté disponible para tus estudiantes.
        </div>
      </div>
    ` : ''}

    <div class="banco-barra-acciones">
      <span style="font-size: var(--tamano-s); color: var(--texto-suave);">
        Mostrando ${preguntasNivel.length} pregunta(s) en ${NOMBRES_NIVELES[nivelActual]} (${aprobadasNivelActual} aprobadas)
      </span>
    </div>

    <!-- Lista de preguntas -->
    <section class="banco-lista" aria-label="Lista de preguntas del nivel actual">
      ${preguntasNivel.length === 0 ? `
        <div class="tarjeta" style="text-align: center; padding: var(--espaciado-xl);">
          <p style="color: var(--texto-suave);">No hay preguntas registradas en ${NOMBRES_NIVELES[nivelActual]}.</p>
          <div style="display: flex; justify-content: center; gap: var(--espaciado-s); margin-top: var(--espaciado-s); flex-wrap: wrap;">
            <button type="button" class="btn btn--primario btn--pequeno" id="btnGenerarNivelDirecto">
              ✨ Generar 5 preguntas para este nivel con IA
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnCrearPrimera">
              + Crear manualmente
            </button>
          </div>
        </div>
      ` : preguntasNivel.map(p => renderizarTarjetaPregunta(p)).join('')}
    </section>
  `;

  // Event Listeners
  document.getElementById('selectTema').addEventListener('change', async (e) => {
    temaActualId = e.target.value;
    ui.cargando(true);
    await cargarPreguntas();
    ui.cargando(false);
  });

  contenedor.querySelectorAll('.banco-pestana').forEach(tab => {
    tab.addEventListener('click', () => {
      nivelActual = Number(tab.dataset.nivel);
      renderizarPrincipal();
    });
  });

  const btnCrearQuizIA = document.getElementById('btnCrearQuizIA');
  if (btnCrearQuizIA) btnCrearQuizIA.addEventListener('click', () => abrirModalCrearQuiz());

  const btnCrearQuizBanner = document.getElementById('btnCrearQuizBanner');
  if (btnCrearQuizBanner) btnCrearQuizBanner.addEventListener('click', () => abrirModalCrearQuiz());

  const btnGenerarNivelDirecto = document.getElementById('btnGenerarNivelDirecto');
  if (btnGenerarNivelDirecto) {
    btnGenerarNivelDirecto.addEventListener('click', () => generarPreguntasNivelDirecto(nivelActual));
  }

  const btnCrear = document.getElementById('btnNuevaPregunta');
  if (btnCrear) btnCrear.addEventListener('click', () => abrirModalEdicion());

  const btnCrearPrimera = document.getElementById('btnCrearPrimera');
  if (btnCrearPrimera) btnCrearPrimera.addEventListener('click', () => abrirModalEdicion());

  const btnIA = document.getElementById('btnGenerarIA');
  if (btnIA) btnIA.addEventListener('click', () => abrirModalGenerarIA());

  // Acciones en tarjetas
  contenedor.querySelectorAll('.btn-editar-pregunta').forEach(btn => {
    btn.addEventListener('click', () => {
      const pregId = btn.dataset.id;
      const preg = todasLasPreguntas.find(p => p.id === pregId);
      if (preg) abrirModalEdicion(preg);
    });
  });

  contenedor.querySelectorAll('.btn-eliminar-pregunta').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pregId = btn.dataset.id;
      const ok = await ui.confirmar('¿Estás seguro de que deseas eliminar esta pregunta?');
      if (!ok) return;
      ui.cargando(true);
      try {
        await api.eliminar('preguntas', pregId);
        ui.aviso('Pregunta eliminada con éxito', 'exito');
        await cargarPreguntas();
      } catch (err) {
        ui.aviso(err.message || 'Error al eliminar', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });

  contenedor.querySelectorAll('.btn-alternar-estado').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pregId = btn.dataset.id;
      const preg = todasLasPreguntas.find(p => p.id === pregId);
      if (!preg) return;
      const nuevoEstado = preg.estado === 'aprobado' ? 'borrador' : 'aprobado';
      ui.cargando(true);
      try {
        await api.actualizar('preguntas', preg.id, { estado: nuevoEstado });
        ui.aviso(`Pregunta marcada como ${nuevoEstado}`, 'exito');
        await cargarPreguntas();
      } catch (err) {
        ui.aviso(err.message || 'Error al cambiar estado', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  });
}

function renderizarTarjetaPregunta(p) {
  const tipoClase = `etiqueta-badge--${p.tipo}`;
  const estadoClase = p.estado === 'aprobado' ? 'etiqueta-badge--aprobado' : 'etiqueta-badge--borrador';

  let opcionesHtml = '';
  if (p.tipo === 'opcion' && Array.isArray(p.opciones)) {
    opcionesHtml = `
      <ul class="tarjeta-pregunta__opciones">
        ${p.opciones.map((opc, i) => `
          <li class="tarjeta-pregunta__opcion ${i === Number(p.correcta) ? 'tarjeta-pregunta__opcion--correcta' : ''}">
            ${i === Number(p.correcta) ? '✓' : '○'} <span>${ui.escapar(opc)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } else if (p.tipo === 'vf') {
    opcionesHtml = `
      <div style="font-size: var(--tamano-s); margin-top: var(--espaciado-xs);">
        Respuesta correcta: <strong style="color: var(--exito);">${p.correcta === true ? 'Verdadero' : 'Falso'}</strong>
      </div>
    `;
  } else if (p.tipo === 'completar') {
    opcionesHtml = `
      <div style="font-size: var(--tamano-s); margin-top: var(--espaciado-xs);">
        Respuesta para completar: <strong style="color: var(--primario);">${ui.escapar(String(p.correcta || ''))}</strong>
      </div>
    `;
  }

  return `
    <article class="tarjeta-pregunta" id="pregunta-${p.id}">
      <div class="tarjeta-pregunta__meta">
        <span class="etiqueta-badge ${tipoClase}">${TIPOS_TEXTO[p.tipo] || p.tipo}</span>
        <span class="etiqueta-badge ${estadoClase}">${p.estado === 'aprobado' ? 'Aprobada' : 'Borrador'}</span>
        <span class="etiqueta-badge etiqueta-badge--origen">${p.origen === 'ia' ? '✨ Generada por IA' : '👤 Docente'}</span>
      </div>

      <p class="tarjeta-pregunta__enunciado">${ui.escapar(p.enunciado)}</p>

      ${opcionesHtml}

      ${p.retroalimentacion ? `
        <div class="tarjeta-pregunta__retro">
          <strong>Retroalimentación:</strong> ${ui.escapar(p.retroalimentacion)}
        </div>
      ` : ''}

      <div class="tarjeta-pregunta__pie">
        <button type="button" class="btn btn--texto btn--pequeno btn-alternar-estado" data-id="${p.id}">
          ${p.estado === 'aprobado' ? 'Pasar a borrador' : 'Aprobar'}
        </button>
        <button type="button" class="btn btn--secundario btn--pequeno btn-editar-pregunta" data-id="${p.id}">
          Editar
        </button>
        <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-pregunta" data-id="${p.id}" title="Eliminar pregunta">
          Eliminar
        </button>
      </div>
    </article>
  `;
}

/**
 * Modal para creación manual o edición de preguntas
 */
function abrirModalEdicion(pregunta = null) {
  const esEdicion = Boolean(pregunta && pregunta.id);
  const datos = pregunta || {
    tipo: 'opcion',
    enunciado: '',
    opciones: ['', '', '', ''],
    correcta: 0,
    retroalimentacion: '',
    estado: 'aprobado'
  };

  const formEl = document.createElement('form');
  formEl.className = 'form-pregunta';

  function renderizarCampos() {
    const tipo = datos.tipo;
    let opcionesControl = '';

    if (tipo === 'opcion') {
      const opciones = Array.isArray(datos.opciones) && datos.opciones.length >= 2
        ? datos.opciones
        : ['', '', '', ''];
      datos.opciones = opciones;

      opcionesControl = `
        <div class="campo">
          <label>Opciones y marcar la correcta (radio):</label>
          <div class="form-pregunta__opciones-lista" id="listaOpcionesModal">
            ${opciones.map((opc, idx) => `
              <div class="form-pregunta__opcion-item">
                <input type="radio" name="modalCorrecta" value="${idx}" id="radioOpc_${idx}" ${idx === Number(datos.correcta) ? 'checked' : ''} aria-label="Marcar como correcta opción ${idx + 1}">
                <input type="text" class="campo__control input-opcion-texto" data-idx="${idx}" value="${ui.escapar(opc)}" placeholder="Opción ${idx + 1}" required>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (tipo === 'vf') {
      opcionesControl = `
        <div class="campo">
          <label>Respuesta correcta:</label>
          <div style="display: flex; gap: var(--espaciado-m); margin-top: var(--espaciado-xs);">
            <label style="display: flex; align-items: center; gap: var(--espaciado-xs); cursor: pointer;">
              <input type="radio" name="modalVF" value="true" ${datos.correcta === true ? 'checked' : ''}> Verdadero
            </label>
            <label style="display: flex; align-items: center; gap: var(--espaciado-xs); cursor: pointer;">
              <input type="radio" name="modalVF" value="false" ${datos.correcta === false ? 'checked' : ''}> Falso
            </label>
          </div>
        </div>
      `;
    } else if (tipo === 'completar') {
      opcionesControl = `
        <div class="campo">
          <label for="txtModalCorrecta">Palabra o frase corta que completa el enunciado:</label>
          <input type="text" id="txtModalCorrecta" class="campo__control" value="${ui.escapar(String(datos.correcta || ''))}" placeholder="Ejemplo: fotosíntesis" required>
          <small style="color: var(--texto-suave);">Nota: En el enunciado, indica con "____" el espacio a completar.</small>
        </div>
      `;
    }

    formEl.innerHTML = `
      <div class="campo">
        <label for="modalSelectTipo">Tipo de pregunta:</label>
        <select id="modalSelectTipo" class="campo__control">
          <option value="opcion" ${tipo === 'opcion' ? 'selected' : ''}>Opción múltiple</option>
          <option value="vf" ${tipo === 'vf' ? 'selected' : ''}>Verdadero / Falso</option>
          <option value="completar" ${tipo === 'completar' ? 'selected' : ''}>Completar</option>
        </select>
      </div>

      <div class="campo">
        <label for="txtModalEnunciado">Enunciado de la pregunta:</label>
        <textarea id="txtModalEnunciado" class="campo__control" rows="3" required placeholder="Escribe la pregunta o enunciado...">${ui.escapar(datos.enunciado || '')}</textarea>
      </div>

      <div id="bloqueOpcionesDinamico">
        ${opcionesControl}
      </div>

      <div class="campo">
        <label for="txtModalRetro">Retroalimentación / Justificación:</label>
        <textarea id="txtModalRetro" class="campo__control" rows="2" placeholder="Explica por qué es la respuesta correcta...">${ui.escapar(datos.retroalimentacion || '')}</textarea>
      </div>

      <div class="campo">
        <label for="modalSelectEstado">Estado:</label>
        <select id="modalSelectEstado" class="campo__control">
          <option value="aprobado" ${datos.estado === 'aprobado' ? 'selected' : ''}>Aprobado (disponible para quiz)</option>
          <option value="borrador" ${datos.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
        </select>
      </div>
    `;

    // Vincular cambio de tipo
    formEl.querySelector('#modalSelectTipo').addEventListener('change', (e) => {
      datos.tipo = e.target.value;
      if (datos.tipo === 'vf') datos.correcta = true;
      if (datos.tipo === 'completar') datos.correcta = '';
      if (datos.tipo === 'opcion') datos.correcta = 0;
      renderizarCampos();
    });

    // Guardar valores en datos conforme se escriben
    const txtEnun = formEl.querySelector('#txtModalEnunciado');
    if (txtEnun) txtEnun.addEventListener('input', (e) => { datos.enunciado = e.target.value; });

    const txtRet = formEl.querySelector('#txtModalRetro');
    if (txtRet) txtRet.addEventListener('input', (e) => { datos.retroalimentacion = e.target.value; });

    const selEst = formEl.querySelector('#modalSelectEstado');
    if (selEst) selEst.addEventListener('change', (e) => { datos.estado = e.target.value; });

    if (tipo === 'opcion') {
      formEl.querySelectorAll('.input-opcion-texto').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = Number(e.target.dataset.idx);
          datos.opciones[idx] = e.target.value;
        });
      });
      formEl.querySelectorAll('input[name="modalCorrecta"]').forEach(r => {
        r.addEventListener('change', (e) => {
          datos.correcta = Number(e.target.value);
        });
      });
    } else if (tipo === 'vf') {
      formEl.querySelectorAll('input[name="modalVF"]').forEach(r => {
        r.addEventListener('change', (e) => {
          datos.correcta = e.target.value === 'true';
        });
      });
    } else if (tipo === 'completar') {
      const txtCorr = formEl.querySelector('#txtModalCorrecta');
      if (txtCorr) txtCorr.addEventListener('input', (e) => {
        datos.correcta = e.target.value;
      });
    }
  }

  renderizarCampos();

  ui.modal({
    titulo: esEdicion ? 'Editar pregunta' : `Nueva pregunta (Nivel ${nivelActual})`,
    contenido: formEl,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: esEdicion ? 'Guardar cambios' : 'Guardar pregunta', valor: 'guardar', clase: 'btn--primario', principal: true }
    ]
  }).then(async (accion) => {
    if (accion !== 'guardar') return;

    if (!datos.enunciado || !datos.enunciado.trim()) {
      ui.aviso('El enunciado es obligatorio', 'advertencia');
      return;
    }

    if (datos.tipo === 'opcion') {
      if (!Array.isArray(datos.opciones) || datos.opciones.some(o => !o.trim())) {
        ui.aviso('Todas las opciones de la pregunta deben tener texto', 'advertencia');
        return;
      }
    } else if (datos.tipo === 'completar') {
      if (!datos.correcta || !String(datos.correcta).trim()) {
        ui.aviso('La respuesta para completar no puede estar vacía', 'advertencia');
        return;
      }
    }

    const payload = {
      temaId: temaActualId,
      nivel: nivelActual,
      tipo: datos.tipo,
      enunciado: datos.enunciado.trim(),
      opciones: datos.tipo === 'opcion' ? datos.opciones.map(o => o.trim()) : (datos.tipo === 'vf' ? ['Verdadero', 'Falso'] : []),
      correcta: datos.correcta,
      retroalimentacion: (datos.retroalimentacion || '').trim(),
      estado: datos.estado || 'aprobado',
      origen: datos.origen || 'docente'
    };

    ui.cargando(true);
    try {
      if (esEdicion) {
        await api.actualizar('preguntas', pregunta.id, payload);
        ui.aviso('Pregunta actualizada con éxito', 'exito');
      } else {
        await api.crear('preguntas', payload);
        ui.aviso('Pregunta creada con éxito', 'exito');
      }
      await cargarPreguntas();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la pregunta', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

/**
 * Crea o completa un Quiz interactivo con IA
 */
function abrirModalCrearQuiz() {
  const formEl = document.createElement('div');
  formEl.className = 'form-pregunta';
  formEl.innerHTML = `
    <p style="color: var(--texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espaciado-m);">
      Esta función genera automáticamente preguntas pedagógicas alineadas con la Taxonomía de Bloom utilizando Inteligencia Artificial. Las preguntas quedarán <strong>aprobadas</strong> y el Quiz estará disponible inmediatamente para los estudiantes.
    </p>

    <div class="campo">
      <label for="modalSelectModoQuiz">Modo de creación del Quiz:</label>
      <select id="modalSelectModoQuiz" class="campo__control">
        <option value="completo">🎯 Quiz completo (generar 5 preguntas para cada uno de los 5 niveles de Bloom: 25 preguntas)</option>
        <option value="faltantes">⚡ Completar únicamente los niveles que no tienen preguntas</option>
        <option value="nivel">✨ Generar preguntas solo para el nivel activo (${NOMBRES_NIVELES[nivelActual]})</option>
      </select>
    </div>

    <div class="campo" id="campoCantidadQuiz" style="display: none;">
      <label for="modalInputCantidadQuiz">Preguntas a generar (5 a 15):</label>
      <input type="number" id="modalInputCantidadQuiz" class="campo__control" min="5" max="15" value="5">
    </div>

    <div class="campo">
      <label style="display: flex; align-items: center; gap: var(--espaciado-xs); cursor: pointer;">
        <input type="checkbox" id="chkPublicarTema" checked>
        Asegurar que el tema esté publicado para que los estudiantes puedan acceder al Quiz
      </label>
    </div>
  `;

  const selModo = formEl.querySelector('#modalSelectModoQuiz');
  const campoCant = formEl.querySelector('#campoCantidadQuiz');
  selModo.addEventListener('change', (e) => {
    campoCant.style.display = e.target.value === 'nivel' ? 'block' : 'none';
  });

  ui.modal({
    titulo: '🎯 Crear Cuestionario / Quiz con IA',
    contenido: formEl,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: '✨ Generar y Habilitar Quiz', valor: 'generar', clase: 'btn--primario', principal: true }
    ]
  }).then(async (accion) => {
    if (accion !== 'generar') return;

    const modo = selModo.value;
    const cantidad = Number(formEl.querySelector('#modalInputCantidadQuiz').value) || 5;
    const debePublicar = formEl.querySelector('#chkPublicarTema').checked;

    ui.cargando(true);
    try {
      // Contar preguntas aprobadas actuales
      const conteo = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      todasLasPreguntas.forEach(p => {
        const n = Number(p.nivel);
        if (n >= 1 && n <= 5 && p.estado === 'aprobado') {
          conteo[n] = (conteo[n] || 0) + 1;
        }
      });

      let nivelesATratar = [];
      if (modo === 'completo') {
        nivelesATratar = [1, 2, 3, 4, 5];
      } else if (modo === 'faltantes') {
        nivelesATratar = [1, 2, 3, 4, 5].filter(lvl => (conteo[lvl] || 0) === 0);
        if (nivelesATratar.length === 0) {
          ui.aviso('Todos los niveles ya cuentan con preguntas aprobadas.', 'info');
          return;
        }
      } else {
        nivelesATratar = [nivelActual];
      }

      // Si se marcó asegurar publicación, actualizar el tema si estaba en borrador
      if (debePublicar && temaActualId) {
        try {
          const temaObj = await api.obtener('temas', temaActualId);
          if (temaObj && temaObj.estado !== 'publicado') {
            await api.actualizar('temas', temaActualId, { estado: 'publicado' });
          }
        } catch (_) {
          // Ignorar si no se puede actualizar tema
        }
      }

      let totalCreadas = 0;
      for (const lvl of nivelesATratar) {
        const cant = modo === 'nivel' ? cantidad : 5;
        try {
          const propuestas = await api.ia('generar-preguntas', {
            temaId: temaActualId,
            nivel: lvl,
            cantidad: cant
          });

          if (Array.isArray(propuestas) && propuestas.length > 0) {
            for (const prop of propuestas) {
              await api.crear('preguntas', {
                tipo: prop.tipo,
                enunciado: prop.enunciado,
                opciones: prop.opciones || (prop.tipo === 'vf' ? ['Verdadero', 'Falso'] : []),
                correcta: prop.correcta,
                retroalimentacion: prop.retroalimentacion || '',
                temaId: temaActualId,
                nivel: lvl,
                origen: 'ia',
                estado: 'aprobado'
              });
              totalCreadas++;
            }
          }
        } catch (subErr) {
          console.warn(`Error en nivel ${lvl}:`, subErr);
        }
      }

      ui.aviso(`¡Quiz creado exitosamente! Se agregaron ${totalCreadas} preguntas aprobadas. El cuestionario está disponible para los estudiantes.`, 'exito');
      await cargarPreguntas();
    } catch (err) {
      ui.aviso(err.message || 'Error al crear el quiz con IA', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

/**
 * Genera 5 preguntas directamente con IA para un nivel específico
 */
async function generarPreguntasNivelDirecto(nivel) {
  ui.cargando(true);
  try {
    const propuestas = await api.ia('generar-preguntas', {
      temaId: temaActualId,
      nivel: Number(nivel),
      cantidad: 5
    });

    if (Array.isArray(propuestas) && propuestas.length > 0) {
      for (const prop of propuestas) {
        await api.crear('preguntas', {
          tipo: prop.tipo,
          enunciado: prop.enunciado,
          opciones: prop.opciones || (prop.tipo === 'vf' ? ['Verdadero', 'Falso'] : []),
          correcta: prop.correcta,
          retroalimentacion: prop.retroalimentacion || '',
          temaId: temaActualId,
          nivel: Number(nivel),
          origen: 'ia',
          estado: 'aprobado'
        });
      }
      ui.aviso(`Se generaron y aprobaron ${propuestas.length} preguntas para ${NOMBRES_NIVELES[nivel]}`, 'exito');
      await cargarPreguntas();
    } else {
      ui.aviso('No se recibieron preguntas del servicio de IA', 'advertencia');
    }
  } catch (err) {
    ui.aviso(err.message || 'Error al generar preguntas', 'error');
  } finally {
    ui.cargando(false);
  }
}

/**
 * Modal para generar preguntas con IA
 */
function abrirModalGenerarIA() {
  const formEl = document.createElement('div');
  formEl.className = 'form-pregunta';
  formEl.innerHTML = `
    <p style="color: var(--texto-suave); font-size: var(--tamano-s); margin-bottom: var(--espaciado-s);">
      La inteligencia artificial analizará el contenido del tema y su glosario para generar propuestas pedagógicas alineadas con la taxonomía de Bloom.
    </p>

    <div class="campo">
      <label for="selectNivelIA">Nivel cognitivo a generar:</label>
      <select id="selectNivelIA" class="campo__control">
        ${[1, 2, 3, 4, 5].map(lvl => `
          <option value="${lvl}" ${lvl === nivelActual ? 'selected' : ''}>
            ${NOMBRES_NIVELES[lvl]}
          </option>
        `).join('')}
      </select>
    </div>

    <div class="campo">
      <label for="inputCantidadIA">Cantidad de preguntas a generar (5 a 15):</label>
      <input type="number" id="inputCantidadIA" class="campo__control" min="5" max="15" value="5">
    </div>
  `;

  ui.modal({
    titulo: 'Generar preguntas con IA',
    contenido: formEl,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Generar propuestas', valor: 'generar', clase: 'btn--primario', principal: true }
    ]
  }).then(async (accion) => {
    if (accion !== 'generar') return;

    const nivelGen = Number(formEl.querySelector('#selectNivelIA').value);
    const cantidadGen = Number(formEl.querySelector('#inputCantidadIA').value) || 5;

    ui.cargando(true);
    try {
      const propuestas = await api.ia('generar-preguntas', {
        temaId: temaActualId,
        nivel: nivelGen,
        cantidad: cantidadGen
      });

      if (!Array.isArray(propuestas) || propuestas.length === 0) {
        ui.aviso('No se recibieron propuestas de preguntas', 'advertencia');
        return;
      }

      abrirPanelPropuestasIA(propuestas, nivelGen);
    } catch (err) {
      ui.aviso(err.message || 'Error al generar preguntas con IA', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

/**
 * Panel para revisar propuestas generadas: aprobar, editar o descartar
 */
function abrirPanelPropuestasIA(propuestasOriginales, nivelGen) {
  let lista = [...propuestasOriginales];

  const panelContenedor = document.createElement('div');
  panelContenedor.style.maxHeight = '70vh';
  panelContenedor.style.overflowY = 'auto';
  panelContenedor.style.padding = 'var(--espaciado-xs)';

  function renderizarPropuestas() {
    if (lista.length === 0) {
      panelContenedor.innerHTML = `
        <div style="text-align: center; padding: var(--espaciado-l);">
          <p style="color: var(--texto-suave);">Has revisado todas las propuestas generadas.</p>
        </div>
      `;
      return;
    }

    panelContenedor.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-m);">
        <span style="font-size: var(--tamano-s); color: var(--texto-suave);">
          ${lista.length} propuesta(s) pendiente(s) de revisión para ${NOMBRES_NIVELES[nivelGen]}
        </span>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnAprobarTodas">
          ✓ Aprobar todas
        </button>
      </div>

      <div class="propuestas-lista">
        ${lista.map((prop, idx) => `
          <div class="propuesta-tarjeta" data-idx="${idx}">
            <div style="display: flex; gap: var(--espaciado-xs); align-items: center; margin-bottom: var(--espaciado-xs);">
              <span class="etiqueta-badge etiqueta-badge--${prop.tipo}">${TIPOS_TEXTO[prop.tipo] || prop.tipo}</span>
              <span class="etiqueta-badge etiqueta-badge--origen">Propuesta #${idx + 1}</span>
            </div>

            <p style="font-weight: var(--peso-seminegrita); margin-bottom: var(--espaciado-xs);">
              ${ui.escapar(prop.enunciado)}
            </p>

            ${prop.tipo === 'opcion' && Array.isArray(prop.opciones) ? `
              <ul style="padding-left: var(--espaciado-m); margin-bottom: var(--espaciado-xs); font-size: var(--tamano-s);">
                ${prop.opciones.map((o, i) => `
                  <li style="${i === Number(prop.correcta) ? 'color: var(--exito); font-weight: bold;' : ''}">
                    ${i === Number(prop.correcta) ? '✓ ' : ''}${ui.escapar(o)}
                  </li>
                `).join('')}
              </ul>
            ` : ''}

            ${prop.tipo === 'vf' ? `
              <p style="font-size: var(--tamano-s); color: var(--exito); margin-bottom: var(--espaciado-xs);">
                Respuesta: <strong>${prop.correcta ? 'Verdadero' : 'Falso'}</strong>
              </p>
            ` : ''}

            ${prop.tipo === 'completar' ? `
              <p style="font-size: var(--tamano-s); color: var(--primario); margin-bottom: var(--espaciado-xs);">
                Completa: <strong>${ui.escapar(String(prop.correcta))}</strong>
              </p>
            ` : ''}

            ${prop.retroalimentacion ? `
              <p style="font-size: var(--tamano-xs); color: var(--texto-suave); font-style: italic;">
                Retroalimentación: ${ui.escapar(prop.retroalimentacion)}
              </p>
            ` : ''}

            <div class="propuesta-tarjeta__acciones">
              <button type="button" class="btn btn--texto btn--pequeno btn-descartar-propuesta" data-idx="${idx}">
                Descartar
              </button>
              <button type="button" class="btn btn--secundario btn--pequeno btn-editar-propuesta" data-idx="${idx}">
                Editar antes de aprobar
              </button>
              <button type="button" class="btn btn--primario btn--pequeno btn-aprobar-propuesta" data-idx="${idx}">
                ✓ Aprobar
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Vincular botones
    const btnTodas = panelContenedor.querySelector('#btnAprobarTodas');
    if (btnTodas) {
      btnTodas.addEventListener('click', async () => {
        ui.cargando(true);
        try {
          for (const prop of lista) {
            await api.crear('preguntas', {
              ...prop,
              temaId: temaActualId,
              nivel: nivelGen,
              origen: 'ia',
              estado: 'aprobado'
            });
          }
          ui.aviso(`Se aprobaron y guardaron ${lista.length} preguntas`, 'exito');
          lista = [];
          renderizarPropuestas();
          await cargarPreguntas();
        } catch (err) {
          ui.aviso(err.message || 'Error al guardar preguntas', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    }

    panelContenedor.querySelectorAll('.btn-aprobar-propuesta').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.idx);
        const prop = lista[idx];
        if (!prop) return;

        ui.cargando(true);
        try {
          await api.crear('preguntas', {
            ...prop,
            temaId: temaActualId,
            nivel: nivelGen,
            origen: 'ia',
            estado: 'aprobado'
          });
          ui.aviso('Pregunta aprobada y guardada con éxito', 'exito');
          lista.splice(idx, 1);
          renderizarPropuestas();
          await cargarPreguntas();
        } catch (err) {
          ui.aviso(err.message || 'Error al guardar pregunta', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });

    panelContenedor.querySelectorAll('.btn-descartar-propuesta').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        lista.splice(idx, 1);
        renderizarPropuestas();
      });
    });

    panelContenedor.querySelectorAll('.btn-editar-propuesta').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const prop = lista[idx];
        if (!prop) return;
        abrirModalEdicion({
          ...prop,
          origen: 'ia',
          estado: 'aprobado'
        });
      });
    });
  }

  renderizarPropuestas();

  ui.modal({
    titulo: 'Propuestas generadas por IA',
    contenido: panelContenedor,
    acciones: [
      { texto: 'Cerrar', valor: null, clase: 'btn--secundario' }
    ]
  });
}

iniciar();
