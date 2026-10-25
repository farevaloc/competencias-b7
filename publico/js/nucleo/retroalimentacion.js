import * as ui from './ui.js';

/**
 * Muestra la retroalimentación inmediata de una pregunta o ejercicio.
 * Contrato §A: mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema })
 *
 * @param {Object} opciones
 * @returns {Promise<void>}
 */
export function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema }) {
  return new Promise((resolve) => {
    const contenedor = document.createElement('div');
    contenedor.className = 'pila';
    contenedor.style.gap = 'var(--espaciado-m)';

    const estadoColor = correcto ? 'var(--exito)' : 'var(--error)';
    const estadoIcono = correcto ? '✓' : '✗';
    const estadoTexto = correcto ? '¡Respuesta correcta!' : 'Respuesta incorrecta';

    contenedor.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--espaciado-s);">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radio-pildora); background-color: ${estadoColor}; color: var(--texto-inverso); font-size: var(--tamano-l); font-weight: var(--peso-negrita);" aria-hidden="true">
          ${estadoIcono}
        </span>
        <h3 style="margin: 0; color: ${estadoColor}; font-size: var(--tamano-l); font-weight: var(--peso-negrita);">
          ${estadoTexto}
        </h3>
      </div>

      ${explicacion ? `
        <div style="background-color: var(--fondo); border-left: 4px solid ${estadoColor}; padding: var(--espaciado-m); border-radius: 0 var(--radio-m) var(--radio-m) 0; font-size: var(--tamano-s); line-height: var(--interlineado-base);">
          <strong>Explicación:</strong> ${ui.escapar(explicacion)}
        </div>
      ` : ''}

      ${sugerencia ? `
        <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">
          💡 <strong>Sugerencia:</strong> ${ui.escapar(sugerencia)}
        </div>
      ` : ''}

      ${enlaceTema ? `
        <div style="margin-top: var(--espaciado-xs);">
          <a href="${ui.escapar(enlaceTema)}" target="_blank" rel="noopener noreferrer" class="enlace" style="font-size: var(--tamano-xs);">
            📖 Repasar tema en una pestaña nueva →
          </a>
        </div>
      ` : ''}
    `;

    ui.modal({
      titulo: 'Retroalimentación formativa',
      contenido: contenedor,
      acciones: [
        { texto: 'Continuar', valor: 'continuar', clase: 'btn--primario', principal: true }
      ]
    }).then(() => resolve());
  });
}

/**
 * Muestra el resumen formativo al finalizar la actividad.
 * Contrato §A: mostrarResumen({ titulo, aciertos, errores, recomendaciones, enlaceTema }) → Promise<"repetir" | "salir">
 *
 * @param {Object} opciones
 * @returns {Promise<"repetir" | "salir">}
 */
export function mostrarResumen({ titulo = 'Resumen de la actividad', aciertos = 0, errores = 0, recomendaciones = [], enlaceTema = '' }) {
  return new Promise((resolve) => {
    const contenedor = document.createElement('div');
    contenedor.className = 'pila';
    contenedor.style.gap = 'var(--espaciado-m)';

    const total = aciertos + errores;
    const porcentaje = total > 0 ? Math.round((aciertos / total) * 100) : 0;
    const esExitoso = porcentaje >= 70;

    contenedor.innerHTML = `
      <div style="display: flex; gap: var(--espaciado-m); justify-content: space-around; background-color: var(--fondo); padding: var(--espaciado-m); border-radius: var(--radio-m); text-align: center;">
        <div>
          <div style="font-size: var(--tamano-2xl); font-weight: var(--peso-negrita); color: ${esExitoso ? 'var(--exito)' : 'var(--error)'};">
            ${porcentaje}%
          </div>
          <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">Puntaje final</div>
        </div>
        <div>
          <div style="font-size: var(--tamano-2xl); font-weight: var(--peso-negrita); color: var(--exito);">
            ${aciertos}
          </div>
          <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">Aciertos</div>
        </div>
        <div>
          <div style="font-size: var(--tamano-2xl); font-weight: var(--peso-negrita); color: var(--error);">
            ${errores}
          </div>
          <div style="font-size: var(--tamano-xs); color: var(--texto-suave);">Errores</div>
        </div>
      </div>

      ${Array.isArray(recomendaciones) && recomendaciones.length > 0 ? `
        <div style="border: 1px solid var(--borde); border-radius: var(--radio-m); padding: var(--espaciado-m);">
          <h4 style="margin: 0 0 var(--espaciado-xs) 0; font-size: var(--tamano-s); color: var(--primario);">
            Temas y conceptos recomendados para repasar:
          </h4>
          <ul style="margin: 0; padding-left: var(--espaciado-m); font-size: var(--tamano-xs); color: var(--texto-suave);">
            ${recomendaciones.map(r => `<li>${ui.escapar(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${enlaceTema ? `
        <div>
          <a href="${ui.escapar(enlaceTema)}" class="btn btn--texto btn--pequeno">
            📖 Volver al tema de estudio
          </a>
        </div>
      ` : ''}
    `;

    ui.modal({
      titulo,
      contenido: contenedor,
      acciones: [
        { texto: 'Repetir nivel', valor: 'repetir', clase: 'btn--secundario' },
        { texto: 'Aceptar', valor: 'salir', clase: 'btn--primario', principal: true }
      ]
    }).then((res) => {
      resolve(res === 'repetir' ? 'repetir' : 'salir');
    });
  });
}

export default {
  mostrarRetro,
  mostrarResumen
};
