import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n/i18n.service';

interface ExperienceEntry {
  company:  string;
  role:     string;
  period:   string;
  duration: string;
  location: string;
  current:  boolean;
  tasks:    string[];
  badges:   string[];
}

@Component({
  selector:    'app-experience',
  standalone:  true,
  templateUrl: './experience.html',
  styleUrl:    './experience.css',
})
export class ExperienceComponent {

  i18n = inject(I18nService);

  readonly BADGES: Record<string, string[]> = {
    'Jakala / Factoría F5': ['Astro', 'JavaScript', 'TailwindCSS', 'Vitest', 'HTML5', 'CSS3', 'Git'],
    'Mecalux':              ['.NET Core', 'C#', 'WMS', 'Scrum', 'Git', 'Pruebas unitarias'],
    'Revolution Land':      ['HTML', 'CSS', 'WordPress', 'Community Management', 'SEO'],
  };

  readonly CURRENT = [true, false, false];

  get entries(): ExperienceEntry[] {
    return this.i18n.tArray<any>('experience.entries').map((e: any, i: number) => ({
      ...e,
      current: this.CURRENT[i],
      badges:  this.BADGES[e.company] ?? []
    }));
  }
}