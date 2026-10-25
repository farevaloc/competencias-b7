import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import { aplicar } from './ganchos.js';

dotenv.config();

const app = express();
const PUERTO = process.env.PORT || process.env.PUERTO || 3000;

// Servir archivos estáticos desde publico/
app.use(express.static(path.resolve(process.cwd(), 'publico')));

// Parsear cuerpos JSON con límite de 1 MB
app.use(express.json({ limit: '1mb' }));

import { cargarUsuario } from './auth.js';
app.use(cargarUsuario);

// Envoltorio para manejar errores en funciones asíncronas
const wrap = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Montar automáticamente cada servidor/rutas/*.js antes de la API genérica
const RUTA_RUTAS = path.resolve(process.cwd(), 'servidor', 'rutas');

async function montarRutas() {
  try {
    const archivos = await fs.readdir(RUTA_RUTAS);
    const archivosJs = archivos.filter(f => f.endsWith('.js')).sort();
    for (const archivo of archivosJs) {
      const rutaCompleta = path.join(RUTA_RUTAS, archivo);
      const modulo = await import(pathToFileURL(rutaCompleta).href);
      const router = modulo.default;
      if (router) {
        app.use('/api', router);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al montar rutas:', err);
    }
  }
}

await montarRutas();

// API Genérica: GET /api/:col
app.get('/api/:col', wrap(async (req, res) => {
  const { col } = req.params;
  if (!puede(req.usuario, 'leer', col)) {
    const error = new Error('Acceso no autorizado');
    error.estado = req.usuario ? 403 : 401;
    throw error;
  }

  let lista = await almacen.leer(col);

  // Filtros exactos por query
  const claves = Object.keys(req.query);
  if (claves.length > 0) {
    lista = lista.filter(item => {
      return claves.every(k => String(item[k]) === String(req.query[k]));
    });
  }

  lista = await aplicar(col, 'filtrarLista', lista, req.usuario);
  res.json(lista);
}));

// API Genérica: GET /api/:col/:id
app.get('/api/:col/:id', wrap(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const registro = lista.find(r => r.id === id);

  if (!registro) {
    const error = new Error('Registro no encontrado');
    error.estado = 404;
    throw error;
  }

  if (!puede(req.usuario, 'leer', col, registro)) {
    const error = new Error('Acceso no autorizado');
    error.estado = req.usuario ? 403 : 401;
    throw error;
  }

  res.json(registro);
}));

// API Genérica: POST /api/:col
app.post('/api/:col', wrap(async (req, res) => {
  const { col } = req.params;
  if (!puede(req.usuario, 'escribir', col, req.body)) {
    const error = new Error('Acceso no autorizado');
    error.estado = req.usuario ? 403 : 401;
    throw error;
  }

  let datos = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);
  const nuevo = await almacen.agregar(col, datos);
  await aplicar(col, 'despuesDeGuardar', nuevo, req.usuario, null);

  res.status(201).json(nuevo);
}));

// API Genérica: PUT /api/:col/:id
app.put('/api/:col/:id', wrap(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const anterior = lista.find(r => r.id === id);

  if (!anterior) {
    const error = new Error('Registro no encontrado');
    error.estado = 404;
    throw error;
  }

  if (!puede(req.usuario, 'escribir', col, anterior)) {
    const error = new Error('Acceso no autorizado');
    error.estado = req.usuario ? 403 : 401;
    throw error;
  }

  let cambios = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
  const actualizado = await almacen.actualizar(col, id, cambios);
  await aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

  res.json(actualizado);
}));

// API Genérica: DELETE /api/:col/:id
app.delete('/api/:col/:id', wrap(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const anterior = lista.find(r => r.id === id);

  if (!anterior) {
    const error = new Error('Registro no encontrado');
    error.estado = 404;
    throw error;
  }

  if (!puede(req.usuario, 'escribir', col, anterior)) {
    const error = new Error('Acceso no autorizado');
    error.estado = req.usuario ? 403 : 401;
    throw error;
  }

  await almacen.eliminar(col, id);
  await aplicar(col, 'despuesDeGuardar', null, req.usuario, anterior);

  res.json({ ok: true });
}));

// Manejo centralizado de errores
app.use((err, req, res, next) => {
  const estado = Number.isInteger(err.estado) ? err.estado : (Number.isInteger(err.status) ? err.status : 500);
  res.status(estado).json({ error: err.message || 'Error interno del servidor' });
});

// Iniciar servidor si se ejecuta directamente
const esModuloPrincipal = process.argv[1] && process.argv[1].endsWith('server.js');
if (esModuloPrincipal) {
  app.listen(PUERTO, () => {
    console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
  });
}

export default app;
