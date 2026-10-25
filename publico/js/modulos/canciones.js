import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Canciones educativas', roles: ['sesion'] });

const paramTemaId = util.parametro('temaId');
const contenedor = document.getElementById('contenido');

let todasCanciones = [];
let todosTemas = [];
let todasUnidades = [];
let todasAsignaturas = [];

let mapaTemas = new Map();
let mapaUnidades = new Map();
let mapaAsignaturas = new Map();

let filtroAsignatura = '';
let filtroTema = paramTemaId || '';
let cancionSeleccionada = null;
let lineasLrcParsed = [];
let lineaActivaIndex = -1;

cargarDatos();

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [cancionesData, temasData, unidadesData, asignaturasData] = await Promise.all([
      api.listar('canciones'),
      api.listar('temas'),
      api.listar('unidades'),
      api.listar('asignaturas')
    ]);

    todasCanciones = cancionesData || [];
    todosTemas = temasData || [];
    todasUnidades = unidadesData || [];
    todasAsignaturas = asignaturasData || [];

    mapaTemas = new Map(todosTemas.map(t => [t.id, t]));
    mapaUnidades = new Map(todasUnidades.map(u => [u.id, u]));
    mapaAsignaturas = new Map(todasAsignaturas.map(a => [a.id, a]));

    // Si viene temaId, resolver su asignatura para fijar el filtro
    if (paramTemaId && mapaTemas.has(paramTemaId)) {
      const temaObj = mapaTemas.get(paramTemaId);
      const unidadObj = mapaUnidades.get(temaObj.unidadId);
      if (unidadObj && unidadObj.asignaturaId) {
        filtroAsignatura = unidadObj.asignaturaId;
      }
    }

    renderizarVista();
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar canciones: ${ui.escapar(err.message)}
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

function renderizarVista() {
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'admin' || usuario.rol === 'docente');

  contenedor.innerHTML = `
    <section class="canciones-seccion">
      <header class="canciones-cabecera">
        <div>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">
            Canciones educativas
          </h1>
          <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin-top: var(--espaciado-xs);">
            Aprende conceptos clave con música, ritmo y letras sincronizadas.
          </p>
        </div>

        ${puedeEditar ? `
          <a href="/paginas/editor-cancion.html" class="btn btn--primario">
            + Nueva canción
          </a>
        ` : ''}
      </header>

      <!-- Filtros -->
      <div class="canciones-filtros">
        <div class="campo" style="margin-bottom: 0; min-width: 220px;">
          <label for="selFiltroAsignatura" style="font-size: var(--tamano-xs);">Asignatura</label>
          <select id="selFiltroAsignatura">
            <option value="">Todas las asignaturas</option>
            ${todasAsignaturas.map(a => `
              <option value="${ui.escapar(a.id)}" ${filtroAsignatura === a.id ? 'selected' : ''}>
                ${ui.escapar(a.nombre)}
              </option>
            `).join('')}
          </select>
        </div>

        <div class="campo" style="margin-bottom: 0; min-width: 240px;">
          <label for="selFiltroTema" style="font-size: var(--tamano-xs);">Tema</label>
          <select id="selFiltroTema">
            <option value="">Todos los temas</option>
          </select>
        </div>
      </div>

      <!-- Contenedor Principal: Lista y Reproductor -->
      <div class="canciones-contenedor-grid">
        <!-- Columna 1: Lista de Canciones -->
        <div class="pila" style="gap: var(--espaciado-m);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin: 0;">
              Lista de reproducción
            </h2>
            <span id="lblTotalCanciones" class="chip">0 canciones</span>
          </div>

          <div id="contenedorListaCanciones" class="canciones-lista"></div>
        </div>

        <!-- Columna 2: Reproductor y Letras -->
        <div class="pila" style="gap: var(--espaciado-m);">
          <div class="reproductor-panel" id="panelReproductor">
            <div id="contenidoReproductor">
              <div class="vacio" style="border: none; padding: var(--espaciado-xl) var(--espaciado-m);">
                <div class="vacio__icono">🎵</div>
                <h3 class="vacio__titulo">Selecciona una canción</h3>
                <p class="vacio__texto">Haz clic en cualquier canción de la lista para iniciar la reproducción y visualizar su letra sincronizada.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Elemento de audio nativo oculto -->
      <audio id="audioElemento" preload="metadata"></audio>
    </section>
  `;

  asociarFiltros();
  actualizarOpcionesTemas();
  actualizarListaCanciones();
}

