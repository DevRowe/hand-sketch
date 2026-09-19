import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dwarfMarks, plutoAt, plutoOnPlan } from '../src/explorer/beyond';
import { GUIDE } from '../src/explorer/content/guide';
import { SCALE_TEXT } from '../src/explorer/content/scale';
import { TOUR } from '../src/explorer/content/tour';
import { ENGLISH, isKey, t } from '../src/explorer/i18n';
import { planRadius } from '../src/explorer/orbits';
import { presetById, utc } from '../src/explorer/presets';
import { cheats, likeOf, modelLength, modelRows, voyagerAu } from '../src/explorer/scale';
import { passes } from '../src/explorer/sound';
import { C, PLANETS } from '../src/scenes/solar/common';
import { heliocentric } from '../src/scenes/solar/ephemeris';

const neptune = PLANETS.find(p => p.name === 'neptune')!.a;

describe('beyond Neptune', () => {
  it('puts Pluto where JPL has it: at perihelion in 1989, and 32.9 au out when New Horizons flew past', () => {
    expect(heliocentric('pluto', utc(1989, 9, 5)).r).toBeCloseTo(29.66, 1);
    expect(heliocentric('pluto', utc(2015, 7, 14, 11, 49)).r).toBeCloseTo(32.9, 1);
    // seen from above, its tilted orbit brings it ~15 degrees out of the planets' plane at perihelion
    expect(plutoAt(utc(1989, 9, 5)).r).toBeCloseTo(28.6, 1);
  });

  it('draws Pluto inside Neptune’s orbit near perihelion and well outside it now, with the belt beyond', () => {
    const at = (day: number): number => Math.hypot(plutoOnPlan(day)[0] - C[0], plutoOnPlan(day)[1] - C[1]);
    expect(at(utc(1989, 9, 5))).toBeLessThan(neptune);
    expect(at(utc(2026, 9, 19))).toBeGreaterThan(neptune + 10);
    const [pluto, belt] = dwarfMarks(utc(2026, 9, 19));
    expect(pluto!.id).toBe('pluto');
    expect(belt!.id).toBe('kuiper');
    expect(belt!.ring).toBeCloseTo(planRadius(44), 6);
    expect(belt!.ring!).toBeGreaterThan(neptune);
  });
});

describe('the Scale sheet', () => {
  it('works out the basketball model from the true sizes and distances', () => {
    const rows = Object.fromEntries(modelRows(utc(2026, 9, 19)).map(r => [r.name, r]));
    expect(rows.Earth).toEqual({ name: 'Earth', size: 'a mustard seed, 2.2 mm', far: '26 m away' });
    expect(rows.Moon!.far).toBe('6.6 cm from the Earth');
    expect(rows.Jupiter!.size).toBe('a walnut, 2.5 cm');
    expect(rows.Neptune!.far).toBe('779 m away');
    expect(rows.Pluto!.size).toBe('a grain of salt, 0.4 mm');
    expect(rows['Proxima Centauri']!.far).toBe('6,900 km away');
    expect(likeOf(0.3)).toBe('a grain of salt');
    expect(modelLength(0.0517)).toBe('5.2 cm');
  });

  it('agrees with the Guide’s own basketball', () => {
    const rows = Object.fromEntries(modelRows(utc(2026, 9, 19)).map(r => [r.name, r]));
    const item = GUIDE.flatMap(s => s.items).find(i => i.title === 'If the Sun were a basketball')!;
    for (const name of ['Earth', 'Jupiter', 'Neptune']) expect(item.text, name).toContain(rows[name]!.far.replace(' away', ''));
    expect(item.text).toContain(rows['Proxima Centauri']!.far.replace(' away', ''));
  });

  it('keeps Voyager 1 one light-day out in November 2026, receding ~3.6 au a year', () => {
    expect(voyagerAu(utc(2026, 11, 18))).toBeCloseTo(173.1, 1);
    expect(voyagerAu(utc(2027, 11, 18)) - voyagerAu(utc(2026, 11, 18))).toBeCloseTo(3.57, 1);
  });

  it('says how much the plan exaggerates, from its own geometry', () => {
    const c = cheats(900);
    expect(c.drawn).toBe('3');
    expect(c.truly).toBe('30');
    expect(Number(c.sun)).toBeGreaterThan(50);
    expect(c.earthPx).toMatch(/^1\/\d/);
  });
});

describe('the guided tour', () => {
  it('stops at real moments, flies journeys that fit, and lasts about two minutes', () => {
    let seconds = 0;
    for (const s of TOUR) {
      const p = s.preset ? presetById(s.preset) : undefined;
      if (s.preset) expect(p, s.id).toBeDefined();
      else expect(s.view, s.id).toBeDefined();
      const j = s.journey ? p?.journey?.() : undefined;
      if (s.journey) expect(j, s.id).toBeDefined();
      seconds += s.hold + (j ? (j.to - j.from) / j.pace : 0);
      expect(s.text.length, s.id).toBeGreaterThan(40);
    }
    expect(TOUR.slice(0, -1).every(s => s.hold > 0)).toBe(true);
    expect(TOUR[TOUR.length - 1]!.hold).toBe(0);
    expect(seconds).toBeGreaterThan(80);
    expect(seconds).toBeLessThan(150);
  });
});

describe('the sound of the orbits', () => {
  it('hears a planet pass its line either way, and every time once it laps faster than the drawings', () => {
    expect(passes(6.2, 0.05, 1, 88)).toBe(true);
    expect(passes(0.05, 6.2, -1, 88)).toBe(true);
    expect(passes(1, 1.2, 1, 88)).toBe(false);
    expect(passes(1, 1.2, 60, 88)).toBe(true);
  });
});

describe('the interface words', () => {
  it('fills placeholders, and leaves unknown ones for a translator to see', () => {
    expect(t('tour.step', { n: 3, of: 8 })).toBe('Stop 3 of 8');
    expect(t('toast.copied', {})).toContain('{date}');
  });

  it('keeps the page’s words in step with the table', () => {
    const html = readFileSync(new URL('../explorer/index.html', import.meta.url), 'utf8');
    const decode = (s: string): string => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    let n = 0;
    for (const [, key, text] of html.matchAll(/data-i18n="([^"]+)">([^<]*)</g)) {
      expect(isKey(key!), key).toBe(true);
      expect(decode(text!), key).toBe(ENGLISH[key as keyof typeof ENGLISH]);
      n++;
    }
    for (const [, key, text] of html.matchAll(/data-i18n-(?:title|label)="([^"]+)" (?:title|aria-label)="([^"]*)"/g)) {
      expect(isKey(key!), key).toBe(true);
      expect(decode(text!), key).toBe(ENGLISH[key as keyof typeof ENGLISH]);
      n++;
    }
    expect(n).toBeGreaterThan(12);
  });

  it('writes in plain punctuation: no em dashes in the new words either', () => {
    const words = [...Object.values(ENGLISH), ...TOUR.flatMap(s => [s.title, s.text]), ...Object.values(SCALE_TEXT).flat()];
    for (const w of words) expect(w).not.toMatch(/—/);
  });
});
