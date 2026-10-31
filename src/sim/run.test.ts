import { describe, expect, it } from 'vitest';
import { FLIP, HITBOX, LIVES_MAX, OFRENDA, RESPAWN, TILE } from '../config/tuning';
import { loseLife } from './lives';
import { medal } from './results';
import { spawn, type PlayerInput } from './movement';
import { NO_COMBO, stepSounds } from './sfx';
import { isInPit, startRun, stepRun, touchesOfrenda, type Level, type Ofrenda, type RunState } from './run';
import { parseTiles } from './tilemap';

const idle: PlayerInput = { move: 0, jumpHeld: false };
const right: PlayerInput = { move: 1, jumpHeld: false };

// Floor on the left (x < 80), a 3-tile pit (x 80 to 128), floor again on the right. Floor top is y = 64.
const world = parseTiles(['..............', '..............', '..............', '..............', '#####...######', '#####...######']);
const level: Level = { world, spawn: { x: 24, y: 4 * TILE }, ofrendas: [], spikes: [], crumbles: [], springs: [], platforms: [], tacos: [], pinatas: [], doors: [], keys: [], fragiles: [], enemies: [] };

const run = (r: RunState, input: PlayerInput, steps: number): RunState => {
  for (let i = 0; i < steps; i++) r = stepRun(r, input, level);
  return r;
};

/** Plays on until Poncho has fallen into the pit and the run is respawning. */
const fallIn = (r: RunState = startRun(level)): RunState => {
  for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, level);
  return r;
};

describe('GDD-LIFE-02 falling into a pit', () => {
  it('starts with seven lives, playing, at the spawn point', () => {
    const r = startRun(level);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: 0 });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.player).toMatchObject({ x: 24, y: 64 });
  });

  it('is in the pit only once the whole body is below the bottom of the level', () => {
    const bottom = world.height * TILE;
    expect(isInPit({ ...spawn(10, bottom + HITBOX.height) }, world)).toBe(false);
    expect(isInPit({ ...spawn(10, bottom + HITBOX.height + 0.01) }, world)).toBe(true);
  });

  it('walking off the ledge into the pit costs exactly one life', () => {
    const r = fallIn();
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.wait).toBe(RESPAWN.delaySteps);
  });

  it('does not cost a life to run and jump on solid ground', () => {
    let r = startRun(level);
    for (let i = 0; i < 40; i++) r = stepRun(r, { move: 1, jumpHeld: i < 20 }, level);
    expect(r.phase).toBe('playing');
    expect(r.lives.lives).toBe(LIVES_MAX);
  });

  it('a running jump across the pit lands on the far side without losing a life', () => {
    let crossed = false;
    for (let runSteps = 0; runSteps < 50 && !crossed; runSteps++) {
      let r = startRun(level);
      for (let i = 0; i < 140; i++) r = stepRun(r, { move: 1, jumpHeld: i >= runSteps && i < runSteps + 40 }, level);
      crossed = r.phase === 'playing' && r.lives.lives === LIVES_MAX && r.player.x > 128;
    }
    expect(crossed).toBe(true);
  });
});

