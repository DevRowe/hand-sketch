import { describe, expect, it } from 'vitest';
import { pick, sceneMarks } from '../src/explorer/bodies';
import { Camera, ZOOM_MAX, ZOOM_MIN } from '../src/explorer/camera';
import { LabelLayout } from '../src/explorer/labels';
import { birthdays, lifeOf } from '../src/explorer/life';
import { stillScale } from '../src/explorer/share';
import { ageLabel, distance, lapsLabel, lightTime, outerLaps, planetAges, speed, SPIN_KM_S, travelled } from '../src/explorer/travel';
import { dateLabel, isoDate, paceFromSlider, paceLabel, paceToSlider, parseIsoDate, spanLabel } from '../src/explorer/format';
import { DAY_MAX, MONTH, Sim, WEEK, YEAR } from '../src/explorer/sim';
import { STYLES } from '../src/explorer/styles';
import { hashOf, readUrl } from '../src/explorer/url';
import { snapshot } from '../src/scenes/solar-spiral/common';
import { SOLAR_CATALOG } from '../src/scenes/solar';
import { PLANETS, planetAt } from '../src/scenes/solar/common';
import { dayOf } from '../src/scenes/solar/ephemeris';
import { datedSky } from '../src/scenes/solar/sky';

const d2026 = dayOf(Date.UTC(2026, 8, 18, 12));

describe('explorer simulation', () => {
  it('runs the date at its pace, forwards or back, and keeps the beat at twelve a second', () => {
    const sim = new Sim(d2026, MONTH, { on: true, span: 60, opacity: 1 });
    sim.advance(2);
    expect(sim.day - d2026).toBeCloseTo(2 * MONTH, 9);
    expect(sim.beat).toBeCloseTo(24, 9);
    sim.direction = -1;
    sim.advance(1);
    expect(sim.day - d2026).toBeCloseTo(MONTH, 9);
    sim.playing = false;
    sim.advance(5);
    expect(sim.day - d2026).toBeCloseTo(MONTH, 9);
    // paused, the beat holds too: nothing moves
    expect(sim.beat).toBeCloseTo(36, 9);
  });

  it('stops at the end of its range', () => {
    const sim = new Sim(DAY_MAX - 10, YEAR, { on: true, span: 60, opacity: 1 });
    expect(sim.advance(1)).toBe(true);
    expect(sim.day).toBe(DAY_MAX);
    expect(sim.playing).toBe(false);
  });

  it('fades trails in and out and unspools them afresh', () => {
    const sim = new Sim(d2026, WEEK, { on: true, span: 60, opacity: 0.8 });
    expect(sim.settling).toBe(true);
    for (let k = 0; k < 40; k++) sim.advance(0.1);
    expect(sim.trails.alpha).toBeCloseTo(0.8, 9);
    expect(sim.trails.reveal).toBe(1);
    expect(sim.settling).toBe(false);
    sim.trails.on = false;
    for (let k = 0; k < 20; k++) sim.advance(0.1);
    expect(sim.trails.alpha).toBe(0);
    expect(sim.trails.reveal).toBe(0);
    // the sky carries what is drawn now
    expect(sim.sky().trails).toEqual({ span: 60, reveal: 0, alpha: 0 });
  });
});

describe('explorer camera', () => {
  it('zooms towards a point, keeping it where it was on the screen', () => {
    const cam = new Camera(1920, 1080);
    cam.zoomAt(4, 600, 300);
    // the point stays at the same offset from the centre, scaled: (600 - x) * 4 == 600 - 960 before
    expect((600 - cam.x) * 4).toBeCloseTo(600 - 960, 9);
    expect((300 - cam.y) * 4).toBeCloseTo(300 - 540, 9);
  });

  it('never leaves the page and clamps its zoom', () => {
    const cam = new Camera(1920, 1080);
    cam.panBy(500, 0);
    expect(cam.x).toBe(960);
    cam.zoomAt(1000, 0, 0);
    expect(cam.zoom).toBe(ZOOM_MAX);
    cam.panBy(-1e6, -1e6);
    expect(cam.x).toBeCloseTo(1920 - 1920 / 2 / ZOOM_MAX, 9);
    expect(cam.y).toBeCloseTo(1080 - 1080 / 2 / ZOOM_MAX, 9);
    cam.reset(0);
    expect(cam.view).toEqual({ zoom: 1, x: 960, y: 540 });
  });

  it('never zooms a plan out past its whole page, so the page edge never shows', () => {
    const cam = new Camera(1920, 1080);
    cam.zoomAt(0.5, 300, 200);
    expect(cam.zoom).toBe(ZOOM_MIN);
    expect(ZOOM_MIN).toBe(1);
    expect(cam.view).toEqual({ zoom: 1, x: 960, y: 540 });
  });

  it('with a lower floor (the Earth and Moon view, whose paper never moves) lets the page sit back, never off the screen', () => {
    const cam = new Camera(1920, 1080);
    cam.min = 0.5;
    cam.zoomAt(0.25, 960, 540);
    expect(cam.zoom).toBe(0.5);
    const hw = 960 / 0.5;
    cam.panBy(1e6, 0);
    // the page's right edge may reach the screen's right edge but no farther
    expect(cam.x).toBeCloseTo(1920 - hw, 9);
    cam.panBy(-2e6, 0);
    expect(cam.x).toBeCloseTo(hw, 9);
  });

  it('glides to a view', () => {
    const cam = new Camera(1080, 1080);
    cam.glideTo({ zoom: 4, x: 700, y: 400 }, 0.5);
    expect(cam.moving).toBe(true);
    for (let k = 0; k < 10; k++) cam.step(0.06);
    expect(cam.moving).toBe(false);
    expect(cam.view).toEqual({ zoom: 4, x: 700, y: 400 });
  });
});

