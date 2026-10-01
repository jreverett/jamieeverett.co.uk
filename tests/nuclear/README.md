# Baseload simulator

The game is served at `/nuclear/`. Gatsby copies `static/nuclear/` into its output without a separate build. It uses native JavaScript modules, Canvas 2D and SVG. There are no added runtime dependencies or external data requests. Fonts come from the site's existing font files.

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

Screenshots are written to the system temporary directory. Tests cover controls, pause, difficulty, saved state, news timing, visible plume changes, emergency lighting, shutdown/restart, camera direction, motion settings, reset and responsive layouts.

## Behaviour

- The fictional calendar begins at 06:00 on 1 October 2026. One day takes 15 minutes at 1×. The simulation stops when the tab is hidden.
- Reactor heat, steam availability, condenser temperature and generator output have separate response times. Cooling pumps consume power. Low cooling can cause a recoverable automatic shutdown. There is no equipment wear.
- Weather, daily peaks, weekends, season and scheduled news contribute to demand. News and the forecast use the same event data.
- Difficulty changes the permitted output error and news event size. There is no financial penalty or game-over state.
- The renderer is capped at 30 frames per second and a 1.5 pixel ratio. Reduced motion stops flow effects, rotor motion and rain animation. Local storage keeps the current shift; unavailable storage does not prevent play.
- The thermal model is intentionally qualitative. It does not calculate neutron kinetics, real reactor pressures or licensed operating procedures. Excess steam is implicitly bypassed; it does not accumulate pressure. Emergency building lighting is a visual game convention, not a model of a station's electrical protection system.

The basic separation of reactor, steam turbine and cooling systems follows the [NRC explanation of pressurised water reactors](https://www.nrc.gov/reactors/power/pwrs).
