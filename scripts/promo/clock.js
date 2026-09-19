// A virtual clock, installed before any page script: time moves only when the capture script calls `__clock.step(ms)`,
// so every drawing lands on the output frame grid however long it took to draw. It stands in for `performance.now`,
// `Date`, `requestAnimationFrame` and the timers, and steps CSS transitions and animations by hand.
(() => {
  // the promo's "today": a fixed instant, so default dates and "tonight" draw the same on every run
  const BASE = Date.UTC(2026, 8, 19, 20, 0, 0);
  let now = 0, seq = 0;
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(BASE + now); else super(...a); }
    static now() { return BASE + now; }
  }
  window.Date = FakeDate;
  performance.now = () => now;

  let rafs = new Map();
  window.requestAnimationFrame = fn => { rafs.set(++seq, fn); return seq; };
  window.cancelAnimationFrame = id => { rafs.delete(id); };

  const timers = new Map();
  const timer = (fn, ms, every, args) => { timers.set(++seq, { fn, at: now + Math.max(0, Number(ms) || 0), every, args, id: seq }); return seq; };
  window.setTimeout = (fn, ms, ...args) => timer(fn, ms, null, args);
  window.setInterval = (fn, ms, ...args) => timer(fn, ms, Math.max(1, Number(ms) || 0), args);
  window.clearTimeout = window.clearInterval = id => { timers.delete(id); };

  const seen = new WeakSet();
  function stepAnimations(ms) {
    for (const a of document.getAnimations()) {
      if (!seen.has(a)) { seen.add(a); a.pause(); a.currentTime = 0; }
      const end = a.effect?.getComputedTiming().endTime ?? 0, t = Number(a.currentTime ?? 0) + ms;
      if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
    }
  }

  window.__clock = {
    get now() { return now; },
    step(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const t of timers.values()) if (t.at <= target && (!next || t.at < next.at || (t.at === next.at && t.id < next.id))) next = t;
        if (!next) break;
        now = Math.max(now, next.at);
        if (next.every) next.at += next.every; else timers.delete(next.id);
        if (typeof next.fn === 'function') next.fn(...next.args);
      }
      now = target;
      const run = rafs;
      rafs = new Map();
      for (const fn of run.values()) fn(now);
      stepAnimations(ms);
    },
  };
})();
