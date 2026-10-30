// GDD-UI-02: every text on screen that switches with the Language row, in each language. Pure data, no Phaser. The names "PONCHO",
// "Siete Vidas", "Siete vidas gastadas" and "Hilos", the language names and the sandbox's placeholder lines are the same in every language.
import type { Language } from '../sim/settings';

export interface UiText {
  readonly start: string;
  readonly tutorial: string;
  readonly settings: string;
  readonly paused: string;
  readonly resume: string;
  readonly quit: string;
  readonly sideways: string;
  readonly master: string;
  readonly effects: string;
  readonly language: string;
  readonly back: string;
  readonly gameOver: string;
  readonly retry: string;
  readonly levelClear: string;
  readonly pressAny: string;
}

/** GDD-UI-02: the table of texts. The Spanish and German are Proposed. */
export const TEXT: Record<Language, UiText> = {
  en: {
    start: 'Start',
    tutorial: 'Tutorial',
    settings: 'Settings',
    paused: 'Paused',
    resume: 'Resume',
    quit: 'Quit to title',
    sideways: 'Turn your device sideways',
    master: 'Master volume',
    effects: 'Effects volume',
    language: 'Language',
    back: 'Back',
    gameOver: 'Game over',
    retry: 'Press any button to Retry',
    levelClear: 'Level clear!',
    pressAny: 'Press any button',
  },
  es: {
    start: 'Jugar',
    tutorial: 'Tutorial',
    settings: 'Ajustes',
    paused: 'Pausa',
    resume: 'Continuar',
    quit: 'Salir al título',
    sideways: 'Gira tu dispositivo de lado',
    master: 'Volumen general',
    effects: 'Volumen de efectos',
    language: 'Idioma',
    back: 'Volver',
    gameOver: 'Fin del juego',
    retry: 'Presiona cualquier botón para reintentar',
    levelClear: '¡Nivel superado!',
    pressAny: 'Presiona cualquier botón',
  },
  de: {
    start: 'Spielen',
    tutorial: 'Tutorial',
    settings: 'Einstellungen',
    paused: 'Pause',
    resume: 'Weiter',
    quit: 'Zurück zum Titel',
    sideways: 'Dreh dein Gerät quer',
    master: 'Gesamtlautstärke',
    effects: 'Effektlautstärke',
    language: 'Sprache',
    back: 'Zurück',
    gameOver: 'Spiel vorbei',
    retry: 'Drücke eine Taste für einen neuen Versuch',
    levelClear: 'Level geschafft!',
    pressAny: 'Drücke eine Taste',
  },
};

/** GDD-UI-02: the Language row shows the chosen language's own name, never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Español', de: 'Deutsch' };
