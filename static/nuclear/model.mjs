export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const START = Date.UTC(2026, 9, 1, 6);
export const MODES = {
  relaxed: { tolerance: 100, scale: 0.7 },
  standard: { tolerance: 65, scale: 1 },
  challenging: { tolerance: 35, scale: 1.25 },
};
export function initialState(mode = "relaxed") {
  return {
    version: 2,
    briefed: false,
    rods: [58, 58, 58],
    bankHeat: [58, 58, 58],
    pumps: [true, true],
    feedAuto: true,
    feedwater: 65,
    water: 62,
    pressure: 60,
    bypass: false,
    tripReason: "",
    minute: 0,
    reactor: 58,
    turbine: 72,
    cooling: 65,
    heat: 58,
    temperature: 291,
    steam: 58,
    output: 605,
    condenser: 31,
    tripped: false,
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
export function pumpFlow(s) {
  return Math.min(1, s.pumps.filter(Boolean).length * 0.55);
}
export function hotspot(s) {
  return s.temperature + Math.max(0, Math.max(...s.bankHeat) - s.heat) * 0.65;
}
export function canRestart(s) {
  return (
    s.temperature < 305 && s.pressure < 78 && s.water > 35 && pumpFlow(s) > 0
  );
}
export function shutdown(s, reason = "Operator shutdown") {
  s.tripped = true;
  s.tripReason = reason;
  s.rods = [0, 0, 0];
  s.reactor = 0;
}
export function restart(s) {
  if (!s.tripped || !canRestart(s)) return false;
  s.tripped = false;
  s.tripReason = "";
  s.rods = [35, 35, 35];
  s.reactor = 35;
  return true;
}
export function channelPower(s, row, col) {
  const bank = Math.min(2, Math.floor(col / 3));
  const shape = 1.07 - Math.hypot(row - 4, col - 4) * 0.035;
  return clamp(s.bankHeat[bank] * shape, 0, 100);
}
export function alarms(s) {
  const spread = Math.max(...s.bankHeat) - Math.min(...s.bankHeat);
  const error = Math.abs(s.output - demandAt(s.minute, s.mode));
  const tolerance = MODES[s.mode].tolerance;
  return [
    {
      id: "core",
      label: "CORE TEMP",
      level: hotspot(s) > 325 ? 2 : hotspot(s) > 310 ? 1 : 0,
      value: `${Math.round(hotspot(s))}°C peak`,
      action:
        "Insert rods to reduce heat. Switch on both coolant pumps and increase cooling. Automatic shutdown occurs at 335°C.",
    },
    {
      id: "banks",
      label: "ROD BALANCE",
      level: spread > 45 ? 2 : spread > 22 ? 1 : 0,
      value: `${Math.round(spread)}% spread`,
      action:
        "Keep the three rod banks close together. Insert the highest bank or use Equalise banks. Uneven heat raises the hottest channel temperature.",
    },
    {
      id: "pumps",
      label: "COOLANT FLOW",
      level: !pumpFlow(s)
        ? 2
        : pumpFlow(s) < 1 || s.cooling < s.heat * 0.65
          ? 1
          : 0,
      value: `${Math.round(pumpFlow(s) * s.cooling)}% flow`,
      action:
        "Switch on both primary pumps. Increase cooling flow as reactor heat rises. A stopped pump reduces heat removal.",
    },
    {
      id: "pressure",
      label: "STEAM PRESSURE",
      level: s.pressure > 95 ? 2 : s.pressure > 82 ? 1 : 0,
      value: `${Math.round(s.pressure)} bar`,
      action:
        "Open the turbine valve or open the steam bypass. Reduce rod withdrawal if pressure keeps rising. Automatic shutdown occurs above 105 bar.",
    },
    {
      id: "water",
      label: "WATER LEVEL",
      level: s.water < 25 ? 2 : s.water < 40 || s.water > 88 ? 1 : 0,
      value: `${Math.round(s.water)}% level`,
      action:
        "Select automatic feedwater, or increase manual feed to refill the steam drum. Automatic shutdown occurs below 18%.",
    },
    {
      id: "condenser",
      label: "CONDENSER",
      level: s.condenser > 55 ? 2 : s.condenser > 40 ? 1 : 0,
      value: `${Math.round(s.condenser)}°C`,
      action:
        "Increase cooling flow. A hot condenser reduces electrical output. Close the bypass when pressure is safe to reduce waste heat.",
    },
    {
      id: "grid",
      label: "GRID OUTPUT",
      level: !s.breaker ? 2 : error > tolerance ? 1 : 0,
      value: !s.breaker
        ? "Disconnected"
        : `${Math.round(s.output - demandAt(s.minute, s.mode))} MW difference`,
      action: !s.breaker
        ? "Close the grid breaker to reconnect the generator."
        : "Match output to demand. Adjust the turbine for a quick change, then adjust all three rod banks for sustained power.",
    },
    {
      id: "trip",
      label: "REACTOR TRIP",
      level: s.tripped ? 2 : 0,
      value: s.tripped ? s.tripReason : "Protection ready",
      action: s.tripped
        ? `${s.tripReason}. Keep cooling and feedwater on. Restart requires core below 305°C, pressure below 78 bar, water above 35%, and a running pump.`
        : "Protection is ready. Emergency shutdown inserts all rods. Residual heat remains, so keep cooling and feedwater available.",
    },
  ];
}
export function step(s, dt) {
  if (s.paused) return s;
  dt = clamp(dt, 0, 0.25) * s.speed;
  s.minute += dt * 1.6;
  const air = environment(s.minute).temperature;
  s.reactor = s.rods.reduce((sum, n) => sum + n, 0) / 3;
  s.bankHeat = s.bankHeat.map(
    (heat, i) =>
      heat + ((s.tripped ? 0 : s.rods[i]) - heat) * (1 - Math.exp(-dt / 15)),
  );
  s.heat = s.bankHeat.reduce((sum, n) => sum + n, 0) / 3;
  const flow = pumpFlow(s);
  const coolingCapacity = 6 + (6 + s.cooling * 1.35) * flow;
  s.condenser +=
    (air +
      12 +
      s.steam * 0.32 +
      (s.bypass ? s.steam * 0.12 : 0) -
      s.cooling * 0.19 -
      s.condenser) *
    (1 - Math.exp(-dt / 20));
  const removal = Math.min(
    s.heat + Math.max(0, s.temperature - 290) * 0.9,
    coolingCapacity,
  );
  s.temperature = clamp(
    s.temperature +
      (s.heat - removal) * dt * 0.065 +
      (275 + s.heat * 0.25 - s.temperature) * dt * 0.01,
    air,
    370,
  );
  const available =
    Math.min(s.heat, coolingCapacity) *
    clamp(1 - Math.max(0, s.condenser - 35) / 65, 0.35, 1) *
    clamp((s.water - 10) / 30, 0, 1);
  s.steam += (available - s.steam) * (1 - Math.exp(-dt / 8));
  const feed = s.feedAuto
    ? clamp(s.steam * 0.75 + (62 - s.water) * 2, 0, 100)
    : s.feedwater;
  s.water = clamp(s.water + (feed - s.steam * 0.75) * dt * 0.04, 0, 100);
  const valve = Math.min(1, s.turbine / 72);
  const pressureTarget =
    10 +
    Math.min(1, s.steam / 30) * 50 +
    s.steam * (1 - valve) * 0.9 -
    (s.bypass ? 30 : 0);
  s.pressure +=
    (Math.max(5, pressureTarget) - s.pressure) * (1 - Math.exp(-dt / 10));
  const gross = s.steam * 11 * valve * (s.bypass ? 0.45 : 1);
  const net = Math.max(
    0,
    gross -
      (4 + s.pumps.filter(Boolean).length * 4 + s.cooling * 0.32 + feed * 0.03),
  );
  s.output += ((s.breaker ? net : 0) - s.output) * (1 - Math.exp(-dt / 4));
  if (!s.tripped) {
    if (hotspot(s) > 335) shutdown(s, "High core temperature");
    else if (s.pressure > 105) shutdown(s, "High steam pressure");
    else if (s.water < 18) shutdown(s, "Low steam drum level");
  }
  s.elapsed += dt;
  if (
    Math.abs(s.output - demandAt(s.minute, s.mode)) <= MODES[s.mode].tolerance
  )
    s.matched += dt;
  s.best = Math.max(s.best, (s.matched / Math.max(1, s.elapsed)) * 100);
  return s;
}
export function restore(raw) {
  try {
    const value = JSON.parse(raw);
    if (
      !value ||
      ![1, 2].includes(value.version) ||
      !Object.hasOwn(MODES, value.mode)
    )
      return initialState();
    const fresh = initialState(value.mode);
    const bounds = {
      minute: [0, 5256000],
      reactor: [0, 100],
      turbine: [0, 100],
      cooling: [0, 100],
      heat: [0, 100],
      temperature: [-20, 370],
      steam: [0, 100],
      output: [0, 1100],
      condenser: [-20, 120],
      matched: [0, 1e10],
      elapsed: [0, 1e10],
      best: [0, 100],
    };
    if (value.version === 2)
      Object.assign(bounds, {
        feedwater: [0, 100],
        water: [0, 100],
        pressure: [0, 160],
      });
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max)
        return initialState();
      fresh[key] = value[key];
    }
    for (const key of [
      "tripped",
      "breaker",
      "paused",
      "feedAuto",
      "bypass",
      "briefed",
    ])
      if (typeof value[key] === "boolean") fresh[key] = value[key];
    if (value.version === 2) {
      for (const key of ["rods", "bankHeat"]) {
        if (
          !Array.isArray(value[key]) ||
          value[key].length !== 3 ||
          !value[key].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)
        )
          return initialState();
        fresh[key] = [...value[key]];
      }
      if (
        !Array.isArray(value.pumps) ||
        value.pumps.length !== 2 ||
        !value.pumps.every((n) => typeof n === "boolean")
      )
        return initialState();
      fresh.pumps = [...value.pumps];
      fresh.tripReason = [
        "Operator shutdown",
        "High core temperature",
        "High steam pressure",
        "Low steam drum level",
      ].includes(value.tripReason)
        ? value.tripReason
        : "";
    } else {
      fresh.rods = Array(3).fill(value.tripped ? 0 : value.reactor);
      fresh.bankHeat = Array(3).fill(value.heat);
      fresh.tripReason = value.tripped ? "Operator shutdown" : "";
    }
    fresh.speed = [1, 3, 6].includes(value.speed) ? value.speed : 1;
    return fresh;
  } catch {
    return initialState();
  }
}
