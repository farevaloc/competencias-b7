export async function llamar(metodo, ruta, cuerpo) {
  const url = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const headers = {};

  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = undefined;
  if (typeof FormData !== 'undefined' && cuerpo instanceof FormData) {
    body = cuerpo;
  } else if (cuerpo !== undefined && cuerpo !== null) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo);
  }

  const res = await fetch(url, {
    method: metodo.toUpperCase(),
    headers,
    body
  });

  const texto = await res.text();
  let data = null;
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }

  if (res.status === 401) {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('usuario');
    }
    const rutaActual = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
    const enAuth = rutaActual.endsWith('ingreso.html') || rutaActual.endsWith('registro.html');
    if (!enAuth && typeof window !== 'undefined' && window.location) {
      window.location.href = '/paginas/ingreso.html';
    }
    const mensaje = (data && typeof data === 'object' && data.error) ? data.error : 'Sesión no válida o expirada';
    throw new Error(mensaje);
  }

  if (!res.ok) {
    const mensaje = (data && typeof data === 'object' && data.error) ? data.error : `Error en la solicitud: ${res.status} ${res.statusText}`;
    throw new Error(mensaje);
  }

  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(data.error);
  }

  return data;
}

export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  if (filtros && typeof filtros === 'object') {
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor !== undefined && valor !== null) {
        params.append(clave, valor);
      }
    }
  }
  const query = params.toString();
  const ruta = `/api/${col}${query ? `?${query}` : ''}`;
  return llamar('GET', ruta);
}

export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const formData = new FormData();
  formData.append('archivo', archivo);
  return llamar('POST', '/api/subidas', formData);
}

export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${encodeURIComponent(tarea)}`, datos);
}
