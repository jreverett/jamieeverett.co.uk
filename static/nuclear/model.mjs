export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const START = Date.UTC(2026, 9, 1, 6);
export const MODES = {
  relaxed: { tolerance: 100, scale: 0.7 },
  standard: { tolerance: 65, scale: 1 },
  challenging: { tolerance: 35, scale: 1.25 },
};
export const MELTDOWN_TEMPERATURE = 700;
export function initialState(mode = "relaxed") {
  return {
    version: 3,
    briefed: false,
    rodInsertion: 42,
    rodPosition: 42,
    neutrons: 58,
    pump: true,
    feedAuto: true,
    feedwater: 65,
    water: 62,
    pressure: 60,
    bypass: false,
    scrammed: false,
    meltdown: false,
    minute: 0,
    reactor: 58,
    turbine: 72,
    cooling: 65,
    heat: 58,
    temperature: 291,
    steam: 58,
    output: 605,
    condenser: 31,
    breaker: true,
    mode: Object.hasOwn(MODES, mode) ? mode : "relaxed",
    speed: 1,
    paused: false,
    matched: 0,
    elapsed: 0,
    best: 0,
    history: [],
  };
}
export function environment(minute) {
  const date = new Date(START + minute * 60000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const day = Math.floor(minute / 1440);
  const cloud = clamp(
    0.48 + 0.34 * Math.sin(minute / 280) + 0.12 * Math.sin(minute / 91),
    0.08,
    0.98,
  );
  const wind = 16 + 11 * Math.sin(minute / 190 + 1);
  const temperature =
    11 + 5 * Math.sin(((hour - 8) / 24) * Math.PI * 2) + 3 * Math.sin(day / 3);
  return {
    date,
    hour,
    day,
    cloud,
    wind,
    temperature,
    solar:
      Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI)) * (1 - cloud) * 260,
    windPower: 45 + wind * 3,
  };
}
const stories = [
  {
    hour: 8,
    duration: 1.5,
    mw: 150,
    title: "National Turn On Your Kettle Day",
    body: "The nation has agreed to make tea at 08:00. Organisers deny this could have been an email.",
    hint: "Expect a sharp morning demand increase.",
  },
  {
    hour: 13,
    duration: 3,
    mw: 100,
    title: "Minister declares clouds a British industry",
    body: "The new anti-solar campaign asks households to cover their panels. Free tarpaulins arrive at 13:00.",
    hint: "Less rooftop solar means more demand for your plant.",
  },
  {
    hour: 18,
    duration: 2,
    mw: 180,
    title: "Bake-off final gets an extra-long tea break",
    body: "Broadcasters confirm a synchronised interval. The grid would like a quiet word.",
    hint: "Prepare for a larger evening peak.",
  },
  {
    hour: 10,
    duration: 3,
    mw: -130,
    title: "Green bill passes; rooftops celebrate",
    body: "Community solar comes online at 10:00. The ribbon-cutting ceremony will be solar powered, weather permitting.",
    hint: "Reduce output before the lunchtime surplus.",
  },
  {
    hour: 17,
    duration: 3,
    mw: 170,
    title: "Town votes to preheat every oven",
    body: "The first municipal roast dinner begins this evening. Gravy has been declared essential infrastructure.",
    hint: "A sustained evening increase is expected.",
  },
  {
    hour: 21,
    duration: 2,
    mw: -110,
    title: "National early night receives broad support",
    body: "Residents agree to switch off and go to bed. One man insists he is just resting his eyes.",
    hint: "Demand will fall faster than usual tonight.",
  },
];
export function events(minute) {
  const day = Math.floor(minute / 1440);
  const result = [];
  for (let d = Math.max(0, day - 1); d <= day + 2; d++) {
    for (const story of stories.slice(d % 2 ? 3 : 0, d % 2 ? 6 : 3)) {
      const at = d * 1440 + (story.hour - 6) * 60;
      result.push({ ...story, at, end: at + story.duration * 60 });
    }
  }
  return result.sort((a, b) => a.at - b.at);
}
export function demandAt(minute, mode = "relaxed") {
  const e = environment(minute);
  const peak = (centre, width) => Math.exp(-(((e.hour - centre) / width) ** 2));
  const weekend = [0, 6].includes(e.date.getUTCDay()) ? -65 : 0;
  const seasonal = 35 * Math.cos((e.date.getUTCMonth() / 12) * Math.PI * 2);
  const eventLoad = events(minute).reduce((sum, event) => {
    const envelope =
      clamp((minute - event.at) / 12, 0, 1) *
      clamp((event.end - minute) / 18, 0, 1);
    return sum + event.mw * envelope;
  }, 0);
  return clamp(
    620 +
      160 * peak(8, 2) +
      220 * peak(18.5, 2.7) +
      (12 - e.temperature) * 8 +
      seasonal +
      weekend -
      e.solar -
      e.windPower +
      eventLoad * MODES[mode].scale,
    260,
    1040,
  );
}
export function newsEvents(minute) {
  return events(minute)
    .filter((event) => event.end > minute && event.at <= minute + 180)
    .slice(0, 3);
}
export function pumpFlow(s) {
  return s.pump ? 1 : 0;
}
export function hotspot(s) {
  return s.temperature;
}
export function shutdown(s) {
  if (s.meltdown) return false;
  s.scrammed = true;
  s.rodInsertion = 100;
  return true;
}
export function restart(s) {
  if (s.meltdown || !s.scrammed) return false;
  s.scrammed = false;
  s.rodInsertion = 100;
  return true;
}
export function channelPower(s, row, col) {
  return clamp(s.heat * (1.07 - Math.hypot(row - 4, col - 4) * 0.035), 0, 100);
}
export function heatStage(s) {
  return s.meltdown
    ? "meltdown"
    : s.temperature >= 500
      ? "fire"
      : s.temperature >= 400
        ? "sparks"
        : s.temperature >= 340
          ? "hot"
          : "normal";
}
export function alarms(s) {
  const error = Math.abs(s.output - demandAt(s.minute, s.mode));
  return [
    {
      id: "core",
      label: "CORE TEMP",
      level: s.temperature > 400 ? 2 : s.temperature > 325 ? 1 : 0,
      value: `${Math.round(s.temperature)}°C`,
      action:
        "Insert control rods to reduce the reaction. Keep the coolant pump running and increase cooling. There is no automatic shutdown.",
    },
    {
      id: "rods",
      label: "CONTROL RODS",
      level: s.scrammed ? 1 : 0,
      value: s.scrammed
        ? "Emergency stop active"
        : `${Math.round(s.rodPosition)}% inserted`,
      action:
        "Fuel stays fixed. Control rods absorb neutrons: insert them for less power, withdraw them for more. Emergency Stop rapidly inserts all rods, but residual heat remains.",
    },
    {
      id: "pumps",
      label: "COOLANT FLOW",
      level: !s.pump ? 2 : s.cooling < s.heat * 0.65 ? 1 : 0,
      value: `${Math.round(pumpFlow(s) * s.cooling)}% flow`,
      action:
        "Run the coolant pump and increase cooling flow. Stopping the reaction does not instantly cool the fuel.",
    },
    {
      id: "pressure",
      label: "STEAM PRESSURE",
      level: s.pressure > 95 ? 2 : s.pressure > 82 ? 1 : 0,
      value: `${Math.round(s.pressure)} bar`,
      action:
        "Open the turbine or steam bypass. High pressure makes heat removal less effective. Insert control rods if pressure keeps rising.",
    },
    {
      id: "water",
      label: "WATER LEVEL",
      level: s.water < 25 ? 2 : s.water < 40 || s.water > 88 ? 1 : 0,
      value: `${Math.round(s.water)}% level`,
      action:
        "Select automatic feedwater, or increase manual feed. Low water reduces heat removal and can lead to meltdown. The reactor will not stop itself.",
    },
    {
      id: "condenser",
      label: "CONDENSER",
      level: s.condenser > 55 ? 2 : s.condenser > 40 ? 1 : 0,
      value: `${Math.round(s.condenser)}°C`,
      action:
        "Increase cooling flow. A hot condenser reduces electrical output. Close the bypass when pressure is safe.",
    },
    {
      id: "grid",
      label: "GRID OUTPUT",
      level: !s.breaker ? 2 : error > MODES[s.mode].tolerance ? 1 : 0,
      value: !s.breaker
        ? "Disconnected"
        : `${Math.round(s.output - demandAt(s.minute, s.mode))} MW difference`,
      action: !s.breaker
        ? "Close the grid breaker to export electricity."
        : "Adjust the turbine for a quick output change. Adjust control rod insertion for a sustained change.",
    },
    {
      id: "limit",
      label: "CORE LIMIT",
      level: s.temperature >= 500 ? 2 : s.temperature >= 400 ? 1 : 0,
      value: s.meltdown
        ? "MELTDOWN"
        : `${Math.max(0, Math.round(MELTDOWN_TEMPERATURE - s.temperature))}°C margin`,
      action: s.meltdown
        ? "The core has melted. This shift is over. Start a new shift to play again."
        : "Meltdown at 700°C ends this shift. Use Emergency Stop, run cooling and restore feedwater before the core reaches the limit. This is a fictional game threshold.",
    },
  ];
}
export function step(s, dt) {
  if (s.paused || s.meltdown) return s;
  let remaining = clamp(dt, 0, 0.25) * s.speed;
  while (remaining > 0 && !s.meltdown) {
    const tick = Math.min(remaining, 0.05);
    advance(s, tick);
    remaining -= tick;
  }
  return s;
}
function advance(s, dt) {
  s.minute += dt * 1.6;
  const air = environment(s.minute).temperature;
  const movement = (s.scrammed ? 65 : 5) * dt;
  s.rodPosition += clamp(s.rodInsertion - s.rodPosition, -movement, movement);
  s.reactor = 100 - s.rodPosition;
  const rodWorth = 58 * Math.exp((42 - s.rodPosition) / 22);
  const reactivity = clamp(
    (rodWorth - s.heat) * 0.006 - (s.temperature - 291) * 0.0003,
    -3,
    1.2,
  );
  const absorption = s.rodPosition > 90 ? (s.rodPosition - 90) * 0.3 : 0;
  s.neutrons = clamp(
    s.neutrons * Math.exp((reactivity - absorption) * dt) +
      (s.scrammed ? 0 : 0.01 * dt),
    0,
    2000,
  );
  s.heat +=
    (s.neutrons - s.heat) *
    (1 - Math.exp(-dt / (s.neutrons > s.heat ? 3 : 15)));
  const coolingCapacity = 6 + (6 + s.cooling * 1.35) * pumpFlow(s);
  const waterFactor = clamp((s.water - 5) / 35, 0.05, 1);
  const pressureFactor = clamp(1 - Math.max(0, s.pressure - 85) / 140, 0.4, 1);
  s.condenser +=
    (air +
      12 +
      s.steam * 0.32 +
      (s.bypass ? s.steam * 0.12 : 0) -
      s.cooling * 0.19 -
      s.condenser) *
    (1 - Math.exp(-dt / 20));
  const removal =
    Math.min(s.heat + Math.max(0, s.temperature - 290) * 0.9, coolingCapacity) *
    waterFactor *
    pressureFactor;
  s.temperature = clamp(
    s.temperature +
      (s.heat - removal) * dt * 0.18 +
      (275 + s.heat * 0.25 - s.temperature) * dt * 0.002 +
      Math.max(0, s.temperature - 500) * dt * 0.004,
    air,
    MELTDOWN_TEMPERATURE,
  );
  const available =
    Math.min(s.heat, coolingCapacity) *
    clamp(1 - Math.max(0, s.condenser - 35) / 65, 0.35, 1) *
    waterFactor;
  s.steam += (available - s.steam) * (1 - Math.exp(-dt / 8));
  const feed = s.feedAuto
    ? clamp(s.steam * 0.75 + (62 - s.water) * 2, 0, 100)
    : s.feedwater;
  s.water = clamp(s.water + (feed - s.steam * 0.75) * dt * 0.04, 0, 100);
  const valve = Math.min(1, s.turbine / 72);
  const target =
    10 +
    Math.min(1, s.steam / 30) * 50 +
    s.steam * (1 - valve) * 0.9 -
    (s.bypass ? 30 : 0);
  s.pressure += (Math.max(5, target) - s.pressure) * (1 - Math.exp(-dt / 10));
  const gross = s.steam * 11 * valve * (s.bypass ? 0.45 : 1);
  const net = Math.max(
    0,
    gross - (4 + (s.pump ? 8 : 0) + s.cooling * 0.32 + feed * 0.03),
  );
  s.output += ((s.breaker ? net : 0) - s.output) * (1 - Math.exp(-dt / 4));
  s.elapsed += dt;
  if (
    Math.abs(s.output - demandAt(s.minute, s.mode)) <= MODES[s.mode].tolerance
  )
    s.matched += dt;
  s.best = Math.max(s.best, (s.matched / Math.max(1, s.elapsed)) * 100);
  if (s.temperature >= MELTDOWN_TEMPERATURE) {
    s.meltdown = true;
    s.paused = true;
    s.output = 0;
    s.breaker = false;
  }
  return s;
}
export function restore(raw) {
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      ![1, 2, 3].includes(value.version) ||
      !Object.hasOwn(MODES, value.mode)
    )
      return initialState();
    const fresh = initialState(value.mode);
    const bounds = {
      minute: [0, 5256000],
      reactor: [0, 100],
      turbine: [0, 100],
      cooling: [0, 100],
      heat: [0, 2000],
      temperature: [-20, MELTDOWN_TEMPERATURE],
      steam: [0, 147],
      output: [0, 1700],
      condenser: [-20, 120],
      matched: [0, 1e10],
      elapsed: [0, 1e10],
      best: [0, 100],
    };
    if (value.version >= 2)
      Object.assign(bounds, {
        feedwater: [0, 100],
        water: [0, 100],
        pressure: [0, 200],
      });
    if (value.version === 3)
      Object.assign(bounds, {
        rodInsertion: [0, 100],
        rodPosition: [0, 100],
        neutrons: [0, 2000],
      });
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max)
        return initialState();
      fresh[key] = value[key];
    }
    for (const key of ["breaker", "paused", "feedAuto", "bypass", "briefed"])
      if (typeof value[key] === "boolean") fresh[key] = value[key];
    if (value.version === 3) {
      for (const key of ["scrammed", "meltdown", "pump"]) {
        if (typeof value[key] !== "boolean") return initialState();
        fresh[key] = value[key];
      }
    } else {
      fresh.scrammed = Boolean(value.tripped);
      fresh.briefed = false;
      if (value.version === 2) {
        if (
          !Array.isArray(value.rods) ||
          value.rods.length !== 3 ||
          !value.rods.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ||
          !Array.isArray(value.pumps) ||
          value.pumps.length !== 2 ||
          !value.pumps.every((n) => typeof n === "boolean")
        )
          return initialState();
        fresh.rodInsertion = 100 - value.rods.reduce((a, b) => a + b, 0) / 3;
        fresh.pump = value.pumps.some(Boolean);
      } else fresh.rodInsertion = 100 - value.reactor;
      fresh.rodPosition = fresh.rodInsertion;
      fresh.neutrons = value.reactor;
    }
    if (fresh.scrammed) fresh.rodInsertion = 100;
    if (fresh.meltdown || fresh.temperature >= MELTDOWN_TEMPERATURE) {
      fresh.meltdown = true;
      fresh.paused = true;
      fresh.output = 0;
      fresh.breaker = false;
    }
    fresh.speed = [1, 3, 6].includes(value.speed) ? value.speed : 1;
    return fresh;
  } catch {
    return initialState();
  }
}
