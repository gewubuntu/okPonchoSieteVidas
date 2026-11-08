import { describe, expect, it } from 'vitest';
import { Grid } from '../raster.mjs';
import { drawIdle, drawRun, FRAME, SCALE } from '../poncho.mjs';
import { COLOURS } from '../poncho-pixels.mjs';
import { BOX, check, EYES, HAT_TILTS, LEGS, MOUTHS, ORIGIN, pose, POSE_FRAME, rotated, RUN, SQUASH_ROWS, STANDING, TAILS, WIDEN_COLS } from './rig.mjs';

/** Today's frame (FRAME x FRAME art px, 2 x 2 a drawing px) in the new frame: same feet, same body box centre. */
function placed(old) {
  const shiftX = (POSE_FRAME.w - FRAME / SCALE) / 2, shiftY = POSE_FRAME.h - FRAME / SCALE;
  return (x, y) => {
    const ox = x - shiftX, oy = y - shiftY;
    if (ox < 0 || oy < 0 || ox >= FRAME / SCALE || oy >= FRAME / SCALE) return null;
    const c = old.get(ox * SCALE, oy * SCALE);
    for (let j = 0; j < SCALE; j++) for (let i = 0; i < SCALE; i++) expect(old.get(ox * SCALE + i, oy * SCALE + j)).toBe(c);
    return c;
  };
}

function expectSame(grid, old) {
  const want = placed(old);
  expect(grid.width).toBe(POSE_FRAME.w);
  expect(grid.height).toBe(POSE_FRAME.h);
  const diffs = [];
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (grid.get(x, y) !== want(x, y)) diffs.push(`${x},${y}`);
  expect(diffs).toEqual([]);
}

const topRow = (g) => {
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) if (g.get(x, y)) return y;
  return -1;
};

describe('GDD-ART-02 the pose rig keeps the user\'s drawing', () => {
  it('GDD-ART-02 pose(STANDING) is today\'s standing frame, pixel for pixel, in the 96 x 96 frame', () => {
    expectSame(pose(STANDING), drawIdle());
    expectSame(pose(), drawIdle());
  });

  it('GDD-ART-04 the four run poses are today\'s run frames, pixel for pixel', () => {
    const today = drawRun();
    expect(RUN).toHaveLength(4);
    RUN.forEach((spec, i) => expectSame(pose(spec), today[i]));
  });

  it('GDD-ART-04 the body box is centred on the frame and stands on its bottom row, the feet with it', () => {
    expect((BOX.x0 + BOX.x1) / 2).toBe(POSE_FRAME.w / 2);
    expect([BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, BOX.y1]).toEqual([24, 64, 96]);
    for (const spec of [STANDING, ...RUN]) {
      const g = pose(spec);
      expect(Array.from({ length: g.width }, (_, x) => g.get(x, g.height - 1)).some((c) => c !== null)).toBe(true);
    }
  });
});

describe('GDD-ART-05 every pose the rig makes is clean', () => {
  const specs = [
    ...Object.keys(EYES).map((eyes) => ({ face: { eyes } })),
    ...Object.keys(MOUTHS).map((mouth) => ({ face: { mouth } })),
    ...['normal', 'blink', 'squeeze', 'wide', 'open', 'happy', 'glance'].map((face) => ({ face })),
    // The run legs meet the poncho's hem open in a pixel or two, as today's run frames do (checked equal above).
    ...Object.keys(LEGS).filter((legs) => !legs.startsWith('run')).map((legs) => ({ legs })),
    ...Object.keys(TAILS).map((tail) => ({ tail })),
    ...HAT_TILTS.map((tilt) => ({ hat: { tilt, dy: -2 } })),
    { hat: { dy: -18, tilt: -24 }, face: 'squeeze', tail: 'low', head: { dx: -1 } },
    { hat: { off: true } },
    { body: { squash: 4, widen: 2 }, legs: 'splay', hat: { dy: 1 } },
    { body: { squash: -4, widen: -1 }, legs: 'tuck', tail: 'back', y: -6 },
    { body: { squash: SQUASH_ROWS.length, widen: WIDEN_COLS.length } },
    { head: { dy: -2, dx: 1 }, body: { dy: 1 } },
    { paw: { x: 76, y: 70 } },
    { paw: { x: 80, y: 30 }, face: 'happy', tail: 'up' },
    { paw: { x: 84, y: 64, claws: true } },
    { paw: { x: 70, y: 62, from: [60, 74], front: true }, face: 'open' },
    { paw: { x: 64, y: 70, behind: true } },
  ];

  it('GDD-ART-05 only Poncho\'s colours, nothing on the frame\'s edge, the outline closed', () => {
    for (const spec of specs) expect(check(pose(spec)), JSON.stringify(spec)).toEqual([]);
  });

  it('GDD-ART-05 the respawn flip\'s turns are clean too', () => {
    const g = pose(STANDING);
    for (let deg = 45; deg < 360; deg += 45) expect(check(rotated(g, deg, { pivot: [48, 58] })), `${deg}`).toEqual([]);
  });

  it('GDD-ART-05 four quarter turns give the frame back', () => {
    let g = pose(STANDING);
    for (let i = 0; i < 4; i++) g = rotated(g, 90, { pivot: [48, 48] });
    expectSame(g, drawIdle());
  });
});

