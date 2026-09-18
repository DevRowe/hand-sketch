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

## Jump to

- Mars windows: NASA TM-2010-216764, the Mars trajectory handbook (https://ntrs.nasa.gov/citations/20100037210); after 2029 the explorer computes the ideal Hohmann alignment.
- Encounter dates and times: NASA and ESA mission pages, cross-checked with JPL Horizons spacecraft trajectories (https://ssd.jpl.nasa.gov/horizons/).
- JUICE's September 2026 Earth flyby date is from ESA's trajectory as loaded in Horizons; ESA's own pages say only "September 2026".
- Voyager 1 at one light-day, 18 November 2026: https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/
- Mars close approaches: JPL Horizons; the 2003 record and its 2287 successor from NASA (https://science.nasa.gov/asset/hubble/hubbles-closest-view-of-mars-august-27-2003/).
- The great conjunction: https://www.nasa.gov/solar-system/the-great-conjunction-of-jupiter-and-saturn/
- Transits of Venus: https://eclipse.gsfc.nasa.gov/transit/venus0412.html
- Planet parades: https://science.nasa.gov/solar-system/skywatching/planetary-alignments-and-planet-parades/
