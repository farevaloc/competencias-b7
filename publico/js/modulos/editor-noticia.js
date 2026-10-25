import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de noticia', roles: ['docente', 'admin'] });

const noticiaId = util.parametro('id');
const contenedor = document.getElementById('contenido');

iniciar();

async function iniciar() {
  ui.cargando(true);
  let noticia = null;
  let temas = [];

  try {
    const promesas = [api.listar('temas')];
    if (noticiaId) {
      promesas.push(api.obtener('noticias', noticiaId));
    }

    const [temasData, noticiaData] = await Promise.all(promesas);
    temas = temasData || [];
    noticia = noticiaData || null;
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar los datos: ${ui.escapar(err.message)}
        <br><a href="/paginas/noticias.html" class="enlace">Volver a noticias</a>
      </div>
    `;
    ui.cargando(false);
    return;
  } finally {
    ui.cargando(false);
  }

  renderizarFormulario({ noticia, temas });
}

function renderizarFormulario({ noticia, temas }) {
  const esEdicion = Boolean(noticia);
  const categorias = ['Institucional', 'Académica', 'Eventos', 'Logros'];

  const temaOpciones = temas.map(t => `
    <option value="${ui.escapar(t.id)}" ${noticia && noticia.temaId === t.id ? 'selected' : ''}>
      ${ui.escapar(t.titulo)}
    </option>
  `).join('');

  contenedor.innerHTML = `
    <section class="editor-noticia-seccion">
      <header class="editor-noticia-cabecera">
        <div>
          <a href="/paginas/noticias.html" class="enlace">← Volver al listado de noticias</a>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-top: var(--espaciado-xs);">
            ${esEdicion ? 'Editar noticia' : 'Nueva noticia'}
          </h1>
        </div>

        <div style="display: flex; gap: var(--espaciado-s); align-items: center;">
          <button type="button" class="btn btn--secundario" id="btnAlternarVistaPrevia">
            👁 Previsualizar
          </button>
          <button type="button" class="btn btn--primario" id="btnGuardarNoticia">
            ${esEdicion ? 'Guardar cambios' : 'Publicar / Guardar'}
          </button>
        </div>
      </header>

      <form id="formEditorNoticia" class="editor-noticia-grid" novalidate>
        <!-- Columna principal -->
        <div class="pila" style="gap: var(--espaciado-l);">
          <div class="tarjeta">
            <div class="campo">
              <label for="txtTitulo">Título de la noticia *</label>
              <input type="text" id="txtTitulo" value="${ui.escapar(noticia ? noticia.titulo : '')}" placeholder="Ej. Inicio de ciclo académico 2026-2027" required>
            </div>

            <div class="campo">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label for="txtResumen">Resumen (máximo 200 caracteres) *</label>
                <span id="lblContadorResumen" class="contador-caracteres">0 / 200</span>
              </div>
              <textarea id="txtResumen" rows="3" maxlength="200" placeholder="Breve introducción o resumen para las tarjetas de noticias..." required>${ui.escapar(noticia ? (noticia.resumen || '') : '')}</textarea>
            </div>

            <div class="campo" style="margin-bottom: 0;">
              <label for="txtCuerpo">Cuerpo de la noticia (admite formato básico) *</label>
              <textarea id="txtCuerpo" rows="12" placeholder="Escribe el contenido completo. Puedes usar negritas *texto*, cursivas _texto_, listas y encabezados..." required>${ui.escapar(noticia ? (noticia.cuerpo || '') : '')}</textarea>
            </div>
          </div>

          <!-- Panel de vista previa -->
          <div id="panelVistaPrevia" class="vista-previa-noticia" style="display: none;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--borde); padding-bottom: var(--espaciado-xs);">
              <strong style="color: var(--primario);">Vista previa de la noticia</strong>
              <span class="chip">Modo lectura</span>
            </div>
            <div id="contenidoVistaPrevia"></div>
          </div>
        </div>

        <!-- Columna lateral: Metadatos y Multimedia -->
        <aside class="pila" style="gap: var(--espaciado-l);">
          <div class="tarjeta">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin-bottom: var(--espaciado-m);">
              Configuración y publicación
            </h2>

            <div class="campo">
              <label for="selEstado">Estado</label>
              <select id="selEstado">
                <option value="borrador" ${!noticia || noticia.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
                <option value="publicado" ${noticia && noticia.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
              </select>
            </div>

            <div class="campo">
              <label for="selCategoria">Categoría *</label>
              <select id="selCategoria">
                ${categorias.map(cat => `
                  <option value="${cat}" ${noticia && noticia.categoria === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>

            <div class="campo">
              <label for="selTemaId">Tema relacionado (opcional)</label>
              <select id="selTemaId">
                <option value="">-- Ninguno (general) --</option>
                ${temaOpciones}
              </select>
            </div>

            <div class="campo" style="margin-bottom: 0;">
              <label class="casilla-destacada">
                <input type="checkbox" id="chkDestacada" ${noticia && noticia.destacada ? 'checked' : ''}>
                <span>⭐ Marcar como noticia destacada</span>
              </label>
            </div>
          </div>

          <div class="tarjeta">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin-bottom: var(--espaciado-m);">
              Imagen de cabecera
            </h2>

            <div class="pila" style="gap: var(--espaciado-s);">
              <div class="imagen-previa-contenedor" id="contenedorImagenPrevia">
                ${noticia && noticia.imagen
                  ? `<img src="${ui.escapar(noticia.imagen)}" alt="Imagen de noticia" class="imagen-previa" id="imgPrevia">`
                  : `<span style="font-size: var(--tamano-xs); color: var(--texto-suave);">Sin imagen seleccionada</span>`
                }
              </div>

              <div class="campo" style="margin-bottom: 0;">
                <label for="txtImagen">URL de la imagen</label>
                <div style="display: flex; gap: var(--espaciado-xs);">
                  <input type="text" id="txtImagen" value="${ui.escapar(noticia ? (noticia.imagen || '') : '')}" placeholder="https://... o sube una imagen">
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnSubirImagen" title="Subir archivo de imagen">
                    Subir
                  </button>
                </div>
              </div>

              <input type="file" id="inputArchivoImagenOculto" accept="image/jpeg,image/png,image/webp" style="display: none;">
            </div>
          </div>
        </aside>
      </form>
    </section>
  `;

  asociarEventos({ noticia, temas });
}

function asociarEventos({ noticia, temas }) {
  const txtTitulo = document.getElementById('txtTitulo');
  const txtResumen = document.getElementById('txtResumen');
  const txtCuerpo = document.getElementById('txtCuerpo');
  const txtImagen = document.getElementById('txtImagen');
  const selCategoria = document.getElementById('selCategoria');
  const selTemaId = document.getElementById('selTemaId');
  const selEstado = document.getElementById('selEstado');
  const chkDestacada = document.getElementById('chkDestacada');
  const lblContadorResumen = document.getElementById('lblContadorResumen');
  const btnAlternarVistaPrevia = document.getElementById('btnAlternarVistaPrevia');
  const panelVistaPrevia = document.getElementById('panelVistaPrevia');
  const contenidoVistaPrevia = document.getElementById('contenidoVistaPrevia');
  const btnSubirImagen = document.getElementById('btnSubirImagen');
  const inputArchivoImagenOculto = document.getElementById('inputArchivoImagenOculto');
  const contenedorImagenPrevia = document.getElementById('contenedorImagenPrevia');
  const btnGuardarNoticia = document.getElementById('btnGuardarNoticia');

  // Contador de caracteres para el resumen
  function actualizarContadorResumen() {
    const longitud = txtResumen.value.length;
    lblContadorResumen.textContent = `${longitud} / 200`;
    if (longitud >= 195) {
      lblContadorResumen.className = 'contador-caracteres contador-caracteres--alerta';
    } else {
      lblContadorResumen.className = 'contador-caracteres';
    }
  }

  txtResumen.addEventListener('input', actualizarContadorResumen);
  actualizarContadorResumen();

  // Actualizar imagen previa al cambiar la URL manualmente
  txtImagen.addEventListener('input', () => {
    const url = txtImagen.value.trim();
    if (url) {
      contenedorImagenPrevia.innerHTML = `<img src="${ui.escapar(url)}" alt="Imagen de noticia" class="imagen-previa">`;
    } else {
      contenedorImagenPrevia.innerHTML = `<span style="font-size: var(--tamano-xs); color: var(--texto-suave);">Sin imagen seleccionada</span>`;
    }
  });

  // Subir imagen con api.subir
  btnSubirImagen.addEventListener('click', () => {
    inputArchivoImagenOculto.click();
  });

  inputArchivoImagenOculto.addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    ui.cargando(true);
    try {
      const res = await api.subir(archivo);
      if (res && res.url) {
        txtImagen.value = res.url;
        contenedorImagenPrevia.innerHTML = `<img src="${ui.escapar(res.url)}" alt="Imagen de noticia" class="imagen-previa">`;
        ui.aviso('Imagen subida correctamente.', 'exito');
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al subir la imagen.', 'error');
    } finally {
      ui.cargando(false);
      inputArchivoImagenOculto.value = '';
    }
  });

  // Alternar vista previa
  btnAlternarVistaPrevia.addEventListener('click', () => {
    if (panelVistaPrevia.style.display === 'none') {
      const tituloVal = txtTitulo.value.trim() || 'Título de ejemplo';
      const catVal = selCategoria.value;
      const temaSeleccionado = temas.find(t => t.id === selTemaId.value);
      const imgVal = txtImagen.value.trim();
      const resumenVal = txtResumen.value.trim();
      const cuerpoVal = txtCuerpo.value.trim();

      contenidoVistaPrevia.innerHTML = `
        <article class="pila" style="gap: var(--espaciado-m);">
          ${imgVal ? `<img src="${ui.escapar(imgVal)}" alt="${ui.escapar(tituloVal)}" style="width: 100%; max-height: 280px; object-fit: cover; border-radius: var(--radio-m);">` : ''}
          <div>
            <div style="display: flex; gap: var(--espaciado-xs); margin-bottom: var(--espaciado-xs);">
              <span class="chip">${ui.escapar(catVal)}</span>
              ${temaSeleccionado ? `<span class="chip">Tema: ${ui.escapar(temaSeleccionado.titulo)}</span>` : ''}
              ${chkDestacada.checked ? `<span class="insignia" style="background-color: var(--acento); color: var(--primario);">⭐ Destacada</span>` : ''}
            </div>
            <h2 style="font-size: var(--tamano-xl); color: var(--primario); margin: 0;">${ui.escapar(tituloVal)}</h2>
            ${resumenVal ? `<p style="font-size: var(--tamano-s); color: var(--texto-suave); font-style: italic; margin-top: var(--espaciado-xs);">${ui.escapar(resumenVal)}</p>` : ''}
          </div>
          <div style="font-size: var(--tamano-base); line-height: var(--interlineado-amplio);">
            ${util.formatoBasico(cuerpoVal) || '<em>Sin contenido redactado.</em>'}
          </div>
        </article>
      `;

      panelVistaPrevia.style.display = 'block';
      btnAlternarVistaPrevia.textContent = 'Ocultar vista previa';
    } else {
      panelVistaPrevia.style.display = 'none';
      btnAlternarVistaPrevia.textContent = '👁 Previsualizar';
    }
  });

  // Guardar noticia
  btnGuardarNoticia.addEventListener('click', async () => {
    const titulo = txtTitulo.value.trim();
    const resumen = txtResumen.value.trim();
    const cuerpo = txtCuerpo.value.trim();
    const categoria = selCategoria.value;
    const temaId = selTemaId.value || null;
    const imagen = txtImagen.value.trim();
    const destacada = chkDestacada.checked;
    const estado = selEstado.value;

    if (!titulo) {
      ui.aviso('El título de la noticia es obligatorio.', 'advertencia');
      txtTitulo.focus();
      return;
    }

    if (!resumen) {
      ui.aviso('El resumen de la noticia es obligatorio.', 'advertencia');
      txtResumen.focus();
      return;
    }

    if (resumen.length > 200) {
      ui.aviso('El resumen no debe superar los 200 caracteres.', 'advertencia');
      txtResumen.focus();
      return;
    }

    if (!cuerpo) {
      ui.aviso('El cuerpo de la noticia es obligatorio.', 'advertencia');
      txtCuerpo.focus();
      return;
    }

    const payload = {
      titulo,
      resumen,
      cuerpo,
      imagen,
      categoria,
      temaId,
      destacada,
      estado
    };

    btnGuardarNoticia.disabled = true;
    ui.cargando(true);
    try {
      if (noticia && noticia.id) {
        await api.actualizar('noticias', noticia.id, payload);
        ui.aviso('Noticia actualizada con éxito.', 'exito');
        setTimeout(() => {
          window.location.href = `/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}`;
        }, 600);
      } else {
        const nueva = await api.crear('noticias', payload);
        ui.aviso('Noticia creada con éxito.', 'exito');
        setTimeout(() => {
          window.location.href = `/paginas/noticia.html?id=${encodeURIComponent(nueva.id)}`;
        }, 600);
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la noticia.', 'error');
      btnGuardarNoticia.disabled = false;
    } finally {
      ui.cargando(false);
    }
  });
}
