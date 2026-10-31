// GDD-LIFE-02 and GDD-LIFE-05: one play-through of a level, tying movement, lives and respawn together.
// Pure logic, no Phaser (GDD-TEC-02). After the last life the run shows the "Siete vidas gastadas" screen until a press
// of any button, then restarts the world. Poncho respawns at the latest ofrenda he has reached, or at the start of the level (GDD-LIFE-02, GDD-LIFE-03).
import { EXIT, FIREBALL, FLIP, GAME_OVER, GLIDE, HIT, HITBOX, OFRENDA, RESPAWN, TACO, TILE } from '../config/tuning';
import { freshCrumbles, stepCrumbles, withCrumbles, type Crumble, type CrumbleState } from './crumble';
import { boxTouchesTile, clawBox, IDLE_CLAW, stepClaw, type ClawState } from './claw';
import { withFragiles, type Fragile } from './fragile';
import { boxHitsEnemy, clawHitsEnemy, defeatable, freshEnemies, harmlessFromBelow, isStomp, playDead, stepEnemy, stompBounce, stompPlaysDead, touchesEnemy, type Enemy, type EnemyState } from './enemy';
import { spawnFireball, stepFireball, type Fireball } from './fireball';
import { squareBlocked } from './item';
import { freshFlags, touchesDoor, touchesKey, withDoors, type Door, type Key } from './door';
import { releaseFrom, stepItem, touchesItem, type Item } from './item';
import { bumpedPinata, freshPinatas, withPinatas, type Pinata } from './pinata';
import { collideBlocks, moveBlocks, type MovingBlock } from './block';
import { carry, landOnPlatforms, type MovingPlatform } from './platform';
import { bounce, withSprings, type Spring } from './spring';
import { touchesSpike, type Spike } from './hazards';
import { collectHilos, freshHilos, type Hilo } from './hilo';
import { eat, freshTacos, touchesTaco, type Power, type Taco } from './taco';
import { activateOfrenda, collectVeladora, isOutOfLives, loseLife, startWorld, type LivesState } from './lives';
import { spawn, step, type Abilities, type PlayerInput, type PlayerState } from './movement';
import type { TileGrid } from './tilemap';
import { touchesVeladora, veladoraId, type Veladora } from './veladora';

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** GDD-WLD-05: a checkpoint. `x` is the middle and `y` the floor it stands on, like Poncho's own position. */
export interface Ofrenda extends Point {
  readonly id: string;
}

export interface Level {
  readonly world: TileGrid;
  /** Where Poncho appears: the middle of a tile, standing on the floor. */
  readonly spawn: Point;
  /** In the order the player meets them, which is the order they count as checkpoints (GDD-LIFE-03). */
  readonly ofrendas: readonly Ofrenda[];
  /** GDD-WLD-05: spikes. */
  readonly spikes: readonly Spike[];
  /** GDD-WLD-05: crumbling tiles. */
  readonly crumbles: readonly Crumble[];
  /** GDD-WLD-05: springs. */
  readonly springs: readonly Spring[];
  /** GDD-WLD-05: moving platforms. */
  readonly platforms: readonly MovingPlatform[];
  /** GDD-WLD-05: moving blocks, solid on every side, which crush. Left out means none. */
  readonly blocks?: readonly MovingBlock[];
  /** GDD-WLD-04: hilo pickups. Left out means none. */
  readonly hilos?: readonly Hilo[];
  /** GDD-PWR-02: taco pickups. */
  readonly tacos: readonly Taco[];
  /** GDD-PWR-05: piñata blocks. */
  readonly pinatas: readonly Pinata[];
  /** GDD-WLD-05: doors and the keys that open them. */
  readonly doors: readonly Door[];
  readonly keys: readonly Key[];
  /** GDD-WLD-05: fragile walls, broken by the claw. */
  readonly fragiles: readonly Fragile[];
  /** GDD-ENM-02: where the enemies start. */
  readonly enemies: readonly Enemy[];
  /** GDD-LIFE-03: the veladora, a pickup that restores a life once. A level has room for one. Left out means none. */
  readonly veladora?: Veladora;
  /** GDD-TEC-04, GDD-WLD-03: where the level ends: the middle of a box standing on the floor. Reaching it ends the level. Left out means none (the sandbox, a test level). */
  readonly exit?: Point;
  /** GDD-MOV-07, GDD-PRG-01: the abilities unlocked here. Left out means none. */
  readonly abilities?: Abilities;
}

