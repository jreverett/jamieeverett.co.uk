import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  step,
  demandAt,
  environment,
  events,
  restore,
  MODES,
} from "../../static/nuclear/model.mjs";
const run = (state, seconds) => {
  for (let i = 0; i < seconds * 20; i++) step(state, 0.05);
  return state;
};
test("heat and output lag a reactor increase", () => {
  const state = Object.assign(initialState(), { reactor: 90 });
  run(state, 1);
  assert.ok(state.heat > 58 && state.heat < 64);
  assert.ok(state.output < 650);
  run(state, 90);
  assert.ok(state.output > 780);
});
test("inadequate cooling trips the reactor and cooling permits recovery", () => {
  const state = Object.assign(initialState(), { reactor: 100, cooling: 0 });
  run(state, 30);
  assert.equal(state.tripped, true);
  assert.equal(state.reactor, 0);
  assert.ok(state.heat > 0);
  state.cooling = 100;
  run(state, 120);
  assert.ok(state.temperature < 305);
  assert.ok(state.output < 1);
});
test("cooling restores output when condenser heat limits generation", () => {
  const limited = Object.assign(initialState(), { reactor: 85, cooling: 45 });
  run(limited, 35);
  const improved = structuredClone(limited);
  improved.cooling = 100;
  run(improved, 60);
  run(limited, 60);
  assert.ok(improved.output > limited.output + 60);
  assert.ok(improved.condenser < limited.condenser);
  assert.ok(improved.temperature < limited.temperature);
});
test("closing the turbine reduces electricity without instantly removing heat", () => {
  const state = Object.assign(initialState(), { turbine: 0 });
  run(state, 30);
  assert.ok(state.output < 1);
  assert.equal(state.heat, 58);
});
test("the breaker removes grid output and allows reconnection", () => {
  const state = Object.assign(initialState(), { breaker: false });
  run(state, 40);
  assert.ok(state.output < 1);
  state.breaker = true;
  run(state, 40);
  assert.ok(state.output > 590);
});
test("pause freezes all physics and the clock", () => {
  const state = Object.assign(initialState(), { paused: true });
  const before = structuredClone(state);
  run(state, 100);
  assert.deepEqual(state, before);
});
test("one day takes fifteen minutes at normal speed", () => {
  const state = run(initialState(), 900);
  assert.ok(Math.abs(state.minute - 1440) < 0.001);
  assert.equal(environment(state.minute + 0.001).date.getUTCDate(), 2);
});
test("news changes the demand forecast at its published time", () => {
  const story = events(0)[0];
  assert.equal(story.hour, 8);
  assert.equal(
    demandAt(story.at - 1, "relaxed"),
    demandAt(story.at - 1, "challenging"),
  );
  const difference =
    demandAt(story.at + 20, "challenging") - demandAt(story.at + 20, "relaxed");
  assert.ok(
    Math.abs(
      difference - story.mw * (MODES.challenging.scale - MODES.relaxed.scale),
    ) < 0.01,
  );
});
test("demand and forecasts remain finite across dates and difficulties", () => {
  for (const mode of Object.keys(MODES))
    for (let minute = 0; minute < 1440 * 14; minute += 17) {
      const demand = demandAt(minute, mode);
      assert.ok(demand >= 260 && demand <= 1040);
      assert.ok(
        events(minute).filter((event) => event.end > minute).length >= 3,
      );
    }
});
test("corrupt saves fall back safely and valid saves restore controls", () => {
  for (const raw of [
    "null",
    "{}",
    "{",
    '{"version":1,"mode":"wrong"}',
    JSON.stringify({ ...initialState(), cooling: 1000 }),
  ])
    assert.deepEqual(restore(raw), initialState());
  const state = Object.assign(initialState(), {
    reactor: 75,
    speed: 3,
    mode: "standard",
    minute: 543,
  });
  assert.deepEqual(restore(JSON.stringify(state)), state);
});
test("extreme controls remain finite and bounded across a shift", () => {
  for (const reactor of [0, 100])
    for (const cooling of [0, 100]) {
      const state = Object.assign(initialState(), {
        reactor,
        cooling,
        speed: 6,
      });
      run(state, 150);
      for (const key of ["output", "heat", "steam", "temperature", "condenser"])
        assert.ok(Number.isFinite(state[key]), key);
      assert.ok(state.temperature <= 370);
      assert.ok(state.output >= 0 && state.output < 1100);
    }
});
