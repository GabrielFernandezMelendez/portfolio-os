import { Component, input, output } from '@angular/core';
import { MobileApp } from '../mobile.interfaces';

@Component({
  selector:    'app-mobile-home',
  standalone:  true,
  templateUrl: './mobile-home.html',
  styleUrl:    './mobile-home.css'
})
export class MobileHomeComponent {
  apps      = input.required<MobileApp[]>();
  isDark    = input<boolean>(true);
  onOpenApp = output<MobileApp>();
}