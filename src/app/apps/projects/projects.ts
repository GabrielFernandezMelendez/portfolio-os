import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';

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
  selector:    'app-projects',
  standalone:  true,
  templateUrl: './projects.html',
  styleUrl:    './projects.css'
})
export class ProjectsComponent {

  i18n = inject(I18nService);

  readonly STATIC: Omit<Project, 'name' | 'description'>[] = [
    { id: 'movie-app',       icon: '🎬', stack: ['Angular 21', 'TMDB API', 'TailwindCSS', 'Firebase'],           github: 'https://github.com/GabrielFernandezMelendez/movie-app',                                    live: 'https://gabrielfernandezmelendez.github.io/movie-app/',      status: 'done', type: 'frontend' },
    { id: 'kamakura',        icon: '🍱', stack: ['JavaScript ES6', 'CSS3', 'HTML5', 'Vitest'],                    github: 'https://github.com/GabrielFernandezMelendez/js-kamakura-food',                             live: 'https://gabrielfernandezmelendez.github.io/js-kamakura-food/', status: 'done', type: 'frontend' },
    { id: 'spotify',         icon: '🎵', stack: ['HTML5', 'CSS3', 'JavaScript'],                                   github: 'https://github.com/GabrielFernandezMelendez/clon-spotify',                                 live: 'https://gabrielfernandezmelendez.github.io/clon-spotify/',    status: 'done', type: 'frontend' },
    { id: 'portfolio',       icon: '🖥',  stack: ['Angular 21', 'Canvas API', 'TailwindCSS', 'Game of Life'],      github: 'https://github.com/GabrielFernandezMelendez/portfolio-os',                                 live: 'https://portfolioos-4128f.web.app',                           status: 'wip',  type: 'frontend' },
    { id: 'peregrinos',      icon: '☕', stack: ['Java', 'Spring Boot', 'JavaFX', 'DB4O', 'ObjectDB', 'Maven'],   github: 'https://github.com/GabrielFernandezMelendez/Aplicaci-n-Springboot-java-peregrinos',         live: null,                                                          status: 'done', type: 'backend'  },
    { id: 'trackyourmoney',  icon: '💰', stack: ['Kotlin', 'Android', 'Gradle', 'Room DB'],                       github: 'https://github.com/GabrielFernandezMelendez/TrackYourMoney',                               live: null,                                                          status: 'done', type: 'backend'  },
    { id: 'jdbc',            icon: '🗄',  stack: ['Java', 'JDBC', 'SQL Server', 'Maven'],                          github: 'https://github.com/GabrielFernandezMelendez/Aplicacion-JDBC-BD',                           live: null,                                                          status: 'done', type: 'backend'  },
    { id: 'imc',             icon: '🪟', stack: ['Java', 'JavaFX'],                                                github: 'https://github.com/GabrielFernandezMelendez/Ventana-calculo-de-IMC-con-javafx',            live: null,                                                          status: 'done', type: 'backend'  },
  ];

  get projects(): Project[] {
    const items = this.i18n.tArray<any>('projects.items');
    return this.STATIC.map((s, i) => ({
      ...s,
      name:        items[i]?.name        ?? s.id,
      description: items[i]?.description ?? ''
    }));
  }

  get frontendProjects() { return this.projects.filter(p => p.type === 'frontend'); }
  get backendProjects()  { return this.projects.filter(p => p.type === 'backend');  }

  openLink(url: string) { window.open(url, '_blank'); }
}