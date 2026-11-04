import { describe, expect, it } from 'vitest';
import { AWNING, TILE } from '../config/tuning';
import { enemyBox, feetOf, kindOf } from '../sim/enemy';
import { touchesHilo } from '../sim/hilo';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import type { LevelEntry } from './index';
import { LEVEL_2_1, LEVEL_2_1_AWNINGS, LEVEL_2_1_CORDELES, LEVEL_2_1_ROWS } from './level2-1';
import { parseTiles } from '../sim/tilemap';
import { gaps, openGaps, validateLevel } from './validate';

const level = LEVEL_2_1;
const world = level.world;
const awnings = LEVEL_2_1_AWNINGS;
const cordeles = LEVEL_2_1_CORDELES;
/** The entry 2-1 has in `LEVELS` (GDD-WLD-12): World 2's rules (GDD-WLD-03, GDD-TEC-04). */
const ENTRY: LevelEntry = { id: '2-1', world: 2, test: false, level, next: '2-2' };
const mid = (col: number) => col * TILE + TILE / 2;
const quiet: Level = { ...level, enemies: [] };
const idle: PlayerInput = { move: 0, jumpHeld: false };
const standing = (x: number, y: number) => ({ ...spawn(x, y), grounded: true });
/** A run of `lv` with Poncho standing at (x, y). */
const at = (lv: Level, x: number, y: number): RunState => ({ ...startRun(lv), player: standing(x, y) });
/** 2-1 with only its enemy `i` (by its place in the list). */
const only = (i: number): Level => ({ ...level, enemies: [level.enemies[i]!] });
/** 2-1 with the pit one column wider (its far floor from column 175), for the comparison that sets its width. */
const widerPit = (): Level => ({
  ...quiet,
  world: parseTiles(LEVEL_2_1_ROWS.map((row, i) => (i >= 14 ? row.slice(0, 174) + '.' + row.slice(175) : row))),
});
/** Runs right from the pit Paloma's pen, presses jump once past `take` and holds it: does he reach the floor past the pit? */
function cross(lv: Level, take: number): boolean {
  let s = at(lv, 2602, 224);
  let k = -1;
  for (let i = 0; i < 200 && s.phase === 'playing'; i++) {
    if (k < 0 && s.player.x > take) k = i;
    s = stepRun(s, { move: 1, jumpHeld: k >= 0 }, lv);
    if (s.player.grounded && s.player.y === 224 && s.player.x > 2760) return true;
  }
  return false;
}
const hiloKeys = (r: RunState) => level.hilos!.flatMap((h, i) => (r.hilosTaken[i] ? [`${h.col},${h.row}`] : []));

/** The awnings by their place in the list: the first, the ladder, the alley, the rung's two, the pit's and the last stall. */
const A1 = awnings[0]!;
const LADDER = awnings[4]!;
const ALLEY = awnings[5]!;
const TAKEOFF = awnings[6]!;
const LANDING = awnings[7]!;
const PIT = awnings[8]!;
const LAST = awnings[11]!;
/** Rooftop tops (GDD-WLD-12): the first three rooftops, then the cordel staircase's tall rooftop and the exit's. */
const ROOF = 112;
const TALL = 80;
/** The Palomas by their place in the enemy list: the first, the rooftop's, the drop's, the rung's and the pit's. */
const DROP = 3;
const RUNG = 4;
const EDGE = 5;

/**
 * Holds jump with `move` from standing at (x, y) on an awning, after a step with jump up (L-048). It lets go once the chain reaches
 * `upTo` and Poncho is falling, so the next landing is plain. It returns every rebound (tier and the highest point of the feet before
 * it, the rise of the one before), the y of each landing on a level tile, and the run.
 */
function climb(lv: Level, x: number, y: number, move: number, steps: number, upTo = 3) {
  let r = at(lv, x, y);
  r = stepRun(r, idle, lv);
  const bounces: { tier: number; peakBefore: number }[] = [];
  const landings: { x: number; y: number }[] = [];
  let peak = Infinity;
  let held = true;
  for (let i = 0; i < steps; i++) {
    if ((r.player.awningChain ?? 0) >= upTo && r.player.vy > 0) held = false;
    const before = r;
    r = stepRun(r, { move, jumpHeld: held }, lv);
    peak = Math.min(peak, r.player.y);
    if (r.awningBounce !== before.awningBounce) {
      bounces.push({ tier: r.awningBounce!.tier, peakBefore: peak });
      peak = Infinity;
    }
    if (r.player.grounded && !before.player.grounded && !awnings.some((a) => a.y === r.player.y)) landings.push({ x: r.player.x, y: r.player.y });
  }
  return { r, bounces, landings, peak };
}

/**
 * The rung beat played from the second ofrenda (GDD-WLD-12), after `wait` idle steps (the rung Paloma walking its pen): Poncho runs
 * right, presses jump once past x 2040 and holds it, so he lands on the take-off awning held and its tier 1 rebound carries him into the
 * pen. Held through a stomp (`holdThroughStomp`), or let go from the stomp on. Once he has landed in the pen he plays it on the ground:
 * a live Paloma ahead of him, walking or telegraphing, he stops for and claws when the claw reaches it; otherwise he walks on, and from
 * beside the crate under the landing awning, jump up for a step (L-048), he jumps and holds it. On a rooftop he lets go. It returns
 * each rebound (awning index and tier), the step of the stomp if any, the first landing on a level tile (its y), the lives lost, and
 * the run.
 */
