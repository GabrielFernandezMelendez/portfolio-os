import { Component, input, output, signal, OnInit } from '@angular/core';
import { GithubComponent } from '../../apps/github/github';
import { AboutMobileComponent } from '../mobile-apps/cv/about-mobile/about-mobile';
import { ExperienceMobileComponent } from '../mobile-apps/cv/experience-mobile/experience-mobile';
import { SkillsMobileComponent } from '../mobile-apps/cv/skills-mobile/skills-mobile';
import { EducationMobileComponent } from '../mobile-apps/cv/education-mobile/education-mobile';
import { ProjectsMobileComponent } from '../mobile-apps/cv/projects-mobile/projects-mobile';
import { ContactMobileComponent } from '../mobile-apps/cv/contact-mobile/contact-mobile';
import { GithubMobileComponent } from '../mobile-apps/cv/github-mobile/github-mobile';
import { SettingsMobileComponent } from '../mobile-apps/settings/settings-mobile/settings-mobile';


@Component({
  selector: 'app-mobile-app-view',
  standalone: true,
  imports: [

    AboutMobileComponent,
    ExperienceMobileComponent,
    SkillsMobileComponent,
    EducationMobileComponent,
    ProjectsMobileComponent,
    ContactMobileComponent,
    GithubMobileComponent,
    SettingsMobileComponent
  ],
  templateUrl: './mobile-app-view.html',
  styleUrl: './mobile-app-view.css',
})
export class MobileAppViewComponent implements OnInit {
  appId = input.required<string>();
  isDark = input<boolean>(true);
  closing = signal(false);
  visible = signal(false);

  ngOnInit() {
    setTimeout(() => this.visible.set(true), 10);
  }

  dismiss() {
    this.closing.set(true);
  }
}
