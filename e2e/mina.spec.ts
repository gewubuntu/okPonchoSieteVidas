// GDD-ART-06: a World 3 level whose place is the mine is drawn in the mine's look, played in the test level lab-3m. Where things are
// comes from `src/levels/lab3m.ts` (L-062).
import { expect, test } from '@playwright/test';
import { TILE } from '../src/config/tuning';
import { LAB_3M_FLOOR_ROW, LAB_3M_PIT } from '../src/levels/lab3m';
import { MINE_DEEP_FRAME, MINE_UNDERSIDE_FRAME, TOP_FRAME } from '../src/ui/groundTiles';
import { start } from './helpers';

test('GDD-ART-06 the mine lab is drawn in the mine: its backdrop and the mine rock, underside and deep', async ({ page, isMobile }) => {
  await start(page, isMobile, '/?level=lab-3m');
  await page.waitForFunction(() => window.__PONCHO__!.ticks() > 10);
  const seen = await page.evaluate(
    ([pit, floor]) => {
      const d = window.__PONCHO__!;
      d.pause(true);
      d.step(5);
      return {
        scenery: d.scenery(),
        layout: d.backdropLayout(),
        // The roof's last row over the gallery, the rock two rows over it, and the floor's top beside the pit.
        underside: d.groundFrame(pit!, 4),
        deep: d.groundFrame(pit!, 2),
        top: d.groundFrame(pit! - 1, floor!),
      };
    },
    [LAB_3M_PIT.col0, LAB_3M_FLOOR_ROW],
  );
  expect(seen.scenery).toEqual({ set: 'sierra', midKey: 'sierra:mid-mina', place: 'mina' });
  // The mine's bands: the old workings from y 40, the timbering from 100, its foot from 200.
  expect([seen.layout.mountainsY, seen.layout.desertY, seen.layout.footY]).toEqual([40, 100, 200]);
  expect([MINE_UNDERSIDE_FRAME, MINE_UNDERSIDE_FRAME + 1]).toContain(seen.underside);
  expect([MINE_DEEP_FRAME, MINE_DEEP_FRAME + 1]).toContain(seen.deep);
  expect([TOP_FRAME, TOP_FRAME + 1]).toContain(seen.top);
  expect(LAB_3M_FLOOR_ROW * TILE).toBe(208);
});
