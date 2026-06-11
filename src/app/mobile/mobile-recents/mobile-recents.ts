import { Component, input, output, signal } from '@angular/core';
import { MobileApp } from '../mobile.interfaces';
import { AboutComponent }      from '../../apps/about/about';
import { ExperienceComponent } from '../../apps/experience/experience';
import { SkillsComponent }     from '../../apps/skills/skills';
import { EducationComponent }  from '../../apps/education/education';
import { ProjectsComponent }   from '../../apps/projects/projects';
import { ContactComponent }    from '../../apps/contact/contact';
import { GithubComponent }     from '../../apps/github/github';

interface DragState {
  appId:     string;
  deltaY:    number;
  dragging:  boolean;
  dismissing:boolean;
}

@Component({
  selector:    'app-mobile-recents',
  standalone:  true,
  imports: [
    AboutComponent, ExperienceComponent, SkillsComponent,
    EducationComponent, ProjectsComponent, ContactComponent,
    GithubComponent
  ],
  templateUrl: './mobile-recents.html',
  styleUrl:    './mobile-recents.css'
})
export class MobileRecentsComponent {

  openedApps = input.required<MobileApp[]>();
  isDark     = input<boolean>(true);

  onResume   = output<MobileApp>();
  onClose    = output<string>();
  onCloseAll = output<void>();

  drag = signal<DragState>({
    appId: '', deltaY: 0, dragging: false, dismissing: false
  });

  private startY = 0;

  onTouchStart(e: TouchEvent, appId: string) {
    this.startY = e.touches[0].clientY;
    this.drag.set({ appId, deltaY: 0, dragging: true, dismissing: false });
  }

onTouchMove(e: TouchEvent, appId: string) {
  if (this.drag().appId !== appId || !this.drag().dragging) return;
  const deltaY = e.touches[0].clientY - this.startY;
  if (deltaY < 0) {
    this.drag.update(d => ({ ...d, deltaY }));
  }
}

onTouchEnd(e: TouchEvent, appId: string) {
  if (this.drag().appId !== appId) return;
  const deltaY = this.drag().deltaY;

  if (deltaY < -120) {
    this.drag.update(d => ({ ...d, dismissing: true, deltaY: -600 }));
    setTimeout(() => {
      this.onClose.emit(appId);
      this.drag.set({ appId: '', deltaY: 0, dragging: false, dismissing: false });
    }, 320);
  } else {
    this.drag.set({ appId: '', deltaY: 0, dragging: false, dismissing: false });
  }
}

getCardStyle(appId: string): object {
  if (this.drag().appId !== appId) return {};
  const deltaY  = this.drag().deltaY;
  const opacity = Math.max(0, 1 + deltaY / 350);
  const transition = this.drag().dismissing
    ? 'transform 0.32s ease, opacity 0.32s ease'
    : 'none';
  return {
    transform:  `translateY(${deltaY}px)`,
    opacity:    opacity,
    transition: transition
  };
}
}