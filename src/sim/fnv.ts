// GDD-TEC-09: FNV-1a, 64 bits: the hash the replay checks compare states and test vectors by. Whole-number arithmetic only, the same in every engine.

/** FNV-1a, 64 bits, over the text's characters (all below 128), as 16 hex digits. Four 16-bit limbs, so every product is exact. */
export function fnv1a64(text: string): string {
  let a0 = 0x2325;
  let a1 = 0x8422;
  let a2 = 0x9ce4;
  let a3 = 0xcbf2;
  for (let i = 0; i < text.length; i++) {
    a0 ^= text.charCodeAt(i) & 0xff;
    // times 2^40 + 0x1b3
    const t0 = a0 * 0x1b3;
    const t1 = a1 * 0x1b3 + (t0 >>> 16);
    const t2 = a2 * 0x1b3 + (t1 >>> 16) + ((a0 << 8) & 0xffff);
    const t3 = a3 * 0x1b3 + (t2 >>> 16) + (a0 >>> 8) + ((a1 << 8) & 0xffff);
    a0 = t0 & 0xffff;
    a1 = t1 & 0xffff;
    a2 = t2 & 0xffff;
    a3 = t3 & 0xffff;
  }
  return [a3, a2, a1, a0].map((limb) => limb.toString(16).padStart(4, '0')).join('');
}

