import fs from 'node:fs/promises';
import path from 'node:path';

const DATOS_DIR = path.resolve(process.cwd(), 'datos');
const REGEX_COL = /^[a-z0-9_-]+(\/[a-z0-9_-]+)?$/;

// Cola de promesas por ruta de archivo para evitar colisiones en escrituras concurrentes
const colas = new Map();

function encolar(ruta, tarea) {
  const previa = colas.get(ruta) || Promise.resolve();
  const siguiente = previa.then(tarea, tarea);
  colas.set(ruta, siguiente);
  return siguiente.finally(() => {
    if (colas.get(ruta) === siguiente) {
      colas.delete(ruta);
    }
  });
}

function validarCol(col) {
  if (typeof col !== 'string' || !REGEX_COL.test(col)) {
    const error = new Error(`Nombre de colección inválido: "${col}"`);
    error.estado = 400;
    throw error;
  }
}

function obtenerRutaCol(col) {
  return path.join(DATOS_DIR, `${col}.json`);
}

function obtenerPrefijoId(col) {
  const base = col.split('/')[0].replace(/[^a-z0-9]/g, '');
  return base.slice(0, 3).toLowerCase().padEnd(3, 'x');
}

function generarId(col, lista) {
  const prefijo = obtenerPrefijoId(col);
  const regex = new RegExp(`^${prefijo}_(\\d+)$`);
  let maxNum = 0;
  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const match = item.id.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }
  return `${prefijo}_${String(maxNum + 1).padStart(6, '0')}`;
}

async function escribirSeguro(rutaDestino, contenido) {
  await fs.mkdir(path.dirname(rutaDestino), { recursive: true });
  const rutaTmp = `${rutaDestino}.tmp`;
  await fs.writeFile(rutaTmp, contenido, 'utf-8');
  await fs.rename(rutaTmp, rutaDestino);
}

// Respaldo diario en la primera escritura del día
let respaldoPromesa = null;

async function asegurarRespaldoDiario() {
  if (respaldoPromesa) return respaldoPromesa;

  respaldoPromesa = (async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    const rutaRespaldos = path.join(DATOS_DIR, 'respaldos');
    const rutaHoy = path.join(rutaRespaldos, hoy);

    try {
      await fs.access(rutaHoy);
      // El respaldo de hoy ya existe
      return;
    } catch {
      // Proceder con el respaldo
    }

    try {
      await fs.mkdir(DATOS_DIR, { recursive: true });
      await fs.mkdir(rutaHoy, { recursive: true });

      const entradas = await fs.readdir(DATOS_DIR, { withFileTypes: true });
      for (const entrada of entradas) {
        if (entrada.name === 'respaldos') continue;
        const origen = path.join(DATOS_DIR, entrada.name);
        const destino = path.join(rutaHoy, entrada.name);
        await fs.cp(origen, destino, { recursive: true });
      }

      // Conservar solo los 14 respaldos más recientes
      const carpetas = (await fs.readdir(rutaRespaldos, { withFileTypes: true }))
        .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
        .map(e => e.name)
        .sort();

      if (carpetas.length > 14) {
        const aEliminar = carpetas.slice(0, carpetas.length - 14);
        for (const carpeta of aEliminar) {
          await fs.rm(path.join(rutaRespaldos, carpeta), { recursive: true, force: true });
        }
      }
    } catch (err) {
      console.error('Error durante el respaldo diario:', err);
    }
  })();

  try {
    await respaldoPromesa;
  } finally {
    respaldoPromesa = null;
  }
}

export async function leer(col) {
  validarCol(col);
  const ruta = obtenerRutaCol(col);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    const parsed = JSON.parse(contenido);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function escribir(col, lista) {
  validarCol(col);
  const ruta = obtenerRutaCol(col);
  await asegurarRespaldoDiario();
  return encolar(ruta, async () => {
    await escribirSeguro(ruta, JSON.stringify(lista, null, 2));
  });
}

export async function agregar(col, reg) {
  validarCol(col);
  const ruta = obtenerRutaCol(col);
  await asegurarRespaldoDiario();
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const id = reg.id || generarId(col, lista);
    const fecha = reg.fecha || new Date().toISOString();
    const nuevo = { ...reg, id, fecha };
    lista.push(nuevo);
    await escribirSeguro(ruta, JSON.stringify(lista, null, 2));
    return nuevo;
  });
}

export async function actualizar(col, id, cambios) {
  validarCol(col);
  const ruta = obtenerRutaCol(col);
  await asegurarRespaldoDiario();
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const indice = lista.findIndex(r => r.id === id);
    if (indice === -1) {
      const error = new Error(`Registro con id "${id}" no encontrado en "${col}"`);
      error.estado = 404;
      throw error;
    }
    const anterior = lista[indice];
    const actualizado = {
      ...anterior,
      ...cambios,
      id: anterior.id,
    };
    lista[indice] = actualizado;
    await escribirSeguro(ruta, JSON.stringify(lista, null, 2));
    return actualizado;
  });
}

export async function eliminar(col, id) {
  validarCol(col);
  const ruta = obtenerRutaCol(col);
  await asegurarRespaldoDiario();
  return encolar(ruta, async () => {
    const lista = await leer(col);
    const nuevaLista = lista.filter(r => r.id !== id);
    await escribirSeguro(ruta, JSON.stringify(nuevaLista, null, 2));
    return true;
  });
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  const claves = Object.keys(filtro);
  if (claves.length === 0) return lista;
  return lista.filter(item => {
    return claves.every(k => item[k] === filtro[k] || String(item[k]) === String(filtro[k]));
  });
}

export async function anexarLinea(archivo, obj) {
  await asegurarRespaldoDiario();
  const nombreArchivo = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DATOS_DIR, nombreArchivo);
  return encolar(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const linea = JSON.stringify(obj) + '\n';
    await fs.appendFile(ruta, linea, 'utf-8');
  });
}

export async function leerLineas(archivo) {
  const nombreArchivo = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DATOS_DIR, nombreArchivo);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return contenido
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => JSON.parse(linea));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function leerConfig(nombre) {
  const nombreArchivo = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(DATOS_DIR, 'config', nombreArchivo);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

export async function escribirConfig(nombre, obj) {
  const nombreArchivo = nombre.endsWith('.json') ? nombre : `${nombre}.json`;
  const ruta = path.join(DATOS_DIR, 'config', nombreArchivo);
  await escribirSeguro(ruta, JSON.stringify(obj, null, 2));
}
