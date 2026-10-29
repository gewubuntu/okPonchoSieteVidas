import { describe, expect, it } from 'vitest';
import { TAP_OFF, type PauseEvent } from './pause';
import { browserLanguage, DEFAULT_SETTINGS, settingsEvent, sfxVolume, type Language, type Settings, type SettingsRow } from './settings';

/** The result of one event on the open settings screen, which does not leave it. */
const on = (row: SettingsRow, settings: Settings, event: PauseEvent) => {
  const result = settingsEvent(row, settings, event);
  if (result === 'back') throw new Error(`${JSON.stringify(event)} left`);
  return result;
};
const at = (master: number, effects: number): Settings => ({ master, effects, language: 'en' });
const speaking = (language: Language, master = 10, effects = 10): Settings => ({ master, effects, language });

describe('GDD-UI-02 settings screen', () => {
  it('Up and Down choose the row above or below, with no wrap-around', () => {
    expect(on('master', DEFAULT_SETTINGS, 'menuDown').row).toBe('effects');
    expect(on('effects', DEFAULT_SETTINGS, 'menuDown').row).toBe('language');
    expect(on('language', DEFAULT_SETTINGS, 'menuDown').row).toBe('back');
    expect(on('back', DEFAULT_SETTINGS, 'menuDown').row).toBe('back');
    expect(on('back', DEFAULT_SETTINGS, 'menuUp').row).toBe('language');
    expect(on('language', DEFAULT_SETTINGS, 'menuUp').row).toBe('effects');
    expect(on('effects', DEFAULT_SETTINGS, 'menuUp').row).toBe('master');
    expect(on('master', DEFAULT_SETTINGS, 'menuUp').row).toBe('master');
  });

  it('Left lowers and Right raises the chosen volume by 1', () => {
    expect(on('master', at(10, 10), 'menuLeft')).toEqual({ row: 'master', settings: at(9, 10) });
    expect(on('effects', at(10, 5), 'menuRight')).toEqual({ row: 'effects', settings: at(10, 6) });
    expect(on('effects', at(10, 5), 'menuLeft')).toEqual({ row: 'effects', settings: at(10, 4) });
    expect(on('master', at(3, 5), 'menuRight')).toEqual({ row: 'master', settings: at(4, 5) });
  });

  it('a volume stays from 0 to 10', () => {
    expect(on('master', at(0, 10), 'menuLeft').settings).toEqual(at(0, 10));
    expect(on('effects', at(10, 0), 'menuLeft').settings).toEqual(at(10, 0));
    expect(on('effects', at(10, 10), 'menuRight').settings).toEqual(at(10, 10));
    expect(on('master', at(10, 3), 'menuRight').settings).toEqual(at(10, 3));
    expect(on('master', at(1, 10), 'menuLeft').settings).toEqual(at(0, 10));
    expect(on('effects', at(10, 9), 'menuRight').settings).toEqual(at(10, 10));
  });

  it('Left and Right do nothing on Back', () => {
    expect(on('back', at(4, 6), 'menuLeft')).toEqual({ row: 'back', settings: at(4, 6) });
    expect(on('back', at(4, 6), 'menuRight')).toEqual({ row: 'back', settings: at(4, 6) });
  });

  it('Enter, Space or Z on Back leaves; on a volume row it does nothing', () => {
    expect(settingsEvent('back', DEFAULT_SETTINGS, 'pick')).toBe('back');
    expect(settingsEvent('master', DEFAULT_SETTINGS, 'pick')).toEqual({ row: 'master', settings: DEFAULT_SETTINGS });
    expect(settingsEvent('effects', DEFAULT_SETTINGS, 'pick')).toEqual({ row: 'effects', settings: DEFAULT_SETTINGS });
  });

  it('Escape, P and the pause button leave', () => {
    for (const row of ['master', 'effects', 'language', 'back'] as const) {
      expect(settingsEvent(row, DEFAULT_SETTINGS, 'key'), `key on ${row}`).toBe('back');
    }
    expect(settingsEvent('master', DEFAULT_SETTINGS, 'key')).toBe('back');
    expect(settingsEvent('master', DEFAULT_SETTINGS, 'button')).toBe('back');
    expect(settingsEvent('effects', DEFAULT_SETTINGS, 'button')).toBe('back');
  });

  it('a tap on a volume row chooses it and moves it by its half', () => {
    expect(settingsEvent('back', at(10, 10), { ...TAP_OFF, settings: { row: 'effects', side: 'left' } })).toEqual({ row: 'effects', settings: at(10, 9) });
    expect(settingsEvent('back', at(10, 9), { ...TAP_OFF, settings: { row: 'effects', side: 'right' } })).toEqual({ row: 'effects', settings: at(10, 10) });
    expect(settingsEvent('effects', at(5, 5), { ...TAP_OFF, settings: { row: 'master', side: 'left' } })).toEqual({ row: 'master', settings: at(4, 5) });
    expect(settingsEvent('master', at(5, 5), { ...TAP_OFF, settings: { row: 'master', side: 'right' } })).toEqual({ row: 'master', settings: at(6, 5) });
  });

  it('a tap on Back leaves; a tap anywhere else does nothing', () => {
    expect(settingsEvent('master', DEFAULT_SETTINGS, { ...TAP_OFF, settings: { row: 'back', side: 'left' } })).toBe('back');
    expect(settingsEvent('master', DEFAULT_SETTINGS, { ...TAP_OFF, settings: { row: 'back', side: 'right' } })).toBe('back');
    expect(settingsEvent('effects', at(7, 8), TAP_OFF)).toEqual({ row: 'effects', settings: at(7, 8) });
    // A tap on a pause or title row's place is no settings tap.
    expect(settingsEvent('effects', at(7, 8), { ...TAP_OFF, pause: 'quit' })).toEqual({ row: 'effects', settings: at(7, 8) });
  });

  it('losing focus and turning changes nothing', () => {
    for (const e of ['blur', 'portrait', 'landscape'] as const) {
      expect(settingsEvent('effects', at(7, 8), e), e).toEqual({ row: 'effects', settings: at(7, 8) });
    }
  });
});

