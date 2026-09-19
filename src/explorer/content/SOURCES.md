# Where the explorer's figures come from

Every number the Solar System Explorer shows was checked against the sources below in September 2026.
Figures are rounded for reading, "~" marks an approximation, and anything that keeps changing (moon counts, satellite counts, spacecraft distances) carries its date.
When updating a figure, check the primary source again rather than a secondary page.

## Positions on a date

- Planets: E. M. Standish, "Approximate Positions of the Planets", JPL Solar System Dynamics, Tables 2a and 2b (fitted 3000 BC to AD 3000), copied verbatim into `src/scenes/solar/ephemeris.ts`: https://ssd.jpl.nasa.gov/planets/approx_pos.html
- Pluto: the same page's former Table 1 row (1800 to 2050), from the archived text file: https://web.archive.org/web/2020/https://ssd.jpl.nasa.gov/txt/p_elem_t1.txt
- The Moon: J. Meeus, "Astronomical Algorithms", 2nd ed., ch. 47, the thirteen largest longitude terms, carried from the equinox of date to J2000 with the general precession of 5,028.83 arcseconds a century (https://ssd.jpl.nasa.gov/astro_par.html).
- Checks in `tests/sky.test.ts`: the 2020 great conjunction, the 2003 and 2025 Mars oppositions, the 2012 transit of Venus, the new Moon of the 8 April 2024 eclipse and the full Moon of 18 September 2024.

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

## How far you have travelled

- Earth's spin: the WGS 84 equatorial radius, 6,378.137 km, and the sidereal day, 23 h 56 min 4.0905 s (86,164.0905 s), give ~0.465 km/s (~1,674 km/h) at the equator, scaled by the cosine of the latitude: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
- Earth's orbit: mean orbital velocity 29.78 km/s and the sidereal year of 365.256 days, from the same NASA Earth fact sheet.
- The Sun round the Milky Way: ~230 km/s, one lap every ~230 million years; estimates run from ~220 to ~250 km/s (Reid et al. 2019, https://arxiv.org/abs/1910.03357, give 236 km/s for the circular speed there plus the Sun's own motion).
- Against the cosmic microwave background: 369.82 ± 0.11 km/s towards galactic longitude 264°, latitude 48° (Leo and Crater), from the Planck 2018 results I, https://arxiv.org/abs/1807.06205.
- The card measures each motion against its own reference and never adds them: they point in different directions, and the motion against the microwave background already includes the others.

## Your age on every planet

- Sidereal years (one lap against the stars) from NASA's planetary fact sheets (https://nssdc.gsfc.nasa.gov/planetary/factsheet/): Mercury 87.97 days, Venus 224.70, Earth 365.256, Mars 686.98; Jupiter 11.862 years, Saturn 29.457, Uranus 84.02 and Neptune 164.8 (Julian years of 365.25 days).
- Your age on a planet is the days you have lived divided by its year, which is also how many times it has gone round the Sun since you were born; your next birthday there is the next whole lap.
- The life's helix draws the Earth's wake back to the day you were born at the real positions of every date (JPL mean elements, as everywhere in the explorer), one coil a year.
