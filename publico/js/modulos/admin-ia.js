import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Configuración de IA', roles: ['admin'] });

let listaModelos = [];

async function iniciar() {
  ui.cargando(true);
  try {
    const [config, dataModelos] = await Promise.all([
      api.llamar('GET', '/api/admin/ia-config'),
      api.llamar('GET', '/api/ia/modelos').catch(() => ({ modelos: [] }))
    ]);
    listaModelos = Array.isArray(dataModelos.modelos) && dataModelos.modelos.length > 0
      ? dataModelos.modelos
      : [
          { id: 'gemini-flash-lite-latest', nombre: 'Gemini Flash Lite (⭐ Recomendado · Máxima disponibilidad y velocidad)' },
          { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash Lite (⭐ Alta disponibilidad y estabilidad)' },
          { id: 'gemini-3-flash-preview', nombre: 'Gemini 3 Flash Preview (Rápido y disponible)' },
          { id: 'gemini-flash-latest', nombre: 'Gemini Flash Latest (Estándar · Sujeto a demanda)' },
          { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash (Última versión · Sujeto a alta demanda)' },
          { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon (Avanzado · Requiere plan con facturación)' }
        ];

    renderizar(config);
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar la configuración de IA', 'error');
  } finally {
    ui.cargando(false);
  }
}

function renderizar(config) {
  const contenedor = document.getElementById('contenido');
  const modeloActual = config.modelo || 'gemini-flash-lite-latest';
  const esModeloEnLista = listaModelos.some(m => m.id === modeloActual);

  contenedor.innerHTML = `
    <div class="admin-ia-tarjeta">
      <h1 class="admin-ia-tarjeta__titulo">Configuración de Inteligencia Artificial</h1>
      <p class="admin-ia-tarjeta__desc">
        Configura el modelo y credenciales de Google Gemini para la generación pedagógica de glosarios, preguntas evaluativas y tutorías.
      </p>

      <div class="admin-ia-estado ${config.claveConfigurada ? 'admin-ia-estado--activo' : 'admin-ia-estado--inactivo'}">
        <span aria-hidden="true">${config.claveConfigurada ? '🟢' : '🟡'}</span>
        <div>
          ${config.claveConfigurada
            ? `<strong>API Key activa:</strong> ${ui.escapar(config.claveMascara)} — Modelo actual: <code>${ui.escapar(modeloActual)}</code>`
            : '<strong>No hay API Key activa:</strong> El sistema opera con generación simulada contextual de respaldo.'}
        </div>
      </div>

      <form id="formConfigIA" class="admin-ia-form">
        <div class="campo">
          <label for="selectProveedor">Proveedor de IA:</label>
          <select id="selectProveedor" class="campo__control" required>
            <option value="gemini" ${config.proveedor === 'gemini' ? 'selected' : ''}>Google Gemini (Oficial)</option>
          </select>
        </div>

        <div class="campo">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--espaciado-xs);">
            <label for="selectModelo" style="margin-bottom: 0;">Modelo de Google Gemini:</label>
            <button type="button" class="btn btn--texto btn--pequeno" id="btnRecargarModelos" title="Consulta los modelos activos en tu cuenta de Google">
              🔄 Consultar modelos en vivo
            </button>
          </div>

          <select id="selectModelo" class="campo__control" required>
            <optgroup label="Modelos estables y recomendados (Alta disponibilidad)">
              ${listaModelos.map(m => `
                <option value="${ui.escapar(m.id)}" ${m.id === modeloActual ? 'selected' : ''}>
                  ${ui.escapar(m.nombre)}
                </option>
              `).join('')}
            </optgroup>
            <option value="__personalizado__" ${!esModeloEnLista ? 'selected' : ''}>
              Otro modelo (escribir manualmente)...
            </option>
          </select>

          <div id="cajaModeloManual" style="margin-top: var(--espaciado-xs); ${esModeloEnLista ? 'display: none;' : ''}">
            <input type="text" id="inputModeloManual" class="campo__control"
              value="${!esModeloEnLista ? ui.escapar(modeloActual) : ''}"
              placeholder="Ejemplo: gemini-2.0-flash o gemini-1.5-flash">
            <small style="color: var(--texto-suave); font-size: var(--tamano-xs);">
              Ingresa el identificador exacto de modelo reconocido por Google Gemini.
            </small>
          </div>

          <small style="color: var(--texto-suave); font-size: var(--tamano-xs); margin-top: 4px; display: block;">
            💡 <strong>Consejo de disponibilidad:</strong> Se recomienda <code>gemini-2.0-flash</code> o <code>gemini-1.5-flash</code> para máxima velocidad, alta cuota y evitar saturación por alta demanda.
          </small>
        </div>

        <div class="campo">
          <label for="inputClave">API Key de Google Gemini:</label>
          <div style="display: flex; gap: var(--espaciado-xs);">
            <input type="password" id="inputClave" class="campo__control" autocomplete="off"
              placeholder="${config.claveConfigurada ? 'Ingresa una nueva clave para reemplazar la actual' : 'Pega aquí tu clave (AQ... o AIzaSy...)'}">
            <button type="button" class="btn btn--secundario btn--pequeno" id="btnVerClave" title="Mostrar u ocultar clave">
              👁️
            </button>
          </div>
          <small style="color: var(--texto-suave); font-size: var(--tamano-xs);">
            La clave se guarda cifrada/protegida en la configuración del servidor.
          </small>
        </div>

        <div id="resultadoPrueba" class="admin-ia-resultado-prueba"></div>

        <div class="admin-ia-acciones">
          <button type="button" class="btn btn--secundario" id="btnProbarConexion">
            ⚡ Probar conexión con Gemini
          </button>
          <button type="submit" class="btn btn--primario" id="btnGuardar">
            Guardar configuración
          </button>
        </div>
      </form>
    </div>
  `;

  // Control de selección de modelo manual o predefinido
  const selectModelo = document.getElementById('selectModelo');
  const cajaManual = document.getElementById('cajaModeloManual');
  const inputManual = document.getElementById('inputModeloManual');

  selectModelo.addEventListener('change', () => {
    if (selectModelo.value === '__personalizado__') {
      cajaManual.style.display = 'block';
      inputManual.focus();
    } else {
      cajaManual.style.display = 'none';
    }
  });

  // Botón para consultar modelos en vivo desde la API de Google
  document.getElementById('btnRecargarModelos').addEventListener('click', async () => {
    ui.cargando(true);
    try {
      const claveActual = document.getElementById('inputClave').value.trim();
      const url = claveActual ? `/api/ia/modelos?clave=${encodeURIComponent(claveActual)}` : '/api/ia/modelos';
      const data = await api.llamar('GET', url);
      if (Array.isArray(data.modelos) && data.modelos.length > 0) {
        listaModelos = data.modelos;
        ui.aviso(`Se cargaron ${listaModelos.length} modelos disponibles de Google`, 'exito');
        renderizar(config);
      } else {
        ui.aviso('No se pudo obtener la lista en vivo; se mantienen los modelos estándar recomendados', 'info');
      }
    } catch (err) {
      ui.aviso('Error al consultar modelos: ' + err.message, 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Mostrar / ocultar clave
  const btnVer = document.getElementById('btnVerClave');
  const inputClave = document.getElementById('inputClave');
  btnVer.addEventListener('click', () => {
    inputClave.type = inputClave.type === 'password' ? 'text' : 'password';
  });

  // Guardar configuración
  const form = document.getElementById('formConfigIA');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const proveedor = document.getElementById('selectProveedor').value;
    let modelo = selectModelo.value;
    if (modelo === '__personalizado__') {
      modelo = inputManual.value.trim();
    }
    const clave = inputClave.value.trim();

    if (!modelo) {
      ui.aviso('Debes seleccionar o especificar un modelo válido', 'advertencia');
      return;
    }

    ui.cargando(true);
    try {
      const payload = { proveedor, modelo };
      if (clave) payload.clave = clave;

      const respuesta = await api.llamar('PUT', '/api/admin/ia-config', payload);
      ui.aviso(respuesta.mensaje || 'Configuración guardada con éxito', 'exito');
      await iniciar();
    } catch (err) {
      ui.aviso(err.message || 'Error al guardar la configuración', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Probar conexión
  const btnProbar = document.getElementById('btnProbarConexion');
  const cajaResultado = document.getElementById('resultadoPrueba');

  btnProbar.addEventListener('click', async () => {
    cajaResultado.className = 'admin-ia-resultado-prueba';
    cajaResultado.style.display = 'none';

    const claveIngresada = inputClave.value.trim();
    let modeloSeleccionado = selectModelo.value;
    if (modeloSeleccionado === '__personalizado__') {
      modeloSeleccionado = inputManual.value.trim();
    }

    if (claveIngresada || modeloSeleccionado !== config.modelo) {
      const guardar = await ui.confirmar('¿Deseas guardar los cambios actuales para probar la conexión con este modelo y clave?');
      if (guardar) {
        document.getElementById('btnGuardar').click();
        return;
      }
    }

    ui.cargando(true);
    try {
      const resPrueba = await api.llamar('GET', '/api/ia/prueba');
      cajaResultado.innerHTML = `
        <strong>✓ Conexión exitosa</strong><br>
        Modelo verificado: <code>${ui.escapar(resPrueba.modelo)}</code><br>
        Respuesta de prueba: <code>${ui.escapar(JSON.stringify(resPrueba.respuesta))}</code>
      `;
      cajaResultado.className = 'admin-ia-resultado-prueba admin-ia-resultado-prueba--exito';
      cajaResultado.style.display = 'block';
      ui.aviso('Conexión con Gemini verificada con éxito', 'exito');
    } catch (err) {
      let sugerencia = '';
      if (err.message && (err.message.includes('high demand') || err.message.includes('503') || err.message.includes('not found'))) {
        sugerencia = '<br><br>💡 <em>Sugerencia: Este modelo presenta saturación o alta demanda temporal en Google. Selecciona <strong>Gemini 2.0 Flash</strong> o <strong>Gemini 1.5 Flash</strong> en la lista desplegable y pulsa Guardar.</em>';
      }
      cajaResultado.innerHTML = `<strong>✗ Error al conectar con Google Gemini:</strong><br>${ui.escapar(err.message)}${sugerencia}`;
      cajaResultado.className = 'admin-ia-resultado-prueba admin-ia-resultado-prueba--error';
      cajaResultado.style.display = 'block';
      ui.aviso('Falló la prueba con el modelo seleccionado', 'error');
    } finally {
      ui.cargando(false);
    }
  });
}

iniciar();
