import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MobileHomeComponent } from './mobile-home';
import { MobilePage } from '../mobile.interfaces';

// Dos páginas: una con apps del CV y otra con una carpeta, para cubrir ambos casos del grid
const MOCK_PAGES: MobilePage[] = [
  {
    id: 'page-cv',
    apps: [
      { id: 'about',  title: 'Sobre mí',    icon: '👤' },
      { id: 'skills', title: 'Habilidades', icon: '🛠' },
    ],
  },
  {
    id: 'page-games',
    apps: [
      {
        id: 'folder-test', title: 'Juegos', icon: '📁', isFolder: true, folderName: 'Juegos',
        apps: [{ id: 'racing', title: 'RaceTime', icon: '🏎️' }],
      },
    ],
  },
];

describe('MobileHomeComponent', () => {
  let component: MobileHomeComponent;
  let fixture: ComponentFixture<MobileHomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileHomeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileHomeComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pages', MOCK_PAGES);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});