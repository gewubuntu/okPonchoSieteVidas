// Placeholder scene: proves the loop (input, fixed-step simulation, tile collision, pits, rendering) on the sandbox level.
// Poncho is drawn from his sprite sheet (GDD-ART-02, GDD-ART-04), and the backdrop and the ground tiles are World 1's desert art
// (GDD-ART-06); the rest is placeholder until its art (GDD-ART-01), Tiled levels with GDD-TEC-04.
import Phaser from 'phaser';
import { ART_SCALE, BACKDROP, BACKDROP_ART, BASE_HEIGHT, BASE_WIDTH, EXIT, GAME_OVER, HILO, HITBOX, MEDAL, OFRENDA, PAUSE_MENU, PLANTS, SETTINGS_MENU, SPIKE, SPRITE_FRAME, TILE, TIPS, TITLE_MENU, VELADORA } from '../config/tuning';
import { kindOf, type EnemyKind, type EnemyState } from '../sim/enemy';
import { levelById, startLevel, TUTORIAL_ID, type LevelEntry } from '../levels';
import { FixedStepper } from '../sim/fixedStep';
import ponchoPng from '../../assets/sprites/poncho.png';
import skyStripsPng from '../../assets/sprites/desierto/sky-strips.png';
import sunPng from '../../assets/sprites/desierto/sun.png';
import cloud0Png from '../../assets/sprites/desierto/cloud-0.png';
import cloud1Png from '../../assets/sprites/desierto/cloud-1.png';
import cloud2Png from '../../assets/sprites/desierto/cloud-2.png';
import cloud3Png from '../../assets/sprites/desierto/cloud-3.png';
import mountainsPng from '../../assets/sprites/desierto/mountains.png';
import groundPng from '../../assets/sprites/desierto/ground.png';
import plantsPng from '../../assets/sprites/desierto/plants.png';
import farDesertPng from '../../assets/sprites/desierto/far-desert.png';
import ofrendaOgg from '../../assets/audio/sfx/ofrenda.ogg';
import ofrendaMp3 from '../../assets/audio/sfx/ofrenda.mp3';
import jumpOgg from '../../assets/audio/sfx/jump.ogg';
import jumpMp3 from '../../assets/audio/sfx/jump.mp3';
import landOgg from '../../assets/audio/sfx/land.ogg';
import landMp3 from '../../assets/audio/sfx/land.mp3';
import clawOgg from '../../assets/audio/sfx/claw.ogg';
import clawMp3 from '../../assets/audio/sfx/claw.mp3';
import stompOgg from '../../assets/audio/sfx/stomp.ogg';
import stompMp3 from '../../assets/audio/sfx/stomp.mp3';
import hiloOgg from '../../assets/audio/sfx/hilo.ogg';
import hiloMp3 from '../../assets/audio/sfx/hilo.mp3';
import lifeLostOgg from '../../assets/audio/sfx/life-lost.ogg';
import lifeLostMp3 from '../../assets/audio/sfx/life-lost.mp3';
import meowOgg from '../../assets/audio/sfx/meow.ogg';
import meowMp3 from '../../assets/audio/sfx/meow.mp3';
import tickOgg from '../../assets/audio/sfx/tick.ogg';
import tickMp3 from '../../assets/audio/sfx/tick.mp3';
import { activateOfrenda, collectVeladora, isOutOfLives, loseLife } from '../sim/lives';
import { spawn, type PlayerInput, type PlayerState } from '../sim/movement';
import { clawBox } from '../sim/claw';
import { FIREBALL, TLACUACHE } from '../config/tuning';
import { flipPose } from '../sim/respawnFlip';
import { blockAt } from '../sim/block';
import { platformAt } from '../sim/platform';
import { buttonsDown, respawnPoint, startRun, stepRun, type Level, type RunState } from '../sim/run';
import type { TileGrid } from '../sim/tilemap';
import { isPortrait, pauseFrame, PLAYING, resumeHeld, type MenuItem, type PauseEvent, type PauseState } from '../sim/pause';
import { readSave, SAVE_KEY, saveText } from '../sim/save';
import { browserLanguage, DEFAULT_SETTINGS, sfxVolume, type Language, type Settings, type SettingsRow } from '../sim/settings';
import { TITLE, titleAfterQuit, titleFrame, titlePrompt, type TitleItem, type TitleState } from '../sim/title';
import { hilosCollected } from '../sim/hilo';
import { clearTime, medal, medalLabel, medalLine, revealedLines } from '../sim/results';
import { veladoraUsed } from '../sim/veladora';
import { NO_COMBO, noteRate, stepSounds, type HiloCombo, type SfxName } from '../sim/sfx';
import type { Power } from '../sim/taco';
import { parallaxOffset } from '../ui/backdrop';
import { followCamera } from '../ui/camera';
import { dashedRect } from '../ui/dashed';
import { GamepadReader } from '../ui/gamepad';
import { groundFrame } from '../ui/groundTiles';
import { plantSpots } from '../ui/plants';
import { effectiveHeld, InputLatch } from '../ui/inputLatch';
import { crackFrame, crackLine, updateCracks, type Crack } from '../ui/lifeCrack';
import { lastLifePulse, pulsedPoints, updatePulseStart } from '../ui/lastLife';
import { HILO_COLOURS, HILO_HUD, hiloColour, hiloCounterRight, hiloCounterText } from '../ui/hiloCounter';
import { layoutLives, LIVES_HUD } from '../ui/livesLayout';
import { gamePoint } from '../ui/gamePoint';
import { startAnim, stepAnim, STAND, type PonchoAnim } from '../ui/ponchoAnim';
import { layoutPauseMenu, layoutTitleMenu, pauseMenuItemAt, titleMenuItemAt, type MenuRow } from '../ui/pauseMenu';
import { languageValueX, layoutSettingsMenu, settingsTapAt, volumeBars, type SettingsMenuRow } from '../ui/settingsMenu';
import { LANGUAGE_NAMES, TEXT } from '../ui/text';
import { activeTip, highlightBox, initialDevice, NO_TIP, pulse, stepTipFade, tipsDone as nextTipsDone, tipText, type Device, type TipFade } from '../ui/tips';
import { TouchControls, type TouchDebug } from '../ui/TouchControls';

/** GDD-AUD-02: the cache keys of every sound effect. */
const SFX_KEYS = ['ofrenda', 'jump', 'land', 'claw', 'stomp', 'hilo', 'lifeLost', 'meow', 'tick'].map((n) => `sfx-${n}`);
/** GDD-CTL-02: the pads the browser reports now. `getGamepads` can throw where a permissions policy forbids it. */
const readGamepads = () => {
  try {
    return navigator.getGamepads?.() ?? [];
  } catch {
    return [];
  }
};
/** How many ofrendas an `usedKey` string marks as used. */
const countUsed = (key: string) => key.split('1').length - 1;
const down = (keys: Phaser.Input.Keyboard.Key[]) => keys.some((k) => k.isDown);
/** Down, leaving out the keys held back since a pause (GDD-UI-02). */
const downExcept = (keys: Phaser.Input.Keyboard.Key[], held: ReadonlyMap<Phaser.Input.Keyboard.Key, number>) => keys.some((k) => k.isDown && !held.has(k));
/** Steps per half of the invulnerability blink (0.1 s). */
const BLINK_STEPS = 6;

/** The colour a text was last set to, as the string it was given. */
const colorOf = (t: Phaser.GameObjects.Text): string => (typeof t.style.color === 'string' ? t.style.color : '');

/** Dev-only hook for the `harness-playtest` skill. Exposed only by the Vite dev server (see PlayScene.create). */
export interface PonchoDebug {
  state(): PlayerState;
  ticks(): number;
  /** Highest point above the floor reached in the most recent completed jump, in px. */
  peakRise(): number;
  /** Lives left according to the game state. */
  lives(): number;
  /** Triangles currently drawn filled on the HUD. Read from what was drawn, not from the game state. */
  hudFilled(): number;
  /** Test hooks: stand in for hazards and checkpoints until they exist (GDD-LIFE-02, GDD-LIFE-03). */
  loseLife(): void;
  activateOfrenda(id: string): void;
  /** Puts Poncho at (x, y), feet position, at rest and in the air. */
  teleport(x: number, y: number): void;
  /**
   * 'playing', 'respawning' while waiting after a lost life (GDD-LIFE-02), 'gameover' on the Siete vidas gastadas screen (GDD-LIFE-05),
   * or 'clear' on the level clear screen after the exit (GDD-WLD-03, GDD-UI-02).
   */
  phase(): RunState['phase'];
  /** The step count (`ticks()`) when the phase last changed, so a playtest can time a phase in steps however fast the frames come. */
  phaseSince(): number;
  /** The Siete vidas gastadas screen as drawn: whether it is shown, its title and "Game over" lines, and whether its prompt line is (GDD-LIFE-05). */
  gameOverDrawn(): { shown: boolean; title: string; subtitle: string; prompt: boolean; promptText: string };
  /**
   * The level clear screen as drawn (GDD-UI-02): whether it is shown, its "Level clear!" line, its hilo line ("Hilos 31/50", read from
   * the text drawn), its time line ("Time 2:14"), its medal line's text and the colour the text is drawn in ("#c7834a"), how many of
   * the hilo, time and medal lines are visible (0 to 3, counted from the drawn objects), where the medal's disc has its middle and
   * its text its left edge and how wide the text is (game px), and whether its prompt line is shown, with its text.
   */
  clearDrawn(): { shown: boolean; title: string; hilos: string; time: string; medal: string; medalColour: string; lines: number; discX: number; textX: number; medalWidth: number; prompt: boolean; promptText: string };
  /**
   * One entry for each frame the level clear screen was drawn since it last came up: the run's `wait` (steps it has been up) and how
   * many of its lines were visible then (GDD-UI-02). Reset when a clear screen comes up.
   */
  clearReveal(): { wait: number; lines: number }[];
  /** The id of the level played, `0-1` or `sandbox` (GDD-UI-02). Read from the choice the scene made at load. */
  level(): string;
  /**
   * The camera (GDD-UI-04): `scrollX`, the scroll the scene last passed to Phaser, and `viewX`, the level x Phaser draws at the
   * screen's left edge (`cameras.main.getWorldPoint(0, 0).x`, from the matrix it renders with), both in game px. Not `worldView.x`:
   * Phaser centres that rectangle on the camera as if its origin were the middle, which ours is not.
   */
  camera(): { scrollX: number; viewX: number };
  /**
   * How far the backdrop's clouds, mountains and far desert strip are shifted (GDD-ART-06), in game px, read back from what was drawn: the
   * clouds from where the first cloud's image stands against its place at the start, the mountains and the strip from their layers'
   * `tilePositionX / ART_SCALE`.
   */
  backdrop(): { clouds: number; mountains: number; desert: number };
  /** Where the backdrop's fixed parts are drawn (GDD-ART-06), in game px on the screen, read from the drawn objects: the sun's centre, the top of the mountains' ridge band and of its flat foot, the top of the far desert strip. */
  backdropLayout(): { sunX: number; sunY: number; mountainsY: number; footY: number; desertY: number };
  /** The frame of the ground sheet drawn at tile (tx, ty), or null where no ground image is (GDD-ART-06). Read from the drawn image. */
  groundFrame(tx: number, ty: number): number | null;
  /** The plants drawn in the level (GDD-ART-06): each one's kind (its frame in the plants' sheet), where its foot is drawn (the middle of its tile, in game px) and its depth. Read from the drawn images. */
  plants(): { kind: number; x: number; y: number; depth: number }[];
  /**
   * The tutorial tip as drawn (GDD-UI-05): the index of the tip shown (null while none is, faded out included), its text, its opacity,
   * the device its words name, the un-grown outline box in level px (null for none) and how many px the drawn outline has grown by on
   * each side (0 to 2, with the pulse), the touch button outlined with it, and the text box on screen in game px. Read from what was drawn.
   */
  tip(): { index: number | null; text: string; alpha: number; device: Device; highlight: { x: number; y: number; w: number; h: number } | null; grow: number; button: string | null; box: { x: number; y: number; w: number; h: number } };
  /** The tips whose thing is done, by tip (GDD-UI-05). */
  tipsDone(): boolean[];
  /** The lines Phaser wraps `text` into with the tip text's style and wrap width (GDD-UI-05), so a playtest can check a tip fits its two lines. */
  wrapTip(text: string): string[];
  /** Whether the placeholder title, controls and dev lines at the top of the level start exist (the tutorial has none, GDD-UI-05). */
  placeholderLines(): boolean;
  /** Whether the veladora is painted in the level (GDD-LIFE-03), and whether the exit's arch is (GDD-WLD-03). Read from what was drawn. */
  veladoraDrawn(): boolean;
  exitDrawn(): boolean;
  /** Steps of invulnerability left after a respawn (GDD-LIFE-02). */
  invulnerable(): number;
  /** Whether Poncho's body is drawn, and how opaque (hidden while waiting to respawn, dim half of the blink). */
  bodyVisible(): boolean;
  bodyAlpha(): number;
  /** Where the body is drawn: feet position, and turn in radians (GDD-LIFE-02 respawn flip). */
  bodyPose(): { x: number; y: number; rotation: number };
  /** Poncho's sprite as passed to Phaser (GDD-ART-04): the sheet frame, whether it is mirrored, its displayed size and its bottom edge and middle in game px. */
  ponchoSprite(): { frame: number; flipX: boolean; width: number; height: number; bottom: number; centerX: number };
  /** Each ofrenda as drawn: its id and whether it is drawn as used. Read from what was drawn, not from the game state. */
  ofrendas(): { id: string; x: number; used: boolean }[];
  /** Every sound effect asked for so far, in order (GDD-AUD-02); a hilo note is `hilo:<semitones>`. Browsers keep audio locked until a first gesture. */
  sfx(): string[];
  /** Whether every sound effect file was loaded and decoded into the audio cache. */
  sfxLoaded(): boolean;
  /** Every sound effect handed to the audio system, with the playback rate and the volume it was given (GDD-AUD-02, GDD-AUD-01). */
  sfxPlayed(): { key: string; rate: number; volume: number }[];
  /** Triangles the HUD was asked to draw as cracking (GDD-LIFE-02): the place in the row and the fill and crack alpha. The pixels themselves are checked by reading the screenshot. */
  hudCracking(): { index: number; fillAlpha: number; crackAlpha: number }[];
  /** The scale the last triangle was drawn at while one life is left, or null when it does not pulse (GDD-LIFE-04). */
  hudPulse(): number | null;
  /** Freezes the simulation and the animations on the current frame, for screenshots and pixel tests. Not the player's pause. */
  pause(on: boolean): void;
  /** The player's pause (GDD-UI-02): whether the level is paused, whether because the phone is upright, and the chosen menu item. */
  playerPause(): PauseState;
  /**
   * The pause screen as drawn: whether it is shown, its title and its prompt line ("Turn your device sideways" upright, in the language in use, empty
   * otherwise), and the pause menu (GDD-UI-02): whether it is shown (not upright), its three items' texts and colours, the item the
   * ">" stands beside and the ">" 's y, both null while the menu is hidden.
   */
  pauseDrawn(): {
    shown: boolean;
    title: string;
    prompt: string;
    promptSize: number;
    menu: { shown: boolean; items: string[]; colors: string[]; chosen: MenuItem | null; markerY: number | null };
  };
  /** The pause menu's rows as laid out now, in game px, for tapping them (GDD-UI-02). */
  pauseMenu(): MenuRow[];
  /**
   * The title screen as drawn (GDD-UI-02): whether it is shown (not while its settings screen covers it), its two title lines, its
   * prompt and size, whether Poncho is drawn on it and where his feet are (game px), and the title menu: whether it is shown (not upright), its
   * three items' texts and colours, the item the ">" stands beside and the ">" 's y, both null while the menu is hidden.
   */
  titleDrawn(): {
    shown: boolean;
    title: string;
    subtitle: string;
    prompt: string;
    promptSize: number;
    ponchoShown: boolean;
    ponchoBottom: number;
    menu: { shown: boolean; items: string[]; colors: string[]; chosen: TitleItem | null; markerY: number | null };
  };
  /** The title menu's rows as laid out now, in game px, for tapping them (GDD-UI-02). */
  titleMenu(): MenuRow<TitleItem>[];
  /**
   * The settings screen as drawn (GDD-UI-02): whether it is shown, its title and its prompt line ("Turn your device sideways"
   * upright, empty otherwise), the menu it was opened from, its rows (the label, the bars drawn filled for a volume row, the language
   * name for the Language row, null for Back, and the colour; for the Language row also the x of the name, in game px) and the row
   * the chosen look is on. The rows are empty and `chosen` null while it is hidden or upright.
   */
  settingsDrawn(): {
    shown: boolean;
    title: string;
    prompt: string;
    from: 'pause' | 'title' | null;
    rows: { item: SettingsRow; label: string; value: number | string | null; color: string; valueX?: number }[];
    chosen: SettingsRow | null;
  };
  /** The settings screen's rows as laid out now, in game px, for tapping them (GDD-UI-02). */
  settingsMenu(): SettingsMenuRow[];
  /** The volumes and the language in use now (GDD-UI-02, GDD-AUD-01). */
  settings(): Settings;
  /** Whether the tutorial 0-1 has been started, in the browser's save or in this visit (GDD-UI-02, GDD-PRG-02). */
  tutorialPlayed(): boolean;
  /** While paused, runs exactly `n` simulation steps, with no input unless given, so a frame can be reached without timing luck. */
  step(n: number, input?: PlayerInput): void;
  /** The touch buttons: whether shown (touch devices only), where they are, and which are drawn pressed (GDD-CTL-03). */
  touch(): TouchDebug;
  /** Where each moving platform is: the left end of its top surface and its width (GDD-WLD-05). */
  platforms(): { x: number; y: number; w: number }[];
  /** Where each moving block is: its top left corner and size (GDD-WLD-05). */
  blocks(): { x: number; y: number; w: number; h: number }[];
  /** The crumbling tiles and their state, read from the run (GDD-WLD-05). */
  crumbles(): { col: number; row: number; phase: string; steps: number }[];
  /** Where Poncho would respawn now (GDD-LIFE-02). */
  checkpoint(): { x: number; y: number };
  /** The power-up state (GDD-PWR-01), and the taco pickups the scene painted in the level (GDD-PWR-02). */
  power(): Power;
  tacosDrawn(): number;
  /** GDD-WLD-04: the hilos collected and the level's total, read from the run, and the pickups the scene painted in the level. */
  hilos(): { taken: number; total: number; drawn: number };
  /** GDD-UI-01: the hilo counter as drawn: its text, the right edge and top of the text, and the middle x of the skein icon. */
  hudHilos(): { text: string; right: number; top: number; iconX: number };
  /** Whether the taco in Poncho's hand and the power-up icon on the HUD are drawn. Read from what was drawn. */
  heldTacoVisible(): boolean;
  /** Each piñata as drawn: whether it is drawn open (GDD-PWR-05). And the walking tacos as drawn: where their feet are (GDD-PWR-02). */
  pinatasDrawn(): boolean[];
  itemsDrawn(): { x: number; y: number; kind: string }[];
  /** Keys Poncho carries, the keys still drawn on the floor, the doors drawn open, and the key icons on the HUD (GDD-WLD-05). Read from what was drawn. */
  keysHeld(): number;
  keysDrawn(): number;
  doorsDrawn(): boolean[];
  hudKeys(): number;
  /** The claw phase in the simulation, what was drawn for it, and the fragile wall tiles the scene painted (GDD-CMB-02, GDD-WLD-05). */
  claw(): 'idle' | 'windup' | 'swing';
  /** How many swings have started since the page loaded (GDD-CMB-02). */
  swings(): number;
  clawDrawn(): 'none' | 'windup' | 'swing';
  fragilesDrawn(): number;
  hudPowerIcon(): boolean;
  /** The power-up state painted in Poncho's hand and on the HUD, and the fireballs in the simulation and the ones painted (GDD-PWR-03). */
  heldPowerDrawn(): Power;
  hudPowerDrawn(): Power;
  fireballs(): number;
  /** Fireballs spat since the page loaded, and where the ones in flight are (GDD-PWR-03). */
  spits(): number;
  fireballAt(): { x: number; y: number }[];
  fireballsDrawn(): number;
  /** The enemies in the simulation, and where the scene painted the live ones (GDD-ENM-02). */
  enemies(): { x: number; y: number; alive: boolean; dir: number; phase: string }[];
  enemiesDrawn(): { x: number; y: number; kind: EnemyKind }[];
  /** GDD-MOV-07: whether the spread poncho is drawn over Poncho (gliding). Read from what was drawn. */
  glideDrawn(): boolean;
  /** GDD-MOV-08: the side the claw marks are drawn on while sliding down a wall (-1 left, 1 right), or 0. Read from what was drawn. */
  clingDrawn(): -1 | 0 | 1;
  /** Test hook: puts Poncho in a power-up state without playing for it. */
  setPower(power: Power): void;
}

