import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RUTA_GANCHOS = path.resolve(process.cwd(), 'servidor', 'ganchos');
const ganchos = {};

export async function cargarGanchos() {
  try {
    const archivos = await fs.readdir(RUTA_GANCHOS);
    for (const archivo of archivos) {
      if (archivo.endsWith('.js')) {
        const col = archivo.replace(/\.js$/, '');
        const rutaCompleta = path.join(RUTA_GANCHOS, archivo);
        const modulo = await import(pathToFileURL(rutaCompleta).href);
        ganchos[col] = modulo.default || modulo;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error al cargar ganchos:', err);
    }
  }
}

// Carga automática al iniciar el módulo
await cargarGanchos();

export async function aplicar(col, nombre, ...args) {
  if (!ganchos[col]) {
    try {
      const rutaCompleta = path.join(RUTA_GANCHOS, `${col}.js`);
      const modulo = await import(`${pathToFileURL(rutaCompleta).href}?t=${Date.now()}`);
      ganchos[col] = modulo.default || modulo;
    } catch (_) {
      // Colección sin archivo de gancho específico
    }
  }

  const colGanchos = ganchos[col];
  if (colGanchos && typeof colGanchos[nombre] === 'function') {
    return await colGanchos[nombre](...args);
  }
  return args[0];
}
