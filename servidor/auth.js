import * as almacen from './almacen.js';

export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = Date.now();
    const vigentes = sesiones.filter(s => s.expira && new Date(s.expira).getTime() > ahora);
    if (vigentes.length < sesiones.length) {
      await almacen.escribir('sesiones', vigentes);
    }
  } catch (err) {
    console.error('Error al limpiar sesiones vencidas:', err);
  }
}

// Limpiar sesiones vencidas al cargar el módulo
await limpiarSesionesVencidas();

export async function cargarUsuario(req, res, next) {
  try {
    req.usuario = null;
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next();
    }

    const sesiones = await almacen.leer('sesiones');
    const sesion = sesiones.find(s => s.token === token);
    if (!sesion) {
      return next();
    }

    if (new Date(sesion.expira).getTime() <= Date.now()) {
      return next();
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.id === sesion.usuarioId && u.activo !== false);
    if (!usuario) {
      return next();
    }

    req.usuario = {
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      rol: usuario.rol,
      correo: usuario.correo
    };
    next();
  } catch (err) {
    console.error('Error en middleware cargarUsuario:', err);
    req.usuario = null;
    next();
  }
}

export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión no válida o requerida' });
    }
    if (roles.length > 0 && !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
}
