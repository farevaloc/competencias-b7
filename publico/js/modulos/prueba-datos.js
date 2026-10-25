import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { fechaLarga } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Prueba de datos', roles: ['publico'] });

const contenido = document.getElementById('contenido');

if (contenido) {
  contenido.innerHTML = `
    <div class="pila">
      <header>
        <span class="chip" style="margin-bottom: var(--espaciado-xs);">Persistencia JSON</span>
        <h1>Prueba de datos en colección</h1>
        <p style="color: var(--texto-suave);">
          Guarda y consulta registros en la colección <code>prueba</code> a través del cliente API seguro.
        </p>
      </header>

      <!-- Formulario para agregar registro -->
      <section class="tarjeta prueba-formulario">
        <h2 style="font-size: var(--tamano-l); margin-bottom: var(--espaciado-m);">Nuevo registro</h2>
        <form id="formPrueba">
          <div class="campo">
            <label for="campoTexto">Texto</label>
            <input type="text" id="campoTexto" name="texto" placeholder="Escribe el contenido del registro..." required autocomplete="off">
          </div>
          <div class="fila" style="justify-content: flex-end;">
            <button type="submit" class="btn btn--primario" id="btnGuardar">
              Guardar en colección
            </button>
          </div>
        </form>
      </section>

      <!-- Contenedor de registros existentes -->
      <section class="prueba-registros">
        <div class="fila" style="justify-content: space-between; margin-bottom: var(--espaciado-m);">
          <h2>Registros almacenados</h2>
          <button type="button" class="btn btn--secundario btn--pequeno" id="btnRecargar">
            ↻ Recargar lista
          </button>
        </div>
        <div id="contenedorLista">
          <div class="cargando" role="status" aria-label="Cargando registros"></div>
        </div>
      </section>
    </div>
  `;

  const form = document.getElementById('formPrueba');
  const inputTexto = document.getElementById('campoTexto');
  const contenedorLista = document.getElementById('contenedorLista');
  const btnRecargar = document.getElementById('btnRecargar');

  async function cargarRegistros() {
    try {
      const registros = await api.listar('prueba');
      if (!Array.isArray(registros) || registros.length === 0) {
        contenedorLista.innerHTML = `
          <div class="vacio">
            <div class="vacio__icono" aria-hidden="true">📋</div>
            <h3 class="vacio__titulo">No hay registros</h3>
            <p class="vacio__texto">Aún no se han guardado datos en la colección "prueba". Escribe un texto arriba para comenzar.</p>
          </div>
        `;
        return;
      }

      const filas = registros.map(reg => `
        <tr>
          <td><code>${ui.escapar(reg.id)}</code></td>
          <td>${ui.escapar(reg.texto)}</td>
          <td><small>${ui.escapar(fechaLarga(reg.fecha) || reg.fecha || '')}</small></td>
        </tr>
      `).join('');

      contenedorLista.innerHTML = `
        <div class="tabla-contenedor">
          <table class="tabla">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Texto</th>
                <th scope="col">Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${filas}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      ui.aviso(`Error al cargar registros: ${err.message}`, 'error');
      contenedorLista.innerHTML = `
        <div class="alerta alerta--error" role="alert">
          <div>Error al cargar los registros: ${ui.escapar(err.message)}</div>
        </div>
      `;
    }
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = inputTexto?.value.trim();
    if (!texto) return;

    try {
      ui.cargando(true);
      await api.crear('prueba', { texto });
      inputTexto.value = '';
      ui.aviso('Registro guardado exitosamente', 'exito');
      await cargarRegistros();
    } catch (err) {
      ui.aviso(`Error al guardar: ${err.message}`, 'error');
    } finally {
      ui.cargando(false);
    }
  });

  btnRecargar?.addEventListener('click', async () => {
    await cargarRegistros();
    ui.aviso('Lista actualizada', 'info');
  });

  // Carga inicial
  await cargarRegistros();
}
