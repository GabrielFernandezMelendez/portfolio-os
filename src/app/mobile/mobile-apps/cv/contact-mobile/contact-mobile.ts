import { Component, signal, ViewChild, ElementRef,
         AfterViewInit, input, OnInit, inject, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../i18n/i18n.service';

interface ChatMessage {
  id:      number;
  text:    string;
  sender:  'ai' | 'user';
}

@Component({
  selector:    'app-contact-mobile',
  standalone:  true,
  imports:     [FormsModule],
  templateUrl: './contact-mobile.html',
  styleUrl:    './contact-mobile.css',
})
export class ContactMobileComponent implements OnInit, AfterViewInit {

  @ViewChild('chatBody')  chatBody!:  ElementRef;
  @ViewChild('chatInput') chatInput!: ElementRef;

  isDark     = input<boolean>(true);
  i18n       = inject(I18nService);
  lang       = computed(() => this.i18n.currentLang());
  currentMsg = '';
  isTyping   = signal(false);
  showConfirm = signal(false);
  msgId      = 0;
  messages   = signal<ChatMessage[]>([]);

  readonly KEYWORDS: Record<string, string[]> = {
    linkedin:  ['linkedin', 'perfil', 'red profesional', 'profile'],
    email:     ['email', 'gmail', 'correo', 'mail', 'escribir', 'write'],
    telefono:  ['teléfono', 'telefono', 'llamar', 'llámame', 'llamame',
                'tlf', 'móvil', 'movil', 'phone', 'call'],
    github:    ['github', 'código', 'codigo', 'repos', 'repositorio', 'code'],
    ayuda:     ['ayuda', 'help', 'comandos', 'qué puedo', 'que puedo', 'commands'],
    sobre:     ['quien', 'quién', 'sobre gabriel', 'sobre ti', 'hola',
                'buenas', 'who', 'about', 'hello', 'hi'],
  };

  constructor() {
    effect(() => {
      this.i18n.currentLang();
      this.msgId = 0;
      this.messages.set([]);
      this.showConfirm.set(false);
      setTimeout(() => this.addAiMessage(this.i18n.t('contact.ai_welcome')), 300);
    });
  }

  ngOnInit() {}

  ngAfterViewInit() {
    setTimeout(() => this.chatInput?.nativeElement?.focus(), 500);
  }

  addAiMessage(text: string) {
    this.isTyping.set(true);
    this.scrollBottom();
    setTimeout(() => {
      this.isTyping.set(false);
      this.messages.update(m => [...m, { id: ++this.msgId, text, sender: 'ai' }]);
      this.scrollBottom();
    }, 900);
  }

  addUserMessage(text: string) {
    this.messages.update(m => [...m, { id: ++this.msgId, text, sender: 'user' }]);
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
      this.addAiMessage(this.i18n.t('contact.ai_linkedin_response'));
      setTimeout(() => {
        const profileUrl = 'https://www.linkedin.com/in/gabriel-fern%C3%A1ndez-mel%C3%A9ndez-336640238';
        const intentUrl  = `intent://${profileUrl.replace('https://', '')}#Intent;package=com.linkedin.android;scheme=https;end`;
        window.location.href = intentUrl;
        setTimeout(() => window.open(profileUrl, '_blank'), 1500);
      }, 2000);
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['email'])) {
      this.addAiMessage(this.i18n.t('contact.ai_email_response'));
      setTimeout(() => window.open(
        'mailto:gabriel.fernandezdeveloper@gmail.com?subject=Contacto desde Portfolio',
        '_blank'
      ), 2000);
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['telefono'])) {
      this.addAiMessage(this.i18n.t('contact.ai_phone_confirm'));
      this.showConfirm.set(true);
      return;
    }

    if ((msg === 'confirmar' || msg === 'confirm') && this.showConfirm()) {
      this.showConfirm.set(false);
      this.addAiMessage(this.i18n.t('contact.ai_phone_calling'));
      setTimeout(() => window.open('tel:+34648446865', '_self'), 1500);
      return;
    }

    if ((msg === 'cancelar' || msg === 'cancel') && this.showConfirm()) {
      this.showConfirm.set(false);
      this.addAiMessage(this.i18n.t('contact.ai_phone_cancelled'));
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['github'])) {
      this.addAiMessage(this.i18n.t('contact.ai_github_response'));
      setTimeout(() => window.open('https://github.com/GabrielFernandezMelendez', '_blank'), 2000);
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['ayuda'])) {
      this.addAiMessage(this.i18n.t('contact.ai_help_response'));
      return;
    }

    if (this.matchesKeyword(msg, this.KEYWORDS['sobre'])) {
      this.addAiMessage(this.i18n.t('contact.ai_about_response'));
      return;
    }

    this.addAiMessage(this.i18n.t('contact.ai_unknown'));
  }

  matchesKeyword(msg: string, keywords: string[]): boolean {
    return keywords.some(k => msg.includes(k));
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