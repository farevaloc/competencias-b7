import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: 'Inicio', roles: ['publico'] });

const usuario = usuarioActual();
const contenedor = document.getElementById('contenido');

if (!usuario) {
  renderizarSinSesion();
} else {
  renderizarConSesion();
}

function renderizarSinSesion() {
  contenedor.innerHTML = `
    <section class="inicio-seccion">
      <div class="hero-presentacion">
        <span class="chip" style="width: fit-content;">Plataforma Educativa Digital</span>
        <h1 class="hero-presentacion__titulo">
          Ecosistema Digital de Aprendizaje
        </h1>
        <p class="hero-presentacion__descripcion">
          Aprende a tu propio ritmo con contenidos organizados, actividades pedagógicas interactivas, canciones didácticas con letra sincronizada y seguimiento de tu avance.
        </p>
        <div class="hero-presentacion__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--primario">
            Ingresar a la plataforma
          </a>
          <a href="/paginas/registro.html" class="btn btn--secundario">
            Registrarse gratis
          </a>
        </div>
      </div>

      <div class="hero-caracteristicas">
        <div class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono">📚</div>
          <h2 class="tarjeta-caracteristica__titulo">Contenidos modulares</h2>
          <p class="tarjeta-caracteristica__texto">Temas estructurados por unidades y asignaturas, con objetivos claros, resúmenes formativos y recursos multimedia.</p>
        </div>

        <div class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono">🎵</div>
          <h2 class="tarjeta-caracteristica__titulo">Canciones educativas</h2>
          <p class="tarjeta-caracteristica__texto">Refuerza conceptos y vocabulario mediante audios y letras sincronizadas (LRC) en un reproductor interactivo.</p>
        </div>

        <div class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono">📰</div>
          <h2 class="tarjeta-caracteristica__titulo">Noticias y novedades</h2>
          <p class="tarjeta-caracteristica__texto">Comunícate y entérate de las actividades institucionales, eventos y logros académicos del ecosistema.</p>
        </div>

        <div class="tarjeta-caracteristica">
          <div class="tarjeta-caracteristica__icono">📊</div>
          <h2 class="tarjeta-caracteristica__titulo">Seguimiento de avance</h2>
          <p class="tarjeta-caracteristica__texto">Monitorea los temas revisados en tus asignaturas y retoma tus lecciones exactamente donde las dejaste.</p>
        </div>
      </div>
    </section>
  `;
}

