import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import * as sesion from '../nucleo/sesion.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

await montarPlantilla({ titulo: 'Tema', roles: ['estudiante', 'docente', 'admin'] });

const temaId = util.parametro('id');
const contenedor = document.getElementById('contenido');

if (!temaId) {
  contenedor.innerHTML = `
    <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
      No se especificó ningún identificador de tema.
      <br><a href="/paginas/asignaturas.html" class="enlace">Ir a Mis asignaturas</a>
    </div>
  `;
} else {
  cargarTema();
}

async function cargarTema() {
  ui.cargando(true);
  try {
    const [tema, unidades, asignaturas, progreso] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('unidades'),
      api.listar('asignaturas'),
      api.listar('progreso-temas')
    ]);

    if (!tema) {
      contenedor.innerHTML = `
        <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
          El tema solicitado no existe o no tienes acceso para visualizarlo.
          <br><a href="/paginas/asignaturas.html" class="enlace">Volver a Mis asignaturas</a>
        </div>
      `;
      return;
    }

    // Guardar en localStorage el último tema consultado
    try {
      localStorage.setItem('ultimoTema', JSON.stringify({ id: tema.id, titulo: tema.titulo }));
    } catch (_) {
      // Manejo silencioso si localStorage está bloqueado o deshabilitado
    }

    // Resolver unidad y asignatura para las migas de pan
    const unidad = unidades.find(u => u.id === tema.unidadId);
    const asignatura = unidad ? asignaturas.find(a => a.id === unidad.asignaturaId) : null;

    // Verificar si ya está marcado como revisado por el usuario actual
    let revisado = progreso.some(p => p.temaId === tema.id);

    renderizarVistaTema({ tema, unidad, asignatura, revisado });
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar los datos del tema: ${ui.escapar(err.message)}
        <br><a href="/paginas/asignaturas.html" class="enlace">Volver a Mis asignaturas</a>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

