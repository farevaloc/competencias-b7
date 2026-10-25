import { escapar } from './ui.js';

export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  const recortado = String(texto).trim().toUpperCase();
  return recortado
    .replace(/Ñ/g, '___ENE___')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/___ENE___/g, 'Ñ');
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  const tieneHora = typeof iso === 'string' && (iso.includes('T') || iso.includes(':'));
  const opciones = tieneHora
    ? { dateStyle: 'long', timeStyle: 'short' }
    : { dateStyle: 'long' };
  return new Intl.DateTimeFormat('es-EC', opciones).format(fecha);
}

export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';

  const diffMs = fecha.getTime() - Date.now();
  const diffSeg = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });

  const absSeg = Math.abs(diffSeg);
  if (absSeg < 60) {
    return rtf.format(diffSeg, 'second');
  }

  const diffMin = Math.round(diffSeg / 60);
  const absMin = Math.abs(diffMin);
  if (absMin < 60) {
    return rtf.format(diffMin, 'minute');
  }

  const diffHoras = Math.round(diffMin / 60);
  const absHoras = Math.abs(diffHoras);
  if (absHoras < 24) {
    return rtf.format(diffHoras, 'hour');
  }

  const diffDias = Math.round(diffHoras / 24);
  const absDias = Math.abs(diffDias);
  if (absDias < 30) {
    return rtf.format(diffDias, 'day');
  }

  const diffMeses = Math.round(diffDias / 30);
  const absMeses = Math.abs(diffMeses);
  if (absMeses < 12) {
    return rtf.format(diffMeses, 'month');
  }

  const diffAnios = Math.round(diffDias / 365);
  return rtf.format(diffAnios, 'year');
}

export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

export function formatoBasico(texto) {
  if (texto === null || texto === undefined) return '';
  let escapado = escapar(texto);
  escapado = escapado.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const bloques = escapado.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  return bloques.map(bloque => {
    const lineas = bloque.split('\n');
    const todasLista = lineas.every(l => l.trim().startsWith('- '));
    if (todasLista) {
      const items = lineas.map(l => `<li>${l.trim().slice(2).trim()}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    let html = '';
    let lineasTexto = [];
    let itemsLista = [];

    function vaciarTexto() {
      if (lineasTexto.length > 0) {
        html += `<p>${lineasTexto.join('<br>')}</p>`;
        lineasTexto = [];
      }
    }

    function vaciarLista() {
      if (itemsLista.length > 0) {
        html += `<ul>${itemsLista.map(it => `<li>${it}</li>`).join('')}</ul>`;
        itemsLista = [];
      }
    }

    for (const linea of lineas) {
      const recortada = linea.trim();
      if (recortada.startsWith('- ')) {
        vaciarTexto();
        itemsLista.push(recortada.slice(2).trim());
      } else {
        vaciarLista();
        lineasTexto.push(recortada);
      }
    }
    vaciarTexto();
    vaciarLista();
    return html;
  }).join('');
}
