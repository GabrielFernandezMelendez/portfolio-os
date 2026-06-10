import { Component } from '@angular/core';

interface ExperienceEntry {
  company: string;
  role: string;
  period: string;
  duration: string;
  location: string;
  current: boolean;
  tasks: string[];
  badges: string[];
}

@Component({
  selector: 'app-experience',
  standalone: true,
  templateUrl: './experience.html',
  styleUrl: './experience.css',
})
export class ExperienceComponent {
  entries: ExperienceEntry[] = [
    {
      company: 'Jakala / Factoría F5',
      role: 'Desarrollador Frontend — Prácticas',
      period: 'Mayo 2026 – Actualidad',
      duration: '1 mes',
      location: 'Gijón, España',
      current: true,
      tasks: [
        'Desarrollo de interfaces web modernas con Astro y JavaScript',
        'Implementación de estilos con TailwindCSS y diseño responsive',
        'Testing con Vitest en entorno de desarrollo ágil',
        'Colaboración en equipo bajo metodologías ágiles',
      ],
      badges: ['Astro', 'JavaScript', 'TailwindCSS', 'Vitest', 'HTML5', 'CSS3', 'Git'],
    },
    {
      company: 'Mecalux',
      role: 'Desarrollador Junior',
      period: 'Febrero 2025 – Noviembre 2025',
      duration: '10 meses',
      location: 'España',
      current: false,
      tasks: [
        'Desarrollo y mantenimiento de módulos críticos para WMS con .NET y C#',
        'Optimización de calidad del código, pruebas automatizadas y mejora continua',
        'Colaboración en equipos técnicos bajo metodologías ágiles y revisiones de código',
      ],
      badges: ['.NET Core', 'C#', 'WMS', 'Scrum', 'Git', 'Pruebas unitarias'],
    },
    {
      company: 'Revolution Land',
      role: 'Webmaster & Community Manager',
      period: '2015 – 2016',
      duration: '1 año',
      location: 'Venezuela',
      current: false,
      tasks: [
        'Diseño, actualización y mantenimiento integral del portal web de la comunidad',
        'Gestión de contenidos en redes sociales y optimización de la presencia digital',
      ],
      badges: ['HTML', 'CSS', 'WordPress', 'Community Management', 'SEO'],
    },
  ];
}
