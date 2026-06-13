import { Component, signal, ViewChild, ElementRef,
         AfterViewInit, input, inject, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../i18n/i18n.service';

interface TerminalLine {
  text: string;
  type: 'system' | 'info' | 'command' | 'success' | 'error' | 'warning';
}

@Component({
  selector:    'app-contact',
  standalone:  true,
  imports:     [FormsModule],
  templateUrl: './contact.html',
  styleUrl:    './contact.css',
})
export class ContactComponent implements AfterViewInit {

  @ViewChild('terminalInput') inputRef!: ElementRef;
  @ViewChild('terminalBody')  bodyRef!:  ElementRef;

  i18n           = inject(I18nService);
  isLight        = input<boolean>(false);
  currentCommand = '';
  isError        = signal(false);
  history        = signal<TerminalLine[]>([]);

  constructor() {
    effect(() => {
      // Reinicia el historial cuando cambia el idioma
      this.i18n.currentLang();
      this.history.set(this.buildInitialHistory());
    });
  }

  buildInitialHistory(): TerminalLine[] {
    return [
      { text: this.i18n.t('contact.terminal_intro_1'), type: 'system' },
      { text: this.i18n.t('contact.terminal_intro_2'), type: 'system' },
      { text: '', type: 'system' },
      { text: 'C:\\Recruiters\\Contact> contact --info', type: 'command' },
      { text: '', type: 'system' },
      { text: 'C:\\Recruiters\\Contact\\Gmail>    gabriel.fernandezdeveloper@gmail.com', type: 'info' },
      { text: 'C:\\Recruiters\\Contact\\LinkedIn> linkedin.com/in/gabriel-fernandez-melendez', type: 'info' },
      { text: 'C:\\Recruiters\\Contact\\GitHub>   github.com/GabrielFernandezMelendez', type: 'info' },
      { text: 'C:\\Recruiters\\Contact\\Tlf>      +34 648446865', type: 'info' },
      { text: '', type: 'system' },
      { text: '─────────────────────────────────────────────────────', type: 'system' },
      { text: this.i18n.t('contact.terminal_hint'), type: 'system' },
      { text: '─────────────────────────────────────────────────────', type: 'system' },
      { text: '', type: 'system' },
    ];
  }

  ngAfterViewInit() { this.focusInput(); }

  focusInput() {
    setTimeout(() => this.inputRef?.nativeElement?.focus(), 100);
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.bodyRef) {
        this.bodyRef.nativeElement.scrollTop = this.bodyRef.nativeElement.scrollHeight;
      }
    }, 50);
  }

  addLine(text: string, type: TerminalLine['type']) {
    this.history.update(h => [...h, { text, type }]);
  }

  executeCommand() {
    const cmd = this.currentCommand.trim().toLowerCase();
    if (!cmd) return;

    this.addLine(`C:\\Recruiters\\Contact> ${cmd}`, 'command');
    this.isError.set(false);

    switch (cmd) {
      case 'gmail':
        this.addLine(this.i18n.t('contact.terminal_gmail_ok'), 'success');
        this.addLine(this.i18n.t('contact.terminal_gmail_to'), 'success');
        window.open(
          'https://mail.google.com/mail/?view=cm&to=gabriel.fernandezdeveloper@gmail.com&su=Contacto desde Portfolio',
          '_blank'
        );
        break;

      case 'linkedin':
        this.addLine(this.i18n.t('contact.terminal_linkedin_ok'), 'success');
        window.open(
          'https://www.linkedin.com/in/gabriel-fern%C3%A1ndez-mel%C3%A9ndez-336640238',
          '_blank'
        );
        break;

      case 'github':
        this.addLine(this.i18n.t('contact.terminal_github_ok'), 'success');
        window.open('https://github.com/GabrielFernandezMelendez', '_blank');
        break;

      case 'tlf':
        this.addLine(this.i18n.t('contact.terminal_tlf_error'),  'warning');
        this.addLine(this.i18n.t('contact.terminal_tlf_manual'), 'warning');
        this.addLine(this.i18n.t('contact.terminal_tlf_number'), 'warning');
        break;

      case 'help':
        this.addLine(this.i18n.t('contact.terminal_help_header'),   'system');
        this.addLine(this.i18n.t('contact.terminal_help_gmail'),    'info');
        this.addLine(this.i18n.t('contact.terminal_help_linkedin'), 'info');
        this.addLine(this.i18n.t('contact.terminal_help_github'),   'info');
        this.addLine(this.i18n.t('contact.terminal_help_tlf'),      'info');
        this.addLine(this.i18n.t('contact.terminal_help_clear'),    'info');
        break;

      case 'clear':
        this.history.set([]);
        break;

      default:
        this.isError.set(true);
        this.addLine(`ERROR: '${cmd}' ${this.i18n.t('contact.terminal_unknown_1')}`, 'error');
        this.addLine(this.i18n.t('contact.terminal_unknown_2'), 'error');
        break;
    }

    this.currentCommand = '';
    this.scrollToBottom();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.executeCommand();
  }
}