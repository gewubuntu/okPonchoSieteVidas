// A demonstration of the pose rig (not game art): one frame for each thing rig.mjs can do, for its review sheet:
//   node scripts/art/poncho/preview.mjs demo shots/poncho-rig-demo.png
import { pose, POSE_FRAME, rotated, STANDING } from './rig.mjs';

export { POSE_FRAME };

const SPECS = {
  standing: STANDING,
  squash: { body: { squash: 3, widen: 2 }, hat: { dy: 1 }, legs: 'splay', tail: 'low' },
  stretch: { body: { squash: -3, widen: -1 }, hat: { dy: -2 }, legs: 'tuck', tail: 'back', y: -6 },
  hatLift: { hat: { dy: -4 } },
  hatTiltFwd: { hat: { dy: -1, tilt: 8 } },
  hatTiltBack: { hat: { dy: -3, tilt: -16 } },
  hatOff: { hat: { dy: -18, dx: -3, tilt: -16 }, face: 'squeeze', tail: 'low' },
  blink: { face: 'blink' },
  squeeze: { face: 'squeeze' },
  wide: { face: 'wide' },
  open: { face: 'open' },
  happy: { face: 'happy' },
  glance: { face: 'glance' },
  puff: { face: { eyes: 'normal', mouth: 'puff' } },
  pawFwd: { paw: { x: 76, y: 72 }, body: { dx: 1 } },
  pawEat: { paw: { x: 72, y: 62, from: [60, 74], front: true }, face: 'open', head: { dy: 1 } },
  pawUp: { paw: { x: 78, y: 30 }, face: 'happy', tail: 'up' },
  claws: { paw: { x: 84, y: 66, claws: true }, face: 'squeeze', head: { dx: 1 } },
  tailUp: { tail: 'up' },
  tailLow: { tail: 'low' },
  tailBack: { tail: 'back' },
  headBob: { head: { dy: 1 }, hat: { dy: -1 } },
};

export const LOOKS = [...Object.keys(SPECS), 'rot45', 'rot90'];

export function drawFrames() {
  const frames = Object.entries(SPECS).map(([look, spec]) => {
    const grid = pose(spec);
    return { look, grid, hand: grid.hand };
  });
  // The respawn flip: the standing frame turned about his middle.
  for (const deg of [45, 90]) {
    const grid = rotated(pose(STANDING), deg, { pivot: [48, 60] });
    frames.push({ look: `rot${deg}`, grid });
  }
  return frames;
}
