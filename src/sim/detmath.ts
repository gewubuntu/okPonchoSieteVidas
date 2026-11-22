// GDD-TEC-09: sine, cosine and hypot that give the same bits in every JavaScript engine (Conflict C7), built from +, -, *, / and
// `Math.sqrt` (exactly rounded by IEEE 754, which every engine follows) and the bits of a double. The simulation calls these and never the engine's `Math.sin`,
// `Math.cos` or `Math.hypot`, which the language lets each engine approximate in its own way. Pure, no Phaser (GDD-TEC-02).
//
// `sin` and `cos` are fdlibm's (s_sin.c, s_cos.c, k_sin.c, k_cos.c, e_rem_pio2.c, k_rem_pio2.c), whose notice is:
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
// `hypot` scales by the larger argument, adds the squares with a compensated sum and takes one square root.

const view = new DataView(new ArrayBuffer(8));
/** The high 32 bits of x (sign, exponent and the top 20 bits of the fraction), as a signed integer. */
function highWord(x: number): number {
  view.setFloat64(0, x, false);
  return view.getInt32(0, false);
}
function lowWord(x: number): number {
  view.setFloat64(0, x, false);
  return view.getUint32(4, false);
}
function fromWords(high: number, low: number): number {
  view.setInt32(0, high, false);
  view.setUint32(4, low, false);
  return view.getFloat64(0, false);
}

/** The 16 hex digits of x's 64 bits, sign first: how a record and a test name an exact double. Every NaN is 7ff8000000000000. */
export function bitsOf(x: number): string {
  if (x !== x) return '7ff8000000000000';
  view.setFloat64(0, x, false);
  return view.getUint32(0, false).toString(16).padStart(8, '0') + view.getUint32(4, false).toString(16).padStart(8, '0');
}

/** The double whose 64 bits are these 16 hex digits. */
export function fromBits(hex: string): number {
  return fromWords(parseInt(hex.slice(0, 8), 16) | 0, parseInt(hex.slice(8, 16), 16));
}

const S1 = -1.66666666666666324348e-1;
const S2 = 8.33333333332248946124e-3;
const S3 = -1.98412698298579493134e-4;
const S4 = 2.75573137070700676789e-6;
const S5 = -2.50507602534068634195e-8;
const S6 = 1.58969099521155010221e-10;

/** sin(x + y) for |x| <= pi/4, y the tail of x (used when `tail`). */
function kernelSin(x: number, y: number, tail: boolean): number {
  if ((highWord(x) & 0x7fffffff) < 0x3e400000) return x; // |x| < 2^-27: x itself, which keeps the sign of -0
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  return tail ? x - (z * (0.5 * y - v * r) - y - v * S1) : x + v * (S1 + z * r);
}

const C1 = 4.16666666666666019037e-2;
const C2 = -1.38888888888741095749e-3;
const C3 = 2.48015872894767294178e-5;
const C4 = -2.75573143513906633035e-7;
const C5 = 2.08757232129817482790e-9;
const C6 = -1.13596475577881948265e-11;

/** cos(x + y) for |x| <= pi/4, y the tail of x. */
function kernelCos(x: number, y: number): number {
  const ix = highWord(x) & 0x7fffffff;
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y)); // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0); // x / 4, or 0.28125 past 0.78125
  return 1 - qx - (0.5 * z - qx - (z * r - x * y));
}

/** The high words of n pi/2 for n = 1 to 32: an argument that close to one is reduced with more of pi's bits. */
const NPIO2_HIGH = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a, 0x402f6a7a, 0x4031475c,
  0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a, 0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c,
  0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac, 0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
];
const INV_PIO2 = 6.36619772367581382433e-1;
const PIO2_1 = 1.57079632673412561417;
const PIO2_1T = 6.07710050650619224932e-11;
const PIO2_2 = 6.07710050630396597660e-11;
const PIO2_2T = 2.02226624879595063154e-21;
const PIO2_3 = 2.02226624871116645580e-21;
const PIO2_3T = 8.47842766036889956997e-32;

/**
 * 2 / pi in 24-bit pieces, for arguments past 2^19 pi/2. No argument measured reads past piece 46 (6 million random large doubles and the
 * 2001 nearest the hardest one, 6381956970095103 * 2^797): pieces 47 to 65 are fdlibm's, kept whole.
 */
