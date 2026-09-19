/**
 * The explorer's controls: the top bar and the dock wired to the app, the readouts kept in step with it, keyboard
 * shortcuts, and the gestures on the canvas (drag to pan, wheel or pinch to zoom towards the pointer, tap to pick).
 */
import type { App } from './app';
import type { ViewId } from './bodies';
import { dateLabel, dateLong, dayOfYear, isoDate, paceFromSlider, paceLabel, paceToSlider, parseIsoDate, spanFromSlider, spanLabel, spanToSlider, today, yearOf } from './format';
import { t } from './i18n';
import { STYLES } from './styles';

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as T;
};

/** The menus, each opening its sheet in the panel. */
export type MenuId = 'moments' | 'sky' | 'scale' | 'look' | 'you' | 'guide';

/** Hooks the controls call that belong to other parts of the page. */
export interface ControlHooks {
  /** Open a menu's sheet, or close it when it is the one open. */
  toggleMenu(id: MenuId): void;
  openMenu(id: MenuId): void;
  /** End a journey under way; false when none is. */
  endJourney(): boolean;
  openBody(id: NonNullable<App['selected']>): void;
  closePanel(): boolean;
  reset(): void;
  toast(text: string): void;
  /** The controls moved between the top bar and the dock: the room they leave has changed. */
  relayout(): void;
  /** Play or pause: the sky, or the guided tour while it is on. */
  togglePlay(): void;
  /** Switch the sound of the orbits on or off. */
  toggleSound(): void;
  /** Pick out the next body in view (or the one before), with its card. */
  stepBody(dir: 1 | -1): void;
  /** Show the moment before or after the one on show, in the Moments list's order; false when no moment is on show. */
  stepMoment(dir: 1 | -1): boolean;
}

/** Paint a range input's filled part (WebKit draws no progress of its own). */
const fill = (el: HTMLInputElement): void => {
  const u = (Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min));
  el.style.setProperty('--fill', `${(u * 100).toFixed(2)}%`);
};

export interface Controls {
  /** Bring every control in step with the app. */
  refresh(): void;
  /** Keep the readouts that change as the date runs in step (after every drawing). */
  onDraw(): void;
  /** Hide the controls (the sky alone), or bring them back. */
  setHidden(on: boolean): void;
}

