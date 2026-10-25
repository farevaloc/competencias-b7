import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Registro de usuario', roles: ['publico'] });

// Si ya hay sesión activa, redirigir al inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="registro-seccion">
      <div class="registro-tarjeta">
        <header class="registro-encabezado">
          <h1>Crear una cuenta</h1>
          <p>Únete a la plataforma para acceder a todas las actividades y contenidos.</p>
        </header>

        <form id="formRegistro" novalidate>
          <div class="campo">
            <label for="txtNombre">Nombre</label>
            <input type="text" id="txtNombre" name="nombre" autocomplete="given-name" required placeholder="Ej. Juan">
            <span class="campo__error" id="errorNombre" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtApellido">Apellido</label>
            <input type="text" id="txtApellido" name="apellido" autocomplete="family-name" required placeholder="Ej. Pérez">
            <span class="campo__error" id="errorApellido" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtCorreo">Correo electrónico</label>
            <input type="email" id="txtCorreo" name="correo" autocomplete="email" required placeholder="juan.perez@ejemplo.com">
            <span class="campo__error" id="errorCorreo" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtClave">Contraseña</label>
            <input type="password" id="txtClave" name="clave" autocomplete="new-password" required placeholder="Mínimo 8 caracteres, letras y números">
            <span class="campo__error" id="errorClave" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtConfirmarClave">Confirmar contraseña</label>
            <input type="password" id="txtConfirmarClave" name="confirmarClave" autocomplete="new-password" required placeholder="Repite tu contraseña">
            <span class="campo__error" id="errorConfirmarClave" aria-live="polite"></span>
          </div>

          <div class="campo campo--casilla">
            <input type="checkbox" id="chkConsentimiento" name="consentimiento" required>
            <label for="chkConsentimiento">
              Acepto el <a href="/paginas/privacidad.html" target="_blank" class="enlace">aviso de privacidad</a> según la LOPDP.
            </label>
            <span class="campo__error" id="errorConsentimiento" aria-live="polite"></span>
          </div>

          <button type="submit" class="btn btn--primario" id="btnEnviarRegistro" style="width: 100%; margin-top: var(--espaciado-s);">
            Crear cuenta
          </button>
        </form>

        <div class="registro-pie">
          ¿Ya tienes una cuenta? <a href="/paginas/ingreso.html" class="enlace">Inicia sesión aquí</a>
        </div>
      </div>
    </section>
  `;

  const form = document.getElementById('formRegistro');
  const txtNombre = document.getElementById('txtNombre');
  const txtApellido = document.getElementById('txtApellido');
  const txtCorreo = document.getElementById('txtCorreo');
  const txtClave = document.getElementById('txtClave');
  const txtConfirmarClave = document.getElementById('txtConfirmarClave');
  const chkConsentimiento = document.getElementById('chkConsentimiento');
  const btnEnviar = document.getElementById('btnEnviarRegistro');

  const errorNombre = document.getElementById('errorNombre');
  const errorApellido = document.getElementById('errorApellido');
  const errorCorreo = document.getElementById('errorCorreo');
  const errorClave = document.getElementById('errorClave');
  const errorConfirmarClave = document.getElementById('errorConfirmarClave');
  const errorConsentimiento = document.getElementById('errorConsentimiento');

  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  function validarCorreo() {
    const val = txtCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = 'El correo electrónico es obligatorio.';
      return false;
    }
    if (!regexCorreo.test(val)) {
      errorCorreo.textContent = 'Ingresa un formato de correo válido (ej. usuario@dominio.com).';
      return false;
    }
    errorCorreo.textContent = '';
    return true;
  }

  function validarClave() {
    const val = txtClave.value;
    if (!val) {
      errorClave.textContent = 'La contraseña es obligatoria.';
      return false;
    }
    if (val.length < 8) {
      errorClave.textContent = 'La contraseña debe tener al menos 8 caracteres.';
      return false;
    }
    if (!/[a-zA-Z]/.test(val) || !/\d/.test(val)) {
      errorClave.textContent = 'La contraseña debe incluir letras y números.';
      return false;
    }
    errorClave.textContent = '';
    return true;
  }

  function validarConfirmarClave() {
    const val = txtConfirmarClave.value;
    if (!val) {
      errorConfirmarClave.textContent = 'Por favor confirma tu contraseña.';
      return false;
    }
    if (val !== txtClave.value) {
      errorConfirmarClave.textContent = 'Las contraseñas no coinciden.';
      return false;
    }
    errorConfirmarClave.textContent = '';
    return true;
  }

  function validarConsentimiento() {
    if (!chkConsentimiento.checked) {
      errorConsentimiento.textContent = 'Debes aceptar el aviso de privacidad para continuar.';
      return false;
    }
    errorConsentimiento.textContent = '';
    return true;
  }

  // Validación en vivo al escribir y al salir del campo
  txtNombre.addEventListener('input', validarNombre);
  txtApellido.addEventListener('input', validarApellido);
  txtCorreo.addEventListener('input', validarCorreo);
  txtClave.addEventListener('input', () => {
    validarClave();
    if (txtConfirmarClave.value) validarConfirmarClave();
  });
  txtConfirmarClave.addEventListener('input', validarConfirmarClave);
  chkConsentimiento.addEventListener('change', validarConsentimiento);

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okNombre = validarNombre();
    const okApellido = validarApellido();
    const okCorreo = validarCorreo();
    const okClave = validarClave();
    const okConfirmar = validarConfirmarClave();
    const okConsentimiento = validarConsentimiento();

    if (!okNombre || !okApellido || !okCorreo || !okClave || !okConfirmar || !okConsentimiento) {
      ui.aviso('Por favor revisa los campos señalados.', 'advertencia');
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Creando cuenta...';
    ui.cargando(true);

    try {
      const datosRegistro = {
        nombre: txtNombre.value.trim(),
        apellido: txtApellido.value.trim(),
        correo: txtCorreo.value.trim(),
        clave: txtClave.value,
        consentimiento: true
      };

      // Registrar usuario en el servidor
      await sesion.registrar(datosRegistro);

      // Iniciar sesión automáticamente
      await sesion.iniciar(datosRegistro.correo, datosRegistro.clave);

      ui.aviso('¡Cuenta creada e inicio de sesión exitoso!', 'exito');
      // Redirigir a inicio
      window.location.href = '/index.html';
    } catch (err) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Crear cuenta';
      ui.cargando(false);
      ui.aviso(err.message || 'No se pudo completar el registro.', 'error');
    }
  });
}
