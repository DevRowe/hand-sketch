// The promo's music bed, synthesised here so it is ours to ship and the same on every run: a warm pad, plucked
// arpeggios through a dotted delay, a soft four-on-the-floor kick with the pad ducking under it, shaker, clap and bass,
// at 112.5 beats a minute so a beat is exactly 16 frames of 30 fps video. The arrangement follows the edit in
// `shots.mjs` bar by bar: a bare opening for the hook, the groove for the views, a lift for the styles montage, the
// full groove for the features, a breakdown for "your life", and one ringing chord under the end card.
import { writeFileSync } from 'node:fs';

const SR = 48000, BPM = 112.5, BEAT = 60 / BPM, BAR = 4 * BEAT, S16 = BEAT / 4;
const hz = m => 440 * 2 ** ((m - 69) / 12);

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1; }

// D add9, B minor 7, G major 7, A sus4 resolving: one bar each
const CHORDS = [
  { bass: 38, pad: [50, 57, 64, 66], arp: [62, 66, 69, 76, 74, 69, 66, 69] },
  { bass: 35, pad: [47, 54, 57, 62], arp: [59, 62, 66, 74, 69, 66, 62, 66] },
  { bass: 43, pad: [55, 59, 62, 66], arp: [59, 62, 67, 78, 74, 67, 62, 67] },
  { bass: 45, pad: [52, 57, 62, 64], arp: [57, 64, 69, 76, 73, 69, 64, 69] },
];

class Bus {
  constructor(seconds) { this.n = Math.ceil(seconds * SR); this.l = new Float32Array(this.n); this.r = new Float32Array(this.n); }
  add(i, l, r) { if (i >= 0 && i < this.n) { this.l[i] += l; this.r[i] += r; } }
}

/** A plucked, felt-like tone: a few harmonics with their own decays. */
function pluck(bus, t, midi, gain, pan = 0, decay = .32) {
  const f = hz(midi), i0 = Math.round(t * SR), n = Math.round(decay * 6 * SR), gl = gain * (1 - pan) * .5 * 2 ** .5, gr = gain * (1 + pan) * .5 * 2 ** .5;
  for (let i = 0; i < n; i++) {
    const x = i / SR, a = Math.min(1, x / .004);
    const s = Math.sin(2 * Math.PI * f * x) * Math.exp(-x / decay) + .32 * Math.sin(2 * Math.PI * 2 * f * x) * Math.exp(-x / (decay * .5)) + .12 * Math.sin(2 * Math.PI * 3.01 * f * x) * Math.exp(-x / (decay * .25));
    bus.add(i0 + i, s * a * gl, s * a * gr);
  }
}

/** A pad note: detuned saws through a two-pole low-pass, with a slow attack and release. */
function pad(bus, t, dur, midi, gain, cutoff = 1100) {
  const f = hz(midi), i0 = Math.round(t * SR), n = Math.round((dur + 1.2) * SR), k = 1 - Math.exp(-2 * Math.PI * cutoff / SR);
  const det = [-.07, .06, -.02, .03].map(d => f * 2 ** (d / 12)), ph = det.map((_, j) => j * .37);
  let yl = 0, yr = 0, zl = 0, zr = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, env = Math.min(1, x / .35) * (x > dur ? Math.exp(-(x - dur) / .4) : 1);
    let l = 0, r = 0;
    det.forEach((d, j) => { ph[j] = (ph[j] + d / SR) % 1; const s = ph[j] * 2 - 1; if (j % 2) r += s; else l += s; });
    const sine = Math.sin(2 * Math.PI * f * x) * .8;
    yl += k * (l * .5 + sine - yl); yr += k * (r * .5 + sine - yr);
    zl += k * (yl - zl); zr += k * (yr - zr);
    bus.add(i0 + i, zl * env * gain, zr * env * gain);
  }
}

function bass(bus, t, dur, midi, gain) {
  const f = hz(midi), i0 = Math.round(t * SR), n = Math.round((dur + .15) * SR);
  for (let i = 0; i < n; i++) {
    const x = i / SR, env = Math.min(1, x / .008) * (x > dur ? Math.exp(-(x - dur) / .05) : Math.exp(-x / 1.4));
    const s = Math.tanh(1.6 * (Math.sin(2 * Math.PI * f * x) + .25 * Math.sin(4 * Math.PI * f * x))) * env * gain;
    bus.add(i0 + i, s, s);
  }
}

function kick(bus, t, gain) {
  const i0 = Math.round(t * SR), n = Math.round(.4 * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, f = 46 + 95 * Math.exp(-x / .028);
    ph += f / SR;
    const s = Math.sin(2 * Math.PI * ph) * Math.exp(-x / .15) * Math.min(1, x / .002) * gain;
    bus.add(i0 + i, s, s);
  }
}