function renderizarVistaTema({ tema, unidad, asignatura, revisado }) {
  // 1. Migas de pan
  const migasHtml = `
    <nav class="migas" aria-label="Ruta de exploración">
      <ol>
        <li><a href="/paginas/asignaturas.html">Mis asignaturas</a></li>
        ${asignatura ? `
          <li class="migas__separador">/</li>
          <li><a href="/paginas/asignatura.html?id=${encodeURIComponent(asignatura.id)}">${ui.escapar(asignatura.nombre)}</a></li>
        ` : ''}
        ${unidad ? `
          <li class="migas__separador">/</li>
          <li><span style="color: var(--texto-suave);">${ui.escapar(unidad.titulo)}</span></li>
        ` : ''}
        <li class="migas__separador">/</li>
        <li class="migas__actual" aria-current="page">${ui.escapar(tema.titulo)}</li>
      </ol>
    </nav>
  `;

  // 2. Objetivos
  const objetivos = Array.isArray(tema.objetivos) ? tema.objetivos.filter(Boolean) : [];
  const objetivosHtml = objetivos.length > 0 ? `
    <section class="tema-bloque" aria-labelledby="seccion-objetivos">
      <h2 id="seccion-objetivos" class="tema-bloque__titulo">🎯 Objetivos de aprendizaje</h2>
      <ul class="lista-estilizada">
        ${objetivos.map(obj => `
          <li class="lista-estilizada__item">
            <span class="lista-estilizada__icono">✓</span>
            <span>${ui.escapar(obj)}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  // 3. Resumen formativo
  const resumenHtml = tema.resumen ? `
    <section class="tema-bloque" aria-labelledby="seccion-resumen">
      <h2 id="seccion-resumen" class="tema-bloque__titulo">📖 Resumen formativo</h2>
      <div class="tema-resumen-cuerpo">
        ${util.formatoBasico(tema.resumen)}
      </div>
    </section>
  ` : '';

  // 4. Ejemplos prácticos
  const ejemplos = Array.isArray(tema.ejemplos) ? tema.ejemplos.filter(Boolean) : [];
  const ejemplosHtml = ejemplos.length > 0 ? `
    <section class="tema-bloque" aria-labelledby="seccion-ejemplos">
      <h2 id="seccion-ejemplos" class="tema-bloque__titulo">💡 Ejemplos y aplicaciones</h2>
      <ul class="lista-estilizada">
        ${ejemplos.map(ej => `
          <li class="lista-estilizada__item" style="border-left-color: var(--secundario);">
            <span class="lista-estilizada__icono" style="color: var(--secundario);">📌</span>
            <span>${ui.escapar(ej)}</span>
          </li>
        `).join('')}
      </ul>
    </section>
  ` : '';

  // 5. Recursos complementarios
  const recursos = Array.isArray(tema.recursos) ? tema.recursos.filter(r => r && (r.url || r.titulo)) : [];
  let recursosHtml = '';
  if (recursos.length > 0) {
    const recursosCards = recursos.map(rec => renderizarRecurso(rec, tema.titulo)).join('');
    recursosHtml = `
      <section class="tema-bloque" aria-labelledby="seccion-recursos">
        <h2 id="seccion-recursos" class="tema-bloque__titulo">📁 Recursos multimedia y complementarios</h2>
        <div class="recursos-grid">
          ${recursosCards}
        </div>
      </section>
    `;
  }

  // 6. Bloque Practica este tema
  let actividadesHtml = '';
  if (Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0) {
    actividadesHtml = `
      <div class="actividades-grid">
        ${ACTIVIDADES.map(act => `
          <a href="${ui.escapar(act.href)}?temaId=${encodeURIComponent(tema.id)}" class="actividad-card">
            <h3 class="actividad-card__titulo">${ui.escapar(act.texto || 'Actividad')}</h3>
            <p class="actividad-card__descripcion">${ui.escapar(act.descripcion || '')}</p>
            <span class="enlace" style="font-size: var(--tamano-xs); font-weight: var(--peso-negrita); margin-top: auto;">
              Iniciar práctica →
            </span>
          </a>
        `).join('')}
      </div>
    `;
  } else {
    actividadesHtml = `
      <div class="alerta alerta--info" style="margin: 0;">
        🎮 Próximamente habrá actividades interactivas y juegos formativos disponibles para este tema.
      </div>
    `;
  }

  const bloquePracticaHtml = `
    <section class="tema-bloque" aria-labelledby="seccion-practica">
      <h2 id="seccion-practica" class="tema-bloque__titulo">🚀 Practica este tema</h2>
      ${actividadesHtml}
    </section>
  `;

  // Renderizar contenido completo
  contenedor.innerHTML = `
    <article class="tema-vista-seccion">
      ${migasHtml}

      <header class="tema-cabecera-principal">
        <div class="tema-cabecera-top">
          <div class="pila" style="gap: var(--espaciado-xs);">
            <div class="tema-metadatos">
              ${tema.dificultad ? `<span class="chip">${ui.escapar(tema.dificultad)}</span>` : ''}
              ${Array.isArray(tema.palabrasClave) && tema.palabrasClave.length > 0
                ? tema.palabrasClave.map(k => `<span class="chip" style="font-size: 11px;">#${ui.escapar(k)}</span>`).join('')
                : ''}
            </div>
            <h1 class="tema-titulo">${ui.escapar(tema.titulo)}</h1>
          </div>

          <div style="flex-shrink: 0; display: flex; gap: var(--espaciado-s); align-items: center; flex-wrap: wrap;">
            ${sesion.usuarioActual() && (sesion.usuarioActual().rol === 'docente' || sesion.usuarioActual().rol === 'admin') ? `
              <a href="/paginas/banco-preguntas.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--primario" title="Gestionar preguntas del Quiz">
                📝 Gestionar Quiz
              </a>
              <a href="/paginas/quiz.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--secundario" title="Probar el Quiz como estudiante">
                👁️ Probar Quiz
              </a>
            ` : `
              <a href="/paginas/quiz.html?temaId=${encodeURIComponent(tema.id)}" class="btn btn--secundario" title="Rendir el Quiz de este tema">
                🎯 Iniciar Quiz
              </a>
            `}
            ${revisado
              ? `<button type="button" class="btn btn--revisado" disabled>Revisado ✓</button>`
              : `<button type="button" class="btn btn--primario" id="btnMarcarRevisado">Marcar como revisado</button>`
            }
          </div>
        </div>
      </header>

      ${objetivosHtml}
      ${resumenHtml}
      ${ejemplosHtml}
      ${recursosHtml}
      ${bloquePracticaHtml}
    </article>
  `;

  // Asignar evento al botón "Marcar como revisado"
  const btnMarcar = document.getElementById('btnMarcarRevisado');
  if (btnMarcar) {
    btnMarcar.addEventListener('click', async () => {
      btnMarcar.disabled = true;
      ui.cargando(true);
      try {
        await api.crear('progreso-temas', { temaId: tema.id });
        btnMarcar.textContent = 'Revisado ✓';
        btnMarcar.className = 'btn btn--revisado';
        ui.aviso('Tema marcado como revisado.', 'exito');
      } catch (err) {
        btnMarcar.disabled = false;
        ui.aviso(err.message || 'Error al registrar progreso.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }
}

function renderizarRecurso(rec, temaTitulo) {
  const tipo = (rec.tipo || 'enlace').toLowerCase();
  const titulo = rec.titulo || 'Recurso complementario';
  const url = rec.url || '#';

  if (tipo === 'video') {
    const videoEmbed = extraerEmbedVideo(url, titulo);
    return `
      <div class="recurso-card">
        ${videoEmbed}
        <div class="recurso-card__contenido">
          <h3 class="recurso-card__titulo">${ui.escapar(titulo)}</h3>
          <a href="${ui.escapar(url)}" target="_blank" rel="noopener" class="enlace" style="font-size: var(--tamano-xs);">
            Ver en sitio de origen ↗
          </a>
        </div>
      </div>
    `;
  }

  if (tipo === 'imagen') {
    return `
      <div class="recurso-card">
        <img src="${ui.escapar(url)}" alt="${ui.escapar(titulo || temaTitulo)}" class="recurso-imagen" loading="lazy">
        <div class="recurso-card__contenido">
          <h3 class="recurso-card__titulo">${ui.escapar(titulo)}</h3>
        </div>
      </div>
    `;
  }

  if (tipo === 'pdf') {
    return `
      <div class="recurso-card">
        <div class="recurso-card__contenido">
          <div style="font-size: var(--tamano-xl); line-height: 1;">📄</div>
          <h3 class="recurso-card__titulo">${ui.escapar(titulo)}</h3>
          <a href="${ui.escapar(url)}" target="_blank" rel="noopener" class="btn btn--secundario btn--pequeno" style="margin-top: auto;">
            Abrir documento PDF ↗
          </a>
        </div>
      </div>
    `;
  }

  // Por defecto enlace
  return `
    <div class="recurso-card">
      <div class="recurso-card__contenido">
        <div style="font-size: var(--tamano-xl); line-height: 1;">🔗</div>
        <h3 class="recurso-card__titulo">${ui.escapar(titulo)}</h3>
        <a href="${ui.escapar(url)}" target="_blank" rel="noopener" class="btn btn--secundario btn--pequeno" style="margin-top: auto;">
          Visitar enlace ↗
        </a>
      </div>
    </div>
  `;
}

function extraerEmbedVideo(url, titulo) {
  const safeTitle = ui.escapar(`Video: ${titulo}`);

  // Detección de YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return `
      <div class="video-contenedor">
        <iframe
          src="https://www.youtube-nocookie.com/embed/${videoId}"
          title="${safeTitle}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    `;
  }

  // Detección de Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    const videoId = vimeoMatch[3];
    return `
      <div class="video-contenedor">
        <iframe
          src="https://player.vimeo.com/video/${videoId}"
          title="${safeTitle}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen>
        </iframe>
      </div>
    `;
  }

  // Fallback si no es YouTube ni Vimeo
  return `
    <div class="alerta alerta--info" style="margin: var(--espaciado-s);">
      <a href="${ui.escapar(url)}" target="_blank" rel="noopener" class="enlace">
        ▶ Reproducir video externo (${safeTitle}) ↗
      </a>
    </div>
  `;
}