describe('GDD-LIFE-02 respawning', () => {
  it('waits 0.8 s, then respawns at the start with invulnerability and the same lives', () => {
    const fallen = fallIn();
    const r = run(fallen, idle, RESPAWN.delaySteps);
    expect(r).toMatchObject({ phase: 'playing', invulnerable: RESPAWN.invulnerableSteps });
    expect(r.player).toMatchObject({ x: 24, y: 64, grounded: true });
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('is still waiting one step before the delay ends', () => {
    expect(run(fallIn(), idle, RESPAWN.delaySteps - 1).phase).toBe('respawning');
  });

  it('ignores input before step 18 (0.3 s), then any input skips the wait', () => {
    const fallen = fallIn();
    const jump: PlayerInput = { move: 0, jumpHeld: true };
    // `before` steps have been taken without input when the next step has input.
    const withInput = (before: number, input: PlayerInput) => stepRun(run(fallen, idle, before), input, level).phase;
    expect(withInput(RESPAWN.skipAfterSteps - 2, right)).toBe('respawning'); // step 17
    expect(withInput(RESPAWN.skipAfterSteps - 1, right)).toBe('playing'); // step 18, exactly 0.3 s
    expect(withInput(RESPAWN.skipAfterSteps - 1, jump)).toBe('playing'); // a jump press skips it too
    expect(withInput(RESPAWN.skipAfterSteps - 1, idle)).toBe('respawning'); // no input, no skip
  });

  it('any input means any button: claw, Fuego, left and right held together, or a slide stick push skip it too', () => {
    const fallen = fallIn();
    const at18 = (input: PlayerInput) => stepRun(run(fallen, idle, RESPAWN.skipAfterSteps - 1), input, level).phase;
    expect(at18({ move: 0, jumpHeld: false, claw: true })).toBe('playing');
    expect(at18({ move: 0, jumpHeld: false, fuego: true })).toBe('playing');
    expect(at18({ move: 0, jumpHeld: false, left: true, right: true })).toBe('playing'); // they cancel out in move
    expect(at18({ move: -0.4, jumpHeld: false, left: true, right: false })).toBe('playing'); // the stick, part way (touchInput sets left)
    expect(at18({ move: 0.4, jumpHeld: false })).toBe('playing'); // an input with only a move, as from a gamepad later
    expect(at18({ move: 0, jumpHeld: false, claw: false, fuego: false, left: false, right: false })).toBe('respawning');
    // and still not before 0.3 s
    expect(stepRun(run(fallen, idle, RESPAWN.skipAfterSteps - 2), { move: 0, jumpHeld: false, claw: true }, level).phase).toBe('respawning');
  });

  it('without input the wait ends on step 48 (0.8 s), not before', () => {
    const fallen = fallIn();
    expect(run(fallen, idle, RESPAWN.delaySteps - 1).phase).toBe('respawning');
    expect(run(fallen, idle, RESPAWN.delaySteps).phase).toBe('playing');
  });

  it('does not jump on respawn when the jump button is still held, but does when it is pressed again', () => {
    const held: PlayerInput = { move: 0, jumpHeld: true };
    let r = fallIn();
    for (let i = 0; i < 100 && r.phase === 'respawning'; i++) r = stepRun(r, held, level);
    expect(r.phase).toBe('playing');
    for (let i = 0; i < 3; i++) {
      r = stepRun(r, held, level);
      expect(r.player).toMatchObject({ grounded: true, vy: 0 }); // still standing on the step after respawn
    }
    r = stepRun(r, idle, level); // release
    r = stepRun(r, held, level); // press again
    expect(r.player.vy).toBeLessThan(0);
    expect(r.player.grounded).toBe(false);
  });

  it('counts the invulnerability down to zero after 2.0 s', () => {
    const r = run(fallIn(), idle, RESPAWN.delaySteps);
    expect(run(r, idle, RESPAWN.invulnerableSteps - 1).invulnerable).toBe(1);
    expect(run(r, idle, RESPAWN.invulnerableSteps).invulnerable).toBe(0);
  });

  it('invulnerability does not protect from a pit (GDD-CMB-03)', () => {
    let r = run(fallIn(), idle, RESPAWN.delaySteps);
    expect(r.invulnerable).toBeGreaterThan(0);
    const livesBefore = r.lives.lives;
    r = fallIn(r);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(livesBefore - 1);
  });
});

describe('GDD-LIFE-05 out of lives', () => {
  it('losing the last life restarts the world with all seven lives', () => {
    let r = startRun(level);
    for (let i = 0; i < LIVES_MAX - 1; i++) r = { ...r, lives: loseLife(r.lives) };
    expect(r.lives.lives).toBe(1);
    const fallen = fallIn(r);
    expect(fallen.lives.lives).toBe(0);
    const screen = run(fallen, idle, RESPAWN.delaySteps);
    expect(screen.phase).toBe('gameover'); // the Siete vidas gastadas screen, until a press of any button after 1.0 s
    const back = run(stepRun(run(screen, idle, 60), { move: 0, jumpHeld: true }, level), idle, 21);
    expect(back.lives.lives).toBe(LIVES_MAX);
    expect(back.phase).toBe('playing');
  });
});

const hurt = (r: RunState): RunState => ({ ...r, lives: loseLife(r.lives) });

describe('GDD-LIFE-03 ofrenda checkpoints', () => {
  // Two ofrendas on the floor (y = 64): one at x = 56, one past the pit at x = 152.
  const near: Ofrenda = { id: 'near', x: 56, y: 4 * TILE };
  const far: Ofrenda = { id: 'far', x: 152, y: 4 * TILE };
  const withOfrendas: Level = { ...level, ofrendas: [near, far] };
  const go = (r: RunState, input: PlayerInput, steps: number, lv = withOfrendas): RunState => {
    for (let i = 0; i < steps; i++) r = stepRun(r, input, lv);
    return r;
  };

  it('touches an ofrenda only when the body box overlaps its box', () => {
    const reach = (HITBOX.width + OFRENDA.width) / 2;
    expect(touchesOfrenda(spawn(56 + reach - 0.01, 64), near)).toBe(true);
    expect(touchesOfrenda(spawn(56 + reach, 64), near)).toBe(false); // edges only
    expect(touchesOfrenda(spawn(56, 64 - OFRENDA.height + 0.01), near)).toBe(true); // feet just below its top
    expect(touchesOfrenda(spawn(56, 64 - OFRENDA.height), near)).toBe(false); // feet exactly at its top
    expect(touchesOfrenda(spawn(56, 64 - OFRENDA.height - HITBOX.height), near)).toBe(false); // a jump over the top
    expect(touchesOfrenda(spawn(56, 64 + HITBOX.height), near)).toBe(false); // below its feet
  });

  it('activating restores one life when fewer than seven and sets the checkpoint', () => {
    let r = hurt(startRun(withOfrendas));
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    r = go(r, right, 20);
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.checkpoint).toEqual({ x: 56, y: 64 });
  });

  it('restores a life once per ofrenda, and a later ofrenda replaces an earlier one as the checkpoint', () => {
    let r = hurt(hurt(startRun(withOfrendas)));
    r = go(r, right, 20); // near: first touch, one life back
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.checkpoint).toEqual({ x: near.x, y: near.y });
    r = stepRun({ ...r, player: spawn(far.x, far.y) }, idle, withOfrendas); // far: later in the level, now the checkpoint
    expect(r.checkpoint).toEqual({ x: far.x, y: far.y });
    expect(r.lives.lives).toBe(LIVES_MAX); // far gave its own life
  });

  it('only forward: walking back onto an earlier ofrenda does not move the checkpoint or give a second life', () => {
    let r = go(startRun(withOfrendas), right, 20); // near used
    r = hurt(stepRun({ ...r, player: spawn(far.x, far.y) }, idle, withOfrendas)); // far used and the checkpoint, then a life lost
    const lives = r.lives.lives;
    r = stepRun({ ...r, player: spawn(near.x, near.y) }, idle, withOfrendas); // back onto near
    expect(r.checkpoint).toEqual({ x: far.x, y: far.y });
    expect(r.lives.lives).toBe(lives);
  });

  it('only forward also holds after dying: respawn at the latest ofrenda, walk back onto an earlier one, die again', () => {
    // Drops Poncho into the pit (x 80 to 128) from wherever he is, and waits out the respawn.
    const dieAndRespawn = (r: RunState) => {
      const fallen = stepRun({ ...r, player: spawn(104, 200) }, idle, withOfrendas);
      expect(fallen.phase).toBe('respawning');
      return go(fallen, idle, RESPAWN.delaySteps);
    };
    let r = go(startRun(withOfrendas), right, 20); // near
    r = stepRun({ ...r, player: spawn(far.x, far.y) }, idle, withOfrendas); // far is the checkpoint
    r = dieAndRespawn(r);
    expect(r.player).toMatchObject({ x: far.x, y: far.y });
    r = stepRun({ ...r, player: spawn(near.x, near.y) }, idle, withOfrendas); // walk back onto near
    expect(r.checkpoint).toEqual({ x: far.x, y: far.y });
    r = dieAndRespawn(r); // die again: still back at far, not near
    expect(r.player).toMatchObject({ x: far.x, y: far.y });
  });

  it('an earlier ofrenda touched for the first time after a later one still gives its life, but is not the checkpoint', () => {
    let r = hurt(startRun(withOfrendas));
    r = stepRun({ ...r, player: spawn(far.x, far.y) }, idle, withOfrendas); // skip near, touch far first
    expect(r.lives.lives).toBe(LIVES_MAX);
    r = hurt(r);
    r = stepRun({ ...r, player: spawn(near.x, near.y) }, idle, withOfrendas); // now near, for the first time
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.checkpoint).toEqual({ x: far.x, y: far.y });
  });

  it('at seven lives an ofrenda gives nothing but is used up', () => {
    let r = go(startRun(withOfrendas), right, 20);
    expect(r.lives.lives).toBe(LIVES_MAX);
    r = hurt(r);
    r = go(r, { move: -1, jumpHeld: false }, 30);
    r = go(r, right, 30);
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
  });

  it('respawns at the latest ofrenda reached, not at the start', () => {
    let r = go(startRun(withOfrendas), right, 20);
    r = fallIn(r);
    expect(r.phase).toBe('respawning');
    r = go(r, idle, RESPAWN.delaySteps);
    expect(r.phase).toBe('playing');
    expect(r.player).toMatchObject({ x: 56, y: 64, grounded: true });
  });

  it('respawns at the start when no ofrenda was touched, and the first ofrenda still counts afterwards', () => {
    let r = go(fallIn(startRun(withOfrendas)), idle, RESPAWN.delaySteps);
    expect(r.player).toMatchObject({ x: 24, y: 64 });
    r = stepRun({ ...r, player: spawn(near.x, near.y) }, idle, withOfrendas);
    expect(r.checkpoint).toEqual({ x: near.x, y: near.y });
  });

  it('a pit costs a life as usual, and the checkpoint stays', () => {
    let r = hurt(startRun(withOfrendas));
    r = go(r, right, 20); // near restores the life lost above
    r = fallIn(r);
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.checkpoint).toEqual({ x: 56, y: 64 });
  });

  it('out of lives restarts the world from the level start, with the ofrendas fresh', () => {
    let r = go(startRun(withOfrendas), right, 20); // checkpoint at x = 56, near used
    for (let i = 0; i < LIVES_MAX - 1; i++) r = hurt(r);
    r = fallIn(r);
    expect(r.lives.lives).toBe(0);
    r = go(r, idle, RESPAWN.delaySteps + 60); // the wait, then the screen's first second
    r = go(r, { move: 0, jumpHeld: true }, 1);
    r = go(r, idle, 21); // the respawn flip
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.player).toMatchObject({ x: 24, y: 64 });
    expect(r.checkpoint).toEqual({ x: 24, y: 64 });
    expect(r.lives.used.size).toBe(0);
    // and the first ofrenda counts as a checkpoint again, not only a later one
    r = go(r, right, 20);
    expect(r.checkpoint).toEqual({ x: near.x, y: near.y });
  });
});

