import {
  clamp,
  demandAt,
  environment,
  events,
  initialState,
  MODES,
  restore,
  step,
} from "./model.mjs";
import { createScene } from "./scene.mjs";
const $ = (id) => document.getElementById(id);
const KEY = "baseload-shift-v1";
let stored = null;
try {
  stored = localStorage.getItem(KEY);
} catch {
  $("save-status").textContent = "SAVING UNAVAILABLE";
}
let state = stored ? restore(stored) : initialState();
let lowMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let visualTime = 0,
  last = 0,
  lastUI = 0,
  lastSave = 0,
  lastHistory = -Infinity,
  previousNews = "",
  rotor = 0;
let guideWasPaused = state.paused;
const scene = createScene($("landscape"));
const chart = $("chart");
const ctx = chart.getContext("2d");
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
function save() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...state,
        history: [],
        paused: $("guide").open ? guideWasPaused : state.paused,
      }),
    );
    $("save-status").textContent = "SHIFT SAVED ON THIS DEVICE";
  } catch {
    $("save-status").textContent = "SAVING UNAVAILABLE";
  }
}
function syncControls() {
  for (const key of ["reactor", "turbine", "cooling"]) {
    $(key).value = state[key];
    $(key).style.setProperty("--value", `${state[key]}%`);
    $(`${key}-value`).innerHTML = `${state[key]}<span>%</span>`;
  }
  $("difficulty").value = state.mode;
  $("pause").textContent = state.paused ? "▶" : "Ⅱ";
  $("pause").setAttribute(
    "aria-label",
    state.paused ? "Resume simulation" : "Pause simulation",
  );
  $("pause").setAttribute("aria-pressed", String(state.paused));
  document.querySelectorAll("[data-speed]").forEach((button) => {
    const selected = Number(button.dataset.speed) === state.speed;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  $("reactor").disabled = state.tripped;
  $("breaker").innerHTML =
    `<span class="live-dot"></span> GRID ${state.breaker ? "CONNECTED" : "DISCONNECTED"}`;
  $("breaker").setAttribute("aria-pressed", String(state.breaker));
  $("trip").textContent = state.tripped
    ? state.temperature >= 305
      ? "COOLING DOWN"
      : "RESTART"
    : "SHUT DOWN";
  $("trip").disabled = state.tripped && state.temperature >= 305;
  document.body.classList.toggle("paused", state.paused);
  document.body.classList.toggle("low-motion", lowMotion);
  $("motion").setAttribute("aria-pressed", String(lowMotion));
}
for (const key of ["reactor", "turbine", "cooling"])
  $(key).addEventListener("input", (event) => {
    state[key] = Number(event.target.value);
    syncControls();
    updateUI();
  });
$("pause").addEventListener("click", () => {
  state.paused = !state.paused;
  syncControls();
  save();
});
document.querySelectorAll("[data-speed]").forEach((button) =>
  button.addEventListener("click", () => {
    state.speed = Number(button.dataset.speed);
    syncControls();
  }),
);
$("difficulty").addEventListener("change", (event) => {
  state.mode = event.target.value;
  state.matched = 0;
  state.elapsed = 0;
  state.best = 0;
  previousNews = "";
  updateUI();
});
$("breaker").addEventListener("click", () => {
  state.breaker = !state.breaker;
  syncControls();
  updateUI();
});
$("trip").addEventListener("click", () => {
  if (state.tripped && state.temperature < 305) {
    state.tripped = false;
    state.reactor = 35;
  } else {
    state.tripped = true;
    state.reactor = 0;
  }
  syncControls();
  updateUI();
  save();
});
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
function showGuide() {
  guideWasPaused = state.paused;
  state.paused = true;
  $("guide").showModal();
  syncControls();
}
$("help").addEventListener("click", showGuide);
$("start").addEventListener("click", () => $("guide").close());
$("guide").addEventListener("close", () => {
  state.paused = guideWasPaused;
  syncControls();
  save();
});
let resetWasPaused = false;
$("reset").addEventListener("click", () => {
  resetWasPaused = state.paused;
  state.paused = true;
  $("reset-dialog").showModal();
  syncControls();
});
$("cancel-reset").addEventListener("click", () => $("reset-dialog").close());
$("reset-dialog").addEventListener("close", () => {
  state.paused = resetWasPaused;
  syncControls();
});
$("confirm-reset").addEventListener("click", () => {
  state = initialState();
  resetWasPaused = false;
  previousNews = "";
  lastHistory = -Infinity;
  $("reset-dialog").close();
  syncControls();
  updateUI();
  save();
});
document.addEventListener("keydown", (event) => {
  if (
    event.code === "Space" &&
    !["INPUT", "BUTTON", "SELECT", "SUMMARY"].includes(
      document.activeElement.tagName,
    ) &&
    !$("guide").open &&
    !$("reset-dialog").open
  ) {
    event.preventDefault();
    $("pause").click();
  }
});
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
function updateNews() {
  const next = events(state.minute)
    .filter((event) => event.end > state.minute)
    .slice(0, 3);
  const key =
    next.map((event) => `${event.at}:${event.at <= state.minute}`).join(",") +
    state.mode;
  if (key === previousNews) return;
  previousNews = key;
  $("news").replaceChildren(
    ...next.map((event) => {
      const article = document.createElement("article");
      article.className = "news-item";
      const active = event.at <= state.minute;
      const relativeDay =
        environment(event.at).date.toDateString() ===
        environment(state.minute).date.toDateString()
          ? ""
          : "TOMORROW ";
      article.innerHTML = `<div class="news-meta"><span class="tag ${active ? "active" : ""}">${active ? "HAPPENING NOW" : "COMING UP"}</span><time>${relativeDay}${timeFormat.format(environment(event.at).date)}</time></div><h3>${event.title}</h3><p>${event.body}</p><div class="news-effect">${event.mw > 0 ? "↗" : "↘"} ${event.mw > 0 ? "+" : ""}${Math.round(event.mw * MODES[state.mode].scale)} MW EXPECTED</div>`;
      return article;
    }),
  );
}
function updateUI() {
  const e = environment(state.minute),
    demand = demandAt(state.minute, state.mode),
    difference = state.output - demand;
  const balanced = Math.abs(difference) <= MODES[state.mode].tolerance;
  $("clock").textContent = timeFormat.format(e.date);
  $("date").textContent = dateFormat.format(e.date).toUpperCase();
  $("weather").textContent =
    `${Math.round(e.temperature)}°C / ${e.cloud > 0.7 ? "LIGHT RAIN" : e.cloud > 0.4 ? "CLOUDY" : "CLEAR"} / ${Math.round(e.wind)} KM/H`;
  $("output").textContent = Math.round(state.output);
  $("demand").textContent = Math.round(demand);
  $("difference").textContent =
    `${difference > 0 ? "+" : ""}${Math.round(difference)} MW ${balanced ? "· IN RANGE" : difference < 0 ? "· SHORTFALL" : "· SURPLUS"}`;
  $("difference").style.color = balanced ? "var(--green)" : "var(--amber)";
  $("balance-marker").style.left = `${clamp(50 + difference / 8, 1, 98)}%`;
  $("balance-status").textContent = balanced
    ? "IN BALANCE"
    : difference < 0
      ? "UNDER TARGET"
      : "OVER TARGET";
  $("balance-status").classList.toggle("warn", !balanced);
  $("temperature").textContent = Math.round(state.temperature);
  $("heat").textContent = Math.round(state.heat);
  $("condenser").textContent = Math.round(state.condenser);
  $("temp-bar").style.width =
    `${clamp((state.temperature - 200) / 1.35, 0, 100)}%`;
  $("heat-bar").style.width = `${state.heat}%`;
  $("cool-bar").style.width = `${clamp((state.condenser / 65) * 100, 0, 100)}%`;
  $("temp-bar").style.background =
    state.temperature > 315 ? "var(--red)" : "var(--amber)";
  const outage = state.output < 45 || !state.breaker;
  document.body.classList.toggle("emergency", outage);
  $("emergency-banner").hidden = !outage;
  $("plant-status").textContent = state.tripped
    ? "● SHUT DOWN"
    : !state.breaker
      ? "● GRID OPEN"
      : "● RUNNING";
  $("plant-status").style.color =
    state.tripped || !state.breaker ? "var(--amber)" : "var(--green)";
  document.querySelector(".hot.motion").style.opacity = clamp(
    state.steam / 25,
    0,
    1,
  );
  document.querySelector(".cold.motion").style.opacity = state.cooling / 100;
  $("score").textContent =
    state.elapsed < 10
      ? "SHIFT JUST STARTED"
      : `${Math.round((state.matched / state.elapsed) * 100)}% OF SHIFT IN BALANCE`;
  const ahead = demandAt(state.minute + 60, state.mode);
  $("forecast-text").textContent =
    `${Math.round(ahead)} MW expected in one hour. ${ahead > demand + 40 ? "Build heat before demand rises." : ahead < demand - 40 ? "Ease off as demand falls." : "Keep output steady and watch the wire."}`;
  $("advice").textContent = state.tripped
    ? state.temperature >= 305
      ? "The reactor has shut down. Keep cooling high. Restart becomes available below 305°C."
      : "The reactor is cooling. Select Restart when you are ready to bring it back online."
    : !state.breaker
      ? "The grid breaker is open. Connect it to supply electricity. Emergency lights use the auxiliary supply."
      : state.temperature > 310
        ? "Core temperature is rising. Increase cooling or reduce reactor power before the automatic shutdown at 335°C."
        : state.cooling < state.heat * 0.65
          ? "Cooling is low for this thermal load. Increase flow to carry away more heat."
          : state.turbine < 60 && difference < -50
            ? "Open the turbine valve to use more of the available steam."
            : !balanced
              ? difference < 0
                ? "Increase reactor power in small steps. Heat takes time to reach the turbine."
                : "Reduce reactor power, or close the turbine valve for a faster output reduction."
              : "The grid is balanced. Read the next headline and prepare for the change.";
  syncControls();
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
  step(state, dt);
  if (!state.paused) visualTime += dt;
  scene.draw(state, visualTime, lowMotion);
  if (!state.paused && !lowMotion)
    rotor =
      (rotor + dt * state.steam * Math.min(1, state.turbine / 72) * 2) % 360;
  $("turbine-rotor").setAttribute("transform", `rotate(${rotor} 201 56)`);
  if (state.minute - lastHistory >= 2) {
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
syncControls();
updateUI();
if (!stored) showGuide();
requestAnimationFrame(frame);
