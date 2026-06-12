import { Component, input, output, signal, OnInit } from '@angular/core';
import { EducationComponent } from '../../apps/education/education';
import { ProjectsComponent } from '../../apps/projects/projects';
import { ContactComponent } from '../../apps/contact/contact';
import { GithubComponent } from '../../apps/github/github';
import { AboutMobileComponent } from '../mobile-apps/cv/about-mobile/about-mobile';
import { ExperienceMobileComponent } from '../mobile-apps/cv/experience-mobile/experience-mobile';
import { SkillsMobileComponent } from '../mobile-apps/cv/skills-mobile/skills-mobile';

@Component({
  selector: 'app-mobile-app-view',
  standalone: true,
  imports: [
    EducationComponent,
    ProjectsComponent,
    ContactComponent,
    GithubComponent,
    AboutMobileComponent,
    ExperienceMobileComponent,
    SkillsMobileComponent
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
