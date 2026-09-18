/**
 * The shot list: every cut of the film's montage at its film timecode, and the etching that stands in for it.
 *
 * The times are the film's own editing rhythm: the 91 hard cuts detected in the source plus the cuts the detector
 * missed (both kept in `catalog.json`, which a test holds this list to). The shots recur the way the film's do (the
 * pupil, the pill, the line, the cap, the cell) and heat up as the montage goes: the pupil opens wider each time, the
 * lump in the cap melts faster, the camera pushes harder.
 */
import type { Shot } from './etch';
import type { Cut, Frame } from './montage';
import { cellShot, fizzShot, vesselShot } from './shots/cell';
import { blackShot, coffeeShot } from './shots/coffee';
import { dollarShot } from './shots/dollar';
import { eyeShot } from './shots/eye';
import { palmShot, pinchShot, ringShot } from './shots/hands';
import { baggieShot, herbShot } from './shots/herb';
import { lighterShot } from './shots/lighter';
import { mouthShot } from './shots/mouth';
import { barrelShot, bottleShot, capShot, tableShot } from './shots/pills';
import { billRollShot, billShot, linesShot, powderShot } from './shots/powder';
import { saraShot } from './shots/sara';
import { tvShot } from './shots/tv';

const side = (a: Shot, b: Shot): Frame => ({ split: 'side', a, b });

// the recurring shots, one instance each so a repeat is the same plate
const cell = cellShot({ seed: 8101 }), cellB = cellShot({ seed: 8102, at: [760, 470], r: 320 });
const fizz = fizzShot({ seed: 8111 }), fizzB = fizzShot({ seed: 8112 });
const vessel = vesselShot({ seed: 8121 });
const powder = powderShot({ seed: 8131 });
const bill = billShot({ seed: 8141 });
const dollar = dollarShot({ seed: 8151 });
const barrel = barrelShot({ seed: 8161 }), barrelB = barrelShot({ seed: 8162 });
const capMacro = capShot({ act: 'macro', seed: 8171 }), capMacroB = capShot({ act: 'macro', seed: 8172 });
const capSide = capShot({ act: 'side', seed: 8173 });
const bottle = bottleShot({ cap: 'white', seed: 8181 }), bottleBlue = bottleShot({ cap: 'blue', seed: 8182 });
const pillCold = palmShot({ item: 'pill-cold', seed: 8191 }), pillWarm = palmShot({ item: 'pill-warm', seed: 8192 });
const ring = ringShot({ seed: 8201 });
const sara = saraShot({ seed: 8211 }), saraHair = saraShot({ seed: 8212, closeup: true });
const lighterThumb = lighterShot({ act: 'thumb', seed: 8221 }), lighterStrike = lighterShot({ act: 'strike', seed: 8222 }), flame = lighterShot({ act: 'flame', seed: 8223 });
const ahh = mouthShot({ act: 'ahh', seed: 8231 }), grin = mouthShot({ act: 'grin', seed: 8232 }), joint = mouthShot({ act: 'joint', seed: 8233 });
const lick = mouthShot({ act: 'lick', seed: 8234 }), exhale = mouthShot({ act: 'exhale', seed: 8235 });
const black = blackShot();
const eye = (k: number, iris: 'cold' | 'hazel' | 'warm'): Shot => eyeShot({ iris, from: 0.18 + 0.03 * k, to: 0.55 + 0.05 * k, seed: 8240 + k });