describe('GDD-AUD-01 effects volume', () => {
  it('every sound effect plays at Master times Effects', () => {
    expect(sfxVolume(at(10, 10))).toBe(1);
    expect(sfxVolume(at(5, 10))).toBe(0.5);
    expect(sfxVolume(at(10, 5))).toBe(0.5);
    expect(sfxVolume(at(4, 5))).toBeCloseTo(0.2, 10);
    expect(sfxVolume(at(0, 10))).toBe(0);
  });
});

describe('GDD-CTL-02 gamepad start on the settings screen', () => {
  it('GDD-CTL-02 start leaves the settings screen like Escape', () => {
    expect(settingsEvent('master', DEFAULT_SETTINGS, 'start')).toBe('back');
    expect(settingsEvent('effects', DEFAULT_SETTINGS, 'start')).toBe('back');
  });
});

describe('GDD-UI-02 language row', () => {
  it('Down from effects chooses language, Down again chooses back, Up from back chooses language', () => {
    expect(on('effects', DEFAULT_SETTINGS, 'menuDown').row).toBe('language');
    expect(on('language', DEFAULT_SETTINGS, 'menuDown').row).toBe('back');
    expect(on('back', DEFAULT_SETTINGS, 'menuUp').row).toBe('language');
  });

  it('Right on language goes en to es to de and stays at de', () => {
    let state = on('language', speaking('en'), 'menuRight');
    expect(state.settings.language).toBe('es');
    state = on('language', state.settings, 'menuRight');
    expect(state.settings.language).toBe('de');
    state = on('language', state.settings, 'menuRight');
    expect(state).toEqual({ row: 'language', settings: speaking('de') });
  });

  it('Left on language goes de to es to en and stays at en', () => {
    let state = on('language', speaking('de'), 'menuLeft');
    expect(state.settings.language).toBe('es');
    state = on('language', state.settings, 'menuLeft');
    expect(state.settings.language).toBe('en');
    state = on('language', state.settings, 'menuLeft');
    expect(state).toEqual({ row: 'language', settings: speaking('en') });
  });

  it('Left and Right on language leave the volumes alone', () => {
    expect(on('language', speaking('en', 4, 6), 'menuRight')).toEqual({ row: 'language', settings: speaking('es', 4, 6) });
    expect(on('language', speaking('es', 4, 6), 'menuLeft')).toEqual({ row: 'language', settings: speaking('en', 4, 6) });
  });

  it('Left and Right on a volume row leave the language alone', () => {
    expect(on('master', speaking('es', 5, 5), 'menuRight')).toEqual({ row: 'master', settings: speaking('es', 6, 5) });
    expect(on('effects', speaking('es', 5, 5), 'menuLeft')).toEqual({ row: 'effects', settings: speaking('es', 5, 4) });
    expect(on('master', speaking('de', 5, 5), 'menuLeft').settings.language).toBe('de');
    expect(on('effects', speaking('de', 5, 5), 'menuRight').settings.language).toBe('de');
  });

  it('pick on language does nothing', () => {
    expect(settingsEvent('language', speaking('es', 4, 6), 'pick')).toEqual({ row: 'language', settings: speaking('es', 4, 6) });
  });

  it("a tap on the language row's left half chooses it and goes to the language before", () => {
    expect(settingsEvent('master', speaking('de'), { ...TAP_OFF, settings: { row: 'language', side: 'left' } })).toEqual({ row: 'language', settings: speaking('es') });
    expect(settingsEvent('back', speaking('es'), { ...TAP_OFF, settings: { row: 'language', side: 'right' } })).toEqual({ row: 'language', settings: speaking('de') });
    expect(settingsEvent('master', speaking('es', 3, 8), { ...TAP_OFF, settings: { row: 'language', side: 'left' } })).toEqual({ row: 'language', settings: speaking('en', 3, 8) });
  });

  it('a tap on the language row at an end changes nothing', () => {
    expect(settingsEvent('master', speaking('en'), { ...TAP_OFF, settings: { row: 'language', side: 'left' } })).toEqual({ row: 'language', settings: speaking('en') });
    expect(settingsEvent('master', speaking('de'), { ...TAP_OFF, settings: { row: 'language', side: 'right' } })).toEqual({ row: 'language', settings: speaking('de') });
  });
});

describe('GDD-UI-02 the first language', () => {
  it('the first browser language that is en, es or de decides, by its main part in any case', () => {
    expect(browserLanguage(['fr-FR', 'de-AT'])).toBe('de');
    expect(browserLanguage(['ES'])).toBe('es');
    expect(browserLanguage(['es-MX', 'de'])).toBe('es');
    expect(browserLanguage(['en-GB', 'de'])).toBe('en');
    expect(browserLanguage(['de-de'])).toBe('de');
  });

  it('none of them, or none at all, gives English', () => {
    expect(browserLanguage([])).toBe('en');
    expect(browserLanguage(['fr', 'it'])).toBe('en');
    expect(browserLanguage([''])).toBe('en');
  });

  it('the main part must be exactly en, es or de', () => {
    expect(browserLanguage(['deu'])).toBe('en');
    expect(browserLanguage(['deu', 'es'])).toBe('es');
    expect(browserLanguage(['esperanto'])).toBe('en');
  });
});
