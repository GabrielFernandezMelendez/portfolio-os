import { Component, input, inject, computed } from '@angular/core';
import { I18nService } from '../../../../i18n/i18n.service';

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
  selector:    'app-experience-mobile',
  standalone:  true,
  templateUrl: './experience-mobile.html',
  styleUrl:    './experience-mobile.css',
})
export class ExperienceMobileComponent {

  isDark = input<boolean>(true);
  i18n   = inject(I18nService);
  lang   = computed(() => this.i18n.currentLang());

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