/**
 * The explorer's controls: the top bar and the dock wired to the app, the readouts kept in step with it, keyboard
 * shortcuts, and the gestures on the canvas (drag to pan, wheel or pinch to zoom towards the pointer, tap to pick).
 */
import type { App } from './app';
import { ZOOM_MAX, ZOOM_MIN } from './camera';
import { dateLabel, dateLong, fromLog, isoDate, paceFromSlider, paceLabel, paceToSlider, parseIsoDate, spanFromSlider, spanLabel, spanToSlider, toLog, today } from './format';
import { DAY, MONTH, WEEK, YEAR } from './sim';
import { STYLES } from './styles';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

export const PACE_PRESETS: readonly [number, string][] = [
  [DAY, '1 day/s'], [WEEK, '1 week/s'], [MONTH, '1 month/s'], [YEAR, '1 year/s'], [10 * YEAR, '10 years/s'],
];

/** Hooks the controls call that belong to other parts of the page. */
export interface ControlHooks {
  openJump(): void;
  openGuide(): void;
  openBody(id: NonNullable<App['selected']>): void;
  closePanel(): boolean;
  reset(): void;
  toast(text: string): void;
}

/** Paint a range input's filled part (WebKit draws no progress of its own). */
const fill = (el: HTMLInputElement): void => {
  const u = (Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min));
  el.style.setProperty('--fill', `${(u * 100).toFixed(2)}%`);
};