export interface RunState {
  readonly player: PlayerState;
  readonly lives: LivesState;
  /**
   * 'gameover' is the "Siete vidas gastadas" screen after the last life (GDD-LIFE-05). 'clear' is the level clear screen after
   * the exit (GDD-WLD-03, GDD-UI-02), where nothing moves and only a pick on the results menu leaves it (the scene's business).
   */
  readonly phase: 'playing' | 'respawning' | 'gameover' | 'clear';
  /** Steps left before Poncho respawns while respawning; steps the screen has been up while in 'gameover' or 'clear'. */
  readonly wait: number;
  /** True during the flip that follows the screen: it cannot be skipped, since the button that ended the screen is still held. */
  readonly restarting: boolean;
  /** The buttons down on the last step, as `buttonsDown` bits; the screen after the last life counts only new presses. */
  readonly buttonsHeld: number;
  /** Steps of invulnerability left (GDD-LIFE-02, GDD-CMB-03). */
  readonly invulnerable: number;
  /** One state per `Level.crumbles` entry, in the same order (GDD-WLD-05). */
  readonly crumbles: readonly CrumbleState[];
  /** Steps the moving platforms and blocks have travelled since the level start or the last respawn (GDD-WLD-05). */
  readonly platformTick: number;
  /** GDD-PWR-01: the power-up state. A life lost always brings Poncho back in Base. */
  readonly power: Power;
  /** One flag per `Level.hilos` entry: collected? Never reset: not by a lost life, nor by the restart after the last life (GDD-WLD-04, GDD-LIFE-02, GDD-LIFE-05). */
  readonly hilosTaken: readonly boolean[];
  /** One flag per `Level.tacos` entry, in the same order: has it been picked up? They all come back on respawn. */
  readonly tacosTaken: readonly boolean[];
  /** One flag per `Level.pinatas` entry, in the same order: has it been opened? They all close again on respawn. */
  readonly pinatasOpen: readonly boolean[];
  /** GDD-PWR-02: tacos released from piñatas and still walking about. They are cleared on respawn. */
  readonly items: readonly Item[];
  /** Keys Poncho is carrying (GDD-WLD-05). One opens one door. */
  readonly keysHeld: number;
  /** One flag per `Level.keys` entry: has it been picked up? And one per `Level.doors` entry: is it open? Both reset on respawn. */
  readonly keysTaken: readonly boolean[];
  readonly doorsOpen: readonly boolean[];
  /** GDD-CMB-02: the claw swipe in progress, if any. */
  readonly claw: ClawState;
  /** One flag per `Level.fragiles` entry: has the claw broken it? They all come back on respawn. */
  readonly fragilesBroken: readonly boolean[];
  /** GDD-PWR-03: fireballs in flight, and whether the Fuego button was down on the last step (a fireball is spat on the press). */
  readonly fireballs: readonly Fireball[];
  readonly fuegoHeld: boolean;
  /** One state per `Level.enemies` entry, in the same order. They are all alive and at their start again after a respawn. */
  readonly enemies: readonly EnemyState[];
  /** Where Poncho respawns: the level start, or the latest ofrenda he has reached (GDD-LIFE-02). */
  readonly checkpoint: Point;
  /** Position in `Level.ofrendas` of the ofrenda that is the checkpoint, or -1 for the level start. Only moves forward. */
  readonly checkpointIndex: number;
  /** GDD-CMB-01: a stomp landed this step (one or more enemies), for its sound (GDD-AUD-02). */
  readonly stomped: boolean;
  /**
   * GDD-UI-02: the clear time in steps: those taken in play and in the respawn waits since the level start or the restart after the
   * last life. The clear screen and the Siete vidas gastadas screen count nothing; the pause and title screens run no step.
   */
  readonly clock: number;
  /** GDD-UI-02: a new press on the clear screen showed every line at once. */
  readonly revealAll: boolean;
}