function rung(lv: Level, wait: number, holdThroughStomp = true) {
  let r = at(lv, mid(126), 224);
  for (let i = 0; i < wait; i++) r = stepRun(r, idle, lv);
  const bounces: [number, number][] = [];
  let stomp = -1;
  let landed: number | null = null;
  let k = -1;
  let jumpBefore = false;
  let clawBefore = false;
  for (let i = 0; i < 300 && r.phase === 'playing' && !(r.player.grounded && r.player.y === ROOF); i++) {
    if (k < 0 && r.player.x > 2040) k = i;
    let move = 1;
    let jump = k >= 0 && (holdThroughStomp || stomp < 0);
    let claw = false;
    if (landed === 224) {
      const e = lv.enemies[0];
      const s = r.enemies[0];
      const front = r.player.x + 6;
      if (e && s?.alive && s.x > r.player.x && (s.wing!.phase === 'walk' || s.wing!.phase === 'telegraph')) {
        const box = enemyBox(e, s);
        move = front + 20 > box.x0 ? 0 : 1;
        claw = front < box.x1 && front + 20 > box.x0;
      }
      jump = r.player.grounded ? move === 1 && !jumpBefore && front >= LANDING.x - 14 : jumpBefore;
    }
    const input: PlayerInput = { move, jumpHeld: jump, claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    const before = r;
    r = stepRun(r, input, lv);
    if (r.awningBounce !== before.awningBounce) bounces.push([r.awningBounce!.awning, r.awningBounce!.tier]);
    if (r.stomped && stomp < 0) stomp = i + 1;
    if (landed === null && r.player.grounded && !before.player.grounded && !awnings.some((a) => a.y === r.player.y && r.player.x + 6 > a.x && r.player.x - 6 < a.x + a.w)) landed = r.player.y;
  }
  return { r, bounces, stomp, landed, lost: 7 - r.lives.lives };
}

describe('GDD-WLD-12 level 2-1', () => {
  it('GDD-WLD-12 2-1 is 240 by 17 tiles and passes the validator with World 2 rules', () => {
    expect(world.width).toBe(240);
    expect(world.height).toBe(17);
    expect(validateLevel(ENTRY)).toEqual([]);
    expect(level.abilities).toBeUndefined();
  });

  it('GDD-WLD-12 2-1 starts at column 3 on the floor, and the exit stands at column 234 on the last rooftop', () => {
    expect(level.spawn).toEqual({ x: 56, y: 224 });
    expect(level.exit).toEqual({ x: 3752, y: TALL });
    expect(world.solidTile(234, 5)).toBe(true);
    expect(world.solidTile(234, 4)).toBe(false);
  });

  it('GDD-WLD-03 2-1 ofrendas stand on the floor at columns 60, 126 and 205, about 25 55 and 85 percent', () => {
    expect(level.ofrendas.map((o) => [o.id, o.x, o.y])).toEqual([
      ['2-1-1', 968, 224],
      ['2-1-2', 2024, 224],
      ['2-1-3', 3288, 224],
    ]);
    [0.25, 0.55, 0.85].forEach((share, i) => expect(Math.abs(level.ofrendas[i]!.x / 3840 - share), `ofrenda ${i + 1}`).toBeLessThan(0.03));
    for (const o of level.ofrendas) {
      const col = Math.floor(o.x / TILE);
      expect(world.solidTile(col, o.y / TILE), o.id).toBe(true);
      expect(world.solidTile(col, o.y / TILE - 1) || world.solidTile(col, o.y / TILE - 2), o.id).toBe(false);
    }
  });

  it('GDD-WLD-03 2-1 has a 3-tile gap and an 8-tile pit that the pit awning leaves open 3 tiles before it and 2 after', () => {
    expect(gaps(world)).toEqual([
      { col: 22, width: 3 },
      { col: 166, width: 8 },
    ]);
    expect(openGaps(level)).toEqual([
      { col: 22, width: 3 },
      { col: 166, width: 3 },
      { col: 172, width: 2 },
    ]);
    // Without the pit awning the pit is one 8-tile gap, past World 2's 4 (GDD-WLD-03).
    const bare: LevelEntry = { ...ENTRY, level: { ...level, awnings: awnings.filter((a) => a !== PIT) } };
    expect(validateLevel(bare)).toEqual(['gap of 8 tiles at columns 166 to 173, World 2 allows 4']);
  });

  it('GDD-WLD-12 2-1 has the crates, rooftops and chimney of its layout and no other solid tile above the floor', () => {
    const expected = new Set<string>();
    const add = (c0: number, c1: number, r0: number, r1: number) => {
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) expected.add(`${c},${r}`);
    };
    add(10, 10, 13, 13); // the Alacrán's crates, 1 tile
    add(18, 18, 13, 13);
    add(48, 48, 12, 13); // the first Paloma's crates, 2 tiles
    add(57, 57, 12, 13);
    add(82, 91, 7, 13); // the first rooftop, top y = 112
    add(86, 86, 5, 6); // its chimney, 2 tiles
    add(98, 110, 7, 13); // the second rooftop, top y = 112
    add(119, 119, 12, 13); // the crate that pens the drop Paloma under the second rooftop, 2 tiles
    add(133, 133, 12, 13); // the rung pen's crates: 2 tiles, then 1 under the landing awning
    add(139, 139, 13, 13);
    add(142, 153, 7, 13); // the third rooftop, top y = 112
    add(161, 161, 12, 13); // the pit Paloma's crate, 2 tiles
    add(192, 201, 5, 13); // the tall rooftop, top y = 80
    add(229, 239, 5, 13); // the exit's rooftop, top y = 80
    const found = new Set<string>();
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 14; r++) if (world.solidTile(c, r)) found.add(`${c},${r}`);
    expect(found).toEqual(expected);
    for (let c = 0; c < world.width; c++) for (let r = 14; r < 17; r++) expect(world.solidTile(c, r), `${c},${r}`).toBe(!(c >= 22 && c <= 24) && !(c >= 166 && c <= 173));
    for (let c = 0; c < world.width; c++) for (let r = 0; r < 17; r++) expect(world.slopeAt(c, r), `${c},${r}`).toBeNull();
  });

  it('GDD-WLD-12 2-1 piñata and veladora', () => {
    expect(level.pinatas).toEqual([{ col: 34, row: 5 }]);
    expect(level.veladora).toEqual({ col: 170, row: 3 });
    for (const empty of ['spikes', 'crumbles', 'springs', 'platforms', 'tacos', 'doors', 'keys', 'fragiles'] as const) expect(level[empty], empty).toEqual([]);
    expect(level.blocks).toBeUndefined();
    expect(level.rollos).toBeUndefined();
  });

  it('GDD-WLD-10 2-1 awnings: twelve, 2 to 6 tiles wide, tops at multiples of 8 no higher than y 160, each 1 tile clear of a level tile at its height', () => {
    expect(awnings.map((a) => [a.x / TILE, a.w / TILE, a.y, a.torn ?? false])).toEqual([
      [31, 4, 192, false],
      [64, 3, 192, false],
      [69, 3, 192, false],
      [74, 3, 192, false],
      [79, 3, 192, false],
      [93, 5, 176, false],
      [129, 3, 192, false],
      [139, 3, 192, false],
      [169, 3, 208, false],
      [216, 3, 192, false],
      [221, 3, 192, false],
      [226, 3, 192, false],
    ]);
    for (const a of awnings) {
      const where = `awning at ${a.x / TILE}`;
      expect(a.w / TILE, where).toBeGreaterThanOrEqual(2);
      expect(a.w / TILE, where).toBeLessThanOrEqual(6);
      expect(a.y % 8, where).toBe(0);
      expect(a.y, where).toBeGreaterThanOrEqual(AWNING.minTopY);
      // A level tile whose top is at the awning's height (solid in the awning's row, open above) in the column beside either end.
      const row = a.y / TILE;
      for (const col of [a.x / TILE - 1, (a.x + a.w) / TILE]) expect(world.solidTile(col, row) && !world.solidTile(col, row - 1), `${where}, column ${col}`).toBe(false);
    }
    // The ladder awning, the alley awning, the rung's landing awning and the last stall stand against a rooftop's wall.
    for (const a of [LADDER, ALLEY, LANDING, LAST]) expect(world.solidTile((a.x + a.w) / TILE, a.y / TILE - 1)).toBe(true);
    // The landing awning is over the rung pen's 1-tile crate, 16 px of air between them.
    expect(world.solidTile(139, 13) && !world.solidTile(139, 12)).toBe(true);
  });

  it('GDD-WLD-11 2-1 cordeles: a staircase 48 px apart over the floor, sharing one column, with no awning under or near them', () => {
    expect(cordeles.map((c) => [c.x / TILE, c.w / TILE, c.y])).toEqual([
      [184, 4, 176],
      [187, 4, 128],
    ]);
    expect(cordeles[0]!.y - cordeles[1]!.y).toBe(48);
    expect(cordeles[0]!.x + cordeles[0]!.w - cordeles[1]!.x).toBe(TILE);
    for (const c of cordeles) {
      for (let col = c.x / TILE; col < (c.x + c.w) / TILE; col++) expect(world.solidTile(col, 14), `floor under ${col}`).toBe(true);
      expect(awnings.some((a) => a.x < c.x + c.w + 2 * TILE && a.x + a.w > c.x - 2 * TILE)).toBe(false);
    }
  });

  it('GDD-ENM-03 2-1 has one Alacrán and five Palomas where the layout puts them, none on an awning', () => {
    expect(level.enemies.map((e) => [kindOf(e), e.x, e.y])).toEqual([
      ['alacran', mid(14), 224],
      ['paloma', mid(52), 224],
      ['paloma', mid(89), ROOF],
      ['paloma', mid(115), 224],
      ['paloma', mid(136), 224],
      ['paloma', mid(164), 224],
    ]);
    for (const e of level.enemies) expect(awnings.some((a) => a.y === e.y && e.x > a.x && e.x < a.x + a.w)).toBe(false);
  });

  it('GDD-ENM-03 GDD-WLD-10 2-1 each walker keeps to its pen and never walks under or across an awning', () => {
    // Each alone, Poncho idle at the start: [index, min x, max x].
    for (const [index, x0, x1] of [[0, 183, 281], [1, 791, 905], [2, 1399, 1465], [DROP, 1783, 1897], [RUNG, 2151, 2217], [EDGE, 2599, 2649]] as const) {
      const e = level.enemies[index]!;
      const lv: Level = { ...level, enemies: [e] };
      let r = startRun(lv);
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < 4000; i++) {
        r = stepRun(r, idle, lv);
        const box = enemyBox(e, r.enemies[0]!);
        // The rung Paloma turns at the crate under the landing awning, its box's right side at the awning's left end (to within the
        // walk's rounding, 1e-6 px): touching its end is not under it.
        expect(awnings.some((a) => box.x0 < a.x + a.w - 1e-6 && box.x1 > a.x + 1e-6), `enemy ${index}, step ${i}`).toBe(false);
        expect(feetOf(e, r.enemies[0]!), `enemy ${index}`).toBe(e.y);
        lo = Math.min(lo, r.enemies[0]!.x);
        hi = Math.max(hi, r.enemies[0]!.x);
      }
      expect([lo, hi].map((v) => Math.round(v)), `enemy ${index}`).toEqual([x0, x1]);
    }
  });

  it('GDD-ENM-01 2-1 no Paloma is startled by Poncho standing at the start or at an ofrenda', () => {
    for (const p of [level.spawn, ...level.ofrendas]) {
      let r = at(level, p.x, p.y);
      for (let i = 0; i < 600; i++) {
        r = stepRun(r, idle, level);
        expect(r.enemies.slice(1).map((e) => e.wing!.phase), `at ${p.x}, step ${i}`).toEqual(['walk', 'walk', 'walk', 'walk', 'walk']);
      }
    }
  });

  it('GDD-WLD-04 2-1 has 50 hilos, each in an empty tile below the HUD rows, none in the piñata or the veladora', () => {
    const hilos = level.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(world.solidTile(h.col, h.row), where).toBe(false);
      expect(h.row, where).toBeGreaterThanOrEqual(3);
      expect([...level.pinatas, level.veladora!].some((t) => t.col === h.col && t.row === h.row), where).toBe(false);
    }
  });

  it('GDD-WLD-04 2-1 no hilo is touched by Poncho standing at the start or at an ofrenda', () => {
    for (const p of [level.spawn, ...level.ofrendas]) for (const h of level.hilos!) expect(touchesHilo(spawn(p.x, p.y), h), `${p.x}: ${h.col},${h.row}`).toBe(false);
  });
});