export function wireControls(app: App, hooks: ControlHooks): () => void {
  const ui = {
    play: $<HTMLButtonElement>('play'),
    dateOut: $<HTMLOutputElement>('date-out'),
    dateIn: $<HTMLInputElement>('date-in'),
    today: $<HTMLButtonElement>('today-btn'),
    reset: $<HTMLButtonElement>('reset-btn'),
    reverse: $<HTMLButtonElement>('reverse'),
    pace: $<HTMLInputElement>('pace'),
    paceOut: $<HTMLOutputElement>('pace-out'),
    chips: $<HTMLDivElement>('pace-chips'),
    styles: $<HTMLDivElement>('styles'),
    trails: $<HTMLButtonElement>('trails-btn'),
    span: $<HTMLInputElement>('span'),
    spanOut: $<HTMLOutputElement>('span-out'),
    opacity: $<HTMLInputElement>('opacity'),
    opacityOut: $<HTMLOutputElement>('opacity-out'),
    zoom: $<HTMLInputElement>('zoom'),
    zoomIn: $<HTMLButtonElement>('zoom-in'),
    zoomOut: $<HTMLButtonElement>('zoom-out'),
    viewReset: $<HTMLButtonElement>('view-reset'),
    names: $<HTMLButtonElement>('labels-btn'),
    more: $<HTMLButtonElement>('more-btn'),
    dock: $<HTMLElement>('dock'),
    hide: $<HTMLButtonElement>('hide-btn'),
    fs: $<HTMLButtonElement>('fs-btn'),
    jump: $<HTMLButtonElement>('jump-btn'),
    guide: $<HTMLButtonElement>('guide-btn'),
    canvas: $<HTMLCanvasElement>('sky'),
  };

  /* ---------- views and styles ---------- */

  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('.views button')];
  for (const b of viewButtons) b.addEventListener('click', () => app.setView(b.dataset.view === 'wake' ? 'wake' : 'sky'));

  const styleButtons = STYLES.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style';
    b.setAttribute('role', 'radio');
    b.dataset.style = s.key;
    b.title = `${s.title}: ${s.theme} (${(i + 1) % 10})`;
    const [paper, ink, accent] = s.swatch;
    b.innerHTML = `<span class="sw" style="background:${paper}"><i style="border-color:${ink}"></i><i style="background:${accent}"></i></span><b></b>`;
    b.querySelector('b')!.textContent = s.title;
    b.addEventListener('click', () => app.setStyle(s));
    ui.styles.append(b);
    return b;
  });
  // arrow keys move between radios, as in a radio group
  const radioKeys = (buttons: HTMLButtonElement[], choose: (i: number) => void) => (e: KeyboardEvent): void => {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const next = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
    choose(next);
    buttons[next]!.focus();
  };
  ui.styles.addEventListener('keydown', radioKeys(styleButtons, i => app.setStyle(STYLES[i]!)));
  document.querySelector('.views')!.addEventListener('keydown', radioKeys(viewButtons, i => app.setView(i ? 'wake' : 'sky')) as EventListener);

  /* ---------- time and pace ---------- */

  ui.play.addEventListener('click', () => app.play(!app.sim.playing));
  ui.today.addEventListener('click', () => app.jump(today()));
  ui.reset.addEventListener('click', () => hooks.reset());
  ui.reverse.addEventListener('click', () => app.setDirection(app.sim.direction === 1 ? -1 : 1));
  ui.dateIn.addEventListener('change', () => {
    const day = parseIsoDate(ui.dateIn.value);
    if (day !== null) app.jump(day);
  });
  // the native picker opens on a click anywhere on the date
  ui.dateIn.addEventListener('click', () => { try { ui.dateIn.showPicker?.(); } catch { /* not allowed here: the field still works */ } });
  ui.pace.addEventListener('input', () => app.setPace(paceFromSlider(Number(ui.pace.value) / 1000)));
  const chips = PACE_PRESETS.map(([pace, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.addEventListener('click', () => { app.setPace(pace); if (!app.sim.playing) app.play(true); });
    ui.chips.append(b);
    return { b, pace };
  });

  /* ---------- trails, zoom, names ---------- */

  ui.trails.addEventListener('click', () => app.setTrails(!app.sim.trails.on));
  ui.span.addEventListener('input', () => app.setSpan(spanFromSlider(Number(ui.span.value) / 1000)));
  ui.opacity.addEventListener('input', () => {
    app.setOpacity(Number(ui.opacity.value) / 100);
    if (!app.sim.trails.on && Number(ui.opacity.value) > 0) app.setTrails(true);
  });
  const zoomToSlider = (z: number): number => toLog(z, ZOOM_MIN, ZOOM_MAX);
  ui.zoom.addEventListener('input', () => app.setZoom(fromLog(Number(ui.zoom.value) / 1000, ZOOM_MIN, ZOOM_MAX)));
  ui.zoomIn.addEventListener('click', () => app.zoomBy(1.5));
  ui.zoomOut.addEventListener('click', () => app.zoomBy(1 / 1.5));
  ui.viewReset.addEventListener('click', () => app.resetView());
  ui.names.addEventListener('click', () => app.setNames(!app.names));
  ui.more.addEventListener('click', () => {
    const open = !ui.dock.classList.contains('expanded');
    ui.dock.classList.toggle('expanded', open);
    ui.more.setAttribute('aria-expanded', String(open));
    ui.more.textContent = open ? 'Fewer controls' : 'More controls';
  });

  /* ---------- top bar ---------- */

  const setHidden = (on: boolean): void => {
    document.body.classList.toggle('hide-ui', on);
    ui.hide.setAttribute('aria-pressed', String(on));
    if (on) hooks.toast('Controls hidden. Press H or tap the sky with two fingers to bring them back.');
  };
  ui.hide.addEventListener('click', () => setHidden(true));
  $<HTMLButtonElement>('show-btn').addEventListener('click', () => setHidden(false));

  // styles: a rail down the left of a wide screen, a strip in the dock on a phone
  const phone = matchMedia('(max-width: 720px)');
  const placeStyles = (): void => (phone.matches ? $('style-slot') : $('rail')).append(ui.styles);
  placeStyles();
  phone.addEventListener('change', placeStyles);

  // on a desktop the controls fade while the sky plays untouched, and return as soon as the pointer moves
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let lastActive = performance.now();
  const wake = (): void => {
    lastActive = performance.now();
    document.body.classList.remove('idle');
  };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin']) addEventListener(ev, wake, { passive: true, capture: true });
  setInterval(() => {
    const busy = document.querySelector('.chrome:hover, .panel:not([hidden]), .chrome :focus-visible') !== null;
    document.body.classList.toggle('idle', fine.matches && app.sim.playing && !busy && performance.now() - lastActive > 4500);
  }, 500);
  ui.fs.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => hooks.toast('Full screen is not available here.'));
  });
  if (!document.documentElement.requestFullscreen) ui.fs.hidden = true;
  ui.jump.addEventListener('click', () => hooks.openJump());
  ui.guide.addEventListener('click', () => hooks.openGuide());

  /* ---------- keyboard ---------- */

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const typing = t instanceof HTMLInputElement && (t.type === 'date' || t.type === 'text');
    const onRange = t instanceof HTMLInputElement && t.type === 'range';
    const onButton = t instanceof HTMLButtonElement || t instanceof HTMLAnchorElement;
    if (typing) return;
    const k = e.key;
    let handled = true;
    if (k === ' ' && !onButton) app.play(!app.sim.playing);
    else if ((k === 'ArrowRight' || k === 'ArrowLeft') && !onRange && !onButton) app.setPace(paceFromSlider(Math.min(1, Math.max(0, paceToSlider(app.sim.pace) + (k === 'ArrowRight' ? 0.04 : -0.04)))));
    else if (k === 'r' || k === 'R') app.setDirection(app.sim.direction === 1 ? -1 : 1);
    else if (k === 't' || k === 'T') app.jump(today());
    else if (k === 'v' || k === 'V') app.setView(app.view === 'sky' ? 'wake' : 'sky');
    else if (k === 'w' || k === 'W') app.setTrails(!app.sim.trails.on);
    else if (k === 'l' || k === 'L') app.setNames(!app.names);
    else if (k === '+' || k === '=') app.zoomBy(1.5);
    else if (k === '-' || k === '_') app.zoomBy(1 / 1.5);
    else if (k === 'z' || k === 'Z') app.resetView();
    else if (k === 'h' || k === 'H') setHidden(!document.body.classList.contains('hide-ui'));
    else if (k === 'f' || k === 'F') ui.fs.click();
    else if (k === 'j' || k === 'J') hooks.openJump();
    else if (k === 'g' || k === 'G') hooks.openGuide();
    else if (k === '[' || k === ']') app.nextStyle(k === ']' ? 1 : -1);
    else if (k === 'Home') hooks.reset();
    else if (/^[0-9]$/.test(k) && !onRange) app.setStyle(STYLES[(Number(k) + 9) % 10]!);
    else if (k === 'Escape') {
      if (!hooks.closePanel()) {
        if (document.body.classList.contains('hide-ui')) setHidden(false);
        else app.select(null);
      }
    } else handled = false;
    if (handled) e.preventDefault();
  });

  /* ---------- gestures on the sky ---------- */

  const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  let pinch: { d: number } | null = null, dragged = false;
  const canvas = ui.canvas;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now() });
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
    }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') canvas.classList.toggle('over-body', app.pickAt(e.clientX, e.clientY) !== null);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()], d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      app.zoomBy(d / pinch.d, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      app.panBy(dx / 2, dy / 2);
      pinch.d = d;
      dragged = true;
      return;
    }
    if (!dragged && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 6) return;
    if (!dragged) {
      dragged = true;
      canvas.classList.add('dragging');
    }
    app.panBy(dx, dy);
  });
  const release = (e: PointerEvent): void => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.classList.remove('dragging');
    if (!p || dragged || e.type === 'pointercancel') return;
    if (performance.now() - p.t0 > 700) return;
    const hit = app.pickAt(e.clientX, e.clientY);
    if (hit) {
      app.select(hit.id);
      hooks.openBody(hit.id);
    } else if (app.selected) app.select(null);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    // a trackpad pinch arrives as a wheel with ctrl held, in finer steps
    const k = e.ctrlKey ? 0.012 : e.deltaMode === 1 ? 0.05 : 0.0016;
    app.zoomBy(Math.exp(-e.deltaY * k), e.clientX, e.clientY);
  }, { passive: false });
  canvas.addEventListener('dblclick', e => {
    const hit = app.pickAt(e.clientX, e.clientY);
    if (hit && hit.id !== 'belt') {
      app.select(hit.id);
      app.focusSelected(Math.max(4, app.camera.zoom * 2));
    } else app.zoomBy(2, e.clientX, e.clientY);
  });
  // two fingers tapping the sky bring hidden controls back
  canvas.addEventListener('touchend', e => {
    if (document.body.classList.contains('hide-ui') && e.touches.length === 0 && e.changedTouches.length >= 2) setHidden(false);
  });

  /* ---------- keeping readouts in step ---------- */

  const shown = { date: '', pace: -1, span: -1, zoom: -1 };
  const onDraw = (): void => {
    if (app.camera.zoom !== shown.zoom) {
      shown.zoom = app.camera.zoom;
      ui.zoom.value = String(Math.round(zoomToSlider(app.camera.zoom) * 1000));
      ui.zoom.setAttribute('aria-valuetext', `${Math.round(app.camera.zoom * 10) / 10} times`);
      fill(ui.zoom);
      ui.viewReset.disabled = app.camera.home;
    }
    const label = dateLabel(app.sim.day);
    if (label !== shown.date) {
      shown.date = label;
      ui.dateOut.textContent = label;
      ui.canvas.setAttribute('aria-label', `The solar system on ${dateLong(app.sim.day)}, drawn live in the ${app.style.title} style, ${app.view === 'sky' ? 'seen from above' : 'seen at an angle as the Sun travels'}.`);
    }
  };
  const refresh = (): void => {
    const s = app.sim;
    document.body.classList.toggle('paused', !s.playing);
    ui.play.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    for (const b of viewButtons) b.setAttribute('aria-checked', String(b.dataset.view === app.view));
    styleButtons.forEach((b, i) => {
      const on = STYLES[i] === app.style;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    viewButtons.forEach(b => (b.tabIndex = b.dataset.view === app.view ? 0 : -1));
    ui.reverse.setAttribute('aria-pressed', String(s.direction === -1));
    if (s.pace !== shown.pace) {
      shown.pace = s.pace;
      ui.pace.value = String(Math.round(paceToSlider(s.pace) * 1000));
      ui.paceOut.textContent = paceLabel(s.pace);
      ui.pace.setAttribute('aria-valuetext', `${spanLabel(s.pace)} per second`);
      fill(ui.pace);
      for (const c of chips) c.b.setAttribute('aria-pressed', String(Math.abs(c.pace / s.pace - 1) < 0.005));
    }
    ui.dateIn.value = isoDate(s.day);
    ui.trails.setAttribute('aria-pressed', String(s.trails.on));
    ui.trails.parentElement!.classList.toggle('off', !s.trails.on);
    if (s.trails.span !== shown.span) {
      shown.span = s.trails.span;
      ui.span.value = String(Math.round(spanToSlider(s.trails.span) * 1000));
      ui.spanOut.textContent = spanLabel(s.trails.span);
      ui.span.setAttribute('aria-valuetext', spanLabel(s.trails.span));
      fill(ui.span);
    }
    ui.opacity.value = String(Math.round(s.trails.opacity * 100));
    ui.opacityOut.textContent = `${Math.round(s.trails.opacity * 100)}%`;
    fill(ui.opacity);
    ui.viewReset.disabled = app.camera.home;
    ui.names.setAttribute('aria-pressed', String(app.names));
    onDraw();
  };
  app.onDraw = onDraw;
  refresh();
  return refresh;
}
