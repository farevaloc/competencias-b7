import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Distributivo', roles: ['admin'] });

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="distributivo-seccion">
      <header class="distributivo-cabecera">
        <div>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-bottom: var(--espaciado-xs);">Distributivo Académico</h1>
          <p style="color: var(--texto-suave); font-size: var(--tamano-s);">Asigna asignaturas, paralelos, docentes y estudiantes a cada grupo formativo.</p>
        </div>
        <button type="button" class="btn btn--primario" id="btnNuevoGrupo">
          + Nuevo grupo
        </button>
      </header>

      <div class="tarjeta" style="padding: 0; overflow: hidden;">
        <div class="tabla-contenedor" style="overflow-x: auto;">
          <table class="tabla" id="tablaDistributivo">
            <thead>
              <tr>
                <th scope="col">Asignatura</th>
                <th scope="col" style="width: 100px; text-align: center;">Paralelo</th>
                <th scope="col" style="width: 120px; text-align: center;">Período</th>
                <th scope="col">Docente</th>
                <th scope="col" style="width: 120px; text-align: center;">Estudiantes</th>
                <th scope="col" style="width: 180px; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoTablaDistributivo">
              <tr>
                <td colspan="6" style="text-align: center; padding: var(--espaciado-l);">Cargando distributivo...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const cuerpoTabla = document.getElementById('cuerpoTablaDistributivo');
  const btnNuevo = document.getElementById('btnNuevoGrupo');

  let listaDistributivo = [];
  let listaAsignaturas = [];
  let listaUsuarios = [];

  async function cargarDatos() {
    ui.cargando(true);
    try {
      [listaDistributivo, listaAsignaturas, listaUsuarios] = await Promise.all([
        api.listar('distributivo'),
        api.listar('asignaturas'),
        api.listar('usuarios')
      ]);
      renderizar();
    } catch (err) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--error); padding: var(--espaciado-l);">
            ${ui.escapar(err.message || 'Error al cargar distributivo')}
          </td>
        </tr>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  function renderizar() {
    if (listaDistributivo.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
            No hay grupos registrados en el distributivo.
          </td>
        </tr>
      `;
      return;
    }

    const mapaAsignaturas = new Map(listaAsignaturas.map(a => [a.id, a]));
    const mapaUsuarios = new Map(listaUsuarios.map(u => [u.id, u]));

    cuerpoTabla.innerHTML = listaDistributivo.map(d => {
      const asignatura = mapaAsignaturas.get(d.asignaturaId);
      const nombreAsignatura = asignatura ? asignatura.nombre : '(Asignatura desconocida)';
      const nivelAsignatura = asignatura && asignatura.nivel ? asignatura.nivel : '';

      const docente = mapaUsuarios.get(d.docenteId);
      const nombreDocente = docente
        ? `${docente.nombre} ${docente.apellido || ''}`.trim()
        : '(Sin docente asignado)';

      const totalEstudiantes = Array.isArray(d.estudiantes) ? d.estudiantes.length : 0;

      return `
        <tr data-id="${ui.escapar(d.id)}">
          <td>
            <strong>${ui.escapar(nombreAsignatura)}</strong>
            ${nivelAsignatura ? `<br><span class="insignia" style="font-size: var(--tamano-xs); text-transform: uppercase;">${ui.escapar(nivelAsignatura)}</span>` : ''}
          </td>
          <td style="text-align: center; font-weight: var(--peso-seminegrita);">
            ${ui.escapar(d.paralelo || '-')}
          </td>
          <td style="text-align: center;">
            <span class="chip">${ui.escapar(d.periodo || '-')}</span>
          </td>
          <td>
            ${ui.escapar(nombreDocente)}
          </td>
          <td style="text-align: center;">
            <span class="chip">${totalEstudiantes}</span>
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar" data-id="${ui.escapar(d.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar" data-id="${ui.escapar(d.id)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    asociarEventos();
  }

  function asociarEventos() {
    cuerpoTabla.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const grupo = listaDistributivo.find(d => d.id === id);
        if (grupo) {
          abrirModalFormulario(grupo);
        }
      });
    });

    cuerpoTabla.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmado = await ui.confirmar('¿Estás seguro de que deseas eliminar este grupo del distributivo?');
        if (!confirmado) return;

        ui.cargando(true);
        try {
          await api.eliminar('distributivo', id);
          ui.aviso('Grupo eliminado con éxito.', 'exito');
          await cargarDatos();
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar el grupo.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });
  }

  function abrirModalFormulario(grupo = null) {
    const esEdicion = Boolean(grupo);
    const docentes = listaUsuarios.filter(u => u.rol === 'docente' && u.activo !== false);
    const estudiantes = listaUsuarios.filter(u => u.rol === 'estudiante' && u.activo !== false);

    const seleccionadosSet = new Set(esEdicion && Array.isArray(grupo.estudiantes) ? grupo.estudiantes : []);

    const modalContenedor = document.createElement('div');
    modalContenedor.className = 'pila';
    modalContenedor.style.gap = 'var(--espaciado-m)';

    const opcionesAsignatura = listaAsignaturas.map(a => `
      <option value="${ui.escapar(a.id)}" ${grupo && grupo.asignaturaId === a.id ? 'selected' : ''}>
        ${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'GENERAL')})
      </option>
    `).join('');

    const opcionesDocente = docentes.map(doc => `
      <option value="${ui.escapar(doc.id)}" ${grupo && grupo.docenteId === doc.id ? 'selected' : ''}>
        ${ui.escapar(doc.nombre)} ${ui.escapar(doc.apellido || '')} (${ui.escapar(doc.correo)})
      </option>
    `).join('');

    modalContenedor.innerHTML = `
      <form id="formDistributivoModal" novalidate>
        <div class="campo">
          <label for="selModalAsignatura">Asignatura</label>
          <select id="selModalAsignatura" required>
            <option value="">Selecciona una asignatura...</option>
            ${opcionesAsignatura}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--espaciado-m);">
          <div class="campo">
            <label for="txtModalParalelo">Paralelo</label>
            <input type="text" id="txtModalParalelo" required value="${ui.escapar(grupo ? (grupo.paralelo || '') : 'A')}" placeholder="Ej. A">
          </div>
          <div class="campo">
            <label for="txtModalPeriodo">Período académico</label>
            <input type="text" id="txtModalPeriodo" required value="${ui.escapar(grupo ? (grupo.periodo || '') : '2026-2027')}" placeholder="Ej. 2026-2027">
          </div>
        </div>

        <div class="campo">
          <label for="selModalDocente">Docente responsable</label>
          <select id="selModalDocente" required>
            <option value="">Selecciona un docente...</option>
            ${opcionesDocente}
          </select>
        </div>

        <div class="campo" style="margin-bottom: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
            <label style="margin-bottom: 0;">Estudiantes del grupo</label>
            <span class="chip" id="lblContadorEstudiantes">${seleccionadosSet.size} seleccionados</span>
          </div>
          <input type="search" id="inputBuscarEstudiante" placeholder="Filtrar por nombre o correo..." style="margin-bottom: var(--espaciado-xs);">
          
          <div class="estudiantes-seleccion-lista" id="listaEstudiantesCheckboxes">
            <!-- Checkboxes de estudiantes -->
          </div>
        </div>
      </form>
    `;

    const contenedorCheckboxes = modalContenedor.querySelector('#listaEstudiantesCheckboxes');
    const inputBuscarEst = modalContenedor.querySelector('#inputBuscarEstudiante');
    const lblContador = modalContenedor.querySelector('#lblContadorEstudiantes');

    function renderizarEstudiantes(filtro = '') {
      const termino = filtro.trim().toLowerCase();
      const filtrados = estudiantes.filter(e => {
        const txt = `${e.nombre || ''} ${e.apellido || ''} ${e.correo || ''}`.toLowerCase();
        return !termino || txt.includes(termino);
      });

      if (filtrados.length === 0) {
        contenedorCheckboxes.innerHTML = `
          <div style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-s);">
            No se encontraron estudiantes.
          </div>
        `;
        return;
      }

      contenedorCheckboxes.innerHTML = filtrados.map(e => {
        const estaSeleccionado = seleccionadosSet.has(e.id);
        return `
          <label class="estudiante-item">
            <input type="checkbox" value="${ui.escapar(e.id)}" ${estaSeleccionado ? 'checked' : ''}>
            <span><strong>${ui.escapar(e.nombre)} ${ui.escapar(e.apellido || '')}</strong> <small style="color: var(--texto-suave);">(${ui.escapar(e.correo)})</small></span>
          </label>
        `;
      }).join('');

      contenedorCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', (ev) => {
          const val = ev.target.value;
          if (ev.target.checked) {
            seleccionadosSet.add(val);
          } else {
            seleccionadosSet.delete(val);
          }
          lblContador.textContent = `${seleccionadosSet.size} seleccionados`;
        });
      });
    }

    inputBuscarEst.addEventListener('input', (e) => {
      renderizarEstudiantes(e.target.value);
    });

    renderizarEstudiantes('');

    ui.modal({
      titulo: esEdicion ? 'Editar grupo del distributivo' : 'Nuevo grupo en el distributivo',
      contenido: modalContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        {
          texto: esEdicion ? 'Guardar cambios' : 'Crear grupo',
          valor: 'guardar',
          clase: 'btn--primario',
          principal: true
        }
      ]
    }).then(async (accion) => {
      if (accion !== 'guardar') return;

      const selAsg = modalContenedor.querySelector('#selModalAsignatura');
      const txtParalelo = modalContenedor.querySelector('#txtModalParalelo');
      const txtPeriodo = modalContenedor.querySelector('#txtModalPeriodo');
      const selDoc = modalContenedor.querySelector('#selModalDocente');

      const asignaturaId = selAsg.value;
      const paralelo = txtParalelo.value.trim().toUpperCase();
      const periodo = txtPeriodo.value.trim();
      const docenteId = selDoc.value;
      const listaEstudiantesIds = Array.from(seleccionadosSet);

      if (!asignaturaId || !paralelo || !periodo || !docenteId) {
        ui.aviso('Completa todos los campos obligatorios del grupo.', 'advertencia');
        return;
      }

      ui.cargando(true);
      try {
        const payload = {
          asignaturaId,
          paralelo,
          periodo,
          docenteId,
          estudiantes: listaEstudiantesIds
        };

        if (esEdicion) {
          await api.actualizar('distributivo', grupo.id, payload);
          ui.aviso('Grupo del distributivo actualizado con éxito.', 'exito');
        } else {
          await api.crear('distributivo', payload);
          ui.aviso('Grupo del distributivo creado con éxito.', 'exito');
        }
        await cargarDatos();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar el grupo.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  btnNuevo.addEventListener('click', () => abrirModalFormulario(null));

  await cargarDatos();
}
