import Phaser from 'phaser';
import { ART_SCALE, BASE_HEIGHT, BASE_WIDTH } from './config/tuning';
import { PlayScene } from './scenes/PlayScene';

// GDD-ART-01: a 1920 x 1080 canvas (the 480 x 270 game pixels, each 4 x 4 art pixels), scaled to fit and centred (letterboxed on other aspect ratios).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_WIDTH * ART_SCALE,
  height: BASE_HEIGHT * ART_SCALE,
  backgroundColor: '#1b2036',
  // GDD-TEC-02: the fixed-step loop catches up on a slow frame by itself (FixedStepper caps it). Phaser's own delta smoothing would hand it
  // 1/60 s for each of the first 120 frames whatever they took, so the simulation ran slow where the 1920 x 1080 canvas draws slowly.
  fps: { smoothStep: false },
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // GDD-CTL-03: two or three simultaneous touches (move, jump, claw).
  input: { activePointers: 3 },
  scene: [PlayScene],
});
