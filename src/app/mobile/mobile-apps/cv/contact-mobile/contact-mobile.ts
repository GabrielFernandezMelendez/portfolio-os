import {
  Component,
  signal,
  ViewChild,
  ElementRef,
  AfterViewInit,
  input,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  id: number;
  text: string;
  sender: 'ai' | 'user';
  typing?: boolean;
}

@Component({
  selector: 'app-contact-mobile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contact-mobile.html',
  styleUrl: './contact-mobile.css',
})
export class ContactMobileComponent implements OnInit, AfterViewInit {
  @ViewChild('chatBody') chatBody!: ElementRef;
  @ViewChild('chatInput') chatInput!: ElementRef;

  isDark = input<boolean>(true);
  currentMsg = '';
  isTyping = signal(false);
  showConfirm = signal(false);
  msgId = 0;

  messages = signal<ChatMessage[]>([]);

  readonly KEYWORDS: Record<string, string[]> = {
    linkedin: ['linkedin', 'perfil', 'red profesional'],
    email: ['email', 'gmail', 'correo', 'mail', 'escribir'],
    telefono: ['teléfono', 'telefono', 'llamar', 'llámame', 'llamame', 'tlf', 'móvil', 'movil'],
    github: ['github', 'código', 'codigo', 'repos', 'repositorio'],
    ayuda: ['ayuda', 'help', 'comandos', 'qué puedo', 'que puedo'],
    sobre: ['quien', 'quién', 'sobre gabriel', 'sobre ti', 'hola', 'buenas'],
  };

  ngOnInit() {
    setTimeout(
      () =>
        this.addAiMessage(
          '¡Hola! Soy el asistente de Gabriel. Puedo ayudarte a contactarle directamente. ' +
            'Prueba con: linkedin, email, teléfono, github o ayuda 👋',
        ),
      300,
    );
  }

  ngAfterViewInit() {
    setTimeout(() => this.chatInput?.nativeElement?.focus(), 500);
  }

  addAiMessage(text: string) {
    this.isTyping.set(true);
    this.scrollBottom();

    setTimeout(() => {
      this.isTyping.set(false);
      this.messages.update((m) => [
        ...m,
        {
          id: ++this.msgId,
          text,
          sender: 'ai',
        },
      ]);
      this.scrollBottom();
    }, 900);
  }

  addUserMessage(text: string) {
    this.messages.update((m) => [
      ...m,
      {
        id: ++this.msgId,
        text,
        sender: 'user',
      },
    ]);
    this.scrollBottom();
  }

  sendMessage() {
    const msg = this.currentMsg.trim();
    if (!msg) return;
    this.addUserMessage(msg);
    this.currentMsg = '';
    this.processMessage(msg.toLowerCase());
  }

  processMessage(msg: string) {
    if (this.matchesKeyword(msg, this.KEYWORDS['linkedin'])) {
      this.addAiMessage(
        'Perfecto, te redirigirá al perfil de LinkedIn de Gabriel en un momento... 🔗',
      );
      setTimeout(() => {
        const profileUrl =
          'https://www.linkedin.com/in/gabriel-fern%C3%A1ndez-mel%C3%A9ndez-336640238';

        // Intent de Android — abre el perfil directamente en la app
        const intentUrl = `intent://${profileUrl.replace('https://', '')}#Intent;package=com.linkedin.android;scheme=https;end`;

        window.location.href = intentUrl;

        // Fallback para iOS y navegador
        setTimeout(() => {
          window.open(profileUrl, '_blank');
        }, 1500);
      }, 2000);
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['email'])) {
      this.addAiMessage(
        'Abriendo tu app de correo con el email de Gabriel listo para enviar... ✉️',
      );
      setTimeout(
        () =>
          window.open(
            'mailto:gabriel.fernandezdeveloper@gmail.com?subject=Contacto desde Portfolio',
            '_blank',
          ),
        2000,
      );
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['telefono'])) {
      this.addAiMessage(
        '¿Seguro que quieres llamar a Gabriel? Si confirmas, tu app de llamadas marcará el +34 648446865. Escribe "confirmar" para proceder o "cancelar" para volver. 📞',
      );
      this.showConfirm.set(true);
      return;
    }

    if (msg === 'confirmar' && this.showConfirm()) {
      this.showConfirm.set(false);
      this.addAiMessage('Marcando +34 648446865... ¡Suerte! 🤙');
      setTimeout(() => window.open('tel:+34648446865', '_self'), 1500);
      return;
    }

    if (msg === 'cancelar' && this.showConfirm()) {
      this.showConfirm.set(false);
      this.addAiMessage('Entendido, llamada cancelada. ¿En qué más puedo ayudarte? 😊');
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['github'])) {
      this.addAiMessage('Te llevo al GitHub de Gabriel ahora mismo... 🐙');
      setTimeout(() => window.open('https://github.com/GabrielFernandezMelendez', '_blank'), 2000);
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['ayuda'])) {
      this.addAiMessage(
        'Puedes decirme:\n\n' +
          '• linkedin → perfil profesional\n' +
          '• email → escribirle un correo\n' +
          '• teléfono → llamarle directamente\n' +
          '• github → ver su código\n' +
          '• sobre gabriel → conocerle mejor',
      );
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['sobre'])) {
      this.addAiMessage(
        'Gabriel es un Software Developer especializado en Frontend y sistemas multiplataforma. ' +
          'Actualmente en prácticas en Jakala/Factoría F5. ' +
          '¿Quieres contactarle por linkedin, email o teléfono? 🚀',
      );
      return;
    }

    this.addAiMessage(
      'No he entendido eso del todo... Prueba con: linkedin, email, teléfono, github o ayuda 🤔',
    );
  }

  matchesKeyword(msg: string, keywords: string[]): boolean {
    return keywords.some((k) => msg.includes(k));
  }

  scrollBottom() {
    setTimeout(() => {
      if (this.chatBody?.nativeElement) {
        this.chatBody.nativeElement.scrollTop = this.chatBody.nativeElement.scrollHeight;
      }
    }, 100);
  }

  onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this.sendMessage();
  }
}
