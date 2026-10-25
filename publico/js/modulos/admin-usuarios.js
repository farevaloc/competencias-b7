import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Administración de usuarios', roles: ['admin'] });

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="admin-seccion">
      <div class="tarjeta">
        <header class="admin-cabecera">
          <div>
            <h1 style="font-size: var(--tamano-xl); color: var(--primario); margin-bottom: var(--espaciado-xs);">Gestión de Usuarios</h1>
            <p style="color: var(--texto-suave); font-size: var(--tamano-s);">Administra roles, estados y credenciales de acceso de la comunidad educativa.</p>
          </div>
          <div class="admin-filtros">
            <div class="admin-buscador">
              <input type="search" id="inputBuscar" class="campo" style="margin-bottom: 0;" placeholder="Buscar por nombre, apellido o correo..." aria-label="Buscar usuarios">
            </div>
            <div class="admin-filtro-rol">
              <select id="selectFiltroRol" class="campo" style="margin-bottom: 0;" aria-label="Filtrar por rol">
                <option value="">Todos los roles</option>
                <option value="estudiante">Estudiantes</option>
                <option value="docente">Docentes</option>
                <option value="admin">Administradores</option>
              </select>
            </div>
          </div>
        </header>

        <div class="tabla-contenedor" style="overflow-x: auto;">
          <table class="tabla" id="tablaUsuarios">
            <thead>
              <tr>
                <th scope="col">Usuario</th>
                <th scope="col" style="width: 180px;">Rol</th>
                <th scope="col" style="width: 100px; text-align: center;">Activo</th>
                <th scope="col" style="width: 190px; text-align: right;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cuerpoTabla">
              <tr>
                <td colspan="4" style="text-align: center; padding: var(--espaciado-l);">Cargando usuarios...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const inputBuscar = document.getElementById('inputBuscar');
  const selectFiltroRol = document.getElementById('selectFiltroRol');
  const cuerpoTabla = document.getElementById('cuerpoTabla');

  let listaUsuarios = [];

  async function cargarUsuarios() {
    ui.cargando(true);
    try {
      listaUsuarios = await api.listar('usuarios');
      renderizarTabla();
    } catch (err) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--error); padding: var(--espaciado-l);">
            ${ui.escapar(err.message || 'Error al cargar usuarios')}
          </td>
        </tr>
      `;
    } finally {
      ui.cargando(false);
    }
  }

  function renderizarTabla() {
    const termino = inputBuscar.value.trim().toLowerCase();
    const filtroRol = selectFiltroRol.value;

    const filtrados = listaUsuarios.filter(u => {
      const coincideRol = !filtroRol || u.rol === filtroRol;
      const textoCompleto = `${u.nombre || ''} ${u.apellido || ''} ${u.correo || ''}`.toLowerCase();
      const coincideTermino = !termino || textoCompleto.includes(termino);
      return coincideRol && coincideTermino;
    });

    if (filtrados.length === 0) {
      cuerpoTabla.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--texto-suave); padding: var(--espaciado-l);">
            No se encontraron usuarios coincidentes.
          </td>
        </tr>
      `;
      return;
    }

    cuerpoTabla.innerHTML = filtrados.map(u => {
      const inicial = (u.nombre ? u.nombre.charAt(0) : 'U').toUpperCase();
      const avatarHtml = u.foto
        ? `<img src="${ui.escapar(u.foto)}" alt="" class="usuario-avatar-pequeno">`
        : `<span class="usuario-avatar-pequeno" aria-hidden="true">${ui.escapar(inicial)}</span>`;

      return `
        <tr data-id="${ui.escapar(u.id)}">
          <td>
            <div class="usuario-info">
              ${avatarHtml}
              <div class="usuario-nombres">
                <strong>${ui.escapar(u.nombre)} ${ui.escapar(u.apellido || '')}</strong>
                <span class="usuario-correo">${ui.escapar(u.correo || '')}</span>
              </div>
            </div>
          </td>
          <td>
            <select class="select-rol campo" style="margin-bottom: 0; padding: var(--espaciado-xs) var(--espaciado-s);" data-id="${ui.escapar(u.id)}" aria-label="Rol de ${ui.escapar(u.nombre)}">
              <option value="estudiante" ${u.rol === 'estudiante' ? 'selected' : ''}>Estudiante</option>
              <option value="docente" ${u.rol === 'docente' ? 'selected' : ''}>Docente</option>
              <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Administrador</option>
            </select>
          </td>
          <td style="text-align: center;">
            <input type="checkbox" class="chk-activo" data-id="${ui.escapar(u.id)}" ${u.activo !== false ? 'checked' : ''} style="cursor: pointer; transform: scale(1.2);" aria-label="Estado activo de ${ui.escapar(u.nombre)}">
          </td>
          <td style="text-align: right;">
            <button type="button" class="btn btn--secundario btn--pequeno btn-restablecer" data-id="${ui.escapar(u.id)}" data-nombre="${ui.escapar(u.nombre + ' ' + (u.apellido || ''))}">
              Restablecer clave
            </button>
          </td>
        </tr>
      `;
    }).join('');

    asociarEventos();
  }

  function asociarEventos() {
    // Cambio de rol
    cuerpoTabla.querySelectorAll('.select-rol').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const nuevoRol = e.target.value;
        const usuarioOriginal = listaUsuarios.find(u => u.id === id);
        const rolAnterior = usuarioOriginal ? usuarioOriginal.rol : '';

        ui.cargando(true);
        try {
          await api.actualizar('usuarios', id, { rol: nuevoRol });
          if (usuarioOriginal) usuarioOriginal.rol = nuevoRol;
          ui.aviso('Rol actualizado con éxito.', 'exito');
        } catch (err) {
          e.target.value = rolAnterior;
          ui.aviso(err.message || 'Error al cambiar el rol.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });

    // Cambio de estado activo
    cuerpoTabla.querySelectorAll('.chk-activo').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const id = e.target.getAttribute('data-id');
        const nuevoEstado = e.target.checked;
        const usuarioOriginal = listaUsuarios.find(u => u.id === id);

        ui.cargando(true);
        try {
          await api.actualizar('usuarios', id, { activo: nuevoEstado });
          if (usuarioOriginal) usuarioOriginal.activo = nuevoEstado;
          ui.aviso(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} con éxito.`, 'exito');
        } catch (err) {
          e.target.checked = !nuevoEstado;
          ui.aviso(err.message || 'Error al cambiar el estado del usuario.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });

    // Restablecer clave
    cuerpoTabla.querySelectorAll('.btn-restablecer').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const nombre = btn.getAttribute('data-nombre');

        const confirmado = await ui.confirmar(`¿Deseas restablecer la contraseña de ${nombre}? Se generará una clave temporal.`);
        if (!confirmado) return;

        ui.cargando(true);
        try {
          const res = await api.llamar('POST', `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`, {});
          const claveTemp = res.claveTemporal;

          const modalContenido = document.createElement('div');
          modalContenido.className = 'pila';
          modalContenido.style.gap = 'var(--espaciado-m)';
          modalContenido.innerHTML = `
            <p>Se ha generado una nueva contraseña temporal para <strong>${ui.escapar(nombre)}</strong>:</p>
            <div style="display: flex; gap: var(--espaciado-s); align-items: center;">
              <input type="text" readonly value="${ui.escapar(claveTemp)}" id="inputClaveTempModal" class="campo" style="font-family: monospace; font-size: var(--tamano-l); font-weight: var(--peso-negrita); text-align: center; margin-bottom: 0; width: 100%;">
              <button type="button" class="btn btn--primario" id="btnCopiarClaveModal">Copiar</button>
            </div>
            <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
              Comparte esta clave con el usuario. Al iniciar sesión podrá cambiarla desde su perfil.
            </p>
          `;

          const btnCopiar = modalContenido.querySelector('#btnCopiarClaveModal');
          const inputClave = modalContenido.querySelector('#inputClaveTempModal');

          btnCopiar.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(claveTemp);
              btnCopiar.textContent = '¡Copiado!';
              setTimeout(() => { btnCopiar.textContent = 'Copiar'; }, 2000);
              ui.aviso('Contraseña copiada al portapapeles.', 'exito');
            } catch {
              inputClave.select();
              document.execCommand('copy');
              ui.aviso('Contraseña copiada al portapapeles.', 'exito');
            }
          });

          await ui.modal({
            titulo: 'Contraseña restablecida',
            contenido: modalContenido,
            acciones: [{ texto: 'Cerrar', valor: true, clase: 'btn--secundario' }]
          });
        } catch (err) {
          ui.aviso(err.message || 'Error al restablecer la contraseña.', 'error');
        } finally {
          ui.cargando(false);
        }
      });
    });
  }

  inputBuscar.addEventListener('input', renderizarTabla);
  selectFiltroRol.addEventListener('change', renderizarTabla);

  await cargarUsuarios();
}
