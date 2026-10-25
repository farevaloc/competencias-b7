import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: 'Noticia', roles: ['sesion'] });

const noticiaId = util.parametro('id');
const contenedor = document.getElementById('contenido');

if (!noticiaId) {
  contenedor.innerHTML = `
    <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
      No se especificó ninguna noticia.
      <br><a href="/paginas/noticias.html" class="enlace">Ir a noticias</a>
    </div>
  `;
} else {
  cargarNoticia();
}

async function cargarNoticia() {
  ui.cargando(true);
  try {
    const [noticia, lecturas, temas] = await Promise.all([
      api.obtener('noticias', noticiaId),
      api.listar('lecturas-noticias'),
      api.listar('temas')
    ]);

    if (!noticia) {
      contenedor.innerHTML = `
        <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
          La noticia solicitada no existe o no tienes permisos para verla.
          <br><a href="/paginas/noticias.html" class="enlace">Volver a noticias</a>
        </div>
      `;
      return;
    }

    // Registrar lectura automáticamente si aún no está registrada
    const yaLeida = Array.isArray(lecturas) && lecturas.some(l => l.noticiaId === noticia.id);
    if (!yaLeida) {
      api.crear('lecturas-noticias', { noticiaId: noticia.id }).catch(() => {
        // Ignorar de forma silenciosa si ya existía o falla la bitácora
      });
    }

    const tema = noticia.temaId ? (temas || []).find(t => t.id === noticia.temaId) : null;
    renderizarDetalle(noticia, tema);
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar la noticia: ${ui.escapar(err.message)}
        <br><a href="/paginas/noticias.html" class="enlace">Volver a noticias</a>
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

function renderizarDetalle(noticia, tema) {
  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'admin' || usuario.rol === 'docente');

  const fechaFormateada = noticia.fechaPublicacion
    ? util.fechaLarga(noticia.fechaPublicacion)
    : (noticia.fecha ? util.fechaLarga(noticia.fecha) : '');

  contenedor.innerHTML = `
    <section class="noticia-detalle-seccion">
      <!-- Migas de pan -->
      <nav class="migas" aria-label="Ruta de exploración">
        <ol>
          <li><a href="/paginas/noticias.html">Noticias</a></li>
          <li class="migas__separador">/</li>
          <li><span style="color: var(--texto-suave);">${ui.escapar(noticia.categoria || 'General')}</span></li>
          <li class="migas__separador">/</li>
          <li class="migas__actual" aria-current="page">${ui.escapar(noticia.titulo)}</li>
        </ol>
      </nav>

      <article class="noticia-articulo">
        <header class="noticia-articulo__cabecera">
          <div class="noticia-articulo__meta">
            <span class="chip">${ui.escapar(noticia.categoria || 'General')}</span>
            ${noticia.destacada ? `<span class="insignia" style="background-color: var(--acento); color: var(--primario); font-size: 11px;">⭐ Destacada</span>` : ''}
            ${noticia.estado === 'borrador' ? `<span class="chip" style="font-size: 11px;">Borrador</span>` : ''}
            ${fechaFormateada ? `<span>• Publicado el ${ui.escapar(fechaFormateada)}</span>` : ''}
          </div>

          <h1 class="noticia-articulo__titulo">${ui.escapar(noticia.titulo)}</h1>

          ${tema ? `
            <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">
              Tema relacionado: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="enlace">${ui.escapar(tema.titulo)}</a>
            </div>
          ` : ''}
        </header>

        ${noticia.imagen ? `
          <img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="noticia-articulo__imagen">
        ` : ''}

        ${noticia.resumen ? `
          <div class="noticia-articulo__resumen-destacado">
            ${ui.escapar(noticia.resumen)}
          </div>
        ` : ''}

        <div class="noticia-articulo__cuerpo">
          ${util.formatoBasico(noticia.cuerpo)}
        </div>

        <footer class="noticia-articulo__pie">
          <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">
            ← Volver a noticias
          </a>

          ${puedeEditar ? `
            <a href="/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--primario btn--pequeno">
              Editar noticia
            </a>
          ` : ''}
        </footer>
      </article>
    </section>
  `;
}
