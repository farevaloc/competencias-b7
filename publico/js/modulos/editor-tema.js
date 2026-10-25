import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Ficha del tema', roles: ['docente', 'admin'] });

const temaId = util.parametro('id');
const contenedor = document.getElementById('contenido');

if (!temaId) {
  if (contenedor) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        No se especificó ningún identificador de tema.
        <a href="/paginas/editor-contenidos.html" class="enlace" style="margin-left: var(--espaciado-s);">
          Volver al editor de contenidos
        </a>
      </div>
    `;
  }
} else {
  iniciarEditor();
}

async function iniciarEditor() {
  ui.cargando(true);
  let tema = null;
  let listaGlosario = [];
  let hayCambiosSinGuardar = false;

  try {
    const [temaData, todosGlosario] = await Promise.all([
      api.obtener('temas', temaId),
      api.listar('glosario')
    ]);

    tema = temaData;
    listaGlosario = todosGlosario.filter(g => g.temaId === temaId);
  } catch (err) {
    if (contenedor) {
      contenedor.innerHTML = `
        <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
          Error al cargar los datos del tema: ${ui.escapar(err.message)}
          <br><a href="/paginas/editor-contenidos.html" class="enlace">Volver al editor de contenidos</a>
        </div>
      `;
    }
    ui.cargando(false);
    return;
  } finally {
    ui.cargando(false);
  }

  // Copias locales para edición dinámica
  let objetivos = Array.isArray(tema.objetivos) ? [...tema.objetivos] : [];
  let ejemplos = Array.isArray(tema.ejemplos) ? [...tema.ejemplos] : [];
  let erroresFrecuentes = Array.isArray(tema.erroresFrecuentes) ? [...tema.erroresFrecuentes] : [];
  let preguntasGuia = Array.isArray(tema.preguntasGuia) ? [...tema.preguntasGuia] : [];
  let recursos = Array.isArray(tema.recursos) ? JSON.parse(JSON.stringify(tema.recursos)) : [];

  function marcarCambio() {
    hayCambiosSinGuardar = true;
  }

  window.addEventListener('beforeunload', (e) => {
    if (hayCambiosSinGuardar) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  function contarPalabras(texto) {
    if (!texto) return 0;
    const palabras = texto.trim().match(/\S+/g);
    return palabras ? palabras.length : 0;
  }

  function renderizarVista() {
    contenedor.innerHTML = `
      <section class="editor-tema-seccion">
        <!-- Cabecera de acciones -->
        <header class="tema-cabecera-acciones">
          <div>
            <a href="/paginas/editor-contenidos.html" class="enlace" id="enlaceVolver">
              ← Volver a contenidos
            </a>
            <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-top: var(--espaciado-xs);">
              ${ui.escapar(tema.titulo)}
            </h1>
          </div>

          <div style="display: flex; gap: var(--espaciado-s); align-items: center; flex-wrap: wrap;">
            <button type="button" class="btn btn--secundario" id="btn-generar-ia" disabled title="Función disponible en la fase P07.2">
              ✨ Generar con IA
            </button>
            <button type="button" class="btn btn--primario" id="btnGuardarFicha">
              Guardar cambios
            </button>
          </div>
        </header>

        <!-- Bloque 1: Datos principales y Metadatos -->
        <div class="tema-bloque-grid">
          <!-- Columna principal -->
          <div class="pila" style="gap: var(--espaciado-l);">
            <div class="tarjeta">
              <h2 style="font-size: var(--tamano-l); color: var(--primario); margin-bottom: var(--espaciado-m);">
                Información general
              </h2>

              <div class="campo">
                <label for="txtTitulo">Título del tema</label>
                <input type="text" id="txtTitulo" value="${ui.escapar(tema.titulo || '')}" required>
              </div>

              <div class="campo">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label for="txtResumen" style="margin-bottom: 0;">Resumen formativo (admite formato básico)</label>
                  <button type="button" class="btn btn--texto btn--pequeno" id="btnAlternarVistaResumen">
                    Previsualizar
                  </button>
                </div>
                <textarea id="txtResumen" rows="8" placeholder="Escribe el resumen formativo (recomendado de 300 a 800 palabras)...">${ui.escapar(tema.resumen || '')}</textarea>
                <div class="contador-palabras">
                  <span id="lblContadorResumen">0 palabras</span>
                  <span style="font-size: var(--tamano-xs);">Recomendado: 300 a 800 palabras</span>
                </div>
                <div id="vistaPreviaResumen" class="alerta alerta--info" style="display: none; margin-top: var(--espaciado-s);"></div>
              </div>
            </div>

            <!-- Listas pedagógicas -->
            <div class="tarjeta">
              <h2 style="font-size: var(--tamano-l); color: var(--primario); margin-bottom: var(--espaciado-m);">
                Estructura pedagógica
              </h2>

              <!-- Objetivos -->
              <div class="campo">
                <label>Objetivos de aprendizaje</label>
                <div id="listaObjetivos" class="lista-dinamica"></div>
                <div style="display: flex; gap: var(--espaciado-s);">
                  <input type="text" id="inputNuevoObjetivo" placeholder="Nuevo objetivo..." style="margin-bottom: 0;">
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarObjetivo">Agregar</button>
                </div>
              </div>

              <!-- Ejemplos -->
              <div class="campo">
                <label>Ejemplos y aplicaciones prácticas</label>
                <div id="listaEjemplos" class="lista-dinamica"></div>
                <div style="display: flex; gap: var(--espaciado-s);">
                  <input type="text" id="inputNuevoEjemplo" placeholder="Nuevo ejemplo..." style="margin-bottom: 0;">
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarEjemplo">Agregar</button>
                </div>
              </div>

              <!-- Errores frecuentes -->
              <div class="campo">
                <label>Errores frecuentes y conceptos erróneos</label>
                <div id="listaErrores" class="lista-dinamica"></div>
                <div style="display: flex; gap: var(--espaciado-s);">
                  <input type="text" id="inputNuevoError" placeholder="Nuevo error frecuente..." style="margin-bottom: 0;">
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarError">Agregar</button>
                </div>
              </div>

              <!-- Preguntas guía -->
              <div class="campo" style="margin-bottom: 0;">
                <label>Preguntas guía de reflexión</label>
                <div id="listaPreguntas" class="lista-dinamica"></div>
                <div style="display: flex; gap: var(--espaciado-s);">
                  <input type="text" id="inputNuevaPregunta" placeholder="Nueva pregunta guía..." style="margin-bottom: 0;">
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarPregunta">Agregar</button>
                </div>
              </div>
            </div>

            <!-- Recursos multimedia -->
            <div class="tarjeta">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-m);">
                <h2 style="font-size: var(--tamano-l); color: var(--primario); margin: 0;">
                  Recursos complementarios
                </h2>
                <button type="button" class="btn btn--secundario btn--pequeno" id="btnAgregarRecurso">
                  + Agregar recurso
                </button>
              </div>

              <div id="contenedorRecursos" class="pila" style="gap: var(--espaciado-s);"></div>
              <input type="file" id="inputArchivoRecursoOculto" style="display: none;">
            </div>
          </div>

          <!-- Columna lateral: Metadatos -->
          <aside class="pila" style="gap: var(--espaciado-l);">
            <div class="tarjeta">
              <h2 style="font-size: var(--tamano-l); color: var(--primario); margin-bottom: var(--espaciado-m);">
                Metadatos
              </h2>

              <div class="campo">
                <label for="selEstado">Estado de publicación</label>
                <select id="selEstado">
                  <option value="borrador" ${tema.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                  <option value="publicado" ${tema.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
                </select>
              </div>

              <div class="campo">
                <label for="selDificultad">Dificultad</label>
                <select id="selDificultad">
                  <option value="básico" ${tema.dificultad === 'básico' ? 'selected' : ''}>Básico</option>
                  <option value="intermedio" ${tema.dificultad === 'intermedio' ? 'selected' : ''}>Intermedio</option>
                  <option value="avanzado" ${tema.dificultad === 'avanzado' ? 'selected' : ''}>Avanzado</option>
                </select>
              </div>

              <div class="campo">
                <label for="txtPalabrasClave">Palabras clave (separadas por comas)</label>
                <input type="text" id="txtPalabrasClave" value="${ui.escapar(Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(', ') : '')}" placeholder="LMS, Moodle, Didáctica">
              </div>

              <div class="campo" style="margin-bottom: 0;">
                <label for="txtFuentes">Fuentes bibliográficas</label>
                <textarea id="txtFuentes" rows="4" placeholder="Referencias bibliográficas en formato académico...">${ui.escapar(tema.fuentes || '')}</textarea>
              </div>
            </div>
          </aside>
        </div>

        <!-- Bloque 2: Glosario -->
        <div class="tarjeta">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espaciado-m); margin-bottom: var(--espaciado-m);">
            <div>
              <h2 style="font-size: var(--tamano-l); color: var(--primario); margin-bottom: var(--espaciado-xs);">
                Glosario del tema
              </h2>
              <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin: 0;">
                Términos clave para el glosario interactivo y mecánicas de gamificación.
              </p>
            </div>
            <button type="button" class="btn btn--primario btn--pequeno" id="btnNuevoTermino">
              + Nuevo término
            </button>
          </div>

          <div class="glosario-metricas" id="panelMetricasGlosario"></div>

          <div class="tabla-contenedor" style="overflow-x: auto;">
            <table class="tabla" id="tablaGlosario">
              <thead>
                <tr>
                  <th scope="col" style="width: 140px;">Término</th>
                  <th scope="col">Definición (máx 25 pal.)</th>
                  <th scope="col" style="width: 180px;">Pista (máx 10 pal.)</th>
                  <th scope="col">Retroalimentación</th>
                  <th scope="col" style="width: 140px; text-align: right;">Acciones</th>
                </tr>
              </thead>
              <tbody id="cuerpoTablaGlosario"></tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    asociarEventosCompletos();
  }

  function asociarEventosCompletos() {
    const txtTitulo = document.getElementById('txtTitulo');
    const txtResumen = document.getElementById('txtResumen');
    const lblContadorResumen = document.getElementById('lblContadorResumen');
    const btnAlternarVistaResumen = document.getElementById('btnAlternarVistaResumen');
    const vistaPreviaResumen = document.getElementById('vistaPreviaResumen');
    const selEstado = document.getElementById('selEstado');
    const selDificultad = document.getElementById('selDificultad');
    const txtPalabrasClave = document.getElementById('txtPalabrasClave');
    const txtFuentes = document.getElementById('txtFuentes');
    const btnGuardarFicha = document.getElementById('btnGuardarFicha');
    const enlaceVolver = document.getElementById('enlaceVolver');

    // Manejo de advertencia al salir con cambios
    enlaceVolver.addEventListener('click', async (e) => {
      if (hayCambiosSinGuardar) {
        e.preventDefault();
        const salir = await ui.confirmar('Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?');
        if (salir) {
          hayCambiosSinGuardar = false;
          window.location.href = enlaceVolver.getAttribute('href');
        }
      }
    });

    [txtTitulo, txtResumen, selEstado, selDificultad, txtPalabrasClave, txtFuentes].forEach(el => {
      el.addEventListener('input', marcarCambio);
      el.addEventListener('change', marcarCambio);
    });

    // Contador de palabras del resumen
    function actualizarContadorResumen() {
      const num = contarPalabras(txtResumen.value);
      lblContadorResumen.textContent = `${num} palabras`;
      if (num >= 300 && num <= 800) {
        lblContadorResumen.className = 'contador-palabras--optimo';
      } else {
        lblContadorResumen.className = '';
      }
    }

    txtResumen.addEventListener('input', actualizarContadorResumen);
    actualizarContadorResumen();

    // Alternar previsualización de resumen
    btnAlternarVistaResumen.addEventListener('click', () => {
      if (vistaPreviaResumen.style.display === 'none') {
        vistaPreviaResumen.innerHTML = util.formatoBasico(txtResumen.value) || '<p><em>(Sin contenido)</em></p>';
        vistaPreviaResumen.style.display = 'block';
        btnAlternarVistaResumen.textContent = 'Ocultar vista previa';
      } else {
        vistaPreviaResumen.style.display = 'none';
        btnAlternarVistaResumen.textContent = 'Previsualizar';
      }
    });

    // Renderizar listas simples (objetivos, ejemplos, etc.)
    renderizarListaSimple('listaObjetivos', objetivos, (idx) => {
      objetivos.splice(idx, 1);
      marcarCambio();
      asociarEventosCompletos();
    });
    renderizarListaSimple('listaEjemplos', ejemplos, (idx) => {
      ejemplos.splice(idx, 1);
      marcarCambio();
      asociarEventosCompletos();
    });
    renderizarListaSimple('listaErrores', erroresFrecuentes, (idx) => {
      erroresFrecuentes.splice(idx, 1);
      marcarCambio();
      asociarEventosCompletos();
    });
    renderizarListaSimple('listaPreguntas', preguntasGuia, (idx) => {
      preguntasGuia.splice(idx, 1);
      marcarCambio();
      asociarEventosCompletos();
    });

    // Agregar a listas simples
    document.getElementById('btnAgregarObjetivo').addEventListener('click', () => {
      const inp = document.getElementById('inputNuevoObjetivo');
      if (inp.value.trim()) {
        objetivos.push(inp.value.trim());
        marcarCambio();
        asociarEventosCompletos();
      }
    });

    document.getElementById('btnAgregarEjemplo').addEventListener('click', () => {
      const inp = document.getElementById('inputNuevoEjemplo');
      if (inp.value.trim()) {
        ejemplos.push(inp.value.trim());
        marcarCambio();
        asociarEventosCompletos();
      }
    });

    document.getElementById('btnAgregarError').addEventListener('click', () => {
      const inp = document.getElementById('inputNuevoError');
      if (inp.value.trim()) {
        erroresFrecuentes.push(inp.value.trim());
        marcarCambio();
        asociarEventosCompletos();
      }
    });

    document.getElementById('btnAgregarPregunta').addEventListener('click', () => {
      const inp = document.getElementById('inputNuevaPregunta');
      if (inp.value.trim()) {
        preguntasGuia.push(inp.value.trim());
        marcarCambio();
        asociarEventosCompletos();
      }
    });

    // Renderizar recursos
    renderizarRecursos();

    document.getElementById('btnAgregarRecurso').addEventListener('click', () => {
      recursos.push({ tipo: 'enlace', titulo: '', url: '' });
      marcarCambio();
      renderizarRecursos();
    });

    // Guardar ficha del tema
    btnGuardarFicha.addEventListener('click', async () => {
      const tituloVal = txtTitulo.value.trim();
      if (!tituloVal) {
        ui.aviso('El título del tema es obligatorio.', 'advertencia');
        return;
      }

      const palabrasArr = txtPalabrasClave.value
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      const payload = {
        titulo: tituloVal,
        resumen: txtResumen.value,
        estado: selEstado.value,
        dificultad: selDificultad.value,
        palabrasClave: palabrasArr,
        fuentes: txtFuentes.value.trim(),
        objetivos,
        ejemplos,
        erroresFrecuentes,
        preguntasGuia,
        recursos
      };

      btnGuardarFicha.disabled = true;
      ui.cargando(true);
      try {
        await api.actualizar('temas', tema.id, payload);
        hayCambiosSinGuardar = false;
        ui.aviso('Ficha del tema guardada con éxito.', 'exito');
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar la ficha del tema.', 'error');
      } finally {
        btnGuardarFicha.disabled = false;
        ui.cargando(false);
      }
    });

    // Glosario
    actualizarMetricasGlosario();
    renderizarTablaGlosario();
    document.getElementById('btnNuevoTermino').addEventListener('click', () => abrirModalGlosario(null));
  }

  function renderizarListaSimple(idContenedor, lista, onEliminar) {
    const contenedorLista = document.getElementById(idContenedor);
    if (!contenedorLista) return;

    if (lista.length === 0) {
      contenedorLista.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--texto-suave);">No hay elementos agregados.</span>`;
      return;
    }

    contenedorLista.innerHTML = lista.map((item, idx) => `
      <div class="lista-dinamica-item">
        <span>${ui.escapar(item)}</span>
        <button type="button" class="btn btn--texto btn--pequeno btn-eliminar-item" data-idx="${idx}" title="Quitar elemento" style="color: var(--error); padding: 0 var(--espaciado-xs);">
          ✕
        </button>
      </div>
    `).join('');

    contenedorLista.querySelectorAll('.btn-eliminar-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        onEliminar(idx);
      });
    });
  }

  function renderizarRecursos() {
    const contenedorRecursos = document.getElementById('contenedorRecursos');
    const inputArchivoOculto = document.getElementById('inputArchivoRecursoOculto');
    if (!contenedorRecursos) return;

    if (recursos.length === 0) {
      contenedorRecursos.innerHTML = `
        <span style="font-size: var(--tamano-xs); color: var(--texto-suave);">No hay recursos agregados.</span>
      `;
      return;
    }

    contenedorRecursos.innerHTML = recursos.map((rec, idx) => {
      const admiteSubida = rec.tipo === 'pdf' || rec.tipo === 'imagen';
      return `
        <div class="recurso-fila" data-idx="${idx}">
          <select class="sel-tipo-recurso campo" style="margin-bottom: 0;">
            <option value="video" ${rec.tipo === 'video' ? 'selected' : ''}>Video</option>
            <option value="pdf" ${rec.tipo === 'pdf' ? 'selected' : ''}>PDF</option>
            <option value="imagen" ${rec.tipo === 'imagen' ? 'selected' : ''}>Imagen</option>
            <option value="enlace" ${rec.tipo === 'enlace' ? 'selected' : ''}>Enlace</option>
          </select>

          <input type="text" class="txt-titulo-recurso campo" style="margin-bottom: 0;" placeholder="Título del recurso..." value="${ui.escapar(rec.titulo || '')}">

          <input type="text" class="txt-url-recurso campo" style="margin-bottom: 0;" placeholder="URL o enlace..." value="${ui.escapar(rec.url || '')}">

          ${admiteSubida ? `<button type="button" class="btn btn--secundario btn--pequeno btn-subir-recurso" data-idx="${idx}">Subir</button>` : '<div></div>'}

          <button type="button" class="btn btn--texto btn--pequeno btn-quitar-recurso" data-idx="${idx}" style="color: var(--error);" title="Quitar recurso">
            ✕
          </button>
        </div>
      `;
    }).join('');

    // Eventos de cambios en recursos
    contenedorRecursos.querySelectorAll('.recurso-fila').forEach(fila => {
      const idx = parseInt(fila.getAttribute('data-idx'), 10);
      const selTipo = fila.querySelector('.sel-tipo-recurso');
      const txtTitulo = fila.querySelector('.txt-titulo-recurso');
      const txtUrl = fila.querySelector('.txt-url-recurso');
      const btnSubir = fila.querySelector('.btn-subir-recurso');
      const btnQuitar = fila.querySelector('.btn-quitar-recurso');

      selTipo.addEventListener('change', (e) => {
        recursos[idx].tipo = e.target.value;
        marcarCambio();
        renderizarRecursos();
      });

      txtTitulo.addEventListener('input', (e) => {
        recursos[idx].titulo = e.target.value;
        marcarCambio();
      });

      txtUrl.addEventListener('input', (e) => {
        recursos[idx].url = e.target.value;
        marcarCambio();
      });

      if (btnSubir) {
        btnSubir.addEventListener('click', () => {
          inputArchivoOculto.accept = recursos[idx].tipo === 'pdf' ? 'application/pdf' : 'image/jpeg,image/png,image/webp';
          inputArchivoOculto.onchange = async (e) => {
            const archivo = e.target.files && e.target.files[0];
            if (!archivo) return;

            ui.cargando(true);
            try {
              const res = await api.subir(archivo);
              if (res && res.url) {
                recursos[idx].url = res.url;
                if (!recursos[idx].titulo) {
                  recursos[idx].titulo = archivo.name;
                }
                marcarCambio();
                renderizarRecursos();
                ui.aviso('Archivo subido correctamente.', 'exito');
              }
            } catch (err) {
              ui.aviso(err.message || 'Error al subir archivo', 'error');
            } finally {
              ui.cargando(false);
              inputArchivoOculto.value = '';
            }
          };
          inputArchivoOculto.click();
        });
      }

      btnQuitar.addEventListener('click', () => {
        recursos.splice(idx, 1);
        marcarCambio();
        renderizarRecursos();
      });
    });
  }

  function actualizarMetricasGlosario() {
    const panel = document.getElementById('panelMetricasGlosario');
    if (!panel) return;

    const total = listaGlosario.length;
    const deSeis = listaGlosario.filter(g => util.normalizar(g.termino).length === 6).length;
    const apto = total >= 12 && deSeis >= 3;

    panel.innerHTML = `
      <div><strong>Total de términos:</strong> <span class="chip">${total}</span></div>
      <div><strong>Términos de 6 letras:</strong> <span class="chip">${deSeis}</span></div>
      <div>
        <strong>Estado para juegos:</strong>
        ${apto
          ? `<span class="insignia insignia--apto">✓ Apto para juegos</span>`
          : `<span class="insignia insignia--pendiente">Pendiente (mínimo 12 términos y 3 de 6 letras)</span>`
        }
      </div>
    `;
  }

  function renderizarTablaGlosario() {
    const cuerpo = document.getElementById('cuerpoTablaGlosario');
    if (!cuerpo) return;

    if (listaGlosario.length === 0) {
      cuerpo.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
            No hay términos en el glosario para este tema.
          </td>
        </tr>
      `;
      return;
    }

    cuerpo.innerHTML = listaGlosario.map(g => {
      const normalizado = util.normalizar(g.termino);
      const tiene6 = normalizado.length === 6;

      return `
        <tr data-id="${ui.escapar(g.id)}">
          <td>
            <strong>${ui.escapar(g.termino)}</strong>
            ${tiene6 ? '<br><span class="insignia" style="font-size: var(--tamano-xs);">6 letras</span>' : ''}
          </td>
          <td>${ui.escapar(g.definicion || '')}</td>
          <td>${ui.escapar(g.pista || '')}</td>
          <td>${ui.escapar(g.retroalimentacion || '')}</td>
          <td style="text-align: right;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-editar-glosario" data-id="${ui.escapar(g.id)}">
              Editar
            </button>
            <button type="button" class="btn btn--peligro btn--pequeno btn-eliminar-glosario" data-id="${ui.escapar(g.id)}">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos editar y eliminar de glosario
    cuerpo.querySelectorAll('.btn-editar-glosario').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const terminoObj = listaGlosario.find(g => g.id === id);
        if (terminoObj) abrirModalGlosario(terminoObj);
      });
    });

    cuerpo.querySelectorAll('.btn-eliminar-glosario').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmado = await ui.confirmar('¿Estás seguro de que deseas eliminar este término del glosario?');
        if (!confirmado) return;

        ui.cargando(true);
        try {
          await api.eliminar('glosario', id);
          listaGlosario = listaGlosario.filter(g => g.id !== id);
          actualizarMetricasGlosario();
          renderizarTablaGlosario();
          ui.aviso('Término eliminado con éxito.', 'exito');
        } catch (err) {
          ui.aviso(err.message || 'Error al eliminar término.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });
  }

  function abrirModalGlosario(terminoObj = null) {
    const esEdicion = Boolean(terminoObj);
    const formContenedor = document.createElement('div');
    formContenedor.className = 'pila';
    formContenedor.style.gap = 'var(--espaciado-m)';

    formContenedor.innerHTML = `
      <form id="formGlosarioModal" novalidate>
        <div class="campo">
          <label for="txtModalTermino">Término (de preferencia una sola palabra)</label>
          <input type="text" id="txtModalTermino" required value="${ui.escapar(terminoObj ? terminoObj.termino : '')}" placeholder="Ej. Moodle">
        </div>

        <div class="campo">
          <div style="display: flex; justify-content: space-between;">
            <label for="txtModalDefinicion">Definición</label>
            <span id="lblPalabrasDefinicion" style="font-size: var(--tamano-xs); color: var(--texto-suave);">Máx 25 palabras</span>
          </div>
          <textarea id="txtModalDefinicion" rows="3" required placeholder="Definición pedagógica concisa...">${ui.escapar(terminoObj ? (terminoObj.definicion || '') : '')}</textarea>
        </div>

        <div class="campo">
          <div style="display: flex; justify-content: space-between;">
            <label for="txtModalPista">Pista para juegos</label>
            <span id="lblPalabrasPista" style="font-size: var(--tamano-xs); color: var(--texto-suave);">Máx 10 palabras</span>
          </div>
          <input type="text" id="txtModalPista" value="${ui.escapar(terminoObj ? (terminoObj.pista || '') : '')}" placeholder="Ej. LMS de código abierto muy popular">
        </div>

        <div class="campo" style="margin-bottom: 0;">
          <label for="txtModalRetroalimentacion">Retroalimentación formativa</label>
          <textarea id="txtModalRetroalimentacion" rows="2" placeholder="Explicación formativa adicional...">${ui.escapar(terminoObj ? (terminoObj.retroalimentacion || '') : '')}</textarea>
        </div>
      </form>
    `;

    const txtDef = formContenedor.querySelector('#txtModalDefinicion');
    const lblDef = formContenedor.querySelector('#lblPalabrasDefinicion');
    const txtPista = formContenedor.querySelector('#txtModalPista');
    const lblPista = formContenedor.querySelector('#lblPalabrasPista');

    function actualizarContadoresModal() {
      const palDef = contarPalabras(txtDef.value);
      lblDef.textContent = `${palDef}/25 palabras`;
      lblDef.style.color = palDef > 25 ? 'var(--error)' : 'var(--texto-suave)';

      const palPista = contarPalabras(txtPista.value);
      lblPista.textContent = `${palPista}/10 palabras`;
      lblPista.style.color = palPista > 10 ? 'var(--error)' : 'var(--texto-suave)';
    }

    txtDef.addEventListener('input', actualizarContadoresModal);
    txtPista.addEventListener('input', actualizarContadoresModal);
    actualizarContadoresModal();

    ui.modal({
      titulo: esEdicion ? 'Editar término del glosario' : 'Nuevo término del glosario',
      contenido: formContenedor,
      acciones: [
        { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
        { texto: esEdicion ? 'Guardar' : 'Crear término', valor: 'guardar', clase: 'btn--primario', principal: true }
      ]
    }).then(async (accion) => {
      if (accion !== 'guardar') return;

      const txtTerm = formContenedor.querySelector('#txtModalTermino');
      const txtRetro = formContenedor.querySelector('#txtModalRetroalimentacion');

      const termino = txtTerm.value.trim();
      const definicion = txtDef.value.trim();
      const pista = txtPista.value.trim();
      const retroalimentacion = txtRetro.value.trim();

      if (!termino || !definicion) {
        ui.aviso('Término y definición son obligatorios.', 'advertencia');
        return;
      }

      if (contarPalabras(definicion) > 25) {
        ui.aviso('La definición no debe superar las 25 palabras.', 'advertencia');
        return;
      }

      if (contarPalabras(pista) > 10) {
        ui.aviso('La pista no debe superar las 10 palabras.', 'advertencia');
        return;
      }

      ui.cargando(true);
      try {
        const payload = {
          temaId,
          termino,
          definicion,
          pista,
          retroalimentacion,
          origen: 'docente',
          estado: 'aprobado'
        };

        if (esEdicion) {
          const actualizado = await api.actualizar('glosario', terminoObj.id, payload);
          const idx = listaGlosario.findIndex(g => g.id === terminoObj.id);
          if (idx !== -1) listaGlosario[idx] = actualizado;
          ui.aviso('Término actualizado con éxito.', 'exito');
        } else {
          const nuevo = await api.crear('glosario', payload);
          listaGlosario.push(nuevo);
          ui.aviso('Término agregado al glosario.', 'exito');
        }

        actualizarMetricasGlosario();
        renderizarTablaGlosario();
      } catch (err) {
        ui.aviso(err.message || 'Error al guardar término en el glosario.', 'error');
      } finally {
        ui.cargando(false);
      }
    });
  }

  renderizarVista();
}
