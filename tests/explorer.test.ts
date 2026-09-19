import { describe, expect, it } from 'vitest';
import { pick, sceneMarks } from '../src/explorer/bodies';
import { Camera, ZOOM_MAX, ZOOM_MIN } from '../src/explorer/camera';
import { LabelLayout } from '../src/explorer/labels';
import { distance, lightTime, speed, SPIN_KM_S, travelled } from '../src/explorer/travel';
import { dateLabel, isoDate, paceFromSlider, paceLabel, paceToSlider, parseIsoDate, spanLabel } from '../src/explorer/format';
import { DAY_MAX, MONTH, Sim, WEEK, YEAR } from '../src/explorer/sim';
import { STYLES } from '../src/explorer/styles';
import { readUrl } from '../src/explorer/url';
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

  it('keeps a name steady while its body grazes a more important one, and fades it only after a moment', () => {
    const layout = new LabelLayout(), sun = { ...at(100), id: 'sun' }, moon = (y: number) => ({ ...at(100, y), id: 'moon' });
    // apart: both show
    let out = layout.place([sun, moon(160)], 1000, 0).labels;
    expect(out.map(l => l.shown)).toEqual([true, true]);
    // a brush of a few pixels does not hide a name on show
    out = layout.place([sun, moon(100 + 18 - 3)], 1000, 50).labels;
    expect(out[1]!.shown).toBe(true);
    // a real overlap hides it, but only once it has lasted
    const over = layout.place([sun, moon(104)], 1000, 100);
    expect(over.labels[1]!.shown).toBe(true);
    expect(over.pending).toBe(true);
    expect(layout.place([sun, moon(104)], 1000, 400).labels[1]!.shown).toBe(false);
    // clear again for a moment only: it waits, faded, rather than blinking back
    expect(layout.place([sun, moon(125)], 1000, 450).labels[1]!.shown).toBe(false);
    expect(layout.place([sun, moon(104)], 1000, 500).labels[1]!.shown).toBe(false);
    // clear for long enough: it returns
    layout.place([sun, moon(160)], 1000, 600);
    expect(layout.place([sun, moon(160)], 1000, 1400).labels[1]!.shown).toBe(true);
  });

  it('puts a name on the left only at the screen edge, and brings it back once it clearly fits', () => {
    const layout = new LabelLayout();
    expect(layout.place([at(500)], 600, 0).labels[0]!.left).toBe(516);
    const edge = layout.place([at(560)], 600, 10).labels[0]!;
    expect(edge.left).toBe(560 - 10 - 6 - 60);
    // a pixel back from the edge is not enough to flip again
    expect(layout.place([at(522)], 600, 20).labels[0]!.left).toBe(522 - 10 - 6 - 60);
    expect(layout.place([at(500)], 600, 30).labels[0]!.left).toBe(516);
  });
});

describe('explorer travels', () => {
  const YEAR_S = 365.25 * 86_400;

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