/** Filtered noise: a shaker tick (bright, short) or a clap (mid, a few quick bursts). */
function noise(bus, t, gain, { decay = .03, bright = .85, pan = 0, seed = 1, bursts = 1 } = {}) {
  const r = rng(seed + Math.round(t * 1000)), i0 = Math.round(t * SR), n = Math.round((decay * 7 + bursts * .012) * SR);
  let lp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, w = r();
    lp += .5 * (w - lp);
    const hp = bright > .5 ? w - prev * bright : lp;
    prev = w;
    let env = 0;
    for (let b = 0; b < bursts; b++) { const xb = x - b * .011; if (xb >= 0) env += Math.exp(-xb / (b === bursts - 1 ? decay : .006)); }
    const s = hp * env * gain;
    bus.add(i0 + i, s * (1 - pan), s * (1 + pan));
  }
}

/** A rising wash of noise into a downbeat. */
function riser(bus, t, dur, gain, seed) {
  const r = rng(seed), i0 = Math.round(t * SR), n = Math.round(dur * SR);
  let y = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n, k = .01 + .5 * p ** 3;
    y += k * (r() - y); y2 += k * (y - y2);
    const s = (y - y2 * .6) * p ** 2 * gain, w = Math.sin(i / SR * 5) * .3;
    bus.add(i0 + i, s * (1 - w), s * (1 + w));
  }
}

/** Dotted-eighth ping-pong delay, in place. */
function delay(bus, time, feedback, mix) {
  const d = Math.round(time * SR), l = bus.l, r = bus.r, wl = new Float32Array(bus.n), wr = new Float32Array(bus.n);
  for (let i = d; i < bus.n; i++) { wl[i] = r[i - d] * mix + wr[i - d] * feedback; wr[i] = l[i - d] * mix + wl[i - d] * feedback; }
  for (let i = 0; i < bus.n; i++) { l[i] += wl[i]; r[i] += wr[i]; }
}

/** A small Schroeder reverb: four combs and two all-passes a side, returned as a wet bus. */
function reverb(bus, gain) {
  const wet = new Bus(bus.n / SR);
  for (const [src, dst, off] of [[bus.l, wet.l, 0], [bus.r, wet.r, 23]]) {
    const acc = new Float32Array(bus.n);
    for (const c of [1557, 1617, 1491, 1422]) {
      const d = c + off, buf = new Float32Array(bus.n);
      let lp = 0;
      for (let i = 0; i < bus.n; i++) { const back = i >= d ? buf[i - d] : 0; lp += .35 * (back - lp); buf[i] = src[i] + lp * .84; acc[i] += back; }
    }
    let cur = acc;
    for (const a of [225, 556]) {
      const d = a + off, outp = new Float32Array(bus.n), buf = new Float32Array(bus.n);
      for (let i = 0; i < bus.n; i++) { const back = i >= d ? buf[i - d] : 0; buf[i] = cur[i] + back * .5; outp[i] = back - cur[i] * .5; }
      cur = outp;
    }
    for (let i = 0; i < bus.n; i++) dst[i] = cur[i] * gain * .25;
  }
  return wet;
}

/**
 * Write the bed as a 48 kHz stereo WAV `seconds` long. `taps` are the times of the on-screen taps, each given a soft
 * wooden tick.
 */