function asociarFiltros() {
  const selAsig = document.getElementById('selFiltroAsignatura');
  const selTema = document.getElementById('selFiltroTema');

  selAsig.addEventListener('change', (e) => {
    filtroAsignatura = e.target.value;
    filtroTema = ''; // resetear tema al cambiar asignatura
    actualizarOpcionesTemas();
    actualizarListaCanciones();
  });

  selTema.addEventListener('change', (e) => {
    filtroTema = e.target.value;
    actualizarListaCanciones();
  });
}

function actualizarOpcionesTemas() {
  const selTema = document.getElementById('selFiltroTema');
  if (!selTema) return;

  let temasFiltrados = todosTemas;
  if (filtroAsignatura) {
    const unidadesDeAsig = new Set(
      todasUnidades.filter(u => u.asignaturaId === filtroAsignatura).map(u => u.id)
    );
    temasFiltrados = todosTemas.filter(t => unidadesDeAsig.has(t.unidadId));
  }

  selTema.innerHTML = `
    <option value="">Todos los temas</option>
    ${temasFiltrados.map(t => `
      <option value="${ui.escapar(t.id)}" ${filtroTema === t.id ? 'selected' : ''}>
        ${ui.escapar(t.titulo)}
      </option>
    `).join('')}
  `;
}

