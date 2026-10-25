import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';
import * as sesion from './sesion.js';

/**
 * Obtiene el tema para una actividad educativa.
 * Contrato §A: obtenerTemaActividad() → Promise<tema>
 * Usa el parámetro ?temaId= o despliega un selector modal accesible.
 *
 * @returns {Promise<Object>} Objeto tema seleccionado
 */
export async function obtenerTemaActividad() {
  const temaIdParam = util.parametro('temaId');

  if (temaIdParam) {
    try {
      const tema = await api.obtener('temas', temaIdParam);
      if (tema && tema.id) {
        return tema;
      }
    } catch {
      console.warn('Tema del parámetro no encontrado, abriendo selector');
    }
  }

  // Cargar temas disponibles para el usuario
  const usuario = sesion.usuarioActual();
  const [temas, unidades, asignaturas] = await Promise.all([
    api.listar('temas'),
    api.listar('unidades'),
    api.listar('asignaturas')
  ]);

  const mapaUnid = new Map(unidades.map(u => [u.id, u]));
  const mapaAsig = new Map(asignaturas.map(a => [a.id, a]));

  const temasDisponibles = temas.filter(t => {
    if (usuario && usuario.rol === 'estudiante' && t.estado !== 'publicado') {
      return false;
    }
    const unidad = mapaUnid.get(t.unidadId);
    return Boolean(unidad && mapaAsig.has(unidad.asignaturaId));
  }).map(t => {
    const unidad = mapaUnid.get(t.unidadId);
    const asig = unidad ? mapaAsig.get(unidad.asignaturaId) : null;
    return {
      ...t,
      nombreAsignatura: asig ? asig.nombre : '',
      nombreUnidad: unidad ? unidad.titulo : ''
    };
  });

  if (temasDisponibles.length === 0) {
    throw new Error('No hay temas disponibles para realizar esta actividad.');
  }

  if (temasDisponibles.length === 1) {
    return temasDisponibles[0];
  }

  // Desplegar selector en modal
  return new Promise((resolve) => {
    const contenedor = document.createElement('div');
    contenedor.className = 'pila';
    contenedor.style.gap = 'var(--espaciado-m)';

    contenedor.innerHTML = `
      <p style="color: var(--texto-suave); font-size: var(--tamano-s);">
        Selecciona el tema que deseas estudiar para iniciar la actividad:
      </p>
      <div class="campo">
        <label for="selectModalTema">Tema:</label>
        <select id="selectModalTema" class="campo__control" style="width: 100%;">
          ${temasDisponibles.map(t => `
            <option value="${t.id}">
              ${ui.escapar(t.nombreAsignatura ? t.nombreAsignatura + ' → ' : '')}${ui.escapar(t.titulo)}
            </option>
          `).join('')}
        </select>
      </div>
    `;

    ui.modal({
      titulo: 'Elegir tema',
      contenido: contenedor,
      acciones: [
        { texto: 'Seleccionar', valor: 'elegir', clase: 'btn--primario', principal: true }
      ]
    }).then(() => {
      const select = contenedor.querySelector('#selectModalTema');
      const elegidoId = select ? select.value : temasDisponibles[0].id;
      const temaElegido = temasDisponibles.find(t => t.id === elegidoId) || temasDisponibles[0];

      // Actualizar la URL sin recargar la página para recordar la selección
      const url = new URL(window.location.href);
      url.searchParams.set('temaId', temaElegido.id);
      window.history.replaceState({}, '', url.toString());

      resolve(temaElegido);
    });
  });
}

export default {
  obtenerTemaActividad
};