describe('GDD-ART-04 the rig\'s controls', () => {
  it('GDD-ART-04 a squash takes whole rows off him, a stretch adds them', () => {
    const top = topRow(pose(STANDING));
    expect(topRow(pose({ body: { squash: 3 } }))).toBe(top + 3);
    expect(topRow(pose({ body: { squash: -3 } }))).toBe(top - 3);
    expect(topRow(pose({ hat: { dy: -5 } }))).toBe(top - 5);
  });

  it('GDD-ART-04 a lifted hat shows his bare head, in his own fur', () => {
    const lifted = pose({ hat: { dy: -20 } });
    // Under where the brim sat on his head there is fur now, not the hat's colours.
    expect([COLOURS.f, COLOURS.F]).toContain(lifted.get(24 + 24, 25 + 18));
    expect(pose({ hat: { off: true } }).get(24 + 30, 25 + 2)).toBe(null);
  });

  it('GDD-ART-04 the hand anchor is the paw\'s middle, or in front of his chest', () => {
    expect(pose({ paw: { x: 76, y: 70 } }).hand).toEqual({ x: 76, y: 70 });
    const { hand, anchors } = pose(STANDING);
    expect(hand.x).toBeGreaterThan(BOX.x1);
    expect(hand.y).toBeGreaterThan(BOX.y0);
    expect(anchors.hand).toBe(hand);
    expect(pose({ head: { dy: 2 } }).anchors.mouth.y).toBe(anchors.mouth.y + 2);
  });

  it('GDD-ART-04 custom legs stand on the bottom row', () => {
    const g = pose({ legs: { rows: LEGS.splay.rows } });
    expect(Array.from({ length: g.width }, (_, x) => g.get(x, g.height - 1)).some((c) => c !== null)).toBe(true);
    expect(() => pose({ legs: 'hop' })).toThrow();
    expect(() => pose({ face: 'grin' })).toThrow();
  });
});

describe('GDD-ART-05 check() finds each kind of problem', () => {
  /** A clean 8 x 8 frame: a 2 x 2 blue square with its outline, clear of every edge. */
  const clean = () => {
    const g = new Grid(8, 8);
    for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) g.set(x, y, COLOURS['#']);
    for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) g.set(x, y, COLOURS.b);
    return g;
  };

  it('GDD-ART-05 a clean frame has no problems', () => {
    expect(check(clean())).toEqual([]);
  });

  it('GDD-ART-05 a colour outside the palette is reported', () => {
    const g = clean();
    g.set(3, 3, '#00FF00');
    expect(check(g)).toEqual(['colour #00FF00 at 3,3']);
  });

  it('GDD-ART-05 a gap in the outline is reported as an open outline', () => {
    const g = clean();
    g.set(5, 3, null);
    expect(check(g)).toEqual(['open outline at 4,3']);
  });

  it('GDD-ART-05 a pixel on the frame\'s left, top or right edge is reported, the bottom row is not', () => {
    for (const [x, y] of [[0, 4], [4, 0], [7, 4]]) {
      const g = clean();
      g.set(x, y, COLOURS['#']);
      expect(check(g), `${x},${y}`).toEqual([`edge at ${x},${y}`]);
    }
    const g = clean();
    g.set(4, 7, COLOURS['#']);
    expect(check(g)).toEqual([]);
  });
});

