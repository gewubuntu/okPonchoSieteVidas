import { describe, expect, it } from 'vitest';
import { TILE } from '../config/tuning';
import { hilosCollected } from '../sim/hilo';
import { loseLife, startWorld } from '../sim/lives';
import { spawn, type PlayerInput } from '../sim/movement';
import { startRun, stepRun, touchesExit, type Level, type RunState } from '../sim/run';
import { veladoraUsed } from '../sim/veladora';
import { LEVEL_0_1, TIPS_0_1 } from './level0-1';
import { LEVELS } from './index';
import { gaps } from './validate';

const world = LEVEL_0_1.world;

/** Whether a standable top (a solid tile with an empty tile above it) in `col` is 0 to 88 px below `midY`: 32 px body plus the 56 px jump (GDD-MOV-02, GDD-MOV-06). */
const topBelow = (col: number, midY: number): boolean => {
  for (let row = 0; row < world.height; row++) {
    if (!world.solidTile(col, row) || world.solidTile(col, row - 1)) continue;
    const drop = row * TILE - midY;
    if (drop >= 0 && drop <= 88) return true;
  }
  return false;
};

describe('GDD-WLD-06 tutorial level 0-1', () => {
  it('GDD-WLD-06 0-1 is 90 by 17 tiles, a World 0 tutorial level and no test level', () => {
    expect(world.width).toBe(90);
    expect(world.height).toBe(17);
    const entry = LEVELS.find((e) => e.id === '0-1');
    expect(entry).toBeDefined();
    expect(entry!.world).toBe(0);
    expect(entry!.test).toBe(false);
    expect(entry!.level).toBe(LEVEL_0_1);
  });

  it('GDD-WLD-03 0-1 ofrendas stand at about 25 55 and 85 percent', () => {
    const width = 1440;
    expect(LEVEL_0_1.ofrendas).toHaveLength(3);
    [0.25, 0.55, 0.85].forEach((share, i) => {
      expect(Math.abs(LEVEL_0_1.ofrendas[i]!.x / width - share), `ofrenda ${i + 1}`).toBeLessThan(0.03);
    });
  });

  it('GDD-WLD-03 0-1 gaps are 1 2 3 and 3 tiles', () => {
    expect(gaps(world)).toEqual([
      { col: 16, width: 1 },
      { col: 19, width: 2 },
      { col: 53, width: 3 },
      { col: 71, width: 3 },
    ]);
  });

  it('GDD-WLD-06 0-1 has 50 hilos each in an empty tile within a jump of a floor', () => {
    const hilos = LEVEL_0_1.hilos!;
    expect(hilos).toHaveLength(50);
    expect(new Set(hilos.map((h) => `${h.col},${h.row}`)).size).toBe(50);
    for (const h of hilos) {
      const where = `hilo at ${h.col},${h.row}`;
      expect(world.solidTile(h.col, h.row), where).toBe(false);
      expect(LEVEL_0_1.pinatas.some((p) => p.col === h.col && p.row === h.row), where).toBe(false);
      const midY = h.row * TILE + TILE / 2;
      expect([-2, -1, 0, 1, 2].some((d) => topBelow(h.col + d, midY)), where).toBe(true);
    }
  });
});

/**
 * A bot that always holds right and jumps (held for 20 steps) when something is ahead: a wall in the row above his feet within
 * 14 px of his front edge, a drop of three tiles or more within 10 px, a spike starting within 26 px of him, or a live Alacrán on his level
 * within 40 px.
 */
function bot(level: Level, maxSteps: number): { run: RunState; steps: number } {
  let run = startRun(level);
  let hold = 0;
  let steps = 0;
  while (run.phase !== 'clear' && steps < maxSteps) {
    const { x, y, grounded } = run.player;
    if (run.phase === 'playing' && grounded && hold === 0) {
      const front = x + 6;
      const feetRow = Math.floor((y - 1) / TILE);
      let jump = false;
      for (let d = 0; d <= 14; d++) if (world.solidTile(Math.floor((front + d) / TILE), feetRow)) jump = true;
      // A drop of three tiles or more (a gap, or the edge of a wall 3 tiles high); a smaller step down is just walked off.
      for (let d = 0; d <= 10; d++) {
        const col = Math.floor((front + d) / TILE);
        let empty = 0;
        while (feetRow + 1 + empty < world.height && !world.solidTile(col, feetRow + 1 + empty)) empty++;
        if (empty >= 3) jump = true;
      }
      for (const s of level.spikes) if (s.row === feetRow && s.col * TILE - x >= 0 && s.col * TILE - x <= 26) jump = true;
      level.enemies.forEach((e, i) => {
        if (run.enemies[i]!.alive && Math.abs(e.y - y) < 4 && run.enemies[i]!.x - x >= 0 && run.enemies[i]!.x - x <= 40) jump = true;
      });
      if (jump) hold = 20;
    }
    const input: PlayerInput = { move: 1, jumpHeld: hold > 0 };
    if (hold > 0) hold--;
    run = stepRun(run, input, level);
    steps++;
  }
  return { run, steps };
}

