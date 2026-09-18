/**
 * Where the bodies' names go, drawing after drawing, without flicker. Each name sits beside its body, on the right
 * unless that would run off the screen; where a more important name already stands it waits, faded out, until the
 * bodies part. Three kinds of hysteresis keep names from popping as the bodies move:
 *
 * - space: a name on show keeps its place while it overlaps a neighbour by a few pixels, and a hidden one returns only
 *   once there is clear room round it;
 * - side: a name moved to the left at the screen's edge returns to the right only once it clearly fits there;
 * - time: a name must want to hide (or to return) for a moment before it does, so a body grazing another does not
 *   blink it on and off, and the change itself is a CSS fade.
 *
 * Pure bookkeeping: the caller hands in where the bodies are drawn and the time, and gets back where each name goes
 * and whether it shows.
 */

export interface LabelIn {
  id: string;
  /** Body centre on screen, CSS pixels. */
  x: number;
  y: number;
  /** Clearance from the centre to the name, CSS pixels. */
  r: number;
  /** Name size, CSS pixels. */
  w: number;
  h: number;
}

export interface LabelOut {
  id: string;
  left: number;
  top: number;
  shown: boolean;
}

interface State {
  shown: boolean;
  side: 1 | -1;
  /** Since when the name has wanted the other state (ms), or null while it is content. */
  wantSince: number | null;
}

/** Pixels two names may overlap before the one on show gives way, and room a hidden one needs round it to return. */
const GIVE = 4;
const ROOM = 5;
/** Milliseconds a name must want to hide, or to return, before it does. */
const HIDE_AFTER = 160;
const SHOW_AFTER = 650;
/** Gap between a body's edge and its name, and between a name and the screen's right edge. */
const GAP = 6;
const EDGE = 4;

type Box = readonly [number, number, number, number];

const overlaps = (a: Box, b: Box, pad: number): boolean =>
  a[0] < b[2] + pad && a[2] > b[0] - pad && a[1] < b[3] + pad && a[3] > b[1] - pad;

export class LabelLayout {
  private readonly states = new Map<string, State>();

  /** Forget every name's history (a new view or style: names should settle afresh, at once). */
  reset(): void {
    this.states.clear();
  }

  /**
   * Place `labels`, given in order of importance (the first wins any clash), on a screen `width` pixels wide at time
   * `now` (ms). Names not handed in this time are forgotten. `pending` says some name is waiting to change: place
   * again a little later even if nothing moves.
   */
  place(labels: readonly LabelIn[], width: number, now: number): { labels: LabelOut[]; pending: boolean } {
    const placed: Box[] = [], out: LabelOut[] = [], seen = new Set<string>();
    let pending = false;
    for (const l of labels) {
      seen.add(l.id);
      let st = this.states.get(l.id);
      const fresh = !st;
      if (!st) {
        st = { shown: true, side: 1, wantSince: null };
        this.states.set(l.id, st);
      }
      const top = Math.round(l.y - l.h / 2);
      const at = (side: 1 | -1): number => Math.round(side === 1 ? l.x + l.r + GAP : l.x - l.r - GAP - l.w);
      const box = (side: 1 | -1): Box => [at(side), top, at(side) + l.w, top + l.h];
      // the right is home; the left only where the right would run off the screen, and back once it clearly fits
      const right = at(1) + l.w;
      if (st.side === 1 && right > width - EDGE) st.side = -1;
      else if (st.side === -1 && right <= width - EDGE - 12) st.side = 1;
      // a name on show tolerates a little overlap; a hidden one needs room to spare
      const pad = st.shown ? -GIVE : ROOM, want = !placed.some(p => overlaps(box(st.side), p, pad));
      if (fresh) st.shown = want;
      else if (want !== st.shown) {
        st.wantSince ??= now;
        if (now - st.wantSince >= (want ? SHOW_AFTER : HIDE_AFTER)) {
          st.shown = want;
          st.wantSince = null;
        }
      } else st.wantSince = null;
      if (st.wantSince !== null) pending = true;
      const b = box(st.side);
      if (st.shown) placed.push(b);
      out.push({ id: l.id, left: b[0], top, shown: st.shown });
    }
    for (const id of [...this.states.keys()]) if (!seen.has(id)) this.states.delete(id);
    return { labels: out, pending };
  }
}