describe('explorer picking', () => {
  const sky = datedSky({ day: d2026, beat: 0 }), identity = (x: number, y: number): [number, number] => [x, y];

  it('finds every body where the scenes draw it', () => {
    const top = sceneMarks('sky', sky);
    expect(top.bodies.map(b => b.id)).toEqual(['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    const earth = top.bodies.find(b => b.id === 'earth')!, [x, y] = planetAt(PLANETS[2]!, sky);
    expect([earth.x, earth.y]).toEqual([x, y]);
    const wake = sceneMarks('wake', sky);
    expect(wake.bodies).toHaveLength(10);
    expect(wake.rocks.length).toBeGreaterThan(100);
  });

  it('picks the body a tap means, the small one over the big one', () => {
    const top = sceneMarks('sky', sky);
    for (const b of top.bodies) expect(pick(top, b.x, b.y, identity, 1)?.id).toBe(b.id);
    const moon = top.bodies.find(b => b.id === 'moon')!;
    expect(pick(top, moon.x + 2, moon.y, identity, 1)?.id).toBe('moon');
    // a tap in empty sky between orbits picks nothing
    expect(pick(top, 540 + 104, 540, identity, 1, 4)).toBeNull();
  });
});

describe('explorer words', () => {
  it('reads dates and paces plainly', () => {
    expect(dateLabel(d2026)).toBe('18 Sep 2026');
    expect(isoDate(d2026)).toBe('2026-09-18');
    expect(isoDate(parseIsoDate('1977-08-20')!)).toBe('1977-08-20');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('nonsense')).toBeNull();
    expect(paceLabel(MONTH)).toBe('1 month / s');
    expect(paceLabel(YEAR * 10)).toBe('10 years / s');
    expect(spanLabel(1 / 24)).toBe('1 hour');
    expect(paceFromSlider(paceToSlider(WEEK))).toBeCloseTo(WEEK, 9);
  });

  it('trusts nothing it cannot parse from the address bar', () => {
    expect(readUrl('#style=riso&view=wake&date=1969-07-20&pace=7&body=moon')).toEqual({ style: 'riso', view: 'wake', day: parseIsoDate('1969-07-20')!, pace: 7, body: 'moon' });
    expect(readUrl('#style=<script>&view=up&date=soon&pace=-3&body=x')).toEqual({});
  });

  it('carries a shared moment whole: trail strength, the camera and a life, and reads back what it writes', () => {
    const hash = hashOf({ style: 'riso', date: '1977-08-20', opacity: 0.8, zoom: 3, at: '655.2,565.6', born: '1990-05-12', reverse: false, trails: undefined });
    expect(hash).toBe('#style=riso&date=1977-08-20&opacity=0.8&zoom=3&at=655.2,565.6&born=1990-05-12');
    expect(readUrl(hash)).toEqual({ style: 'riso', day: parseIsoDate('1977-08-20')!, opacity: 0.8, zoom: 3, at: [655.2, 565.6], born: parseIsoDate('1990-05-12')! });
    expect(readUrl('#opacity=2&zoom=0&at=1,2,3&born=1990-13-01')).toEqual({});
    expect(readUrl('#at=1e9,5')).toEqual({});
    expect(hashOf({ style: undefined, trails: false })).toBe('');
  });

  it('offers all ten styles, each with all three views', () => {
    expect(STYLES.map(s => s.title)).toEqual(SOLAR_CATALOG.map(e => e.title));
    for (const s of STYLES) {
      expect(s.scenes.sky.name).toBe(`solar-${s.key}`);
      expect(s.scenes.wake.name).toBe(`spiral-${s.key}`);
      expect(s.scenes.earth.name).toBe(`cislunar-${s.key}`);
    }
  });
});

describe('explorer names', () => {
  const at = (x: number, y = 100) => ({ id: 'a', x, y, r: 10, w: 60, h: 18 });
  const ROOM_1000 = [0, 0, 1000, 800] as const, ROOM_600 = [0, 0, 600, 800] as const;

  it('keeps a name steady while its body grazes a more important one, and fades it only after a moment', () => {
    const layout = new LabelLayout(), sun = { ...at(100), id: 'sun' }, moon = (y: number) => ({ ...at(100, y), id: 'moon' });
    // apart: both show
    let out = layout.place([sun, moon(160)], ROOM_1000, 0).labels;
    expect(out.map(l => l.shown)).toEqual([true, true]);
    // a brush of a few pixels does not hide a name on show
    out = layout.place([sun, moon(100 + 18 - 3)], ROOM_1000, 50).labels;
    expect(out[1]!.shown).toBe(true);
    // a real overlap hides it, but only once it has lasted
    const over = layout.place([sun, moon(104)], ROOM_1000, 100);
    expect(over.labels[1]!.shown).toBe(true);
    expect(over.pending).toBe(true);
    expect(layout.place([sun, moon(104)], ROOM_1000, 400).labels[1]!.shown).toBe(false);
    // clear again for a moment only: it waits, faded, rather than blinking back
    expect(layout.place([sun, moon(125)], ROOM_1000, 450).labels[1]!.shown).toBe(false);
    expect(layout.place([sun, moon(104)], ROOM_1000, 500).labels[1]!.shown).toBe(false);
    // clear for long enough: it returns
    layout.place([sun, moon(160)], ROOM_1000, 600);
    expect(layout.place([sun, moon(160)], ROOM_1000, 1400).labels[1]!.shown).toBe(true);
  });

  it('puts a name on the left only at the screen edge, and brings it back once it clearly fits', () => {
    const layout = new LabelLayout();
    expect(layout.place([at(500)], ROOM_600, 0).labels[0]!.left).toBe(516);
    const edge = layout.place([at(560)], ROOM_600, 10).labels[0]!;
    expect(edge.left).toBe(560 - 10 - 6 - 60);
    // a pixel back from the edge is not enough to flip again
    expect(layout.place([at(522)], ROOM_600, 20).labels[0]!.left).toBe(522 - 10 - 6 - 60);
    expect(layout.place([at(500)], ROOM_600, 30).labels[0]!.left).toBe(516);
  });

  it('keeps a name inside the room a card leaves, and clear of a control floating over the picture', () => {
    const layout = new LabelLayout(), room = [0, 60, 420, 700] as const;
    // the card begins at 420: a name that would run under it goes to the left
    expect(layout.place([at(380)], room, 0).labels[0]!.left).toBe(380 - 10 - 6 - 60);
    // a pill over the picture is an obstacle like a caption
    const pill = [300, 90, 460, 120] as const, fresh = new LabelLayout();
    expect(fresh.place([{ ...at(250, 105), id: 'b' }], room, 0, [pill]).labels[0]!.shown).toBe(false);
  });
});

describe('explorer travels', () => {
  const YEAR_S = 365.25 * 86_400;
  const PLANET_DAYS: Record<string, number> = { mercury: 87.97, venus: 224.7, earth: 365.256, mars: 686.98, jupiter: 11.862 * 365.25, saturn: 29.457 * 365.25, uranus: 84.02 * 365.25, neptune: 164.8 * 365.25 };

  it('measures a lifetime four ways, at the speeds the card states', () => {
    const t = travelled(36.5 * YEAR_S);
    const [spin, orbit, galaxy, cmb] = t.frames;
    // a point on the equator: 40,075 km a sidereal day, ~1,674 km/h
    expect(SPIN_KM_S * 3600).toBeCloseTo(1674.4, 0);
    expect(spin!.km).toBeCloseTo(SPIN_KM_S * 36.5 * YEAR_S, 3);
    expect(orbit!.km / 1e9).toBeCloseTo(34.3, 1);
    expect(galaxy!.km / 1e9).toBeCloseTo(264.9, 0);
    expect(cmb!.km / 1e9).toBeCloseTo(426.0, 0);
    expect(t.laps).toBeCloseTo(36.5 * 365.25 / 365.256, 3);
    expect(cmb!.compare).toBe('as far as light travels in ~16.4 days');
    expect(galaxy!.compare).toMatch(/ of one lap$/);
  });

  it('shrinks the spin with latitude and never runs backwards', () => {
    expect(travelled(YEAR_S, 60).frames[0]!.speed).toBeCloseTo(SPIN_KM_S / 2, 9);
    expect(travelled(-5).frames.every(f => f.km === 0)).toBe(true);
  });

  it('tells your age on every planet by its sidereal year, and when you next have a birthday there', () => {
    // 12 May 1990 to 19 September 2026: 13,280 days
    const days = 13_280, ages = planetAges(days), by = Object.fromEntries(ages.map(a => [a.id, a]));
    expect(ages.map(a => a.id)).toEqual(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
    expect(by.mercury!.age).toBeCloseTo(days / 87.97, 9);
    expect(by.earth!.age).toBeCloseTo(36.358, 3);
    expect(by.jupiter!.age).toBeCloseTo(days / (11.862 * 365.25), 9);
    expect(by.neptune!.age).toBeCloseTo(days / (164.8 * 365.25), 9);
    expect(ages.map(a => ageLabel(a.age))).toEqual(['150', '59.1', '36.4', '19.3', '3.07', '1.23', '0.43', '0.22']);
    // the next birthday lies ahead, within one of the planet's years
    for (const a of ages) {
      expect(a.next).toBeGreaterThan(days);
      expect(a.next - days).toBeLessThanOrEqual(PLANET_DAYS[a.id]! + 1e-9);
    }
    expect(outerLaps(ages)).toBe('Jupiter has gone round 3 times, Saturn once, Uranus 43% of the way and Neptune 22%');
    expect(lapsLabel(2.4)).toBe('twice');
    expect(lapsLabel(0.004)).toBe('1% of the way');
  });

  it('counts the birthdays of a life, a leap-day birthday on the 28th in other years', () => {
    const until = parseIsoDate('2026-09-19')!;
    const days = birthdays('1990-05-12', until);
    expect(days).toHaveLength(36);
    expect(isoDate(days[0]!)).toBe('1991-05-12');
    expect(isoDate(days[35]!)).toBe('2026-05-12');
    expect(birthdays('2000-02-29', parseIsoDate('2004-03-01')!).map(isoDate)).toEqual(['2001-02-28', '2002-02-28', '2003-02-28', '2004-02-29']);
    expect(lifeOf('2030-01-01', until)).toBeNull();
    expect(lifeOf('1990-05-12', until)?.born).toBe(parseIsoDate('1990-05-12'));
  });

  it("draws a life's wake back to the day it began, and no wake from before it", () => {
    const born = parseIsoDate('1990-05-12')!, now = parseIsoDate('2026-09-19')!, span = now - born;
    const trails = { span, reveal: 1, alpha: 1 };
    const plain = snapshot(datedSky({ day: now, beat: 0, trails })), life = snapshot(datedSky({ day: now, beat: 0, trails: { ...trails, life: { since: born, k: 2 } } }));
    const reach = (S: typeof plain, k: number): number => {
      const run = S.trails[k]!.samples, h = S.plan.step[k]!;
      return (run[0]!.q - run[run.length - 1]!.q) * h;
    };
    // plainly the Earth's wake keeps to three turns; a life's runs the whole way back
    expect(reach(plain, 2)).toBeCloseTo(3 * 365.256, -1);
    expect(reach(life, 2)).toBeCloseTo(span, -1);
    // the grid is the plain one's only where the Earth is concerned; nothing reaches back before the birth
    for (const k of [0, 1, 3, 4, 5, 6, 7]) expect(reach(life, k)).toBeLessThanOrEqual(span + life.plan.step[k]!);
    expect(life.plan.speed).toBe(plain.plan.speed);
  });

  it('draws a saved picture at twice the screen, never larger than the page can hold', () => {
    expect(stillScale(1440, 900)).toBe(2);
    expect(stillScale(390, 844)).toBe(2);
    expect(stillScale(3840, 2160)).toBeLessThan(1.1);
    expect(stillScale(3840, 2160) * 3840).toBeLessThanOrEqual(4096);
  });

  it('reads distances and speeds plainly', () => {
    expect(distance(5.388e8)).toBe('539 million km');
    expect(distance(3.45e10)).toBe('34.5 billion km');
    expect(distance(1.2e12)).toBe('1.2 trillion km');
    expect(speed(SPIN_KM_S)).toBe('1,674 km/h');
    expect(speed(29.78)).toBe('29.8 km/s');
    expect(speed(369.82)).toBe('370 km/s');
    expect(lightTime(2.59e10 * 3)).toBe('3 days');
    expect(lightTime(9.461e12 * 1.5)).toBe('1.5 years');
  });
});