export function startRun(level: Level): RunState {
  return { player: spawn(level.spawn.x, level.spawn.y), lives: startWorld(), phase: 'playing', wait: 0, restarting: false, buttonsHeld: 0, invulnerable: 0, checkpoint: level.spawn, checkpointIndex: -1, crumbles: freshCrumbles(level.crumbles), platformTick: 0, power: 'base', hilosTaken: freshHilos(level.hilos ?? []), tacosTaken: freshTacos(level.tacos), pinatasOpen: freshPinatas(level.pinatas), items: [], keysHeld: 0, keysTaken: freshFlags(level.keys), doorsOpen: freshFlags(level.doors), claw: IDLE_CLAW, fragilesBroken: freshFlags(level.fragiles), fireballs: [], fuegoHeld: false, enemies: freshEnemies(level.enemies), stomped: false, clock: 0, revealAll: false };
}

/** GDD-LIFE-02: Poncho has fallen into a pit once his whole body is below the bottom of the level. */
export function isInPit(player: PlayerState, world: TileGrid): boolean {
  return player.y - HITBOX.height > world.height * TILE;
}

/** GDD-WLD-05: whether Poncho's body box overlaps the ofrenda's box. Boxes that only share an edge do not touch. */
export function touchesOfrenda(player: PlayerState, o: Ofrenda): boolean {
  return (
    Math.abs(player.x - o.x) < (HITBOX.width + OFRENDA.width) / 2 &&
    player.y > o.y - OFRENDA.height &&
    player.y - HITBOX.height < o.y
  );
}

/**
 * Where Poncho appears when the wait ends: the latest ofrenda he reached, or the level start if he reached none or has
 * spent his last life (GDD-LIFE-02, GDD-LIFE-05). The respawn flip lands here too.
 */
export function respawnPoint(run: RunState, level: Level): Point {
  return isOutOfLives(run.lives) ? level.spawn : run.checkpoint;
}

/** GDD-WLD-03: whether Poncho's body box overlaps the exit's 16 x 48 box, which stands on `exit.y`. Boxes that only share an edge do not touch. */
export function touchesExit(player: PlayerState, exit: Point): boolean {
  return (
    Math.abs(player.x - exit.x) < (HITBOX.width + EXIT.width) / 2 &&
    player.y > exit.y - EXIT.height &&
    player.y - HITBOX.height < exit.y
  );
}

/** GDD-LIFE-05: which buttons are down, one bit each for jump, left, right, claw and Fuego. */
export const buttonsDown = (input: PlayerInput): number =>
  (input.jumpHeld ? 1 : 0) | ((input.left ?? input.move < 0) ? 2 : 0) | ((input.right ?? input.move > 0) ? 4 : 0) | (input.claw ? 8 : 0) | (input.fuego ? 16 : 0);

/**
 * GDD-LIFE-05, GDD-UI-02: a step on the Siete vidas gastadas screen or the level clear screen. `wait` counts its steps, this one
 * included. Only a button that was up on the last step counts, so one held since before the screen does not. `fresh` is such a new
 * press at any time, which the clear screen's reveal takes (GDD-UI-02); `press` is one after the first 1.0 s, which ends the
 * Siete vidas gastadas screen (the clear screen is left by its menu, not by a button).
 */
function screenStep(run: RunState, input: PlayerInput): { down: number; shown: number; fresh: boolean; press: boolean } {
  const shown = run.wait + 1;
  const down = buttonsDown(input);
  const fresh = (down & ~run.buttonsHeld) !== 0;
  return { down, shown, fresh, press: fresh && shown > GAME_OVER.lockoutSteps };
}

/** Advances one fixed step. Returns a new state and never mutates its input. */
export function stepRun(run: RunState, input: PlayerInput, level: Level): RunState {
  const next = stepPhase(run, input, level);
  // GDD-UI-02: a step that starts in play or in a respawn wait is on the clock, the one that reaches the exit included.
  return run.phase === 'playing' || run.phase === 'respawning' ? { ...next, clock: run.clock + 1 } : next;
}

