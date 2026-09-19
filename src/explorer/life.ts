/**
 * Your life's helix: your years flown in the In motion view, where the Sun carries the Earth through space, with the
 * Earth's wake drawn all the way back to the day you were born (one coil a year), a tick at each birthday, and the day
 * itself ringed and named. The wake itself is the style's own (`TrailSpec.life`); these marks are the explorer's, in
 * its gold, like a moment's geometry.
 */
import type { Vec2 } from '../core/math';
import { behind, inPlane, PLANETS, project, wakePlan } from '../scenes/solar-spiral/common';
import { datedSky } from '../scenes/solar/sky';
import type { App } from './app';
import { dateLabel, parseIsoDate } from './format';
import { GOLD, text } from './overlays';
import { VIEWS } from './views';

/** The Earth among the planets. */
const EARTH = PLANETS[2]!;
const HALO = 'rgba(13,15,21,0.6)';

export interface Life {
  /** The day you were born ("1990-05-12") and its day count. */
  iso: string;
  born: number;
  /** Day counts of every birthday since, up to the day the life is drawn to. */
  birthdays: number[];
}

/** Day counts of the birthdays after the date `iso` up to `until` (a 29 February birthday falls on the 28th in other years). */
export function birthdays(iso: string, until: number): number[] {
  const [y, rest] = [Number(iso.slice(0, 4)), iso.slice(4)], out: number[] = [];
  for (let n = 1; n < 200; n++) {
    const day = parseIsoDate(`${String(y + n).padStart(4, '0')}${rest}`) ?? parseIsoDate(`${String(y + n).padStart(4, '0')}${rest.replace('-29', '-28')}`);
    if (day === null || day > until) break;
    out.push(day);
  }
  return out;
}

/** A life from the date `iso` to `until`, or null for a date that cannot be read. */
export function lifeOf(iso: string, until: number): Life | null {
  const born = parseIsoDate(iso);
  return born === null || born > until ? null : { iso, born, birthdays: birthdays(iso, until) };
}

/**
 * The life's marks over the In motion view, where the wake has reached: a tick at each birthday on the Earth's coil
 * (a larger one, numbered, every tenth) and a ring where you were born.
 */
export function drawLife(ctx: CanvasRenderingContext2D, app: App, life: Life): void {
  const sky = app.sim.sky(), plan = wakePlan(sky), now = sky.now;
  if (plan.alpha < 0.05) return;
  // how far back the Earth's wake is drawn now (it unspools after a jump)
  const reach = plan.full[EARTH.k]! * plan.step[EARTH.k]! * plan.reveal + 1e-6;
  const at = (t: number): Vec2 => {
    const p = project(behind(inPlane(EARTH.a, sky.angle(EARTH.k, t)), now - t, plan.speed));
    return [p.x, p.y];
  };
  const k = 1 / app.renderer.designScale;
  ctx.save();
  ctx.globalAlpha = Math.min(1, plan.alpha / 0.35);
  ctx.lineWidth = 1.4 * k;
  life.birthdays.forEach((day, i) => {
    if (day > now || now - day > reach) return;
    const [x, y] = at(day), tenth = (i + 1) % 10 === 0, r = (tenth ? 3.2 : 2.1) * k;
    ctx.beginPath();
    ctx.arc(x, y, r + 1.4 * k, 0, Math.PI * 2);
    ctx.fillStyle = HALO;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    if (tenth) text(ctx, app, [x + 7 * k, y + 4 * k], String(i + 1), 'left', 0.9, true);
  });
  if (life.born <= now && now - life.born <= reach) {
    const [x, y] = at(life.born);
    ctx.lineWidth = 3.8 * k;
    ctx.strokeStyle = HALO;
    ctx.beginPath();
    ctx.arc(x, y, 6 * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.8 * k;
    ctx.strokeStyle = GOLD;
    ctx.fillStyle = GOLD;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 2.4 * k, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, app, [x, y - 12 * k], `You were born here, ${dateLabel(life.born)}`, 'center', 1, true);
  }
  ctx.restore();
}

/**
 * The design circle a life's helix fills once flown to `to` with the wakes `span` days long: the Sun, and the Earth's
 * coils back to the day you were born (with room for its name), so a flight can be framed on its whole picture; with
 * `planets`, the planets round the Sun too (while it flies), else the helix alone (for the card it lands on).
 */
export function lifeFrame(life: Life, to: number, span: number, planets: boolean): { radius: number; at: [number, number] } {
  const sky = datedSky({ day: to, beat: 0, trails: { span, reveal: 1, alpha: 1, life: { since: life.born, k: EARTH.k } } });
  const speed = wakePlan(sky).speed, sun = project([0, 0, 0]);
  let [x0, y0, x1, y1] = planets ? [...VIEWS.wake.home] : [sun.x, sun.y, sun.x, sun.y];
  const n = Math.max(60, Math.ceil((to - life.born) / 20));
  for (let i = 0; i <= n; i++) {
    const t = life.born + ((to - life.born) * i) / n, p = project(behind(inPlane(EARTH.a, sky.angle(EARTH.k, t)), to - t, speed));
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y);
  }
  // the name over the day you were born
  y0 -= 30;
  return { radius: Math.max(x1 - x0, y1 - y0) / 2 + 24, at: [(x0 + x1) / 2, (y0 + y1) / 2] };
}