describe('GDD-WLD-06 playing 0-1', () => {
  it('GDD-WLD-06 0-1 holding right from the start collects the first three hilos by step 150', () => {
    let run = startRun(LEVEL_0_1);
    for (let i = 0; i < 150; i++) run = stepRun(run, { move: 1, jumpHeld: false }, LEVEL_0_1);
    expect(hilosCollected(run.hilosTaken)).toBe(3);
  });

  it('GDD-WLD-06 0-1 can be played from the start to the exit with all seven lives', () => {
    const { run, steps } = bot(LEVEL_0_1, 900);
    expect(run.phase).toBe('clear');
    expect(steps).toBeLessThan(900);
    expect(run.lives.lives).toBe(7);
    expect(touchesExit(run.player, LEVEL_0_1.exit!)).toBe(true);
  });

  it('GDD-WLD-06 0-1 the veladora ledge is reached by a full jump from the right end of the raised platform', () => {
    const level: Level = { ...LEVEL_0_1, enemies: [] };
    const veladora = LEVEL_0_1.veladora!;
    const attempt = (jumpHeld: boolean): RunState => {
      let run: RunState = { ...startRun(level), lives: loseLife(startWorld()), player: { ...spawn(1096, 160), grounded: true } };
      for (let i = 0; i < 90; i++) run = stepRun(run, { move: 1, jumpHeld }, level);
      return run;
    };
    const jumped = attempt(true);
    expect(veladoraUsed(jumped.lives, veladora)).toBe(true);
    expect(jumped.lives.lives).toBe(7);
    const walked = attempt(false);
    expect(veladoraUsed(walked.lives, veladora)).toBe(false);
  });
});

const one = (t: string) => ({ keyboard: t, touch: t, pad: t });
const same = (en: string, es: string, de: string) => ({ en: one(en), es: one(es), de: one(de) });
const h = (i: number) => TIPS_0_1[i - 1]!.highlight!;
const holdsX = (r: { col: number; w: number }, x: number) => x >= r.col * TILE && x <= (r.col + r.w) * TILE;

