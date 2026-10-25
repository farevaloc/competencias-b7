import * as api from './api.js';

export function token() {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('token');
}

export function usuarioActual() {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem('usuario');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function registrar(datos) {
  return api.llamar('POST', '/api/auth/registro', datos);
}

export async function iniciar(correo, clave) {
  const respuesta = await api.llamar('POST', '/api/auth/login', { correo, clave });
  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem('token', respuesta.token);
    sessionStorage.setItem('usuario', JSON.stringify(respuesta.usuario));
  }
  return respuesta.usuario;
}

export async function cerrar() {
  try {
    await api.llamar('POST', '/api/auth/logout', {});
  } catch {
    // Si falla la petición de cierre en el servidor, igualmente limpiamos localmente
  } finally {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
  }
}

export function exigirRol(roles = []) {
  if (!roles || roles.length === 0 || roles.includes('publico')) {
    return true;
  }

  const tok = token();
  const usuario = usuarioActual();

  // Sin sesión activa -> redirigir a ingreso
  if (!tok || !usuario) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
    return false;
  }

  // Si requiere cualquier usuario autenticado
  if (roles.includes('sesion')) {
    return true;
  }

  // Rol no permitido -> guardar aviso y redirigir a inicio
  if (!roles.includes(usuario.rol)) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: 'No tienes permisos para acceder a esta página.',
        tipo: 'advertencia'
      }));
    }
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/index.html';
    }
    return false;
  }

  return true;
}
