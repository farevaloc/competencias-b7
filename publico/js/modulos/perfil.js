import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Mi perfil', roles: ['sesion'] });

let usuario = usuarioActual();

// Obtener datos frescos del servidor
try {
  const datosFrescos = await api.llamar('GET', '/api/auth/yo');
  if (datosFrescos && datosFrescos.id) {
    usuario = datosFrescos;
    sessionStorage.setItem('usuario', JSON.stringify(usuario));
  }
} catch {
  // Continuar con los datos en memoria si falla la consulta
}

const contenedor = document.getElementById('contenido');
if (contenedor && usuario) {
  let fotoActualUrl = usuario.foto || '';

  const inicial = (usuario.nombre ? usuario.nombre.charAt(0) : 'U').toUpperCase();

  contenedor.innerHTML = `
    <div class="perfil-contenedor">
      <!-- Tarjeta 1: Información personal -->
      <section class="perfil-tarjeta">
        <h2>Datos personales</h2>

        <div class="perfil-avatar-seccion">
          <div id="contenedorAvatar" class="perfil-avatar">
            ${fotoActualUrl ? `<img src="${ui.escapar(fotoActualUrl)}" alt="Foto de perfil" class="perfil-avatar">` : `<span>${ui.escapar(inicial)}</span>`}
          </div>
          <div class="perfil-avatar-info">
            <span class="insignia" style="text-transform: capitalize; width: fit-content;">${ui.escapar(usuario.rol || 'estudiante')}</span>
            <label for="inputFoto" class="btn btn--secundario btn--pequeno" style="cursor: pointer; width: fit-content; margin-top: var(--espaciado-xs);">
              Cambiar foto de perfil
            </label>
            <input type="file" id="inputFoto" accept="image/jpeg,image/png,image/webp" style="display: none;">
            <span style="font-size: var(--tamano-xs); color: var(--texto-suave);">JPG, PNG o WEBP (máximo 2 MB)</span>
            <span class="campo__error" id="errorFoto" aria-live="polite"></span>
          </div>
        </div>

        <form id="formPerfil" novalidate>
          <div class="campo">
            <label for="txtNombre">Nombre</label>
            <input type="text" id="txtNombre" name="nombre" value="${ui.escapar(usuario.nombre || '')}" required>
            <span class="campo__error" id="errorNombre" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtApellido">Apellido</label>
            <input type="text" id="txtApellido" name="apellido" value="${ui.escapar(usuario.apellido || '')}" required>
            <span class="campo__error" id="errorApellido" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtCorreo">Correo electrónico</label>
            <input type="email" id="txtCorreo" value="${ui.escapar(usuario.correo || '')}" disabled>
            <span style="font-size: var(--tamano-xs); color: var(--texto-suave);">El correo electrónico no puede ser modificado.</span>
          </div>

          <button type="submit" class="btn btn--primario" id="btnGuardarPerfil" style="margin-top: var(--espaciado-s);">
            Guardar cambios
          </button>
        </form>
      </section>

      <!-- Tarjeta 2: Cambiar contraseña -->
      <section class="perfil-tarjeta">
        <h2>Seguridad y contraseña</h2>
        <form id="formClave" novalidate>
          <div class="campo">
            <label for="txtClaveActual">Contraseña actual</label>
            <input type="password" id="txtClaveActual" name="actual" autocomplete="current-password" required>
            <span class="campo__error" id="errorClaveActual" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtClaveNueva">Nueva contraseña</label>
            <input type="password" id="txtClaveNueva" name="nueva" autocomplete="new-password" placeholder="Mínimo 8 caracteres, letras y números" required>
            <span class="campo__error" id="errorClaveNueva" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtClaveRepetir">Repetir nueva contraseña</label>
            <input type="password" id="txtClaveRepetir" name="repetir" autocomplete="new-password" placeholder="Repite tu nueva contraseña" required>
            <span class="campo__error" id="errorClaveRepetir" aria-live="polite"></span>
          </div>

          <button type="submit" class="btn btn--secundario" id="btnGuardarClave" style="margin-top: var(--espaciado-s);">
            Actualizar contraseña
          </button>
        </form>
      </section>

      <!-- Sección de logros para el Sprint 5 -->
      <section id="logros"></section>
    </div>
  `;

  // Referencias elementos de Perfil
  const formPerfil = document.getElementById('formPerfil');
  const txtNombre = document.getElementById('txtNombre');
  const txtApellido = document.getElementById('txtApellido');
  const inputFoto = document.getElementById('inputFoto');
  const contenedorAvatar = document.getElementById('contenedorAvatar');
  const btnGuardarPerfil = document.getElementById('btnGuardarPerfil');
  const errorNombre = document.getElementById('errorNombre');
  const errorApellido = document.getElementById('errorApellido');
  const errorFoto = document.getElementById('errorFoto');

  // Subida de foto
  inputFoto.addEventListener('change', async (e) => {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    errorFoto.textContent = '';
    const tipos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!tipos.includes(archivo.type)) {
      errorFoto.textContent = 'Solo se permiten imágenes JPG, PNG o WEBP.';
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      errorFoto.textContent = 'La imagen no debe superar los 2 MB.';
      return;
    }

    ui.cargando(true);
    try {
      const res = await api.subir(archivo);
      if (res && res.url) {
        fotoActualUrl = res.url;
        contenedorAvatar.innerHTML = `<img src="${ui.escapar(fotoActualUrl)}" alt="Foto de perfil" class="perfil-avatar">`;
        ui.aviso('Imagen subida correctamente. Recuerda guardar cambios.', 'exito');
      }
    } catch (err) {
      errorFoto.textContent = err.message || 'Error al subir la imagen.';
      ui.aviso(err.message || 'Error al subir la imagen.', 'error');
    } finally {
      ui.cargando(false);
    }
  });

  // Validación y envío de datos personales
  function validarNombre() {
    const val = txtNombre.value.trim();
    if (!val) {
      errorNombre.textContent = 'El nombre es obligatorio.';
      return false;
    }
    errorNombre.textContent = '';
    return true;
  }

  function validarApellido() {
    const val = txtApellido.value.trim();
    if (!val) {
      errorApellido.textContent = 'El apellido es obligatorio.';
      return false;
    }
    errorApellido.textContent = '';
    return true;
  }

  txtNombre.addEventListener('input', validarNombre);
  txtApellido.addEventListener('input', validarApellido);

  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();
    const okNom = validarNombre();
    const okApe = validarApellido();
    if (!okNom || !okApe) return;

    btnGuardarPerfil.disabled = true;
    ui.cargando(true);
    try {
      const cambios = {
        nombre: txtNombre.value.trim(),
        apellido: txtApellido.value.trim(),
        foto: fotoActualUrl
      };
      const actualizado = await api.llamar('PUT', '/api/auth/perfil', cambios);
      if (actualizado) {
        usuario = { ...usuario, ...actualizado };
        sessionStorage.setItem('usuario', JSON.stringify(usuario));
        ui.aviso('Perfil actualizado con éxito.', 'exito');
      }
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar el perfil.', 'error');
    } finally {
      btnGuardarPerfil.disabled = false;
      ui.cargando(false);
    }
  });

  // Referencias elementos de Contraseña
  const formClave = document.getElementById('formClave');
  const txtClaveActual = document.getElementById('txtClaveActual');
  const txtClaveNueva = document.getElementById('txtClaveNueva');
  const txtClaveRepetir = document.getElementById('txtClaveRepetir');
  const btnGuardarClave = document.getElementById('btnGuardarClave');
  const errorClaveActual = document.getElementById('errorClaveActual');
  const errorClaveNueva = document.getElementById('errorClaveNueva');
  const errorClaveRepetir = document.getElementById('errorClaveRepetir');

  function validarClaveActual() {
    if (!txtClaveActual.value) {
      errorClaveActual.textContent = 'Ingresa tu contraseña actual.';
      return false;
    }
    errorClaveActual.textContent = '';
    return true;
  }

  function validarClaveNueva() {
    const val = txtClaveNueva.value;
    if (!val) {
      errorClaveNueva.textContent = 'Ingresa una nueva contraseña.';
      return false;
    }
    if (val.length < 8) {
      errorClaveNueva.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return false;
    }
    if (!/[a-zA-Z]/.test(val) || !/\d/.test(val)) {
      errorClaveNueva.textContent = 'La contraseña debe contener letras y números.';
      return false;
    }
    errorClaveNueva.textContent = '';
    return true;
  }

  function validarClaveRepetir() {
    const val = txtClaveRepetir.value;
    if (!val) {
      errorClaveRepetir.textContent = 'Repite tu nueva contraseña.';
      return false;
    }
    if (val !== txtClaveNueva.value) {
      errorClaveRepetir.textContent = 'Las contraseñas no coinciden.';
      return false;
    }
    errorClaveRepetir.textContent = '';
    return true;
  }

  txtClaveActual.addEventListener('input', validarClaveActual);
  txtClaveNueva.addEventListener('input', () => {
    validarClaveNueva();
    if (txtClaveRepetir.value) validarClaveRepetir();
  });
  txtClaveRepetir.addEventListener('input', validarClaveRepetir);

  formClave.addEventListener('submit', async (e) => {
    e.preventDefault();
    const okAct = validarClaveActual();
    const okNue = validarClaveNueva();
    const okRep = validarClaveRepetir();
    if (!okAct || !okNue || !okRep) return;

    btnGuardarClave.disabled = true;
    ui.cargando(true);
    try {
      await api.llamar('POST', '/api/auth/clave', {
        actual: txtClaveActual.value,
        nueva: txtClaveNueva.value
      });
      txtClaveActual.value = '';
      txtClaveNueva.value = '';
      txtClaveRepetir.value = '';
      ui.aviso('Contraseña actualizada correctamente.', 'exito');
    } catch (err) {
      ui.aviso(err.message || 'Error al actualizar la contraseña.', 'error');
    } finally {
      btnGuardarClave.disabled = false;
      ui.cargando(false);
    }
  });
}