const TWO_OVER_PI = [
  0xa2f983, 0x6e4e44, 0x1529fc, 0x2757d1, 0xf534dd, 0xc0db62, 0x95993c, 0x439041, 0xfe5163, 0xabdebb, 0xc561b7, 0x246e3a, 0x424dd2, 0xe00649,
  0x2eea09, 0xd1921c, 0xfe1deb, 0x1cb129, 0xa73ee8, 0x8235f5, 0x2ebb44, 0x84e99c, 0x7026b4, 0x5f7e41, 0x3991d6, 0x398353, 0x39f49c, 0x845f8b,
  0xbdf928, 0x3b1ff8, 0x97ffde, 0x05980f, 0xef2f11, 0x8b5a0a, 0x6d1f6d, 0x367ecf, 0x27cb09, 0xb74f46, 0x3f669e, 0x5fea2d, 0x7527ba, 0xc7ebe5,
  0xf17b3d, 0x0739f7, 0x8a5292, 0xea6bfb, 0x5fb11f, 0x8d5d08, 0x560330, 0x46fc7b, 0x6babf0, 0xcfbc20, 0x9af436, 0x1da9e3, 0x91615e, 0xe61b08,
  0x659985, 0x5f14a0, 0x68408d, 0xffd880, 0x4d7327, 0x310606, 0x1556ca, 0x73a8c9, 0x60e27b, 0xc08c6b,
];
/** pi / 2 in pieces of 24 bits and less. `jk` 4 reads pieces 0 to 4; pieces 5 to 7 are fdlibm's, for its longer precisions, and read by no argument. */
const PIO2 = [
  1.57079625129699707031, 7.54978941586159635335e-8, 5.39030252995776476554e-15, 3.28200341580791294123e-22, 1.27065575308067607349e-28,
  1.22933308981111328932e-36, 2.73370053816464559624e-44, 2.16741683877804819444e-51,
];
const TWO24 = 16777216;
const TWO_M24 = 5.96046447753906250000e-8;
/** 2^n, exact, for a whole n from -1022 to 1023. */
const pow2 = (n: number): number => fromWords((n + 1023) << 20, 0);

/**
 * fdlibm's __kernel_rem_pio2 for a double (its `prec` 2, so `jk` 4): `x` is |argument| in 24-bit pieces scaled by 2^-e0; fills `y` with the
 * remainder and its tail and gives the quadrant, 0 to 7.
 */
function kernelRemPio2(x: readonly number[], y: number[], e0: number): number {
  const jk = 4;
  let nx = x.length;
  while (x[nx - 1] === 0) nx--;
  const jx = nx - 1;
  const jv = Math.max(0, Math.floor((e0 - 3) / 24));
  let q0 = e0 - 24 * (jv + 1);
  const f: number[] = [];
  const q: number[] = [];
  const iq: number[] = [];
  for (let i = 0, j = jv - jx; i <= jx + jk; i++, j++) f[i] = j < 0 ? 0 : TWO_OVER_PI[j]!;
  const dot = (i: number): number => {
    let fw = 0;
    for (let j = 0; j <= jx; j++) fw += x[j]! * f[jx + i - j]!;
    return fw;
  };
  for (let i = 0; i <= jk; i++) q[i] = dot(i);
  let jz = jk;
  let n = 0;
  let ih = 0;
  let z = 0;
  for (;;) {
    z = q[jz]!;
    for (let i = 0, j = jz; j > 0; i++, j--) {
      const fw = (TWO_M24 * z) | 0;
      iq[i] = (z - TWO24 * fw) | 0;
      z = q[j - 1]! + fw;
    }
    z *= pow2(q0);
    z -= 8 * Math.floor(z * 0.125);
    n = z | 0;
    z -= n;
    ih = 0;
    if (q0 > 0) {
      const i = iq[jz - 1]! >> (24 - q0);
      n += i;
      iq[jz - 1]! -= i << (24 - q0);
      ih = iq[jz - 1]! >> (23 - q0);
    } else if (q0 === 0) ih = iq[jz - 1]! >> 23;
    else if (z >= 0.5) ih = 2;
    if (ih > 0) {
      n += 1;
      let carry = 0;
      for (let i = 0; i < jz; i++) {
        const j = iq[i]!;
        if (carry === 0) {
          if (j !== 0) {
            carry = 1;
            iq[i] = 0x1000000 - j;
          }
        } else iq[i] = 0xffffff - j;
      }
      if (q0 === 1) iq[jz - 1]! &= 0x7fffff;
      else if (q0 === 2) iq[jz - 1]! &= 0x3fffff;
      if (ih === 2) {
        z = 1 - z;
        if (carry !== 0) z -= pow2(q0);
      }
    }
    if (z !== 0) break;
    let j = 0;
    for (let i = jz - 1; i >= jk; i--) j |= iq[i]!;
    if (j !== 0) break;
    // Every piece past the first `jk` is zero: more of 2 / pi is needed.
    let k = 1;
    while (iq[jk - k] === 0) k++;
    for (let i = jz + 1; i <= jz + k; i++) {
      f[jx + i] = TWO_OVER_PI[jv + i]!;
      q[i] = dot(i);
    }
    jz += k;
  }
  if (z === 0) {
    jz--;
    q0 -= 24;
    while (iq[jz] === 0) {
      jz--;
      q0 -= 24;
    }
  } else {
    z *= pow2(-q0);
    if (z >= TWO24) {
      const fw = (TWO_M24 * z) | 0;
      iq[jz] = (z - TWO24 * fw) | 0;
      jz++;
      q0 += 24;
      iq[jz] = fw;
    } else iq[jz] = z | 0;
  }
  let fw = pow2(q0);
  for (let i = jz; i >= 0; i--) {
    q[i] = fw * iq[i]!;
    fw *= TWO_M24;
  }
  const fq: number[] = [];
  for (let i = jz; i >= 0; i--) {
    let s = 0;
    for (let k = 0; k <= jk && k <= jz - i; k++) s += PIO2[k]! * q[i + k]!;
    fq[jz - i] = s;
  }
  let s = 0;
  for (let i = jz; i >= 0; i--) s += fq[i]!;
  y[0] = ih === 0 ? s : -s;
  s = fq[0]! - s;
  for (let i = 1; i <= jz; i++) s += fq[i]!;
  y[1] = ih === 0 ? s : -s;
  return n & 7;
}

