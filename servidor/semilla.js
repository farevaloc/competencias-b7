import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import bcrypt from 'bcryptjs';

async function main() {
  const forzar = process.argv.includes('--forzar');
  const dirSemilla = path.resolve(process.cwd(), 'datos', 'semilla');
  const dirDatos = path.resolve(process.cwd(), 'datos');

  if (forzar) {
    const rl = readline.createInterface({ input, output });
    const respuesta = (await rl.question('Se sobrescribirán las colecciones existentes en datos/. ¿Continuar? (s/n): ')).trim().toLowerCase();
    rl.close();
    if (respuesta !== 's' && respuesta !== 'si') {
      console.log('Operación cancelada.');
      process.exit(0);
    }
  }

  try {
    const archivos = await fs.readdir(dirSemilla);
    const archivosJson = archivos.filter(a => a.endsWith('.json')).sort();

    for (const archivo of archivosJson) {
      const rutaDestino = path.join(dirDatos, archivo);
      const rutaOrigen = path.join(dirSemilla, archivo);

      let yaExiste = false;
      try {
        await fs.access(rutaDestino);
        yaExiste = true;
      } catch {
        yaExiste = false;
      }

      if (yaExiste && !forzar) {
        console.log(`[IGNORADO] ${archivo} ya existe en datos/. (Usa --forzar para reemplazar)`);
        continue;
      }

      const contenido = await fs.readFile(rutaOrigen, 'utf-8');
      const datos = JSON.parse(contenido);

      if (archivo === 'usuarios.json') {
        const claveHash = await bcrypt.hash('Demo12345', 10);
        const usuariosConClave = datos.map(u => ({ ...u, claveHash }));
        await fs.writeFile(rutaDestino, JSON.stringify(usuariosConClave, null, 2), 'utf-8');
      } else {
        await fs.writeFile(rutaDestino, JSON.stringify(datos, null, 2), 'utf-8');
      }

      console.log(`[IMPORTADO] ${archivo} copiado a datos/ exitosamente.`);
    }

    console.log('\nProceso de semilla completado.');
  } catch (err) {
    console.error('Error al ejecutar semilla:', err);
    process.exit(1);
  }
}

main();
