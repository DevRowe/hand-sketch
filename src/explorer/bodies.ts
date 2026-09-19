/**
 * Where each body is drawn, for picking and labelling: the same geometry the scenes use (the top-down plan's
 * `planetAt`/`moonOffset`/`rockAt`, the spiral's camera `snapshot`, the Earth and Moon view's `moonAt` and stations),
 * in the 1080 design box all three are drawn in.
 */
import { C as EARTH_C, EARTH_EQ, EARTH_R, MOON_R, moonAt, onPage, units } from '../scenes/cislunar/common';
import { GEO_ALT, GPS_ALT, LEO_HIGH, leoShows, MOON_LEAST, stationsOn } from '../scenes/cislunar/draw';
import { STARLINK_COUNT, STARLINK_SHELL, censusAt, GEO_COUNT, GPS_COUNT } from '../scenes/cislunar/objects';
import { BOX, C, MOON, moonOffset, PLANETS, planetAt, RINGS, rockAt, ROCKS, SUN_R, URANUS_RING, type PlanetName } from '../scenes/solar/common';
import { RINGS as WAKE_RINGS, snapshot, SUN_R as WAKE_SUN_R, URANUS_RING as WAKE_URANUS } from '../scenes/solar-spiral/common';
import type { Sky } from '../scenes/solar/sky';

export type ViewId = 'sky' | 'wake' | 'earth';
/** What orbits the Earth in the Earth and Moon view: the stations and telescopes, and the orbits named as rings. */
export type OrbiterId = 'iss' | 'tiangong' | 'hubble' | 'mir' | 'skylab' | 'salyut' | 'sputnik';
export type RingId = 'leo' | 'gps' | 'geo' | 'starlink';
export type BodyId = 'sun' | PlanetName | 'moon' | OrbiterId | RingId;

export interface Mark {
  id: BodyId;
  /** Centre, design units. */
  x: number;
  y: number;
  /** Disc radius, design units. */
  r: number;
  /** How far its drawing reaches (Saturn's rings), design units: the outline a pick may land on. */
  reach: number;
  /** A ring of this radius round (x, y) (an orbit's height): picked along its line, named at a point on it. */
  ring?: number;
}

export interface Scene {
  bodies: Mark[];
  /** Belt rocks, design units. */
  rocks: { x: number; y: number }[];
}

export { BOX };

/** The Moon's drawn radius at `zoom` (true to scale, but never less than a few pixels), design units. */
export const moonMarkR = (zoom: number): number => Math.max(units(MOON_R), MOON_LEAST / zoom);

/**
 * The Earth and Moon view on `day` at `zoom`: the Earth, the Moon, the stations in orbit (once low orbit has room on
 * screen, and not behind the Earth) and the named heights as rings.
 */
export function earthMarks(day: number, zoom: number): Scene {
  const [mx, my] = onPage(moonAt(day)), mr = moonMarkR(zoom);
  const bodies: Mark[] = [
    { id: 'earth', x: EARTH_C[0], y: EARTH_C[1], r: units(EARTH_R), reach: units(EARTH_R) },
    { id: 'moon', x: mx, y: my, r: mr, reach: mr },
  ];
  const ring = (id: RingId, alt: number): Mark => ({ id, x: EARTH_C[0], y: EARTH_C[1], r: 0, reach: 0, ring: units(EARTH_EQ + alt) });
  const leo = leoShows(1 / zoom);
  if (leo) {
    for (const s of stationsOn(day)) {
      if (s.at[2] < 0 && Math.hypot(s.at[0], s.at[1]) < EARTH_R) continue;
      bodies.push({ id: s.t.id as OrbiterId, x: s.x, y: s.y, r: 5 / zoom, reach: 9 / zoom });
    }
    if (censusAt(STARLINK_COUNT, day) > 0) bodies.push(ring('starlink', STARLINK_SHELL.alt));
  }
  bodies.push(ring('leo', LEO_HIGH));
  if (censusAt(GPS_COUNT, day) > 0) bodies.push(ring('gps', GPS_ALT));
  if (censusAt(GEO_COUNT, day) > 0) bodies.push(ring('geo', GEO_ALT));
  return { bodies, rocks: [] };
}