declare global {
  interface Window {
    __PONCHO__?: PonchoDebug;
  }
}

/** GDD-UI-02: how a scene is made. `entry` is the level it draws; `direct` skips the title (the next level, played at once); `title` replaces the opening title. */
interface PlayOptions {
  readonly entry?: LevelEntry;
  readonly direct?: boolean;
  readonly title?: TitleState;
}

/** Scenes made so far: the first is 'play', the others need keys of their own, since a removed scene's key is free only after the frame. */
let scenesMade = 0;

/** GDD-PRG-02: set once the tutorial starts in this visit, so it holds where the browser refuses storage. */
let playedThisVisit = false;

/** GDD-UI-02, GDD-PRG-02: the volumes and the language last set in this visit, so a new scene (the next level, a title over another level) keeps them where the browser refuses storage. */
let settingsThisVisit: Settings | null = null;

/** GDD-PRG-02: whether the saved game says the tutorial was started, when the game opens; false where the browser refuses storage. */
function savedTutorialPlayed(): boolean {
  try {
    return readSave(window.localStorage.getItem(SAVE_KEY)).tutorialPlayed;
  } catch {
    return false;
  }
}

export class PlayScene extends Phaser.Scene {
  private readonly stepper = new FixedStepper();
  // GDD-UI-02: the level played, 0-1, 1-1 or the sandbox. GDD-MOV-06: Poncho collides with its tile grid. The spawn stands on the
  // floor, so its y is the floor level.
  private readonly entry: LevelEntry;
  private readonly level: Level;
  private readonly world: TileGrid;
  private readonly floorY: number;
  private run: RunState;
  private prevPlayer: PlayerState;
  private ticks = 0;
  /** The step count when the run's phase last changed (`PonchoDebug.phaseSince`). */
  private phaseSince = 0;
  private peak = 0;
  private lastPeak = 0;
  private hud!: Phaser.GameObjects.Graphics;
  private hudFilled = 0;
  /** GDD-LIFE-04: the scale the last triangle was drawn at, or null, and the step its pulse started on. */
  private pulseDrawn: number | null = null;
  private pulseStart: number | null = null;
  private platformGfx!: Phaser.GameObjects.Graphics;
  private blockGfx!: Phaser.GameObjects.Graphics;
  private crumbleGfx!: Phaser.GameObjects.Graphics;
  private crumblesKey = '';
  private tacoGfx!: Phaser.GameObjects.Graphics;
  private heldGfx!: Phaser.GameObjects.Graphics;
  private tacosKey = '';
  private hiloGfx!: Phaser.GameObjects.Graphics;
  private hilosKey = '';
  private hilosPainted = 0;
  /** GDD-UI-01: the hilo counter's text and the graphics behind its skein icon, and the text and right edge it was last drawn with. */
  private hiloText!: Phaser.GameObjects.Text;
  private hiloIcon!: Phaser.GameObjects.Graphics;
  private hiloHudKey = '';
  private hiloIconX = 0;
  private tacosPainted = 0;
  private pinatasPainted: boolean[] = [];
  private doorsPaintedShut: boolean[] = [];
  private keysPainted = 0;
  private pinataGfx!: Phaser.GameObjects.Graphics;
  private itemGfx!: Phaser.GameObjects.Graphics;
  private pinatasKey = '';
  private doorGfx!: Phaser.GameObjects.Graphics;
  private keyGfx!: Phaser.GameObjects.Graphics;
  private doorsKey = '';
  private hudKeyCount = 0;
  private itemsDrawn: { x: number; y: number; kind: string }[] = [];
  private hudPower: Power = 'base';
  private heldPower: Power = 'base';
  private fireballGfx!: Phaser.GameObjects.Graphics;
  private fireballsPainted = 0;
  private enemyGfx!: Phaser.GameObjects.Graphics;
  private enemiesPainted: { x: number; y: number; kind: EnemyKind }[] = [];
  private readonly fuegoLatch = new InputLatch();
  private ofrendaGfx!: Phaser.GameObjects.Graphics;
  private ofrendasDrawn: { id: string; x: number; used: boolean }[] = [];
  private drawnLives = 0;
  private cracks: Crack[] = [];
  private cracksDrawn: { index: number; fillAlpha: number; crackAlpha: number }[] = [];
  private paused = false;
  /** GDD-UI-02: the player's pause, the events that change it since the last frame, and the pause screen. */
  private pauseState: PauseState = PLAYING;
  private pauseEvents: PauseEvent[] = [];
  private pauseScreen!: Phaser.GameObjects.Container;
  private pauseTitle!: Phaser.GameObjects.Text;
  private pausePrompt!: Phaser.GameObjects.Text;
  /** GDD-UI-02: the pause menu's two item texts, the ">" in front of the chosen one, and the rows as last laid out. */
  private pauseItems!: Record<MenuItem, Phaser.GameObjects.Text>;
  private pauseMarker!: Phaser.GameObjects.Text;
  private pauseRows: MenuRow[] = layoutPauseMenu(1);
  /** GDD-UI-02, GDD-AUD-01: the volumes, loaded from the browser's storage (GDD-PRG-02), and the settings screen. */
  private settings: Settings = DEFAULT_SETTINGS;
  /** GDD-UI-02, GDD-PRG-02: whether 0-1 has been started, which decides what "Start" plays. Saved with the settings. */
  private tutorialPlayed = false;
  private settingsScreen!: Phaser.GameObjects.Container;
  private settingsVeil!: Phaser.GameObjects.Rectangle;
  private settingsTitle!: Phaser.GameObjects.Text;
  private settingsPrompt!: Phaser.GameObjects.Text;
  private settingsLabels!: Record<SettingsRow, Phaser.GameObjects.Text>;
  private settingsArrows!: Phaser.GameObjects.Text[];
  private settingsLanguageValue!: Phaser.GameObjects.Text;
  private settingsBars!: Phaser.GameObjects.Graphics;
  private settingsMarker!: Phaser.GameObjects.Text;
  private settingsRows: SettingsMenuRow[] = layoutSettingsMenu(1);
  /** GDD-UI-02: the language every text was last set in, so a change is seen and the texts are set again. */
  private textLanguage: Language = DEFAULT_SETTINGS.language;
  private settingsPainted: ReturnType<PonchoDebug['settingsDrawn']> = { shown: false, title: '', prompt: '', from: null, rows: [], chosen: null };
  /** GDD-UI-02: the title screen, and its menu's three item texts, the ">" in front of the chosen one, and the rows as last laid out. */
  private title: TitleState = TITLE;
  private titleItems!: Record<TitleItem, Phaser.GameObjects.Text>;
  private titleMarker!: Phaser.GameObjects.Text;
  private titleRows: MenuRow<TitleItem>[] = layoutTitleMenu(1);
  private titleScreen!: Phaser.GameObjects.Container;
  private titleText!: Phaser.GameObjects.Text;
  private titleSubtitle!: Phaser.GameObjects.Text;
  private titlePromptText!: Phaser.GameObjects.Text;
  private titlePoncho!: Phaser.GameObjects.Container;
  private titlePonchoSprite!: Phaser.GameObjects.Image;
  /** The last render interpolation factor, so a paused frame keeps the picture it had. */
  private alpha = 0;
  /** Which ofrendas the drawing shows as used, as a key, so a change of the set itself (not only its size) redraws. */
  private ofrendasKey = '';
  private sfxLog: string[] = [];
  private sfxPlayed: { key: string; rate: number; volume: number }[] = [];
  /** GDD-AUD-02: how far up the scale the hilo notes have climbed. */
  private hiloCombo: HiloCombo = NO_COMBO;
  private devOfrendas = 0;
  private devVeladoras = 0;
  private devKeys?: Record<'lose' | 'ofrenda' | 'veladora', Phaser.Input.Keyboard.Key>;
  /** Poncho (GDD-ART-04): his sheet frame at the box's feet, in a container at the middle of the body box, with the glide and cling placeholders. */
  private body!: Phaser.GameObjects.Container;
  private bodySprite!: Phaser.GameObjects.Image;
  /** GDD-ART-04: which frame shows, advanced by each simulation step. */
  private anim: PonchoAnim;
  /** GDD-MOV-07: the poncho spread like a parachute over the body while gliding (placeholder). */
  private glideGfx!: Phaser.GameObjects.Graphics;
  /** GDD-MOV-08: claw marks on the wall side of the body while sliding down a wall (placeholder), and the side drawn. */
  private clingGfx!: Phaser.GameObjects.Graphics;
  private clingPainted: -1 | 0 | 1 = 0;
  private touch!: TouchControls;
  /** GDD-CTL-02: the gamepads, read once per frame at the top of `update`. */
  private readonly pad = new GamepadReader();
  private keys!: Record<'left' | 'right' | 'jump' | 'claw' | 'fuego', Phaser.Input.Keyboard.Key[]>;
  private fragileGfx!: Phaser.GameObjects.Graphics;
  private clawGfx!: Phaser.GameObjects.Graphics;
  private fragilesKey = '';
  private fragilesPainted = 0;
  /** L-006: key presses latched from raw key events, so a tap shorter than a frame still reaches a step. */
  private readonly jumpLatch = new InputLatch();
  /** GDD-LIFE-05: the Siete vidas gastadas screen and its prompt line. */
  private gameOver!: Phaser.GameObjects.Container;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverSubtitle!: Phaser.GameObjects.Text;
  private gameOverPrompt!: Phaser.GameObjects.Text;
  /** GDD-UI-02: the level clear screen: its title, hilo line and prompt line. */
  private clearScreen!: Phaser.GameObjects.Container;
  private clearTitle!: Phaser.GameObjects.Text;
  private clearHilos!: Phaser.GameObjects.Text;
  private clearTime!: Phaser.GameObjects.Text;
  /** The medal line: a disc and its text, in the medal's colour. */
  private clearMedalDisc!: Phaser.GameObjects.Graphics;
  private clearMedalText!: Phaser.GameObjects.Text;
  private clearMedalDiscX = 0;
  private clearPrompt!: Phaser.GameObjects.Text;
  /** What `clearReveal()` reports: the run's `wait` and the lines visible, one entry per frame the screen was drawn. */
  private clearRevealLog: { wait: number; lines: number }[] = [];
  /** GDD-UI-05: the device used last, the tip's fade, the tips whose thing is done, the steps for the highlight's pulse, and what was drawn. */
  private device: Device = 'keyboard';
  private tipFade: TipFade = NO_TIP;
  private tipsDoneNow: boolean[];
  private tipStep = 0;
  private tipBox!: Phaser.GameObjects.Container;
  private tipBg!: Phaser.GameObjects.Rectangle;
  private tipText!: Phaser.GameObjects.Text;
  private tipGfx!: Phaser.GameObjects.Graphics;
  private tipPainted: ReturnType<PonchoDebug['tip']> = { index: null, text: '', alpha: 0, device: 'keyboard', highlight: null, grow: 0, button: null, box: { x: 0, y: 0, w: 0, h: 0 } };
  private placeholderLines = false;
  /** GDD-UI-04: where the camera stands, the level x at the screen's left edge. */
  private scrollX = 0;
  /** GDD-ART-06: each cloud's two images (it and its copy one screen to the left, so it wraps), the mountains' layer and the ground images by tile (`"tx,ty"`). */
  private cloudImages: Phaser.GameObjects.Image[][] = [];
  private mountains!: Phaser.GameObjects.TileSprite;
  private desert!: Phaser.GameObjects.TileSprite;
  private plantImages: Phaser.GameObjects.Image[] = [];
  private sun!: Phaser.GameObjects.Image;
  private mountainFoot!: Phaser.GameObjects.Rectangle;
  private readonly groundImages = new Map<string, Phaser.GameObjects.Image>();
  /** GDD-LIFE-03: the veladora's graphics, whether it was last drawn as used, and whether it is painted. GDD-WLD-03: whether the exit is. */
  private veladoraGfx!: Phaser.GameObjects.Graphics;
  private veladoraUsedDrawn = false;
  private veladoraPainted = false;
  private exitPainted = false;
  private readonly clawLatch = new InputLatch();
  /** Left and right are latched too: a tap of either ends the Siete vidas gastadas screen (GDD-LIFE-05). */
  private readonly leftLatch = new InputLatch();
  private readonly rightLatch = new InputLatch();
  /**
   * GDD-UI-02: the Left and Right keys down when the pause began, and the ones ignored until released since it ended, each with
   * the `timeDown` of its press, so a key pressed again (while paused, or inside one frame) is a new press.
   */
  private keysAtPause = new Map<Phaser.Input.Keyboard.Key, number>();
  private readonly heldKeys = new Map<Phaser.Input.Keyboard.Key, number>();
  /** GDD-UI-02: the keys (by keyCode) whose press this scene saw go down and not yet up. */
  private readonly keysPressedHere = new Set<number>();
  /** GDD-UI-02: in a level started by the press that ended the one before, the buttons down on the first frame count as already held. */
  private holdAtStart: boolean;
  private swings = 0;
  private spits = 0;
  private clawPainted: 'none' | 'windup' | 'swing' = 'none';

