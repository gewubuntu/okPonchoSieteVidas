import Phaser from 'phaser';
import { BASE_HEIGHT, BASE_WIDTH } from './config/tuning';
import { PlayScene } from './scenes/PlayScene';

// GDD-ART-01: 480 x 270 base resolution, scaled to fit and centred (letterboxed on other aspect ratios).
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  backgroundColor: '#1b2036',
  pixelArt: true,
  roundPixels: true,
  disableContextMenu: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // GDD-CTL-03: two or three simultaneous touches (move, jump, claw).
  input: { activePointers: 3 },
  scene: [PlayScene],
});
