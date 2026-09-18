/**
 * A journey on screen: while a flight plays (the Grand Tour, a transfer to Mars, the years since your birthday), the
 * dock and the key moments (and on a compact screen the top bar) step aside for one small bar with its title, the
 * running date, how far along it is and a way out, and the moment's framing refits into the room that frees.
 *
 * It reads in either orientation. The flights' plans are round, so what limits them is a screen's shorter side: once
 * the controls step aside, a phone held upright gives the plan its full width, a little more than the height it gets
 * on its side, so nothing asks the viewer to turn the phone.
 */
import type { App } from './app';
import { dateLabel } from './format';

export interface Journey {
  from: number;
  to: number;
  /** Days of sky a second. */
  pace: number;
  /** What the bar calls it: "Fly the Grand Tour". */
  label: string;
}

export interface JourneyHooks {
  /** Step the panel aside where it would cover the flight (a phone, a tablet). */
  makeRoom(): void;
}

const $ = (id: string): HTMLElement => document.getElementById(id)!;

/** Screens where the panel shares the room with the flight badly: they close it while a journey plays. */
const COMPACT = matchMedia('(max-width: 980px), (max-height: 540px)');

export class JourneyBar {
  private readonly bar = $('journey-bar');
  private readonly play = $('jb-play') as HTMLButtonElement;
  private readonly title = $('jb-title');
  private readonly date = $('jb-date');
  private readonly fill = $('jb-fill');
  private readonly fromEl = $('jb-from');
  private readonly toEl = $('jb-to');
  private shownDate = '';
  /** The journey on screen (playing, paused or ended), or null. */
  current: Journey | null = null;

  constructor(private readonly app: App, private readonly hooks: JourneyHooks) {
    this.play.addEventListener('click', () => {
      const j = this.current;
      if (!j) return;
      if (this.ended) this.app.journey(j.from, j.to, j.pace);
      else this.app.play(!this.app.sim.playing);
    });
    $('jb-exit').addEventListener('click', () => this.end());
  }

  /** The journey has reached its end and rests there. */
  get ended(): boolean {
    const j = this.current;
    return j !== null && !this.app.journeying && this.app.sim.day >= j.to - 1e-6;
  }

  start(j: Journey): void {
    this.current = j;
    this.title.textContent = j.label;
    this.fromEl.textContent = dateLabel(j.from);
    this.toEl.textContent = dateLabel(j.to);
    this.bar.hidden = false;
    document.body.classList.add('journey');
    if (COMPACT.matches) this.hooks.makeRoom();
    this.app.journey(j.from, j.to, j.pace);
    // the framing fits the room the journey's own bar leaves, once the page has laid itself out without the dock
    requestAnimationFrame(() => this.app.refit());
  }

  /** Leave the journey (it stops where it is); false when none was on screen. */
  end(): boolean {
    if (!this.current) return false;
    this.current = null;
    if (this.app.journeying) this.app.play(false);
    this.bar.hidden = true;
    document.body.classList.remove('journey');
    requestAnimationFrame(() => this.app.refit());
    this.app.onChange();
    return true;
  }

  /** Keep the bar in step with the app; a journey broken off by another control (a jump, reversing) ends here. */
  refresh(): void {
    const j = this.current;
    if (!j) return;
    if (!this.app.journeying && !this.ended) {
      this.end();
      return;
    }
    const ended = this.ended;
    this.bar.classList.toggle('ended', ended);
    this.bar.classList.toggle('paused', !ended && !this.app.sim.playing);
    this.play.setAttribute('aria-label', ended ? 'Play the journey again' : this.app.sim.playing ? 'Pause the journey' : 'Play the journey');
    this.onDraw();
  }

  /** The running date and the progress (after every drawing). */
  onDraw(): void {
    const j = this.current;
    if (!j) return;
    const day = this.app.sim.day, label = dateLabel(day);
    if (label !== this.shownDate) {
      this.shownDate = label;
      this.date.textContent = label;
    }
    const u = Math.min(1, Math.max(0, (day - j.from) / (j.to - j.from || 1)));
    this.fill.style.width = `${(u * 100).toFixed(2)}%`;
  }
}
