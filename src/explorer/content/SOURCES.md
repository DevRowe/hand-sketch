# Where the explorer's figures come from

Every number the Solar System Explorer shows was checked against the sources below in September 2026.
Figures are rounded for reading, "~" marks an approximation, and anything that keeps changing (moon counts, satellite counts, spacecraft distances) carries its date.
When updating a figure, check the primary source again rather than a secondary page.

## Positions on a date

- Planets: E. M. Standish, "Approximate Positions of the Planets", JPL Solar System Dynamics, Tables 2a and 2b (fitted 3000 BC to AD 3000), copied verbatim into `src/scenes/solar/ephemeris.ts`: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Pluto: the same page's former Table 1 row (1800 to 2050), from the archived text file: https://web.archive.org/web/2020/https://ssd.jpl.nasa.gov/txt/p_elem_t1.txt
- The Moon: J. Meeus, "Astronomical Algorithms", 2nd ed., ch. 47, the thirteen largest longitude terms, carried from the equinox of date to J2000 with the general precession of 5,028.83 arcseconds a century (https://ssd.jpl.nasa.gov/astro_par.html).
- Checks in `tests/sky.test.ts`: the 2020 great conjunction, the 2003 and 2025 Mars oppositions, the 2012 transit of Venus, the new Moon of the 8 April 2024 eclipse and the full Moon of 18 September 2024.

## The sky from Earth (the Sky menu)

- Look up tonight: elongations from the same JPL mean elements and Meeus Moon as the positions; brightness from the 1984 Astronomical Almanac magnitude formulas in J. Meeus, "Astronomical Algorithms", 2nd ed., ch. 41, with Saturn's ring tilt from ch. 45. A planet within ~15° of the Sun (Venus ~10°, the Moon ~12°) counts as lost in the glare; the words (east or west, high or low) hold for either hemisphere. Checks in `tests/skywatch.test.ts`: the 28 February 2025 parade (NASA: Saturn too low to see) and the sky of 19 September 2026 (Venus near its greatest brilliancy, Saturn and Neptune near opposition).
- Seasons: the Sun's apparent longitude from the ephemeris, moved from the Earth-Moon barycentre to the Earth's centre and corrected for precession, nutation and aberration (Meeus ch. 22 and 25); solstices and equinoxes come out within ~15 minutes of the US Naval Observatory's times for 2024 and 2025. Day lengths use the standard sunrise altitude of -0.833° (Meeus ch. 15). Perihelion and aphelion distances: NASA's Earth fact sheet.
- New and full Moons: found from the Meeus Moon, within ~10 minutes of the published times (checked against the full Moons of 18 September 2024 and 26 September 2026).
- Eclipses: dates, times and durations from NASA's eclipse catalogue (F. Espenak, https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html), with the 2 August 2027 path and its 6 min 23 s from https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE2027Aug02Tgoogle.html. The Moon's shadow is drawn from the model (Meeus's Moon with its latitude, the Sun and Moon radii 695,700 km and 1,737.4 km): it finds the 2023, 2024, 2026, 2027 and 2028 eclipses as total or annular, and the 2027 axis ~1,000 km from the Earth's centre (NASA's gamma 0.142, ~900 km).
- Comets: osculating elements from JPL's Small-Body Database (https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html): 1P/Halley (epoch 1994) and 3I/ATLAS (C/2025 N1). Halley's perihelion dates 1531 to 2134 from D. K. Yeomans and T. Kiang (1981), as JPL and NASA quote them; each lap is timed between two of them. 3I/ATLAS's facts from NASA (https://science.nasa.gov/solar-system/comets/3i-atlas/3i-atlas-facts-and-faqs/) and ESA; the model reproduces its passes of Mars (28.9 million km, 3 October 2025), the Earth (1.80 au, 19 December 2025) and Jupiter (53.6 million km, 16 March 2026), and Halley's of the Earth in May 1910 (0.15 au) and April 1986 (0.42 au). Halley's expected brightness in 2061 from NASA's Halley page (https://science.nasa.gov/solar-system/comets/1p-halley/), its 2134 pass of the Earth from the Small-Body Database's close-approach table.

## Fact cards

- Diameters, masses, gravity, distances, periods, days, temperatures, tilts and speeds: NASA NSSDCA planetary fact sheets (read from Internet Archive copies while the site is offline): https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Moon counts (Jupiter 115, Saturn 293, Uranus 29 as of August 2026; Neptune 16): https://science.nasa.gov/jupiter/jupiter-moons/ and the Saturn, Uranus and Neptune pages, with JPL's list of recognised satellites: https://ssd.jpl.nasa.gov/sats/discovery.html
- Fun facts: the NASA Science pages for each body (https://science.nasa.gov/solar-system/), with the Great Red Spot's history from Simon et al. 2024 (https://iopscience.iop.org/article/10.3847/PSJ/ad71d1).

## Guide

- Moons: JPL satellite physical parameters (https://ssd.jpl.nasa.gov/sats/phys_par/) and NASA's moon pages.
- Satellites: CelesTrak element sets of 17-18 September 2026 for the ISS and Hubble altitudes; NASA's ISS facts; the US Coast Guard NAVCEN GPS constellation status; Jonathan McDowell's statistics for Starlink and active satellites (https://planet4589.org/space/stats/active.html).
- Spaceflight: NASA SP-4029 "Apollo by the Numbers" for Apollo dates; NASA's Artemis II mission release; NASA, ESA and JPL mission pages for everything else.
- The Sun's galactic orbit: Reid et al. 2019 (https://arxiv.org/abs/1910.03357), GRAVITY 2022 (https://arxiv.org/abs/2112.07478) and NASA's Sun facts.

## The Earth and Moon view

- The Moon's latitude and distance: J. Meeus, "Astronomical Algorithms", 2nd ed., ch. 47, the largest terms of Tables 47.A and 47.B (checked against Meeus's example 47.a to ~15 km and ~0.002 degrees in `tests/cislunar.test.ts`); the Earth's spin from Greenwich mean sidereal time, Meeus eq. 12.4.
- Coastlines: Natural Earth 1:110m land, public domain, simplified by `scripts/cislunar-land.mjs`: https://www.naturalearthdata.com
- Orbit heights, tilts and speeds: NASA's ISS facts (https://www.nasa.gov/international-space-station/space-station-facts-and-figures/), GPS.gov (https://www.gps.gov/space-segment), the Kármán line and US 50-mile boundary as the FAI and NASA state them, and the stations' and satellites' own NASA, CMSA, ESA and Roscosmos records (with Wikipedia's mission pages for cross-checks).
- The Moon's distance, sizes and months: NASA's Moon facts (https://science.nasa.gov/moon/facts/).
- Crowds over the years: Jonathan McDowell's catalogue, sampled on 1 January of each year: working satellites in geosynchronous orbit (https://planet4589.org/space/stats/out/orbdeb.geo.txt), Starlink in orbit (https://planet4589.org/space/con/star/stats.html) and all working satellites (https://planet4589.org/space/stats/active.html), as of 17 September 2026. GPS counts before 1993 are counted from launch and retirement dates.
- Flight times: the Apollo Flight Journal (https://www.apollojournals.org/afj/) and NASA's mission pages for Mercury, Gemini and Apollo; NASA's Artemis I, II and III releases (Artemis II's record: https://www.nasa.gov/news-release/nasas-artemis-ii-crew-eclipses-record-for-farthest-human-spaceflight; Artemis III: https://www.nasa.gov/news-release/nasa-marches-toward-artemis-iii-mission-in-2027-names-crew-members/). Distance records are from the Earth's surface, as NASA quotes them.
- Plans (Artemis III and IV, Gateway's pause, the ISS deorbit, commercial stations, China's crewed landing) as of September 2026: NASA, ESA, CMSA and company releases; they are labelled as plans in the cards.
- Paths are representative: real dates, heights and tilts joined by simple Kepler orbits (`src/explorer/trajectories.ts`); where a station is along its orbit on a date is illustrative.

## Jump to

- Mars windows: NASA TM-2010-216764, the Mars trajectory handbook (https://ntrs.nasa.gov/citations/20100037210); after 2029 the explorer computes the ideal Hohmann alignment.
- Encounter dates and times: NASA and ESA mission pages, cross-checked with JPL Horizons spacecraft trajectories (https://ssd.jpl.nasa.gov/horizons/).
- JUICE's September 2026 Earth flyby date is from ESA's trajectory as loaded in Horizons; ESA's own pages say only "September 2026".
- Voyager 1 at one light-day, 18 November 2026: https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/
- Mars close approaches: JPL Horizons; the 2003 record and its 2287 successor from NASA (https://science.nasa.gov/asset/hubble/hubbles-closest-view-of-mars-august-27-2003/).
- The great conjunction: https://www.nasa.gov/solar-system/the-great-conjunction-of-jupiter-and-saturn/
- Transits of Venus: https://eclipse.gsfc.nasa.gov/transit/venus0412.html
- Planet parades: https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/

## Beyond Neptune and Scale (the Scale menu)

- Pluto: its place from the JPL mean elements above (the Pluto row), its distance measured in the planets' plane for the plan; its figures from NASA's Pluto fact sheet (https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html) and NASA's Pluto pages (https://science.nasa.gov/dwarf-planets/pluto/).
- The Kuiper belt: NASA's Kuiper belt page (https://science.nasa.gov/solar-system/kuiper-belt/) for its extent and population and for Arrokoth; the dots are illustrative, a few hundred bodies at seeded places in the plutino (~39.4 au) and classical (~42 to ~48 au) ranges, each on a Kepler orbit.
- Sizes and distances in the line-up and the basketball model: NASA NSSDCA planetary fact sheets (equatorial diameters, mean distances from the Sun); Saturn's A ring reaches 136,775 km from its centre.
- Proxima Centauri at 4.2465 light-years (ESO, NASA); Voyager 1 one light-day out on 18 November 2026 (NASA, above), receding at ~3.57 au a year (~17 km/s).
- The Sun's path round the galaxy: the Guide's figures (Reid et al. 2019, GRAVITY 2022); ~20 km/s against the nearby stars (the standard solar motion, towards Hercules); the planets' plane is inclined ~60° to the galaxy's disc.
- How the plan cheats: worked out from the plan's own radii (`src/scenes/solar/common.ts`) against the true sizes and distances above.

## How far you have travelled

- Earth's spin: the WGS 84 equatorial radius, 6,378.137 km, and the sidereal day, 23 h 56 min 4.0905 s (86,164.0905 s), give ~0.465 km/s (~1,674 km/h) at the equator, scaled by the cosine of the latitude: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
- Earth's orbit: mean orbital velocity 29.78 km/s and the sidereal year of 365.256 days, from the same NASA Earth fact sheet.
- The Sun round the Milky Way: ~230 km/s, one lap every ~230 million years; estimates run from ~220 to ~250 km/s (Reid et al. 2019, https://arxiv.org/abs/1910.03357, give 236 km/s for the circular speed there plus the Sun's own motion).
- Against the cosmic microwave background: 369.82 ± 0.11 km/s towards galactic longitude 264°, latitude 48° (Leo and Crater), from the Planck 2018 results I, https://arxiv.org/abs/1807.06205.
- The card measures each motion against its own reference and never adds them: they point in different directions, and the motion against the microwave background already includes the others.

## Your age on every planet

- Sidereal years (one lap against the stars) from NASA's planetary fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/): Mercury 87.97 days, Venus 224.70, Earth 365.256, Mars 686.98; Jupiter 11.862 years, Saturn 29.457 and Neptune 164.8 (Julian years of 365.25 days); Uranus 30,685.4 days (84.01 years).
- Your age on a planet is the days you have lived divided by its year, which is also how many times it has gone round the Sun since you were born; your next birthday there is the next whole lap.
- The life's helix draws the Earth's wake back to the day you were born at the real positions of every date (JPL mean elements, as everywhere in the explorer), one coil a year.