/** fdlibm's __ieee754_rem_pio2 for a finite |x| > pi/4: fills `y` with x - n pi/2 and its tail, |y| <= pi/4, and gives n. */
function remPio2(x: number, y: number[]): number {
  const hx = highWord(x);
  const ix = hx & 0x7fffffff;
  const sign = hx < 0 ? -1 : 1;
  if (ix < 0x4002d97c) {
    // |x| < 3 pi/4: n is 1 or -1; right beside pi/2 one more piece of pi is taken.
    let z = x - sign * PIO2_1;
    const near = ix === 0x3ff921fb;
    if (near) z -= sign * PIO2_2;
    const t = near ? PIO2_2T : PIO2_1T;
    y[0] = z - sign * t;
    y[1] = z - y[0] - sign * t;
    return sign;
  }
  if (ix <= 0x413921fb) {
    // |x| <= 2^19 pi/2
    let t = Math.abs(x);
    const n = (t * INV_PIO2 + 0.5) | 0;
    let r = t - n * PIO2_1;
    let w = n * PIO2_1T;
    y[0] = r - w;
    if (n >= 32 || ix === NPIO2_HIGH[n - 1]) {
      const j = ix >> 20;
      if (j - ((highWord(y[0]) >>> 20) & 0x7ff) > 16) {
        t = r;
        w = n * PIO2_2;
        r = t - w;
        w = n * PIO2_2T - (t - r - w);
        y[0] = r - w;
        if (j - ((highWord(y[0]) >>> 20) & 0x7ff) > 49) {
          t = r;
          w = n * PIO2_3;
          r = t - w;
          w = n * PIO2_3T - (t - r - w);
          y[0] = r - w;
        }
      }
    }
    y[1] = r - y[0] - w;
    if (sign < 0) {
      y[0] = -y[0];
      y[1] = -y[1];
    }
    return sign * n;
  }
  const e0 = (ix >> 20) - 1046;
  let z = fromWords(ix - (e0 << 20), lowWord(x));
  const tx = [0, 0, 0];
  for (let i = 0; i < 2; i++) {
    tx[i] = z | 0;
    z = (z - tx[i]!) * TWO24;
  }
  tx[2] = z;
  const n = kernelRemPio2(tx, y, e0);
  if (sign < 0) {
    y[0] = -y[0]!;
    y[1] = -y[1]!;
  }
  return sign * n;
}

/** The sine of x radians: the same bits in every engine. */
export function sin(x: number): number {
  const ix = highWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, false); // |x| <= pi/4
  if (ix >= 0x7ff00000) return NaN;
  const y = [0, 0];
  const n = remPio2(x, y) & 3;
  const [a, b] = [y[0]!, y[1]!];
  return n === 0 ? kernelSin(a, b, true) : n === 1 ? kernelCos(a, b) : n === 2 ? -kernelSin(a, b, true) : -kernelCos(a, b);
}

/** The cosine of x radians: the same bits in every engine. */
export function cos(x: number): number {
  const ix = highWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0); // |x| <= pi/4
  if (ix >= 0x7ff00000) return NaN;
  const y = [0, 0];
  const n = remPio2(x, y) & 3;
  const [a, b] = [y[0]!, y[1]!];
  return n === 0 ? kernelCos(a, b) : n === 1 ? -kernelSin(a, b, true) : n === 2 ? -kernelCos(a, b) : kernelSin(a, b, true);
}

/** The length of (a, b): the same bits in every engine. An infinite side gives Infinity, else a NaN side NaN. */
export function hypot(a: number, b: number): number {
  const x = Math.abs(a);
  const y = Math.abs(b);
  if (x === Infinity || y === Infinity) return Infinity;
  if (x !== x || y !== y) return NaN;
  const max = x > y ? x : y;
  if (max === 0) return 0;
  // Each side is first divided by the larger, so the squares neither overflow nor vanish; one of the two is exactly 1.
  return Math.sqrt((x / max) * (x / max) + (y / max) * (y / max)) * max;
}
