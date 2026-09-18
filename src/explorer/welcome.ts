/**
 * A first visit's welcome: one small card with the handful of things worth knowing (moving about, tapping a planet,
 * the view and the styles, the key moments, pace and trails, your own travels), over the sky as it draws itself on.
 * Dismissed once, it stays dismissed in this browser; the guide can bring it back.
 */

const KEY = 'explorer.welcomed';

const ICONS = {
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  tap: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8" stroke-dasharray="3 3.2"/>',
  look: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M3.5 14.5l5-4 4 3 3-2.5 5 4"/>',
  moments: '<path d="M4 12h16"/><circle cx="7" cy="12" r="2"/><circle cx="13" cy="12" r="2"/><circle cx="19" cy="12" r="1.2"/>',
  pace: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  travel: '<circle cx="17.5" cy="6.5" r="2.6"/><path d="M3.5 20.5c2.5-6 6-9.6 10.6-11.6" stroke-dasharray="2.2 2.6"/>',
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

export function wireWelcome(hooks: { openGuide(): void }): Welcome & { showOnce(): void } {
  const root = document.getElementById('welcome')!, card = root.querySelector<HTMLElement>('.welcome-card')!;
  const go = document.getElementById('welcome-go') as HTMLButtonElement, guide = document.getElementById('welcome-guide') as HTMLButtonElement;
  let returnTo: HTMLElement | null = null;

  const tips = (): string => {
    const touch = matchMedia('(pointer: coarse)').matches, compact = matchMedia('(max-width: 980px), (max-height: 540px)').matches;
    const rows: [keyof typeof ICONS, string][] = [
      ['move', touch ? '<b>Drag</b> to move about, <b>pinch</b> to zoom.' : '<b>Drag</b> to move about, <b>scroll</b> to zoom.'],
      ['tap', `<b>${touch ? 'Tap' : 'Click'} a planet</b> for its story; ${touch ? 'double-tap' : 'double-click'} to fly in.`],
      ['look', 'Switch between <b>In motion</b> and <b>From above</b>, in ten <b>visual styles</b>.'],
      ['moments', 'Jump to <b>key moments</b>: Apollo 11, Voyager, the next Mars window.'],
      ['pace', `Change the <b>speed</b>; the <b>trails</b>’ length and strength are ${compact ? 'under <b>More</b>' : 'in the dock'}.`],
      ['travel', '<b>Your travels</b>: how far you have come since your birthday.'],
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
      const focusable = [go, guide];
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
