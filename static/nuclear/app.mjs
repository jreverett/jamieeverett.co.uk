import {
  clamp,
  demandAt,
  environment,
  newsEvents,
  heatStage,
  initialState,
  MODES,
  restore,
  step,
  alarms,
  channelPower,
  hotspot,
  pumpFlow,
  shutdown,
  restart,
} from "./model.mjs";
import { createScene } from "./scene.mjs";
import { createCore } from "./core.mjs";
const $ = (id) => document.getElementById(id);
const KEY = "baseload-shift-v1";
let stored = null;
try {
  stored = localStorage.getItem(KEY);
} catch {
  $("save-status").textContent = "SAVING UNAVAILABLE";
}
let state = stored ? restore(stored) : initialState();
let hasStarted = false,
  returnPaused = state.paused,
  tutorialIndex = -1,
  tutorialWasPaused = false;
let lowMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let visualTime = 0,
  last = 0,
  lastUI = 0,
  lastSave = 0,
  lastHistory = -Infinity,
  previousNews = "",
  selectedAlarm = null;
let previousLevels = new Map(),
  sound = false,
  audioContext = null,
  lastChime = 0;
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const dateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const scene = createScene($("landscape"));
const core = createCore($("core-animation"), $("heat-effects"));
let gameOverShown = false;
const chart = $("chart"),
  ctx = chart.getContext("2d");
let chartWidth = 0,
  chartHeight = 0;
