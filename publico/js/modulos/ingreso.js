import { montarPlantilla } from '../nucleo/plantilla.js';
import * as sesion from '../nucleo/sesion.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Iniciar sesión', roles: ['publico'] });

// Si ya hay sesión activa, redirigir al inicio
if (sesion.usuarioActual()) {
  window.location.href = '/index.html';
}

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <section class="ingreso-seccion">
      <div class="ingreso-tarjeta">
        <header class="ingreso-encabezado">
          <h1>Iniciar sesión</h1>
          <p>Ingresa tus credenciales para acceder a la plataforma.</p>
        </header>

        <form id="formIngreso" novalidate>
          <div class="campo">
            <label for="txtCorreo">Correo electrónico</label>
            <input type="email" id="txtCorreo" name="correo" autocomplete="username" required placeholder="correo@ejemplo.com">
            <span class="campo__error" id="errorCorreo" aria-live="polite"></span>
          </div>

          <div class="campo">
            <label for="txtClave">Contraseña</label>
            <input type="password" id="txtClave" name="clave" autocomplete="current-password" required placeholder="Tu contraseña">
            <span class="campo__error" id="errorClave" aria-live="polite"></span>
          </div>

          <button type="submit" class="btn btn--primario" id="btnEnviarIngreso" style="width: 100%; margin-top: var(--espaciado-s);">
            Ingresar
          </button>
        </form>

        <div class="ingreso-pie">
          ¿No tienes una cuenta? <a href="/paginas/registro.html" class="enlace">Regístrate aquí</a>
        </div>
      </div>
    </section>
  `;

  const form = document.getElementById('formIngreso');
  const txtCorreo = document.getElementById('txtCorreo');
  const txtClave = document.getElementById('txtClave');
  const btnEnviar = document.getElementById('btnEnviarIngreso');
  const errorCorreo = document.getElementById('errorCorreo');
  const errorClave = document.getElementById('errorClave');

  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validarCorreo() {
    const val = txtCorreo.value.trim();
    if (!val) {
      errorCorreo.textContent = 'El correo electrónico es obligatorio.';
      return false;
    }
    if (!regexCorreo.test(val)) {
      errorCorreo.textContent = 'Ingresa un formato de correo válido.';
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
    errorClave.textContent = '';
    return true;
  }

  // Validación en vivo
  txtCorreo.addEventListener('input', validarCorreo);
  txtClave.addEventListener('input', validarClave);

  // Envío del formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const okCorreo = validarCorreo();
    const okClave = validarClave();

    if (!okCorreo || !okClave) {
      ui.aviso('Por favor completa todos los campos requeridos.', 'advertencia');
      return;
    }

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Ingresando...';
    ui.cargando(true);

    try {
      const correo = txtCorreo.value.trim();
      const clave = txtClave.value;

      await sesion.iniciar(correo, clave);

      ui.aviso('¡Bienvenido de vuelta!', 'exito');
      // Redirigir a inicio tras autenticación exitosa
      window.location.href = '/index.html';
    } catch (err) {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Ingresar';
      ui.cargando(false);
      ui.aviso(err.message || 'Error al iniciar sesión. Revisa tus credenciales.', 'error');
    }
  });
}
