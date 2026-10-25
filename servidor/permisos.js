import fs from 'node:fs';
import path from 'node:path';

const RUTA_PERMISOS = path.resolve(process.cwd(), 'datos', 'config', 'permisos.json');

export function puede(usuario, accion, col, registro = null) {
  let config;
  try {
    const raw = fs.readFileSync(RUTA_PERMISOS, 'utf-8');
    config = JSON.parse(raw);
  } catch {
    return false;
  }

  // Colección no listada -> false
  if (!config || !config[col]) {
    return false;
  }

  const reglas = config[col][accion];
  if (!Array.isArray(reglas)) {
    return false;
  }

  for (const regla of reglas) {
    // "servidor" nunca se permite desde la API
    if (regla === 'servidor') {
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    // Reglas que requieren usuario autenticado
    if (!usuario) {
      continue;
    }

    if (regla === 'sesion') {
      return true;
    }

    if (usuario.rol && regla === usuario.rol) {
      return true;
    }

    if (regla === 'propio') {
      if (registro) {
        if (registro.usuarioId === usuario.id || (col === 'usuarios' && registro.id === usuario.id)) {
          return true;
        }
      } else {
        // Acceso a nivel de colección para usuario autenticado
        return true;
      }
    }
  }

  return false;
}
