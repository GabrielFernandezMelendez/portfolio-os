import { Component, input } from '@angular/core';

@Component({
  selector:    'app-about-mobile',
  standalone:  true,
  templateUrl: './about-mobile.html',
  styleUrl:    './about-mobile.css',
})
export class AboutMobileComponent {
  isDark = input<boolean>(true);
}