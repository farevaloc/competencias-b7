import { MENU } from './menu.js';
import { usuarioActual, exigirRol, cerrar } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import * as ui from './ui.js';
import * as api from './api.js';

export const NOMBRE = 'Ecosistema Educativo';

export async function montarPlantilla({ titulo, roles = [] } = {}) {
  if (typeof document === 'undefined') return;

  // Verificar si hay avisos pendientes de redirección previa (ej. rol no permitido)
  if (typeof sessionStorage !== 'undefined') {
    const avisoGuardado = sessionStorage.getItem('aviso_pendiente');
    if (avisoGuardado) {
      sessionStorage.removeItem('aviso_pendiente');
      try {
        const { texto, tipo } = JSON.parse(avisoGuardado);
        ui.aviso(texto, tipo || 'advertencia');
      } catch {
        ui.aviso(avisoGuardado, 'advertencia');
      }
    }
  }

  // Validar permisos de rol si se indican
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // Obtener estado del usuario en sesión
  const usuario = usuarioActual();

  // Si hay sesión activa, registrar evento en bitácora sin esperar respuesta
  if (usuario && typeof window !== 'undefined' && window.location) {
    registrarEvento('pagina', window.location.pathname).catch(() => {});
  }

  // Actualizar título de la pestaña del navegador
  document.title = `${titulo} · ${NOMBRE}`;

  const contenedor = document.getElementById('plantilla');
  if (!contenedor) return;

  const rutaActual = typeof window !== 'undefined' && window.location ? window.location.pathname : '';

  // Calcular noticias publicadas sin leer para usuarios con sesión
  let noticiasSinLeer = 0;
  if (usuario) {
    try {
      const [noticias, lecturas] = await Promise.all([
        api.listar('noticias'),
        api.listar('lecturas-noticias')
      ]);
      const lecturasSet = new Set((lecturas || []).map(l => l.noticiaId));
      noticiasSinLeer = (noticias || []).filter(n => n.estado === 'publicado' && !lecturasSet.has(n.id)).length;
    } catch (_) {
      // Ignorar si no hay permisos o no hay noticias
    }
  }

  // Filtrar enlaces de navegación según sesión y rol
  const itemsVisibles = MENU.filter(item => {
    if (!item.roles || item.roles.includes('publico')) return true;
    if (!usuario) return false;
    if (item.roles.includes('sesion')) return true;
    return item.roles.includes(usuario.rol);
  });

  const enlacesMenu = itemsVisibles.map(item => {
    const esActual = rutaActual === item.href || (rutaActual === '/' && item.href === '/index.html');
    let badgeNoticias = '';
    if (item.texto === 'Noticias' && noticiasSinLeer > 0) {
      badgeNoticias = ` <span class="insignia insignia--nuevo" style="margin-left:var(--espaciado-xs); font-size:11px; padding:2px 6px;">${noticiasSinLeer}</span>`;
    }
    return `<a href="${item.href}" class="${esActual ? 'activo' : ''}" ${esActual ? 'aria-current="page"' : ''}>${item.texto}${badgeNoticias}</a>`;
  }).join('');

  // Bloque de usuario / acciones de sesión en el encabezado
  let bloqueAcciones = '';
  if (usuario) {
    const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim() || 'Usuario';
    bloqueAcciones = `
      <div class="encabezado__acciones">
        <a href="/paginas/perfil.html" class="encabezado__usuario" style="display:inline-flex; align-items:center; gap:var(--espaciado-xs); text-decoration:none;">
          <span style="font-weight:var(--peso-seminegrita);">${ui.escapar(nombreCompleto)}</span>
          <span class="insignia" style="text-transform:capitalize;">${ui.escapar(usuario.rol || 'estudiante')}</span>
        </a>
        <button type="button" class="btn btn--texto btn--pequeno" id="btnCerrarSesion" style="color:var(--texto-inverso);">Salir</button>
      </div>
    `;
  } else {
    bloqueAcciones = `
      <div class="encabezado__acciones">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno" style="border: 1px solid var(--superficie);">Registrarse</a>
      </div>
    `;
  }

  // Insertar encabezado y menú lateral
  contenedor.innerHTML = `
    <header class="encabezado">
      <div class="encabezado__marca" style="display:flex; align-items:center; gap:var(--espaciado-s);">
        <button type="button" class="btn btn--secundario btn--pequeno menu-alternar" id="btnAlternarMenu" aria-label="Abrir menú" aria-expanded="false">
          ☰ Menú
        </button>
        <a href="/index.html" class="encabezado__logo" style="text-decoration:none;">${NOMBRE}</a>
        <span class="encabezado__separador" aria-hidden="true" style="opacity:0.6; margin:0 var(--espaciado-xs);">/</span>
        <span class="encabezado__titulo-pagina" style="font-weight:var(--peso-medio);">${ui.escapar(titulo)}</span>
      </div>
      ${bloqueAcciones}
    </header>
    <nav class="menu" id="menuLateral" aria-label="Menú principal">
      <div class="menu__titulo">Navegación</div>
      ${enlacesMenu}
    </nav>
  `;

  // Comportamiento del botón Salir
  const btnCerrar = contenedor.querySelector('#btnCerrarSesion');
  if (btnCerrar) {
    btnCerrar.addEventListener('click', async () => {
      await cerrar();
    });
  }

  // Comportamiento del botón de menú en celular
  const btnAlternar = contenedor.querySelector('#btnAlternarMenu');
  const menuLateral = contenedor.querySelector('#menuLateral');

  if (btnAlternar && menuLateral) {
    btnAlternar.addEventListener('click', (e) => {
      e.stopPropagation();
      const abierto = menuLateral.classList.toggle('abierto');
      btnAlternar.setAttribute('aria-expanded', String(abierto));
    });

    document.addEventListener('click', (e) => {
      if (menuLateral.classList.contains('abierto') && !menuLateral.contains(e.target) && e.target !== btnAlternar) {
        menuLateral.classList.remove('abierto');
        btnAlternar.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Agregar pie con el año al final del body si no existe
  if (!document.querySelector('footer.pie')) {
    const pie = document.createElement('footer');
    pie.className = 'pie';
    const anio = new Date().getFullYear();
    pie.innerHTML = `
      <div class="contenedor">
        <p>&copy; ${anio} ${NOMBRE}. Todos los derechos reservados.</p>
      </div>
    `;
    document.body.appendChild(pie);
  }
}
