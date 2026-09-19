/**
 * Live figures for the date on screen: how far a body is from Earth and the Sun, how long its light takes to reach
 * us, and the Moon's phase. Computed from the same ephemeris the sky is drawn from.
 */
import type { PlanetName } from '../scenes/solar/common';
import { heliocentric, moonLongitude, sunLongitude } from '../scenes/solar/ephemeris';

export const AU_KM = 149_597_870.7;
const C_KM_S = 299_792.458;

/** A planet's heliocentric position, au (J2000 ecliptic). */
export const xyz = (name: PlanetName | 'pluto', day: number): [number, number, number] => {
  const h = heliocentric(name, day), c = Math.cos(h.lat);
  return [h.r * c * Math.cos(h.lon), h.r * c * Math.sin(h.lon), h.r * Math.sin(h.lat)];
};

/** Distance between Earth and a planet, km. */
export function fromEarthKm(name: PlanetName | 'pluto', day: number): number {
  const a = xyz(name, day), b = xyz('earth', day);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * AU_KM;
}

/** Distance from the Sun, au. */
export const fromSunAu = (name: PlanetName | 'pluto', day: number): number => heliocentric(name, day).r;

/** "8 min 17 s", "1 h 12 min", "1.3 s": the time light takes over `km`. */
export function lightTime(km: number): string {
  const s = km / C_KM_S;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return m === 60 ? `${h + 1} h` : `${h} h ${m} min`;
}

/** "225 million km", "1.43 billion km", "384,400 km". */
export function km(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion km`;
  // three significant figures, as the cards quote them
  if (n >= 1e6) return `${Number((n / 1e6).toPrecision(3))} million km`;
  return `${Math.round(n).toLocaleString('en-GB')} km`;
}

export interface Phase {
  name: string;
  /** Fraction of the disc lit, 0..1. */
  lit: number;
  /** Growing from new towards full (lit on the right as seen from the northern hemisphere), or shrinking. */
  waxing: boolean;
}

/** The Moon's phase on a date, from how far it stands from the Sun in our sky. */
export function moonPhase(day: number): Phase {
  const e = ((((moonLongitude(day) - sunLongitude(day)) * 180) / Math.PI) % 360 + 360) % 360;
  const lit = (1 - Math.cos((e * Math.PI) / 180)) / 2, waxing = e < 180;
  let name: string;
  if (lit < 0.03) name = 'New Moon';
  else if (lit > 0.97) name = 'Full Moon';
  else if (Math.abs(lit - 0.5) < 0.04) name = waxing ? 'First quarter' : 'Last quarter';
  else if (lit < 0.5) name = waxing ? 'Waxing crescent' : 'Waning crescent';
  else name = waxing ? 'Waxing gibbous' : 'Waning gibbous';
  return { name, lit, waxing };
}
