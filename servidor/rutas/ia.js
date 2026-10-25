import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

/**
 * Obtiene la configuración de IA priorizando datos/config/ajustes.json sobre las variables de entorno
 */
async function obtenerConfigIA() {
  const ajustes = await almacen.leerConfig('ajustes');
  const proveedor = (ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').toLowerCase();
  const clave = (ajustes.iaClave || process.env.IA_CLAVE || '').trim();
  const modelo = (ajustes.iaModelo || process.env.IA_MODELO || 'gemini-1.5-flash').trim();

  return { proveedor, clave, modelo, ajustes };
}

/**
 * Limpia y parsea respuestas de modelos que envuelven JSON en bloques de código markdown
 */
function parsearJSONSeguro(texto) {
  if (!texto || typeof texto !== 'string') return null;
  let limpio = texto.trim();
  if (limpio.startsWith('```json')) {
    limpio = limpio.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (limpio.startsWith('```')) {
    limpio = limpio.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  try {
    return JSON.parse(limpio.trim());
  } catch {
    return null;
  }
}

/**
 * Generador contextual de respaldo cuando no hay proveedor de IA configurado
 */
function generarPreguntasSimuladas(datos) {
  const tema = datos.tema || 'el tema';
  const nivelNum = parseInt(datos.nivelBloom, 10) || 1;
  const cantidad = Math.max(5, Math.min(15, Number(datos.cantidad) || 5));

  const lineasGlosario = (datos.glosario || '')
    .split('\n')
    .filter(l => l.includes(':'))
    .map(l => {
      const [t, ...resto] = l.split(':');
      return { termino: t.trim(), definicion: resto.join(':').trim() };
    });

  const verbosPorNivel = {
    1: ['¿Qué es', '¿Cuál de las siguientes opciones define mejor a', 'Identifique el concepto correspondiente a'],
    2: ['¿Cómo se interpreta el concepto de', '¿Cuál es la función principal de', '¿Por qué es relevante'],
    3: ['En una situación práctica, ¿cómo se aplica', '¿Qué procedimiento se debe seguir al implementar', 'Ante un caso de estudio, ¿cómo actúa'],
    4: ['Al comparar los componentes de', '¿Qué diferencia clave existe entre los elementos de', 'Analice cuál es la causa directa en'],
    5: ['¿Cuál criterio es el más adecuado para evaluar', '¿Qué impacto genera la toma de decisiones en', 'Valore la efectividad de']
  };

  const verbos = verbosPorNivel[nivelNum] || verbosPorNivel[1];
  const resultado = [];

  for (let i = 0; i < cantidad; i++) {
    const tipo = i % 3 === 0 ? 'opcion' : (i % 3 === 1 ? 'vf' : 'completar');
    const glos = lineasGlosario[i % Math.max(1, lineasGlosario.length)];
    const concepto = glos ? glos.termino : `${tema} (concepto ${i + 1})`;
    const def = glos ? glos.definicion : `definición esencial del tema ${tema}`;
    const prefijo = verbos[i % verbos.length];

    if (tipo === 'opcion') {
      resultado.push({
        tipo: 'opcion',
        enunciado: `${prefijo} "${concepto}" en el contexto de ${tema}?`,
        opciones: [
          def.length > 5 ? def : `Es el elemento fundamental para el desarrollo de ${concepto}.`,
          `Un componente secundario no relacionado con los objetivos de ${tema}.`,
          `Un procedimiento obsoleto que ya no se utiliza en el área.`,
          `Una herramienta exclusiva para entornos ajenos a ${tema}.`
        ],
        correcta: 0,
        retroalimentacion: `La opción correcta corresponde a la conceptualización precisa de "${concepto}".`
      });
    } else if (tipo === 'vf') {
      const esVerdadero = i % 2 === 0;
      resultado.push({
        tipo: 'vf',
        enunciado: esVerdadero
          ? `"${concepto}" se refiere a: ${def}.`
          : `"${concepto}" no guarda relación alguna con los procesos formativos de ${tema}.`,
        opciones: ['Verdadero', 'Falso'],
        correcta: esVerdadero,
        retroalimentacion: esVerdadero
          ? `Es verdadero porque define correctamente a "${concepto}".`
          : `Es falso porque "${concepto}" sí está directamente vinculado con ${tema}.`
      });
    } else {
      resultado.push({
        tipo: 'completar',
        enunciado: `El concepto que se define como "${def}" se denomina ____.`,
        opciones: [],
        correcta: concepto,
        retroalimentacion: `El término exacto que completa la afirmación es "${concepto}".`
      });
    }
  }

  return resultado;
}

// GET /api/admin/ia-config (solo admin)
router.get('/admin/ia-config', exigirRol('admin'), async (req, res, next) => {
  try {
    const { proveedor, clave, modelo } = await obtenerConfigIA();
    const claveMascara = clave.length > 8
      ? `${clave.slice(0, 8)}...${clave.slice(-4)}`
      : (clave ? '••••••••' : '');

    res.json({
      proveedor,
      modelo,
      claveConfigurada: Boolean(clave),
      claveMascara
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/ia-config (solo admin)
router.put('/admin/ia-config', exigirRol('admin'), async (req, res, next) => {
  try {
    const { proveedor, modelo, clave } = req.body;
    const ajustes = await almacen.leerConfig('ajustes');

    if (proveedor) ajustes.iaProveedor = String(proveedor).trim();
    if (modelo) ajustes.iaModelo = String(modelo).trim();
    if (clave !== undefined && clave !== null && String(clave).trim() !== '') {
      ajustes.iaClave = String(clave).trim();
    }

    await almacen.escribirConfig('ajustes', ajustes);

    res.json({
      ok: true,
      mensaje: 'Configuración de IA actualizada con éxito',
      proveedor: ajustes.iaProveedor,
      modelo: ajustes.iaModelo,
      claveConfigurada: Boolean(ajustes.iaClave)
    });
  } catch (err) {
    next(err);
  }
});

const MODELOS_PREDETERMINADOS = [
  { id: 'gemini-flash-lite-latest', nombre: 'Gemini Flash Lite (⭐ Recomendado · Máxima disponibilidad y velocidad)' },
  { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash Lite (⭐ Alta disponibilidad y estabilidad)' },
  { id: 'gemini-3-flash-preview', nombre: 'Gemini 3 Flash Preview (Rápido y disponible)' },
  { id: 'gemini-flash-latest', nombre: 'Gemini Flash Latest (Estándar · Sujeto a demanda)' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash (Última versión · Sujeto a alta demanda)' },
  { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon (Avanzado · Requiere plan con facturación)' }
];

// GET /api/ia/modelos (solo admin) - Lista de modelos disponibles de Gemini
router.get('/ia/modelos', exigirRol('admin'), async (req, res, next) => {
  try {
    const { clave } = await obtenerConfigIA();
    const claveConsulta = req.query.clave || clave;

    if (!claveConsulta) {
      return res.json({
        enVivo: false,
        modelos: MODELOS_PREDETERMINADOS
      });
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(claveConsulta)}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const lista = Array.isArray(data.models) ? data.models : [];
        const filtrados = lista
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => {
            const id = m.name.replace(/^models\//, '');
            return {
              id,
              nombre: `${m.displayName || id} (${id})`
            };
          })
          .filter(m => !m.id.includes('embedding') && !m.id.includes('aqa'));

        if (filtrados.length > 0) {
          // Ordenar poniendo flash primero
          filtrados.sort((a, b) => {
            const aFlash = a.id.includes('flash');
            const bFlash = b.id.includes('flash');
            if (aFlash && !bFlash) return -1;
            if (!aFlash && bFlash) return 1;
            return a.id.localeCompare(b.id);
          });

          return res.json({
            enVivo: true,
            modelos: filtrados
          });
        }
      }
    } catch (errApi) {
      console.warn('Error al consultar lista de modelos de Gemini en vivo:', errApi.message);
    }

    res.json({
      enVivo: false,
      modelos: MODELOS_PREDETERMINADOS
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/prueba (solo admin) - Prueba de conexión con Gemini
router.get('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    const { proveedor, clave, modelo } = await obtenerConfigIA();

    if (!clave) {
      return res.status(400).json({
        ok: false,
        error: 'No hay ninguna clave de API configurada para Gemini'
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde únicamente con el siguiente JSON: {"prueba": "ok", "estado": "conectado"}' }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const json = await resp.json();
    if (!resp.ok) {
      const mensaje = json?.error?.message || `Error HTTP ${resp.status} al conectar con Gemini`;
      return res.status(resp.status).json({
        ok: false,
        error: mensaje
      });
    }

    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    const datos = parsearJSONSeguro(texto);

    res.json({
      ok: true,
      mensaje: `Conexión exitosa con ${modelo}`,
      proveedor,
      modelo,
      respuesta: datos || texto
    });
  } catch (err) {
    next(err);
  }
});

function generarRespuestaSocraticaSimulada(datos) {
  const temaRef = datos.asignatura || 'la asignatura';
  const mensajeEstudiante = (datos.mensaje || '').toLowerCase();

  // Si pregunta algo fuera de tema o saludo
  if (mensajeEstudiante.includes('hola') || mensajeEstudiante.includes('buenos') || mensajeEstudiante.length < 5) {
    return `¡Hola! Soy tu Tutor Virtual Socrático para ${temaRef}. Mi objetivo no es darte respuestas ya hechas, sino acompañarte mediante preguntas y pistas para que construyas tu propio aprendizaje. ¿Qué concepto o desafío de las unidades actuales te gustaría explorar hoy?`;
  }

  const preguntasSocraticas = [
    `Es una pregunta muy interesante en el contexto de ${temaRef}. Antes de profundizar, ¿qué conceptos previos recuerdas de las lecturas de la unidad que podrían relacionarse con esto? ¿Cómo definirías la idea principal con tus propias palabras?`,
    `Para ayudarte a deducir la respuesta por ti mismo: si comparamos esta situación con los ejemplos presentados en los temas de ${temaRef}, ¿qué elementos comunes identificas? ¿Qué consecuencia crees que tendría aplicar un enfoque diferente?`,
    `Vamos a analizarlo paso a paso. Imagina un escenario real de aplicación en esta área: ¿cuál sería el primer paso que darías y qué principio de la asignatura respaldaría esa decisión? ¿Qué variables crees que están influyendo?`,
    `¡Excelente inquietud para reflexionar! Piensa en la definición esencial de este concepto según el glosario de la materia: ¿en qué se diferencia de los otros enfoques estudiados? ¿Qué pista te da esa diferencia sobre lo que estás buscando?`
  ];

  const indice = Math.abs(mensajeEstudiante.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % preguntasSocraticas.length;
  return preguntasSocraticas[indice];
}

// POST /api/ia/:tarea (con sesión: estudiantes, docentes y administradores)
router.post('/ia/:tarea', exigirRol(), async (req, res, next) => {
  try {
    const { tarea } = req.params;

    // 1. Cargar el preparador de la tarea
    const rutaPreparador = path.resolve(process.cwd(), 'servidor', 'preparadores', `${tarea}.js`);
    let preparador;
    try {
      const modulo = await import(pathToFileURL(rutaPreparador).href);
      preparador = modulo.default;
    } catch {
      const error = new Error(`Preparador no encontrado para la tarea "${tarea}"`);
      error.estado = 404;
      throw error;
    }

    // 2. Ejecutar el preparador
    const datos = await preparador(req.body, req.usuario);

    // 3. Cargar la plantilla de prompt
    const rutaPrompt = path.resolve(process.cwd(), 'servidor', 'prompts', `${tarea}.txt`);
    let plantilla = '';
    try {
      plantilla = await fs.readFile(rutaPrompt, 'utf-8');
    } catch {
      plantilla = '';
    }

    // 4. Rellenar la plantilla
    let promptFinal = plantilla;
    if (plantilla && typeof datos === 'object') {
      for (const [clave, valor] of Object.entries(datos)) {
        promptFinal = promptFinal.replaceAll(`{{${clave}}}`, String(valor ?? ''));
      }
    }

    let resultado = null;
    const { proveedor, clave, modelo } = await obtenerConfigIA();

    // 5. Invocar Gemini si hay clave configurada
    if (clave && (proveedor === 'gemini' || proveedor === 'google')) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent?key=${encodeURIComponent(clave)}`;
        const payloadGemini = {
          contents: [{ parts: [{ text: promptFinal }] }]
        };

        // Solo forzar formato JSON para generación de preguntas o glosario, no para el tutor conversacional
        if (tarea !== 'tutor') {
          payloadGemini.generationConfig = { responseMimeType: 'application/json' };
        }

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadGemini)
        });

        if (resp.ok) {
          const json = await resp.json();
          const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (texto) {
            if (tarea === 'tutor') {
              resultado = { respuesta: texto.trim() };
            } else {
              resultado = parsearJSONSeguro(texto);
            }
          }
        } else {
          const errorResp = await resp.json().catch(() => ({}));
          console.warn(`[IA] Error ${resp.status} de Gemini en tarea "${tarea}":`, errorResp?.error?.message);
        }
      } catch (errApi) {
        console.warn(`[IA] Error de red al invocar Gemini en tarea "${tarea}":`, errApi.message);
      }
    }

    // 6. Si no hay proveedor configurado o falló la API, usar generador simulado contextual
    if (!resultado) {
      if (tarea === 'generar-preguntas') {
        resultado = generarPreguntasSimuladas(datos);
      } else if (tarea === 'tutor') {
        resultado = {
          respuesta: generarRespuestaSocraticaSimulada(datos)
        };
      } else {
        resultado = [];
      }
    }

    // 7. Si es consulta del tutor, registrar en la colección consultas-tutor
    if (tarea === 'tutor') {
      try {
        await almacen.agregar('consultas-tutor', {
          usuarioId: req.usuario.id,
          asignaturaId: req.body.asignaturaId || null,
          temaId: req.body.temaId || null,
          dia: new Date().toISOString().slice(0, 10),
          mensaje: req.body.mensaje,
          respuesta: resultado.respuesta,
          fecha: new Date().toISOString()
        });
      } catch (errCol) {
        console.warn('Error al registrar consulta en consultas-tutor:', errCol.message);
      }
    }

    // 8. Registrar en bitácora de consumo-ia.jsonl
    try {
      await almacen.anexarLinea('consumo-ia.jsonl', {
        usuarioId: req.usuario.id,
        tarea,
        modelo: clave ? modelo : 'simulado',
        ok: true,
        fecha: new Date().toISOString()
      });
    } catch (errLog) {
      console.warn('Error al registrar en consumo-ia.jsonl:', errLog.message);
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

export default router;
