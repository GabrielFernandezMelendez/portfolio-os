import { Pipe, PipeTransform, inject } from '@angular/core';
import { Translator } from './translator';

/**
 * {{ 'hud.day' | t: { day: 3 } }}
 * Impuro a propósito: así se vuelve a evaluar cuando cambia el idioma (la señal `lang` del traductor)
 * aunque la clave y los parámetros sean los mismos. Es barato: solo busca en un diccionario.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TPipe implements PipeTransform {
  private readonly translator = inject(Translator);

  transform(key: string, params?: Readonly<Record<string, string | number>>): string {
    return this.translator.t(key, params);
  }
}
