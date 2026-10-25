export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function limpiar(html) {
  if (html === null || html === undefined) return '';
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(String(html));
  }
  return escapar(html);
}

function obtenerContenedorAvisos() {
  if (typeof document === 'undefined') return null;
  let contenedor = document.getElementById('contenedor-avisos');
  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'contenedor-avisos';
    contenedor.className = 'contenedor-avisos';
    contenedor.setAttribute('aria-live', 'polite');
    contenedor.setAttribute('aria-atomic', 'true');
    document.body.appendChild(contenedor);
  }
  return contenedor;
}

export function aviso(texto, tipo = 'info') {
  const contenedor = obtenerContenedorAvisos();
  if (!contenedor) return;

  const elemento = document.createElement('div');
  elemento.className = `aviso aviso-${tipo}`;
  elemento.setAttribute('role', 'status');
  elemento.textContent = texto;

  contenedor.appendChild(elemento);

  setTimeout(() => {
    elemento.remove();
    if (contenedor.children.length === 0) {
      contenedor.remove();
    }
  }, 4000);
}

export function cargando(mostrar) {
  if (typeof document === 'undefined') return;
  let indicador = document.querySelector('.cargando');
  if (mostrar) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-live', 'assertive');
      indicador.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(indicador);
    }
    indicador.hidden = false;
  } else {
    if (indicador) {
      indicador.hidden = true;
      indicador.remove();
    }
  }
}

let modalIdContador = 0;

export function modal({ titulo, contenido, acciones = [] }) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      return resolve(null);
    }

    modalIdContador += 1;
    const idTitulo = `modal-titulo-${modalIdContador}`;
    const elementoPrevio = document.activeElement;

    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.setAttribute('aria-labelledby', idTitulo);
    dialogo.setAttribute('tabindex', '-1');

    const cabecera = document.createElement('div');
    cabecera.className = 'modal-cabecera';
    const tituloEl = document.createElement('h2');
    tituloEl.id = idTitulo;
    tituloEl.className = 'modal-titulo';
    tituloEl.textContent = titulo || '';
    cabecera.appendChild(tituloEl);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (typeof contenido === 'string') {
      cuerpo.textContent = contenido;
    } else if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    }

    const pie = document.createElement('div');
    pie.className = 'modal-pie';

    const listaAcciones = Array.isArray(acciones) && acciones.length > 0
      ? acciones
      : [{ texto: 'Cerrar', valor: null, clase: 'btn-secundario' }];

    const botones = [];
    let botonPrincipal = null;

    listaAcciones.forEach(acc => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = `btn ${acc.clase || ''}`.trim();
      boton.textContent = acc.texto;
      boton.addEventListener('click', () => cerrar(acc.valor !== undefined ? acc.valor : null));
      pie.appendChild(boton);
      botones.push(boton);
      if (acc.principal) {
        botonPrincipal = boton;
      }
    });

    dialogo.appendChild(cabecera);
    dialogo.appendChild(cuerpo);
    dialogo.appendChild(pie);
    fondo.appendChild(dialogo);
    document.body.appendChild(fondo);

    function cerrar(resultado) {
      document.removeEventListener('keydown', manejarTeclado);
      fondo.remove();
      if (elementoPrevio && typeof elementoPrevio.focus === 'function') {
        elementoPrevio.focus();
      }
      resolve(resultado);
    }

    fondo.addEventListener('click', (e) => {
      if (e.target === fondo) {
        cerrar(null);
      }
    });

    const selectorFoco = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function manejarTeclado(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(null);
        return;
      }

      if (e.key === 'Tab') {
        const elementosFocables = Array.from(dialogo.querySelectorAll(selectorFoco));
        if (elementosFocables.length === 0) {
          e.preventDefault();
          return;
        }

        const primerFocable = elementosFocables[0];
        const ultimoFocable = elementosFocables[elementosFocables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primerFocable || document.activeElement === dialogo) {
            e.preventDefault();
            ultimoFocable.focus();
          }
        } else {
          if (document.activeElement === ultimoFocable) {
            e.preventDefault();
            primerFocable.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', manejarTeclado);

    const focablesIniciales = Array.from(dialogo.querySelectorAll(selectorFoco));
    if (botonPrincipal) {
      botonPrincipal.focus();
    } else if (focablesIniciales.length > 0) {
      focablesIniciales[0].focus();
    } else {
      dialogo.focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmar acción',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario', principal: true }
    ]
  });
  return Boolean(resultado);
}