/**
 * The bot. It holds right. On the ground (a tile or a cordel), after letting go of jump for a step (L-048), it jumps (held 20 steps) at
 * a wall in the row above its feet within 14 px of its front, a pit column within 10 px, a live Alacrán on its level within 40 px, an
 * awning starting within 24 px ahead and up to 48 px above its feet, and a cordel 40 to 52 px above it while under its span. Standing on
 * a settled awning it presses jump. In the air it holds jump over an awning and while it rises from a rebound, so every landing on an
 * awning is held and the chain climbs (GDD-WLD-10). A Paloma on its level ahead (GDD-ENM-03): behind a wall (a crate or a chimney) it
 * waits out of the Paloma's sight until the Paloma is at least 56 px past the wall, then jumps the wall; on open ground it walks up,
 * stops and claws it when the claw's reach overlaps it (in its walk or its telegraph), and backs off from under it while it flies. At a
 * rooftop's edge with a live Paloma on the floor below within 64 px ahead, it waits there, out of its sight, until the Paloma is at
 * least 64 px from the edge, so it lands clear of it.
 */
function bot(lv: Level, maxSteps: number, wait = 0): { run: RunState; steps: number; lost: number; clawed: number } {
  let run = startRun(lv);
  for (let i = 0; i < wait; i++) run = stepRun(run, idle, lv);
  let hold = 0;
  let jumpBefore = false;
  let clawBefore = false;
  let steps = 0;
  let lost = 0;
  let clawed = 0;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const p = run.player;
    const { x, y, grounded } = p;
    const front = x + 6;
    let move = 1;
    let jump = false;
    let claw = false;
    let waitForPaloma = false;
    if (run.phase === 'playing') {
      const onAwning = grounded && awnings.some((a, i) => !run.awningsGone[i] && Math.abs(y - a.y) < 1e-6 && x + 6 > a.x && x - 6 < a.x + a.w);
      lv.enemies.forEach((e, i) => {
        const s = run.enemies[i]!;
        if (!s.alive || kindOf(e) !== 'paloma') return;
        const dx = s.x - x;
        // At a ledge's edge over a Paloma's floor: wait until it is far enough from the drop.
        const edge = grounded && !world.solidTile(Math.floor((front + 2) / TILE), Math.floor(y / TILE));
        if (edge && feetOf(e, s) - y >= 64 && dx > -20 && dx < 64 + 40) {
          waitForPaloma = true;
          move = s.x - (Math.floor((front + 2) / TILE) * TILE) < 64 ? 0 : 1;
          return;
        }
        if (!grounded || Math.abs(feetOf(e, s) - y) > 4 || dx < -20 || dx > 140) return;
        const row = Math.floor((y - 1) / TILE);
        let wallRight = -1;
        for (let c = Math.floor(front / TILE); c <= Math.floor((s.x - 7) / TILE); c++) if (world.solidTile(c, row)) wallRight = (c + 1) * TILE;
        const flying = s.wing!.phase !== 'walk' && s.wing!.phase !== 'telegraph';
        if (wallRight >= 0) {
          if (!flying && s.x - wallRight >= 56) return;
          waitForPaloma = true;
          move = dx < 60 ? -1 : dx < 70 ? 0 : 1;
          return;
        }
        waitForPaloma = true;
        if (flying) {
          move = Math.abs(dx) < 28 ? (dx > 0 ? -1 : 1) : 0;
          return;
        }
        const box = enemyBox(e, s);
        if (front < box.x1 && front + 20 > box.x0) {
          move = 0;
          claw = true;
        }
      });
      if (!grounded) {
        const over = awnings.some((a, i) => !run.awningsGone[i] && a.y >= y - 1 && x + 14 > a.x && x - 14 < a.x + a.w);
        jump = over || ((p.awningChain ?? 0) > 0 && p.vy < 0) || hold > 0;
      } else if (onAwning) {
        jump = !jumpBefore;
      } else if (hold === 0 && !jumpBefore && !waitForPaloma) {
        const feetRow = Math.floor((y - 1) / TILE);
        let go = false;
        for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow)) go = true;
        for (let d = 0; d <= 10; d++) if (!world.solidTile(Math.floor((front + d) / TILE), world.height - 1)) go = true;
        lv.enemies.forEach((e, i) => {
          const s = run.enemies[i]!;
          if (kindOf(e) === 'alacran' && s.alive && Math.abs(feetOf(e, s) - y) < 4 && s.x - x >= 0 && s.x - x <= 40) go = true;
        });
        for (const a of awnings) if (a.x - front >= 0 && a.x - front <= 24 && y - a.y > 0 && y - a.y <= 48) go = true;
        for (const c of cordeles) if (y - c.y >= 40 && y - c.y <= 52 && x - 6 > c.x + 2 && x + 6 < c.x + c.w) go = true;
        if (go) hold = 20;
        jump = hold > 0;
      } else jump = hold > 0;
    }
    const input: PlayerInput = { move, jumpHeld: jump, claw: claw && !clawBefore };
    jumpBefore = input.jumpHeld;
    clawBefore = input.claw === true;
    if (input.claw) clawed++;
    if (hold > 0) hold--;
    const before = run.lives.lives;
    run = stepRun(run, input, lv);
    if (run.lives.lives < before) lost++;
    steps++;
  }
  return { run, steps, lost, clawed };
}