export function writeMusic(path, seconds, taps = []) {
  const len = seconds + .2, bars = Math.ceil(seconds / BAR);
  const pads = new Bus(len), plucks = new Bus(len), low = new Bus(len), drums = new Bus(len), fx = new Bus(len);
  const kicks = [];
  // the arrangement, by bar: what plays where
  const section = b => (b < 2 ? 'hook' : b < 6 ? 'views' : b < 8 ? 'styles' : b < 12 ? 'features' : b < 14 ? 'life' : 'end');

  for (let b = 0; b < bars; b++) {
    const t0 = b * BAR, s = section(b), ch = CHORDS[s === 'end' ? 0 : b % 4], ending = s === 'end' && b > 14;
    if (!ending) for (const m of ch.pad) pad(pads, t0, s === 'end' ? BAR * 1.6 : BAR, m, s === 'life' ? .05 : .04, s === 'hook' ? 800 : s === 'styles' ? 1700 : 1150);
    if (ending) continue;

    // plucks: a bare motif for the hook and the breakdown, running eighths in the groove, sixteenths for the styles
    if (s === 'hook' || s === 'life') {
      [[0, 3], [1.5, 2], [2.5, 4], [3.5, 3]].forEach(([beat, k], j) => pluck(plucks, t0 + beat * BEAT, ch.arp[k] + (s === 'life' ? 12 : 0), .2, j % 2 ? .4 : -.4, .5));
      if (s === 'life') [0, 1, 2, 3, 4, 5, 6, 7].forEach(j => pluck(plucks, t0 + j * BEAT / 2, ch.arp[j], .09, j % 2 ? -.5 : .5, .3));
    } else if (s === 'styles') {
      for (let j = 0; j < 16; j++) pluck(plucks, t0 + j * S16, ch.arp[(j * 3) % 8] + 12, j % 4 === 0 ? .17 : .11, ((j % 4) - 1.5) / 2.2, .2);
    } else {
      for (let j = 0; j < 8; j++) pluck(plucks, t0 + j * BEAT / 2, ch.arp[j] + (s === 'end' ? 12 : 0), j % 2 ? .12 : .17, j % 2 ? .45 : -.45, .28);
      if (s === 'features') [[0, 3, 1.5], [2, 4, 1], [3, 6, 1]].forEach(([beat, k]) => pluck(plucks, t0 + beat * BEAT, ch.arp[k] + 12, .13, 0, .6));
    }

    // the low end and the drums
    const groove = s === 'views' || s === 'styles' || s === 'features' || s === 'end';
    if (groove) {
      for (let beat = 0; beat < 4; beat++) { kick(drums, t0 + beat * BEAT, .8); kicks.push(t0 + beat * BEAT); }
      [[0, .9], [1.5, .45], [2.5, .45], [3.5, .4]].forEach(([beat, d]) => bass(low, t0 + beat * BEAT, d * BEAT, ch.bass, .34));
      const sixteenths = s === 'styles' || s === 'end';
      for (let j = 0; j < 16; j++) {
        if (!sixteenths && j % 2 === 0 && j % 4 !== 2) continue;
        noise(drums, t0 + j * S16, j % 4 === 2 ? .11 : sixteenths && j % 2 === 0 ? .045 : .06, { decay: j % 4 === 2 ? .035 : .018, pan: j % 2 ? .3 : -.3, seed: 3 });
      }
      if (b >= 4) for (const beat of [1, 3]) noise(drums, t0 + beat * BEAT, .2, { decay: .07, bright: .3, bursts: 3, seed: 9 });
    } else if (s === 'life') {
      kick(drums, t0, .6); kicks.push(t0);
      bass(low, t0, BEAT * 2.5, ch.bass, .3);
    } else if (b === 0) {
      kick(drums, 0, .7); kicks.push(0);
      bass(low, 0, BAR * 1.5, ch.bass, .22);
    }
  }
  // lifts into the groove, the styles montage, the features and the end card; a roll into the styles
  riser(fx, 2 * BAR - 2 * BEAT, 2 * BEAT, .22, 11);
  riser(fx, 6 * BAR - BAR, BAR, .3, 12);
  riser(fx, 8 * BAR - 2 * BEAT, 2 * BEAT, .22, 13);
  riser(fx, 14 * BAR - BAR * 1.5, BAR * 1.5, .34, 14);
  for (let j = 0; j < 8; j++) noise(drums, 6 * BAR - (8 - j) * S16, .06 + j * .02, { decay: .04, bright: .3, bursts: 2, seed: 21 });
  // the downbeats that open the styles and the end card land a little harder
  for (const t of [6 * BAR, 14 * BAR]) { noise(fx, t, .22, { decay: .5, bright: .9, seed: 31 }); kick(drums, t, .5); }
  for (const t of taps) { pluck(fx, t, 86, .22, .2, .07); pluck(fx, t, 93, .1, .2, .05); }

  delay(plucks, 3 * S16, .38, .34);
  // the pad and bass duck under each kick
  const duck = new Float32Array(pads.n).fill(1);
  for (const t of kicks) { const i0 = Math.round(t * SR); for (let i = 0; i < .3 * SR && i0 + i < duck.length; i++) duck[i0 + i] = Math.min(duck[i0 + i], 1 - .55 * Math.exp(-(i / SR) / .09)); }
  for (let i = 0; i < pads.n; i++) { pads.l[i] *= duck[i]; pads.r[i] *= duck[i]; low.l[i] *= .6 + .4 * duck[i]; low.r[i] *= .6 + .4 * duck[i]; }

  const send = new Bus(len);
  for (let i = 0; i < send.n; i++) { send.l[i] = plucks.l[i] + pads.l[i] * .5 + fx.l[i] * .8 + drums.l[i] * .12; send.r[i] = plucks.r[i] + pads.r[i] * .5 + fx.r[i] * .8 + drums.r[i] * .12; }
  const wet = reverb(send, .9);

  const n = Math.round(seconds * SR), out = new Float32Array(n * 2);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR, fade = Math.min(1, x / .05) * Math.min(1, Math.max(0, (seconds - x) / 1.6)) ** 1.5;
    for (const [c, side] of [[0, 'l'], [1, 'r']]) {
      const v = Math.tanh(.9 * (pads[side][i] + plucks[side][i] + low[side][i] + drums[side][i] + fx[side][i] + wet[side][i])) * fade;
      out[i * 2 + c] = v;
      peak = Math.max(peak, Math.abs(v));
    }
  }
  // peak at -4 dBFS: a bed, not a master, with headroom for the AAC encode
  const g = 10 ** (-4 / 20) / peak, pcm = Buffer.alloc(44 + n * 4);
  pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + n * 4, 4); pcm.write('WAVEfmt ', 8); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
  pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34); pcm.write('data', 36); pcm.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n * 2; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32767), 44 + i * 2);
  writeFileSync(path, pcm);
}
