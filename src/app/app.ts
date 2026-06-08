import { Component } from '@angular/core';
import { DesktopComponent } from './desktop/desktop';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DesktopComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}