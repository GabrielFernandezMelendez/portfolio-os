import { Component, input, output, signal, OnInit } from '@angular/core';
import { AboutComponent }      from '../../apps/about/about';
import { ExperienceComponent } from '../../apps/experience/experience';
import { SkillsComponent }     from '../../apps/skills/skills';
import { EducationComponent }  from '../../apps/education/education';
import { ProjectsComponent }   from '../../apps/projects/projects';
import { ContactComponent }    from '../../apps/contact/contact';
import { GithubComponent }     from '../../apps/github/github';

@Component({
  selector:    'app-mobile-app-view',
  standalone:  true,
  imports: [
    AboutComponent,
    ExperienceComponent,
    SkillsComponent,
    EducationComponent,
    ProjectsComponent,
    ContactComponent,
    GithubComponent,
  ],
  templateUrl: './mobile-app-view.html',
  styleUrl:    './mobile-app-view.css'
})
export class MobileAppViewComponent implements OnInit {

  appId   = input.required<string>();
  isDark  = input<boolean>(true);
  closing = signal(false);
  visible = signal(false);

  ngOnInit() {
    setTimeout(() => this.visible.set(true), 10);
  }

  dismiss() {
    this.closing.set(true);
  }
}