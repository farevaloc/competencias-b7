import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de canción', roles: ['docente', 'admin'] });

const cancionId = util.parametro('id');
const contenedor = document.getElementById('contenido');

iniciar();

async function iniciar() {
  ui.cargando(true);
  let cancion = null;
  let temas = [];

  try {
    const promesas = [api.listar('temas')];
    if (cancionId) {
      promesas.push(api.obtener('canciones', cancionId));
    }

    const [temasData, cancionData] = await Promise.all(promesas);
    temas = temasData || [];
    cancion = cancionData || null;
  } catch (err) {
    contenedor.innerHTML = `
      <div class="alerta alerta--error" style="margin-top: var(--espaciado-l);">
        Error al cargar los datos: ${ui.escapar(err.message)}
        <br><a href="/paginas/canciones.html" class="enlace">Volver a canciones</a>
      </div>
    `;
    ui.cargando(false);
    return;
  } finally {
    ui.cargando(false);
  }

  renderizarFormulario({ cancion, temas });
}

function renderizarFormulario({ cancion, temas }) {
  const esEdicion = Boolean(cancion);

  // Determinar valor inicial de licencia
  let tipoLicencia = 'Propia';
  let descLicenciaOtra = '';
  if (cancion && cancion.licencia) {
    if (['Propia', 'CC BY', 'CC BY-SA'].includes(cancion.licencia)) {
      tipoLicencia = cancion.licencia;
    } else {
      tipoLicencia = 'Otra';
      descLicenciaOtra = cancion.licencia.startsWith('Otra: ')
        ? cancion.licencia.slice(6)
        : cancion.licencia;
    }
  }

  const opcionesTemas = temas.map(t => `
    <option value="${ui.escapar(t.id)}" ${cancion && cancion.temaId === t.id ? 'selected' : ''}>
      ${ui.escapar(t.titulo)}
    </option>
  `).join('');

  contenedor.innerHTML = `
    <section class="editor-cancion-seccion">
      <header class="editor-cancion-cabecera">
        <div>
          <a href="/paginas/canciones.html" class="enlace">← Volver al listado de canciones</a>
          <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-top: var(--espaciado-xs);">
            ${esEdicion ? 'Editar canción' : 'Nueva canción educativa'}
          </h1>
        </div>

        <div>
          <button type="button" class="btn btn--primario" id="btnGuardarCancion">
            ${esEdicion ? 'Guardar cambios' : 'Crear canción'}
          </button>
        </div>
      </header>

      <form id="formEditorCancion" class="editor-cancion-grid" novalidate>
        <!-- Columna principal -->
        <div class="pila" style="gap: var(--espaciado-l);">
          <div class="tarjeta">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin-bottom: var(--espaciado-m);">
              Información de la canción
            </h2>

            <div class="campo">
              <label for="txtTitulo">Título de la canción *</label>
              <input type="text" id="txtTitulo" value="${ui.escapar(cancion ? cancion.titulo : '')}" placeholder="Ej. El ritmo de los algoritmos" required>
            </div>

            <div class="campo">
              <label for="selTemaId">Tema educativo relacionado *</label>
              <select id="selTemaId" required>
                <option value="">-- Selecciona un tema --</option>
                ${opcionesTemas}
              </select>
            </div>

            <div class="campo">
              <label for="txtLetra">Letra de la canción</label>
              <textarea id="txtLetra" rows="8" placeholder="Escribe o pega la letra completa de la canción...">${ui.escapar(cancion ? (cancion.letra || '') : '')}</textarea>
            </div>

            <div class="campo" style="margin-bottom: 0;">
              <label for="txtLrc">Letra sincronizada en formato LRC (opcional)</label>
              <textarea id="txtLrc" rows="8" placeholder="[00:04.20] Verso inicial\n[00:08.50] Segundo verso...">${ui.escapar(cancion ? (cancion.lrc || '') : '')}</textarea>
              <div class="ayuda-lrc">
                Formato LRC: [mm:ss.xx] Texto de la estrofa. Cada marca de tiempo se sincronizará automáticamente con el reproductor.
              </div>
            </div>
          </div>
        </div>

        <!-- Columna lateral: Audio y Derechos -->
        <aside class="pila" style="gap: var(--espaciado-l);">
          <div class="tarjeta">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin-bottom: var(--espaciado-m);">
              Archivo de audio (MP3) *
            </h2>

            <div class="pila" style="gap: var(--espaciado-s);">
              <div class="campo" style="margin-bottom: 0;">
                <label for="txtAudio">URL del audio</label>
                <div style="display: flex; gap: var(--espaciado-xs);">
                  <input type="text" id="txtAudio" value="${ui.escapar(cancion ? (cancion.audio || '') : '')}" placeholder="/recursos/subidas/... o URL externa" required>
                  <button type="button" class="btn btn--secundario btn--pequeno" id="btnSubirAudio" title="Subir archivo MP3">
                    Subir MP3
                  </button>
                </div>
              </div>

              <input type="file" id="inputArchivoAudioOculto" accept="audio/mpeg,audio/mp3,.mp3" style="display: none;">

              <div id="cajaPreviewAudio" class="audio-preview-caja" style="${cancion && cancion.audio ? '' : 'display: none;'}">
                <audio id="reproductorPreview" controls src="${ui.escapar(cancion ? (cancion.audio || '') : '')}"></audio>
              </div>
            </div>
          </div>

          <div class="tarjeta">
            <h2 style="font-size: var(--tamano-m); color: var(--primario); margin-bottom: var(--espaciado-m);">
              Derechos y autoría *
            </h2>

            <div class="campo">
              <label for="txtAutoria">Autoría o creador *</label>
              <input type="text" id="txtAutoria" value="${ui.escapar(cancion ? (cancion.autoria || '') : '')}" placeholder="Ej. Equipo Docente / Ecosistema Educativo" required>
            </div>

            <div class="campo">
              <label for="selLicencia">Tipo de licencia *</label>
              <select id="selLicencia" required>
                <option value="Propia" ${tipoLicencia === 'Propia' ? 'selected' : ''}>Propia</option>
                <option value="CC BY" ${tipoLicencia === 'CC BY' ? 'selected' : ''}>Creative Commons Atribución (CC BY)</option>
                <option value="CC BY-SA" ${tipoLicencia === 'CC BY-SA' ? 'selected' : ''}>Creative Commons Atribución-CompartirIgual (CC BY-SA)</option>
                <option value="Otra" ${tipoLicencia === 'Otra' ? 'selected' : ''}>Otra (especificar)</option>
              </select>
            </div>

            <div class="campo" id="campoLicenciaOtra" style="${tipoLicencia === 'Otra' ? '' : 'display: none;'} margin-bottom: 0;">
              <label for="txtLicenciaOtra">Descripción de la licencia *</label>
              <input type="text" id="txtLicenciaOtra" value="${ui.escapar(descLicenciaOtra)}" placeholder="Detalla los términos o fuente de la licencia">
            </div>
          </div>
        </aside>
      </form>
    </section>
  `;

  asociarEventos({ cancion, temas });
}