  /**
   * Opens on the level "Start" plays (`startLevel`: the address, else the saved game). A scene made for another level is the next
   * level, played at once after a level clear screen or a pick on the title, or the title over the level "Start" now plays.
   */
  constructor({ entry = startLevel(window.location.search, savedTutorialPlayed()), direct = false, title }: PlayOptions = {}) {
    super(scenesMade++ === 0 ? 'play' : `play-${entry.id}-${scenesMade}`);
    this.entry = entry;
    this.level = entry.level;
    this.world = entry.level.world;
    this.floorY = entry.level.spawn.y;
    // GDD-UI-02: started by the press that ended the level before it, it plays at once, with no title screen.
    this.holdAtStart = direct;
    if (direct) this.title = { ...TITLE, shown: false };
    else if (title) this.title = title;
    this.run = startRun(this.level);
    this.prevPlayer = this.run.player;
    this.anim = startAnim(this.run.player.x);
    this.tipsDoneNow = (entry.tips ?? []).map(() => false);
  }

  preload(): void {
    // GDD-ART-04: the standing frame and the four run frames, each SPRITE_FRAME game px wide (160 art px).
    this.load.spritesheet('poncho', ponchoPng, { frameWidth: SPRITE_FRAME * ART_SCALE, frameHeight: SPRITE_FRAME * ART_SCALE });
    // GDD-ART-06: World 1's backdrop (the sky's three dither strips, the sun, a picture of each cloud, the mountains' ridge band) and the
    // ground sheet, four frames of one tile (TILE * ART_SCALE) each.
    this.load.spritesheet('sky-strips', skyStripsPng, { frameWidth: BASE_WIDTH * ART_SCALE, frameHeight: BACKDROP_ART.stripArt });
    this.load.image('sun', sunPng);
    [cloud0Png, cloud1Png, cloud2Png, cloud3Png].forEach((png, i) => this.load.image(`cloud-${i}`, png));
    this.load.image('mountains', mountainsPng);
    this.load.spritesheet('ground', groundPng, { frameWidth: TILE * ART_SCALE, frameHeight: TILE * ART_SCALE });
    // GDD-ART-06: the far desert strip and the plants' sheet, one frame per kind, each as large as the largest plant.
    this.load.image('far-desert', farDesertPng);
    this.load.spritesheet('plants', plantsPng, { frameWidth: Math.max(...PLANTS.map((p) => p.w)) * ART_SCALE, frameHeight: Math.max(...PLANTS.map((p) => p.h)) * ART_SCALE });
    // GDD-AUD-02: Ogg where it plays, MP3 elsewhere. Phaser picks the first format the browser supports.
    this.load.audio('sfx-ofrenda', [ofrendaOgg, ofrendaMp3]);
    this.load.audio('sfx-jump', [jumpOgg, jumpMp3]);
    this.load.audio('sfx-land', [landOgg, landMp3]);
    this.load.audio('sfx-claw', [clawOgg, clawMp3]);
    this.load.audio('sfx-stomp', [stompOgg, stompMp3]);
    this.load.audio('sfx-hilo', [hiloOgg, hiloMp3]);
    this.load.audio('sfx-lifeLost', [lifeLostOgg, lifeLostMp3]);
    this.load.audio('sfx-meow', [meowOgg, meowMp3]);
    this.load.audio('sfx-tick', [tickOgg, tickMp3]);
  }

