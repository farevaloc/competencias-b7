import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Control de intentos fallidos en memoria (máximo 5 fallos por correo en 15 minutos)
const intentosFallidos = new Map();

function verificarTasaFallos(correo) {
  const ahora = Date.now();
  const ventana = 15 * 60 * 1000;
  const intentos = (intentosFallidos.get(correo) || []).filter(t => ahora - t < ventana);
  intentosFallidos.set(correo, intentos);
  return intentos.length >= 5;
}

function registrarFallo(correo) {
  const intentos = intentosFallidos.get(correo) || [];
  intentos.push(Date.now());
  intentosFallidos.set(correo, intentos);
}

function limpiarFallos(correo) {
  intentosFallidos.delete(correo);
}

// POST /api/auth/registro
router.post('/auth/registro', async (req, res) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body;

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || typeof correo !== 'string' || !regexCorreo.test(correo.trim())) {
      return res.status(400).json({ error: 'Correo electrónico no válido' });
    }

    const correoNormalizado = correo.trim().toLowerCase();
    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.some(u => u.correo && u.correo.toLowerCase() === correoNormalizado);
    if (yaExiste) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    if (!clave || typeof clave !== 'string' || clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar el consentimiento para registrarse' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevoUsuario = await almacen.agregar('usuarios', {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNormalizado,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: '',
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    res.status(201).json({
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.nombre,
      apellido: nuevoUsuario.apellido,
      correo: nuevoUsuario.correo,
      rol: nuevoUsuario.rol
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al registrar usuario' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { correo, clave } = req.body;
    if (!correo || !clave) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const correoNormalizado = correo.trim().toLowerCase();

    if (verificarTasaFallos(correoNormalizado)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Intente de nuevo en 15 minutos.' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.correo && u.correo.toLowerCase() === correoNormalizado);

    if (!usuario || usuario.activo === false) {
      registrarFallo(correoNormalizado);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const coincide = await bcrypt.compare(clave, usuario.claveHash);
    if (!coincide) {
      registrarFallo(correoNormalizado);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    limpiarFallos(correoNormalizado);

    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 8 * 3600 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Bitácora de login
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
        correo: usuario.correo,
        foto: usuario.foto || ''
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error en inicio de sesión' });
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find(s => s.token === token);
      if (sesion) {
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    if (req.usuario) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId: req.usuario.id,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cerrar sesión' });
  }
});

// GET /api/auth/yo
router.get('/auth/yo', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.id === req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      foto: usuario.foto || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al obtener perfil' });
  }
});

// PUT /api/auth/perfil
router.put('/auth/perfil', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { nombre, apellido, foto } = req.body;
    const cambios = {};
    if (typeof nombre === 'string' && nombre.trim()) cambios.nombre = nombre.trim();
    if (typeof apellido === 'string' && apellido.trim()) cambios.apellido = apellido.trim();
    if (typeof foto === 'string') cambios.foto = foto.trim();

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);

    res.json({
      id: actualizado.id,
      nombre: actualizado.nombre,
      apellido: actualizado.apellido,
      correo: actualizado.correo,
      rol: actualizado.rol,
      foto: actualizado.foto || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al actualizar perfil' });
  }
});

// POST /api/auth/clave
router.post('/auth/clave', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const { actual, nueva } = req.body;

    if (!nueva || typeof nueva !== 'string' || nueva.length < 8 || !/[a-zA-Z]/.test(nueva) || !/\d/.test(nueva)) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres y contener letras y números' });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.id === req.usuario.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const coincide = await bcrypt.compare(actual || '', usuario.claveHash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const claveHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', usuario.id, { claveHash });

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'cambio_clave',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cambiar contraseña' });
  }
});

// POST /api/admin/usuarios/:id/restablecer (admin)
router.post('/admin/usuarios/:id/restablecer', exigirRol('admin'), async (req, res) => {
  try {
    const targetId = req.params.id;
    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.id === targetId);

    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Generar clave temporal de 10 caracteres con letras y números
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let claveTemporal = '';
    for (let i = 0; i < 10; i++) {
      claveTemporal += caracteres[crypto.randomInt(caracteres.length)];
    }

    const claveHash = await bcrypt.hash(claveTemporal, 10);
    await almacen.actualizar('usuarios', usuario.id, { claveHash });

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo: 'restablecer_clave',
      recurso: `usuarios/${usuario.id}`,
      fecha: new Date().toISOString()
    });

    res.json({ claveTemporal });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al restablecer contraseña' });
  }
});

// POST /api/eventos
router.post('/eventos', async (req, res) => {
  try {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Sesión requerida' });
    }

    const { tipo, recurso } = req.body;
    if (!tipo) {
      return res.status(400).json({ error: 'El tipo de evento es obligatorio' });
    }

    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo,
      recurso: recurso || null,
      fecha: new Date().toISOString()
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al registrar evento' });
  }
});

export default router;