describe('GDD-WLD-04 hilos in a run', () => {
  // Hilo 0 sits on the way at tile (2, 3), 16 px right of the spawn (box x 36 to 44, y 52 to 60: level with Poncho on the floor);
  // hilo 1 is on the far side of the pit at (9, 3), where he does not get without a jump.
  const hilos = [{ col: 2, row: 3 }, { col: 9, row: 3 }];
  const withHilos: Level = { ...level, hilos };
  const play = (r: RunState, input: PlayerInput, steps: number): RunState => {
    for (let i = 0; i < steps; i++) r = stepRun(r, input, withHilos);
    return r;
  };
  /** Runs right until the first hilo is collected. */
  const collected = (): RunState => {
    let r = startRun(withHilos);
    for (let i = 0; i < 100 && !r.hilosTaken[0]; i++) r = stepRun(r, right, withHilos);
    return r;
  };

  /** Runs right until Poncho has fallen into the pit and the run is respawning. */
  const fall = (r: RunState): RunState => {
    for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, withHilos);
    return r;
  };

  it('starts with every hilo uncollected', () => {
    expect(startRun(withHilos).hilosTaken).toEqual([false, false]);
    expect(startRun(level).hilosTaken).toEqual([]);
  });

  it('walking into a hilo collects it, and it stays collected after he walks on', () => {
    let r = startRun(withHilos);
    for (let i = 0; i < 3; i++) r = stepRun(r, right, withHilos);
    expect(r.player.x).toBeLessThan(30);
    expect(r.hilosTaken).toEqual([false, false]); // still short of it: body right edge x < 36
    r = collected();
    expect(r.hilosTaken).toEqual([true, false]);
    expect(r.player.x).toBeLessThan(46);
    r = play(r, right, 20);
    expect(r.player.x).toBeGreaterThan(50); // walked on, clear of it
    expect(r.hilosTaken).toEqual([true, false]);
  });

  it('GDD-LIFE-02 a lost life keeps every collected hilo', () => {
    let r = fall(collected());
    expect(r.phase).toBe('respawning');
    expect(r.hilosTaken).toEqual([true, false]);
    r = play(r, idle, RESPAWN.delaySteps);
    expect(r.phase).toBe('playing');
    expect(r.hilosTaken).toEqual([true, false]);
  });

  it('GDD-LIFE-05 the restart after the last life keeps every collected hilo', () => {
    let r = collected();
    for (let i = 0; i < LIVES_MAX - 1; i++) r = { ...r, lives: loseLife(r.lives) };
    r = fall(r); // into the pit, the last life
    expect(r.lives.lives).toBe(0);
    r = play(r, idle, RESPAWN.delaySteps);
    expect(r.phase).toBe('gameover');
    r = play(stepRun(play(r, idle, 60), { move: 0, jumpHeld: true }, withHilos), idle, FLIP.steps);
    expect(r).toMatchObject({ phase: 'playing' });
    expect(r.lives.lives).toBe(LIVES_MAX);
    expect(r.hilosTaken).toEqual([true, false]);
  });

  it('is not collected while waiting to respawn', () => {
    // Poncho's box overlaps the uncollected hilo 0 while he waits; the respawn puts him back at the spawn, clear of it.
    let r: RunState = { ...startRun(withHilos), phase: 'respawning', wait: RESPAWN.delaySteps, player: spawn(40, 4 * TILE) };
    for (let i = 0; i < RESPAWN.delaySteps - 1; i++) {
      r = stepRun(r, idle, withHilos);
      expect(r, `wait step ${i + 1}`).toMatchObject({ phase: 'respawning', hilosTaken: [false, false] });
    }
    r = stepRun(r, idle, withHilos);
    expect(r).toMatchObject({ phase: 'playing', hilosTaken: [false, false] });
    expect(r.player.x).toBe(24);
  });

  it('is not collected on the Siete vidas gastadas screen either', () => {
    const over: RunState = { ...startRun(withHilos), phase: 'gameover', wait: 0, player: spawn(40, 4 * TILE) };
    const r = play(over, idle, 90);
    expect(r.phase).toBe('gameover');
    expect(r.hilosTaken).toEqual([false, false]);
  });

  it('GDD-LIFE-02 a hilo touched on the step of a Base hit that costs a life is collected', () => {
    // A spike in tile (4, 3) and a hilo in the same tile: standing on it, Poncho touches both on this one step.
    const spiked: Level = { ...level, spikes: [{ col: 4, row: 3 }], hilos: [{ col: 4, row: 3 }] };
    const on: RunState = { ...startRun(spiked), player: { ...spawn(72, 4 * TILE), grounded: true } };
    expect(on.hilosTaken).toEqual([false]);
    const r = stepRun(on, idle, spiked);
    expect(r.phase).toBe('respawning');
    expect(r.lives.lives).toBe(LIVES_MAX - 1);
    expect(r.hilosTaken).toEqual([true]);
  });
});

