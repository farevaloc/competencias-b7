export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return lista;
  return lista.map(item => {
    if (!item) return item;
    const { claveHash, ...resto } = item;
    return resto;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const resultado = { ...datos };

  // Ignorar claveHash
  if (anterior) {
    resultado.claveHash = anterior.claveHash;
  } else {
    delete resultado.claveHash;
  }

  // Ignorar correo en actualizaciones
  if (anterior && anterior.correo) {
    resultado.correo = anterior.correo;
  }

  // Evitar que un admin se quite el rol o se desactive a sí mismo
  if (anterior && usuario && anterior.id === usuario.id && anterior.rol === 'admin') {
    if (resultado.rol && resultado.rol !== 'admin') {
      const err = new Error('No puedes quitarte el rol de administrador a ti mismo');
      err.estado = 400;
      throw err;
    }
    if (resultado.activo === false) {
      const err = new Error('No puedes desactivar tu propia cuenta de administrador');
      err.estado = 400;
      throw err;
    }
  }

  return resultado;
}

export default {
  filtrarLista,
  antesDeGuardar
};
