import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  step,
  shutdown,
  restart,
  restore,
  alarms,
  heatStage,
  newsEvents,
  events,
  demandAt,
  environment,
  MELTDOWN_TEMPERATURE,
} from "../../static/nuclear/model.mjs";
const run = (s, seconds) => {
  for (let i = 0; i < seconds * 20; i++) step(s, 0.05);
  return s;
};
test("control rods move towards their target before heat and power respond", () => {
  const s = initialState();
  s.rodInsertion = 100;
  run(s, 1);
  assert.ok(s.rodPosition > 42 && s.rodPosition < 50);
  assert.ok(s.neutrons < 58 && s.neutrons > 50);
  assert.ok(s.heat > 55);
  run(s, 60);
  assert.equal(s.rodPosition, 100);
  assert.ok(s.heat < 3);
  assert.ok(s.output < 30);
});
test("withdrawing rods increases sustained generation", () => {
  const s = initialState();
  s.rodInsertion = 10;
  s.cooling = 100;
  run(s, 100);
  assert.equal(s.rodPosition, 10);
  assert.ok(s.output > 850);
  assert.equal(s.meltdown, false);
});
test("emergency stop rapidly inserts rods but does not remove residual heat", () => {
  const s = initialState();
  shutdown(s);
  run(s, 1);
  assert.equal(s.rodPosition, 100);
  assert.ok(s.neutrons < 35);
  assert.ok(s.heat > 50);
  assert.equal(s.scrammed, true);
  run(s, 60);
  assert.ok(s.heat < 2);
  assert.equal(s.meltdown, false);
});
test("releasing emergency stop does not withdraw the rods automatically", () => {
  const s = initialState();
  shutdown(s);
  run(s, 2);
  assert.equal(restart(s), true);
  run(s, 5);
  assert.equal(s.scrammed, false);
  assert.equal(s.rodInsertion, 100);
  assert.equal(s.rodPosition, 100);
});
test("high temperature, high pressure and low water never cause automatic rod insertion", () => {
  for (const overrides of [
    { temperature: 420 },
    { pressure: 110 },
    { water: 12, feedAuto: false, feedwater: 0 },
  ]) {
    const s = Object.assign(initialState(), overrides);
    run(s, 1);
    assert.equal(s.scrammed, false);
    assert.equal(s.rodInsertion, 42);
    assert.equal(s.meltdown, false);
  }
});
test("leaving the pump off reaches all heat stages and causes a terminal meltdown", () => {
  const s = initialState();
  s.pump = false;
  const stages = new Set();
  for (let i = 0; i < 4000 && !s.meltdown; i++) {
    step(s, 0.05);
    stages.add(heatStage(s));
  }
  assert.deepEqual(
    [...stages],
    ["normal", "hot", "sparks", "fire", "meltdown"],
  );
  assert.equal(s.temperature, MELTDOWN_TEMPERATURE);
  assert.equal(s.output, 0);
  assert.equal(s.breaker, false);
  const before = structuredClone(s);
  run(s, 50);
  assert.deepEqual(s, before);
  assert.equal(shutdown(s), false);
  assert.equal(restart(s), false);
});
test("emergency stop and cooling can recover a dangerously hot reactor", () => {
  const s = initialState();
  s.pump = false;
  run(s, 70);
  assert.ok(s.temperature > 450);
  shutdown(s);
  s.pump = true;
  s.cooling = 100;
  run(s, 100);
  assert.equal(s.meltdown, false);
  assert.ok(s.temperature < 310);
});
test("low feedwater can cause meltdown without an automatic trip", () => {
  const s = initialState();
  s.feedAuto = false;
  s.feedwater = 0;
  run(s, 180);
  assert.equal(s.scrammed, false);
  assert.equal(s.meltdown, true);
});
test("automatic feedwater restores a low drum before it causes core failure", () => {
  const s = initialState();
  s.feedAuto = false;
  s.feedwater = 0;
  run(s, 15);
  assert.ok(s.water < 40);
  s.feedAuto = true;
  run(s, 90);
  assert.ok(s.water > 60);
  assert.equal(s.meltdown, false);
});
test("steam bypass relieves pressure at the cost of output", () => {
  const s = initialState();
  s.turbine = 15;
  run(s, 12);
  const pressure = s.pressure;
  s.bypass = true;
  run(s, 30);
  assert.ok(s.pressure < pressure - 10);
  const normal = run(initialState(), 40),
    bypass = initialState();
  bypass.bypass = true;
  run(bypass, 40);
  assert.ok(bypass.output < normal.output * 0.6);
});
test("pause freezes physics and the clock", () => {
  const s = initialState();
  s.paused = true;
  const before = structuredClone(s);
  run(s, 100);
  assert.deepEqual(s, before);
});
test("a normal shift remains stable for a complete simulated day", () => {
  const s = run(initialState(), 900);
  assert.ok(Math.abs(s.minute - 1440) < 0.001);
  assert.equal(s.meltdown, false);
  assert.ok(s.temperature < 310);
  assert.equal(environment(s.minute + 0.001).date.getUTCDate(), 2);
});
test("news only exposes active events and the next three hours", () => {
  assert.deepEqual(
    newsEvents(0).map((e) => e.hour),
    [8],
  );
  assert.equal(newsEvents(225).length, 0);
  assert.deepEqual(
    newsEvents(240).map((e) => e.hour),
    [13],
  );
  for (let minute = 0; minute < 1440 * 4; minute += 7) {
    const news = newsEvents(minute);
    assert.ok(news.length <= 3);
    assert.ok(news.every((e) => e.at <= minute + 180 && e.end > minute));
  }
});
test("events disappear from the feed when they finish", () => {
  const e = events(0)[0];
  assert.ok(newsEvents(e.end - 0.1).some((n) => n.at === e.at));
  assert.ok(!newsEvents(e.end).some((n) => n.at === e.at));
});
test("demand is finite across dates and difficulties", () => {
  for (const mode of ["relaxed", "standard", "challenging"])
    for (let m = 0; m < 1440 * 7; m += 19) {
      const d = demandAt(m, mode);
      assert.ok(d >= 260 && d <= 1040);
    }
});
test("current saves preserve controls, difficulty and game over", () => {
  const s = initialState("challenging");
  s.rodInsertion = 67;
  s.pump = false;
  run(s, 20);
  assert.deepEqual(restore(JSON.stringify(s)), s);
  s.temperature = 700;
  step(s, 0.05);
  const saved = restore(JSON.stringify(s));
  assert.equal(saved.meltdown, true);
  assert.equal(saved.paused, true);
  assert.equal(saved.mode, "challenging");
});
test("old saves migrate to one rod control and one pump", () => {
  const legacy = {
    ...initialState("standard"),
    version: 2,
    rods: [20, 50, 80],
    pumps: [false, true],
    tripped: false,
  };
  const s = restore(JSON.stringify(legacy));
  assert.equal(s.version, 3);
  assert.equal(s.rodInsertion, 50);
  assert.equal(s.pump, true);
  assert.equal(s.mode, "standard");
  assert.equal(s.briefed, false);
  const stopped = restore(JSON.stringify({ ...legacy, tripped: true }));
  assert.equal(stopped.scrammed, true);
  assert.equal(stopped.rodInsertion, 100);
  const oldest = restore(
    JSON.stringify({ ...legacy, version: 1, reactor: 75 }),
  );
  assert.equal(oldest.rodInsertion, 25);
});
test("invalid saves fail safely", () => {
  for (const value of [
    "null",
    "{}",
    "{",
    JSON.stringify({ ...initialState(), rodInsertion: 101 }),
    JSON.stringify({ ...initialState(), mode: "__proto__" }),
  ])
    assert.deepEqual(restore(value), initialState());
});
test("alarms give recovery advice without promising automatic protection", () => {
  const s = initialState();
  s.pump = false;
  s.temperature = 520;
  const list = alarms(s);
  assert.equal(list.find((a) => a.id === "limit").level, 2);
  assert.equal(list.find((a) => a.id === "pumps").level, 2);
  assert.ok(
    list.find((a) => a.id === "core").action.includes("no automatic shutdown"),
  );
});