function actualizarListaCanciones() {
  const contenedorLista = document.getElementById('contenedorListaCanciones');
  const lblTotal = document.getElementById('lblTotalCanciones');
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'admin' || usuario.rol === 'docente');

  // Filtrar canciones
  let cancionesFiltradas = todasCanciones.filter(c => {
    if (filtroTema && c.temaId !== filtroTema) return false;

    if (filtroAsignatura) {
      const tema = mapaTemas.get(c.temaId);
      if (!tema) return false;
      const unidad = mapaUnidades.get(tema.unidadId);
      if (!unidad || unidad.asignaturaId !== filtroAsignatura) return false;
    }

    return true;
  });

  lblTotal.textContent = `${cancionesFiltradas.length} ${cancionesFiltradas.length === 1 ? 'canción' : 'canciones'}`;

  if (cancionesFiltradas.length === 0) {
    contenedorLista.innerHTML = `
      <div class="vacio">
        <div class="vacio__icono">🎧</div>
        <h3 class="vacio__titulo">No hay canciones disponibles</h3>
        <p class="vacio__texto">No se encontraron canciones educativas con los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  contenedorLista.innerHTML = cancionesFiltradas.map(c => {
    const tema = mapaTemas.get(c.temaId);
    const esActiva = cancionSeleccionada && cancionSeleccionada.id === c.id;

    return `
      <div class="cancion-item ${esActiva ? 'cancion-item--activa' : ''}" data-id="${ui.escapar(c.id)}">
        <div class="cancion-item__icono">
          ${esActiva ? '▶' : '🎵'}
        </div>

        <div class="cancion-item__info">
          <h3 class="cancion-item__titulo">${ui.escapar(c.titulo)}</h3>
          <div class="cancion-item__meta">
            ${tema ? `<span>Tema: ${ui.escapar(tema.titulo)}</span>` : ''}
            <span>• ${ui.escapar(c.autoria || 'Autoría registrada')}</span>
            <span class="chip" style="font-size: 10px;">${ui.escapar(c.licencia || 'Propia')}</span>
            ${c.lrc ? `<span class="chip" style="background-color: var(--superficie-suave); font-size: 10px;">LRC sincronizado</span>` : ''}
          </div>
        </div>

        ${puedeEditar ? `
          <a href="/paginas/editor-cancion.html?id=${encodeURIComponent(c.id)}" class="btn btn--secundario btn--pequeno btn-editar-cancion" data-id="${ui.escapar(c.id)}" style="flex-shrink: 0;" title="Editar canción">
            Editar
          </a>
        ` : ''}
      </div>
    `;
  }).join('');

  // Asociar evento de clic a las canciones
  contenedorLista.querySelectorAll('.cancion-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Evitar que el clic en el botón de editar abra el reproductor
      if (e.target.closest('.btn-editar-cancion')) return;

      const id = item.getAttribute('data-id');
      const elegida = todasCanciones.find(c => c.id === id);
      if (elegida) {
        seleccionarCancion(elegida);
      }
    });
  });

  // Si no hay canción seleccionada y hay canciones en la lista, seleccionar la primera automáticamente
  if (!cancionSeleccionada && cancionesFiltradas.length > 0) {
    seleccionarCancion(cancionesFiltradas[0], false);
  }
}

function parsearLRC(lrcTexto) {
  if (!lrcTexto) return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const match = l.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const seg = parseInt(match[2], 10);
      const cent = match[3] ? parseFloat('0.' + match[3]) : 0;
      const tiempo = min * 60 + seg + cent;
      const texto = match[4].trim();
      if (texto) {
        resultado.push({ tiempo, texto, index: resultado.length });
      }
    }
  }

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

function formatearSegundos(segundosTotales) {
  if (isNaN(segundosTotales) || segundosTotales < 0) return '00:00';
  const mins = Math.floor(segundosTotales / 60);
  const segs = Math.floor(segundosTotales % 60);
  return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
}

function seleccionarCancion(cancion, reproducirInmediato = true) {
  cancionSeleccionada = cancion;
  lineasLrcParsed = parsearLRC(cancion.lrc || '');
  lineaActivaIndex = -1;

  // Actualizar clase activa en la lista
  document.querySelectorAll('.cancion-item').forEach(el => {
    const id = el.getAttribute('data-id');
    const esActiva = id === cancion.id;
    el.classList.toggle('cancion-item--activa', esActiva);
    const icono = el.querySelector('.cancion-item__icono');
    if (icono) icono.textContent = esActiva ? '▶' : '🎵';
  });

  montarReproductor(cancion, reproducirInmediato);
}

function montarReproductor(cancion, reproducirInmediato) {
  const panel = document.getElementById('contenidoReproductor');
  const audio = document.getElementById('audioElemento');
  const tema = mapaTemas.get(cancion.temaId);

  // Renderizar panel de letra
  let letrasHtml = '';
  if (lineasLrcParsed.length > 0) {
    letrasHtml = `
      <div class="panel-letras" id="panelLetrasLrc">
        ${lineasLrcParsed.map((l, idx) => `
          <div class="linea-lrc" data-idx="${idx}" data-tiempo="${l.tiempo}">
            ${ui.escapar(l.texto)}
          </div>
        `).join('')}
      </div>
    `;
  } else if (cancion.letra && cancion.letra.trim()) {
    letrasHtml = `
      <div class="panel-letras">
        <pre class="letra-plana">${ui.escapar(cancion.letra)}</pre>
      </div>
    `;
  } else {
    letrasHtml = `
      <div class="panel-letras" style="display: flex; align-items: center; justify-content: center; color: var(--texto-suave);">
        <em>Esta canción no dispone de letra registrada.</em>
      </div>
    `;
  }

  panel.innerHTML = `
    <!-- Cabecera de la canción en reproducción -->
    <div class="reproductor-cabecera">
      <h2 class="reproductor-titulo">${ui.escapar(cancion.titulo)}</h2>
      <div class="reproductor-meta">
        ${tema ? `<span>Tema: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="enlace">${ui.escapar(tema.titulo)}</a></span>` : ''}
        <span>• Autoría: <strong>${ui.escapar(cancion.autoria || 'No especificada')}</strong></span>
        <span class="chip">${ui.escapar(cancion.licencia || 'Propia')}</span>
      </div>
    </div>

    <!-- Controles personalizados del reproductor -->
    <div class="pila" style="gap: var(--espaciado-m);">
      <div class="reproductor-controles-fila">
        <button type="button" class="btn-play-pausa" id="btnPlayPausa" aria-label="Reproducir canción">
          ▶
        </button>

        <div class="reproductor-barra-tiempo-contenedor">
          <span class="tiempo-etiqueta" id="lblTiempoActual">00:00</span>
          <input type="range" min="0" max="100" value="0" step="0.1" class="barra-tiempo" id="sliderTiempo" aria-label="Barra de progreso de audio">
          <span class="tiempo-etiqueta" id="lblTiempoTotal">00:00</span>
        </div>

        <div class="control-volumen-caja">
          <span aria-hidden="true">🔊</span>
          <input type="range" min="0" max="1" step="0.05" value="${audio.volume || 1}" class="control-volumen" id="sliderVolumen" aria-label="Control de volumen">
        </div>
      </div>

      <!-- Panel de Letras -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
          <strong style="font-size: var(--tamano-s); color: var(--primario);">
            ${lineasLrcParsed.length > 0 ? 'Letra sincronizada' : 'Letra'}
          </strong>
          ${lineasLrcParsed.length > 0 ? `<span style="font-size: var(--tamano-xs); color: var(--texto-suave);">Haz clic en un verso para saltar</span>` : ''}
        </div>
        ${letrasHtml}
      </div>
    </div>
  `;

  // Cargar fuente de audio
  audio.src = cancion.audio;

  const btnPlayPausa = document.getElementById('btnPlayPausa');
  const sliderTiempo = document.getElementById('sliderTiempo');
  const sliderVolumen = document.getElementById('sliderVolumen');
  const lblTiempoActual = document.getElementById('lblTiempoActual');
  const lblTiempoTotal = document.getElementById('lblTiempoTotal');
  const panelLetras = document.getElementById('panelLetrasLrc');

  let usuarioArrastrandoSlider = false;

  btnPlayPausa.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(err => console.warn('Error al reproducir audio:', err));
    } else {
      audio.pause();
    }
  });

  audio.onplay = () => {
    btnPlayPausa.textContent = '⏸';
    btnPlayPausa.setAttribute('aria-label', 'Pausar canción');
  };

  audio.onpause = () => {
    btnPlayPausa.textContent = '▶';
    btnPlayPausa.setAttribute('aria-label', 'Reproducir canción');
  };

  audio.onloadedmetadata = () => {
    lblTiempoTotal.textContent = formatearSegundos(audio.duration);
  };

  audio.ontimeupdate = () => {
    if (!usuarioArrastrandoSlider && audio.duration) {
      const porcentaje = (audio.currentTime / audio.duration) * 100;
      sliderTiempo.value = porcentaje;
      lblTiempoActual.textContent = formatearSegundos(audio.currentTime);
    }

    // Sincronización LRC
    if (lineasLrcParsed.length > 0 && panelLetras) {
      const t = audio.currentTime;
      let nuevoIdx = -1;
      for (let i = lineasLrcParsed.length - 1; i >= 0; i--) {
        if (t >= lineasLrcParsed[i].tiempo) {
          nuevoIdx = i;
          break;
        }
      }

      if (nuevoIdx !== lineaActivaIndex) {
        lineaActivaIndex = nuevoIdx;
        const lineasElements = panelLetras.querySelectorAll('.linea-lrc');
        lineasElements.forEach((el, idx) => {
          if (idx === lineaActivaIndex) {
            el.classList.add('linea-lrc--activa');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            el.classList.remove('linea-lrc--activa');
          }
        });
      }
    }
  };

  audio.onended = () => {
    btnPlayPausa.textContent = '▶';
    sliderTiempo.value = 0;
    lblTiempoActual.textContent = '00:00';
    lineaActivaIndex = -1;
    if (panelLetras) {
      panelLetras.querySelectorAll('.linea-lrc--activa').forEach(el => el.classList.remove('linea-lrc--activa'));
    }
  };

  // Barra de progreso operable
  sliderTiempo.addEventListener('mousedown', () => { usuarioArrastrandoSlider = true; });
  sliderTiempo.addEventListener('touchstart', () => { usuarioArrastrandoSlider = true; });

  sliderTiempo.addEventListener('input', () => {
    if (audio.duration) {
      const segs = (sliderTiempo.value / 100) * audio.duration;
      lblTiempoActual.textContent = formatearSegundos(segs);
    }
  });

  sliderTiempo.addEventListener('change', () => {
    if (audio.duration) {
      audio.currentTime = (sliderTiempo.value / 100) * audio.duration;
    }
    usuarioArrastrandoSlider = false;
  });

  // Control de volumen
  sliderVolumen.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
  });

  // Salto a verso específico al hacer clic en línea LRC
  if (panelLetras) {
    panelLetras.querySelectorAll('.linea-lrc').forEach(el => {
      el.addEventListener('click', () => {
        const segs = parseFloat(el.getAttribute('data-tiempo'));
        if (!isNaN(segs)) {
          audio.currentTime = segs;
          if (audio.paused) {
            audio.play().catch(() => {});
          }
        }
      });
    });
  }

  if (reproducirInmediato) {
    audio.play().catch(err => {
      // Políticas de autoplay del navegador
      console.log('Autoplay bloqueado por el navegador; esperando interacción de usuario:', err);
    });
  }
}
