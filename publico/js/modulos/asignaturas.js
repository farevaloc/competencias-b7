import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

const esPaginaAsignaturas = typeof window !== 'undefined' && window.location.pathname.includes('asignaturas.html');

if (esPaginaAsignaturas) {
  await montarPlantilla({ titulo: 'Mis asignaturas', roles: ['estudiante', 'docente'] });
}

/**
 * Calcula el avance en porcentaje de temas publicados revisados para una asignatura dada.
 * Si conDetalle es true, retorna { porcentaje, revisados, total }.
 *
 * @param {string} asignaturaId
 * @param {boolean} [conDetalle=false]
 * @returns {Promise<number|{porcentaje: number, revisados: number, total: number}>}
 */
export async function calcularAvance(asignaturaId, conDetalle = false) {
  const [unidades, temas, progreso] = await Promise.all([
    api.listar('unidades'),
    api.listar('temas'),
    api.listar('progreso-temas')
  ]);

  return calcularAvanceConDatos(asignaturaId, unidades, temas, progreso, conDetalle);
}

/**
 * Función auxiliar pura para calcular el avance evitando múltiples peticiones redundantes.
 */
function calcularAvanceConDatos(asignaturaId, unidades, temas, progreso, conDetalle = false) {
  const unidadesIds = new Set(
    unidades
      .filter(u => u.asignaturaId === asignaturaId && u.visible !== false)
      .map(u => u.id)
  );

  const temasPublicados = temas.filter(
    t => unidadesIds.has(t.unidadId) && t.estado === 'publicado'
  );

  const total = temasPublicados.length;
  const progresoIds = new Set(progreso.map(p => p.temaId));
  const revisados = temasPublicados.filter(t => progresoIds.has(t.id)).length;
  const porcentaje = total > 0 ? Math.round((revisados / total) * 100) : 0;

  if (conDetalle) {
    return { porcentaje, revisados, total };
  }
  return porcentaje;
}

const contenedor = document.getElementById('contenido');

async function cargarAsignaturas() {
  ui.cargando(true);
  try {
    const [asignaturas, unidades, temas, progreso] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas'),
      api.listar('progreso-temas')
    ]);

    if (!asignaturas || asignaturas.length === 0) {
      contenedor.innerHTML = `
        <section class="asignaturas-seccion">
          <header class="asignaturas-cabecera">
            <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">Mis asignaturas</h1>
          </header>
          <div class="vacio">
            <div class="vacio__icono">📚</div>
            <h2 class="vacio__titulo">No tienes asignaturas asignadas</h2>
            <p class="vacio__texto">Actualmente no estás matriculado ni asignado como docente en ninguna asignatura activa.</p>
          </div>
        </section>
      `;
      return;
    }

    const tarjetasHtml = asignaturas.map(asig => {
      const { porcentaje, revisados, total } = calcularAvanceConDatos(asig.id, unidades, temas, progreso, true);
      const nivelEtiqueta = asig.nivel ? `<span class="chip">${ui.escapar(asig.nivel)}</span>` : '';

      return `
        <article class="tarjeta tarjeta-asignatura" data-id="${ui.escapar(asig.id)}">
          <div class="pila" style="gap: var(--espaciado-s);">
            <div class="tarjeta-asignatura__cabecera">
              <h2 class="tarjeta-asignatura__titulo">${ui.escapar(asig.nombre)}</h2>
              ${nivelEtiqueta}
            </div>
            <p class="tarjeta-asignatura__descripcion">${ui.escapar(asig.descripcion || 'Sin descripción disponible.')}</p>
          </div>

          <div class="tarjeta-asignatura__avance">
            <div class="tarjeta-asignatura__avance-info">
              <span>${revisados} de ${total} temas revisados</span>
              <span class="tarjeta-asignatura__porcentaje">${porcentaje}%</span>
            </div>
            <div class="progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${ui.escapar(asig.nombre)}">
              <span class="progreso-barra" style="width: ${porcentaje}%;"></span>
            </div>
          </div>

          <div class="tarjeta-asignatura__pie">
            <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario btn--pequeno">
              Ver contenidos →
            </a>
          </div>
        </article>
      `;
    }).join('');

    contenedor.innerHTML = `
      <section class="asignaturas-seccion">
        <header class="asignaturas-cabecera">
          <div>
            <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">Mis asignaturas</h1>
            <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin-top: var(--espaciado-xs);">
              Consulta el programa de estudios y tu avance en cada asignatura.
            </p>
          </div>
        </header>

        <div class="asignaturas-grid">
          ${tarjetasHtml}
        </div>
      </section>
    `;
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar las asignaturas: ${ui.escapar(err.message)}
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

if (esPaginaAsignaturas) {
  cargarAsignaturas();
}
