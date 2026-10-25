import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== Crear Usuario Administrador ===\n');

    const nombre = (await rl.question('Nombre: ')).trim();
    if (!nombre) throw new Error('El nombre es obligatorio');

    const apellido = (await rl.question('Apellido: ')).trim();
    if (!apellido) throw new Error('El apellido es obligatorio');

    const correo = (await rl.question('Correo: ')).trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !regexCorreo.test(correo)) {
      throw new Error('Correo electrónico no válido');
    }

    const clave = (await rl.question('Contraseña: ')).trim();
    if (!clave || clave.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }

    const usuarios = await almacen.leer('usuarios');
    const yaExiste = usuarios.find(u => u.correo && u.correo.toLowerCase() === correo);
    if (yaExiste) {
      throw new Error(`El correo "${correo}" ya está registrado`);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const nuevo = await almacen.agregar('usuarios', {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'admin',
      activo: true,
      foto: '',
      consentimiento: {
        aceptado: true,
        fecha: new Date().toISOString()
      }
    });

    console.log(`\n✓ Administrador creado exitosamente con ID: ${nuevo.id}`);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

main();
