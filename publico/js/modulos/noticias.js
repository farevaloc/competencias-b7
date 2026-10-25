import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Noticias', roles: ['sesion'] });

const contenedor = document.getElementById('contenido');
const POR_PAGINA = 9;

let todasNoticias = [];
let lecturasSet = new Set();
let mapaTemas = new Map();
let paginaActual = 1;
let filtroCategoria = '';
let filtroTema = '';

cargarDatos();

async function cargarDatos() {
  ui.cargando(true);
  try {
    const [noticiasData, lecturasData, temasData] = await Promise.all([
      api.listar('noticias'),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    todasNoticias = noticiasData || [];
    lecturasSet = new Set((lecturasData || []).map(l => l.noticiaId));
    mapaTemas = new Map((temasData || []).map(t => [t.id, t]));

    renderizarModulo();
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar las noticias: ${ui.escapar(err.message)}
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

function renderizarModulo() {
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'admin' || usuario.rol === 'docente');

  contenedor.innerHTML = `
    <section class="noticias-seccion">
      <header class="noticias-cabecera">
        <div>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">
            Noticias y Novedades
          </h1>
          <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin-top: var(--espaciado-xs);">
            Mantente al día con los anuncios, logros y actividades del ecosistema.
          </p>
        </div>

        ${puedeEditar ? `
          <a href="/paginas/editor-noticia.html" class="btn btn--primario">
            + Nueva noticia
          </a>
        ` : ''}
      </header>

      <!-- Barra de filtros -->
      <div class="noticias-filtros">
        <div class="campo" style="margin-bottom: 0; min-width: 200px;">
          <label for="filtroCategoria" style="font-size: var(--tamano-xs);">Categoría</label>
          <select id="filtroCategoria">
            <option value="">Todas las categorías</option>
            <option value="Institucional">Institucional</option>
            <option value="Académica">Académica</option>
            <option value="Eventos">Eventos</option>
            <option value="Logros">Logros</option>
          </select>
        </div>

        <div class="campo" style="margin-bottom: 0; min-width: 240px;">
          <label for="filtroTema" style="font-size: var(--tamano-xs);">Tema relacionado</label>
          <select id="filtroTema">
            <option value="">Todos los temas</option>
            ${Array.from(mapaTemas.values()).map(t => `
              <option value="${ui.escapar(t.id)}">${ui.escapar(t.titulo)}</option>
            `).join('')}
          </select>
        </div>
      </div>

      <!-- Cuadrícula de tarjetas -->
      <div id="contenedorNoticiasGrid" class="noticias-grid"></div>

      <!-- Paginación -->
      <div id="contenedorPaginacion" class="noticias-paginacion"></div>
    </section>
  `;

  const selCat = document.getElementById('filtroCategoria');
  const selTema = document.getElementById('filtroTema');

  selCat.addEventListener('change', (e) => {
    filtroCategoria = e.target.value;
    paginaActual = 1;
    actualizarListado();
  });

  selTema.addEventListener('change', (e) => {
    filtroTema = e.target.value;
    paginaActual = 1;
    actualizarListado();
  });

  actualizarListado();
}

function actualizarListado() {
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'admin' || usuario.rol === 'docente');

  // Filtrar
  let filtradas = todasNoticias.filter(n => {
    if (filtroCategoria && n.categoria !== filtroCategoria) return false;
    if (filtroTema && n.temaId !== filtroTema) return false;
    return true;
  });

  // Ordenar: destacadas primero, luego por fecha más reciente
  filtradas.sort((a, b) => {
    const destA = Boolean(a.destacada);
    const destB = Boolean(b.destacada);
    if (destA !== destB) {
      return destB ? 1 : -1;
    }
    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });

  const total = filtradas.length;
  const totalPaginas = Math.ceil(total / POR_PAGINA) || 1;

  if (paginaActual > totalPaginas) {
    paginaActual = totalPaginas;
  }

  const inicio = (paginaActual - 1) * POR_PAGINA;
  const fin = inicio + POR_PAGINA;
  const elementosPagina = filtradas.slice(inicio, fin);

  const grid = document.getElementById('contenedorNoticiasGrid');
  const paginacion = document.getElementById('contenedorPaginacion');

  if (elementosPagina.length === 0) {
    grid.innerHTML = `
      <div class="vacio" style="grid-column: 1 / -1;">
        <div class="vacio__icono">📰</div>
        <h2 class="vacio__titulo">No hay noticias que coincidan</h2>
        <p class="vacio__texto">Intenta seleccionando otra categoría o limpiando los filtros aplicados.</p>
      </div>
    `;
    paginacion.innerHTML = '';
    return;
  }

  grid.innerHTML = elementosPagina.map(noticia => {
    const esLeida = lecturasSet.has(noticia.id);
    const esNuevo = !esLeida;
    const esDestacada = Boolean(noticia.destacada);
    const tema = noticia.temaId ? mapaTemas.get(noticia.temaId) : null;
    const fechaTexto = noticia.fechaPublicacion
      ? util.fechaRelativa(noticia.fechaPublicacion)
      : (noticia.fecha ? util.fechaRelativa(noticia.fecha) : '');

    return `
      <article class="tarjeta-noticia ${esDestacada ? 'tarjeta-noticia--destacada' : ''}">
        <div class="tarjeta-noticia__imagen-caja">
          <div class="tarjeta-noticia__etiquetas">
            ${esNuevo ? `<span class="insignia insignia--nuevo">Nuevo</span>` : ''}
            ${esDestacada ? `<span class="insignia insignia--destacada">⭐ Destacada</span>` : ''}
          </div>
          ${noticia.imagen
            ? `<img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="tarjeta-noticia__imagen" loading="lazy">`
            : `<div style="font-size: var(--tamano-3xl); color: var(--borde-fuerte);">📰</div>`
          }
        </div>

        <div class="tarjeta-noticia__contenido">
          <div class="tarjeta-noticia__meta">
            <span class="chip" style="font-size: 11px;">${ui.escapar(noticia.categoria || 'General')}</span>
            <span>${ui.escapar(fechaTexto)}</span>
          </div>

          <h2 class="tarjeta-noticia__titulo">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" style="color: inherit; text-decoration: none;">
              ${ui.escapar(noticia.titulo)}
            </a>
          </h2>

          <p class="tarjeta-noticia__resumen">${ui.escapar(noticia.resumen || '')}</p>

          ${tema ? `
            <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">
              Tema: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="enlace">${ui.escapar(tema.titulo)}</a>
            </div>
          ` : ''}

          ${noticia.estado === 'borrador' ? `
            <div><span class="chip" style="background-color: var(--superficie-suave); font-size: 10px;">Borrador</span></div>
          ` : ''}

          <div class="tarjeta-noticia__pie">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="enlace" style="font-weight: var(--peso-negrita); font-size: var(--tamano-xs);">
              Leer completa →
            </a>

            ${puedeEditar ? `
              <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--secundario btn--pequeno">
                Editar
              </a>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Renderizar controles de paginación
  if (totalPaginas <= 1) {
    paginacion.innerHTML = '';
  } else {
    paginacion.innerHTML = `
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaAnt" ${paginaActual === 1 ? 'disabled' : ''}>
        ← Anterior
      </button>
      <span style="font-size: var(--tamano-s); color: var(--texto-suave);">
        Página <strong>${paginaActual}</strong> de <strong>${totalPaginas}</strong> (${total} noticias)
      </span>
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPaginaSig" ${paginaActual === totalPaginas ? 'disabled' : ''}>
        Siguiente →
      </button>
    `;

    const btnAnt = document.getElementById('btnPaginaAnt');
    const btnSig = document.getElementById('btnPaginaSig');

    if (btnAnt) {
      btnAnt.addEventListener('click', () => {
        if (paginaActual > 1) {
          paginaActual--;
          actualizarListado();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (btnSig) {
      btnSig.addEventListener('click', () => {
        if (paginaActual < totalPaginas) {
          paginaActual++;
          actualizarListado();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }
}
