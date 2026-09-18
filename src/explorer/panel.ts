/**
 * The side panel (a bottom sheet on phones): fact cards for the bodies, the guide, and the jump-to presets.
 */
import { BODY_NAMES, type App, type Selection } from './app';

export interface PanelHooks {
  toast(text: string): void;
}

type Mode = { kind: 'body'; id: NonNullable<Selection> } | { kind: 'guide' } | { kind: 'jump' } | { kind: 'preset'; id: string };

export class Panel {
  private readonly el = document.getElementById('panel') as HTMLElement;
  private readonly title = document.getElementById('panel-title') as HTMLElement;
  private readonly eyebrow = document.getElementById('panel-eyebrow') as HTMLElement;
  private readonly body = document.getElementById('panel-body') as HTMLElement;
  private mode: Mode | null = null;
  /** The preset on show, for the address bar. */
  preset: string | null = null;

  constructor(private readonly app: App, private readonly hooks: PanelHooks) {
    document.getElementById('panel-close')!.addEventListener('click', () => this.close());
  }

  private show(mode: Mode, eyebrow: string, title: string, html: string): void {
    this.mode = mode;
    this.preset = mode.kind === 'preset' ? mode.id : null;
    this.eyebrow.textContent = eyebrow;
    this.title.textContent = title;
    this.body.innerHTML = html;
    this.body.scrollTop = 0;
    this.el.hidden = false;
    document.body.classList.add('panel-open');
    for (const id of ['jump-btn', 'guide-btn']) document.getElementById(id)!.setAttribute('aria-expanded', String((mode.kind === 'jump' || mode.kind === 'preset') === (id === 'jump-btn') && mode.kind !== 'body' && !(mode.kind === 'guide' && id === 'jump-btn')));
  }

  openBody(id: NonNullable<Selection>): void {
    this.show({ kind: 'body', id }, id === 'sun' ? 'Our star' : id === 'moon' ? "Earth's moon" : id === 'belt' ? 'Between Mars and Jupiter' : 'Planet', BODY_NAMES[id], '<p>Facts coming soon.</p>');
  }

  openGuide(): void { this.show({ kind: 'guide' }, 'Guide', 'The solar system', '<p>Guide coming soon.</p>'); }

  openJump(): void { this.show({ kind: 'jump' }, 'Jump to', 'Key moments', '<p>Presets coming soon.</p>'); }

  openPreset(id: string): void { this.show({ kind: 'preset', id }, 'Jump to', id, ''); }

  /** Close the panel; false when it was not open. */
  close(): boolean {
    if (this.el.hidden) return false;
    this.el.hidden = true;
    this.mode = null;
    this.preset = null;
    document.body.classList.remove('panel-open');
    for (const id of ['jump-btn', 'guide-btn']) document.getElementById(id)!.setAttribute('aria-expanded', 'false');
    return true;
  }

  /** Keep the open card in step with the app (the selected body may change under it). */
  refresh(): void {
    const m = this.mode;
    if (m?.kind === 'body' && this.app.selected && this.app.selected !== m.id) this.openBody(this.app.selected);
    void this.hooks;
  }
}
