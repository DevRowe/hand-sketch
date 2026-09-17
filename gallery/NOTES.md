# Many Hands: notes

Twenty hand-drawn animations on the hand-sketch engine, each in its own visual language.
Open `board.html` from this folder over any static server (`python3 -m http.server`); the sources are `src/scenes/gallery/`, regenerated with `npm run gallery`.

## The twenty

| | piece | theme | style | how it lives |
|---|---|---|---|---|
| G01 | Rolling Sea | the sea | woodblock | starts whole; five bands of curling waves roll in parallax, a boat of rowers rides the swell |
| G02 | Bamboo Wind | wind | sumi brush | starts whole; gusts bend the culms (pinned-wobble morph), leaves shiver and tear loose |
| G03 | Orrery | the cosmos | blueprint | draws on as a drafted blueprint, then spins up from rest into a steady machine |
| G04 | Night City | cities | riso poster | starts whole; windows switch, a lit train crosses, the river repeats it upside down |
| G05 | Fiddlehead | plants growing | cyanotype | grows: a crozier unrolls into a frond as a sun-print shadow |
| G06 | Murmuration | creatures | stipple | starts whole; a flock of 2600 dots pours through shapes over a stippled dusk |
| G07 | Lamplight | light and shadow | etching | starts whole; a swinging lamp moves the cross-hatched tone and every shadow |
| G08 | Sea Chart | maps and journeys | etching (sepia chart) | draws on as the chart inks itself; a ship sails a closed voyage leaving its wake |
| G09 | Rain Window | weather | watercolour | starts whole; drops run down the panes, headlights pass, steam rises |
| G10 | Snow Fox | winter | woodblock (linocut) | starts whole; snow falls through the carved black, the fox breathes and twitches |
| G11 | Aurora | the night sky | pastel on black | starts whole; curtains ripple and pulse over mountains and a mirror lake |
| G12 | Jellyfish | the deep | pastel on black | starts whole; three bells pulse at their own rates, tentacles trailing their own history |
| G13 | Ring Dance | dance | cut paper | starts whole; five Matisse figures dance in a turning ring, every hand holding the next |
| G14 | Paper Theatre | dreams | cut paper | starts whole; a toy theatre sea on sticks, a moon on a thread, stars that twirl |
| G15 | Truchet | geometric rhythm | Bauhaus | starts whole; waves of quarter turns break and rejoin the black paths |
| G16 | Four Beats | music | Bauhaus | starts whole; a playhead crosses a Kandinsky score and each shape answers its note |
| G17 | Moon Tides | the moon and the sea | art deco | starts whole; the moon runs a month, the scalloped sea breathes with it, a sheen crosses the gold |
| G18 | Fire Mountain | fire and earth | riso poster | starts whole; the volcano smokes and glows, palms sway, the sun's road shivers |
| G19 | Cyclist | motion | continuous line | draws on in one pen, then rides: parallax hills, poles and turning wheels |
| G20 | Koi | water | sumi brush | starts whole; two koi circle like a yin-yang, bodies bending along their own paths |

Sixteen start whole and live by motion; four draw on (Orrery, Fiddlehead, Sea Chart, Cyclist), because in those the drawing, the growing or the inking is the idea.

## Twelve visual treatments

- Woodblock: flat colour blocks, a key block printed out of register, woodgrain printed through (G01 indigo ukiyo-e, G10 black and vermilion linocut with lens-shaped gouge cuts).
- Sumi brush: loaded variable-width strokes with dry-brush breakup on rice paper, a vermilion seal (G02, G20).
- Blueprint and cyanotype: white on Prussian blue, one a draughtsman's line drawing with construction and dimensions, one a photogram's soft shadow on a hand-brushed coating (G03, G05).
- Riso poster: three or four fluorescent plates, each solid plus page-locked halftone at its own screen angle, misregistered and multiplied (G04 cool city, G18 warm island).
- Stipple: every tone, sky, reeds and flock, is dots (G06).
- Etching: page-locked cross-hatching bitten in layers, a hand-laid honey tint; and its cousin, sepia cartography on foxed vellum (G07, G08).
- Watercolour: glazes with pigment gathered at the edge, wet-into-wet outside the glass, granulation (G09).
- Pastel on black: strokes broken by the paper's tooth and bloomed (G11, G12).
- Cut paper: flat scissor-cut sheets with shadows, one after Matisse, one a layered toy theatre (G13, G14).
- Bauhaus: primaries and pure geometry, a screen-printed grid and a Kandinsky score (G15, G16).
- Art deco: gold line on black lacquer with a travelling sheen (G17).
- Continuous line: one black line of one weight and one red sun (G19).

Each treatment has its own palette in `src/scenes/gallery/palettes.ts`; none of the Keystone or poetic presets is reused.

## Craft notes

- Every loop is seamless and checked (`--seam`), and every piece renders byte-identically across independent page loads (`--verify`).
- Motion is periodic by construction: bands move exactly one pattern length, emitters wrap, rings turn whole turns, and anything that looks back along a path (tentacles, koi spines) reads the same periodic function a little earlier.
- Tones never swim: halftone dots, hatch lines and stipple are locked to the page while the shapes they fill move.

## Picks

The strongest, in my view: Snow Fox (G10), Aurora (G11), Jellyfish (G12), Rolling Sea (G01, the hero), Moon Tides (G17) and Paper Theatre (G14).
