/**
 * The guided tour: the stops of `content/tour.ts` played one after another, each with its caption in a small bar at the
 * foot of the screen (in place of the dock and the key moments, as a journey's bar is). A stop sets the sky to a moment
 * and flies its journey, or lets the sky run, then holds a few seconds and moves on.
 *
 * The tour has its own clock: pausing it (its button, or Space while it is on) freezes the sky and the hold alike, and
 * playing it again carries on. It can be stepped back and forth or jumped to any stop from its dots. With reduced
 * motion asked for, nothing moves by itself: the tour starts paused, each stop opens still on its moment, and the next
 * waits for the viewer (pressing play asks for the motion after all).
 */
import type { App } from './app';
import { TOUR, type TourStop } from './content/tour';
import { today } from './format';
import { t } from './i18n';
import { presetById } from './presets';

export interface TourHooks {
  /** Set the sky to a moment without its card; clear the moment on show. */
  setMoment(id: string): void;
  clearMoment(): void;
  /** Put the panel and any journey away, so the tour has the screen. */
  makeRoom(): void;
  toast(text: string): void;
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

export class Tour {
  private readonly bar = $<HTMLElement>('tour-bar');
  private readonly stepEl = $<HTMLElement>('tour-step');
  private readonly titleEl = $<HTMLElement>('tour-title');
  private readonly textEl = $<HTMLElement>('tour-text');
  private readonly dots = $<HTMLOListElement>('tour-dots');
  private readonly play = $<HTMLButtonElement>('tour-play');
  private readonly back = $<HTMLButtonElement>('tour-back');
  private readonly next = $<HTMLButtonElement>('tour-next');
  private readonly dotButtons: HTMLButtonElement[];
  /** The stop on screen, or -1 while no tour is. */
  private i = -1;
  /** The tour's own pause, and its clock: seconds the stop has held, and when that was last counted (ms). */
  private paused = false;
  private held = 0;
  private lastTick = 0;
  private raf = 0;
  /** The stop's journey has been started and has not reached its end yet. */
  private flying = false;

  constructor(private readonly app: App, private readonly hooks: TourHooks) {
    this.dotButtons = TOUR.map((s, k) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      b.className = 'tour-dot';
      b.setAttribute('aria-label', `${t('tour.step', { n: k + 1, of: TOUR.length })}: ${s.title}`);
      b.title = s.title;
      b.innerHTML = '<i></i>';
      b.addEventListener('click', () => this.go(k));
      li.append(b);
      this.dots.append(li);
      return b;
    });
    this.play.addEventListener('click', () => this.togglePause());
    this.back.addEventListener('click', () => this.go(this.i - 1));
    // the last stop's next is the way out
    this.next.addEventListener('click', () => (this.last ? this.end() : this.go(this.i + 1)));
    $('tour-exit').addEventListener('click', () => this.end());
  }

  /** Whether a tour is on screen. */
  get on(): boolean { return this.i >= 0; }

  private get stop(): TourStop | undefined { return TOUR[this.i]; }
  private get last(): boolean { return this.i === TOUR.length - 1; }

  /** Start the tour from its first stop (or `from`). */
  start(from = 0): void {
    this.hooks.makeRoom();
    this.bar.hidden = false;
    document.body.classList.add('journey', 'touring');
    this.paused = this.app.reducedMotion;
    this.go(from);
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.tick);
    // the keyboard lands on the tour's own controls
    this.play.focus({ preventScroll: true });
  }

  /** Pause the tour and the sky together, or carry on (the sky runs again unless the stop rests on a journey's end). */
  togglePause(): void {
    if (this.i < 0) return;
    this.paused = !this.paused;
    if (this.paused) this.app.play(false);
    else if (this.flying || !this.stop?.journey) this.app.play(true);
    this.refresh();
  }

  /** Leave the tour: the sky stays where it is (a moment on show keeps its pill, to open its card). */
  end(): boolean {
    if (this.i < 0) return false;
    this.i = -1;
    this.flying = false;
    cancelAnimationFrame(this.raf);
    // the focus must not stay behind in the hidden bar
    if (this.bar.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    this.bar.hidden = true;
    document.body.classList.remove('journey', 'touring');
    if (this.app.journeying) this.app.play(false);
    requestAnimationFrame(() => this.app.refit());
    this.app.onChange();
    return true;
  }

  /** Go to stop `k`: set its sky, and fly or run it. */
  go(k: number): void {
    const s = TOUR[k];
    if (!s) return;
    this.i = k;
    this.held = 0;
    this.lastTick = performance.now();
    this.flying = false;
    const app = this.app, still = this.paused;
    if (s.preset) this.hooks.setMoment(s.preset);
    else {
      this.hooks.clearMoment();
      app.setView(s.view ?? 'sky');
      app.setDirection(1);
      app.jump(today());
      app.select(null, false);
      app.resetView();
    }
    if (s.pace) app.setPace(s.pace);
    if (s.focus) {
      // Pluto is drawn only while the Scale menu shows the dwarf planets
      if (s.focus.body === 'pluto' && !app.layers.dwarfs) app.setLayer('dwarfs', true);
      app.select(s.focus.body, false);
      app.focusSelected(s.focus.zoom);
    }
    const j = s.journey && s.preset ? presetById(s.preset)?.journey?.() : undefined;
    if (j) {
      // a still tour waits at the journey's start: playing it flies from there
      app.journey(j.from, j.to, j.pace);
      if (still) app.play(false);
      this.flying = true;
    } else app.play(!still);
    this.stepEl.textContent = t('tour.step', { n: k + 1, of: TOUR.length });
    this.titleEl.textContent = s.title;
    this.textEl.textContent = s.text;
    this.dotButtons.forEach((b, n) => {
      b.classList.toggle('done', n < k);
      if (n === k) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    this.back.disabled = k === 0;
    this.next.classList.toggle('finish', this.last);
    this.next.setAttribute('aria-label', this.last ? t('tour.exit') : t('tour.next'));
    this.next.title = this.last ? t('tour.exit') : t('tour.next');
    // the framing fits the room the tour's bar leaves, once the page has laid itself out without the dock
    requestAnimationFrame(() => app.refit());
    this.refresh();
  }

  /** The tour's clock, each animation frame while it is on: the current dot's progress, and moving on once it has held. */
  private readonly tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const s = this.stop;
    if (!s) return;
    const app = this.app, dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    // a journey ends where it was meant to, or is broken off by another control (a jump, a view)
    if (this.flying && !app.journeying) this.flying = false;
    let u: number;
    if (this.flying) {
      const j = presetById(s.preset!)?.journey?.();
      u = j ? Math.min(1, Math.max(0, (app.sim.day - j.from) / (j.to - j.from || 1))) * 0.8 : 0;
    } else {
      // the hold waits while paused
      if (!this.paused) this.held += dt;
      u = s.hold ? (s.journey ? 0.8 : 0) + Math.min(1, this.held / s.hold) * (s.journey ? 0.2 : 1) : 1;
      if (s.hold && this.held >= s.hold && !this.paused) this.go(this.i + 1);
    }
    this.dotButtons[this.i]?.style.setProperty('--u', u.toFixed(3));
  };

  /** The play button and the paused look follow the tour's pause. */
  refresh(): void {
    if (this.i < 0) return;
    this.bar.classList.toggle('paused', this.paused);
    this.play.setAttribute('aria-label', this.paused ? t('tour.play') : t('tour.pause'));
    this.play.title = `${this.paused ? t('tour.play') : t('tour.pause')} (Space)`;
  }
}