function asociarEventos({ cancion }) {
  const txtTitulo = document.getElementById('txtTitulo');
  const selTemaId = document.getElementById('selTemaId');
  const txtLetra = document.getElementById('txtLetra');
  const txtLrc = document.getElementById('txtLrc');
  const txtAudio = document.getElementById('txtAudio');
  const txtAutoria = document.getElementById('txtAutoria');
  const selLicencia = document.getElementById('selLicencia');
  const campoLicenciaOtra = document.getElementById('campoLicenciaOtra');
  const txtLicenciaOtra = document.getElementById('txtLicenciaOtra');
  const btnSubirAudio = document.getElementById('btnSubirAudio');
  const inputArchivoAudioOculto = document.getElementById('inputArchivoAudioOculto');
  const cajaPreviewAudio = document.getElementById('cajaPreviewAudio');
  const reproductorPreview = document.getElementById('reproductorPreview');
  const btnGuardarCancion = document.getElementById('btnGuardarCancion');

  // Alternar campo descripción para licencia "Otra"
  selLicencia.addEventListener('change', () => {
    if (selLicencia.value === 'Otra') {
      campoLicenciaOtra.style.display = 'block';
      txtLicenciaOtra.focus();
    } else {
      campoLicenciaOtra.style.display = 'none';
    }
  });

  // Previsualización de audio al escribir URL manual
  txtAudio.addEventListener('input', () => {
    const url = txtAudio.value.trim();
    if (url) {
      reproductorPreview.src = url;
      cajaPreviewAudio.style.display = 'block';
    } else {
      reproductorPreview.src = '';
      cajaPreviewAudio.style.display = 'none';
    }
  });

  // Subir archivo MP3 con api.subir
  btnSubirAudio.addEventListener('click', () => {
    inputArchivoAudioOculto.click();
  });

  inputArchivoAudioOculto.addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    if (!archivo.name.toLowerCase().endsWith('.mp3')) {
      ui.aviso('Por favor selecciona un archivo de audio MP3 válido.', 'advertencia');
      return;
    }

    ui.cargando(true);
    try {
      const res = await api.subir(archivo);
      if (res && res.url) {
        txtAudio.value = res.url;
        reproductorPreview.src = res.url;
        cajaPreviewAudio.style.display = 'block';
        ui.aviso('Archivo MP3 subido correctamente.', 'exito');
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al subir el archivo de audio.', 'error');
    } finally {
      ui.cargando(false);
      inputArchivoAudioOculto.value = '';
    }
  });

  // Guardar canción
  btnGuardarCancion.addEventListener('click', async () => {
    const titulo = txtTitulo.value.trim();
    const temaId = selTemaId.value;
    const letra = txtLetra.value.trim();
    const lrc = txtLrc.value.trim();
    const audio = txtAudio.value.trim();
    const autoria = txtAutoria.value.trim();
    const licTipo = selLicencia.value;

    if (!titulo) {
      ui.aviso('El título de la canción es obligatorio.', 'advertencia');
      txtTitulo.focus();
      return;
    }

    if (!temaId) {
      ui.aviso('Debes seleccionar un tema relacionado.', 'advertencia');
      selTemaId.focus();
      return;
    }

    if (!audio) {
      ui.aviso('Debes proporcionar o subir un archivo de audio MP3.', 'advertencia');
      txtAudio.focus();
      return;
    }

    if (!autoria) {
      ui.aviso('La autoría de la canción es obligatoria.', 'advertencia');
      txtAutoria.focus();
      return;
    }

    let licenciaFinal = licTipo;
    if (licTipo === 'Otra') {
      const otraDesc = txtLicenciaOtra.value.trim();
      if (!otraDesc) {
        ui.aviso('Por favor detalla la descripción de la licencia.', 'advertencia');
        txtLicenciaOtra.focus();
        return;
      }
      licenciaFinal = `Otra: ${otraDesc}`;
    }

    const payload = {
      titulo,
      temaId,
      audio,
      letra,
      lrc,
      autoria,
      licencia: licenciaFinal
    };

    btnGuardarCancion.disabled = true;
    ui.cargando(true);
    try {
      if (cancion && cancion.id) {
        await api.actualizar('canciones', cancion.id, payload);
        ui.aviso('Canción actualizada con éxito.', 'exito');
      } else {
        await api.crear('canciones', payload);
        ui.aviso('Canción creada con éxito.', 'exito');
      }
      setTimeout(() => {
        window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
      }, 500);
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la canción.', 'error');
      btnGuardarCancion.disabled = false;
    } finally {
      ui.cargando(false);
    }
  });
}
