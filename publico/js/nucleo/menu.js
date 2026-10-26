export const MENU = [
  { texto: 'Inicio', href: '/index.html', roles: ['publico'] },
  { texto: 'Mis asignaturas', href: '/paginas/asignaturas.html', roles: ['estudiante', 'docente'] },
  { texto: 'Cuestionarios / Quiz', href: '/paginas/quiz.html', roles: ['estudiante', 'docente', 'admin'] },
  { texto: 'Noticias', href: '/paginas/noticias.html', roles: ['sesion'] },
  { texto: 'Canciones', href: '/paginas/canciones.html', roles: ['sesion'] },
  { texto: 'Contenidos', href: '/paginas/editor-contenidos.html', roles: ['docente', 'admin'] },
  { texto: 'Gestor de Quizzes / IA', href: '/paginas/banco-preguntas.html', roles: ['docente', 'admin'] },
  { texto: 'Mi perfil', href: '/paginas/perfil.html', roles: ['sesion'] },
  { texto: 'Usuarios', href: '/paginas/admin-usuarios.html', roles: ['admin'] },
  { texto: 'Asignaturas', href: '/paginas/admin-asignaturas.html', roles: ['admin'] },
  { texto: 'Distributivo', href: '/paginas/distributivo.html', roles: ['admin'] },
  { texto: 'Configuración IA', href: '/paginas/admin-ia.html', roles: ['admin'] }
];
