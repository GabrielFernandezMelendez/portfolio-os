import { Component, input, signal, effect, ElementRef, inject } from '@angular/core';
import { AboutMobileComponent }      from '../mobile-apps/cv/about-mobile/about-mobile';
import { ExperienceMobileComponent } from '../mobile-apps/cv/experience-mobile/experience-mobile';
import { SkillsMobileComponent }     from '../mobile-apps/cv/skills-mobile/skills-mobile';
import { EducationMobileComponent }  from '../mobile-apps/cv/education-mobile/education-mobile';
import { ProjectsMobileComponent }   from '../mobile-apps/cv/projects-mobile/projects-mobile';
import { ContactMobileComponent }    from '../mobile-apps/cv/contact-mobile/contact-mobile';
import { GithubMobileComponent }     from '../mobile-apps/cv/github-mobile/github-mobile';
import { SettingsMobileComponent }   from '../mobile-apps/settings/settings-mobile/settings-mobile';
import { RacingComponent } from '..//../games/racetime/racing/racing';
@Component({
  selector:    'app-mobile-app-view',
  standalone:  true,
  imports: [
    AboutMobileComponent,
    ExperienceMobileComponent,
    SkillsMobileComponent,
    EducationMobileComponent,
    ProjectsMobileComponent,
    ContactMobileComponent,
    GithubMobileComponent,
    SettingsMobileComponent,
    //games
    RacingComponent
  ],
  templateUrl: './mobile-app-view.html',
  styleUrl:    './mobile-app-view.css',
})
export class MobileAppViewComponent {

  appId  = input.required<string>();
  isDark = input<boolean>(true);
  visible = signal(false);
  closing = signal(false);

  private el = inject(ElementRef);

  constructor() {
    effect(() => {
      this.appId();
      this.visible.set(false);
      this.closing.set(false);
      setTimeout(() => this.visible.set(true), 10);
    });
  }

  dismiss() {
    const view = this.el.nativeElement.querySelector('.app-view');
    if (view) {
      view.classList.remove('visible');
      view.getBoundingClientRect(); // fuerza reflow
      view.classList.add('closing');
    }
  }
}