describe('GDD-ART-04 the rig turns, lifts, widens and places the right way', () => {
  it('GDD-ART-04 a quarter turn is clockwise: about the middle of a 10 x 10 grid, pixel (x, y) goes to (9 - y, x)', () => {
    const g = new Grid(10, 10);
    const marks = [[7, 4, '#111111'], [2, 1, '#222222'], [6, 8, '#333333']];
    for (const [x, y, c] of marks) g.set(x, y, c);
    const turned = rotated(g, 90, { pivot: [5, 5] });
    for (const [x, y, c] of marks) expect(turned.get(9 - y, x), c).toBe(c);
    const back = rotated(g, -90, { pivot: [5, 5] });
    for (const [x, y, c] of marks) expect(back.get(y, 9 - x), c).toBe(c);
  });

  it('GDD-ART-04 a hat tilt above 0 tips the front brim down and the back up, below 0 the other way', () => {
    // The highest painted row over the front of the brim (frame columns 76 to 80) and over its back (26 to 30).
    const top = (g, x0, x1) => {
      for (let y = 0; y < g.height; y++) for (let x = x0; x <= x1; x++) if (g.get(x, y)) return y;
      return -1;
    };
    const level = pose(STANDING), down = pose({ hat: { tilt: 16 } }), up = pose({ hat: { tilt: -16 } });
    expect(top(down, 76, 80)).toBeGreaterThan(top(level, 76, 80));
    expect(top(down, 26, 30)).toBeLessThan(top(level, 26, 30));
    expect(top(up, 76, 80)).toBeLessThan(top(level, 76, 80));
    expect(top(up, 26, 30)).toBeGreaterThan(top(level, 26, 30));
  });

  it('GDD-ART-04 the brim\'s shadow on his face is lit once the hat is lifted 5 px or off, unless lit is false', () => {
    // The drawing's pixel (39, 20), on his brow under the brim: dark fur in its shadow.
    const at = (g) => g.get(ORIGIN.x + 39, ORIGIN.y + 20);
    expect(at(pose(STANDING))).toBe(COLOURS.F);
    expect(at(pose({ hat: { dy: -4 } }))).toBe(COLOURS.F);
    expect(at(pose({ hat: { dy: -5 } }))).toBe(COLOURS.f);
    expect(at(pose({ hat: { off: true } }))).toBe(COLOURS.f);
    expect(at(pose({ hat: { dy: -5, lit: false } }))).toBe(COLOURS.F);
    expect(at(pose({ hat: { lit: true } }))).toBe(COLOURS.f);
  });

  it('GDD-ART-04 widen n doubles n columns of the poncho, a negative n takes them out', () => {
    // How wide the poncho is on the drawing's row 50.
    const width = (g) => {
      const xs = Array.from({ length: g.width }, (_, x) => x).filter((x) => g.get(x, ORIGIN.y + 50));
      return xs[xs.length - 1] - xs[0] + 1;
    };
    const w = width(pose(STANDING));
    expect(width(pose({ body: { widen: 1 } }))).toBe(w + 1);
    expect(width(pose({ body: { widen: 2 } }))).toBe(w + 2);
    expect(width(pose({ body: { widen: -1 } }))).toBe(w - 1);
  });

  it('GDD-ART-04 a paw behind is hidden by the poncho, a paw in front covers it', () => {
    // A paw put over the poncho's blue at frame px (52, 70).
    expect(pose(STANDING).get(52, 70)).toBe(COLOURS.b);
    expect(pose({ paw: { x: 52, y: 70 } }).get(52, 70)).toBe(COLOURS.w);
    expect(pose({ paw: { x: 52, y: 70, behind: true } }).get(52, 70)).toBe(COLOURS.b);
  });

  it('GDD-ART-04 the hand nudge moves the hand anchor by whole px', () => {
    const { hand } = pose(STANDING);
    expect(pose({ hand: { dx: 2, dy: -3 } }).hand).toEqual({ x: hand.x + 2, y: hand.y - 3 });
    expect(pose({ paw: { x: 76, y: 70 }, hand: { dx: -1 } }).hand).toEqual({ x: 75, y: 70 });
  });
});