export function wireControls(app: App, hooks: ControlHooks): Controls {
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
    styleGrid: $<HTMLDivElement>('style-grid'),
    lookSw: $<HTMLElement>('look-sw'),
    lookName: $<HTMLElement>('look-name'),
    lookBtn: $<HTMLButtonElement>('look-btn'),
    trails: $<HTMLButtonElement>('trails-btn'),
    span: $<HTMLInputElement>('span'),
    spanOut: $<HTMLOutputElement>('span-out'),
    opacity: $<HTMLInputElement>('opacity'),
    opacityOut: $<HTMLOutputElement>('opacity-out'),
    year: $<HTMLInputElement>('year'),
    yearOut: $<HTMLOutputElement>('year-out'),
    names: $<HTMLButtonElement>('labels-btn'),
    more: $<HTMLButtonElement>('more-btn'),
    dock: $<HTMLElement>('dock'),
    homePill: $<HTMLButtonElement>('home-pill'),
    hide: $<HTMLButtonElement>('hide-btn'),
    fs: $<HTMLButtonElement>('fs-btn'),
    fsText: $<HTMLElement>('fs-text'),
    canvas: $<HTMLCanvasElement>('sky'),
  };
  // zoom sits in the dock on a wide screen and in the Look sheet on a compact one: both are kept in step
  const zoomButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-zoom]')];
  const zoomReadouts = [...document.querySelectorAll<HTMLOutputElement>('.zoom-readout')];

  /* ---------- views and styles ---------- */

  const viewButtons = [...document.querySelectorAll<HTMLButtonElement>('.views button')];
  const viewOf = (b: HTMLButtonElement): ViewId => (b.dataset.view === 'earth' ? 'earth' : b.dataset.view === 'sky' ? 'sky' : 'wake');
  for (const b of viewButtons) b.addEventListener('click', () => app.setView(viewOf(b)));

  // the visual styles: a grid of radios in the Look sheet; the Look menu shows the one in use
  const swatch = (el: HTMLElement, [paper, ink, accent]: readonly [string, string, string]): void => {
    el.style.background = paper;
    const [ring, dot] = el.querySelectorAll('i');
    ring!.style.borderColor = ink;
    dot!.style.background = accent;
  };
  const styleButtons = STYLES.map((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'style';
    b.setAttribute('role', 'radio');
    b.dataset.style = s.key;
    b.title = `${s.title}: ${s.line} (${(i + 1) % 10})`;
    b.innerHTML = `<span class="sw" aria-hidden="true"><i></i><i></i></span><span class="style-text"><b></b><small></small></span>`;
    swatch(b.querySelector('.sw')!, s.swatch);
    b.querySelector('b')!.textContent = s.title;
    b.querySelector('small')!.textContent = s.theme;
    b.addEventListener('click', () => app.setStyle(s));
    ui.styleGrid.append(b);
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
  document.querySelector('.views')!.addEventListener('keydown', radioKeys(viewButtons, i => app.setView(viewOf(viewButtons[i]!))) as EventListener);
  ui.styleGrid.addEventListener('keydown', radioKeys(styleButtons, i => app.setStyle(STYLES[i]!)) as EventListener);

  /* ---------- menus ---------- */

  const menuButtons = [...document.querySelectorAll<HTMLButtonElement>('#menus .menu')];
  for (const b of menuButtons) b.addEventListener('click', () => hooks.toggleMenu(b.dataset.menu as MenuId));

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
  ui.dateIn.addEventListener('click', () => {
    // while the date runs the field lags behind it: open the picker on the date shown
    ui.dateIn.value = isoDate(app.sim.day);
    try { ui.dateIn.showPicker?.(); } catch { /* not allowed here: the field still works */ }
  });
  ui.pace.addEventListener('input', () => app.setPace(paceFromSlider(Number(ui.pace.value) / 1000, app.spec.pace)));
  // the year scrubber: dragging it moves the sky through time (the date keeps running from wherever it is let go)
  let scrubbing = false;
  ui.year.addEventListener('pointerdown', () => (scrubbing = true));
  addEventListener('pointerup', () => (scrubbing = false));
  ui.year.addEventListener('input', () => app.jump(dayOfYear(Number(ui.year.value))));
  // a row of chips scrolled along says so at its start as well as its end
  const scrolled = (): void => void ui.chips.classList.toggle('scrolled', ui.chips.scrollLeft > 2);
  ui.chips.addEventListener('scroll', scrolled, { passive: true });
  // each family of views offers its own paces: the plans from a day to ten years a second, the Earth and Moon from
  // real time to a day a second
  let chips: { b: HTMLButtonElement; pace: number }[] = [], chipFamily = '';
  const makeChips = (): void => {
    if (chipFamily === app.spec.family) return;
    chipFamily = app.spec.family;
    ui.chips.replaceChildren();
    chips = app.spec.pace.chips.map(([pace, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = label;
      b.addEventListener('click', () => { app.setPace(pace); if (!app.sim.playing) app.play(true); });
      ui.chips.append(b);
      return { b, pace };
    });
    shown.pace = -1;
    shown.span = -1;
  };

  /* ---------- trails, zoom, names ---------- */

  ui.trails.addEventListener('click', () => app.setTrails(!app.sim.trails.on));
  ui.span.addEventListener('input', () => app.setSpan(spanFromSlider(Number(ui.span.value) / 1000, app.spec.span)));
  ui.opacity.addEventListener('input', () => {
    app.setOpacity(Number(ui.opacity.value) / 100);
    if (!app.sim.trails.on && Number(ui.opacity.value) > 0) app.setTrails(true);
  });
  for (const b of zoomButtons) {
    b.addEventListener('click', () => {
      if (b.dataset.zoom === 'home') app.resetView();
      else app.zoomBy(b.dataset.zoom === 'in' ? 1.5 : 1 / 1.5);
    });
  }
  ui.homePill.addEventListener('click', () => app.resetView());
  ui.names.addEventListener('click', () => app.setNames(!app.names));
  const moreLabel = (open: boolean): string => (open ? t('dock.fewer') : t('dock.more'));
  ui.more.addEventListener('click', () => {
    const open = !ui.dock.classList.contains('expanded');
    ui.dock.classList.toggle('expanded', open);
    ui.more.setAttribute('aria-expanded', String(open));
    ui.more.setAttribute('aria-label', moreLabel(open));
  });
  ui.more.setAttribute('aria-label', moreLabel(false));

  /* ---------- top bar ---------- */

  const setHidden = (on: boolean): void => {
    if (on) hooks.closePanel();
    document.body.classList.toggle('hide-ui', on);
    ui.hide.setAttribute('aria-pressed', String(on));
    if (on) hooks.toast(t('toast.hidden'));
  };
  ui.hide.addEventListener('click', () => setHidden(true));
  $<HTMLButtonElement>('show-btn').addEventListener('click', () => setHidden(false));

  // the menus: in the top bar on a wide screen, a row of tabs along the foot of the dock on a compact one (within
  // reach of a thumb); and on a short screen (a phone on its side) the key moments ride in the top bar
  const views = document.querySelector<HTMLElement>('.views')!, menus = $('menus');
  const top = $('top'), moments = $('moments');
  const compact = matchMedia('(max-width: 980px), (max-height: 540px)'), short = matchMedia('(max-height: 540px) and (max-width: 1279px)');
  const place = (): void => {
    if (compact.matches) $('tab-slot').append(menus);
    else views.after(menus);
    if (short.matches) top.insertBefore(moments, views);
    else top.after(moments);
    hooks.relayout();
  };
  place();
  compact.addEventListener('change', place);
  short.addEventListener('change', place);

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
    else void document.documentElement.requestFullscreen?.().catch(() => hooks.toast(t('toast.noFullscreen')));
  });
  document.addEventListener('fullscreenchange', () => {
    ui.fsText.textContent = document.fullscreenElement ? 'Leave full screen' : 'Full screen';
  });
  if (!document.documentElement.requestFullscreen) ui.fs.hidden = true;

  /* ---------- keyboard ---------- */

  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || document.body.classList.contains('welcoming')) return;
    const target = e.target as HTMLElement;
    const typing = target instanceof HTMLInputElement && (target.type === 'date' || target.type === 'text');
    const onRange = target instanceof HTMLInputElement && target.type === 'range';
    const onButton = target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;
    if (typing) return;
    const k = e.key, arrow = (k === 'ArrowRight' || k === 'ArrowLeft') && !onRange;
    let handled = true;
    if (k === ' ' && !onButton) hooks.togglePlay();
    // with a moment on show the arrows step through the moments (from its own buttons too); otherwise they set the pace
    else if (arrow && target.getAttribute('role') !== 'radio' && hooks.stepMoment(k === 'ArrowRight' ? 1 : -1)) handled = true;
    else if (arrow && !onButton) app.setPace(paceFromSlider(Math.min(1, Math.max(0, paceToSlider(app.sim.pace, app.spec.pace) + (k === 'ArrowRight' ? 0.04 : -0.04))), app.spec.pace));
    else if (k === 'r' || k === 'R') app.setDirection(app.sim.direction === 1 ? -1 : 1);
    else if (k === 't' || k === 'T') app.jump(today());
    else if (k === 'v' || k === 'V') app.setView(app.view === 'sky' ? 'wake' : 'sky');
    else if (k === 'e' || k === 'E') app.toggleEarth();
    else if (k === 'w' || k === 'W') app.setTrails(!app.sim.trails.on);
    else if (k === 'l' || k === 'L') app.setNames(!app.names);
    else if (k === '+' || k === '=') app.zoomBy(1.5);
    else if (k === '-' || k === '_') app.zoomBy(1 / 1.5);
    else if (k === 'z' || k === 'Z') app.resetView();
    else if (k === 'h' || k === 'H') setHidden(!document.body.classList.contains('hide-ui'));
    else if (k === 'f' || k === 'F') ui.fs.click();
    else if (k === 'j' || k === 'J') hooks.openMenu('moments');
    else if (k === 'k' || k === 'K') hooks.toggleMenu('sky');
    else if (k === 'c' || k === 'C') hooks.toggleMenu('scale');
    else if (k === 'm' || k === 'M') hooks.toggleSound();
    else if (k === 'n' || k === 'N') hooks.stepBody(e.shiftKey ? -1 : 1);
    else if (k === 's' || k === 'S') hooks.toggleMenu('look');
    else if (k === 'g' || k === 'G') hooks.openMenu('guide');
    else if (k === 'y' || k === 'Y') hooks.openMenu('you');
    else if (k === '[' || k === ']') app.nextStyle(k === ']' ? 1 : -1);
    else if (k === 'Home') hooks.reset();
    else if (/^[0-9]$/.test(k) && !onRange) app.setStyle(STYLES[(Number(k) + 9) % 10]!);
    else if (k === 'Escape') {
      if (!hooks.closePanel() && !hooks.endJourney()) {
        if (document.body.classList.contains('hide-ui')) setHidden(false);
        else app.select(null);
      }
    } else handled = false;
    if (handled) e.preventDefault();
  });

  /* ---------- gestures on the sky ---------- */

  const pointers = new Map<number, { x: number; y: number; x0: number; y0: number; t0: number }>();
  let pinch: { d: number } | null = null, dragged = false, lastTap = { t: -1e9, x: 0, y: 0 };
  /** A touch's card waits out the double-tap window, so it cannot cover the body before a second tap lands on it. */
  const DOUBLE_TAP_MS = 320;
  let cardTimer = 0;
  /** Fly in on the body under a point and follow it (with its card), or zoom in there. */
  const flyIn = (x: number, y: number): void => {
    clearTimeout(cardTimer);
    const hit = app.pickAt(x, y);
    if (hit && hit.id === 'earth' && app.view !== 'earth' && app.camera.zoom >= app.camera.max / 2) {
      // already close on the Earth in a plan: go on in, to the Earth and Moon view
      app.select('earth');
      app.setView('earth');
      hooks.openBody('earth');
    } else if (hit && hit.id !== 'belt') {
      app.select(hit.id);
      // the card first: the flight centres the body in the room the card leaves
      hooks.openBody(hit.id);
      app.focusSelected(Math.max(4, app.camera.zoom * 2));
    } else app.zoomBy(2, x, y);
  };
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
    const now = performance.now();
    if (now - p.t0 > 700) return;
    // a second tap on a touch screen, close by and soon after, flies in (touch screens send no reliable dblclick)
    if (e.pointerType === 'touch' && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = { t: -1e9, x: 0, y: 0 };
      flyIn(e.clientX, e.clientY);
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    const hit = app.pickAt(e.clientX, e.clientY);
    clearTimeout(cardTimer);
    if (hit) {
      // the ring shows at once; on a touch screen the card follows once no second tap has come
      app.select(hit.id);
      const open = (): void => {
        hooks.openBody(hit.id);
        app.reveal();
      };
      if (e.pointerType === 'touch') cardTimer = window.setTimeout(open, DOUBLE_TAP_MS);
      else open();
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
    if (!(e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities?.firesTouchEvents) flyIn(e.clientX, e.clientY);
  });
  // two fingers tapping the sky bring hidden controls back
  canvas.addEventListener('touchend', e => {
    if (document.body.classList.contains('hide-ui') && e.touches.length === 0 && e.changedTouches.length >= 2) setHidden(false);
  });

  /* ---------- keeping readouts in step ---------- */

  const shown = { date: '', pace: -1, span: -1, zoom: -1 };
  const WHERE: Readonly<Record<ViewId, string>> = {
    sky: 'The solar system seen from above',
    wake: 'The solar system seen at an angle as the Sun travels',
    earth: 'The Earth, its orbits and the Moon seen from above, at true scale',
  };
  const onDraw = (): void => {
    if (app.camera.zoom !== shown.zoom) {
      shown.zoom = app.camera.zoom;
      const z = app.camera.zoom, label = `${z < 10 ? (Math.round(z * 10) / 10).toString() : Math.round(z)}×`;
      for (const r of zoomReadouts) r.textContent = label;
      // at the ends of a view's zoom the buttons carry on through the Earth: in from a plan following it, out of the
      // Earth and Moon view
      for (const b of zoomButtons) {
        if (b.dataset.zoom === 'in') b.disabled = z >= app.camera.max - 1e-6 && !app.canDive;
        else if (b.dataset.zoom === 'out') b.disabled = z <= app.camera.least + 1e-6 && app.view !== 'earth';
        else b.disabled = app.atHome;
      }
    }
    const y = yearOf(app.sim.day);
    if (!scrubbing && Math.abs(Number(ui.year.value) - y) > 0.004) {
      ui.year.value = y.toFixed(2);
      fill(ui.year);
    }
    const whole = String(Math.floor(y));
    if (ui.yearOut.textContent !== whole) {
      ui.yearOut.textContent = whole;
      ui.year.setAttribute('aria-valuetext', whole);
    }
    const label = dateLabel(app.sim.day);
    if (label !== shown.date) {
      shown.date = label;
      ui.dateOut.textContent = label;
      // the date field keeps up with the running date (unless it is being typed into), so it never reads stale
      if (document.activeElement !== ui.dateIn) ui.dateIn.value = isoDate(app.sim.day);
      ui.canvas.setAttribute('aria-label', `${WHERE[app.view]}, on ${dateLong(app.sim.day)}, drawn live in the ${app.style.title} style.`);
    }
  };
  const refresh = (): void => {
    const s = app.sim;
    makeChips();
    document.body.classList.toggle('paused', !s.playing);
    ui.play.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    for (const b of viewButtons) b.setAttribute('aria-checked', String(b.dataset.view === app.view));
    styleButtons.forEach((b, i) => {
      b.setAttribute('aria-checked', String(STYLES[i] === app.style));
      b.tabIndex = STYLES[i] === app.style ? 0 : -1;
    });
    if (ui.lookName.textContent !== app.style.title) {
      ui.lookName.textContent = app.style.title;
      swatch(ui.lookSw, app.style.swatch);
      ui.lookBtn.setAttribute('aria-label', t('menu.look.label', { style: app.style.title }));
    }
    viewButtons.forEach(b => (b.tabIndex = b.dataset.view === app.view ? 0 : -1));
    ui.reverse.setAttribute('aria-pressed', String(s.direction === -1));
    if (s.pace !== shown.pace) {
      shown.pace = s.pace;
      ui.pace.value = String(Math.round(paceToSlider(s.pace, app.spec.pace) * 1000));
      ui.paceOut.textContent = paceLabel(s.pace);
      ui.pace.setAttribute('aria-valuetext', `${spanLabel(s.pace)} per second`);
      fill(ui.pace);
      for (const c of chips) c.b.setAttribute('aria-pressed', String(Math.abs(c.pace / s.pace - 1) < 0.005));
      // where the chips scroll sideways, keep the one in use in view
      const on = chips.find(c => c.b.getAttribute('aria-pressed') === 'true')?.b, row = ui.chips;
      if (on && row.scrollWidth > row.clientWidth) {
        const left = on.offsetLeft - row.offsetLeft, right = left + on.offsetWidth, pad = 28;
        if (left < row.scrollLeft) row.scrollLeft = left - 4;
        else if (right > row.scrollLeft + row.clientWidth - pad) row.scrollLeft = right - row.clientWidth + pad;
      }
      scrolled();
    }
    if (document.activeElement !== ui.dateIn) ui.dateIn.value = isoDate(s.day);
    ui.trails.setAttribute('aria-pressed', String(s.trails.on));
    ui.trails.parentElement!.classList.toggle('off', !s.trails.on);
    if (s.trails.span !== shown.span) {
      shown.span = s.trails.span;
      ui.span.value = String(Math.round(spanToSlider(s.trails.span, app.spec.span) * 1000));
      ui.spanOut.textContent = spanLabel(s.trails.span);
      ui.span.setAttribute('aria-valuetext', spanLabel(s.trails.span));
      fill(ui.span);
    }
    ui.opacity.value = String(Math.round(s.trails.opacity * 100));
    ui.opacityOut.textContent = `${Math.round(s.trails.opacity * 100)}%`;
    ui.opacity.setAttribute('aria-valuetext', `${Math.round(s.trails.opacity * 100)}%`);
    fill(ui.opacity);
    for (const b of zoomButtons) if (b.dataset.zoom === 'home') b.disabled = app.atHome;
    ui.homePill.hidden = app.atHome;
    ui.names.setAttribute('aria-pressed', String(app.names));
    onDraw();
  };
  refresh();
  return { refresh, onDraw, setHidden };
}