  create(): void {
    // GDD-PRG-02: the saved settings and whether the tutorial was started; where the browser refuses storage the game plays with
    // the defaults, and the tutorial counts as started if it was in this visit.
    // GDD-UI-02: a first visit, or a save with no language, takes the browser's.
    const browser = browserLanguage(typeof navigator === 'undefined' ? [] : Array.isArray(navigator.languages) && navigator.languages.length > 0 ? navigator.languages : [navigator.language]);
    let save = readSave(null, browser);
    try {
      save = readSave(window.localStorage.getItem(SAVE_KEY), browser);
    } catch {
      // storage refused
    }
    this.settings = settingsThisVisit ?? save.settings;
    this.tutorialPlayed = save.tutorialPlayed || playedThisVisit;
    this.cameras.main.setBackgroundColor('#1b2036');
    // GDD-ART-01: the canvas is ART_SCALE times larger than the game pixels everything is placed in, so the camera draws them zoomed in
    // from the top left corner, world objects and fixed ones alike.
    this.cameras.main.setOrigin(0, 0).setZoom(ART_SCALE);
    this.drawBackdrop();
    this.drawPlants();
    this.drawTiles();
    // These placeholder lines are drawn in the sandbox only, a test level: the tutorial has tips in their place (GDD-UI-05).
    this.placeholderLines = this.entry.test;
    if (this.placeholderLines) {
      this.add
        .text(BASE_WIDTH / 2, 28, 'PONCHO: Siete Vidas', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' })
        .setOrigin(0.5);
      this.add
        .text(BASE_WIDTH / 2, 48, 'placeholder: arrows or A/D to run, space to jump', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#9ba3c4',
        })
        .setOrigin(0.5);
    }

    // GDD-UI-01: seven life triangles, top-left, above the camera so they stay put.
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.drawHud();

    this.ofrendaGfx = this.add.graphics().setDepth(2);
    this.drawOfrendas();
    this.drawExit();
    this.veladoraGfx = this.add.graphics().setDepth(2);
    this.drawVeladora();
    this.drawSpikes();
    this.drawSprings();
    this.tacoGfx = this.add.graphics().setDepth(2);
    this.drawTacos();
    this.hiloGfx = this.add.graphics().setDepth(2);
    this.drawHilos();
    this.heldGfx = this.add.graphics().setDepth(4);
    this.fireballGfx = this.add.graphics().setDepth(4);
    this.enemyGfx = this.add.graphics().setDepth(3);
    this.pinataGfx = this.add.graphics().setDepth(1);
    this.drawPinatas();
    this.itemGfx = this.add.graphics().setDepth(2);
    this.doorGfx = this.add.graphics().setDepth(1);
    this.keyGfx = this.add.graphics().setDepth(2);
    this.drawDoorsAndKeys();
    this.fragileGfx = this.add.graphics().setDepth(1);
    this.drawFragiles();
    this.clawGfx = this.add.graphics().setDepth(5);
    this.platformGfx = this.add.graphics().setDepth(1);
    this.blockGfx = this.add.graphics().setDepth(1);
    this.crumbleGfx = this.add.graphics().setDepth(1);
    this.drawCrumbles();

    // GDD-LIFE-05: the Siete vidas gastadas screen, over the level and under the HUD and the touch buttons (so Jump stays
    // pressable). Hidden until the last life is spent.
    const g = this.add.graphics();
    g.fillStyle(0x0d1020, 0.82).fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    // Seven empty triangles, the HUD's look for lost lives, larger and centred, with 2 px lines (L-017).
    const size = { w: 14, h: 12, gap: 6 };
    const left = (BASE_WIDTH - (7 * size.w + 6 * size.gap)) / 2;
    g.lineStyle(2, 0x9ba3c4, 1);
    for (let i = 0; i < 7; i++) {
      const x = left + i * (size.w + size.gap);
      g.strokeTriangle(x + size.w / 2, 138, x, 138 + size.h, x + size.w, 138 + size.h);
    }
    this.gameOverTitle = this.add.text(BASE_WIDTH / 2, 112, 'Siete vidas gastadas', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' }).setOrigin(0.5);
    // Below the triangles (user, 2026-10-22): "Game over", then the prompt.
    this.gameOverSubtitle = this.add.text(BASE_WIDTH / 2, 168, 'Game over', { fontFamily: 'monospace', fontSize: '12px', color: '#fff3dc' }).setOrigin(0.5);
    this.gameOverPrompt = this.add.text(BASE_WIDTH / 2, 186, 'Press any button to Retry', { fontFamily: 'monospace', fontSize: '8px', color: '#9ba3c4' }).setOrigin(0.5);
    this.gameOver = this.add.container(0, 0, [g, this.gameOverTitle, this.gameOverSubtitle, this.gameOverPrompt]).setScrollFactor(0).setDepth(9).setVisible(false);

    // GDD-UI-02: the level clear screen, built like the game-over screen: over the level, under the HUD and the touch buttons.
    // Hidden until the exit is reached.
    const clearVeil = this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0d1020, 0.82).setOrigin(0);
    this.clearTitle = this.add.text(BASE_WIDTH / 2, 92, 'Level clear!', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' }).setOrigin(0.5);
    this.clearHilos = this.add.text(BASE_WIDTH / 2, 116, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff3dc' }).setOrigin(0.5);
    this.clearTime = this.add.text(BASE_WIDTH / 2, 132, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff3dc' }).setOrigin(0.5);
    // The medal line: a disc and its text, placed by `drawClear` once the text's width is known (GDD-UI-02).
    this.clearMedalDisc = this.add.graphics();
    this.clearMedalText = this.add.text(BASE_WIDTH / 2, 150, '', { fontFamily: 'monospace', fontSize: '12px', color: '#fff3dc' }).setOrigin(0, 0.5);
    this.clearPrompt = this.add.text(BASE_WIDTH / 2, 172, 'Press any button', { fontFamily: 'monospace', fontSize: '8px', color: '#9ba3c4' }).setOrigin(0.5);
    this.clearScreen = this.add.container(0, 0, [clearVeil, this.clearTitle, this.clearHilos, this.clearTime, this.clearMedalDisc, this.clearMedalText, this.clearPrompt]).setScrollFactor(0).setDepth(9).setVisible(false);

    // GDD-UI-05: the tutorial tip's text box, top middle under the HUD, under the screens (depth 8), and its highlight in the level.
    this.tipBg = this.add.rectangle(0, 0, 1, 1, 0x0d1020, 0.75).setOrigin(0);
    this.tipText = this.add.text(BASE_WIDTH / 2, TIPS.boxTop + TIPS.boxPad, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff3dc', align: 'center', wordWrap: { width: TIPS.wrapPx } }).setOrigin(0.5, 0);
    this.tipBox = this.add.container(0, 0, [this.tipBg, this.tipText]).setScrollFactor(0).setDepth(8).setVisible(false);
    this.tipGfx = this.add.graphics().setDepth(6);

    // GDD-MOV-06, GDD-ART-04: the container sits at the middle of the body box; the frame stands on its feet (bottom row at the box's
    // bottom), scaled from art pixels to game pixels.
    this.body = this.add
      .container(this.run.player.x, this.run.player.y - HITBOX.height / 2, [
        (this.bodySprite = this.add.image(0, HITBOX.height / 2, 'poncho', STAND).setOrigin(0.5, 1).setScale(1 / ART_SCALE)),
        (this.glideGfx = this.paintGlide()),
        (this.clingGfx = this.add.graphics().setVisible(false)),
      ])
      .setDepth(3);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('Keyboard input is unavailable');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
      jump: [kb.addKey(K.SPACE), kb.addKey(K.Z), kb.addKey(K.UP), kb.addKey(K.W)],
      claw: [kb.addKey(K.X), kb.addKey(K.J)],
      fuego: [kb.addKey(K.C), kb.addKey(K.K)],
    };
    // Down would scroll the page; the pause menu reads it (and S) from raw events (GDD-UI-02).
    kb.addCapture([K.DOWN, K.S]);
    // The Key 'down' event fires for a press even when it ends before the next frame. It can fire twice for one press, and
    // repeats fire it too (L-006), but pressing a latch again changes nothing, so only latch presses may hang on it.
    for (const k of this.keys.jump) k.on('down', () => this.jumpLatch.press());
    for (const k of this.keys.claw) k.on('down', () => this.clawLatch.press());
    for (const k of this.keys.fuego) k.on('down', () => this.fuegoLatch.press());
    for (const k of this.keys.left) k.on('down', () => this.leftLatch.press());
    for (const k of this.keys.right) k.on('down', () => this.rightLatch.press());

    // GDD-CTL-03: on-screen buttons on touch devices, merged with the keyboard below.
    this.touch = new TouchControls(this);

    // GDD-UI-01: the hilo counter in the top right, left of the touch pause button where there is one.
    this.hiloIcon = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.hiloText = this.add.text(0, HILO_HUD.top, '', { fontFamily: 'monospace', fontSize: '8px', color: '#fff3dc' }).setOrigin(1, 0).setScrollFactor(0).setDepth(10);
    this.drawHiloCounter();

    // GDD-UI-02: the pause screen, over the level and the Siete vidas gastadas screen, under the HUD and the touch buttons
    // (so the pause button stays there to resume with).
    const dim = this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0d1020, 0.75).setOrigin(0);
    this.pauseTitle = this.add.text(BASE_WIDTH / 2, 120, 'Paused', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' }).setOrigin(0.5);
    // Upright, the whole level is drawn small, so the prompt is set larger than the 8 px prompts.
    this.pausePrompt = this.add.text(BASE_WIDTH / 2, 146, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9ba3c4' }).setOrigin(0.5);
    const menuStyle = { fontFamily: 'monospace', fontSize: `${PAUSE_MENU.textSize}px`, color: '#9ba3c4' };
    this.pauseItems = {
      resume: this.add.text(0, 0, 'Resume', menuStyle).setOrigin(0.5),
      settings: this.add.text(0, 0, 'Settings', menuStyle).setOrigin(0.5),
      quit: this.add.text(0, 0, 'Quit to title', menuStyle).setOrigin(0.5),
    };
    this.pauseMarker = this.add.text(0, 0, '>', menuStyle).setOrigin(1, 0.5);
    this.pauseScreen = this.add.container(0, 0, [dim, this.pauseTitle, this.pausePrompt, this.pauseItems.resume, this.pauseItems.settings, this.pauseItems.quit, this.pauseMarker]).setScrollFactor(0).setDepth(9.5).setVisible(false);

    // GDD-UI-02: the settings screen, opened from the pause menu (under the HUD and the touch buttons, like the pause screen) or
    // from the title menu (over everything, like the title screen). It replaces the menu it was opened from.
    this.settingsVeil = this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0d1020, 0.75).setOrigin(0);
    this.settingsTitle = this.add.text(BASE_WIDTH / 2, SETTINGS_MENU.titleY, 'Settings', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' }).setOrigin(0.5);
    this.settingsPrompt = this.add.text(BASE_WIDTH / 2, 146, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9ba3c4' }).setOrigin(0.5);
    this.settingsLabels = {
      master: this.add.text(0, 0, 'Master volume', menuStyle).setOrigin(0, 0.5),
      effects: this.add.text(0, 0, 'Effects volume', menuStyle).setOrigin(0, 0.5),
      language: this.add.text(0, 0, 'Language', menuStyle).setOrigin(0, 0.5),
      back: this.add.text(0, 0, 'Back', menuStyle).setOrigin(0.5),
    };
    // "<" and ">" for the two volume rows and the language row, left then right, row by row.
    this.settingsArrows = ['<', '>', '<', '>', '<', '>'].map((c) => this.add.text(0, 0, c, menuStyle).setOrigin(0.5));
    // GDD-UI-02: the chosen language's own name, where a volume row's bars are.
    this.settingsLanguageValue = this.add.text(0, 0, '', menuStyle).setOrigin(0.5);
    this.settingsBars = this.add.graphics();
    this.settingsMarker = this.add.text(0, 0, '>', menuStyle).setOrigin(1, 0.5);
    this.settingsScreen = this.add
      .container(0, 0, [this.settingsVeil, this.settingsTitle, this.settingsPrompt, ...Object.values(this.settingsLabels), ...this.settingsArrows, this.settingsLanguageValue, this.settingsBars, this.settingsMarker])
      .setScrollFactor(0)
      .setDepth(9.5)
      .setVisible(false);
    // Escape or P pauses and resumes; a tap or click anywhere off the menu rows resumes; the touch pause button does both. The keys are read
    // from raw browser events, one per press with auto-repeat ignored: Phaser's Key 'down' event can fire again on the
    // release when a press and release land in one frame (L-006), and here every extra event would toggle the pause back.
    // The menu keys (Up or W, Down or S choose; Left or A, Right or D change a volume; Enter, Space or Z pick) are read the same
    // way (GDD-UI-02). The game reads Left, Right, Space and the rest as buttons too, from its own latches.
    const onPauseKey = (e: KeyboardEvent) => {
      this.device = 'keyboard'; // GDD-UI-05: any key press, a repeat too
      if (e.repeat) return;
      // By keyCode, the key's label, as Phaser matches the other keys: on Dvorak or Colemak the P key still pauses.
      const code = e.keyCode;
      if (code === K.ESC || code === K.P) this.pauseEvents.push('key');
      if (code === K.UP || code === K.W) this.pauseEvents.push('menuUp');
      if (code === K.DOWN || code === K.S) this.pauseEvents.push('menuDown');
      if (code === K.LEFT || code === K.A) this.pauseEvents.push('menuLeft');
      if (code === K.RIGHT || code === K.D) this.pauseEvents.push('menuRight');
      if (code === K.ENTER || code === K.SPACE || code === K.Z) this.pauseEvents.push('pick');
    };
    window.addEventListener('keydown', onPauseKey);
    // GDD-UI-02: a key held down since the level before (the press that ended its clear screen) shows here only as auto-repeats,
    // which would press it. They are kept from Phaser, read first in the capture phase, so the key counts as up until it is
    // released and pressed again, like a key held through a resume. Its default (scrolling the page) is stopped as Phaser does.
    const onKeyDownFirst = (e: KeyboardEvent) => {
      if (!e.repeat) this.keysPressedHere.add(e.keyCode);
      else if (!this.keysPressedHere.has(e.keyCode)) {
        this.device = 'keyboard'; // GDD-UI-05, as in onPauseKey, which this event does not reach
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const onKeyUpFirst = (e: KeyboardEvent) => this.keysPressedHere.delete(e.keyCode);
    window.addEventListener('keydown', onKeyDownFirst, { capture: true });
    window.addEventListener('keyup', onKeyUpFirst, { capture: true });
    // A pointer is classified by where it went down on every menu at once, never by the state: an Escape and a tap in one frame apply
    // in order, and the state each reaches decides which menu reads the tap.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // The canvas is ART_SCALE times the game pixels the layouts are in (GDD-ART-01).
      const at = gamePoint(p);
      if (p.wasTouch) this.device = 'touch'; // GDD-UI-05: a finger, not a mouse click
      if (this.touch.isPauseButton(at.x, at.y)) {
        this.pauseEvents.push('button');
        return;
      }
      const k = this.scale.displaySize.width / BASE_WIDTH;
      this.pauseEvents.push({
        pause: pauseMenuItemAt(layoutPauseMenu(k), at.x, at.y),
        title: titleMenuItemAt(layoutTitleMenu(k), at.x, at.y),
        settings: settingsTapAt(layoutSettingsMenu(k), at.x, at.y),
      });
    });
    // It pauses by itself when the tab or window loses focus, or a phone is turned upright, and never resumes by itself.
    const onBlur = () => this.pauseEvents.push('blur');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBlur();
    };
    const touchDevice = this.sys.game.device.input.touch;
    this.device = initialDevice(touchDevice);
    let upright = false;
    const onResize = () => {
      const now = isPortrait(window.screen.orientation?.type, window.innerWidth, window.innerHeight, touchDevice);
      if (now !== upright) this.pauseEvents.push(now ? 'portrait' : 'landscape');
      upright = now;
    };
    onResize();
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', onResize);
    const removeListeners = () => {
      window.removeEventListener('keydown', onPauseKey);
      window.removeEventListener('keydown', onKeyDownFirst, { capture: true });
      window.removeEventListener('keyup', onKeyUpFirst, { capture: true });
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
    };
    // A scene removed for the next level (`startNext`) is destroyed without a shutdown, so both events clean up.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, removeListeners);
    this.events.once(Phaser.Scenes.Events.DESTROY, removeListeners);

    // GDD-UI-02: the title screen, over everything: the level standing still under a veil like the game-over screen's, the
    // HUD included. The touch buttons are hidden while it is up.
    const veil = this.add.rectangle(0, 0, BASE_WIDTH, BASE_HEIGHT, 0x0d1020, 0.82).setOrigin(0);
    this.titleText = this.add.text(BASE_WIDTH / 2, 68, 'PONCHO', { fontFamily: 'monospace', fontSize: '32px', color: '#fff3dc' }).setOrigin(0.5);
    this.titleSubtitle = this.add.text(BASE_WIDTH / 2, 96, 'Siete Vidas', { fontFamily: 'monospace', fontSize: '16px', color: '#fff3dc' }).setOrigin(0.5);
    // GDD-UI-02: his standing frame, feet 8 px above the title menu.
    this.titlePoncho = this.add.container(BASE_WIDTH / 2, TITLE_MENU.top - 8, [
      (this.titlePonchoSprite = this.add.image(0, 0, 'poncho', STAND).setOrigin(0.5, 1).setScale(1 / ART_SCALE)),
    ]);
    this.titlePromptText = this.add.text(BASE_WIDTH / 2, 190, '', { fontFamily: 'monospace', fontSize: '12px', color: '#9ba3c4' }).setOrigin(0.5);
    // The title menu, drawn like the pause menu; upright it gives way to the prompt.
    this.titleItems = {
      start: this.add.text(0, 0, 'Start', menuStyle).setOrigin(0.5),
      tutorial: this.add.text(0, 0, 'Tutorial', menuStyle).setOrigin(0.5),
      settings: this.add.text(0, 0, 'Settings', menuStyle).setOrigin(0.5),
    };
    this.titleMarker = this.add.text(0, 0, '>', menuStyle).setOrigin(1, 0.5);
    this.titleScreen = this.add
      .container(0, 0, [veil, this.titleText, this.titleSubtitle, this.titlePoncho, this.titlePromptText, this.titleItems.start, this.titleItems.tutorial, this.titleItems.settings, this.titleMarker])
      .setScrollFactor(0)
      .setDepth(11);
    this.drawTitle();
    this.applyLanguage();

    if (import.meta.env.DEV) {
      window.__PONCHO__ = {
        state: () => this.run.player,
        ticks: () => this.ticks,
        peakRise: () => this.lastPeak,
        lives: () => this.run.lives.lives,
        phase: () => this.run.phase,
        phaseSince: () => this.phaseSince,
        gameOverDrawn: () => ({ shown: this.gameOver.visible, title: this.gameOverTitle.text, subtitle: this.gameOverSubtitle.text, prompt: this.gameOverPrompt.visible, promptText: this.gameOverPrompt.text }),
        clearDrawn: () => ({
          shown: this.clearScreen.visible,
          title: this.clearTitle.text,
          hilos: this.clearHilos.text,
          time: this.clearTime.text,
          medal: this.clearMedalText.text,
          medalColour: colorOf(this.clearMedalText),
          lines: this.clearLinesVisible(),
          discX: this.clearMedalDiscX,
          textX: this.clearMedalText.x,
          medalWidth: this.clearMedalText.width,
          prompt: this.clearPrompt.visible,
          promptText: this.clearPrompt.text,
        }),
        clearReveal: () => this.clearRevealLog,
        level: () => this.entry.id,
        camera: () => ({ scrollX: this.scrollX, viewX: this.cameras.main.getWorldPoint(0, 0).x }),
        backdrop: () => ({ clouds: (((BACKDROP_ART.clouds[0].x - this.cloudImages[0]![0]!.x) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH, mountains: this.mountains.tilePositionX / ART_SCALE, desert: this.desert.tilePositionX / ART_SCALE }),
        backdropLayout: () => ({ sunX: this.sun.x + BACKDROP_ART.sunHalf, sunY: this.sun.y + BACKDROP_ART.sunHalf, mountainsY: this.mountains.y, footY: this.mountainFoot.y, desertY: this.desert.y }),
        groundFrame: (tx, ty) => {
          const image = this.groundImages.get(`${tx},${ty}`);
          return image === undefined ? null : Number(image.frame.name);
        },
        plants: () => this.plantImages.map((image) => ({ kind: Number(image.frame.name), x: image.x, y: image.y, depth: image.depth })),
        tip: () => this.tipPainted,
        tipsDone: () => this.tipsDoneNow,
        wrapTip: (text) => this.tipText.getWrappedText(text),
        placeholderLines: () => this.placeholderLines,
        veladoraDrawn: () => this.veladoraPainted,
        exitDrawn: () => this.exitPainted,
        invulnerable: () => this.run.invulnerable,
        bodyVisible: () => this.body.visible,
        bodyAlpha: () => this.body.alpha,
        bodyPose: () => ({ x: this.body.x, y: this.body.y + HITBOX.height / 2, rotation: this.body.rotation }),
        ponchoSprite: () => ({
          frame: Number(this.bodySprite.frame.name),
          flipX: this.bodySprite.flipX,
          width: this.bodySprite.displayWidth,
          height: this.bodySprite.displayHeight,
          bottom: this.body.y + this.bodySprite.y,
          centerX: this.body.x + this.bodySprite.x,
        }),
        hudFilled: () => this.hudFilled,
        hudCracking: () => this.cracksDrawn,
        hudPulse: () => this.pulseDrawn,
        pause: (on) => {
          this.paused = on;
        },
        playerPause: () => this.pauseState,
        pauseDrawn: () => {
          const { resume, settings, quit } = this.pauseItems;
          const marked = this.pauseMarker.visible;
          return {
            shown: this.pauseScreen.visible,
            title: this.pauseTitle.text,
            prompt: this.pausePrompt.text,
            promptSize: Number.parseInt(String(this.pausePrompt.style.fontSize), 10),
            menu: {
              shown: this.pauseScreen.visible && resume.visible,
              items: [resume.text, settings.text, quit.text],
              colors: [resume, settings, quit].map((t) => colorOf(t)),
              chosen: marked ? this.pauseState.choice : null,
              markerY: marked ? this.pauseMarker.y : null,
            },
          };
        },
        pauseMenu: () => this.pauseRows,
        titleDrawn: () => {
          const { start, tutorial, settings } = this.titleItems;
          const marked = this.titleMarker.visible;
          return {
            shown: this.titleScreen.visible,
            title: this.titleText.text,
            subtitle: this.titleSubtitle.text,
            prompt: this.titlePromptText.text,
            promptSize: Number.parseInt(String(this.titlePromptText.style.fontSize), 10),
            ponchoShown: this.titleScreen.visible && this.titlePoncho.visible,
            ponchoBottom: this.titlePoncho.y + this.titlePonchoSprite.y,
            menu: {
              shown: this.titleScreen.visible && start.visible,
              items: [start.text, tutorial.text, settings.text],
              colors: [start, tutorial, settings].map((t) => colorOf(t)),
              chosen: marked ? this.title.choice : null,
              markerY: marked ? this.titleMarker.y : null,
            },
          };
        },
        titleMenu: () => this.titleRows,
        settingsDrawn: () => this.settingsPainted,
        settingsMenu: () => this.settingsRows,
        settings: () => this.settings,
        tutorialPlayed: () => this.tutorialPlayed,
        step: (n, input = { move: 0, jumpHeld: false }) => {
          if (!this.paused) throw new Error('step() needs the game paused');
          for (let i = 0; i < n; i++) this.simStep(input);
          this.drawHud();
          this.drawCrumbles();
          this.drawTacos();
          this.drawHilos();
          this.drawHiloCounter();
          this.drawPinatas();
          this.drawItems();
          this.drawDoorsAndKeys();
          this.renderPlatforms(1);
          this.renderBlocks(1);
          this.renderBody(1); // draw now, so a test that reads the picture right away sees this step
          this.followBody();
          this.drawVeladora();
          this.drawGameOver();
          this.drawClear();
          this.drawTip();
        },
        ofrendas: () => this.ofrendasDrawn,
        platforms: () => this.level.platforms.map((p) => platformAt(p, this.run.platformTick)),
        blocks: () => (this.level.blocks ?? []).map((b) => blockAt(b, this.run.platformTick)),
        crumbles: () => this.level.crumbles.map((c, i) => ({ ...c, ...this.run.crumbles[i]! })),
        checkpoint: () => this.run.checkpoint,
        power: () => this.run.power,
        tacosDrawn: () => this.tacosPainted,
        hilos: () => ({ taken: hilosCollected(this.run.hilosTaken), total: this.level.hilos?.length ?? 0, drawn: this.hilosPainted }),
        hudHilos: () => ({ text: this.hiloText.text, right: this.hiloText.x, top: this.hiloText.y, iconX: this.hiloIconX }),
        heldTacoVisible: () => this.heldGfx.visible,
        hudPowerIcon: () => this.hudPower !== 'base',
        heldPowerDrawn: () => this.heldPower,
        hudPowerDrawn: () => this.hudPower,
        fireballs: () => this.run.fireballs.length,
        spits: () => this.spits,
        fireballAt: () => this.run.fireballs.map((f) => ({ x: f.x, y: f.y })),
        fireballsDrawn: () => this.fireballsPainted,
        enemies: () => this.run.enemies.map((e, i) => ({ x: e.x, y: e.flight?.y ?? this.level.enemies[i]!.y, alive: e.alive, dir: e.dir, phase: e.flight?.phase ?? e.gait?.phase ?? 'walk' })),
        enemiesDrawn: () => this.enemiesPainted,
        glideDrawn: () => this.glideGfx.visible,
        clingDrawn: () => (this.clingGfx.visible ? this.clingPainted : 0),
        setPower: (power) => {
          this.run = { ...this.run, power };
          this.drawHud();
        },
        pinatasDrawn: () => this.pinatasPainted,
        itemsDrawn: () => this.itemsDrawn,
        keysHeld: () => this.run.keysHeld,
        keysDrawn: () => this.keysPainted,
        doorsDrawn: () => this.doorsPaintedShut.map((shut) => !shut),
        hudKeys: () => this.hudKeyCount,
        claw: () => this.run.claw.phase,
        swings: () => this.swings,
        clawDrawn: () => this.clawPainted,
        fragilesDrawn: () => this.fragilesPainted,
        sfx: () => this.sfxLog,
        touch: () => this.touch.debug(),
        sfxLoaded: () => SFX_KEYS.every((key) => this.cache.audio.exists(key)),
        sfxPlayed: () => this.sfxPlayed,
        loseLife: () => this.setLives(loseLife(this.run.lives)),
        activateOfrenda: (id) => this.setLives(activateOfrenda(this.run.lives, id)),
        teleport: (x, y) => {
          this.run = { ...this.run, player: { ...spawn(x, y), grounded: false } };
          this.prevPlayer = this.run.player;
        },
      };
      // Dev only: L loses a life, O activates a fresh ofrenda, V collects a fresh veladora.
      // Polled with JustDown, not 'keydown-X' events: Phaser 4.2.1 can fire those more than once when several
      // key events land in the same frame (see docs/LESSONS.md L-006).
      this.devKeys = { lose: kb.addKey(K.L), ofrenda: kb.addKey(K.O), veladora: kb.addKey(K.V) };
      // Centred under the controls line, clear of the title and of the hilo counter in the top right (GDD-UI-01).
      if (this.placeholderLines) this.add.text(BASE_WIDTH / 2, 58, 'dev: L lose life, O ofrenda, V veladora', { fontFamily: 'monospace', fontSize: '8px', color: '#9ba3c4' }).setOrigin(0.5);
    }
  }

  /**
   * World 1's backdrop (GDD-ART-06), under everything (negative depths), drawn so that little of the screen is textured: the sky's
   * first three bands as flat colours with the dither strips and the sun over them as small images (the horizon band is the camera's
   * background), a small image for each cloud, the mountains' ridge band as one repeating layer and its foot as a flat colour, and the far
   * desert strip in front of them. The sky is fixed to the screen; the clouds, the mountains and the far desert each move by their share of
   * the camera's scroll, in `followBody`.
   */
  private drawBackdrop(): void {
    const art = 1 / ART_SCALE;
    const { skyBands, skyEnds, stripArt } = BACKDROP_ART;
    this.cameras.main.setBackgroundColor(skyBands[3]);
    const bands = this.add.graphics().setScrollFactor(0).setDepth(-4);
    let top = 0;
    skyEnds.forEach((end, i) => {
      // The band runs on to its end: the dither strip, drawn over its last rows, covers them.
      bands.fillStyle(skyBands[i]!, 1).fillRect(0, top * art, BASE_WIDTH, (end - top) * art);
      top = end;
      this.add.image(0, (end - stripArt) * art, 'sky-strips', i).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3.5);
    });
    this.sun = this.add.image(BACKDROP.sunX - BACKDROP_ART.sunHalf, BACKDROP.sunY - BACKDROP_ART.sunHalf, 'sun').setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-3);
    this.cloudImages = BACKDROP_ART.clouds.map(({ x, y }, i) =>
      [x, x - BASE_WIDTH].map((at) => this.add.image(at, y, `cloud-${i}`).setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-2)),
    );
    this.mountains = this.add.tileSprite(0, BACKDROP.mountainTop, BASE_WIDTH * ART_SCALE, BACKDROP_ART.mountainBandArt, 'mountains').setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-1);
    const foot = BACKDROP.mountainTop + BACKDROP_ART.mountainBandArt * art;
    this.mountainFoot = this.add.rectangle(0, foot, BASE_WIDTH, BASE_HEIGHT - foot, BACKDROP_ART.footColour).setOrigin(0).setScrollFactor(0).setDepth(-1);
    this.desert = this.add.tileSprite(0, BACKDROP.desertTop, BASE_WIDTH * ART_SCALE, BACKDROP_ART.desertBandArt, 'far-desert').setOrigin(0).setScale(art).setScrollFactor(0).setDepth(-0.5);
  }

  /**
   * World 1's plants (GDD-ART-06): one image per spot of `plantSpots`, rooted 1 game px into the top tile it stands on, so its base is
   * behind the grass of the ground tile (depth 1) and in front of the backdrop; scenery only, behind everything else in the level.
   */
  private drawPlants(): void {
    this.plantImages = plantSpots(this.level).map(({ kind, col, row }) =>
      this.add.image(col * TILE + TILE / 2, row * TILE + 1, 'plants', kind).setOrigin(0.5, 1).setScale(1 / ART_SCALE).setDepth(0.5),
    );
  }

  /** World 1's ground (GDD-ART-06): one image of the ground sheet per solid tile, a top tile or an earth tile, a version each. */
  private drawTiles(): void {
    for (let ty = 0; ty < this.world.height; ty++) {
      for (let tx = 0; tx < this.world.width; tx++) {
        if (!this.world.solidTile(tx, ty)) continue;
        const image = this.add.image(tx * TILE, ty * TILE, 'ground', groundFrame((x, y) => this.world.solidTile(x, y), tx, ty)).setOrigin(0).setScale(1 / ART_SCALE).setDepth(1);
        this.groundImages.set(`${tx},${ty}`, image);
      }
    }
  }

  /**
   * Placeholder wall cling (GDD-MOV-08): three short pale claw marks, 2 px wide, slanting down the half of the body next to
   * the wall, like the claw button's icon. Redrawn only when the side changes.
   */
  private paintCling(side: -1 | 0 | 1): void {
    this.clingGfx.setVisible(side !== 0);
    if (side === 0 || side === this.clingPainted) return;
    this.clingPainted = side;
    const g = this.clingGfx.clear().lineStyle(2, 0xfff3dc, 1);
    const edge = side * (HITBOX.width / 2 - 2);
    for (const dy of [-4, 0, 4]) g.lineBetween(edge, dy - 2, edge - side * 3, dy + 1);
  }

  /**
   * Placeholder spread poncho (GDD-MOV-07): a bar 28 px wide and 4 px tall just above the body, in red and cream stripes 4 px
   * wide (the serape), with a dark edge, drawn while gliding.
   */
  private paintGlide(): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setVisible(false);
    const top = -HITBOX.height / 2 - 6;
    for (let i = 0; i < 7; i++) g.fillStyle(i % 2 === 0 ? 0xb94842 : 0xfff3dc, 1).fillRect(-14 + i * 4, top, 4, 4);
    g.lineStyle(1, 0x5e0f0a, 1).strokeRect(-14.5, top - 0.5, 29, 5);
    return g;
  }

  /**
   * Placeholder crumbling tiles (GDD-WLD-05): sandy blocks with a crack. While warning they shake sideways and flash pale
   * in turn, so the warning shows by movement and not only by colour (GDD-UI-03); once gone they are not drawn.
   */
  private drawCrumbles(): void {
    this.crumblesKey = this.run.crumbles.map((c) => `${c.phase}${c.steps}`).join();
    this.crumbleGfx.clear();
    this.level.crumbles.forEach((c, i) => {
      const state = this.run.crumbles[i]!;
      if (state.phase === 'gone') return;
      const warning = state.phase === 'warning';
      const dx = warning ? (state.steps % 4 < 2 ? -1 : 1) : 0;
      const x = c.col * TILE + dx;
      const y = c.row * TILE;
      this.crumbleGfx.fillStyle(warning && state.steps % 8 < 4 ? 0xe9d3a3 : 0xc9a46a, 1).fillRect(x, y, TILE, TILE);
      this.crumbleGfx.lineStyle(1, 0x7d6038, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      this.crumbleGfx.lineBetween(x + 4, y + 1, x + 8, y + 7).lineBetween(x + 8, y + 7, x + 6, y + 14);
    });
  }

  /**
   * Placeholder moving platforms (GDD-WLD-05): a teal slab, 8 px thick, with a darker underside and a pale top edge so it
   * reads as a floor you can stand on and not as a tile. Drawn between the last two steps, like Poncho, so he does not
   * slide on it.
   */
  private renderPlatforms(alpha: number): void {
    this.platformGfx.clear();
    for (const p of this.level.platforms) {
      const at = platformAt(p, Math.max(0, this.run.platformTick - 1 + alpha));
      this.platformGfx.fillStyle(0x3f8f8a, 1).fillRect(at.x, at.y, at.w, 8);
      this.platformGfx.fillStyle(0x2a5f5c, 1).fillRect(at.x, at.y + 5, at.w, 3);
      this.platformGfx.fillStyle(0xd7f2ee, 1).fillRect(at.x, at.y, at.w, 1);
    }
  }

  /**
   * Placeholder moving blocks (GDD-WLD-05): grey stone with a pale top edge, a darker bottom and right edge and a dark 2 px stud
   * in each corner. Drawn between the last two steps, like Poncho, so he does not slide on it.
   */
  private renderBlocks(alpha: number): void {
    this.blockGfx.clear();
    for (const b of this.level.blocks ?? []) {
      const at = blockAt(b, Math.max(0, this.run.platformTick - 1 + alpha));
      this.blockGfx.fillStyle(0x8a8a8a, 1).fillRect(at.x, at.y, at.w, at.h);
      this.blockGfx.fillStyle(0xc4c4c4, 1).fillRect(at.x, at.y, at.w, 1);
      this.blockGfx.fillStyle(0x5e5e5e, 1).fillRect(at.x, at.y + at.h - 1, at.w, 1).fillRect(at.x + at.w - 1, at.y, 1, at.h);
      this.blockGfx.fillStyle(0x3a3a3a, 1);
      for (const [sx, sy] of [[1, 1], [at.w - 3, 1], [1, at.h - 3], [at.w - 3, at.h - 3]] as const) this.blockGfx.fillRect(at.x + sx, at.y + sy, 2, 2);
    }
  }

  /**
   * Placeholder taco (GDD-PWR-02, GDD-VIS-01): a tan shell folded into a half circle, green lettuce along the open edge and
   * two red tomato dots. `size` is the width in px. Used for the pickup, the taco in Poncho's hand and the HUD icon.
   */
  private paintTaco(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const r = size / 2;
    g.fillStyle(0xe8b755, 1).beginPath().arc(cx, cy + r / 2, r, Math.PI, 0, false).closePath().fillPath();
    g.fillStyle(0x6fae4a, 1).fillRect(cx - r, cy + r / 2 - 1, size, 1);
    g.fillStyle(0xc2392d, 1).fillRect(cx - r / 2, cy - 1, 1.5, 1.5).fillRect(cx + r / 4, cy - 1.5, 1.5, 1.5);
    g.lineStyle(1, 0x5a3a14, 1).beginPath().arc(cx, cy + r / 2, r, Math.PI, 0, false).strokePath();
  }

  /**
   * Placeholder chile (GDD-PWR-03): a curved red pepper with a green stem, on a soft orange glow so it reads as hot. `size` is
   * its length in px. Used for the pepper from a piñata, the chile in Poncho's hand and the HUD icon.
   */
  private paintChile(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const r = size / 2;
    g.fillStyle(0xffd27a, 0.45).fillCircle(cx, cy, r + 1.5);
    g.fillStyle(0xd1281c, 1).fillTriangle(cx - r, cy - r * 0.2, cx + r * 0.5, cy - r * 0.6, cx + r, cy + r * 0.7);
    g.fillStyle(0xd1281c, 1).fillTriangle(cx - r, cy - r * 0.2, cx + r, cy + r * 0.7, cx - r * 0.1, cy + r * 0.5);
    g.fillStyle(0x4f9a3a, 1).fillRect(cx - r - 1, cy - r * 0.5, 2.5, 2.5);
    g.lineStyle(1, 0x5e0f0a, 1).lineBetween(cx - r, cy - r * 0.2, cx + r, cy + r * 0.7);
  }

  /** The tacos and the chile in Poncho's hand: a taco, and for Fuego a glowing chile tucked beside it. */
  private paintHeld(g: Phaser.GameObjects.Graphics, cx: number, cy: number, power: Power, size: number): void {
    if (power === 'base') return;
    this.paintTaco(g, cx, cy, size);
    if (power === 'fuego') this.paintChile(g, cx + size * 0.55, cy - size * 0.35, size * 0.8);
  }

  /**
   * Placeholder Alacrán (GDD-ENM-02): a dark red scorpion 14 x 10 px with pale claws out in front, a tail arched over its back
   * ending in a pale stinger, and four legs, facing the way it walks. A defeated one is not drawn.
   */
  private drawEnemies(): void {
    this.enemyGfx.clear();
    this.enemiesPainted = [];
    this.level.enemies.forEach((def, i) => {
      const e = this.run.enemies[i]!;
      if (!e.alive) return;
      const g = this.enemyGfx;
      if (kindOf(def) === 'zopilote') return this.drawZopilote(e);
      if (kindOf(def) === 'cactus') return this.drawCactus(e, def.y);
      if (kindOf(def) === 'tlacuache') return this.drawTlacuache(e, def.y);
      this.enemiesPainted.push({ x: e.x, y: def.y, kind: 'alacran' });
      const d = e.dir;
      g.fillStyle(0x9a3a2a, 1).fillRect(e.x - 5, def.y - 6, 10, 5);
      g.lineStyle(1, 0x4a1a12, 1).strokeRect(e.x - 4.5, def.y - 5.5, 9, 4);
      g.fillStyle(0xe9d3a3, 1).fillRect(e.x + d * 5 - (d < 0 ? 3 : 0), def.y - 7, 3, 3).fillRect(e.x + d * 5 - (d < 0 ? 3 : 0), def.y - 3, 3, 2);
      g.lineStyle(1, 0x9a3a2a, 1).beginPath().moveTo(e.x - d * 5, def.y - 5).lineTo(e.x - d * 7, def.y - 8).lineTo(e.x - d * 4, def.y - 10).lineTo(e.x - d * 1, def.y - 8).strokePath();
      g.fillStyle(0xe9d3a3, 1).fillRect(e.x - d * 1 - 1, def.y - 9, 2, 2);
      g.lineStyle(1, 0x4a1a12, 1);
      for (const lx of [-3, -1, 1, 3]) g.lineBetween(e.x + lx, def.y - 1, e.x + lx, def.y);
    });
  }

  /**
   * Placeholder cactus buddy (GDD-ENM-02): a green cactus 12 x 16 px with two arms and three pale thorns on top, the mark of an
   * enemy that cannot be stomped (GDD-CMB-01).
   */
  private drawCactus(e: EnemyState, y: number): void {
    const g = this.enemyGfx;
    const x = e.x;
    this.enemiesPainted.push({ x, y, kind: 'cactus' });
    g.fillStyle(0x4f9a4a, 1).fillRect(x - 3, y - 16, 6, 16).fillRect(x - 6, y - 11, 3, 2).fillRect(x - 6, y - 14, 2, 4).fillRect(x + 3, y - 8, 3, 2).fillRect(x + 4, y - 11, 2, 4);
    g.lineStyle(1, 0x2f5f2c, 1).lineBetween(x, y - 15, x, y);
    g.fillStyle(0xf2efe6, 1);
    for (const tx of [-3, -1, 1]) g.fillTriangle(x + tx, y - 16, x + tx + 2, y - 16, x + tx + 1, y - 19);
  }

  /**
   * Placeholder Tlacuache (GDD-ENM-02): a grey opossum 16 x 10 px with a pale face, a pink nose and ears facing the way it walks,
   * and a long bare pink tail behind. Its body flashes red for its telegraph (GDD-ENM-01). Playing dead it lies on its back,
   * feet up, with a crossed-out eye and its tongue out, and its feet twitch in the last 0.5 s before it wakes.
   */
  private drawTlacuache(e: EnemyState, y: number): void {
    const g = this.enemyGfx;
    const { x, dir: d } = e;
    const gait = e.gait!;
    this.enemiesPainted.push({ x, y, kind: 'tlacuache' });
    g.lineStyle(1, 0xd98c9a, 1).beginPath().moveTo(x - d * 6, y - 3).lineTo(x - d * 9, y - 2).lineTo(x - d * 8, y - 5).strokePath();
    if (gait.phase === 'dead') {
      // Two pairs of feet, 2 px wide, stick 4 px straight up; in the last 0.5 s they curl to 1 px every other 4 steps.
      const twitch = gait.age >= TLACUACHE.playDeadSteps - TLACUACHE.twitchSteps && Math.floor(gait.age / 4) % 2 === 0;
      g.fillStyle(0x8c8a94, 1).fillRect(x - 6, y - 5, 12, 5);
      g.fillStyle(0xf2efe6, 1).fillRect(x + d * 5 - (d < 0 ? 3 : 0), y - 5, 3, 4);
      g.fillStyle(0x4a4850, 1);
      for (const lx of [-4, 2]) g.fillRect(Math.round(x) + lx, twitch ? y - 6 : y - 9, 2, twitch ? 1 : 4);
      g.lineStyle(1, 0x4a4850, 1);
      g.lineBetween(x + d * 6 - 1, y - 4, x + d * 6 + 1, y - 2).lineBetween(x + d * 6 - 1, y - 2, x + d * 6 + 1, y - 4);
      g.fillStyle(0xe89aa8, 1).fillRect(x + d * 8 - (d < 0 ? 1 : 0), y - 2, 1, 2);
      return;
    }
    const flash = gait.phase === 'telegraph' && Math.floor(gait.age / 4) % 2 === 0;
    g.fillStyle(flash ? 0xff5030 : 0x8c8a94, 1).fillRect(x - 6, y - 8, 12, 6);
    g.fillStyle(0xf2efe6, 1).fillRect(x + d * 5 - (d < 0 ? 4 : 0), y - 8, 4, 4);
    g.fillStyle(0xe89aa8, 1).fillRect(x + d * 8 - (d < 0 ? 1 : 0), y - 6, 1, 1).fillRect(x + d * 4 - (d < 0 ? 2 : 0), y - 10, 2, 2);
    g.fillStyle(0x1a1a1e, 1).fillRect(x + d * 6 - (d < 0 ? 1 : 0), y - 7, 1, 1);
    g.lineStyle(1, 0x4a4850, 1);
    for (const lx of [-4, -2, 2, 4]) g.lineBetween(x + lx, y - 2, x + lx, y);
  }

  /**
   * Placeholder Zopilote (GDD-ENM-02): a dark brown vulture 16 x 10 px with a pink head and beak facing the way it flies, wings
   * that flap while it cruises and are raised for its telegraph (which also flashes the body red, GDD-ENM-01), and three pale
   * thorns along its back, the mark of an enemy that cannot be stomped (GDD-CMB-01).
   */
  private drawZopilote(e: EnemyState): void {
    const f = e.flight!;
    const g = this.enemyGfx;
    const { x, y } = { x: e.x, y: f.y };
    const d = e.dir;
    this.enemiesPainted.push({ x, y, kind: 'zopilote' });
    const flash = f.phase === 'telegraph' && Math.floor(f.age / 4) % 2 === 0;
    const up = f.phase === 'telegraph' || (f.phase !== 'dive' && Math.floor(f.age / 8) % 2 === 0);
    const wingY = up ? y - 7 : y + 4;
    g.fillStyle(0x6b5340, 1).fillTriangle(x - 7, y - 1, x - 1, y - 1, x - 8, wingY).fillTriangle(x + 1, y - 1, x + 7, y - 1, x + 8, wingY);
    g.fillStyle(flash ? 0xff5030 : 0x4a3a30, 1).fillRect(x - 6, y - 2, 12, 6);
    g.fillStyle(0xd98c7a, 1).fillRect(x + d * 6 - (d < 0 ? 3 : 0), y - 3, 3, 3);
    g.fillStyle(0xe9d3a3, 1).fillRect(x + d * 8 - (d < 0 ? 2 : 0), y - 1, 2, 1);
    g.fillStyle(0xf2efe6, 1);
    for (const tx of [-5, -1, 3]) g.fillTriangle(x + tx, y - 2, x + tx + 3, y - 2, x + tx + 1.5, y - 5);
  }

  /** Fireballs in flight (GDD-PWR-03): an orange ball with a pale yellow core. */
  private drawFireballs(): void {
    this.fireballGfx.clear();
    this.fireballsPainted = this.run.fireballs.length;
    for (const f of this.run.fireballs) {
      this.fireballGfx.fillStyle(0xe8602d, 1).fillCircle(f.x, f.y - FIREBALL.size / 2, FIREBALL.size / 2);
      this.fireballGfx.fillStyle(0xffe27a, 1).fillCircle(f.x, f.y - FIREBALL.size / 2, FIREBALL.size / 4);
    }
  }

  /** The taco pickups still waiting in the level (GDD-PWR-02). Redrawn when one is picked up or they all come back. */
  private drawTacos(): void {
    this.tacosKey = this.run.tacosTaken.join();
    this.tacoGfx.clear();
    this.tacosPainted = 0;
    this.level.tacos.forEach((t, i) => {
      if (this.run.tacosTaken[i]) return;
      this.tacosPainted++;
      this.paintTaco(this.tacoGfx, t.col * TILE + TILE / 2, t.row * TILE + TILE / 2 - 1, 12);
    });
  }

  /** The hilos not yet collected (GDD-WLD-04), each in the next serape colour. Redrawn when one is collected. */
  private drawHilos(): void {
    this.hilosKey = this.run.hilosTaken.join();
    this.hiloGfx.clear();
    this.hilosPainted = 0;
    (this.level.hilos ?? []).forEach((h, i) => {
      if (this.run.hilosTaken[i]) return;
      this.hilosPainted++;
      this.paintHilo(this.hiloGfx, h.col * TILE + TILE / 2, h.row * TILE + TILE / 2, hiloColour(i));
    });
  }

  /** Placeholder skein (GDD-WLD-04): a round coil of thread, two dark wraps across it and a short loose end. The middle stays plain colour. */
  private paintHilo(g: Phaser.GameObjects.Graphics, cx: number, cy: number, colour: number): void {
    g.fillStyle(colour, 1).fillCircle(cx, cy, HILO.size / 2);
    g.lineStyle(1, 0x382e47, 0.6);
    for (const dy of [-2, 2]) g.beginPath().moveTo(cx - 3, cy + dy).lineTo(cx + 3, cy + dy).strokePath();
    g.lineStyle(1, colour, 1).beginPath().moveTo(cx + 3, cy + 3).lineTo(cx + 6, cy + 5).strokePath();
  }

  /**
   * GDD-UI-01: a yellow skein and "collected/total", right-aligned to the screen's edge, or to the touch pause button. Redrawn
   * when the text or the right edge changes, which `update()` checks every frame.
   */
  private drawHiloCounter(): void {
    const pause = this.touch.debug().buttons.find((b) => b.id === 'pause');
    const text = hiloCounterText(hilosCollected(this.run.hilosTaken), this.level.hilos?.length ?? 0);
    const right = hiloCounterRight(pause);
    if (`${text}|${right}` === this.hiloHudKey) return;
    this.hiloHudKey = `${text}|${right}`;
    this.hiloText.setText(text).setPosition(right, HILO_HUD.top);
    this.hiloIconX = right - this.hiloText.width - HILO_HUD.iconGap - HILO_HUD.iconSize / 2;
    this.hiloIcon.clear();
    this.paintHilo(this.hiloIcon, this.hiloIconX, HILO_HUD.top + this.hiloText.height / 2, HILO_COLOURS[1]);
  }

  /**
   * Placeholder piñata art (GDD-PWR-05): a closed one is a diamond in four party colours with a fringe along the top and a
   * string, so it reads as a piñata and not as a tile. An open one is a dull torn shell with a dark hole, so the two
   * differ by shape and not only by colour (GDD-UI-03).
   */
  private drawPinatas(): void {
    this.pinatasKey = this.run.pinatasOpen.join();
    this.pinataGfx.clear();
    this.pinatasPainted = this.level.pinatas.map(() => false);
    this.level.pinatas.forEach((p, i) => {
      const x = p.col * TILE;
      const y = p.row * TILE;
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      if (this.run.pinatasOpen[i]) {
        this.pinatasPainted[i] = true; // painted as the open shell
        this.pinataGfx.fillStyle(0x8a7a62, 1).fillTriangle(x + 1, cy, cx, y + 2, x + TILE - 1, cy).fillTriangle(x + 1, cy, x + TILE - 1, cy, cx, y + TILE - 1);
        this.pinataGfx.fillStyle(0x2a2218, 1).fillRect(cx - 4, cy - 2, 8, 4);
        this.pinataGfx.lineStyle(1, 0x4a3f2e, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        return;
      }
      this.pinataGfx.fillStyle(0xe0508a, 1).fillTriangle(x + 1, cy, cx, y + 1, cx, cy);
      this.pinataGfx.fillStyle(0xf2c230, 1).fillTriangle(x + TILE - 1, cy, cx, y + 1, cx, cy);
      this.pinataGfx.fillStyle(0x2fb5a0, 1).fillTriangle(x + 1, cy, cx, y + TILE - 1, cx, cy);
      this.pinataGfx.fillStyle(0xf28a30, 1).fillTriangle(x + TILE - 1, cy, cx, y + TILE - 1, cx, cy);
      this.pinataGfx.lineStyle(1, 0x3a1530, 1).strokeTriangle(x + 1, cy, cx, y + 1, x + TILE - 1, cy).strokeTriangle(x + 1, cy, cx, y + TILE - 1, x + TILE - 1, cy);
      this.pinataGfx.fillStyle(0xfff3dc, 1).fillRect(x + 3, y, TILE - 6, 1);
    });
  }

  /**
   * Placeholder fragile wall (GDD-WLD-05): papel picado, a pink paper tile with cut-out diamonds and a scalloped pale top
   * edge, so it reads as thin paper and not as a solid block. Broken tiles are not drawn.
   */
  private drawFragiles(): void {
    this.fragilesKey = this.run.fragilesBroken.join();
    this.fragileGfx.clear();
    this.fragilesPainted = 0;
    this.level.fragiles.forEach((f, i) => {
      if (this.run.fragilesBroken[i]) return;
      this.fragilesPainted++;
      const x = f.col * TILE;
      const y = f.row * TILE;
      this.fragileGfx.fillStyle(0xe0508a, 1).fillRect(x, y, TILE, TILE);
      this.fragileGfx.fillStyle(0x1b2036, 1).fillTriangle(x + 8, y + 3, x + 12, y + 8, x + 8, y + 13).fillTriangle(x + 8, y + 3, x + 4, y + 8, x + 8, y + 13);
      this.fragileGfx.fillStyle(0xfff3dc, 1).fillRect(x, y, 3, 2).fillRect(x + 6, y, 4, 2).fillRect(x + 13, y, 3, 2);
      this.fragileGfx.lineStyle(1, 0x7a2a4a, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    });
  }

  /**
   * The claw swipe (GDD-CMB-02): while winding up, a small raised paw mark in front of Poncho; while swinging, three slanted
   * pale slashes across the hit box, so the reach shows. Read from the simulation, drawn every frame.
   */
  private drawClaw(): void {
    const { player, claw } = this.run;
    this.clawGfx.clear();
    this.clawPainted = 'none';
    if (this.run.phase !== 'playing' || claw.phase === 'idle') return;
    const dir = claw.dir;
    if (claw.phase === 'windup') {
      this.clawPainted = 'windup';
      const px = player.x + dir * (HITBOX.width / 2 + 2);
      this.clawGfx.fillStyle(0xfff3dc, 1).fillCircle(px, player.y - HITBOX.height - 1, 2);
      return;
    }
    const box = clawBox(player, claw);
    if (!box) return;
    this.clawPainted = 'swing';
    this.clawGfx.lineStyle(2, 0xfff3dc, 1);
    for (let i = 0; i < 3; i++) {
      const x = dir > 0 ? box.x0 + 3 + i * 6 : box.x1 - 3 - i * 6;
      this.clawGfx.lineBetween(x, box.y0, x + dir * 4, box.y1);
    }
  }

  /** A small golden key: a ring for the head, a shaft and two teeth. `size` is the height in px. */
  private paintKey(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const u = size / 12;
    g.fillStyle(0xf2c230, 1).fillCircle(cx, cy - 3 * u, 3 * u).fillRect(cx - 0.75 * u, cy - u, 1.5 * u, 6 * u).fillRect(cx, cy + 3 * u, 2.5 * u, 1.2 * u).fillRect(cx, cy + 5 * u, 2 * u, 1.2 * u);
    g.fillStyle(0x1b2036, 1).fillCircle(cx, cy - 3 * u, 1.2 * u);
    g.lineStyle(1, 0x6b4e0a, 1).strokeCircle(cx, cy - 3 * u, 3 * u);
  }

  /**
   * Placeholder doors and keys (GDD-WLD-05): a shut door is a wooden plank wall with an iron band and a keyhole, so it reads
   * as a door and not as a tile; once open it is not drawn. A key lying on the floor is the golden key, until picked up.
   */
  private drawDoorsAndKeys(): void {
    this.doorsKey = `${this.run.doorsOpen.join()}|${this.run.keysTaken.join()}`;
    this.doorGfx.clear();
    this.doorsPaintedShut = this.level.doors.map(() => false);
    this.level.doors.forEach((d, i) => {
      if (this.run.doorsOpen[i]) return;
      this.doorsPaintedShut[i] = true;
      const x = d.col * TILE;
      const y = d.row * TILE;
      const h = d.height * TILE;
      this.doorGfx.fillStyle(0x8b5a2b, 1).fillRect(x, y, TILE, h);
      this.doorGfx.lineStyle(1, 0x4a2f14, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, h - 1).lineBetween(x + TILE / 2, y, x + TILE / 2, y + h);
      this.doorGfx.fillStyle(0x3a3f4f, 1).fillRect(x, y + 4, TILE, 2).fillRect(x, y + h - 6, TILE, 2);
      this.doorGfx.fillStyle(0xf2c230, 1).fillCircle(x + TILE / 2, y + h / 2, 2).fillRect(x + TILE / 2 - 0.5, y + h / 2, 1, 4);
    });
    this.keyGfx.clear();
    this.keysPainted = 0;
    this.level.keys.forEach((k, i) => {
      if (this.run.keysTaken[i]) return;
      this.keysPainted++;
      this.paintKey(this.keyGfx, k.col * TILE + TILE / 2, k.row * TILE + TILE / 2, 12);
    });
  }

  /** The tacos walking about after a piñata (GDD-PWR-02), drawn where the simulation has them. */
  private drawItems(): void {
    this.itemGfx.clear();
    this.itemsDrawn = this.run.items.map((it) => ({ x: it.x, y: it.y, kind: it.kind }));
    for (const it of this.run.items) {
      if (it.kind === 'chile') this.paintChile(this.itemGfx, it.x, it.y - 6, 12);
      else this.paintTaco(this.itemGfx, it.x, it.y - 7, 12);
    }
  }

  /** Placeholder spring art (GDD-WLD-05): a red block with a pale zigzag coil and a bar on top, to read as springy and not as floor. */
  private drawSprings(): void {
    const g = this.add.graphics().setDepth(1);
    for (const sp of this.level.springs) {
      const x = sp.col * TILE;
      const y = sp.row * TILE;
      g.fillStyle(0xb8453a, 1).fillRect(x, y, TILE, TILE);
      g.lineStyle(1, 0x5e1f1a, 1).strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      g.fillStyle(0xfff3dc, 1).fillRect(x + 1, y + 1, TILE - 2, 3);
      g.lineStyle(1, 0xfff3dc, 1).lineBetween(x + 3, y + 6, x + 13, y + 8).lineBetween(x + 13, y + 8, x + 3, y + 10).lineBetween(x + 3, y + 10, x + 13, y + 12);
    }
  }

  /** Placeholder spike art: two light points per tile with a dark outline, inside the lower half that hurts (GDD-WLD-05, GDD-UI-03 high-contrast hazards). */
  private drawSpikes(): void {
    const g = this.add.graphics().setDepth(2);
    for (const s of this.level.spikes) {
      const x = s.col * TILE;
      const bottom = (s.row + 1) * TILE;
      for (const px of [x, x + TILE / 2]) {
        g.fillStyle(0xe5e8f2, 1).fillTriangle(px + 0.5, bottom, px + TILE / 2 - 0.5, bottom, px + TILE / 4, bottom - SPIKE.height);
        g.lineStyle(1, 0x12162a, 1).strokeTriangle(px + 0.5, bottom, px + TILE / 2 - 0.5, bottom, px + TILE / 4, bottom - SPIKE.height);
      }
    }
  }

  /**
   * Placeholder ofrenda art (GDD-WLD-05): an outlined frame when unused, filled with a flame on top once used, so the two
   * differ by shape and not only by colour (GDD-UI-03). Real art arrives with GDD-ART-01.
   */
  private drawOfrendas(): void {
    this.ofrendaGfx.clear();
    this.ofrendasDrawn = this.level.ofrendas.map((o) => ({ id: o.id, x: o.x, used: this.run.lives.used.has(`ofrenda:${o.id}`) }));
    for (const o of this.level.ofrendas) {
      const used = this.run.lives.used.has(`ofrenda:${o.id}`);
      const x = o.x - OFRENDA.width / 2;
      const y = o.y - OFRENDA.height;
      if (used) {
        this.ofrendaGfx.fillStyle(0xe8a33d, 1).fillRect(x + 2, y + 10, OFRENDA.width - 4, OFRENDA.height - 10);
        this.ofrendaGfx.fillStyle(0xfff3dc, 1).fillTriangle(x + 8, y, x + 4, y + 10, x + 12, y + 10);
      }
      this.ofrendaGfx.lineStyle(1, used ? 0xfff3dc : 0x9ba3c4, 1).strokeRect(x + 2.5, y + 10.5, OFRENDA.width - 5, OFRENDA.height - 11);
    }
    this.ofrendasKey = this.usedKey();
  }

  /**
   * Placeholder exit art (GDD-WLD-03): a wooden arch over the exit box, two 3 px posts at its sides and a 4 px lintel across the top,
   * with a marigold pennant on a 1 px pole above it. Drawn once; a level without an exit has none.
   */
  private drawExit(): void {
    const exit = this.level.exit;
    this.exitPainted = exit !== undefined;
    if (!exit) return;
    const g = this.add.graphics().setDepth(1);
    const x = exit.x - EXIT.width / 2;
    const y = exit.y - EXIT.height;
    g.fillStyle(0x8b5a2b, 1).fillRect(x, y, 3, EXIT.height).fillRect(x + EXIT.width - 3, y, 3, EXIT.height).fillRect(x, y, EXIT.width, 4);
    g.lineStyle(1, 0x4a2f14, 1).strokeRect(x + 0.5, y + 0.5, 2, EXIT.height - 1).strokeRect(x + EXIT.width - 2.5, y + 0.5, 2, EXIT.height - 1).strokeRect(x + 0.5, y + 0.5, EXIT.width - 1, 3);
    g.fillStyle(0x4a2f14, 1).fillRect(exit.x - 0.5, y - 9, 1, 9);
    g.fillStyle(0xf2a33a, 1).fillTriangle(exit.x + 0.5, y - 9, exit.x + 8.5, y - 6, exit.x + 0.5, y - 3);
  }

  /**
   * Placeholder veladora art (GDD-LIFE-03): a red glass 8 px wide and 7 px tall at the bottom of its 12 x 12 box, a white candle top
   * above it and a yellow flame on top. Not drawn once used, nor when the level has none. Redrawn when it is used or comes back.
   */
  private drawVeladora(): void {
    const v = this.level.veladora;
    this.veladoraGfx.clear();
    this.veladoraUsedDrawn = v !== undefined && veladoraUsed(this.run.lives, v);
    this.veladoraPainted = v !== undefined && !this.veladoraUsedDrawn;
    if (!v || this.veladoraUsedDrawn) return;
    const cx = v.col * TILE + TILE / 2;
    const bottom = v.row * TILE + TILE / 2 + VELADORA.size / 2;
    const g = this.veladoraGfx;
    g.fillStyle(0xb8352a, 1).fillRect(cx - 4, bottom - 7, 8, 7);
    g.lineStyle(1, 0x5e0f0a, 1).strokeRect(cx - 3.5, bottom - 6.5, 7, 6);
    g.fillStyle(0xfff3dc, 1).fillRect(cx - 2, bottom - 10, 4, 3);
    g.fillStyle(0xffd27a, 1).fillTriangle(cx - 1.5, bottom - 10, cx + 1.5, bottom - 10, cx, bottom - 12);
  }

  /** GDD-AUD-02: a hilo note is the one sound played faster, `semitones` above its root. */
  private playSfx(name: 'ofrenda' | SfxName, semitones?: number): void {
    this.sfxLog.push(semitones === undefined ? name : `${name}:${semitones}`);
    const rate = semitones === undefined ? 1 : noteRate(semitones);
    // GDD-UI-02, GDD-AUD-01: every sound effect plays at Master times Effects. The log holds what the audio system was given.
    const options = { rate, volume: sfxVolume(this.settings) };
    this.sound.play(`sfx-${name}`, options);
    this.sfxPlayed.push({ key: `sfx-${name}`, ...options });
  }

  private usedKey(): string {
    return this.level.ofrendas.map((o) => (this.run.lives.used.has(`ofrenda:${o.id}`) ? '1' : '0')).join('');
  }

  private setLives(lives: RunState['lives']): void {
    this.run = { ...this.run, lives };
    this.drawHud();
  }

  /** GDD-UI-01: filled triangle per life, outline only per lost life. */
  private drawHud(): void {
    this.hud.clear();
    this.hudFilled = 0;
    // GDD-LIFE-02: a life lost since the last drawing starts a crack on its triangle.
    this.cracks = updateCracks(this.cracks, this.drawnLives, this.run.lives.lives, this.ticks);
    this.drawnLives = this.run.lives.lives;
    this.cracksDrawn = [];
    // GDD-UI-01: a small icon of the power-up state, to the right of the triangles. Nothing in Base.
    this.hudPower = this.run.power;
    this.paintHeld(this.hud, LIVES_HUD.left + 7 * (LIVES_HUD.width + LIVES_HUD.gap) + 6, LIVES_HUD.top + 3, this.run.power, 13);
    // GDD-WLD-05: one small key per key Poncho carries, after the power-up icon.
    this.hudKeyCount = this.run.keysHeld;
    for (let i = 0; i < this.run.keysHeld; i++) this.paintKey(this.hud, LIVES_HUD.left + 7 * (LIVES_HUD.width + LIVES_HUD.gap) + 34 + i * 9, LIVES_HUD.top + 5, 12);
    // GDD-LIFE-04: with one life left, its triangle pulses, counted from the step the lives dropped to one.
    this.pulseStart = updatePulseStart(this.pulseStart, this.run.lives.lives, this.ticks);
    this.pulseDrawn = lastLifePulse(this.run.lives.lives, this.ticks - (this.pulseStart ?? 0));
    layoutLives(this.run.lives.lives).forEach((triangle, index) => {
      const [x1, y1, x2, y2, x3, y3] = index === 0 && this.pulseDrawn !== null ? pulsedPoints(triangle, this.pulseDrawn) : triangle.points;
      const { filled } = triangle;
      if (filled) {
        this.hudFilled++;
        this.hud.fillStyle(0xb94842, 1).fillTriangle(x1, y1, x2, y2, x3, y3);
        this.hud.lineStyle(1, 0xfff3dc, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
        return;
      }
      const frame = crackFrame(this.cracks.find((c) => c.index === index) ?? { index, start: Infinity }, this.ticks);
      if (frame) {
        // Cracking: the red fill fades out, and a crack line shows across it, over the outline of a lost life.
        this.cracksDrawn.push({ index, ...frame });
        this.hud.fillStyle(0xb94842, frame.fillAlpha).fillTriangle(x1, y1, x2, y2, x3, y3);
        const line = crackLine(triangle);
        this.hud.lineStyle(1, 0xfff3dc, frame.crackAlpha).beginPath().moveTo(line[0]!, line[1]!);
        for (let i = 2; i < line.length; i += 2) this.hud.lineTo(line[i]!, line[i + 1]!);
        this.hud.strokePath();
      }
      this.hud.lineStyle(1, 0x9ba3c4, 1).strokeTriangle(x1, y1, x2, y2, x3, y3);
    });
  }

  /** GDD-LIFE-05: the screen is up while the run shows it; its prompt only once a press would be taken (after 1.0 s). */
  private drawGameOver(): void {
    const shown = this.run.phase === 'gameover';
    this.gameOver.setVisible(shown);
    this.gameOverPrompt.setVisible(shown && this.run.wait >= GAME_OVER.lockoutSteps);
  }

  /**
   * GDD-UI-02: the level clear screen is up while the run shows it. Its hilo line, time line and medal line (a disc and its text, in
   * the medal's colour) appear as `revealedLines` says; its prompt only once a press would be taken (after 1.0 s).
   */
  private drawClear(): void {
    const shown = this.run.phase === 'clear';
    if (shown && !this.clearScreen.visible) this.clearRevealLog = [];
    this.clearScreen.setVisible(shown);
    if (shown) {
      const lines = revealedLines(this.run);
      const kind = medal(this.run, this.level);
      const colour = `#${MEDAL.colours[kind].toString(16).padStart(6, '0')}`;
      this.clearHilos.setText(`Hilos ${hilosCollected(this.run.hilosTaken)}/${this.level.hilos?.length ?? 0}`).setVisible(lines >= 1);
      this.clearTime.setText(clearTime(this.run.clock)).setVisible(lines >= 2);
      this.clearMedalText.setText(medalLabel(kind)).setColor(colour).setVisible(lines >= 3);
      const place = medalLine(this.clearMedalText.width);
      this.clearMedalDiscX = place.discX;
      this.clearMedalText.setX(place.textX);
      this.clearMedalDisc.clear().fillStyle(MEDAL.colours[kind], 1).fillCircle(place.discX, 150, MEDAL.discPx / 2).setVisible(lines >= 3);
      this.clearRevealLog.push({ wait: this.run.wait, lines: this.clearLinesVisible() });
    }
    this.clearPrompt.setVisible(shown && this.run.wait >= GAME_OVER.lockoutSteps);
  }

  /** How many of the clear screen's hilo, time and medal lines are visible, counted from the drawn objects (the medal line counts if its disc or its text is). */
  private clearLinesVisible(): number {
    return [this.clearHilos.visible, this.clearTime.visible, this.clearMedalText.visible || this.clearMedalDisc.visible].filter(Boolean).length;
  }

  /**
   * GDD-UI-05: the tutorial tip. A dark box with its text at the top middle of the screen, and its thing in the level outlined with a
   * dashed line that grows and shrinks with a small arrow above it, all at the fade's opacity; the touch button it names is outlined
   * too. Nothing is drawn at opacity 0.
   */
  private drawTip(): void {
    const tip = this.tipFade.index !== null ? this.entry.tips?.[this.tipFade.index] : undefined;
    const alpha = tip ? this.tipFade.alpha : 0;
    const shown = tip !== undefined && alpha > 0;
    this.tipBox.setVisible(shown).setAlpha(alpha);
    this.tipGfx.clear();
    let highlight: ReturnType<PonchoDebug['tip']>['highlight'] = null;
    let drawnGrow = 0;
    if (shown) {
      const text = tipText(tip, this.device, this.settings.language);
      if (this.tipText.text !== text) this.tipText.setText(text);
      const w = this.tipText.width;
      const h = this.tipText.height;
      this.tipBg.setPosition(BASE_WIDTH / 2 - w / 2 - TIPS.boxPad, TIPS.boxTop).setSize(w + 2 * TIPS.boxPad, h + 2 * TIPS.boxPad);
      if (tip.highlight) {
        highlight = highlightBox(tip.highlight);
        const beat = pulse(this.tipStep);
        const grow = beat * TIPS.growPx;
        drawnGrow = grow;
        const [x, y, bw, bh] = [highlight.x - grow, highlight.y - grow, highlight.w + 2 * grow, highlight.h + 2 * grow];
        this.tipGfx.lineStyle(1, 0xfff3dc, alpha);
        dashedRect(this.tipGfx, x, y, bw, bh);
        const tipY = y - TIPS.arrowGapPx - beat * TIPS.bobPx;
        this.tipGfx.fillStyle(0xfff3dc, alpha).fillTriangle(x + bw / 2 - TIPS.arrowPx / 2, tipY - TIPS.arrowPx, x + bw / 2 + TIPS.arrowPx / 2, tipY - TIPS.arrowPx, x + bw / 2, tipY);
      }
    }
    // GDD-UI-05: the touch button is outlined only while touch is the device used last.
    this.touch.highlight(shown && this.device === 'touch' ? (tip.button ?? null) : null, pulse(this.tipStep), alpha);
    this.tipPainted = {
      index: shown ? this.tipFade.index : null,
      text: shown ? this.tipText.text : '',
      alpha,
      device: this.device,
      highlight,
      grow: drawnGrow,
      button: shown ? (tip.button ?? null) : null,
      box: shown ? { x: this.tipBg.x, y: this.tipBg.y, w: this.tipBg.width, h: this.tipBg.height } : { x: 0, y: 0, w: 0, h: 0 },
    };
  }

  /** GDD-UI-04: the camera follows the body where it is drawn, and stands still while it is hidden. */
  private followBody(): void {
    this.scrollX = followCamera(this.scrollX, this.body.visible ? this.body.x : null, this.world.width * TILE);
    this.cameras.main.setScroll(this.scrollX, 0);
    // GDD-ART-06: the far layers move at a share of the scroll, in art pixels of their textures.
    const cloudShift = parallaxOffset(this.scrollX, BACKDROP.cloudFactor);
    BACKDROP_ART.clouds.forEach(({ x }, i) => {
      const at = (((x - cloudShift) % BASE_WIDTH) + BASE_WIDTH) % BASE_WIDTH;
      this.cloudImages[i]![0]!.x = at;
      this.cloudImages[i]![1]!.x = at - BASE_WIDTH;
    });
    this.mountains.tilePositionX = parallaxOffset(this.scrollX, BACKDROP.mountainFactor) * ART_SCALE;
    this.desert.tilePositionX = parallaxOffset(this.scrollX, BACKDROP.desertFactor) * ART_SCALE;
  }

  /** One fixed simulation step with the given input. */
  private simStep(input: PlayerInput): void {
    const before = this.run;
    this.run = stepRun(before, input, this.level);
    const { sounds, combo } = stepSounds(before, this.run, this.hiloCombo);
    this.hiloCombo = combo;
    for (const sound of sounds) this.playSfx(sound.name, sound.semitones);
    // Do not smear the picture across a respawn: only interpolate while playing on both sides of the step.
    this.prevPlayer = before.phase === 'playing' && this.run.phase === 'playing' ? before.player : this.run.player;
    this.ticks++;
    if (this.run.phase !== before.phase) this.phaseSince = this.ticks;
    // GDD-UI-05: the tutorial tips follow Poncho by steps, so they stand still with the game.
    const tips = this.entry.tips;
    if (tips) {
      this.tipsDoneNow = nextTipsDone(this.tipsDoneNow, tips, before, this.run, this.level);
      this.tipFade = stepTipFade(this.tipFade, activeTip(tips, this.run.player.x, this.run.phase, this.tipsDoneNow));
      this.tipStep++;
    }
    this.anim = stepAnim(this.anim, this.run.player, this.run.phase === 'playing');
    if (before.claw.phase === 'idle' && this.run.claw.phase === 'windup') this.swings++;
    this.spits += this.run.fireballs.filter((f) => f.age === 0).length;
    const { player } = this.run;
    if (player.grounded) {
      if (this.peak > 0) this.lastPeak = this.peak;
      this.peak = 0;
    } else {
      this.peak = Math.max(this.peak, this.floorY - player.y);
    }
  }

  /**
   * Draws Poncho. Interpolated between the last two simulation states while playing. While waiting to respawn he is
   * hidden and then flips in; after it he blinks while invulnerable (GDD-LIFE-02).
   */
  private renderBody(alpha: number): void {
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const { player } = this.run;
    if (this.run.phase === 'gameover' || (this.run.phase === 'respawning' && isOutOfLives(this.run.lives))) {
      // GDD-LIFE-05: no flip after the last life; he stays hidden until the screen is done and the restart flips him in.
      this.body.setVisible(false);
    } else if (this.run.phase === 'respawning') {
      // GDD-LIFE-02: hidden at first, then he drops in above the respawn point, turning once, and lands feet-first.
      const pose = flipPose(this.run.wait);
      const at = respawnPoint(this.run, this.level);
      this.body.setPosition(at.x, at.y - pose.dy - HITBOX.height / 2).setRotation(pose.angle).setVisible(pose.visible);
    } else {
      this.body.setPosition(lerp(this.prevPlayer.x, player.x), lerp(this.prevPlayer.y, player.y) - HITBOX.height / 2).setRotation(0).setVisible(true);
    }
    this.bodySprite.setFrame(this.anim.frame).setFlipX(player.facing < 0);
    this.glideGfx.setVisible(this.run.phase === 'playing' && player.gliding === true);
    this.paintCling(this.run.phase === 'playing' && player.clinging === true ? (player.wallSide ?? 0) : 0);
    // The blink phase comes from the invulnerability counter, so it is the same every time: bright for the first
    // 0.1 s after a respawn, then dim and bright in turn.
    this.body.setAlpha(Math.floor(this.run.invulnerable / BLINK_STEPS) % 2 === 1 ? 0.3 : 1);
    // GDD-PWR-01: in Taco he holds a taco in front of him, on the side he faces. It follows the body, blink and all.
    this.heldGfx.clear().setVisible(this.run.power !== 'base' && this.run.phase === 'playing').setAlpha(this.body.alpha);
    this.heldPower = this.heldGfx.visible ? this.run.power : 'base';
    if (this.heldGfx.visible) this.paintHeld(this.heldGfx, this.body.x + player.facing * (HITBOX.width / 2 + 1), this.body.y - 1, this.run.power, 10);
  }

  override update(_time: number, deltaMs: number): void {
    const dev = this.devKeys;
    if (dev) {
      if (Phaser.Input.Keyboard.JustDown(dev.lose)) this.setLives(loseLife(this.run.lives));
      if (Phaser.Input.Keyboard.JustDown(dev.ofrenda)) this.setLives(activateOfrenda(this.run.lives, `dev-${this.devOfrendas++}`));
      if (Phaser.Input.Keyboard.JustDown(dev.veladora)) this.setLives(collectVeladora(this.run.lives, `dev-${this.devVeladoras++}`));
    }

    this.touch.setFuego(this.run.power === 'fuego'); // the Fuego button is there only in the Fuego state (GDD-CTL-03)
    // GDD-CTL-02: the gamepads, read once per frame (browsers report them only when asked, so they cannot be latched, GDD-CTL-04).
    this.pauseEvents.push(...this.pad.poll(readGamepads()));
    if (this.pad.active()) this.device = 'pad'; // GDD-UI-05
    let input = this.readInput();
    if (this.holdAtStart) {
      this.holdAtStart = false;
      input = this.endPause();
    }

    const settingsBefore = this.settings;
    const volumeChanged = () => this.settings.master !== settingsBefore.master || this.settings.effects !== settingsBefore.effects;
    const languageChanged = () => this.settings.language !== settingsBefore.language;
    const settingsChanged = () => volumeChanged() || languageChanged();

    // GDD-UI-02: the title screen. While it is up no step runs, and the pause events go to it: the title menu, its settings screen,
    // a tap that starts the level; Escape, P and losing focus do nothing on the menu. The button that started the level counts as
    // already held, as after a resume.
    if (this.title.shown) {
      const frame = titleFrame(this.title, this.pauseEvents, buttonsDown(input), this.settings);
      this.title = frame.state;
      this.settings = frame.settings;
      this.pauseEvents = [];
      if (!this.title.shown) {
        // GDD-UI-02: "Tutorial" plays 0-1; "Start" plays what the address or the save says. 0-1 counts as played the moment it
        // starts (GDD-PRG-02). A level other than the one behind the title starts at once as a scene of its own, the press held.
        const level = frame.start === 'tutorial' ? levelById(TUTORIAL_ID)! : startLevel(window.location.search, this.tutorialPlayed);
        const marks = level.id === TUTORIAL_ID && !this.tutorialPlayed;
        if (marks) {
          this.tutorialPlayed = true;
          playedThisVisit = true;
        }
        if (marks || settingsChanged()) this.saveSettings();
        if (level.id !== this.entry.id) {
          this.startNext(level);
          return;
        }
        input = this.endPause();
      }
      // No step runs while the title stays up, so the title frame is what uses the latched presses: they are spent, or a Left
      // tapped on the settings screen would stay pending and make the held Left look like a new press at the next frame.
      else this.consumeLatches();
    }

    // GDD-UI-02: apply the pause events since the last frame, in order. While paused no step runs; on resume
    // every button down counts as already held, so a press made while paused does nothing until pressed again.
    // Picking Quit to title ends the pause over a fresh run and the title screen.
    const wasPaused = this.pauseState.paused;
    const frame = pauseFrame(this.pauseState, this.pauseEvents, this.settings);
    this.pauseEvents = [];
    this.settings = frame.settings;
    if (frame.quit) {
      if (this.backToTitle(input, frame.portrait)) {
        if (settingsChanged()) this.saveSettings();
        return;
      }
    } else {
      this.pauseState = frame.state;
      if (!wasPaused && this.pauseState.paused) this.notePause();
      if (wasPaused && !this.pauseState.paused) input = this.endPause();
    }

    // GDD-PRG-02: a change is saved at once. GDD-UI-02: a volume change plays the jump sound at the new volume, so the player hears
    // it, and a language change plays nothing; a setting already at its end changes nothing, so nothing is saved or played.
    if (settingsChanged()) this.saveSettings();
    if (volumeChanged()) this.playSfx('jump');

    let stepped = false;
    if (!this.paused && !this.pauseState.paused && !this.title.shown) {
      this.alpha = this.stepper.advance(deltaMs / 1000, () => {
        stepped = true;
        this.simStep(input);
      });
    } else if (this.paused) {
      this.alpha = 1;
    }
    const alpha = this.alpha;
    // A latched tap is spent once a step has used it; if the frame ran no step it waits for the next one.
    if (stepped) this.consumeLatches();
    // GDD-UI-02: a press ended the level clear screen; the title comes back over a fresh run, with the draw calls below.
    // In a level with a next level (0-1, GDD-WLD-07) that press starts it instead, at once.
    if (this.run.phase === 'done') {
      const next = this.entry.next === undefined ? undefined : levelById(this.entry.next);
      if (next) {
        this.startNext(next);
        return;
      }
      if (this.backToTitle(input, this.pauseState.portrait)) return;
    }
    // Redraw when the lives change, and on every step while a triangle is cracking.
    if (this.run.lives.lives !== this.drawnLives || this.cracks.length > 0 || this.pulseDrawn !== null || this.run.power !== this.hudPower || this.run.keysHeld !== this.hudKeyCount) this.drawHud();
    if (`${this.run.doorsOpen.join()}|${this.run.keysTaken.join()}` !== this.doorsKey) this.drawDoorsAndKeys();
    if (this.run.tacosTaken.join() !== this.tacosKey) this.drawTacos();
    if (this.run.hilosTaken.join() !== this.hilosKey) this.drawHilos();
    this.drawHiloCounter();
    if (this.run.pinatasOpen.join() !== this.pinatasKey) this.drawPinatas();
    if (this.run.fragilesBroken.join() !== this.fragilesKey) this.drawFragiles();
    this.drawItems();
    this.drawFireballs();
    this.drawEnemies();
    if (this.run.crumbles.map((c) => `${c.phase}${c.steps}`).join() !== this.crumblesKey) this.drawCrumbles();
    const key = this.usedKey();
    if (key !== this.ofrendasKey) {
      // GDD-AUD-02: the marimba plays when an ofrenda is used for the first time, not when a restart resets them.
      const activated = countUsed(key) > countUsed(this.ofrendasKey);
      this.drawOfrendas();
      if (activated) this.playSfx('ofrenda');
    }

    this.renderPlatforms(alpha);
    this.renderBlocks(alpha);
    if (this.level.veladora && veladoraUsed(this.run.lives, this.level.veladora) !== this.veladoraUsedDrawn) this.drawVeladora();
    this.renderBody(alpha);
    this.followBody();
    this.drawClaw();
    // GDD-UI-02: from the frame of a language change every text is drawn in the new language.
    if (this.settings.language !== this.textLanguage) this.applyLanguage();
    this.drawGameOver();
    this.drawClear();
    this.drawTip();
    this.drawPause();
    this.drawTitle();
    this.drawSettings();
  }

  /** GDD-PRG-02: the settings and whether the tutorial was started go to the browser's storage. Where it is refused the game plays on with this visit's, silently. */
  private saveSettings(): void {
    settingsThisVisit = this.settings;
    try {
      window.localStorage.setItem(SAVE_KEY, saveText({ settings: this.settings, tutorialPlayed: this.tutorialPlayed }));
    } catch {
      // storage refused: the settings last until the page closes
    }
  }

  /**
   * GDD-UI-02: sets every text that switches with the Language row in the language in use (the table in `src/ui/text.ts`) and notes
   * the language, so `update()` sets them again on the frame it changes. "Hilos", the language names and the sandbox's placeholder
   * lines are the same in every language, and the tips and the upright prompts read the language where they are drawn.
   */
  private applyLanguage(): void {
    const t = TEXT[this.settings.language];
    this.titleItems.start.setText(t.start);
    this.titleItems.tutorial.setText(t.tutorial);
    this.titleItems.settings.setText(t.settings);
    this.pauseTitle.setText(t.paused);
    this.pauseItems.resume.setText(t.resume);
    this.pauseItems.settings.setText(t.settings);
    this.pauseItems.quit.setText(t.quit);
    this.settingsTitle.setText(t.settings);
    this.settingsLabels.master.setText(t.master);
    this.settingsLabels.effects.setText(t.effects);
    this.settingsLabels.language.setText(t.language);
    this.settingsLabels.back.setText(t.back);
    this.gameOverSubtitle.setText(t.gameOver);
    this.gameOverPrompt.setText(t.retry);
    this.clearTitle.setText(t.levelClear);
    this.clearPrompt.setText(t.pressAny);
    this.textLanguage = this.settings.language;
  }

  /** Spends every latched press (L-006): a step has used them, or no step will (the title screen, quitting to it). */
  private consumeLatches(): void {
    this.jumpLatch.consume();
    this.clawLatch.consume();
    this.fuegoLatch.consume();
    this.leftLatch.consume();
    this.rightLatch.consume();
    this.touch.consume();
  }

  /** GDD-UI-02: the game pauses. The fingers and the Left and Right keys down now keep pressing after it. */
  private notePause(): void {
    this.touch.notePause();
    this.pad.notePause();
    this.keysAtPause = new Map([...this.keys.left, ...this.keys.right].filter((k) => k.isDown).map((k) => [k, k.timeDown]));
  }

  /** What the keys, the touch controls and the gamepads press now. They work together: any can move or jump (GDD-CTL-01, GDD-CTL-02, GDD-CTL-03). */
  private readInput(): PlayerInput {
    const touch = this.touch.read();
    const pad = this.pad.input(); // the last poll: the same pad for every read in a frame
    // GDD-UI-02: a Left or Right key held back since a pause counts as up until it is released.
    for (const [k, t] of this.heldKeys) if (!k.isDown || k.timeDown !== t) this.heldKeys.delete(k);
    const leftKey = effectiveHeld(downExcept(this.keys.left, this.heldKeys), this.leftLatch);
    const rightKey = effectiveHeld(downExcept(this.keys.right, this.heldKeys), this.rightLatch);
    // Left and right also go in raw, before they cancel out in `move`: the Siete vidas gastadas screen counts a press of either (GDD-LIFE-05).
    return {
      left: leftKey || touch.left === true || pad.left === true,
      right: rightKey || touch.right === true || pad.right === true,
      move: Math.max(-1, Math.min(1, (rightKey ? 1 : 0) - (leftKey ? 1 : 0) + touch.move + pad.move)),
      jumpHeld: effectiveHeld(down(this.keys.jump), this.jumpLatch) || touch.jumpHeld || pad.jumpHeld,
      claw: effectiveHeld(down(this.keys.claw), this.clawLatch) || touch.claw === true || pad.claw === true,
      fuego: effectiveHeld(down(this.keys.fuego), this.fuegoLatch) || touch.fuego === true || pad.fuego === true,
    };
  }

  /**
   * GDD-UI-02: the level goes on after a resume or the title screen. A finger or a Left or Right key that went down meanwhile is
   * no game press: it is ignored until it lifts, so the input is read again without it. Every button down counts as already held.
   */
  private endPause(): PlayerInput {
    this.touch.holdBack();
    this.pad.holdBack();
    for (const k of [...this.keys.left, ...this.keys.right]) if (k.isDown && this.keysAtPause.get(k) !== k.timeDown) this.heldKeys.set(k, k.timeDown);
    this.keysAtPause = new Map();
    // A quick tap of Left or Right while paused is spent too. Jump, claw and Fuego taps are held by `resumeHeld` instead.
    this.leftLatch.consume();
    this.rightLatch.consume();
    const now = this.readInput();
    this.run = resumeHeld(this.run, now);
    return now;
  }

  /**
   * GDD-UI-02: the press that ended the level clear screen starts the next level (1-1 after 0-1, GDD-WLD-07) at once: a fresh run with
   * seven lives (GDD-LIFE-05) in a scene of its own, which draws that level and takes the place of this one. Its first frame counts the
   * buttons down as already held, so the press does not jump, claw or spit there.
   */
  private startNext(next: LevelEntry): void {
    this.replaceWith({ entry: next, direct: true });
  }

  /** This scene is removed and a fresh one, with its own key, takes its place and starts. */
  private replaceWith(options: PlayOptions): void {
    const scenes = this.game.scene;
    scenes.remove(this.scene.key);
    const scene = new PlayScene(options);
    scenes.add(scene.sys.settings.key, scene, true);
  }

  /**
   * GDD-UI-02: Quit to title, or the end of the level clear screen. A fresh run as when the game opens, behind the title screen
   * waiting for a press. No step runs on the title, so every latched key press is spent here, or a quick tap that picked would stay
   * latched and a new press would not be new. The buttons down now count as held on the title, so the one that picked (or that ended
   * the clear screen) does not start the level. When "Start" no longer plays this level (the tutorial has started, so it plays 1-1),
   * a fresh scene of that level takes this one's place with the same title and this returns true: `update` must return at once.
   */
  private backToTitle(input: PlayerInput, portrait: boolean): boolean {
    const startsWith = startLevel(window.location.search, this.tutorialPlayed);
    if (startsWith.id !== this.entry.id) {
      this.replaceWith({ entry: startsWith, title: titleAfterQuit(portrait, buttonsDown(input)) });
      return true;
    }
    this.run = startRun(this.level);
    this.prevPlayer = this.run.player;
    this.anim = startAnim(this.run.player.x);
    this.peak = 0;
    this.hiloCombo = NO_COMBO;
    this.tipFade = NO_TIP;
    this.tipsDoneNow = (this.entry.tips ?? []).map(() => false);
    this.tipStep = 0;
    this.stepper.reset();
    // The HUD's crack and last-life pulse need no reset: `updateCracks` drops a crack on a triangle that is filled again and
    // `updatePulseStart` clears at any life count but one.
    this.title = titleAfterQuit(portrait, buttonsDown(input));
    this.pauseState = PLAYING;
    this.consumeLatches();
    // The finger that picked Quit is held back too, and the fingers and keys down at the pause are forgotten: on the title screen
    // none was held before.
    this.touch.holdBack();
    this.pad.holdBack();
    this.keysAtPause = new Map();
    return false;
  }

  /**
   * GDD-UI-02: the pause screen. Sideways it shows the menu, with a ">" in front of the chosen item; upright the menu is hidden
   * and the prompt asks to turn the device sideways. The rows follow the window, since they grow on a small screen. While the
   * settings screen is open it takes the pause screen's place.
   */
  private drawPause(): void {
    const settingsOpen = this.pauseState.settings !== null;
    this.pauseScreen.setVisible(this.pauseState.paused && !settingsOpen);
    const upright = this.pauseState.portrait;
    const prompt = upright ? TEXT[this.settings.language].sideways : '';
    if (this.pausePrompt.text !== prompt) this.pausePrompt.setText(prompt);
    this.pauseRows = layoutPauseMenu(this.scale.displaySize.width / BASE_WIDTH);
    for (const row of this.pauseRows) {
      const text = this.pauseItems[row.item];
      const chosen = row.item === this.pauseState.choice;
      text.setPosition(row.x + row.w / 2, row.y + row.h / 2).setColor(chosen ? '#fff3dc' : '#9ba3c4').setVisible(!upright);
      if (chosen) this.pauseMarker.setPosition(text.x - text.width / 2 - 8, text.y).setVisible(!upright);
    }
  }

  /**
   * GDD-UI-02: the title screen and its prompt line, which tells an upright phone to turn sideways first. Sideways the title menu
   * is there, with a ">" in front of the chosen item, as the pause menu; upright it is hidden. While the settings screen is open it
   * takes the title screen's place.
   */
  private drawTitle(): void {
    this.titleScreen.setVisible(this.title.shown && this.title.settings === null);
    // The touch buttons come back on the frame the title goes, not one frame later.
    this.touch.setHidden(this.title.shown);
    const prompt = titlePrompt(this.title.portrait, TEXT[this.settings.language].sideways);
    if (this.titlePromptText.text !== prompt.text) this.titlePromptText.setText(prompt.text).setFontSize(prompt.size);
    const upright = this.title.portrait;
    this.titleRows = layoutTitleMenu(this.scale.displaySize.width / BASE_WIDTH);
    for (const row of this.titleRows) {
      const text = this.titleItems[row.item];
      const chosen = row.item === this.title.choice;
      text.setPosition(row.x + row.w / 2, row.y + row.h / 2).setColor(chosen ? '#fff3dc' : '#9ba3c4').setVisible(!upright);
      if (chosen) this.titleMarker.setPosition(text.x - text.width / 2 - 8, text.y).setVisible(!upright);
    }
  }

  /**
   * GDD-UI-02: the settings screen, open from the pause menu or the title menu. Sideways it shows the four rows, the chosen one
   * pale and the others grey; a volume row has "<" and ">" and its bars, the Language row "<" and ">" and the language's own name
   * where the bars would be, Back a ">" in front of it when chosen. Upright the rows
   * are hidden and the prompt asks to turn the device sideways; the chosen row is kept. The rows follow the window.
   */
  private drawSettings(): void {
    const fromTitle = this.title.shown && this.title.settings !== null;
    const fromPause = !this.title.shown && this.pauseState.paused && this.pauseState.settings !== null;
    const row = fromTitle ? this.title.settings : fromPause ? this.pauseState.settings : null;
    const from = fromTitle ? 'title' : fromPause ? 'pause' : null;
    const upright = fromTitle ? this.title.portrait : this.pauseState.portrait;
    this.settingsScreen.setVisible(row !== null).setDepth(fromTitle ? 11 : 9.5);
    this.settingsVeil.setFillStyle(0x0d1020, fromTitle ? 0.82 : 0.75);
    const prompt = row !== null && upright ? TEXT[this.settings.language].sideways : '';
    if (this.settingsPrompt.text !== prompt) this.settingsPrompt.setText(prompt);
    this.settingsRows = layoutSettingsMenu(this.scale.displaySize.width / BASE_WIDTH);
    const painted: ReturnType<PonchoDebug['settingsDrawn']>['rows'] = [];
    const show = row !== null && !upright;
    this.settingsBars.clear();
    this.settingsMarker.setVisible(false);
    this.settingsLanguageValue.setVisible(false);
    this.settingsArrows.forEach((a) => a.setVisible(false));
    let arrow = 0;
    for (const r of this.settingsRows) {
      const label = this.settingsLabels[r.item];
      const chosen = r.item === row;
      const colour = chosen ? '#fff3dc' : '#9ba3c4';
      label.setVisible(show);
      if (r.item === 'back') {
        label.setPosition(r.x + r.w / 2, r.y + r.h / 2).setColor(colour);
        if (show && chosen) this.settingsMarker.setPosition(label.x - label.width / 2 - 8, label.y).setVisible(true);
        if (show) painted.push({ item: r.item, label: label.text, value: null, color: colour });
        continue;
      }
      label.setPosition(r.x + SETTINGS_MENU.labelInset, r.y + r.h / 2).setColor(colour);
      const left = this.settingsArrows[arrow++]!;
      const right = this.settingsArrows[arrow++]!;
      left.setPosition(r.x + SETTINGS_MENU.arrowInset, r.y + r.h / 2).setColor(colour).setVisible(show);
      right.setPosition(r.x + r.w - SETTINGS_MENU.arrowInset, r.y + r.h / 2).setColor(colour).setVisible(show);
      if (r.item === 'language') {
        const name = LANGUAGE_NAMES[this.settings.language];
        this.settingsLanguageValue.setText(name).setPosition(languageValueX(r), r.y + r.h / 2).setColor(colour).setVisible(show);
        if (show) painted.push({ item: r.item, label: label.text, value: name, color: colour, valueX: this.settingsLanguageValue.x });
        continue;
      }
      if (!show) continue;
      const value = this.settings[r.item];
      for (const bar of volumeBars(r, value)) {
        if (bar.filled) this.settingsBars.fillStyle(chosen ? 0xfff3dc : 0x9ba3c4, 1).fillRect(bar.x, bar.y, bar.w, bar.h);
        else this.settingsBars.lineStyle(1, 0x3a4060, 1).strokeRect(bar.x + 0.5, bar.y + 0.5, bar.w - 1, bar.h - 1);
      }
      painted.push({ item: r.item, label: label.text, value, color: colour });
    }
    this.settingsPainted = {
      shown: this.settingsScreen.visible,
      title: this.settingsTitle.text,
      prompt: this.settingsPrompt.text,
      from,
      rows: painted,
      chosen: show ? row : null,
    };
  }
}
