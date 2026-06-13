import { Component, OnInit, input, inject, computed } from '@angular/core';
import { I18nService } from '../../../../i18n/i18n.service';

interface EducationEntry {
  icon:     string;
  title:    string;
  subtitle: string;
  center:   string;
  period:   string;
  current:  boolean;
}

interface Certificate {
  icon:  string;
  title: string;
  hours: string;
  date:  string;
  url:   string;
  pdf:   string;
}

interface Language {
  flag:     string;
  nameKey:  string;
  levelKey: string;
  color:    string;
  current:  number;
}

@Component({
  selector:    'app-education-mobile',
  standalone:  true,
  templateUrl: './education-mobile.html',
  styleUrl:    './education-mobile.css',
})
export class EducationMobileComponent implements OnInit {

  isDark = input<boolean>(true);
  i18n   = inject(I18nService);
  lang   = computed(() => this.i18n.currentLang());

  readonly ICONS_EDUCATION = ['🟢', '🎓', '🎓'];
  readonly CURRENT         = [true, false, false];
  readonly CERT_ICONS      = ['🧪', '☕', '🌱'];
  readonly CERT_URLS       = [
    'https://openwebinars.net/cert/GzRy',
    'https://openwebinars.net/cert/NgXp',
    'https://openwebinars.net/cert/VYn3'
  ];
  readonly CERT_PDFS = [
    'cert-testing-intro.pdf',
    'cert-junit5.pdf',
    'cert-spring-persistence.pdf'
  ];

  languages: Language[] = [
    { flag: '🇬🇧', nameKey: 'about.lang_english', levelKey: 'about.lang_english_level', color: '#6366f1', current: 0 },
    { flag: '🇪🇸', nameKey: 'about.lang_spanish', levelKey: 'about.lang_spanish_level', color: '#10b981', current: 0 },
  ];

  get education(): EducationEntry[] {
    return this.i18n.tArray<any>('education.entries').map((e: any, i: number) => ({
      ...e,
      icon:    this.ICONS_EDUCATION[i],
      current: this.CURRENT[i]
    }));
  }

  get certificates(): Certificate[] {
    return this.i18n.tArray<any>('education.certificates').map((c: any, i: number) => ({
      ...c,
      icon: this.CERT_ICONS[i],
      url:  this.CERT_URLS[i],
      pdf:  this.CERT_PDFS[i]
    }));
  }

  ngOnInit() {
    setTimeout(() => {
      for (const lang of this.languages) lang.current = 100;
    }, 400);
  }

  openLink(url: string) { window.open(url, '_blank'); }
  openPdf(pdf: string)  { window.open(pdf, '_blank'); }
}