describe('GDD-WLD-12 playing 2-1', () => {
  it('GDD-WLD-12 2-1 Ki: a jump from the floor lands on the first awning and settles there after one small hop', () => {
    let r = at(quiet, 504, 224);
    const tiers: number[] = [];
    let settled = -1;
    for (let i = 0; i < 90 && settled < 0; i++) {
      const before = r.awningBounce;
      r = stepRun(r, { move: 0, jumpHeld: i < 20 }, quiet);
      if (r.awningBounce !== before) tiers.push(r.awningBounce!.tier);
      if (i > 5 && r.player.grounded && r.player.y === A1.y) settled = i + 1;
    }
    expect(tiers).toEqual([0]); // one plain rebound, no held one
    expect(settled).toBe(43);
    expect(r.player.awningChain ?? 0).toBe(0);
  });

  it('GDD-WLD-12 2-1 Ki: holding jump on the first awning climbs the ladder, and its column of hilos gives one hilo per beat', () => {
    // Standing in its column (32), hold jump: the jump, then tiers 1, 2 and 3. Each rise reaches one more hilo of the column, never the next.
    let r = at(quiet, mid(32), A1.y);
    r = stepRun(r, idle, quiet);
    const column = ['32,6', '32,5', '32,4', '32,3'];
    const got: string[][] = [];
    const speeds: number[] = [];
    const peaks: number[] = [];
    let peak = Infinity;
    for (let i = 0; i < 200; i++) {
      const before = r.awningBounce;
      r = stepRun(r, { move: 0, jumpHeld: true }, quiet);
      peak = Math.min(peak, r.player.y);
      if (r.awningBounce !== before) {
        speeds.push(r.player.vy);
        peaks.push(Math.round((A1.y - peak) * 10) / 10);
        got.push(hiloKeys(r).filter((k) => column.includes(k)));
        peak = Infinity;
      }
    }
    expect(speeds).toEqual([-480, -540, -600, -600]);
    expect(peaks.slice(0, 4)).toEqual([56.4, 77.1, 97.3, 120.2]); // the jump and tiers 1 to 3, feet above the awning
    expect(got.slice(0, 4)).toEqual([column.slice(0, 1), column.slice(0, 2), column.slice(0, 3), column]);
    expect(r.pinatasOpen).toEqual([false]); // the column is two tiles clear of the piñata
  });

  it('GDD-PWR-05 GDD-WLD-10 2-1 Ki: a first tier rebound opens the piñata over the first awning and a jump does not, and the taco falls clear of the awning', () => {
    // A jump from the awning under the piñata, let go before the landing: it settles, the piñata shut.
    let r = at(quiet, mid(34), A1.y);
    for (let i = 0; i < 90; i++) r = stepRun(r, { move: 0, jumpHeld: i >= 1 && i < 30 }, quiet);
    expect(r.pinatasOpen).toEqual([false]);
    expect(r.player.y).toBe(A1.y);
    // Held: the first tier rebound bumps it open, and the taco walks off its right side, past the awning's end, down to the floor.
    r = at(quiet, mid(34), A1.y);
    let opened = -1;
    let floor = -1;
    for (let i = 0; i < 200; i++) {
      r = stepRun(r, { move: 0, jumpHeld: i >= 1 && i < 60 }, quiet);
      if (opened < 0 && r.pinatasOpen[0]) opened = i + 1;
      const taco = r.items[0];
      if (taco) {
        expect(taco.x - 6 >= A1.x + A1.w || taco.y <= 80, `taco at ${taco.x},${taco.y}`).toBe(true);
        if (floor < 0 && taco.y === 224) floor = i + 1;
      }
    }
    expect(opened).toBe(47);
    expect(floor).toBeGreaterThan(opened);
    expect(r.items.map((i) => i.kind)).toEqual(['taco']);
  });

  it('GDD-WLD-12 2-1 Sho: the ladder awning and the rung landing awning are the only ways onto the first and third rooftops, and only a second tier reaches them', () => {
    // From anywhere on either, holding right: tier 1 peaks 2.9 px under the rooftop and he falls back; tier 2 lands on it.
    for (const a of [LADDER, LANDING]) {
      for (let x = a.x + 6; x <= a.x + a.w - 6; x += 6) {
        const where = `awning at ${a.x / TILE}, x ${x}`;
        const one = climb(quiet, x, a.y, 1, 240, 1);
        expect(one.bounces.map((b) => b.tier), where).toEqual([1, 0]);
        expect(Math.round((one.bounces[1]!.peakBefore - ROOF) * 10) / 10, where).toBe(2.9);
        expect(one.r.player.y, where).toBe(a.y);
        const two = climb(quiet, x, a.y, 1, 240);
        expect(two.bounces.map((b) => b.tier), where).toEqual([1, 2]);
        expect(two.landings[0], where).toMatchObject({ y: ROOF });
      }
    }
    // No jump from the floor before either rooftop reaches it, not even beside its wall: each wall is 7 tiles.
    for (const col of [82, 142]) for (let row = 7; row <= 13; row++) expect(world.solidTile(col, row)).toBe(true);
  });

  it('GDD-WLD-12 2-1 Sho: holding jump and right from the floor, the stall row climbs tiers 1 2 and 3 and the ladder awning carries him onto the first rooftop', () => {
    // From the floor past the first ofrenda: onto the three stalls in turn, a fourth rebound off the ladder awning against the
    // rooftop's wall (the chain stays at 3), and down on the rooftop.
    let r = at(quiet, 1015, 224);
    const seen: [number, number][] = [];
    let roof = -1;
    for (let i = 0; i < 300 && roof < 0; i++) {
      const before = r.awningBounce;
      r = stepRun(r, { move: 1, jumpHeld: true }, quiet);
      if (r.awningBounce !== before) seen.push([r.awningBounce!.awning, r.awningBounce!.tier]);
      if (r.player.grounded && r.player.y === ROOF) roof = i + 1;
    }
    expect(seen).toEqual([[1, 1], [2, 2], [3, 3], [4, 3]]);
    expect(roof).toBe(203);
  });

  it('GDD-WLD-12 2-1 Sho: walking off the first rooftop lands on the alley awning, a jump from the alley floor does too, and a first tier from it lands on the second rooftop', () => {
    // Walking off the rooftop's right end, holding right, not jump: a plain landing on the alley awning.
    let r = at(quiet, 1450, ROOF);
    let onAlley = false;
    for (let i = 0; i < 60; i++) {
      r = stepRun(r, { move: 1, jumpHeld: false }, quiet);
      onAlley ||= r.awningBounce?.awning === 5 || (r.player.grounded && r.player.y === ALLEY.y);
    }
    expect(onAlley).toBe(true);
    // From the alley floor (column 92), a jump held right lands on it.
    r = at(quiet, mid(92), 224);
    let landed = false;
    for (let i = 0; i < 60 && !landed; i++) {
      const before = r.awningBounce;
      r = stepRun(r, { move: 1, jumpHeld: i < 20 }, quiet);
      landed = r.awningBounce !== before || (r.player.grounded && r.player.y === ALLEY.y);
    }
    expect(landed).toBe(true);
    // Standing on it, a jump held right: tier 1 carries him over the second rooftop's wall; a jump let go before landing does not.
    const held = climb(quiet, 1580, ALLEY.y, 1, 120);
    expect(held.landings[0]).toMatchObject({ y: ROOF });
    const once = climb(quiet, 1580, ALLEY.y, 1, 120, 0);
    expect(once.landings).toEqual([]);
  });

  it('GDD-ENM-03 2-1 Sho: the drop Paloma never sees Poncho on the second rooftop, and walking off the edge when it is under him stomps it', () => {
    const lv = only(DROP);
    // Standing anywhere on the rooftop's right part, it walks on: he is 112 px above it.
    for (let x = 1680; x <= 1770; x += 15) {
      let r = at(lv, x, ROOF);
      for (let i = 0; i < 700; i++) {
        r = stepRun(r, idle, lv);
        expect(r.enemies[0]!.wing!.phase, `x ${x}, step ${i}`).toBe('walk');
      }
    }
    // Waiting at the edge (x 1770) for 0 to 71 waits of 10 steps (11.8 s, more than its round of the pen, 11.4 s), then walking off
    // holding right with jump up, he lands 55 px out from the wall (x 1831). Each wait gives where the Paloma was as he stepped off,
    // which way it walked, and what the landing was: on it (a stomp), against its side (a hit, as a stomp just missed), or beside it,
    // where it is telegraphing or too far to see him.
    const outcome = (wait: number) => {
      let r = at(lv, 1770, ROOF);
      for (let i = 0; i < wait; i++) r = stepRun(r, idle, lv);
      const { x, dir } = r.enemies[0]!;
      let i = 0;
      for (; i < 60 && r.player.y < 224 && !r.stomped && r.lives.lives === 7; i++) r = stepRun(r, { move: 1, jumpHeld: false }, lv);
      const kind = r.stomped ? 'stomp' : r.lives.lives < 7 ? 'hit' : 'beside';
      return { at: [Math.round(x), dir], kind, steps: i, phase: r.enemies[0]!.wing!.phase, landed: r.player.x };
    };
    const runs = Array.from({ length: 72 }, (_, i) => outcome(i * 10));
    // Stepping off as it walks back towards the wall from x 1850 to 1830, or out from it from 1809 to 1829, he comes down on it.
    expect(runs.filter((o) => o.kind === 'stomp').map((o) => o.at)).toEqual([[1850, -1], [1846, -1], [1843, -1], [1840, -1], [1836, -1], [1833, -1], [1830, -1], [1809, 1], [1813, 1], [1816, 1], [1819, 1], [1823, 1], [1826, 1], [1829, 1]]);
    expect(runs.filter((o) => o.kind === 'hit').map((o) => o.at)).toEqual([[1853, -1]]);
    expect(runs.filter((o) => o.kind === 'beside')).toHaveLength(57);
    for (const o of runs.filter((s) => s.kind === 'stomp')) expect(o.steps).toBe(34);
    for (const o of runs.filter((s) => s.kind === 'beside')) {
      expect(o.landed).toBe(1831);
      expect(['telegraph', 'walk']).toContain(o.phase);
    }
  });

  it('GDD-ENM-03 2-1 Sho: landing beside the drop Paloma, a claw in its telegraph defeats it, and he goes on over its crate', () => {
    // Stepping off at once, the Paloma walking away towards the crate: he lands 28 px behind it, it telegraphs, he claws it
    // (its box 15 px ahead of his front, inside the claw's 20 px reach), then walks on and jumps its crate from 14 px before it.
    const lv = only(DROP);
    let r = at(lv, 1770, ROOF);
    let landed = -1;
    let jumped = -1;
    for (let i = 0; i < 150; i++) {
      const down = r.player.grounded && r.player.y === 224;
      if (down && landed < 0) {
        landed = i;
        expect(r.enemies[0]!.wing!.phase).toBe('telegraph');
        expect(Math.round(r.enemies[0]!.x - r.player.x)).toBe(28);
      }
      if (landed >= 0 && jumped < 0 && down && r.player.x + 6 >= 119 * TILE - 14) jumped = i;
      const claw = landed >= 0 && i === landed;
      r = stepRun(r, { move: landed < 0 || i > landed + 10 ? 1 : 0, jumpHeld: jumped >= 0 && i < jumped + 25, claw }, lv);
      expect(r.lives.lives, `step ${i}`).toBe(7);
    }
    expect(r.enemies[0]!.alive).toBe(false);
    expect(r.player.x).toBeGreaterThan(120 * TILE); // over the crate at 119
  });

  it('GDD-ENM-03 2-1 Sho: standing on the take-off awning, the rung Paloma does not see him', () => {
    const lv = only(RUNG);
    for (let x = TAKEOFF.x + 6; x <= TAKEOFF.x + TAKEOFF.w - 6; x += 6) {
      let r = at(lv, x, TAKEOFF.y);
      for (let i = 0; i < 400; i++) {
        r = stepRun(r, idle, lv);
        expect(r.enemies[0]!.wing!.phase, `x ${x}, step ${i}`).toBe('walk');
      }
    }
  });

  it('GDD-WLD-10 GDD-CMB-01 2-1 Sho: the rung, a tier 1 rebound onto the Paloma, held through the stomp, then tier 2 off the landing awning onto the third rooftop', () => {
    const lv = only(RUNG);
    // Waiting 2 s at the ofrenda, the Paloma walks back towards the crate: the take-off rebound comes down on it, the stomp keeps the
    // chain at 1, and the landing awning's rebound is tier 2, onto the rooftop.
    const held = rung(lv, 120);
    expect(held.bounces).toEqual([[6, 1], [7, 2]]);
    expect(held.stomp).toBe(84);
    expect(held.landed).toBe(ROOF);
    expect(held.lost).toBe(0);
    expect(held.r.enemies[0]!.alive).toBe(false);
    // Jump let go from the stomp on: the stomp's low bounce comes down in the pen, the chain is lost; from there he climbs as without it.
    const plain = rung(lv, 120, false);
    expect(plain.stomp).toBe(held.stomp);
    expect(plain.bounces).toEqual([[6, 1], [7, 1], [7, 2]]);
    expect(plain.landed).toBe(224);
    expect(plain.r.player.y).toBe(ROOF);
    // Without the Paloma, the take-off rebound lands in the pen, the chain ends, and a jump from beside the crate onto the landing awning
    // starts it again: tier 1, then tier 2 onto the rooftop.
    const empty = rung(quiet, 0);
    expect(empty.bounces).toEqual([[6, 1], [7, 1], [7, 2]]);
    expect(empty.landed).toBe(224);
    expect(empty.r.player.y).toBe(ROOF);
  });

  it('GDD-WLD-12 GDD-ENM-03 2-1 Sho: over a whole round of the rung Paloma, the take-off rebound lands on it or beside it, and only a near miss is a hit', () => {
    // Taking off after 0 to 27 waits of 15 steps (6.75 s, more than its round of the pen, 6.6 s): [stomps that climb the rung, landings
    // beside it that cost nothing (a claw when it is ahead, else it is behind him), landings against its side (a hit, as a stomp just
    // missed)]. Every one that keeps its lives ends on the rooftop.
    const runs = Array.from({ length: 28 }, (_, i) => rung(only(RUNG), i * 15));
    const kinds = runs.map((o) => (o.lost > 0 ? 'hit' : o.stomp > 0 ? 'rung' : 'beside'));
    expect([kinds.filter((k) => k === 'rung').length, kinds.filter((k) => k === 'beside').length, kinds.filter((k) => k === 'hit').length]).toEqual([10, 16, 2]);
    for (const o of runs) if (o.lost === 0) expect(o.r.player.y).toBe(ROOF);
    for (const o of runs) if (o.stomp > 0) expect(o.bounces).toEqual([[6, 1], [7, 2]]);
  });

  it('GDD-WLD-11 2-1 Ketsu: the cordel staircase is the only way onto the tall rooftop', () => {
    // A full jump from the floor under the lower cordel lands on it; from it, one under the upper cordel; from that, one onto the rooftop.
    const hop = (x: number, y: number) => {
      let r = at(quiet, x, y);
      let top = -1;
      for (let i = 0; i < 80 && top < 0; i++) {
        r = stepRun(r, { move: i < 20 ? 0.4 : 0, jumpHeld: i < 25 }, quiet);
        if (i > 3 && r.player.grounded) top = r.player.y;
      }
      return top;
    };
    expect(hop(mid(185), 224)).toBe(176);
    expect(hop(mid(188), 176)).toBe(128);
    let r = at(quiet, 3048, 128);
    let top = -1;
    for (let i = 0; i < 80 && top < 0; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 25 }, quiet);
      if (i > 3 && r.player.grounded) top = r.player.y;
    }
    expect(top).toBe(TALL);
    // From the floor and from the lower cordel, a full jump at the rooftop's wall falls back: it is 9 tiles tall, 6 above the lower cordel.
    for (const [x, y] of [[3060, 224], [3000, 176]] as const) {
      let s = at(quiet, x, y);
      let peak = Infinity;
      for (let i = 0; i < 60; i++) {
        s = stepRun(s, { move: 1, jumpHeld: i < 25 }, quiet);
        peak = Math.min(peak, s.player.y);
      }
      expect(peak, `from y ${y}`).toBeGreaterThan(TALL + 8);
    }
  });

  it('GDD-WLD-12 2-1 Ten: no jump crosses the pit, a running jump from its edge lands on the pit awning, and its rebound carries him over the 2 open tiles past it', () => {
    // A running jump from the edge with the pit awning taken away falls in.
    const bare: Level = { ...quiet, awnings: awnings.filter((a) => a !== PIT) };
    let r = at(bare, 2610, 224);
    for (let i = 0; i < 120 && r.phase === 'playing'; i++) r = stepRun(r, { move: 1, jumpHeld: r.player.x > 2642 && i < 60 }, bare);
    expect(r.phase).toBe('respawning');
    // With it: held through, the jump lands on it, rebounds at tier 1 and comes down on the far floor.
    const run = (jumpHeld: (i: number, s: RunState) => boolean) => {
      let s = at(quiet, 2610, 224);
      const tiers: number[] = [];
      for (let i = 0; i < 150; i++) {
        const before = s.awningBounce;
        s = stepRun(s, { move: s.player.x > 2640 || i > 0 ? 1 : 0, jumpHeld: jumpHeld(i, s) }, quiet);
        if (s.awningBounce !== before) tiers.push(s.awningBounce!.tier);
        if (s.player.grounded && s.player.y === 224 && s.player.x > 2784) break;
      }
      return { s, tiers };
    };
    let pressed = -1;
    const held = run((i, s) => {
      if (pressed < 0 && s.player.x > 2642) pressed = i;
      return pressed >= 0;
    });
    expect(held.tiers).toEqual([1]);
    expect(held.s.phase).toBe('playing');
    expect(held.s.player.x).toBeGreaterThan(2784);
    // Not held at the landing, and right let go from the first touch: one small hop and he settles on the awning, and a jump from there
    // reaches the far floor too.
    let s = at(quiet, 2610, 224);
    let k = -1;
    for (let i = 0; i < 120; i++) {
      if (k < 0 && s.player.x > 2642) k = i;
      s = stepRun(s, { move: s.awningBounce === null ? 1 : 0, jumpHeld: k >= 0 && i - k < 20 }, quiet);
    }
    expect(s.awningBounce).toMatchObject({ awning: 8, tier: 0 });
    expect(s.player).toMatchObject({ y: PIT.y, grounded: true });
    expect(Math.round(s.player.x * 10) / 10).toBe(2727.2);
    for (let i = 0; i < 80; i++) s = stepRun(s, { move: 1, jumpHeld: i >= 1 && i < 25 }, quiet);
    expect(s.phase).toBe('playing');
    expect(s.player).toMatchObject({ y: 224, grounded: true });
    expect(s.player.x).toBeGreaterThan(2784);
  });

  it('GDD-WLD-10 2-1 Ten: a plain landing on the pit awning left edge while holding right settles on it and does not carry him into the pit', () => {
    // A running jump from the pit's edge, jump let go long before the landing and right held throughout: he lands on the awning's left
    // edge, the plain rebound's small hop carries him on across it, and he comes down on its 48 px and stands there. From then on he is
    // standing on it as on any ledge, so it is right held after he has settled, not the hop, that would walk him off its far end.
    let s = at(quiet, 2610, 224);
    let k = -1;
    let touch = -1;
    let settled = -1;
    const xs: number[] = [];
    for (let i = 0; i < 120 && settled < 0; i++) {
      if (k < 0 && s.player.x > 2642) k = i;
      const before = s.awningBounce;
      s = stepRun(s, { move: 1, jumpHeld: k >= 0 && i - k < 20 }, quiet);
      if (s.awningBounce !== before) {
        touch = i + 1;
        xs.push(Math.round(s.player.x * 10) / 10);
      }
      if (touch >= 0 && s.player.grounded && s.player.y === PIT.y) {
        settled = i + 1;
        xs.push(Math.round(s.player.x * 10) / 10);
      }
    }
    expect(s.awningBounce).toMatchObject({ awning: 8, tier: 0 });
    expect(s.phase).toBe('playing');
    expect(xs).toEqual([2705, 2737]); // the plain landing, 1 px onto its left end, then the hop's landing, his body 9 px clear of its far end
    expect(s.player.x + 6).toBeLessThan(PIT.x + PIT.w);
    expect(settled - touch).toBe(16); // the hop, in steps
  });

  it('GDD-WLD-10 2-1 Ten: every running jump that reaches the pit awning crosses the pit held, which a 9-tile pit would not allow', () => {
    // Running from the pen and pressing jump, held, once past `take`: the jumps that reach the awning (from 2636) land on its first 20 px,
    // and a tier 1 rebound from there must clear the open tiles past it. With the 2 open tiles of the level every one crosses; with the
    // far floor a column further (a 9-tile pit, 3 open tiles a side) those pressed before 2648 come down in the pit.
    const far = widerPit();
    const takes = [2636, 2640, 2644, 2648, 2652, 2656];
    expect(takes.map((t) => cross(quiet, t))).toEqual([true, true, true, true, true, true]);
    expect(takes.map((t) => cross(far, t))).toEqual([false, false, false, true, true, true]);
  });

  it('GDD-ENM-03 2-1 Ten: sprinting at the pit Paloma is a hit; waiting for its hover, walking under it and jumping past it lands on the pit awning', () => {
    const lv = only(EDGE);
    // Dropped into its pen 30 px from it: it telegraphs at once, and running on into it is a hit 13 steps later.
    let r = at(lv, 2602, 224);
    let hit = -1;
    for (let i = 0; i < 60 && hit < 0; i++) {
      r = stepRun(r, { move: 1, jumpHeld: false }, lv);
      if (r.lives.lives < 7) hit = i + 1;
    }
    expect(hit).toBe(14);
    expect(r.enemies[0]!.wing!.phase).toBe('telegraph');
    // Waiting: once it hovers he walks under it to the edge and jumps past it, onto the awning, no hit.
    r = at(lv, 2602, 224);
    let jumped = -1;
    let landed = -1;
    for (let i = 0; i < 200 && landed < 0; i++) {
      const hover = r.enemies[0]!.wing!.phase === 'hover';
      if (hover && jumped < 0 && r.player.x > 2640) jumped = i;
      r = stepRun(r, { move: hover || jumped >= 0 ? 1 : 0, jumpHeld: jumped >= 0 && i - jumped < 25 }, lv);
      expect(r.lives.lives, `step ${i}`).toBe(7);
      if (jumped >= 0 && (r.awningBounce !== null || (r.player.grounded && r.player.y === PIT.y))) landed = i + 1;
    }
    expect(jumped).toBe(74);
    expect(landed).toBeGreaterThan(jumped);
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('GDD-ENM-03 GDD-CMB-01 2-1 Ten: from the crate, a jump onto the pit Paloma stomps it, and held through the stomp it is a stepping stone onto the pit awning', () => {
    const lv = only(EDGE);
    let r = at(lv, mid(161), 192);
    let stomp = -1;
    let onPit = false;
    for (let i = 0; i < 120; i++) {
      r = stepRun(r, { move: 1, jumpHeld: i < 80 }, lv);
      if (stomp < 0 && r.stomped) stomp = i + 1;
      onPit ||= r.awningBounce?.awning === 8;
      expect(r.lives.lives, `step ${i}`).toBe(7);
    }
    expect(stomp).toBe(37);
    expect(r.enemies[0]!.alive).toBe(false);
    expect(onPit).toBe(true);
  });

  it('GDD-ENM-03 2-1 Sho: the first Paloma can be walked under while it hovers, and he leaves its pen with no hit', () => {
    const lv = only(1);
    let r = at(lv, 790, 224);
    let hold = 0;
    let before = false;
    for (let i = 0; i < 300; i++) {
      const s = r.enemies[0]!;
      const phase = s.wing!.phase;
      const go = phase === 'walk' ? r.player.x < s.x - 20 : phase === 'hover' || r.player.x > s.x + 14;
      if (r.player.grounded && !before && go && r.player.x > 880 && hold === 0) hold = 20;
      const input = { move: go ? 1 : 0, jumpHeld: hold > 0 };
      before = input.jumpHeld;
      if (hold > 0) hold--;
      r = stepRun(r, input, lv);
      expect(r.lives.lives, `step ${i}`).toBe(7);
    }
    expect(r.player.x).toBeGreaterThan(58 * TILE); // past its far crate
    expect(r.enemies[0]!.alive).toBe(true);
  });

  it('GDD-LIFE-03 2-1 Ten: three held rebounds in place on the pit awning reach the veladora at the top of the third and not before, and its column gives one hilo per beat', () => {
    const veladora = level.veladora!;
    let r: RunState = { ...at(quiet, mid(170), PIT.y), lives: loseLife(startWorld()) };
    r = stepRun(r, idle, quiet);
    const column = ['170,7', '170,6', '170,5', '170,4'];
    const got: string[][] = [];
    const used: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const before = r.awningBounce;
      r = stepRun(r, { move: 0, jumpHeld: true }, quiet);
      if (r.awningBounce !== before) {
        got.push(hiloKeys(r).filter((k) => column.includes(k)));
        used.push(veladoraUsed(r.lives, veladora));
      }
    }
    expect(got.slice(0, 4)).toEqual([column.slice(0, 1), column.slice(0, 2), column.slice(0, 3), column]);
    expect(used.slice(0, 4)).toEqual([false, false, false, true]);
    expect(r.lives.lives).toBe(7);
  });

  it('GDD-WLD-12 2-1 Ketsu: on the last stall a second tier peaks under the exit rooftop and a third lands on it', () => {
    for (let x = LAST.x + 6; x <= LAST.x + LAST.w - 6; x += 6) {
      const two = climb(quiet, x, LAST.y, 1, 300, 2);
      expect(two.bounces.map((b) => b.tier), `x ${x}`).toEqual([1, 2, 0]);
      expect(Math.round((two.bounces[2]!.peakBefore - TALL) * 10) / 10, `x ${x}`).toBe(14.7);
      expect(two.landings, `x ${x}`).toEqual([]);
      const three = climb(quiet, x, LAST.y, 1, 300);
      expect(three.landings[0], `x ${x}`).toMatchObject({ y: TALL });
    }
  });

  it('GDD-WLD-12 2-1 can be played from the start to the exit with all seven lives, every ofrenda and every Paloma clawed, in under 3000 steps', () => {
    const { run, steps, lost, clawed } = bot(level, 3000);
    expect(run.phase).toBe('clear');
    expect(lost).toBe(0);
    expect(run.lives.lives).toBe(7);
    expect(steps).toBe(2791);
    expect(touchesExit(run.player, level.exit!)).toBe(true);
    expect(level.ofrendas.map((o) => run.lives.used.has(`ofrenda:${o.id}`))).toEqual([true, true, true]);
    expect(run.enemies.map((e) => e.alive)).toEqual([true, false, false, false, false, false]); // the Alacrán jumped, the Palomas clawed
    expect(clawed).toBe(10); // claw presses, two for each Paloma: the bot presses every other step while one is in its reach
  });

  it('GDD-WLD-12 2-1 the bot also clears it after waiting 60 120 180 or 240 steps at the start', () => {
    for (const wait of [60, 120, 180, 240]) {
      const { run, lost } = bot(level, 3300, wait);
      expect(run.phase, `wait ${wait}`).toBe('clear');
      expect(lost, `wait ${wait}`).toBe(0);
    }
  });

  it('GDD-WLD-04 2-1 the playthrough collects 44 hilos and the two in-place climbs the other 6', () => {
    const main = bot(level, 3000).run;
    const missed = level.hilos!.flatMap((h, i) => (main.hilosTaken[i] ? [] : [`${h.col},${h.row}`]));
    expect(missed).toEqual(['32,6', '32,5', '32,4', '32,3', '170,5', '170,4']);
    const first = climb(quiet, mid(32), A1.y, 0, 160).r;
    const pit = climb(quiet, mid(170), PIT.y, 0, 200).r;
    expect(missed.filter((k) => !hiloKeys(first).includes(k) && !hiloKeys(pit).includes(k))).toEqual([]);
  });
});