describe('GDD-UI-05 the tips of 0-1', () => {
  // Stretch (tile columns), highlight (col, row, w, h in tiles), touch button, done when, and the words, from the GDD.
  const expected = [
    {
      from: 0,
      to: 5,
      text: {
        en: { keyboard: 'Arrows or A/D to run', touch: 'Hold left or right to run', pad: 'Stick or D-pad to run' },
        es: { keyboard: 'Flechas o A/D para correr', touch: 'Mantén izquierda o derecha para correr', pad: 'Stick o cruceta para correr' },
        de: { keyboard: 'Pfeiltasten oder A/D zum Laufen', touch: 'Links oder rechts halten zum Laufen', pad: 'Stick oder Steuerkreuz zum Laufen' },
      },
      highlight: null,
      button: 'move',
    },
    {
      from: 6,
      to: 13,
      text: {
        en: { keyboard: 'Space to jump. Hold it to jump higher', touch: 'Tap the jump button. Hold it to jump higher', pad: 'Bottom button to jump. Hold it to jump higher' },
        es: { keyboard: 'Espacio para saltar. Mantenlo para saltar más alto', touch: 'Toca el botón de salto. Mantenlo para saltar más alto', pad: 'Botón inferior para saltar. Mantenlo para saltar más alto' },
        de: { keyboard: 'Leertaste zum Springen. Halten für höhere Sprünge', touch: 'Sprungknopf antippen. Halten für höhere Sprünge', pad: 'Untere Taste zum Springen. Halten für höhere Sprünge' },
      },
      highlight: { col: 11, row: 12, w: 2, h: 2 },
      button: 'jump',
    },
    { from: 14, to: 20, text: same('Jump over the gaps', 'Salta los huecos', 'Spring über die Lücken'), highlight: { col: 16, row: 14, w: 5, h: 1 } },
    {
      from: 21,
      to: 25,
      text: same('Ofrendas are checkpoints. The first touch gives back a life', 'Las ofrendas son puntos de control. El primer toque devuelve una vida', 'Ofrendas sind Kontrollpunkte. Die erste Berührung gibt ein Leben zurück'),
      highlight: { col: 23, row: 12, w: 1, h: 2 },
    },
    {
      from: 26,
      to: 38,
      text: {
        en: { keyboard: 'Jump on the Alacrán, or X to claw it', touch: 'Jump on the Alacrán, or tap the claw button', pad: 'Jump on the Alacrán, or left button to claw it' },
        es: { keyboard: 'Salta sobre el Alacrán, o pulsa X para arañarlo', touch: 'Salta sobre el Alacrán, o toca el botón de zarpazo', pad: 'Salta sobre el Alacrán, o botón izquierdo para arañarlo' },
        de: { keyboard: 'Spring auf den Alacrán oder kratz ihn mit X', touch: 'Spring auf den Alacrán oder tipp auf den Krallenknopf', pad: 'Spring auf den Alacrán oder kratz ihn mit der linken Taste' },
      },
      highlight: { col: 28, row: 12, w: 9, h: 2 },
      button: 'claw',
      doneWhen: { enemy: 0 },
    },
    {
      from: 39,
      to: 41,
      text: same('Jump into the piñata from below', 'Salta contra la piñata desde abajo', 'Spring von unten gegen die Piñata'),
      highlight: { col: 40, row: 10, w: 1, h: 1 },
      doneWhen: { pinata: 0 },
    },
    {
      from: 42,
      to: 47,
      text: same('Spikes hurt. With a taco, a hit costs only the taco', 'Los pinchos hacen daño. Con un taco, un golpe solo cuesta el taco', 'Stacheln tun weh. Mit einem Taco kostet ein Treffer nur den Taco'),
      highlight: { col: 43, row: 13, w: 2, h: 1 },
    },
    {
      from: 48,
      to: 52,
      text: same('Hilos are threads to collect. Find all 50!', 'Los hilos son para coleccionar. ¡Encuentra los 50!', 'Hilos sind Fäden zum Sammeln. Finde alle 50!'),
      highlight: { col: 49, row: 12, w: 1, h: 2 },
    },
    { from: 53, to: 57, text: same('A running jump crosses 3 tiles', 'Un salto con carrerilla cruza 3 casillas', 'Ein Sprung mit Anlauf überquert 3 Felder'), highlight: { col: 53, row: 14, w: 3, h: 1 } },
    { from: 58, to: 61, text: same('A full jump climbs a wall 3 tiles high', 'Un salto completo sube un muro de 3 casillas', 'Ein voller Sprung erklimmt eine 3 Felder hohe Wand'), highlight: { col: 58, row: 11, w: 2, h: 3 } },
    {
      from: 62,
      to: 75,
      text: same('A veladora up there gives back a life', 'Una veladora ahí arriba devuelve una vida', 'Eine Veladora dort oben gibt ein Leben zurück'),
      highlight: { col: 70, row: 6, w: 1, h: 1 },
      doneWhen: 'veladora',
    },
    { from: 82, to: 89, text: same('Reach the arch to finish the level', 'Llega al arco para terminar el nivel', 'Erreiche den Bogen, um das Level zu beenden'), highlight: { col: 87, row: 11, w: 1, h: 3 } },
  ];

  it('GDD-UI-05 0-1 has the twelve tips of the GDD in order', () => {
    expect(TIPS_0_1).toHaveLength(12);
    expected.forEach((e, i) => expect(TIPS_0_1[i], `tip ${i + 1}`).toEqual(e));
  });

  it('GDD-UI-05 0-1 tip stretches do not overlap and run left to right', () => {
    TIPS_0_1.forEach((t, i) => {
      expect(t.from, `tip ${i + 1}`).toBeLessThanOrEqual(t.to);
      if (i > 0) expect(t.from, `tip ${i + 1}`).toBeGreaterThan(TIPS_0_1[i - 1]!.to);
    });
  });

  it('GDD-UI-05 0-1 each highlight covers its thing', () => {
    const solid = (r: { col: number; row: number; w: number; h: number }) => {
      for (let c = r.col; c < r.col + r.w; c++) for (let row = r.row; row < r.row + r.h; row++) if (!world.solidTile(c, row)) return false;
      return true;
    };
    expect(solid(h(2))).toBe(true); // the 2-tile wall
    // The two gaps: columns 16 and 19 to 20 are pits, the floor between them is not.
    expect(h(3)).toMatchObject({ col: 16, w: 5, row: 14, h: 1 });
    expect([16, 19, 20].every((c) => !world.solidTile(c, world.height - 1))).toBe(true);
    expect(holdsX(h(4), LEVEL_0_1.ofrendas[0]!.x) && (h(4).row + h(4).h) * TILE === LEVEL_0_1.ofrendas[0]!.y).toBe(true);
    const alacran = LEVEL_0_1.enemies[0]!;
    expect(holdsX(h(5), alacran.x) && (h(5).row + h(5).h) * TILE === alacran.y).toBe(true);
    expect(h(6)).toMatchObject({ col: LEVEL_0_1.pinatas[0]!.col, row: LEVEL_0_1.pinatas[0]!.row, w: 1, h: 1 });
    expect(h(7)).toMatchObject({ col: LEVEL_0_1.spikes[0]!.col, row: LEVEL_0_1.spikes[0]!.row, w: 2, h: 1 });
    expect(LEVEL_0_1.spikes[1]!.col).toBe(h(7).col + 1);
    expect(holdsX(h(8), LEVEL_0_1.ofrendas[1]!.x) && (h(8).row + h(8).h) * TILE === LEVEL_0_1.ofrendas[1]!.y).toBe(true);
    expect(h(9)).toMatchObject({ col: gaps(world)[2]!.col, w: gaps(world)[2]!.width, row: 14, h: 1 });
    expect(solid(h(10))).toBe(true); // the 3-tile wall
    expect(h(11)).toMatchObject({ col: LEVEL_0_1.veladora!.col, row: LEVEL_0_1.veladora!.row, w: 1, h: 1 });
    expect(holdsX(h(12), LEVEL_0_1.exit!.x) && (h(12).row + h(12).h) * TILE === LEVEL_0_1.exit!.y).toBe(true);
  });
});