new ResizeObserver(() => {
  chartWidth = chart.clientWidth;
  chartHeight = chart.clientHeight;
  const ratio = Math.min(devicePixelRatio || 1, 1.5);
  chart.width = Math.round(chartWidth * ratio);
  chart.height = Math.round(chartHeight * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawChart();
}).observe(chart);
const cells = [];
for (let row = 0; row < 9; row++)
  for (let col = 0; col < 9; col++) {
    const cell = document.createElement("span");
    cell.className = "fuel-cell";
    if (Math.hypot(row - 4, col - 4) > 5) cell.classList.add("blank");
    $("fuel-grid").append(cell);
    cells.push({ cell, row, col });
  }
for (const alarm of alarms(state)) {
  const button = document.createElement("button");
  button.className = "annunciator";
  button.id = `alarm-${alarm.id}`;
  button.innerHTML = `<span>${alarm.label}</span><strong>NORMAL</strong>`;
  button.addEventListener("click", () => {
    selectedAlarm = alarm.id;
    updateAlarms();
  });
  $("annunciators").append(button);
}
function save() {
  if (!hasStarted || $("setup").open) return;
  try {
    stored = JSON.stringify({
      ...state,
      history: [],
      paused: tutorialIndex >= 0 ? tutorialWasPaused : state.paused,
    });
    localStorage.setItem(KEY, stored);
    $("save-status").textContent = "SHIFT SAVED ON THIS DEVICE";
  } catch {
    $("save-status").textContent = "SAVING UNAVAILABLE";
  }
}
function syncControls() {
  for (const key of ["turbine", "cooling"]) {
    $(key).value = state[key];
    $(key).style.setProperty("--value", `${state[key]}%`);
    $(`${key}-value`).textContent = `${state[key]}%`;
  }
  $("rod-insertion").value = state.rodInsertion;
  $("rod-insertion").style.setProperty("--value", `${state.rodInsertion}%`);
  $("rod-insertion-value").textContent = `${Math.round(state.rodInsertion)}%`;
  $("rod-position-value").textContent = `${Math.round(state.rodPosition)}% IN`;
  for (const id of ["rod-insertion"])
    $(id).disabled = state.scrammed || state.meltdown;
  $("difficulty").textContent = `${state.mode.toUpperCase()} SHIFT · LOCKED`;
  $("pause").textContent = state.paused ? "▶" : "Ⅱ";
  $("pause").setAttribute(
    "aria-label",
    state.paused ? "Resume simulation" : "Pause simulation",
  );
  $("pause").disabled = tutorialIndex >= 0 || state.meltdown;
  document.querySelectorAll("[data-speed]").forEach((button) => {
    const active = Number(button.dataset.speed) === state.speed;
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("pump").setAttribute("aria-pressed", String(state.pump));
  $("pump").querySelector("strong").textContent = state.pump ? "RUN" : "STOP";
  $("feed-auto").setAttribute("aria-pressed", String(state.feedAuto));
  $("feed-manual").setAttribute("aria-pressed", String(!state.feedAuto));
  $("feed-less").disabled = state.feedAuto;
  $("feed-more").disabled = state.feedAuto;
  $("feedwater-value").textContent = state.feedAuto
    ? "AUTO"
    : `${state.feedwater}%`;
  $("bypass").setAttribute("aria-pressed", String(state.bypass));
  $("bypass").querySelector("strong").textContent = state.bypass
    ? "OPEN"
    : "CLOSED";
  $("breaker").innerHTML =
    `<span class="live-dot"></span> GRID ${state.breaker ? "CONNECTED" : "DISCONNECTED"}`;
  $("breaker").setAttribute("aria-pressed", String(state.breaker));
  $("trip").textContent = state.meltdown
    ? "SHIFT ENDED"
    : state.scrammed
      ? "RELEASE STOP"
      : "EMERGENCY STOP";
  $("trip").disabled = state.meltdown;
  for (const id of [
    "pump",
    "turbine",
    "cooling",
    "feed-auto",
    "feed-manual",
    "bypass",
    "breaker",
  ])
    $(id).disabled = state.meltdown;
  $("feed-less").disabled = state.feedAuto || state.meltdown;
  $("feed-more").disabled = state.feedAuto || state.meltdown;
  document
    .querySelectorAll("[data-speed]")
    .forEach((button) => (button.disabled = state.meltdown));
  document.body.classList.toggle("paused", state.paused);
  document.body.classList.toggle("low-motion", lowMotion);
  $("motion").setAttribute("aria-pressed", String(lowMotion));
}
function change(action) {
  if (state.meltdown) return;
  action();
  syncControls();
  updateUI();
  save();
}
$("rod-insertion").addEventListener("input", (event) =>
  change(() => (state.rodInsertion = Number(event.target.value))),
);
for (const key of ["turbine", "cooling"])
  $(key).addEventListener("input", (event) =>
    change(() => (state[key] = Number(event.target.value))),
  );
$("pump").addEventListener("click", () =>
  change(() => (state.pump = !state.pump)),
);
$("feed-auto").addEventListener("click", () =>
  change(() => (state.feedAuto = true)),
);
$("feed-manual").addEventListener("click", () =>
  change(() => (state.feedAuto = false)),
);
$("feed-less").addEventListener("click", () =>
  change(() => (state.feedwater = clamp(state.feedwater - 5, 0, 100))),
);
$("feed-more").addEventListener("click", () =>
  change(() => (state.feedwater = clamp(state.feedwater + 5, 0, 100))),
);
$("bypass").addEventListener("click", () =>
  change(() => (state.bypass = !state.bypass)),
);
$("breaker").addEventListener("click", () =>
  change(() => (state.breaker = !state.breaker)),
);
$("trip").addEventListener("click", () =>
  change(() => (state.scrammed ? restart(state) : shutdown(state))),
);
$("pause").addEventListener("click", () =>
  change(() => (state.paused = !state.paused)),
);
document
  .querySelectorAll("[data-speed]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      change(() => (state.speed = Number(button.dataset.speed))),
    ),
  );
$("motion").addEventListener("click", () => {
  lowMotion = !lowMotion;
  syncControls();
});
for (const [id, delta] of [
  ["look-left", -20],
  ["look-right", 20],
])
  $(id).addEventListener("click", () => {
    $("bearing").textContent =
      `${String(scene.look(delta)).padStart(3, "0")}° E`;
  });
function chime() {
  if (
    !sound ||
    !audioContext ||
    state.paused ||
    document.hidden ||
    performance.now() - lastChime < 2500
  )
    return;
  lastChime = performance.now();
  const tone = audioContext.createOscillator(),
    gain = audioContext.createGain();
  tone.connect(gain);
  gain.connect(audioContext.destination);
  tone.frequency.value = 580;
  gain.gain.setValueAtTime(0.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);
  tone.start();
  tone.stop(audioContext.currentTime + 0.3);
}
$("sound").addEventListener("click", async () => {
  sound = !sound;
  try {
    if (sound) {
      audioContext ??= new AudioContext();
      await audioContext.resume();
    }
  } catch {
    sound = false;
  }
  $("sound").textContent = `ALARM SOUND ${sound ? "ON" : "OFF"}`;
  $("sound").setAttribute("aria-pressed", String(sound));
});
function updateAlarms() {
  const list = alarms(state);
  for (const alarm of list) {
    if (previousLevels.get(alarm.id) !== alarm.level) {
      if (alarm.level) chime();
      previousLevels.set(alarm.id, alarm.level);
    }
    const button = $(`alarm-${alarm.id}`);
    button.dataset.level = alarm.level;
    button.classList.toggle("active-alarm", alarm.level > 0);
    button.classList.toggle("selected", selectedAlarm === alarm.id);
    button.querySelector("strong").textContent =
      alarm.level === 2 ? "ALARM" : alarm.level === 1 ? "CAUTION" : "NORMAL";
    button.setAttribute(
      "aria-label",
      `${alarm.label}: ${alarm.level === 2 ? "alarm" : alarm.level === 1 ? "caution" : "normal"}, ${alarm.value}`,
    );
    button.setAttribute("aria-pressed", String(selectedAlarm === alarm.id));
  }
  const active = list
    .filter((alarm) => alarm.level)
    .sort((a, b) => b.level - a.level);
  const detail = selectedAlarm
    ? list.find((alarm) => alarm.id === selectedAlarm)
    : active[0];
  $("alarm-title").textContent = detail
    ? `${detail.label} · ${detail.value.toUpperCase()}`
    : "ALL SYSTEMS NORMAL";
  const advice = detail
    ? detail.action
    : "Select a tile for operating guidance. Warning tiles stay active until their cause is fixed.";
  if ($("alarm-advice").textContent !== advice)
    $("alarm-advice").textContent = advice;
}
const lessons = [
  [
    ".grid-panel",
    "Match the demand",
    "Keep your output near grid demand. The dotted line forecasts the next three hours. Make small changes, then wait for heat and steam to respond.",
  ],
  [
    "#rod-console",
    "Fuel stays. Control rods move.",
    "The bright cells are fixed fuel assemblies. Cyan particles represent neutrons. Increase insertion to absorb more neutrons and reduce power. Watch the metal control rods move down into the core.",
  ],
  [
    "#support-controls",
    "Move heat. Keep water available.",
    "The coolant pump carries heat away from the core. Cooling flow removes waste heat. Automatic feedwater holds drum level near 62%. In manual mode, use −/+ to adjust the water supply.",
  ],
  [
    "#steam-controls",
    "Put the steam to work",
    "The turbine valve changes electrical output. Closing it can raise steam pressure. Open the bypass to relieve pressure; it wastes steam and reduces electricity. Close it when pressure is safe.",
  ],
  [
    "#alarm-panel",
    "Read the warning wall",
    "Amber means caution; red means act now. Select a tile for the cause and remedy. There are no automatic trips. Emergency Stop inserts all rods, but keep cooling on. Meltdown at the game limit ends your shift.",
  ],
  [
    "#news-ticker",
    "Prepare for the next headline",
    "The Wire hints at demand changes. Hover to pause the feed, or open it to read the stories. Pause the shift whenever you need. Your difficulty stays fixed for this run.",
  ],
];
function showLesson(index) {
  document
    .querySelectorAll(".tutorial-target")
    .forEach((el) => el.classList.remove("tutorial-target"));
  tutorialIndex = index;
  const [selector, title, copy] = lessons[index],
    target = document.querySelector(selector);
  target.classList.add("tutorial-target");
  $("tutorial").hidden = false;
  $("tutorial-title").textContent = title;
  $("tutorial-text").textContent = copy;
  $("tutorial-step").textContent = `0${index + 1} / 06 · CONTROL-ROOM BRIEFING`;
  $("tutorial-back").disabled = index === 0;
  $("tutorial-next").textContent =
    index === lessons.length - 1 ? "START OPERATING →" : "NEXT →";
  $("tutorial").dataset.placement = index === 5 ? "top" : "bottom";
  if (innerWidth < 1000)
    target.scrollIntoView({ block: "center", behavior: "instant" });
  syncControls();
}
function startTutorial() {
  if (state.meltdown) return;
  if (tutorialIndex >= 0) {
    showLesson(0);
    return;
  }
  tutorialWasPaused = state.paused;
  state.paused = true;
  showLesson(0);
}
function endTutorial() {
  document
    .querySelectorAll(".tutorial-target")
    .forEach((el) => el.classList.remove("tutorial-target"));
  $("tutorial").hidden = true;
  tutorialIndex = -1;
  state.briefed = true;
  state.paused = tutorialWasPaused;
  syncControls();
  save();
}
$("tutorial-next").addEventListener("click", () =>
  tutorialIndex === lessons.length - 1
    ? endTutorial()
    : showLesson(tutorialIndex + 1),
);
$("tutorial-back").addEventListener("click", () =>
  showLesson(Math.max(0, tutorialIndex - 1)),
);
$("tutorial-skip").addEventListener("click", endTutorial);
$("help").addEventListener("click", () => {
  if (hasStarted) startTutorial();
});
function showSetup() {
  if (tutorialIndex >= 0) endTutorial();
  returnPaused = state.paused;
  state.paused = true;
  $("continue-shift").hidden = state.meltdown || (!stored && !hasStarted);
  $("save-note").hidden = !stored && !hasStarted;
  $("continue-shift").textContent =
    `CONTINUE ${state.mode.toUpperCase()} SHIFT`;
  $("include-tutorial").checked = !state.briefed;
  $("setup").showModal();
  syncControls();
}
$("reset").addEventListener("click", showSetup);
$("start-shift").addEventListener("click", () => {
  gameOverShown = false;
  core.reset();
  state = initialState(
    document.querySelector("input[name=mode]:checked").value,
  );
  hasStarted = true;
  previousNews = "";
  lastHistory = -Infinity;
  selectedAlarm = null;
  previousLevels.clear();
  $("setup").close();
  if ($("include-tutorial").checked) startTutorial();
  else state.briefed = true;
  updateUI();
  save();
});
$("continue-shift").addEventListener("click", () => {
  hasStarted = true;
  state.paused = returnPaused;
  $("setup").close();
  if ($("include-tutorial").checked) startTutorial();
  else state.briefed = true;
  updateUI();
  save();
});
$("setup").addEventListener("cancel", (event) => {
  event.preventDefault();
  if (state.meltdown) {
    $("setup").close();
    showGameOver();
  } else if (stored || hasStarted) $("continue-shift").click();
});
$("ticker-pause").addEventListener("click", () => {
  const paused = document.body.classList.toggle("ticker-paused");
  $("ticker-pause").setAttribute("aria-pressed", String(paused));
  $("ticker-pause").textContent = paused ? "▶" : "Ⅱ";
  $("ticker-pause").setAttribute(
    "aria-label",
    paused ? "Resume news feed" : "Pause news feed",
  );
});
$("open-news").addEventListener("click", () => $("news-dialog").showModal());
document.addEventListener("keydown", (event) => {
  if (
    event.code === "Space" &&
    !["INPUT", "BUTTON", "SELECT"].includes(document.activeElement.tagName) &&
    !$("setup").open &&
    !$("news-dialog").open &&
    tutorialIndex < 0
  ) {
    event.preventDefault();
    $("pause").click();
  }
});
function updateNews() {
  const next = newsEvents(state.minute);
  const key =
    next.map((event) => `${event.at}:${event.at <= state.minute}`).join(",") +
    state.mode;
  if (key === previousNews) return;
  previousNews = key;
  const group = document.createElement("div");
  group.className = "ticker-group";
  $("news").replaceChildren(
    ...next.map((event) => {
      const active = event.at <= state.minute,
        when = `${environment(event.at).date.getUTCDate() !== environment(state.minute).date.getUTCDate() ? "TOMORROW " : ""}${timeFormat.format(environment(event.at).date)}`;
      const item = document.createElement("span");
      item.className = "ticker-item";
      const label = document.createElement("b");
      label.textContent = active ? "NOW" : when;
      item.append(label, `${event.title} - ${event.body}`);
      group.append(item);
      const article = document.createElement("article");
      article.className = "news-item";
      article.innerHTML = `<div class="news-meta"><span class="tag ${active ? "active" : ""}">${active ? "HAPPENING NOW" : "COMING UP"}</span><time>${when}</time></div><h3>${event.title}</h3><p>${event.body}</p><p>${event.hint}</p><div class="news-effect">${event.mw > 0 ? "+" : ""}${Math.round(event.mw * MODES[state.mode].scale)} MW EXPECTED</div>`;
      return article;
    }),
  );
  if (!next.length) {
    const item = document.createElement("span");
    item.className = "ticker-item";
    item.textContent =
      "GRID DESK · No demand events announced in the next three hours. Watch the weather and demand forecast.";
    group.append(item);
    const empty = document.createElement("p");
    empty.textContent =
      "No active events or announcements for the next three hours.";
    $("news").replaceChildren(empty);
  }
  const duplicate = group.cloneNode(true);
  duplicate.setAttribute("aria-hidden", "true");
  $("ticker-track").replaceChildren(group, duplicate);
}
function updateUI() {
  const e = environment(state.minute),
    demand = demandAt(state.minute, state.mode),
    difference = state.output - demand,
    balanced = Math.abs(difference) <= MODES[state.mode].tolerance;
  $("clock").textContent = timeFormat.format(e.date);
  $("date").textContent = dateFormat.format(e.date).toUpperCase();
  $("weather").textContent =
    `${Math.round(e.temperature)}°C / ${e.cloud > 0.7 ? "LIGHT RAIN" : e.cloud > 0.4 ? "CLOUDY" : "CLEAR"} / ${Math.round(e.wind)} KM/H`;
  $("output").textContent = Math.round(state.output);
  $("demand").textContent = Math.round(demand);
  $("difference").textContent =
    `${difference > 0 ? "+" : ""}${Math.round(difference)} MW · ${balanced ? "IN RANGE" : difference < 0 ? "SHORTFALL" : "SURPLUS"}`;
  $("difference").style.color = balanced ? "var(--green)" : "var(--amber)";
  $("balance-marker").style.left = `${clamp(50 + difference / 8, 1, 98)}%`;
  $("balance-status").textContent = balanced
    ? "IN BALANCE"
    : difference < 0
      ? "UNDER TARGET"
      : "OVER TARGET";
  $("balance-status").classList.toggle("warn", !balanced);
  for (const key of ["temperature", "condenser", "pressure", "water"])
    $(key).textContent = Math.round(state[key]);
  $("flow-reading").textContent =
    `${Math.round(pumpFlow(state) * state.cooling)}% FLOW`;
  $("core-peak").textContent = `${Math.round(hotspot(state))}°C PEAK`;
  for (const { cell, row, col } of cells) {
    const power = channelPower(state, row, col);
    const heatStress = Math.max(0, hotspot(state) - 310) * 0.22;
    const intensity = clamp(power + heatStress, 0, 100);
    cell.style.backgroundColor = `hsl(${100 - intensity * 0.9} 65% ${9 + Math.max(power * 0.42, clamp((state.temperature - 300) / 400, 0, 1) * 45)}%)`;
    cell.style.boxShadow =
      power > 45
        ? `0 0 ${Math.round(power / 15)}px hsl(${100 - intensity * 0.9} 70% 50% / .18)`
        : "none";
    cell.title = `Fixed fuel assembly ${row + 1}-${col + 1} · ${Math.round(power)}% thermal load`;
  }
  $("fuel-grid").setAttribute(
    "aria-label",
    `Fixed fuel assemblies. Control rods ${Math.round(state.rodPosition)}% inserted. Neutron activity ${Math.round(state.neutrons)}%. Core ${Math.round(state.temperature)} degrees.`,
  );
  const outage = state.output < 45 || !state.breaker;
  document.body.classList.toggle("emergency", outage);
  $("emergency-banner").hidden = !outage;
  const stage = heatStage(state);
  document.body.dataset.heat = stage;
  document.documentElement.style.setProperty(
    "--heat",
    clamp((state.temperature - 330) / 370, 0, 1),
  );
  $("heat-stage").textContent = state.meltdown
    ? "MELTDOWN · GAME OVER"
    : stage === "fire"
      ? "CRITICAL · CORE OVERHEATING"
      : stage === "sparks"
        ? "DANGER · COOL THE CORE"
        : stage === "hot"
          ? "CORE TEMPERATURE RISING"
          : "CORE STABLE";
  $("limit-bar").style.width =
    `${clamp(((state.temperature - 275) / 425) * 100, 0, 100)}%`;
  $("plant-status").textContent = state.meltdown
    ? "● MELTDOWN"
    : state.scrammed
      ? "● MANUAL STOP"
      : !state.breaker
        ? "● GRID OPEN"
        : "● RUNNING";
  $("plant-status").style.color =
    state.meltdown || state.temperature >= 400
      ? "var(--red)"
      : state.scrammed
        ? "var(--amber)"
        : "var(--green)";
  $("score").textContent =
    state.elapsed < 10
      ? "SHIFT JUST STARTED"
      : `${Math.round((state.matched / state.elapsed) * 100)}% OF SHIFT IN BALANCE`;
  const ahead = demandAt(state.minute + 60, state.mode);
  $("forecast-text").textContent =
    `${Math.round(ahead)} MW expected in one hour. ${ahead > demand + 40 ? "Withdraw rods gradually before demand rises." : ahead < demand - 40 ? "Insert rods gradually as demand falls." : "Keep output steady and watch The Wire."}`;
  syncControls();
  updateAlarms();
  updateNews();
  drawChart();
}
function drawChart() {
  if (!chartWidth) return;
  const w = chartWidth,
    h = chartHeight;
  ctx.clearRect(0, 0, w, h);
  const y = (value) => h - 9 - clamp(value / 1150, 0, 1) * (h - 18);
  ctx.strokeStyle = "#b3c7b014";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, y(300 + i * 250));
    ctx.lineTo(w, y(300 + i * 250));
    ctx.stroke();
  }
  const x = (minute) => ((minute - state.minute + 60) / 240) * w;
  ctx.fillStyle = "#b9ed8905";
  ctx.fillRect(w / 4, 0, w * 0.75, h);
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = "#b9ed8940";
  ctx.beginPath();
  ctx.moveTo(w / 4, 0);
  ctx.lineTo(w / 4, h);
  ctx.stroke();
  const plot = (values, colour, dashed) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.8;
    ctx.setLineDash(dashed ? [4, 4] : []);
    ctx.beginPath();
    values.forEach(([minute, power], i) =>
      i ? ctx.lineTo(x(minute), y(power)) : ctx.moveTo(x(minute), y(power)),
    );
    ctx.stroke();
  };
  const past = [],
    future = [];
  for (let offset = -60; offset <= 180; offset += 3) {
    const sample = [
      state.minute + offset,
      demandAt(state.minute + offset, state.mode),
    ];
    (offset <= 0 ? past : future).push(sample);
  }
  future.unshift([state.minute, demandAt(state.minute, state.mode)]);
  plot(past, "#b9ed89", false);
  plot(future, "#b9ed8999", true);
  const history = state.history.filter(
    (point) => point[0] >= state.minute - 60,
  );
  plot([...history, [state.minute, state.output]], "#e9eddf", false);
  ctx.setLineDash([]);
  ctx.fillStyle = "#e9eddf";
  ctx.beginPath();
  ctx.arc(w / 4, y(state.output), 3, 0, Math.PI * 2);
  ctx.fill();
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) {
    last = now;
    return;
  }
  if (now - last < 1000 / 30) return;
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  if (hasStarted) step(state, dt);
  if (!state.paused || state.meltdown) visualTime += dt;
  scene.draw(state, visualTime, lowMotion);
  core.draw(state, dt, visualTime, lowMotion);
  if (state.meltdown && !gameOverShown) {
    updateUI();
    save();
    showGameOver();
  }
  if (hasStarted && state.minute - lastHistory >= 2) {
    state.history.push([state.minute, state.output]);
    state.history = state.history.filter(
      (point) => point[0] >= state.minute - 65,
    );
    lastHistory = state.minute;
  }
  if (now - lastUI > 250) {
    updateUI();
    lastUI = now;
  }
  if (now - lastSave > 5000) {
    save();
    lastSave = now;
  }
}
document.addEventListener("visibilitychange", () => {
  save();
  last = 0;
});
window.addEventListener("pagehide", save);
function showGameOver() {
  if (tutorialIndex >= 0) endTutorial();
  gameOverShown = true;
  state.paused = true;
  $("final-stats").textContent =
    `${timeFormat.format(environment(state.minute).date)} · ${Math.round(state.elapsed / 60)} minutes played · ${Math.round((state.matched / Math.max(1, state.elapsed)) * 100)}% in balance`;
  if (!$("game-over").open) $("game-over").showModal();
}
$("new-after-meltdown").addEventListener("click", () => {
  $("game-over").close();
  showSetup();
});
$("inspect-meltdown").addEventListener("click", () => $("game-over").close());
updateUI();
if (state.meltdown) {
  hasStarted = true;
  showGameOver();
} else showSetup();
requestAnimationFrame(frame);
