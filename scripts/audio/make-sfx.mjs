// Encodes the generated sound effects into assets/audio/sfx/ as Ogg Vorbis and MP3 (browsers differ on which they play).
// Needs ffmpeg on the PATH. The encoded files are committed, so only run this after changing a sound.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderClaw, renderHilo, renderJump, renderLand, renderLifeLost, renderMeow, renderStomp, renderTick } from './effects.mjs';
import { renderOfrenda, toWav } from './ofrenda.mjs';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'audio', 'sfx');
mkdirSync(outDir, { recursive: true });
/** [file name, samples] */
const sounds = [
  ['ofrenda', renderOfrenda()],
  ['jump', renderJump()],
  ['land', renderLand()],
  ['claw', renderClaw()],
  ['stomp', renderStomp()],
  ['hilo', renderHilo()],
  ['life-lost', renderLifeLost()],
  ['meow', renderMeow()],
  ['tick', renderTick()],
];

for (const [name, samples] of sounds) {
  const wav = toWav(samples);
  for (const [ext, codec] of [['ogg', ['-c:a', 'libvorbis', '-q:a', '4']], ['mp3', ['-c:a', 'libmp3lame', '-q:a', '4']]]) {
    const file = join(outDir, `${name}.${ext}`);
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0', ...codec, file], { input: wav });
    if (r.status !== 0) {
      console.error(`ffmpeg failed for ${file}: ${r.stderr?.toString() ?? r.error}`);
      process.exit(1);
    }
    console.log(`wrote ${file}`);
  }
}