export const STORYBOARD: readonly Cut[] = [
  { at: 0, label: 'sara+table', frame: { split: 'stack', a: sara, b: tableShot({ seed: 8301 }) } },
  { at: 1.84, label: 'palm-pill', frame: pillCold },
  { at: 2.56, label: 'mouth-ahh', frame: ahh },
  { at: 2.96, label: 'ring', frame: ring },
  { at: 3.16, label: 'mouth-sip', frame: mouthShot({ act: 'sip', seed: 8302 }) },
  { at: 3.48, label: 'pinch-capsule', frame: pinchShot({ item: 'capsule', seed: 8303 }) },
  { at: 3.92, label: 'pinch-cube', frame: pinchShot({ item: 'cube', seed: 8304 }) },
  { at: 4.4, label: 'pinch-shard', frame: pinchShot({ item: 'shard', seed: 8305 }) },
  { at: 4.84, label: 'cell', frame: cell },
  { at: 5.32, label: 'cup', frame: coffeeShot({ act: 'cup', seed: 8306 }) },
  { at: 5.76, label: 'black', frame: black },
  { at: 5.8, label: 'dollar', frame: dollar },
  { at: 6.24, label: 'bill-roll', frame: billRollShot({ seed: 8307 }) },
  { at: 6.68, label: 'black', frame: black },
  { at: 6.76, label: 'powder', frame: powder },
  { at: 7.8, label: 'lines', frame: linesShot({ seed: 8308 }) },
  { at: 8.08, label: 'bill', frame: bill },
  { at: 9, label: 'vessel', frame: vessel },
  { at: 9.44, label: 'eye', frame: eye(0, 'hazel') },
  { at: 9.88, label: 'papers', frame: herbShot({ act: 'pack', seed: 8309 }) },
  { at: 10.4, label: 'crumble', frame: herbShot({ act: 'crumble', seed: 8310 }) },
  { at: 10.88, label: 'pile', frame: herbShot({ act: 'pile', seed: 8311 }) },
  { at: 11.4, label: 'roll', frame: herbShot({ act: 'roll', seed: 8312 }) },
  { at: 11.88, label: 'mouth-lick', frame: lick },
  { at: 12.4, label: 'baggie', frame: baggieShot({ seed: 8313 }) },
  { at: 12.88, label: 'black', frame: black },
  { at: 12.96, label: 'flame', frame: flame },
  { at: 13.4, label: 'mouth-joint', frame: joint },
  { at: 13.88, label: 'bottle', frame: bottle },
  { at: 14.32, label: 'palm-pill', frame: pillCold },
  { at: 14.72, label: 'bottle-cap', frame: bottleBlue },
  { at: 14.84, label: 'ring', frame: ring },
  { at: 15.16, label: 'split-pinch-grin', frame: side(pinchShot({ item: 'tablet', seed: 8314 }), grin) },
  { at: 15.56, label: 'split-cell', frame: side(cell, cellB) },
  { at: 16, label: 'split-pill-cap', frame: side(pillWarm, capMacro) },
  { at: 16.4, label: 'split-pinch-cap', frame: side(pinchShot({ item: 'capsule', seed: 8315 }), capSide) },
  { at: 16.84, label: 'split-cup-fizz', frame: side(coffeeShot({ act: 'cup', seed: 8316 }), fizz) },
  { at: 17.24, label: 'split-flash', frame: side(black, barrel) },
  { at: 17.28, label: 'split-sara-barrel', frame: side(saraHair, barrel) },
  { at: 17.68, label: 'split-powder-ring', frame: side(powder, ring) },
  { at: 18.08, label: 'split-powder-fizz', frame: side(powder, fizzB) },
  { at: 18.48, label: 'split-bill-barrel', frame: side(bill, barrelB) },
  { at: 18.92, label: 'split-vessel', frame: side(vessel, vesselShot({ seed: 8317 })) },
  { at: 19.36, label: 'bottle-cap', frame: bottleBlue },
  { at: 19.76, label: 'bottle-cap', frame: bottleShot({ cap: 'blue', seed: 8318 }) },
  { at: 20.16, label: 'remote', frame: tvShot({ act: 'remote', seed: 8319 }) },
  { at: 20.6, label: 'visual-power', frame: tvShot({ act: 'button', seed: 8320 }) },
  { at: 20.96, label: 'mouth-grin', frame: grin },
  { at: 21.36, label: 'cell', frame: cell },
  { at: 21.8, label: 'fizz', frame: fizz },
  { at: 22.2, label: 'sara-hair', frame: saraHair },
  { at: 22.64, label: 'ring', frame: ring },
  { at: 23.04, label: 'eye', frame: eye(1, 'cold') },
  { at: 23.48, label: 'pinch-cube', frame: pinchShot({ item: 'cube', seed: 8304 }) },
  { at: 23.88, label: 'dollar', frame: dollar },
  { at: 24.28, label: 'powder', frame: powder },
  { at: 24.72, label: 'bill', frame: bill },
  { at: 25.12, label: 'vessel', frame: vessel },
  { at: 25.56, label: 'eye', frame: eye(2, 'hazel') },
  { at: 25.96, label: 'sara-hair', frame: saraHair },
  { at: 26.4, label: 'palm-pill', frame: pillCold },
  { at: 26.8, label: 'mouth-ahh', frame: ahh },
  { at: 27.04, label: 'bottle-cap', frame: bottleBlue },
  { at: 27.64, label: 'cap', frame: capMacro },
  { at: 28.04, label: 'powder', frame: powder },
  { at: 28.16, label: 'grounds', frame: coffeeShot({ act: 'grounds', seed: 8321 }) },
  { at: 28.48, label: 'carafe', frame: coffeeShot({ act: 'carafe', seed: 8322 }) },
  { at: 28.88, label: 'pour', frame: coffeeShot({ act: 'pour', seed: 8323 }) },
  { at: 29.72, label: 'mouth-cup', frame: mouthShot({ act: 'cup', seed: 8324 }) },
  { at: 30.64, label: 'mouth-grin', frame: grin },
  { at: 31.16, label: 'cell', frame: cell },
  { at: 31.64, label: 'lighter', frame: lighterThumb },
  { at: 32.16, label: 'fizz', frame: fizz },
  { at: 32.64, label: 'barrel', frame: barrel },
  { at: 33.16, label: 'eye', frame: eye(3, 'cold') },
  { at: 33.56, label: 'mouth-exhale', frame: exhale },
  { at: 34.08, label: 'cap-side', frame: capSide },
  { at: 34.56, label: 'cap', frame: capMacro },
  { at: 35.08, label: 'barrel', frame: barrel },
  { at: 35.56, label: 'vessel', frame: vessel },
  { at: 36.08, label: 'eye', frame: eye(4, 'warm') },
  { at: 36.48, label: 'split-pill-pinch', frame: side(pillWarm, pinchShot({ item: 'tablet', seed: 8314 })) },
  { at: 36.92, label: 'split-cell', frame: side(cell, cellB) },
  { at: 37.36, label: 'split-cap', frame: side(capMacro, capMacroB) },
  { at: 37.76, label: 'split-cap-side', frame: side(capSide, capSide) },
  { at: 38.2, label: 'split-cap', frame: side(capMacroB, capMacro) },
  { at: 38.6, label: 'split-lighter', frame: side(lighterStrike, flame) },
  { at: 39.04, label: 'split-fizz', frame: side(fizz, fizzB) },
  { at: 39.4, label: 'split-cap', frame: side(capMacro, capMacroB) },
  { at: 39.84, label: 'split-barrel', frame: side(barrel, barrelB) },
  { at: 40.28, label: 'split-lighter', frame: side(flame, lighterThumb) },
  { at: 40.68, label: 'split-screen', frame: side(tvShot({ act: 'glow', seed: 8325 }), tvShot({ act: 'glow', seed: 8326 })) },
  { at: 41.12, label: 'split-hands', frame: side(ring, pillWarm) },
  { at: 41.52, label: 'split-barrel', frame: side(barrelB, barrel) },
  { at: 41.76, label: 'mouth-grin', frame: grin },
  { at: 42.16, label: 'crumble', frame: herbShot({ act: 'crumble', seed: 8327 }) },
  { at: 42.6, label: 'palm-herb', frame: palmShot({ item: 'herb', seed: 8328 }) },
  { at: 43, label: 'peel', frame: herbShot({ act: 'peel', seed: 8329 }) },
  { at: 43.84, label: 'roll', frame: herbShot({ act: 'roll', seed: 8330 }) },
  { at: 44.28, label: 'mouth-lick', frame: lick },
  { at: 44.68, label: 'mouth-joint', frame: joint },
  { at: 45.52, label: 'lighter', frame: lighterThumb },
  { at: 45.64, label: 'strike', frame: lighterStrike },
  { at: 45.92, label: 'mouth-joint', frame: joint },
  { at: 46.36, label: 'baggie', frame: baggieShot({ seed: 8331 }) },
  { at: 46.76, label: 'exhale-to-black', frame: mouthShot({ act: 'exhale', seed: 8235, fade: true }) },
];
