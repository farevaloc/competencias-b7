import { Router } from 'express';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';
import { procesarIntento } from '../gamificacion.js';
import { estudiantesDe } from '../acceso.js';

const router = Router();

// POST /api/intentos (con sesión)
router.post('/intentos', exigirRol(), async (req, res, next) => {
  try {
    const resultado = await procesarIntento(req.usuario, req.body);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/logros/:usuarioId ("yo" permitido, para estudiante propio, docente de sus grupos o admin)
router.get('/logros/:usuarioId', exigirRol(), async (req, res, next) => {
  try {
    const paramId = req.params.usuarioId;
    const targetId = paramId === 'yo' ? req.usuario.id : paramId;

    // Verificar existencia del usuario objetivo
    const usuarios = await almacen.leer('usuarios');
    const usuarioObjetivo = usuarios.find(u => u.id === targetId);
    if (!usuarioObjetivo) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar permisos de acceso
    const esPropio = req.usuario.id === targetId;
    const esAdmin = req.usuario.rol === 'admin';
    let esDocenteValido = false;

    if (req.usuario.rol === 'docente') {
      const misEstudiantes = await estudiantesDe(req.usuario.id);
      esDocenteValido = misEstudiantes.includes(targetId);
    }

    if (!esPropio && !esAdmin && !esDocenteValido) {
      return res.status(403).json({ error: 'Acceso no autorizado a los logros de este usuario' });
    }

    const todosLogros = await almacen.leer('logros');
    const logros = todosLogros.find(l => l.usuarioId === targetId);

    if (!logros) {
      return res.json({
        usuarioId: targetId,
        puntos: 0,
        insignias: [],
        nivelQuiz: {}
      });
    }

    res.json(logros);
  } catch (err) {
    next(err);
  }
});

export default router;
