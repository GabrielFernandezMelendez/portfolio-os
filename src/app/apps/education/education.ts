import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';

interface EducationEntry {
  icon:     string;
  title:    string;
  subtitle: string;
  center:   string;
  period:   string;
  current:  boolean;
}

interface Certificate {
  icon:     string;
  title:    string;
  hours:    string;
  date:     string;
  url:      string;
  pdf:      string;
}

interface Language {
  flag:    string;
  name:    string;
  level:   string;
  color:   string;
  current: number;
}

@Component({
  selector:    'app-education',
  standalone:  true,
  templateUrl: './education.html',
  styleUrl:    './education.css'
})
export class EducationComponent implements OnInit {

  private cdr = inject(ChangeDetectorRef);
  private hasAnimated = false;

  education: EducationEntry[] = [
    {
      icon:     '🟢',
      title:    'Certificado de Profesionalidad',
      subtitle: 'Confección y Publicación de Páginas Web',
      center:   'Factoría F5',
      period:   '2026 · Actualidad',
      current:  true
    },
    {
      icon:     '🎓',
      title:    'Técnico Superior en DAM',
      subtitle: 'Desarrollo de Aplicaciones Multiplataforma',
      center:   'CIPF La Laboral',
      period:   '2021 – 2025',
      current:  false
    },
    {
      icon:     '🎓',
      title:    'Grado en Comercio y Marketing',
      subtitle: 'Facultad de Comercio, Turismo y Ciencias Sociales',
      center:   'Universidad de Oviedo',
      period:   '2017 – 2021',
      current:  false
    }
  ];

  certificates: Certificate[] = [
    {
      icon:  '🧪',
      title: 'Introducción al Testing',
      hours: '6 horas',
      date:  'Mar 2025',
      url:   'https://openwebinars.net/cert/GzRy',
      pdf:   'cert-testing-intro.pdf'
    },
    {
      icon:  '☕',
      title: 'Testing en Java con JUnit 5',
      hours: '5 horas',
      date:  'Mar 2025',
      url:   'https://openwebinars.net/cert/NgXp',
      pdf:   'cert-junit5.pdf'
    },
    {
      icon:  '🌱',
      title: 'Persistencia con Spring Boot',
      hours: '1 hora',
      date:  'Mar 2025',
      url:   'https://openwebinars.net/cert/VYn3',
      pdf:   'cert-spring-persistence.pdf'
    }
  ];

  languages: Language[] = [
    { flag: '🇬🇧', name: 'Inglés',   level: 'Nativo · C2', color: '#6366f1', current: 0 },
    { flag: '🇪🇸', name: 'Español',  level: 'Nativo · C2', color: '#10b981', current: 0 },
  ];

  ngOnInit() {
    setTimeout(() => {
      this.animateLanguages();
      this.hasAnimated = true;
    }, 300);
  }

  animateLanguages() {
    for (const lang of this.languages) {
      lang.current = 100;
    }
    this.cdr.detectChanges();
  }

  onMouseEnter() {
    if (this.hasAnimated) return;
    this.hasAnimated = true;
    for (const lang of this.languages) lang.current = 0;
    this.cdr.detectChanges();
    setTimeout(() => this.animateLanguages(), 50);
  }

  openLink(url: string) {
    window.open(url, '_blank');
  }

  openPdf(pdf: string) {
    window.open(pdf, '_blank');
  }
}