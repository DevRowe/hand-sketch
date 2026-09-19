/**
 * A first visit's welcome: one small card with the handful of things worth knowing (moving about, tapping a planet,
 * the views and the Look menu, the key moments, the tour and the Sky and Scale menus, the speed, and You), over the sky
 * as it draws itself on, with the guided tour as a way in.
 * Dismissed once, it stays dismissed in this browser; the guide can bring it back.
 */

const KEY = 'explorer.welcomed';

const ICONS = {
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  tap: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3.2"/>',
  look: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 14.5l5-4 4 3 3-2.5 5 4"/>',
  moments: '<path d="M12 3.2c.9 4.7 4.1 7.9 8.8 8.8-4.7.9-7.9 4.1-8.8 8.8-.9-4.7-4.1-7.9-8.8-8.8 4.7-.9 7.9-4.1 8.8-8.8z"/>',
  pace: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  travel: '<circle cx="12" cy="8" r="3.7"/><path d="M4.6 20.2c.9-4.1 3.8-6.3 7.4-6.3s6.5 2.2 7.4 6.3"/>',
};

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const remember = (): void => {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* storage refused (a private window): the welcome simply shows again next time */
  }
};

export interface Welcome {
  /** Show the welcome whatever was remembered. */
  show(): void;
  /** Whether it is on screen. */
  readonly open: boolean;
}

export function wireWelcome(hooks: { openGuide(): void; startTour(): void }): Welcome & { showOnce(): void } {
  const root = document.getElementById('welcome')!, card = root.querySelector<HTMLElement>('.welcome-card')!;
  const go = document.getElementById('welcome-go') as HTMLButtonElement, guide = document.getElementById('welcome-guide') as HTMLButtonElement;
  const tour = document.getElementById('welcome-tour') as HTMLButtonElement;
  let returnTo: HTMLElement | null = null;

  const tips = (): string => {
    const touch = matchMedia('(pointer: coarse)').matches;
    const rows: [keyof typeof ICONS, string][] = [
      ['move', touch ? '<b>Drag</b> to move about, <b>pinch</b> to zoom.' : '<b>Drag</b> to move about, <b>scroll</b> to zoom.'],
      ['tap', `<b>${touch ? 'Tap' : 'Click'} a planet</b> for its story; ${touch ? 'double-tap' : 'double-click'} to fly in.`],
      ['look', 'Switch between <b>In motion</b>, <b>From above</b> and <b>Earth &amp; Moon</b>, the story of spaceflight at true scale; <b>Look</b> holds the ten visual styles and the trails.'],
      ['moments', '<b>Moments</b> sets the sky to Apollo 11, Voyager, the next Mars window and more, or takes you on a <b>guided tour</b>; <b>Sky</b> shows what is up tonight, <b>Scale</b> how big and how far.'],
      ['pace', 'Play, pause and change the <b>speed</b> along the foot of the screen.'],
      ['travel', '<b>You</b>: fly your own years, share this moment, save a picture or a clip.'],
    ];
    return rows.map(([icon, text]) => `<li><span class="tip-icon"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg></span><span>${text}</span></li>`).join('');
  };

  const close = (): void => {
    if (root.hidden) return;
    root.hidden = true;
    document.body.classList.remove('welcoming');
    remember();
    (returnTo ?? document.getElementById('sky'))?.focus({ preventScroll: true });
  };

  const show = (): void => {
    returnTo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    document.getElementById('welcome-tips')!.innerHTML = tips();
    root.hidden = false;
    document.body.classList.add('welcoming');
    go.focus({ preventScroll: true });
  };

  go.addEventListener('click', close);
  guide.addEventListener('click', () => {
    close();
    hooks.openGuide();
  });
  tour.addEventListener('click', () => {
    close();
    hooks.startTour();
  });
  // a click on the sky around the card is a dismissal too
  root.addEventListener('click', e => {
    if (e.target === root) close();
  });
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      // keep the focus inside the card while it is up
      const focusable = [go, tour, guide];
      const i = focusable.indexOf(document.activeElement as HTMLButtonElement);
      e.preventDefault();
      focusable[(i + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length]!.focus();
    }
    e.stopPropagation();
  });
  card.addEventListener('pointerdown', e => e.stopPropagation());

  return {
    show,
    showOnce: () => {
      if (!read()) show();
    },
    get open() {
      return !root.hidden;
    },
  };
}
