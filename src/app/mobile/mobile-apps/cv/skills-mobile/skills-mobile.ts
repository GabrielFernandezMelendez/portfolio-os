import { Component, OnInit, input, inject, computed } from '@angular/core';
import { I18nService } from '../../../../i18n/i18n.service';

interface Skill {
  name:    string;
  level:   number;
  current: number;
}

interface SkillCategory {
  titleKey: string;
  color:    string;
  skills:   Skill[];
}

@Component({
  selector:    'app-skills-mobile',
  standalone:  true,
  templateUrl: './skills-mobile.html',
  styleUrl:    './skills-mobile.css',
})
export class SkillsMobileComponent implements OnInit {

  isDark = input<boolean>(true);
  i18n   = inject(I18nService);
  lang   = computed(() => this.i18n.currentLang());

  categories: SkillCategory[] = [
    {
      titleKey: 'skills.categories.frontend', color: '#6366f1',
      skills: [
        { name: 'JavaScript ES6+',  level: 90, current: 0 },
        { name: 'TypeScript',       level: 85, current: 0 },
        { name: 'Angular 21',       level: 88, current: 0 },
        { name: 'React',            level: 75, current: 0 },
        { name: 'HTML5 / CSS3',     level: 95, current: 0 },
        { name: 'TailwindCSS',      level: 85, current: 0 },
        { name: 'Diseño Responsive',level: 88, current: 0 },
        { name: 'Node.js',          level: 75, current: 0 },
        { name: 'Astro',            level: 70, current: 0 },
      ]
    },
    {
      titleKey: 'skills.categories.backend', color: '#8b5cf6',
      skills: [
        { name: '.NET Core / C#',   level: 88, current: 0 },
        { name: 'Java (LTS)',       level: 82, current: 0 },
        { name: 'Spring Framework', level: 78, current: 0 },
        { name: 'Python',           level: 72, current: 0 },
        { name: 'PHP',              level: 70, current: 0 },
        { name: 'C / C++',         level: 75, current: 0 },
        { name: 'PL/SQL',           level: 72, current: 0 },
      ]
    },
    {
      titleKey: 'skills.categories.databases', color: '#06b6d4',
      skills: [
        { name: 'SQL Server', level: 85, current: 0 },
        { name: 'MySQL',      level: 82, current: 0 },
        { name: 'MongoDB',    level: 75, current: 0 },
        { name: 'ObjectDB',   level: 70, current: 0 },
      ]
    },
    {
      titleKey: 'skills.categories.testing', color: '#ec4899',
      skills: [
        { name: 'JUnit (Java)',   level: 78, current: 0 },
        { name: 'NUnit / xUnit', level: 80, current: 0 },
        { name: 'Vitest',        level: 75, current: 0 },
      ]
    },
    {
      titleKey: 'skills.categories.tools', color: '#10b981',
      skills: [
        { name: 'Git / GitHub',  level: 95, current: 0 },
        { name: 'Scrum / Agile', level: 85, current: 0 },
        { name: 'Firebase',      level: 95, current: 0 },
        { name: 'Docker',        level: 72, current: 0 },
        { name: 'UML',           level: 95, current: 0 },
      ]
    },
    {
      titleKey: 'skills.categories.integration', color: '#f59e0b',
      skills: [
        { name: 'APIs REST',    level: 88, current: 0 },
        { name: 'JSON',         level: 90, current: 0 },
        { name: 'Firebase SDK', level: 82, current: 0 },
      ]
    }
  ];

  ngOnInit() {
    setTimeout(() => this.fillBars(), 400);
  }

  fillBars() {
    for (const cat of this.categories) {
      for (const skill of cat.skills) {
        skill.current = skill.level;
      }
    }
  }
}