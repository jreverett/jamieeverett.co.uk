# Baseload simulator

The game is served at `/nuclear/`. Gatsby copies `static/nuclear/` into its output without a separate build. It uses native JavaScript modules, Canvas 2D and a DOM-based instrument panel. There are no added runtime dependencies or external data requests. Fonts come from the site's existing font files.

## Local preview

From the site repository:

```sh
python3 -m http.server 4178 --bind 127.0.0.1 --directory static
```

Open `http://127.0.0.1:4178/nuclear/`.

## Verification

```sh
npm run test:nuclear
```

The browser checks require Playwright and its Chromium browser. Set `PLAYWRIGHT_MODULE` to an installed Playwright module if it is not available in this repository. `SIMULATOR_URL` can point at a deployment; it defaults to the local URL above.

```sh
node tests/nuclear/browser.mjs
```

Screenshots are written to the system temporary directory. Tests cover independent rod banks, channel power, pump faults, pressure relief, water starvation and recovery, alarm acknowledgement and escalation, fixed difficulty, the tutorial, save migration, the news feed, visual effects and responsive layouts.

## Behaviour

- The fictional calendar begins at 06:00 on 1 October 2026. One day takes 15 minutes at 1×. The simulation stops when the tab is hidden.
- Three independent rod banks set reactor heat. The fuel-channel monitor shows their delayed response and spatial power distribution. Uneven banks raise the hottest channel temperature.
- Two primary pumps carry heat away. Cooling flow removes waste heat. Automatic feedwater maintains drum level; manual feed can overfill or starve it. Closing the turbine raises pressure, while the bypass relieves pressure and reduces electrical output.
- High channel temperature, high steam pressure or low drum level cause recoverable shutdowns. The restart interlock checks temperature, pressure, water and pump availability. There is no equipment wear.
- Eight warning tiles show normal, caution and alarm states. Acknowledgement stops flashing but never clears a fault. A severity increase starts a new unacknowledged alarm. Optional sound is off by default.
- Weather, daily peaks, weekends, season and scheduled news contribute to demand. News and the forecast use the same event data.
- Difficulty is selected before a new shift and cannot change during that shift. It changes the permitted output error and news event size. Continuing a save retains its original difficulty. There is no financial penalty or game-over state.
- A six-step briefing highlights controls while physics is paused. It can be skipped or replayed with the help button. The news ticker pauses on hover/focus and has a readable expanded view.
- The renderer is capped at 30 frames per second and a 1.5 pixel ratio. Reduced motion stops warning flashes, ticker motion and rain animation. Local storage keeps the current shift; unavailable storage does not prevent play.
- The thermal model is intentionally qualitative. It does not calculate neutron kinetics, real reactor pressures or licensed operating procedures. Steam pressure and drum level use simplified game dynamics, not engineering units suitable for real operation. Emergency building lighting is a visual game convention, not a model of a station's electrical protection system.

The basic separation of reactor, steam turbine and cooling systems follows the [NRC explanation of pressurised water reactors](https://www.nrc.gov/reactors/power/pwrs).

Version 1 saves migrate to balanced rod banks and automatic feedwater. Version 2 retains the same storage key so existing players can continue.