async function renderizarConSesion() {
  ui.cargando(true);

  // 1. Obtener último tema desde localStorage
  let ultimoTema = null;
  try {
    const raw = localStorage.getItem('ultimoTema');
    if (raw) {
      ultimoTema = JSON.parse(raw);
    }
  } catch (_) {
    ultimoTema = null;
  }

  // 2. Cargar datos de asignaturas y noticias
  let asignaturas = [];
  let avancesMap = new Map();
  let ultimasNoticias = [];

  try {
    const [asignaturasData, noticiasData] = await Promise.all([
      api.listar('asignaturas').catch(() => []),
      api.listar('noticias').catch(() => [])
    ]);

    asignaturas = asignaturasData || [];

    // Calcular avance para cada asignatura con calcularAvance de asignaturas.js
    if (asignaturas.length > 0) {
      const avancesResultados = await Promise.all(
        asignaturas.map(a => calcularAvance(a.id, true).catch(() => ({ porcentaje: 0, revisados: 0, total: 0 })))
      );
      asignaturas.forEach((a, idx) => {
        avancesMap.set(a.id, avancesResultados[idx]);
      });
    }

    // Filtrar noticias publicadas y ordenar: destacadas primero, luego más recientes
    const noticiasPublicadas = (noticiasData || []).filter(n => n.estado === 'publicado');
    noticiasPublicadas.sort((a, b) => {
      const destA = Boolean(a.destacada);
      const destB = Boolean(b.destacada);
      if (destA !== destB) return destB ? 1 : -1;
      const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fechaB - fechaA;
    });

    ultimasNoticias = noticiasPublicadas.slice(0, 3);
  } catch (err) {
    console.error('Error al cargar datos en inicio:', err);
  } finally {
    ui.cargando(false);
  }

  const esDocenteOAdmin = usuario.rol === 'docente' || usuario.rol === 'admin';

  // Renderizado del saludo
  const saludoHtml = `
    <header class="inicio-saludo">
      <div class="inicio-saludo__texto">
        <h1 class="inicio-saludo__titulo">
          ¡Hola, ${ui.escapar(usuario.nombre)}!
        </h1>
        <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin: 0;">
          Bienvenido a tu panel de aprendizaje. Aquí tienes el resumen de tus asignaturas y novedades.
        </p>
      </div>
      <div>
        <span class="insignia" style="text-transform: capitalize; font-size: var(--tamano-s); padding: var(--espaciado-xs) var(--espaciado-m);">
          Rol: ${ui.escapar(usuario.rol)}
        </span>
      </div>
    </header>
  `;

  // Renderizado de "Continuar donde te quedaste"
  let continuarHtml = '';
  if (ultimoTema && ultimoTema.id && ultimoTema.titulo) {
    continuarHtml = `
      <section class="tarjeta-continuar" aria-labelledby="titulo-continuar">
        <div class="tarjeta-continuar__info">
          <span class="tarjeta-continuar__etiqueta">📌 Continuar donde te quedaste</span>
          <h2 id="titulo-continuar" class="tarjeta-continuar__tema-titulo">
            ${ui.escapar(ultimoTema.titulo)}
          </h2>
        </div>
        <a href="/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}" class="btn btn--primario">
          Reanudar tema →
        </a>
      </section>
    `;
  }

  // Renderizado de Accesos Rápidos (Docentes y Admin)
  let accesosRapidosHtml = '';
  if (esDocenteOAdmin) {
    accesosRapidosHtml = `
      <section class="inicio-seccion-bloque" aria-labelledby="titulo-accesos-rapidos">
        <h2 id="titulo-accesos-rapidos" class="inicio-seccion-bloque__titulo">
          Accesos de gestión rápida
        </h2>
        <div class="accesos-rapidos-grid">
          <a href="/paginas/editor-contenidos.html" class="tarjeta-acceso">
            <span class="tarjeta-acceso__icono">📚</span>
            <div class="tarjeta-acceso__texto">
              <span class="tarjeta-acceso__titulo">Gestión de contenidos</span>
              <span class="tarjeta-acceso__desc">Editar unidades y temas</span>
            </div>
          </a>

          <a href="/paginas/editor-noticia.html" class="tarjeta-acceso">
            <span class="tarjeta-acceso__icono">✍️</span>
            <div class="tarjeta-acceso__texto">
              <span class="tarjeta-acceso__titulo">Publicar noticia</span>
              <span class="tarjeta-acceso__desc">Nueva novedad o aviso</span>
            </div>
          </a>

          <a href="/paginas/editor-cancion.html" class="tarjeta-acceso">
            <span class="tarjeta-acceso__icono">🎵</span>
            <div class="tarjeta-acceso__texto">
              <span class="tarjeta-acceso__titulo">Agregar canción</span>
              <span class="tarjeta-acceso__desc">Subir audio y letra LRC</span>
            </div>
          </a>

          ${usuario.rol === 'admin' ? `
            <a href="/paginas/distributivo.html" class="tarjeta-acceso">
              <span class="tarjeta-acceso__icono">👥</span>
              <div class="tarjeta-acceso__texto">
                <span class="tarjeta-acceso__titulo">Distributivo</span>
                <span class="tarjeta-acceso__desc">Asignar docentes y paralelos</span>
              </div>
            </a>
          ` : ''}
        </div>
      </section>
    `;
  }

  // Renderizado de Mis Asignaturas
  let asignaturasGridHtml = '';
  if (asignaturas.length === 0) {
    asignaturasGridHtml = `
      <div class="vacio">
        <div class="vacio__icono">📂</div>
        <h3 class="vacio__titulo">No tienes asignaturas asignadas</h3>
        <p class="vacio__texto">Actualmente no tienes asignaturas matriculadas o vinculadas.</p>
      </div>
    `;
  } else {
    asignaturasGridHtml = `
      <div class="asignaturas-grid">
        ${asignaturas.map(asig => {
          const avance = avancesMap.get(asig.id) || { porcentaje: 0, revisados: 0, total: 0 };
          return `
            <article class="tarjeta tarjeta-asignatura">
              <div class="pila" style="gap: var(--espaciado-xs);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--espaciado-xs);">
                  <h3 class="tarjeta-asignatura__titulo">${ui.escapar(asig.nombre)}</h3>
                  ${asig.nivel ? `<span class="chip" style="font-size: 11px;">${ui.escapar(asig.nivel)}</span>` : ''}
                </div>
                ${asig.descripcion ? `<p class="tarjeta-asignatura__descripcion">${ui.escapar(asig.descripcion)}</p>` : ''}
              </div>

              <div class="tarjeta-asignatura__avance" style="margin-top: auto;">
                <div class="tarjeta-asignatura__avance-info">
                  <span>${avance.revisados} de ${avance.total} temas</span>
                  <strong style="color: var(--primario);">${avance.porcentaje}%</strong>
                </div>
                <div class="progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                  <span class="progreso-barra" style="width: ${avance.porcentaje}%;"></span>
                </div>
              </div>

              <div class="tarjeta-asignatura__pie">
                <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--secundario btn--pequeno">
                  Ver contenidos →
                </a>
              </div>
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  const bloqueAsignaturasHtml = `
    <section class="inicio-seccion-bloque" aria-labelledby="titulo-seccion-asignaturas">
      <div class="inicio-seccion-bloque__cabecera">
        <h2 id="titulo-seccion-asignaturas" class="inicio-seccion-bloque__titulo">
          Mis asignaturas
        </h2>
        <a href="/paginas/asignaturas.html" class="enlace" style="font-size: var(--tamano-s); font-weight: var(--peso-negrita);">
          Ver todas →
        </a>
      </div>
      ${asignaturasGridHtml}
    </section>
  `;

  // Renderizado de las 3 Noticias Más Recientes
  let noticiasBloqueHtml = '';
  if (ultimasNoticias.length > 0) {
    noticiasBloqueHtml = `
      <section class="inicio-seccion-bloque" aria-labelledby="titulo-seccion-noticias">
        <div class="inicio-seccion-bloque__cabecera">
          <h2 id="titulo-seccion-noticias" class="inicio-seccion-bloque__titulo">
            Últimas novedades y noticias
          </h2>
          <a href="/paginas/noticias.html" class="enlace" style="font-size: var(--tamano-s); font-weight: var(--peso-negrita);">
            Ver todas las noticias →
          </a>
        </div>

        <div class="inicio-noticias-grid">
          ${ultimasNoticias.map(noticia => {
            const fechaTxt = noticia.fechaPublicacion
              ? util.fechaRelativa(noticia.fechaPublicacion)
              : (noticia.fecha ? util.fechaRelativa(noticia.fecha) : '');

            return `
              <article class="tarjeta-noticia-inicio ${noticia.destacada ? 'tarjeta-noticia-inicio--destacada' : ''}">
                <div class="tarjeta-noticia-inicio__imagen-caja">
                  ${noticia.destacada ? `<div class="tarjeta-noticia-inicio__etiquetas"><span class="insignia insignia--destacada">⭐ Destacada</span></div>` : ''}
                  ${noticia.imagen
                    ? `<img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="tarjeta-noticia-inicio__imagen" loading="lazy">`
                    : `<div style="font-size: var(--tamano-3xl); color: var(--borde-fuerte);">📰</div>`
                  }
                </div>

                <div class="tarjeta-noticia-inicio__cuerpo">
                  <div class="tarjeta-noticia-inicio__meta">
                    <span class="chip" style="font-size: 11px; text-transform: uppercase; font-weight: var(--peso-seminegrita);">${ui.escapar(noticia.categoria || 'General')}</span>
                    ${fechaTxt ? `<span>${ui.escapar(fechaTxt)}</span>` : ''}
                  </div>

                  <h3 class="tarjeta-noticia-inicio__titulo">
                    <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}">
                      ${ui.escapar(noticia.titulo)}
                    </a>
                  </h3>

                  <p class="tarjeta-noticia-inicio__resumen">
                    ${ui.escapar(noticia.resumen || '')}
                  </p>

                  <div class="tarjeta-noticia-inicio__pie">
                    <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="enlace" style="font-weight: var(--peso-negrita); font-size: var(--tamano-s);">
                      Leer noticia →
                    </a>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  contenedor.innerHTML = `
    <div class="inicio-seccion">
      ${saludoHtml}
      ${continuarHtml}
      ${accesosRapidosHtml}
      ${bloqueAsignaturasHtml}
      ${noticiasBloqueHtml}
    </div>
  `;
}
