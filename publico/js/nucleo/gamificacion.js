import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Cliente de gamificación para el navegador.
 * Contrato §A:
 * registrarIntento(...) → { puntosGanados, puntosTotales, insigniasNuevas }
 * mostrarLogros(resultado)
 * logrosDe(usuarioId = "yo") → { puntos, insignias, nivelQuiz }
 */

export async function registrarIntento({ actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }) {
  return api.llamar('POST', '/api/intentos', {
    actividad,
    temaId,
    nivel,
    puntaje,
    maximo,
    errores,
    duracionSeg,
    detalle
  });
}

export async function logrosDe(usuarioId = 'yo') {
  return api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

export function mostrarLogros(resultado) {
  if (!resultado) return;
  const { puntosGanados = 0, puntosTotales = 0, insigniasNuevas = [] } = resultado;

  if (puntosGanados === 0 && (!Array.isArray(insigniasNuevas) || insigniasNuevas.length === 0)) {
    return;
  }

  const contenedor = document.createElement('div');
  contenedor.className = 'pila';
  contenedor.style.gap = 'var(--espaciado-m)';
  contenedor.style.textAlign = 'center';

  let insigniasHtml = '';
  if (Array.isArray(insigniasNuevas) && insigniasNuevas.length > 0) {
    insigniasHtml = `
      <div style="margin-top: var(--espaciado-s);">
        <h4 style="color: var(--acento); margin-bottom: var(--espaciado-s); font-size: var(--tamano-s);">
          ¡Nueva(s) insignia(s) desbloqueada(s)!
        </h4>
        <div style="display: flex; gap: var(--espaciado-s); justify-content: center; flex-wrap: wrap;">
          ${insigniasNuevas.map(ins => `
            <div style="border: 1px solid var(--borde); border-radius: var(--radio-m); padding: var(--espaciado-s); background-color: var(--fondo); display: flex; flex-direction: column; align-items: center; min-width: 100px;">
              <span style="font-size: var(--tamano-2xl);" aria-hidden="true">${ui.escapar(ins.icono || '🎖️')}</span>
              <strong style="font-size: var(--tamano-xs); margin-top: 4px; color: var(--primario);">${ui.escapar(ins.nombre)}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  contenedor.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: -10px;">🌟</div>
    <h3 style="color: var(--primario); margin: 0; font-size: var(--tamano-xl);">¡Felicitaciones!</h3>

    <div style="background-color: var(--fondo); padding: var(--espaciado-m); border-radius: var(--radio-m); display: flex; justify-content: space-around; align-items: center;">
      <div>
        <div style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); color: var(--exito);">
          +${puntosGanados}
        </div>
        <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">Puntos ganados</div>
      </div>
      <div style="width: 1px; height: 30px; background-color: var(--borde);"></div>
      <div>
        <div style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); color: var(--primario);">
          ${puntosTotales}
        </div>
        <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">Puntos totales</div>
      </div>
    </div>

    ${insigniasHtml}
  `;

  ui.modal({
    titulo: 'Logros obtenidos',
    contenido: contenedor,
    acciones: [
      { texto: '¡Genial!', valor: 'ok', clase: 'btn--primario', principal: true }
    ]
  });
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};