describe('GDD-WLD-04 saved hilos', () => {
  // Hilo 0 sits on the way at tile (2, 3), as above; hilo 1 is on the far side of the pit.
  const hilos = [{ col: 2, row: 3 }, { col: 9, row: 3 }];
  const withHilos: Level = { ...level, hilos };

  it('GDD-WLD-04 a saved hilo counts as collected from the start', () => {
    const r = startRun(withHilos, [true, false]);
    expect(r.hilosTaken).toEqual([true, false]);
    expect(r.hilosSaved).toEqual([true, false]);
  });

  it('GDD-WLD-04 startRun without saved hilos starts with none, one flag per hilo', () => {
    const r = startRun(withHilos);
    expect(r.hilosTaken).toEqual([false, false]);
    expect(r.hilosSaved).toEqual([false, false]);
    expect(startRun(level).hilosSaved).toEqual([]);
  });

  it('GDD-WLD-04 a saved hilo is not collected again, and its step plays no hilo note', () => {
    let r = startRun(withHilos, [true, false]);
    let combo = NO_COMBO;
    // Walks over hilo 0 (its box is touched around x 28 to 44): no step collects, none asks for the hilo sound.
    for (let i = 0; i < 40; i++) {
      const after = stepRun(r, right, withHilos);
      const out = stepSounds(r, after, combo);
      combo = out.combo;
      expect(out.sounds.map((s) => s.name), `step ${i + 1}`).not.toContain('hilo');
      expect(after.hilosTaken, `step ${i + 1}`).toEqual([true, false]);
      r = after;
    }
    expect(r.player.x).toBeGreaterThan(60);
    expect(r.hilosSaved).toEqual([true, false]);
  });

  it('GDD-WLD-04 an unsaved hilo still plays its note when collected', () => {
    let r = startRun(withHilos, [false, false]);
    let played = 0;
    for (let i = 0; i < 40; i++) {
      const after = stepRun(r, right, withHilos);
      played += stepSounds(r, after, NO_COMBO).sounds.filter((s) => s.name === 'hilo').length;
      r = after;
    }
    expect(played).toBe(1);
    expect(r.hilosTaken).toEqual([true, false]);
    expect(r.hilosSaved).toEqual([false, false]);
  });

  it('GDD-WLD-04 the restart after the last life keeps the saved hilos and the collected ones', () => {
    let r = startRun(withHilos, [false, true]);
    for (let i = 0; i < 100 && !r.hilosTaken[0]; i++) r = stepRun(r, right, withHilos);
    expect(r.hilosTaken).toEqual([true, true]);
    for (let i = 0; i < LIVES_MAX - 1; i++) r = { ...r, lives: loseLife(r.lives) };
    for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, withHilos);
    expect(r.lives.lives).toBe(0);
    for (let i = 0; i < RESPAWN.delaySteps; i++) r = stepRun(r, idle, withHilos);
    expect(r.phase).toBe('gameover');
    for (let i = 0; i < 60; i++) r = stepRun(r, idle, withHilos);
    r = stepRun(r, { move: 0, jumpHeld: true }, withHilos);
    for (let i = 0; i < FLIP.steps; i++) r = stepRun(r, idle, withHilos);
    expect(r.phase).toBe('playing');
    expect(r.hilosTaken).toEqual([true, true]);
    expect(r.hilosSaved).toEqual([false, true]);
  });

  it('GDD-WLD-04 a lost life keeps hilosSaved', () => {
    let r = startRun(withHilos, [false, true]);
    for (let i = 0; i < 600 && r.phase === 'playing'; i++) r = stepRun(r, right, withHilos);
    for (let i = 0; i < RESPAWN.delaySteps; i++) r = stepRun(r, idle, withHilos);
    expect(r.phase).toBe('playing');
    expect(r.hilosSaved).toEqual([false, true]);
  });

  it('GDD-PRG-03 the medal counts saved hilos', () => {
    // A flat level with the exit; hilo 0 is saved and out of reach (row 5), hilo 1 is on the floor in the way.
    const flat = parseTiles([...Array<string>(14).fill('.'.repeat(30)), ...Array<string>(3).fill('#'.repeat(30))]);
    const two: Level = { ...level, world: flat, spawn: { x: 24, y: 224 }, hilos: [{ col: 2, row: 5 }, { col: 3, row: 13 }], exit: { x: 120, y: 224 } };
    const walk = (saved?: boolean[]): RunState => {
      let r = startRun(two, saved);
      for (let i = 0; i < 100 && r.phase === 'playing'; i++) r = stepRun(r, right, two);
      return r;
    };
    const cleared = walk([true, false]);
    expect(cleared.phase).toBe('clear');
    expect(cleared.hilosTaken).toEqual([true, true]);
    expect(cleared.lives.lives).toBe(LIVES_MAX);
    expect(medal(cleared, two)).toBe('gold');
    const alone = walk();
    expect(alone.hilosTaken).toEqual([false, true]);
    expect(medal(alone, two)).toBe('bronze');
  });
});
