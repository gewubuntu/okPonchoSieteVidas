// Screenshots of the saved progress for visual review (GDD-PRG-02, GDD-WLD-04, GDD-UI-02). Run with `npm run shots`; images land in shots/
// (not committed). The save is seeded before the page loads, since the pictures show a second visit to 0-1: four hilos saved, the best
// medal bronze and a slow best time. The level is then played the device's way (L-045).
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { start, waitForResults } from '../helpers';

const shot = async (page: Page, info: TestInfo, name: string) => {
  await page.waitForTimeout(250); // let the frame render
  await page.screenshot({ path: `shots/${name}-${info.project.name.replace('shots-', '')}.png` });
};

/** The four hilos on the floor at the start of 0-1 (indexes 0 to 3) and a bronze clear in 3:00 are saved. */
const seedSecondVisit = (page: Page) =>
  page.addInitScript(
    ([key, text]) => localStorage.setItem(key!, text!),
    [
      'poncho-siete-vidas',
      JSON.stringify({
        version: 1,
        settings: { master: 10, effects: 10, language: 'en' },
        progress: { tutorialPlayed: true },
        levels: { '0-1': { hilos: `1111${'0'.repeat(46)}`, medal: 'bronze', bestSteps: 10800, cleared: true } },
      }),
    ],
  );

test('GDD-WLD-04 0-1 on a second visit (seeded save): the saved hilos faded at the start', async ({ page, isMobile }, info) => {
  await seedSecondVisit(page);
  await start(page, isMobile, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('playing');
  expect(await page.evaluate(() => window.__PONCHO__!.hilos())).toEqual({ taken: 4, total: 50, drawn: 46, faded: 4 });
  expect((await page.evaluate(() => window.__PONCHO__!.hudHilos())).text).toBe('4/50');
  await shot(page, info, 'progress-saved-hilos-faded-seeded-save');
});

test('GDD-UI-02 0-1 clear screen on a second visit (seeded save): the time line says New best!', async ({ page, isMobile }, info) => {
  await seedSecondVisit(page);
  await start(page, isMobile, '/?level=0-1');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  await page.evaluate(() => window.__PONCHO__!.pause(true));
  // Two seconds of play, then to the exit (the shortcut every clear-screen shot takes).
  await page.evaluate(() => window.__PONCHO__!.step(120));
  await page.evaluate(() => window.__PONCHO__!.teleport(1400, 224));
  await page.evaluate(() => window.__PONCHO__!.step(1));
  expect(await page.evaluate(() => window.__PONCHO__!.phase())).toBe('clear');
  await page.evaluate(() => window.__PONCHO__!.step(60));
  await waitForResults(page);
  const drawn = await page.evaluate(() => window.__PONCHO__!.clearDrawn());
  expect(drawn.hilos).toBe('Hilos 4/50');
  expect(drawn.time).toMatch(/^Time \d+:\d\d {2}New best!$/);
  expect(drawn.lines).toBe(3);
  await shot(page, info, 'progress-clear-new-best-seeded-save');
});
