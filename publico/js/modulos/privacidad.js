import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: 'Aviso de privacidad', roles: ['publico'] });

const contenedor = document.getElementById('contenido');
if (contenedor) {
  contenedor.innerHTML = `
    <article class="privacidad-contenido">
      <div class="privacidad-tarjeta">
        <header>
          <h1 style="font-size: var(--tamano-2xl); color: var(--primario); margin-bottom: var(--espaciado-xs);">Aviso de Privacidad y Protección de Datos</h1>
          <p style="color: var(--texto-suave); font-size: var(--tamano-s);">Conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador.</p>
        </header>

        <section class="privacidad-seccion">
          <h2>1. Finalidad del tratamiento</h2>
          <p>
            El <strong>Ecosistema Educativo Digital</strong> recopila y procesa datos personales exclusivamente para gestionar el acceso a la plataforma educativa, permitir la interacción con contenidos académicos y actividades gamificadas, llevar el seguimiento del progreso pedagógico y emitir reconocimientos académicos.
          </p>
        </section>

        <section class="privacidad-seccion">
          <h2>2. Datos personales tratados</h2>
          <p>Los datos que recopilamos para el funcionamiento de los servicios son:</p>
          <ul>
            <li><strong>Identificación:</strong> Nombre y apellido.</li>
            <li><strong>Contacto y acceso:</strong> Dirección de correo electrónico y credenciales seguras.</li>
            <li><strong>Actividad académica:</strong> Registro de navegación en la plataforma, intentos en actividades, puntajes y progreso en el plan curricular.</li>
          </ul>
        </section>

        <section class="privacidad-seccion">
          <h2>3. Derechos de los titulares (LOPDP)</h2>
          <p>
            De conformidad con la LOPDP del Ecuador, usted o sus representantes legales tienen derecho a:
          </p>
          <ul>
            <li><strong>Acceso:</strong> Conocer qué datos personales mantenemos registrados y cómo se procesan.</li>
            <li><strong>Rectificación:</strong> Actualizar o corregir información inexacta o incompleta.</li>
            <li><strong>Eliminación:</strong> Solicitar la supresión de sus datos personales cuando ya no sean requeridos para los fines educativos informados.</li>
            <li><strong>Oposición:</strong> Oponerse al tratamiento de datos en los casos permitidos por la ley.</li>
          </ul>
        </section>

        <section class="privacidad-seccion">
          <h2>4. Contacto del responsable</h2>
          <p>
            Para ejercer cualquiera de sus derechos o formular consultas relativas al tratamiento de su información, puede comunicarse al canal oficial de privacidad:
          </p>
          <p style="margin-top: var(--espaciado-s);">
            <strong>Correo de contacto:</strong>
            <a href="mailto:contacto@ecosistemaeducativo.ec" class="enlace">contacto@ecosistemaeducativo.ec</a>
          </p>
        </section>

        <footer style="margin-top: var(--espaciado-xl); padding-top: var(--espaciado-m); border-top: 1px solid var(--borde); display: flex; gap: var(--espaciado-m); flex-wrap: wrap;">
          <a href="/paginas/registro.html" class="btn btn--primario">Ir al registro</a>
          <a href="/paginas/ingreso.html" class="btn btn--secundario">Ir al ingreso</a>
        </footer>
      </div>
    </article>
  `;
}
