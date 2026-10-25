import * as almacen from './almacen.js';
import { asignaturasDe, asignaturaDeTema } from './acceso.js';
import { evaluarAlertas } from './alertas.js';

// Control de intentos por hora en memoria (Map<usuarioId, number[] timestamps>)
const intentosPorHora = new Map();

function verificarTasaIntentos(usuarioId, limite) {
  const ahora = Date.now();
  const unaHora = 60 * 60 * 1000;
  const lista = (intentosPorHora.get(usuarioId) || []).filter(t => ahora - t < unaHora);
  if (lista.length >= limite) {
    intentosPorHora.set(usuarioId, lista);
    return false;
  }
  lista.push(ahora);
  intentosPorHora.set(usuarioId, lista);
  return true;
}

function resolverValor(obj, ruta) {
  if (!obj || !ruta) return undefined;
  return ruta.split('.').reduce((acc, parte) => (acc && acc[parte] !== undefined ? acc[parte] : undefined), obj);
}

/**
 * Procesa un intento de gamificación, calcula puntos, guarda intento y evalúa insignias.
 *
 * @param {Object} usuario Usuario que realiza el intento.
 * @param {Object} datos Datos del intento { actividad, temaId, nivel, puntaje, maximo, errores, duracionSeg, detalle }.
 * @returns {Promise<{ puntosGanados: number, puntosTotales: number, insigniasNuevas: Array<{id: string, nombre: string, icono: string}> }>}
 */
