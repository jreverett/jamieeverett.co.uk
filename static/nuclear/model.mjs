export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const START = Date.UTC(2026, 9, 1, 6);
export const MODES = {
  relaxed: { tolerance: 100, scale: 0.7 },
  standard: { tolerance: 65, scale: 1 },
  challenging: { tolerance: 35, scale: 1.25 },
};
export function initialState() {
  return {
    version: 1,
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
    mode: "relaxed",
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
export function step(s, dt) {
  if (s.paused) return s;
  dt = clamp(dt, 0, 0.25) * s.speed;
  s.minute += dt * 1.6;
  const air = environment(s.minute).temperature;
  s.heat += ((s.tripped ? 0 : s.reactor) - s.heat) * (1 - Math.exp(-dt / 15));
  const coolingCapacity = 12 + s.cooling * 1.35;
  s.condenser +=
    (air + 12 + s.steam * 0.32 - s.cooling * 0.19 - s.condenser) *
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
    clamp(1 - Math.max(0, s.condenser - 35) / 65, 0.35, 1);
  s.steam += (available - s.steam) * (1 - Math.exp(-dt / 8));
  const valve = Math.min(1, s.turbine / 72);
  const gross = s.steam * 11 * valve;
  const net = Math.max(0, gross - (12 + s.cooling * 0.32));
  s.output += ((s.breaker ? net : 0) - s.output) * (1 - Math.exp(-dt / 4));
  if (s.temperature > 335 && !s.tripped) {
    s.tripped = true;
    s.reactor = 0;
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
    const fresh = initialState();
    if (value.version !== 1 || !MODES[value.mode]) return fresh;
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
    for (const [key, [min, max]] of Object.entries(bounds)) {
      if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max)
        return fresh;
      fresh[key] = value[key];
    }
    for (const key of ["tripped", "breaker", "paused"])
      if (typeof value[key] === "boolean") fresh[key] = value[key];
    fresh.speed = [1, 3, 6].includes(value.speed) ? value.speed : 1;
    fresh.mode = value.mode;
    return fresh;
  } catch {
    return initialState();
  }
}
