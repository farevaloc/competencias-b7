import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Asignaturas', roles: ['admin'] });

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="asignaturas-seccion">
      <header class="asignaturas-cabecera">
        <div>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-bottom: var(--espaciado-xs);">Gestión de Asignaturas</h1>
          <p style="color: var(--texto-suave); font-size: var(--tamano-s);">Administra las materias y programas curriculares de la plataforma.</p>
        </div>
        <button type="button" class="btn btn--primario" id="btnNuevaAsignatura">
          + Nueva asignatura
        </button>
      </header>

      <div id="gridAsignaturas" class="asignaturas-grid">
        <p style="color: var(--texto-suave);">Cargando asignaturas...</p>
      </div>
    </section>
  `;

  const gridAsignaturas = document.getElementById('gridAsignaturas');
  const btnNueva = document.getElementById('btnNuevaAsignatura');

  let listaAsignaturas = [];
  let listaDistributivo = [];

  async function cargarDatos() {
    ui.cargando(true);
    try {
      [listaAsignaturas, listaDistributivo] = await Promise.all([
        api.listar('asignaturas'),
        api.listar('distributivo')
      ]);
      renderizar();
    } catch (err) {
      gridAsignaturas.innerHTML = `
        <div class="alerta alerta--error" style="grid-column: 1 / -1;">
          ${ui.escapar(err.message || 'Error al cargar asignaturas')}
        </div>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  function renderizar() {
    if (listaAsignaturas.length === 0) {
      gridAsignaturas.innerHTML = `
        <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espaciado-xl);">
          <p style="color: var(--texto-suave);">No hay asignaturas registradas actualmente.</p>
        </div>
      `;
      return;
    }

    gridAsignaturas.innerHTML = listaAsignaturas.map(a => {
      const gruposAsignatura = listaDistributivo.filter(d => d.asignaturaId === a.id);
      const numGrupos = gruposAsignatura.length;

      return `
        <article class="tarjeta tarjeta-asignatura" data-id="${ui.escapar(a.id)}">
          <div class="asignatura-cuerpo">
            <div class="asignatura-meta">
              <span class="insignia" style="text-transform: uppercase;">${ui.escapar(a.nivel || 'GENERAL')}</span>
              <span class="chip">${numGrupos} ${numGrupos === 1 ? 'grupo' : 'grupos'}</span>
            </div>
            <h2 style="font-size: var(--tamano-l); color: var(--primario); margin: var(--espaciado-xs) 0;">
              ${ui.escapar(a.nombre)}
            </h2>
            <p style="font-size: var(--tamano-s); color: var(--texto-suave); line-height: var(--interlineado-base);">
              ${ui.escapar(a.descripcion || 'Sin descripción disponible.')}
            </p>
          </div>

          <div class="asignatura-acciones">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(a.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(a.id)}" data-nombre="${ui.escapar(a.nombre)}" data-grupos="${numGrupos}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    }).join('');

    asociarEventos();
  }

  function asociarEventos() {
    // Editar asignatura
    gridAsignaturas.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const asignatura = listaAsignaturas.find(a => a.id === id);
        if (asignatura) {
          abrirModalFormulario(asignatura);
        }
      });
    });

    // Eliminar asignatura
    gridAsignaturas.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');
        const numGrupos = parseInt(btn.getAttribute('data-grupos') || '0', 10);

        if (numGrupos > 0) {
          ui.aviso(`No se puede eliminar la asignatura "${nombre}" porque tiene ${numGrupos} grupo(s) asignado(s) en el distributivo.`, 'advertencia');
          return;
        }

        const confirmado = await ui.confirmar(`¿Estás seguro de que deseas eliminar la asignatura "${nombre}"?`);
        if (!confirmado) return;

        ui.cargando(true);
        try {
          await api.eliminar('asignaturas', id);
          ui.aviso('Asignatura eliminada con éxito.', 'exito');
          await cargarDatos();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar la asignatura.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });
  }

  function abrirModalFormulario(asignatura = null) {
    const esEdicion = Boolean(asignatura);
    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';
    formContenedor.style.gap = 'var(--espaciado-m)';

    formContenedor.innerHTML = `
      <form id="formAsignaturaModal" novalidate>
        <div class="campo">
          <label for="txtModalNombre">Nombre de la asignatura</label>
          <input type="text" id="txtModalNombre" required value="${ui.escapar(asignatura ? asignatura.nombre : '')}" placeholder="Ej. Competencias Digitales">
          <span class="campo__error" id="errModalNombre" aria-live="polite"></span>
        </div>

        <div class="campo">
          <label for="txtModalNivel">Nivel académico</label>
          <input type="text" id="txtModalNivel" required value="${ui.escapar(asignatura ? (asignatura.nivel || '') : 'MAESTRÍA')}" placeholder="Ej. MAESTRÍA, PREGRADO, BÁSICA">
          <span class="campo__error" id="errModalNivel" aria-live="polite"></span>
        </div>

        <div class="campo">
          <label for="txtModalDescripcion">Descripción</label>
          <textarea id="txtModalDescripcion" rows="3" placeholder="Resumen del enfoque formativo de la asignatura...">${ui.escapar(asignatura ? (asignatura.descripcion || '') : '')}</textarea>
          <span class="campo__error" id="errModalDescripcion" aria-live="polite"></span>
        </div>
      </form>
    `;

    ui.modal({
      titulo: esEdicion ? 'Editar asignatura' : 'Nueva asignatura',
      contenido: formContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: esEdicion ? 'Guardar cambios' : 'Crear asignatura',
          valor: 'guardar',
          clase: 'btn--primario',
          principal: true
        }
      ]
    }).then(async (accion) => {
      if (accion !== 'guardar') return;

      const txtNombre = formContenedor.querySelector('#txtModalNombre');
      const txtNivel = formContenedor.querySelector('#txtModalNivel');
      const txtDesc = formContenedor.querySelector('#txtModalDescripcion');

      const nombre = txtNombre.value.trim();
      const nivel = txtNivel.value.trim().toUpperCase();
      const descripcion = txtDesc.value.trim();

      if (!nombre || !nivel) {
        ui.aviso('Nombre y nivel son campos obligatorios.', 'advertencia');
        return;
      }

      ui.cargando(true);
      try {
        const payload = { nombre, nivel, descripcion };
        if (esEdicion) {
          await api.actualizar('asignaturas', asignatura.id, payload);
          ui.aviso('Asignatura actualizada con éxito.', 'exito');
        } else {
          await api.crear('asignaturas', payload);
          ui.aviso('Asignatura creada con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar la asignatura.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  btnNueva.addEventListener('click', () => abrirModalFormulario(null));

  await cargarDatos();
}