function stepPhase(run: RunState, input: PlayerInput, level: Level): RunState {
  if (run.phase === 'clear') {
    // GDD-UI-02: nothing moves. A new press shows every line at once; no button leaves the screen, only a pick on the results menu.
    const { down, shown, fresh } = screenStep(run, input);
    return { ...run, buttonsHeld: down, wait: shown, stomped: false, revealAll: run.revealAll || fresh };
  }
  if (run.phase === 'gameover') {
    const { down, shown, press } = screenStep(run, input);
    if (!press) return { ...run, buttonsHeld: down, wait: shown, stomped: false };
    // The world restarts with all seven lives, the ofrendas unused, from the level start, after the respawn flip. The clock starts again (GDD-UI-02).
    return { ...run, buttonsHeld: down, lives: startWorld(), checkpoint: level.spawn, checkpointIndex: -1, phase: 'respawning', wait: FLIP.steps, restarting: true, stomped: false, clock: 0 };
  }
  if (run.phase === 'respawning') {
    // `elapsed` is the number of respawning steps taken including this one, so 0.3 s is step 18 and 0.8 s is step 48.
    const elapsed = RESPAWN.delaySteps - run.wait + 1;
    // GDD-LIFE-02: any input is any button held, a slide stick push included (it sets left or right).
    const skip = !run.restarting && elapsed >= RESPAWN.skipAfterSteps && buttonsDown(input) !== 0;
    const wait = skip ? 0 : run.wait - 1;
    if (wait > 0) return { ...run, wait, stomped: false };
    // GDD-LIFE-05: out of lives, the screen comes up instead of a respawn.
    if (isOutOfLives(run.lives)) return { ...run, phase: 'gameover', wait: 0, buttonsHeld: buttonsDown(input), stomped: false };
    const back = respawnPoint(run, level);
    return {
      // Marked as already holding jump, so a button held through the respawn does not make Poncho jump at once.
      player: { ...spawn(back.x, back.y), jumpWasHeld: true },
      lives: run.lives,
      checkpoint: back,
      checkpointIndex: run.checkpointIndex,
      phase: 'playing',
      wait: 0,
      restarting: false,
      buttonsHeld: 0,
      invulnerable: RESPAWN.invulnerableSteps,
      // GDD-WLD-05: the crumbled tiles come back with Poncho.
      crumbles: freshCrumbles(level.crumbles),
      platformTick: 0,
      power: 'base',
      // GDD-WLD-04, GDD-LIFE-02: collected hilos stay collected.
      hilosTaken: run.hilosTaken,
      tacosTaken: freshTacos(level.tacos),
      pinatasOpen: freshPinatas(level.pinatas),
      items: [],
      keysHeld: 0,
      keysTaken: freshFlags(level.keys),
      doorsOpen: freshFlags(level.doors),
      // A claw button held through the respawn does not swing the moment control returns (like jump, GDD-MOV-05).
      claw: { ...IDLE_CLAW, held: input.claw ?? false },
      fragilesBroken: freshFlags(level.fragiles),
      // Fireballs end with the life. Poncho is back in Base, so a held Fuego button cannot spit until he is Fuego again.
      fireballs: [],
      fuegoHeld: false,
      enemies: freshEnemies(level.enemies),
      stomped: false,
      clock: run.clock,
      revealAll: false,
    };
  }

  // GDD-WLD-05: a platform carries Poncho, then he lands on the one he came down on.
  const solid = withFragiles(withDoors(withPinatas(withCrumbles(withSprings(level.world, level.springs), level.crumbles, run.crumbles), level.pinatas), level.doors, run.doorsOpen), level.fragiles, run.fragilesBroken);
  const carried = carry(run.player, level.platforms, run.platformTick, solid);
  // GDD-WLD-05: a moving block carries or pushes him too, and stops him on every side. GDD-LIFE-02: a push or a carry up into a solid tile crushes him.
  const pushed = moveBlocks(carried, level.blocks ?? [], run.platformTick, solid);
  const stepped = step(pushed.player, input, solid, level.abilities);
  const landed = collideBlocks(pushed.player, landOnPlatforms(pushed.player, stepped, level.platforms, run.platformTick), level.blocks ?? [], run.platformTick);
  const platformTick = run.platformTick + 1;
  // GDD-WLD-05: a spring throws Poncho up the step he stands on it.
  const sprung = bounce(landed, level.springs);
  // GDD-ENM-02: the enemies patrol. GDD-CMB-01: landing on top of one defeats it and throws Poncho up, higher if jump is held
  // or was pressed just before.
  const patrolled = level.enemies.map((d, i) => stepEnemy(d, run.enemies[i]!, solid, run.player));
  const stomped = patrolled.map((e, i) => isStomp(run.player, sprung, level.enemies[i]!, e));
  const player = stomped.some(Boolean)
    ? { ...sprung, vy: -stompBounce(input.jumpHeld, sprung.jumpBuffer), grounded: false, coyote: 0, jumpBuffer: 0, gliding: false, clinging: false, glideLock: GLIDE.stompLockSteps }
    : sprung;
  const crumbles = stepCrumbles(level.crumbles, run.crumbles, player);
  // GDD-WLD-04: hilos are collected by touch on any step Poncho is in play, the step he is hit or crushed included.
  const hilosTaken = collectHilos(level.hilos ?? [], run.hilosTaken, player);
  // GDD-LIFE-03: so is the veladora, and its life counts before one lost this step. `collectVeladora` uses it up once.
  let lives = level.veladora && touchesVeladora(player, level.veladora) ? collectVeladora(run.lives, veladoraId(level.veladora)) : run.lives;
  if (pushed.crushed || isInPit(player, level.world)) {
    // GDD-LIFE-02, GDD-CMB-03: a crush costs a life like a pit, in any power-up state and even while invulnerable.
    return { ...run, player, crumbles, platformTick, hilosTaken, lives: loseLife(lives), phase: 'respawning', wait: RESPAWN.delaySteps, invulnerable: 0, power: 'base', stomped: stomped.some(Boolean) };
  }
  // GDD-PWR-02: touching a taco in Base picks it up. In Taco it stays where it is. Picked up before a hit is resolved,
  // so a taco grabbed in the same step as a spike hit is spent on it.
  let power = run.power;
  const tacosTaken = level.tacos.map((t, i) => {
    const taken = run.tacosTaken[i]!;
    if (taken || power !== 'base' || !touchesTaco(player, t)) return taken;
    power = 'taco';
    return true;
  });
  // GDD-CMB-02: the claw swing hits a box in front of Poncho. It breaks the fragile walls it overlaps for good (GDD-WLD-05).
  const claw = stepClaw(run.claw, input.claw ?? false, player.facing);
  const box = clawBox(player, claw);
  const fragilesBroken = level.fragiles.map((f, i) => run.fragilesBroken[i]! || (box !== null && boxTouchesTile(box, f.col, f.row)));
  // GDD-PWR-05: a head bump or a claw swipe opens a closed piñata once, if there is room above it for what it releases: a
  // taco in Base, otherwise a chile.
  const bumped = bumpedPinata(run.player, player, level.pinatas);
  let pinatasOpen = run.pinatasOpen;
  let items = run.items.map((it) => stepItem(it, solid)).filter((it) => it.y - TACO.size <= level.world.height * TILE);
  level.pinatas.forEach((p, i) => {
    if (run.pinatasOpen[i] || !(i === bumped || (box !== null && boxTouchesTile(box, p.col, p.row)))) return;
    const released = releaseFrom(p, solid, run.power === 'base' ? 'taco' : 'chile');
    if (!released) return;
    pinatasOpen = pinatasOpen.map((open, j) => open || j === i);
    items = [...items, released];
  });
  // GDD-PWR-06: an item is collected by touch and used up, whether or not it improves the state (when it would not, it gives
  // hilos instead, GDD-PWR-01, which are not built yet).
  items = items.filter((it) => {
    if (!touchesItem(player, it)) return true;
    power = eat(power, it.kind);
    return false;
  });
  // GDD-PWR-03: in Fuego a press of the Fuego button spits a fireball, up to FIREBALL.maxActive at once. The ones in flight move on.
  const spits = (input.fuego ?? false) && !run.fuegoHeld && run.power === 'fuego' && run.fireballs.length < FIREBALL.maxActive;
  // With no room in front of Poncho (a wall right against him) the press does nothing, so a fireball never starts inside a wall (GDD-PWR-06).
  const spat = spits ? spawnFireball(player) : null;
  const fireballs = [
    ...run.fireballs.flatMap((f) => stepFireball(f, solid) ?? []),
    ...(spat && !squareBlocked(solid, spat.x, spat.y, FIREBALL.size) ? [spat] : []),
  ];
  // GDD-WLD-05: a key is picked up by touch. Then a shut door that Poncho touches at its side opens for good and uses up
  // one key, so a key picked up the same step as a door is touched opens it.
  let keysHeld = run.keysHeld;
  const keysTaken = level.keys.map((k, i) => {
    if (run.keysTaken[i] || !touchesKey(player, k)) return run.keysTaken[i]!;
    keysHeld++;
    return true;
  });
  const doorsOpen = level.doors.map((d, i) => {
    if (run.doorsOpen[i]) return true;
    if (keysHeld === 0 || !touchesDoor(player, d)) return false;
    keysHeld--;
    return true;
  });
  // GDD-CMB-02, GDD-PWR-03: the claw and a fireball defeat the enemies they overlap, besides a stomp. Every fireball that
  // overlaps a live enemy is used up, whatever defeats the enemy that step (and even the cactus buddy, which nothing defeats).
  // GDD-ENM-02: a Tlacuache's first stomp only makes it play dead, unless the claw or a fireball defeats it the same step. The
  // claw defeats one that is playing dead too.
  const fireballHits = (f: Fireball, i: number): boolean =>
    boxHitsEnemy({ x0: f.x - FIREBALL.size / 2, x1: f.x + FIREBALL.size / 2, y0: f.y - FIREBALL.size, y1: f.y }, level.enemies[i]!, patrolled[i]!);
  const enemies = patrolled.map((e, i) => {
    const def = level.enemies[i]!;
    if (!defeatable(def)) return e;
    if ((box !== null && clawHitsEnemy(box, def, e)) || fireballs.some((f) => fireballHits(f, i))) return { ...e, alive: false };
    if (!stomped[i]) return e;
    return stompPlaysDead(def, e) ? playDead(e) : { ...e, alive: false };
  });
  const flying = fireballs.filter((f) => !patrolled.some((_, i) => fireballHits(f, i)));
  // GDD-WLD-05, GDD-ENM-02, GDD-CMB-03: touching a spike or an enemy is a hit, unless Poncho is invulnerable. In Base it
  // costs a life (GDD-LIFE-02); in Taco the taco is spent instead, in Fuego the Fuego, and Poncho is pushed away from what
  // hit him and invulnerable for 2.0 s.
  const spike = run.invulnerable === 0 ? level.spikes.find((s) => touchesSpike(player, s)) : undefined;
  const enemy = run.invulnerable === 0 ? enemies.findIndex((e, i) => touchesEnemy(player, level.enemies[i]!, e) && !harmlessFromBelow(run.player, player, level.enemies[i]!, e)) : -1;
  const hitFrom = spike ? spike.col * TILE + TILE / 2 : enemy >= 0 ? enemies[enemy]!.x : undefined;
  if (hitFrom !== undefined && power === 'base') {
    return { ...run, player, crumbles, platformTick, hilosTaken, tacosTaken, pinatasOpen, items, fragilesBroken, enemies, lives: loseLife(lives), phase: 'respawning', wait: RESPAWN.delaySteps, invulnerable: 0, power: 'base', stomped: stomped.some(Boolean) };
  }
  let hurt = player;
  if (hitFrom !== undefined) {
    power = power === 'fuego' ? 'taco' : 'base';
    const away = Math.sign(player.x - hitFrom) || -player.facing;
    hurt = { ...player, vx: away * HIT.knockback };
  }
  // GDD-LIFE-03: touching an ofrenda restores a life the first time only. It becomes the checkpoint only if it is later
  // in the level than the current one, so walking back never moves the respawn point backwards. `Level.ofrendas` is in
  // the order they are met.
  let { checkpoint, checkpointIndex } = run;
  level.ofrendas.forEach((o, index) => {
    if (!touchesOfrenda(player, o)) return;
    lives = activateOfrenda(lives, o.id);
    if (index > checkpointIndex) {
      checkpoint = { x: o.x, y: o.y };
      checkpointIndex = index;
    }
  });
  const next: RunState = { ...run, player: hurt, crumbles, platformTick, lives, checkpoint, checkpointIndex, power, hilosTaken, tacosTaken, pinatasOpen, items, keysHeld, keysTaken, doorsOpen, fragilesBroken, fireballs: flying, enemies, stomped: stomped.some(Boolean), fuegoHeld: input.fuego ?? false, claw: hitFrom !== undefined ? { ...claw, phase: 'idle', steps: 0 } : claw, invulnerable: hitFrom !== undefined ? HIT.invulnerableSteps : Math.max(0, run.invulnerable - 1) };
  // GDD-WLD-03: reaching the exit ends the level. A hit in Base, a pit and a crush returned above, so they win; a hit the taco or
  // the Fuego absorbed does not. `wait` is already 0 in play. The buttons down now are held, so one held as Poncho reaches the exit
  // is no new press for the reveal (GDD-UI-02).
  if (level.exit && touchesExit(hurt, level.exit)) return { ...next, phase: 'clear', buttonsHeld: buttonsDown(input) };
  return next;
}
