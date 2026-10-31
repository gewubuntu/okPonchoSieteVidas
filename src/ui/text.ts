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
  /** The results menu's rows besides `quit` (GDD-UI-02): "Next level" and "Retry" (`retry` is the game-over prompt). */
  readonly next: string;
  readonly retryLevel: string;
  /** The clear time's word, as in "Time 2:14". */
  readonly time: string;
  /** GDD-UI-02: the best time's word, as in "Best 1:58", and the mark of a new best. */
  readonly best: string;
  readonly newBest: string;
  /** The medal lines, by `Medal` (GDD-PRG-03). */
  readonly bronze: string;
  readonly silver: string;
  readonly gold: string;
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
    next: 'Next level',
    retryLevel: 'Retry',
    time: 'Time',
    best: 'Best',
    newBest: 'New best!',
    bronze: 'Bronze medal',
    silver: 'Silver medal',
    gold: 'Gold medal',
  },
  es: {
    start: 'Jugar',
    tutorial: 'Tutorial',
    settings: 'Configuración',
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
    next: 'Siguiente nivel',
    retryLevel: 'Reintentar',
    time: 'Tiempo',
    best: 'Récord',
    newBest: '¡Nuevo récord!',
    bronze: 'Medalla de bronce',
    silver: 'Medalla de plata',
    gold: 'Medalla de oro',
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
    next: 'Nächstes Level',
    retryLevel: 'Nochmal',
    time: 'Zeit',
    best: 'Bestzeit',
    newBest: 'Neuer Rekord!',
    bronze: 'Bronzemedaille',
    silver: 'Silbermedaille',
    gold: 'Goldmedaille',
  },
};

/** GDD-UI-02: the Language row shows the chosen language's own name, never translated. */
export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', es: 'Español', de: 'Deutsch' };