export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const error = new Error('Usuario no autenticado');
    error.estado = 401;
    throw error;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const actividad = datos.actividad;

  // 1. Validar actividad existente en reglas.puntos
  if (!actividad || !reglas.puntos || typeof reglas.puntos[actividad] !== 'number') {
    const error = new Error(`Actividad "${actividad}" no válida en las reglas de gamificación`);
    error.estado = 400;
    throw error;
  }

  // 2. Validar puntaje y maximo: 0 <= puntaje <= maximo y maximo > 0
  const maximo = Number(datos.maximo);
  const puntaje = Number(datos.puntaje);
  if (isNaN(maximo) || isNaN(puntaje) || maximo <= 0 || puntaje < 0 || puntaje > maximo) {
    const error = new Error('Los valores de puntaje y máximo son inválidos');
    error.estado = 400;
    throw error;
  }

  // 3. Validar acceso a tema si viene temaId
  if (datos.temaId) {
    const permitidas = await asignaturasDe(usuario);
    const asigId = await asignaturaDeTema(datos.temaId);
    if (!asigId || !permitidas.includes(asigId)) {
      const error = new Error('No tienes acceso al tema especificado');
      error.estado = 403;
      throw error;
    }
  }

  // 4. Límite de intentos por hora (en memoria) -> 429
  const limiteHora = reglas.limiteIntentosHora || 60;
  if (!verificarTasaIntentos(usuario.id, limiteHora)) {
    const error = new Error('Has superado el límite de intentos permitidos por hora');
    error.estado = 429;
    throw error;
  }

  // 5. Cálculo preliminar de puntos
  const puntosBase = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const bono = (datos.errores === 0 && puntaje === maximo) ? (reglas.bonoSinErrores || 0) : 0;
  let puntosCalculados = puntosBase + bono;

  // 6. Condiciones para poner puntos en 0 (el intento se guarda pero sin puntos)
  const todosIntentos = await almacen.leer('intentos');
  const misIntentos = todosIntentos.filter(i => i.usuarioId === usuario.id);

  // 6.1 Actividad única: si ya hay intento con puntos con la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const campos = reglas.unicas[actividad];
    const claveActual = campos.map(c => String(resolverValor(datos, c) ?? '')).join('|');

    const yaTienePuntos = misIntentos.some(i => {
      if (i.actividad !== actividad || !i.puntos || i.puntos <= 0) return false;
      const clavePrev = campos.map(c => String(resolverValor(i, c) ?? '')).join('|');
      return clavePrev === claveActual;
    });

    if (yaTienePuntos) {
      puntosCalculados = 0;
    }
  }

  // 6.2 Requiere aprobado: si está en requiereAprobado y detalle.aprobado !== true
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (!datos.detalle || datos.detalle.aprobado !== true) {
      puntosCalculados = 0;
    }
  }

  // 6.3 Máximo diario alcanzado
  if (reglas.maxDiario && typeof reglas.maxDiario[actividad] === 'number') {
    const hoyStr = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = misIntentos.filter(i =>
      i.actividad === actividad &&
      i.puntos > 0 &&
      i.fecha &&
      i.fecha.slice(0, 10) === hoyStr
    ).length;

    if (intentosHoyConPuntos >= reglas.maxDiario[actividad]) {
      puntosCalculados = 0;
    }
  }

  // 7. Guardar intento
  const intentoGuardado = await almacen.agregar('intentos', {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: datos.nivel ? Number(datos.nivel) : null,
    puntaje,
    maximo,
    errores: Number(datos.errores) || 0,
    duracionSeg: Number(datos.duracionSeg) || 0,
    detalle: datos.detalle || {},
    puntos: puntosCalculados
  });

  // 8. Cargar o inicializar logros
  const todosLogros = await almacen.leer('logros');
  let misLogros = todosLogros.find(l => l.usuarioId === usuario.id);

  if (!misLogros) {
    misLogros = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  } else {
    misLogros.insignias = Array.isArray(misLogros.insignias) ? misLogros.insignias : [];
    misLogros.nivelQuiz = misLogros.nivelQuiz && typeof misLogros.nivelQuiz === 'object' ? misLogros.nivelQuiz : {};
  }

  misLogros.puntos = (misLogros.puntos || 0) + puntosCalculados;

  if (actividad === 'quiz' && datos.temaId && datos.nivel && datos.detalle && datos.detalle.aprobado === true) {
    const nivelNum = Number(datos.nivel);
    misLogros.nivelQuiz[datos.temaId] = Math.max(misLogros.nivelQuiz[datos.temaId] || 0, nivelNum);
  }

  // 9. Evaluar insignias no obtenidas
  const todasInsignias = await almacen.leer('insignias');
  const idsObtenidas = new Set(misLogros.insignias.map(ins => ins.id));
  const insigniasNuevas = [];

  const misIntentosActualizados = [...misIntentos, intentoGuardado];

  for (const ins of todasInsignias) {
    if (idsObtenidas.has(ins.id)) continue;
    const cond = ins.condicion;
    if (!cond || !cond.tipo) continue;

    let gana = false;

    switch (cond.tipo) {
      case 'conteo': {
        const act = cond.actividad;
        const min = cond.minimo || 1;
        const intentosAct = misIntentosActualizados.filter(i => i.actividad === act);

        // En actividades únicas, cuenta claves distintas
        if (reglas.unicas && Array.isArray(reglas.unicas[act])) {
          const campos = reglas.unicas[act];
          const clavesUnicas = new Set(
            intentosAct.map(i => campos.map(c => String(resolverValor(i, c) ?? '')).join('|'))
          );
          if (clavesUnicas.size >= min) gana = true;
        } else {
          if (intentosAct.length >= min) gana = true;
        }
        break;
      }

      case 'sinErrores': {
        const act = cond.actividad;
        // Revisa si algún intento de la actividad se completó sin errores
        const cumplio = misIntentosActualizados.some(i => i.actividad === act && i.errores === 0);
        if (cumplio) gana = true;
        break;
      }

      case 'puntos': {
        const min = cond.minimo || 0;
        if (misLogros.puntos >= min) gana = true;
        break;
      }

      case 'nivelQuiz': {
        const nivelReq = cond.nivel || 1;
        const niveles = Object.values(misLogros.nivelQuiz || {});
        if (niveles.some(lvl => lvl >= nivelReq)) gana = true;
        break;
      }

      case 'racha': {
        const diasReq = cond.dias || 1;
        const diasConIntento = new Set(
          misIntentosActualizados
            .map(i => (i.fecha ? i.fecha.slice(0, 10) : null))
            .filter(Boolean)
        );

        let racha = 0;
        const cursor = new Date();
        while (true) {
          const diaIso = cursor.toISOString().slice(0, 10);
          if (diasConIntento.has(diaIso)) {
            racha++;
            cursor.setDate(cursor.getDate() - 1);
          } else {
            break;
          }
        }

        if (racha >= diasReq) gana = true;
        break;
      }

      default:
        break;
    }

    if (gana) {
      const fechaIso = new Date().toISOString();
      misLogros.insignias.push({ id: ins.id, fecha: fechaIso });
      idsObtenidas.add(ins.id);
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      });
    }
  }

  // 10. Guardar logros actualizados
  if (misLogros.id) {
    await almacen.actualizar('logros', misLogros.id, misLogros);
  } else {
    await almacen.agregar('logros', misLogros);
  }

  // 11. Evaluar alertas tempranas en try/catch
  try {
    await evaluarAlertas(intentoGuardado, usuario);
  } catch (err) {
    console.error('Error al evaluar alertas tras intento:', err);
  }

  return {
    puntosGanados: puntosCalculados,
    puntosTotales: misLogros.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
