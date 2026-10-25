import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Editor de contenidos', roles: ['docente', 'admin'] });

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="editor-seccion">
      <header class="editor-cabecera">
        <div>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-bottom: var(--espaciado-xs);">
            Editor de Contenidos Curriculares
          </h1>
          <p style="color: var(--texto-suave); font-size: var(--tamano-s);">
            Organiza unidades didácticas y temas para tus asignaturas asignadas.
          </p>
        </div>

        <div class="editor-selector-asignatura">
          <label for="selectAsignatura" style="font-weight: var(--peso-seminegrita); color: var(--primario);">
            Asignatura:
          </label>
          <select id="selectAsignatura" class="campo" style="margin-bottom: 0; flex: 1;">
            <option value="">Cargando asignaturas...</option>
          </select>
        </div>
      </header>

      <div class="editor-grid">
        <!-- Columna 1: Unidades -->
        <section class="tarjeta panel-columna">
          <div class="panel-cabecera">
            <h2 style="font-size: var(--tamano-l); color: var(--primario); margin: 0;">Unidades</h2>
            <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevaUnidad">
              + Nueva unidad
            </button>
          </div>
          <div id="listaUnidades" class="panel-lista">
            <p style="color: var(--texto-suave);">Selecciona una asignatura.</p>
          </div>
        </section>

        <!-- Columna 2: Temas de la unidad -->
        <section class="tarjeta panel-columna">
          <div class="panel-cabecera">
            <h2 style="font-size: var(--tamano-l); color: var(--primario); margin: 0;" id="tituloPanelTemas">
              Temas
            </h2>
            <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevoTema" disabled>
              + Nuevo tema
            </button>
          </div>
          <div id="listaTemas" class="panel-lista">
            <p style="color: var(--texto-suave);">Elige una unidad para gestionar sus temas.</p>
          </div>
        </section>
      </div>
    </section>
  `;

  const selectAsignatura = document.getElementById('selectAsignatura');
  const listaUnidadesContenedor = document.getElementById('listaUnidades');
  const listaTemasContenedor = document.getElementById('listaTemas');
  const tituloPanelTemas = document.getElementById('tituloPanelTemas');
  const btnNuevaUnidad = document.getElementById('btnNuevaUnidad');
  const btnNuevoTema = document.getElementById('btnNuevoTema');

  let misAsignaturas = [];
  let listaUnidades = [];
  let listaTemas = [];

  let asignaturaSeleccionadaId = null;
  let unidadSeleccionadaId = null;

  async function cargarAsignaturas() {
    ui.cargando(true);
    try {
      misAsignaturas = await api.listar('asignaturas');

      if (misAsignaturas.length === 0) {
        selectAsignatura.innerHTML = '<option value="">No tienes asignaturas disponibles</option>';
        listaUnidadesContenedor.innerHTML = `
          <div class="alerta alerta--advertencia">
            No tienes asignaturas vinculadas en este momento.
          </div>
        `;
        btnNuevaUnidad.disabled = true;
        return;
      }

      selectAsignatura.innerHTML = misAsignaturas.map(a => `
        <option value="${ui.escapar(a.id)}">
          ${ui.escapar(a.nombre)} (${ui.escapar(a.nivel || 'GENERAL')})
        </option>
      `).join('');

      asignaturaSeleccionadaId = misAsignaturas[0].id;
      await cargarContenidos();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar asignaturas', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  async function cargarContenidos() {
    if (!asignaturaSeleccionadaId) return;

    ui.cargando(true);
    try {
      [listaUnidades, listaTemas] = await Promise.all([
        api.listar('unidades'),
        api.listar('temas')
      ]);

      renderizarUnidades();
    } catch (err) {
      ui.aviso(err.message || 'Error al cargar contenidos', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function renderizarUnidades() {
    const unidadesDeAsignatura = listaUnidades
      .filter(u => u.asignaturaId === asignaturaSeleccionadaId)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    // Si la unidad seleccionada ya no existe en esta asignatura, seleccionar la primera
    if (!unidadesDeAsignatura.some(u => u.id === unidadSeleccionadaId)) {
      unidadSeleccionadaId = unidadesDeAsignatura.length > 0 ? unidadesDeAsignatura[0].id : null;
    }

    if (unidadesDeAsignatura.length === 0) {
      listaUnidadesContenedor.innerHTML = `
        <div style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
          Esta asignatura aún no tiene unidades creadas.
        </div>
      `;
      unidadSeleccionadaId = null;
      renderizarTemas();
      return;
    }

    listaUnidadesContenedor.innerHTML = unidadesDeAsignatura.map((u, index) => {
      const esSeleccionada = u.id === unidadSeleccionadaId;
      const esVisible = u.visible !== false;
      const esPrimera = index === 0;
      const esUltima = index === unidadesDeAsignatura.length - 1;

      return `
        <article class="item-tarjeta ${esSeleccionada ? 'item-tarjeta--seleccionado' : ''} ${!esVisible ? 'item-tarjeta--oculto' : ''}" data-id="${ui.escapar(u.id)}">
          <div class="item-cabecera btn-seleccionar-unidad" data-id="${ui.escapar(u.id)}">
            <span class="item-titulo">
              ${ui.escapar(u.titulo)}
            </span>
            <span class="insignia" style="font-size: var(--tamano-xs); text-transform: uppercase;">
              ${esVisible ? 'Visible' : 'Oculta'}
            </span>
          </div>

          <div class="item-acciones">
            <button type="button" class="btn btn--secundario btn-orden btn-subir-unidad" data-id="${ui.escapar(u.id)}" ${esPrimera ? 'disabled' : ''} title="Subir orden">
              ▲
            </button>
            <button type="button" class="btn btn--secundario btn-orden btn-bajar-unidad" data-id="${ui.escapar(u.id)}" ${esUltima ? 'disabled' : ''} title="Bajar orden">
              ▼
            </button>
            <button type="button" class="btn btn--texto btn--pequeno btn-visibilidad-unidad" data-id="${ui.escapar(u.id)}" title="${esVisible ? 'Ocultar unidad' : 'Hacer visible'}">
              ${esVisible ? '👁 Ocultar' : '👁 Mostrar'}
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btn-renombrar-unidad" data-id="${ui.escapar(u.id)}" data-titulo="${ui.escapar(u.titulo)}">
              Renombrar
            </button>
          </div>
        </article>
      `;
    }).join('');

    asociarEventosUnidades(unidadesDeAsignatura);
    renderizarTemas();
  }

  function asociarEventosUnidades(unidadesOrdenadas) {
    // Seleccionar unidad
    listaUnidadesContenedor.querySelectorAll('.btn-seleccionar-unidad').forEach(el => {
      el.addEventListener('click', () => {
        unidadSeleccionadaId = el.getAttribute('data-id');
        renderizarUnidades();
      });
    });

    // Subir orden unidad
    listaUnidadesContenedor.querySelectorAll('.btn-subir-unidad').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const index = unidadesOrdenadas.findIndex(u => u.id === id);
        if (index > 0) {
          const actual = unidadesOrdenadas[index];
          const anterior = unidadesOrdenadas[index - 1];
          await intercambiarOrdenUnidades(actual, anterior);
        }
      });
    });

    // Bajar orden unidad
    listaUnidadesContenedor.querySelectorAll('.btn-bajar-unidad').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const index = unidadesOrdenadas.findIndex(u => u.id === id);
        if (index < unidadesOrdenadas.length - 1) {
          const actual = unidadesOrdenadas[index];
          const siguiente = unidadesOrdenadas[index + 1];
          await intercambiarOrdenUnidades(actual, siguiente);
        }
      });
    });

    // Cambiar visibilidad
    listaUnidadesContenedor.querySelectorAll('.btn-visibilidad-unidad').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const unidad = unidadesOrdenadas.find(u => u.id === id);
        if (!unidad) return;

        const nuevoVisible = !(unidad.visible !== false);
        ui.cargando(true);
        try {
          await api.actualizar('unidades', id, { visible: nuevoVisible });
          unidad.visible = nuevoVisible;
          renderizarUnidades();
          ui.aviso(`Unidad ahora ${nuevoVisible ? 'visible' : 'oculta'}.`, 'exito');
        } catch (err) {
          ui.aviso(err.message || 'Error al cambiar visibilidad', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });

    // Renombrar unidad
    listaUnidadesContenedor.querySelectorAll('.btn-renombrar-unidad').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const unidad = unidadesOrdenadas.find(u => u.id === id);
        if (unidad) abrirModalRenombrarUnidad(unidad);
      });
    });
  }

  async function intercambiarOrdenUnidades(u1, u2) {
    ui.cargando(true);
    try {
      const orden1 = u1.orden || 1;
      const orden2 = u2.orden || 2;

      await Promise.all([
        api.actualizar('unidades', u1.id, { orden: orden2 }),
        api.actualizar('unidades', u2.id, { orden: orden1 })
      ]);

      u1.orden = orden2;
      u2.orden = orden1;
      renderizarUnidades();
    } catch (err) {
      ui.aviso(err.message || 'Error al reordenar unidades', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function renderizarTemas() {
    const unidadActual = listaUnidades.find(u => u.id === unidadSeleccionadaId);

    if (!unidadActual) {
      tituloPanelTemas.textContent = 'Temas';
      btnNuevoTema.disabled = true;
      listaTemasContenedor.innerHTML = `
        <div style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
          Elige o crea una unidad para gestionar sus temas.
        </div>
      `;
      return;
    }

    tituloPanelTemas.textContent = `Temas: ${unidadActual.titulo}`;
    btnNuevoTema.disabled = false;

    const temasDeUnidad = listaTemas
      .filter(t => t.unidadId === unidadActual.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    if (temasDeUnidad.length === 0) {
      listaTemasContenedor.innerHTML = `
        <div style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
          Esta unidad aún no tiene temas registrados.
        </div>
      `;
      return;
    }

    listaTemasContenedor.innerHTML = temasDeUnidad.map((t, index) => {
      const esPublicado = t.estado === 'publicado';
      const esPrimero = index === 0;
      const esUltimo = index === temasDeUnidad.length - 1;

      return `
        <article class="item-tarjeta" data-id="${ui.escapar(t.id)}">
          <div class="item-cabecera" style="cursor: default;">
            <span class="item-titulo">
              ${ui.escapar(t.titulo)}
            </span>
            <span class="chip" style="font-size: var(--tamano-xs); text-transform: capitalize;">
              ${esPublicado ? 'Publicado' : 'Borrador'}
            </span>
          </div>

          <div class="item-acciones">
            <button type="button" class="btn btn--secundario btn-orden btn-subir-tema" data-id="${ui.escapar(t.id)}" ${esPrimero ? 'disabled' : ''} title="Subir orden">
              ▲
            </button>
            <button type="button" class="btn btn--secundario btn-orden btn-bajar-tema" data-id="${ui.escapar(t.id)}" ${esUltimo ? 'disabled' : ''} title="Bajar orden">
              ▼
            </button>
            <button type="button" class="btn btn--secundario btn--pequeno btn-estado-tema" data-id="${ui.escapar(t.id)}">
              ${esPublicado ? 'Cambiar a borrador' : 'Publicar'}
            </button>
            <a href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}" class="btn btn--primario btn--pequeno">
              Editar ficha →
            </a>
          </div>
        </article>
      `;
    }).join('');

    asociarEventosTemas(temasDeUnidad);
  }

  function asociarEventosTemas(temasOrdenados) {
    // Subir tema
    listaTemasContenedor.querySelectorAll('.btn-subir-tema').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const index = temasOrdenados.findIndex(t => t.id === id);
        if (index > 0) {
          const actual = temasOrdenados[index];
          const anterior = temasOrdenados[index - 1];
          await intercambiarOrdenTemas(actual, anterior);
        }
      });
    });

    // Bajar tema
    listaTemasContenedor.querySelectorAll('.btn-bajar-tema').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const index = temasOrdenados.findIndex(t => t.id === id);
        if (index < temasOrdenados.length - 1) {
          const actual = temasOrdenados[index];
          const siguiente = temasOrdenados[index + 1];
          await intercambiarOrdenTemas(actual, siguiente);
        }
      });
    });

    // Cambiar estado borrador / publicado
    listaTemasContenedor.querySelectorAll('.btn-estado-tema').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const tema = temasOrdenados.find(t => t.id === id);
        if (!tema) return;

        const nuevoEstado = tema.estado === 'publicado' ? 'borrador' : 'publicado';
        ui.cargando(true);
        try {
          await api.actualizar('temas', id, { estado: nuevoEstado });
          tema.estado = nuevoEstado;
          renderizarTemas();
          ui.aviso(`Tema marcado como ${nuevoEstado}.`, 'exito');
        } catch (err) {
          ui.aviso(err.message || 'Error al cambiar estado del tema', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });
  }

  async function intercambiarOrdenTemas(t1, t2) {
    ui.cargando(true);
    try {
      const orden1 = t1.orden || 1;
      const orden2 = t2.orden || 2;

      await Promise.all([
        api.actualizar('temas', t1.id, { orden: orden2 }),
        api.actualizar('temas', t2.id, { orden: orden1 })
      ]);

      t1.orden = orden2;
      t2.orden = orden1;
      renderizarTemas();
    } catch (err) {
      ui.aviso(err.message || 'Error al reordenar temas', 'error');
    } finally {
      ui.cargando(false);
    }
  }

  function abrirModalNuevaUnidad() {
    if (!asignaturaSeleccionadaId) {
      ui.aviso('Selecciona una asignatura primero.', 'advertencia');
      return;
    }

    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';
    formContenedor.innerHTML = `
      <div class="campo">
        <label for="txtTituloNuevaUnidad">Título de la unidad</label>
        <input type="text" id="txtTituloNuevaUnidad" placeholder="Ej. Unidad 2: Tecnologías Emergentes" required>
      </div>
    `;

    ui.modal({
      titulo: 'Nueva unidad',
      contenido: formContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Crear unidad', valor: 'crear', clase: 'btn--primario', principal: true }
      ]
    }).then(async (accion) => {
      if (accion !== 'crear') return;

      const input = formContenedor.querySelector('#txtTituloNuevaUnidad');
      const titulo = input.value.trim();
      if (!titulo) {
        ui.aviso('El título de la unidad es obligatorio.', 'advertencia');
        return;
      }

      const unidadesDeAsignatura = listaUnidades.filter(u => u.asignaturaId === asignaturaSeleccionadaId);
      const maxOrden = unidadesDeAsignatura.reduce((max, u) => Math.max(max, u.orden || 0), 0);

      ui.cargando(true);
      try {
        const nuevaUnidad = await api.crear('unidades', {
          asignaturaId: asignaturaSeleccionadaId,
          titulo,
          orden: maxOrden + 1,
          visible: true
        });

        listaUnidades.push(nuevaUnidad);
        unidadSeleccionadaId = nuevaUnidad.id;
        renderizarUnidades();
        ui.aviso('Unidad creada con éxito.', 'exito');
      } catch (err) {
        ui.aviso(err.message || 'Error al crear la unidad.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  function abrirModalRenombrarUnidad(unidad) {
    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';
    formContenedor.innerHTML = `
      <div class="campo">
        <label for="txtRenombrarUnidad">Nuevo título de la unidad</label>
        <input type="text" id="txtRenombrarUnidad" value="${ui.escapar(unidad.titulo)}" required>
      </div>
    `;

    ui.modal({
      titulo: 'Renombrar unidad',
      contenido: formContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Guardar', valor: 'guardar', clase: 'btn--primario', principal: true }
      ]
    }).then(async (accion) => {
      if (accion !== 'guardar') return;

      const input = formContenedor.querySelector('#txtRenombrarUnidad');
      const nuevoTitulo = input.value.trim();
      if (!nuevoTitulo) {
        ui.aviso('El título no puede estar vacío.', 'advertencia');
        return;
      }

      ui.cargando(true);
      try {
        await api.actualizar('unidades', unidad.id, { titulo: nuevoTitulo });
        unidad.titulo = nuevoTitulo;
        renderizarUnidades();
        ui.aviso('Unidad renombrada con éxito.', 'exito');
      } catch (err) {
        ui.aviso(err.message || 'Error al renombrar la unidad.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  function abrirModalNuevoTema() {
    const unidadActual = listaUnidades.find(u => u.id === unidadSeleccionadaId);
    if (!unidadActual) {
      ui.aviso('Selecciona una unidad para agregar un tema.', 'advertencia');
      return;
    }

    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';
    formContenedor.innerHTML = `
      <div class="campo">
        <label for="txtTituloNuevoTema">Título del tema</label>
        <input type="text" id="txtTituloNuevoTema" placeholder="Ej. Tema 1: Modelos de mediación digital" required>
      </div>
      <p style="font-size: var(--tamano-xs); color: var(--texto-suave);">
        El tema se creará inicialmente en estado <strong>borrador</strong>. Podrás editar su ficha pedagógica completa a continuación.
      </p>
    `;

    ui.modal({
      titulo: 'Nuevo tema',
      contenido: formContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: 'Crear tema', valor: 'crear', clase: 'btn--primario', principal: true }
      ]
    }).then(async (accion) => {
      if (accion !== 'crear') return;

      const input = formContenedor.querySelector('#txtTituloNuevoTema');
      const titulo = input.value.trim();
      if (!titulo) {
        ui.aviso('El título del tema es obligatorio.', 'advertencia');
        return;
      }

      const temasDeUnidad = listaTemas.filter(t => t.unidadId === unidadActual.id);
      const maxOrden = temasDeUnidad.reduce((max, t) => Math.max(max, t.orden || 0), 0);

      ui.cargando(true);
      try {
        const nuevoTema = await api.crear('temas', {
          unidadId: unidadActual.id,
          titulo,
          orden: maxOrden + 1,
          estado: 'borrador',
          objetivos: [],
          resumen: '',
          ejemplos: [],
          erroresFrecuentes: [],
          preguntasGuia: [],
          recursos: [],
          palabrasClave: [],
          dificultad: 'intermedio',
          fuentes: ''
        });

        listaTemas.push(nuevoTema);
        renderizarTemas();
        ui.aviso('Tema creado como borrador con éxito.', 'exito');
      } catch (err) {
        ui.aviso(err.message || 'Error al crear el tema.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  selectAsignatura.addEventListener('change', async (e) => {
    asignaturaSeleccionadaId = e.target.value;
    unidadSeleccionadaId = null;
    await cargarContenidos();
  });

  btnNuevaUnidad.addEventListener('click', abrirModalNuevaUnidad);
  btnNuevoTema.addEventListener('click', abrirModalNuevoTema);

  await cargarAsignaturas();
}
