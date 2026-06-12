import { Component, input } from '@angular/core';

interface Project {
  id:          string;
  icon:        string;
  name:        string;
  description: string;
  stack:       string[];
  github:      string;
  live:        string | null;
  status:      'done' | 'wip';
  type:        'frontend' | 'backend';
}

@Component({
  selector:    'app-projects-mobile',
  standalone:  true,
  templateUrl: './projects-mobile.html',
  styleUrl:    './projects-mobile.css',
})
export class ProjectsMobileComponent {

  isDark = input<boolean>(true);

  projects: Project[] = [
    {
      id: 'movie-app', icon: '🎬',
      name: 'Movie App',
      description: 'Catálogo de películas con datos en tiempo real desde la API de TMDB, rutas dinámicas y despliegue en Firebase.',
      stack: ['Angular 21', 'TMDB API', 'TailwindCSS', 'Firebase'],
      github: 'https://github.com/GabrielFernandezMelendez/movie-app',
      live:   'https://gabrielfernandezmelendez.github.io/movie-app/',
      status: 'done', type: 'frontend'
    },
    {
      id: 'kamakura', icon: '🍱',
      name: 'Kamakura Food',
      description: 'Menú interactivo de restaurante japonés con carrito de compras, filtros por categoría y tests unitarios.',
      stack: ['JavaScript ES6', 'CSS3', 'HTML5', 'Vitest'],
      github: 'https://github.com/GabrielFernandezMelendez/js-kamakura-food',
      live:   'https://gabrielfernandezmelendez.github.io/js-kamakura-food/',
      status: 'done', type: 'frontend'
    },
    {
      id: 'spotify', icon: '🎵',
      name: 'Clon Spotify',
      description: 'Réplica fiel de la landing page de Spotify con diseño responsive y atención al detalle visual.',
      stack: ['HTML5', 'CSS3', 'JavaScript'],
      github: 'https://github.com/GabrielFernandezMelendez/clon-spotify',
      live:   'https://gabrielfernandezmelendez.github.io/clon-spotify/',
      status: 'done', type: 'frontend'
    },
    {
      id: 'portfolio', icon: '🖥',
      name: 'Portfolio OS',
      description: 'Este mismo portfolio simulando un sistema operativo con Game of Life interactivo como fondo.',
      stack: ['Angular 21', 'Canvas API', 'TailwindCSS', 'Game of Life'],
      github: 'https://github.com/GabrielFernandezMelendez/portfolio-os',
      live:   'https://portfolioos-4128f.web.app',
      status: 'wip', type: 'frontend'
    },
    {
      id: 'peregrinos', icon: '☕',
      name: 'Spring Boot Peregrinos',
      description: 'App completa con Spring Boot, JavaFX, base de datos objeto-relacional DB4O y ObjectDB diseñada a medida.',
      stack: ['Java', 'Spring Boot', 'JavaFX', 'DB4O', 'ObjectDB', 'Maven'],
      github: 'https://github.com/GabrielFernandezMelendez/Aplicaci-n-Springboot-java-peregrinos',
      live: null, status: 'done', type: 'backend'
    },
    {
      id: 'trackyourmoney', icon: '💰',
      name: 'TrackYourMoney',
      description: 'App Android de gestión financiera (TFC). Gastos, ingresos, categorías personalizadas y consejos. 26 commits.',
      stack: ['Kotlin', 'Android', 'Gradle', 'Room DB'],
      github: 'https://github.com/GabrielFernandezMelendez/TrackYourMoney',
      live: null, status: 'done', type: 'backend'
    },
    {
      id: 'jdbc', icon: '🗄',
      name: 'Aplicación JDBC BD',
      description: 'Aplicación de gestión con conexión directa a base de datos SQL mediante JDBC puro sin ORM.',
      stack: ['Java', 'JDBC', 'SQL Server', 'Maven'],
      github: 'https://github.com/GabrielFernandezMelendez/Aplicacion-JDBC-BD',
      live: null, status: 'done', type: 'backend'
    },
    {
      id: 'imc', icon: '🪟',
      name: 'IMC Calculator',
      description: 'Ventana de escritorio con JavaFX para calcular el índice de masa corporal con interfaz gráfica.',
      stack: ['Java', 'JavaFX'],
      github: 'https://github.com/GabrielFernandezMelendez/Ventana-calculo-de-IMC-con-javafx',
      live: null, status: 'done', type: 'backend'
    },
  ];

  get frontendProjects() { return this.projects.filter(p => p.type === 'frontend'); }
  get backendProjects()  { return this.projects.filter(p => p.type === 'backend');  }

  openLink(url: string) { window.open(url, '_blank'); }
}