/** Every body and rock as the chosen view draws it under `sky` (the Earth and Moon view at `zoom`). */
export function sceneMarks(view: ViewId, sky: Sky, zoom = 1): Scene {
  if (view === 'earth') return earthMarks(sky.now, zoom);
  if (view === 'sky') {
    const bodies: Mark[] = [{ id: 'sun', x: C[0], y: C[1], r: SUN_R, reach: SUN_R + 8 }];
    for (const p of PLANETS) {
      const [x, y] = planetAt(p, sky);
      bodies.push({ id: p.name, x, y, r: p.r, reach: p.name === 'saturn' ? RINGS.outer : p.name === 'uranus' ? URANUS_RING.rx : p.r });
      if (p.name === 'earth') {
        const [mx, my] = moonOffset(sky);
        bodies.push({ id: 'moon', x: x + mx, y: y + my, r: MOON.r, reach: MOON.r });
      }
    }
    return { bodies, rocks: ROCKS.map(rk => { const [x, y] = rockAt(rk, sky); return { x, y }; }) };
  }
  // bodies only: a sky with its trails faded out samples no wakes
  const S = snapshot(sky.trails ? { ...sky, trails: { ...sky.trails, alpha: 0 } } : sky);
  const bodies: Mark[] = [{ id: 'sun', x: S.sun.x, y: S.sun.y, r: WAKE_SUN_R, reach: WAKE_SUN_R + 6 }];
  for (const b of S.bodies) {
    const name = b.planet.name;
    bodies.push({ id: name, x: b.x, y: b.y, r: b.R, reach: name === 'saturn' ? WAKE_RINGS.outer * b.s : name === 'uranus' ? WAKE_URANUS * b.s : b.R });
    if (name === 'earth') bodies.push({ id: 'moon', x: S.moon.x, y: S.moon.y, r: S.moon.R, reach: S.moon.R });
  }
  return { bodies, rocks: S.rocks.map(r => ({ x: r.x, y: r.y })) };
}

export interface Pick {
  id: BodyId | 'belt';
  /** Distance from the pick to the body's outline, screen pixels (0 inside it). */
  miss: number;
}

/**
 * The body a tap at (`px`, `py`) means, given every body's centre and radii on screen (`toScreen` maps design units
 * to screen pixels, `scale` is screen pixels per design unit). A tap counts within `slop` pixels of a body's outline,
 * so small, fast planets stay easy to hit; the nearest outline wins, and a small body beats the big one it sits on
 * (the Moon over the Earth). Failing a body, a tap among the belt's rocks picks the belt.
 */
export function pick(scene: Scene, px: number, py: number, toScreen: (x: number, y: number) => [number, number], scale: number, slop = 18): Pick | null {
  let best: Pick | null = null, bestScore = Infinity;
  for (const m of scene.bodies) {
    const [x, y] = toScreen(m.x, m.y), d = Math.hypot(px - x, py - y), R = Math.max(m.reach, m.r) * scale;
    // a ring is picked along its line, and only a little way off it (it is thin, and much else lies inside it)
    const miss = m.ring !== undefined ? Math.abs(d - m.ring * scale) * 1.6 + 4 : Math.max(0, d - R);
    if (miss > slop) continue;
    // rank by how far outside the body the tap fell, then by how close to its centre relative to its size
    const score = miss + (m.ring !== undefined ? 1 : (d / Math.max(R, 1)) * 0.5) + (m.id === 'sun' ? 2 : 0);
    if (score < bestScore) { best = { id: m.id, miss }; bestScore = score; }
  }
  if (best) return best;
  let near = Infinity;
  for (const r of scene.rocks) {
    const [x, y] = toScreen(r.x, r.y);
    near = Math.min(near, Math.hypot(px - x, py - y));
  }
  return near <= Math.max(10, slop * 0.6) ? { id: 'belt', miss: near } : null;
}
