import * as api from './api.js';
import * as sesion from './sesion.js';
import * as ui from './ui.js';

/**
 * Carga la librería jsPDF desde CDN de forma dinámica si aún no está presente en la página.
 */
async function asegurarJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error('No se pudo inicializar jsPDF'));
      }
    };
    script.onerror = () => reject(new Error('Error de red al cargar librería jsPDF'));
    document.head.appendChild(script);
  });
}

const NOMBRES_BLOOM = {
  1: 'Nivel 1 · Recordar',
  2: 'Nivel 2 · Comprender',
  3: 'Nivel 3 · Aplicar',
  4: 'Nivel 4 · Analizar',
  5: 'Nivel 5 · Evaluar'
};

/**
 * Genera y descarga un diploma en formato PDF.
 * Contrato §A: generarDiploma({ tipo: "cumplimiento" | "nivel-quiz", temaId, nivel }) → { codigo }
 *
 * @param {Object} opciones
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo = 'nivel-quiz', temaId, nivel = 1 }) {
  ui.cargando(true);
  try {
    const jsPDF = await asegurarJsPDF();
    const usuario = sesion.usuarioActual();
    const nombreEstudiante = usuario ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() : 'Estudiante';

    // Obtener datos del tema y asignatura
    let tituloTema = 'Tema de estudio';
    let nombreAsignatura = 'Ecosistema Educativo';

    if (temaId) {
      try {
        const tema = await api.obtener('temas', temaId);
        if (tema && tema.titulo) tituloTema = tema.titulo;
        if (tema && tema.unidadId) {
          const unidad = await api.obtener('unidades', tema.unidadId);
          if (unidad && unidad.asignaturaId) {
            const asig = await api.obtener('asignaturas', unidad.asignaturaId);
            if (asig && asig.nombre) nombreAsignatura = asig.nombre;
          }
        }
      } catch (errDatos) {
        console.warn('No se pudieron obtener todos los metadatos para el diploma:', errDatos.message);
      }
    }

    const aleatorio = Math.random().toString(36).substring(2, 8).toUpperCase();
    const codigo = `DIP-${tipo === 'nivel-quiz' ? `N${nivel}` : 'CUM'}-${aleatorio}`;
    const fechaEmision = new Date().toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });

    // Crear documento PDF horizontal (Landscape A4: 297mm x 210mm)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const ancho = 297;
    const alto = 210;

    // Fondo y marcos decorativos
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, ancho, alto, 'F');

    // Marco exterior (Azul primario #002e45)
    doc.setDrawColor(0, 46, 69);
    doc.setLineWidth(3);
    doc.rect(12, 12, ancho - 24, alto - 24);

    // Marco interior fino (Naranja acento #ff6900)
    doc.setDrawColor(255, 105, 0);
    doc.setLineWidth(1);
    doc.rect(16, 16, ancho - 32, alto - 32);

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(0, 46, 69);
    doc.text('DIPLOMA DE LOGRO ACADÉMICO', ancho / 2, 42, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(38, 71, 99);
    doc.text('El presente reconocimiento se otorga a:', ancho / 2, 58, { align: 'center' });

    // Nombre del estudiante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(0, 46, 69);
    doc.text(nombreEstudiante.toUpperCase(), ancho / 2, 78, { align: 'center' });

    // Línea bajo el nombre
    doc.setDrawColor(255, 105, 0);
    doc.setLineWidth(1.2);
    doc.line((ancho / 2) - 60, 83, (ancho / 2) + 60, 83);

    // Descripción del logro
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(38, 71, 99);

    const textoNivel = NOMBRES_BLOOM[nivel] || `Nivel ${nivel}`;
    const parrafo1 = tipo === 'nivel-quiz'
      ? `Por haber superado con éxito las evaluaciones formativas de ${textoNivel}`
      : 'Por haber completado satisfactoriamente las actividades académicas requeridas';

    doc.text(parrafo1, ancho / 2, 100, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 46, 69);
    doc.text(`Tema: "${tituloTema}"`, ancho / 2, 114, { align: 'center' });

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(78, 99, 117);
    doc.text(`Asignatura: ${nombreAsignatura}`, ancho / 2, 126, { align: 'center' });

    // Sellos y firmas
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(78, 99, 117);

    // Fecha
    doc.text(`Emitido el: ${fechaEmision}`, 45, 168);
    doc.text(`Código de verificación: ${codigo}`, 45, 175);

    // Firma digital simbólica
    doc.line(ancho - 110, 165, ancho - 40, 165);
    doc.setFont('helvetica', 'bold');
    doc.text('Plataforma Educativa Digital', ancho - 75, 172, { align: 'center' });
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.text('Validación Automática de Competencias', ancho - 75, 177, { align: 'center' });

    // Descargar PDF
    const nombreArchivo = `Diploma_${codigo}_${nombreEstudiante.replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);

    ui.aviso('Diploma generado y descargado con éxito', 'exito');
    return { codigo };
  } catch (err) {
    ui.aviso(err.message || 'Error al generar diploma PDF', 'error');
    throw err;
  } finally {
    ui.cargando(false);
  }
}

export default {
  generarDiploma
};
