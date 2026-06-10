import { Component, signal, ViewChild, ElementRef, AfterViewInit, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface TerminalLine {
  text: string;
  type: 'system' | 'info' | 'command' | 'success' | 'error' | 'warning';
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactComponent implements AfterViewInit {
  @ViewChild('terminalInput') inputRef!: ElementRef;
  @ViewChild('terminalBody') bodyRef!: ElementRef;

  currentCommand = '';
  isError = signal(false);

  history = signal<TerminalLine[]>([
    { text: 'Microsoft Windows [Version 11.0.0]', type: 'system' },
    {
      text: '(c) Gabriel Fernandez Corp. 2026. Todos los derechos reservados... o casi.',
      type: 'system',
    },
    { text: '', type: 'system' },
    { text: 'C:\\Recruiters\\Contact> contact --info', type: 'command' },
    { text: '', type: 'system' },
    {
      text: 'C:\\Recruiters\\Contact\\Gmail>    gabriel.fernandezdeveloper@gmail.com',
      type: 'info',
    },
    {
      text: 'C:\\Recruiters\\Contact\\LinkedIn> linkedin.com/in/gabriel-fernandez-melendez',
      type: 'info',
    },
    {
      text: 'C:\\Recruiters\\Contact\\GitHub>   github.com/GabrielFernandezMelendez',
      type: 'info',
    },
    { text: 'C:\\Recruiters\\Contact\\Tlf>      +34 648446865', type: 'info' },
    { text: '', type: 'system' },
    { text: '─────────────────────────────────────────────────────', type: 'system' },
    {
      text: 'Escribe un comando para contactar. Escribe "help" para ver los disponibles.',
      type: 'system',
    },
    { text: '─────────────────────────────────────────────────────', type: 'system' },
    { text: '', type: 'system' },
  ]);

  ngAfterViewInit() {
    this.focusInput();
  }

  isLight = input<boolean>(false);

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
    this.history.update((h) => [...h, { text, type }]);
  }

  executeCommand() {
    const cmd = this.currentCommand.trim().toLowerCase();
    if (!cmd) return;

    this.addLine(`C:\\Recruiters\\Contact> ${cmd}`, 'command');
    this.isError.set(false);

    switch (cmd) {
      case 'gmail':
        this.addLine('Abriendo Gmail...', 'success');
        this.addLine('Destinatario: gabriel.fernandezdeveloper@gmail.com', 'success');
        window.open(
          'https://mail.google.com/mail/?view=cm&to=gabriel.fernandezdeveloper@gmail.com&su=Contacto desde Portfolio',
          '_blank',
        );
        break;

      case 'linkedin':
        this.addLine('Abriendo LinkedIn...', 'success');
        window.open(
          'https://www.linkedin.com/in/gabriel-fern%C3%A1ndez-mel%C3%A9ndez-336640238',
          '_blank',
        );
        break;

      case 'github':
        this.addLine('Abriendo GitHub...', 'success');
        window.open('https://github.com/GabrielFernandezMelendez', '_blank');
        break;

      case 'tlf':
        this.addLine('ERROR FATAL: Este comando requiere hardware externo.', 'warning');
        this.addLine(
          'Por favor, saca el telefono, desbloquéalo, abre la app de llamadas...',
          'warning',
        );
        this.addLine('Numero: +34 648446865. Ya sabes como va esto.', 'warning');
        break;

      case 'help':
        this.addLine('Comandos disponibles:', 'system');
        this.addLine(
          '  gmail    -> Abrir Gmail con mi direccion lista para recibir tu mensaje',
          'info',
        );
        this.addLine('  linkedin -> Abrir perfil de LinkedIn', 'info');
        this.addLine('  github   -> Abrir perfil de GitHub', 'info');
        this.addLine('  tlf      -> Informacion de contacto telefonico', 'info');
        this.addLine('  clear    -> Limpiar el historial de la terminal', 'info');
        break;

      case 'clear':
        this.history.set([]);
        break;

      default:
        this.isError.set(true);
        this.addLine(`ERROR: '${cmd}' no se reconoce como comando interno.`, 'error');
        this.addLine(
          'Asi no podras contratarme. Escribe "help" para ver los comandos disponibles.',
          'error',
        );
        break;
    }

    this.currentCommand = '';
    this.scrollToBottom();
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.executeCommand();
    }
  }
}
