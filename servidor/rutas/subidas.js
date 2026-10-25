import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

const RUTA_SUBIDAS = path.resolve(process.cwd(), 'publico', 'recursos', 'subidas');
if (!fs.existsSync(RUTA_SUBIDAS)) {
  fs.mkdirSync(RUTA_SUBIDAS, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, RUTA_SUBIDAS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

// POST /api/subidas (con sesión)
router.post('/subidas', exigirRol(), async (req, res) => {
  try {
    const ajustes = await almacen.leerConfig('ajustes');
    const esDocenteOAdmin = req.usuario && (req.usuario.rol === 'docente' || req.usuario.rol === 'admin');
    const maxSubidaMB = esDocenteOAdmin ? (ajustes.maxSubidaMB || 10) : 2;
    const maxBytes = maxSubidaMB * 1024 * 1024;

    const upload = multer({
      storage,
      limits: { fileSize: maxBytes },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const esImagen = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) &&
                         ['.jpg', '.jpeg', '.png', '.webp'].includes(ext);

        if (esDocenteOAdmin) {
          const esPdf = file.mimetype === 'application/pdf' && ext === '.pdf';
          const esMp3 = (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') && ext === '.mp3';

          if (esImagen || esPdf || esMp3) {
            return cb(null, true);
          }
          const err = new Error('Solo se permiten imágenes (JPG, PNG, WEBP), documentos PDF o audios MP3');
          err.codigo = 'TIPO_INVALIDO';
          return cb(err, false);
        } else {
          if (esImagen) {
            return cb(null, true);
          }
          const err = new Error('Solo se permiten imágenes JPG, PNG o WEBP');
          err.codigo = 'TIPO_INVALIDO';
          return cb(err, false);
        }
      }
    });

    upload.single('archivo')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: `El archivo excede el tamaño máximo permitido de ${maxSubidaMB} MB` });
        }
        return res.status(400).json({ error: err.message || 'Error al subir el archivo' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      const url = `/recursos/subidas/${req.file.filename}`;
      res.json({ url });
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error en el servidor al procesar la subida' });
  }
});

export default router;
