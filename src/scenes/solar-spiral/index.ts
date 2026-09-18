/**
 * The spiral set, "One Wake, Ten Hands": the companion to the top-down solar set. The same solar system seen at an
 * angle while the Sun travels and every planet's orbit is drawn out into a helix (`common.ts`), in the same ten visual
 * languages, and its catalogue (title = the style, theme, line, format, poster policy, alt text) for delivery.
 */
import type { Scene } from '../../core/scene';
import type { SolarEntry } from '../solar';
import catalogJson from './catalog.json';
import { blueprintSpiral } from './sp01-blueprint';
import { woodblockSpiral } from './sp02-woodblock';
import { sumiSpiral } from './sp03-sumi';
import { etchingSpiral } from './sp04-etching';
import { risoSpiral } from './sp05-riso';
import { stippleSpiral } from './sp06-stipple';
import { pastelSpiral } from './sp07-pastel';
import { cutPaperSpiral } from './sp08-cut-paper';
import { bauhausSpiral } from './sp09-bauhaus';
import { decoSpiral } from './sp10-deco';

/** Entries have the top-down set's shape, so the two catalogues pair one to one. */
export const SPIRAL_CATALOG: readonly SolarEntry[] = catalogJson;

export const spiralScenes: Record<string, Scene> = Object.fromEntries([
  blueprintSpiral,
  woodblockSpiral,
  sumiSpiral,
  etchingSpiral,
  risoSpiral,
  stippleSpiral,
  pastelSpiral,
  cutPaperSpiral,
  bauhausSpiral,
  decoSpiral,
].map(s => [s.name, s]));
