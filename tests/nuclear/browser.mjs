import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initialState } from "../../static/nuclear/model.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
await page.addInitScript(() => {
  const seed = sessionStorage.getItem("baseload-test-seed");
  if (seed !== null) {
    localStorage.setItem("baseload-shift-v1", seed);
    sessionStorage.removeItem("baseload-test-seed");
  }
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});
const url = process.env.SIMULATOR_URL || "http://127.0.0.1:4178/nuclear/";
const seed = async (overrides) => {
  await page.evaluate(
    (state) =>
      sessionStorage.setItem("baseload-test-seed", JSON.stringify(state)),
    { ...initialState(), paused: true, briefed: true, ...overrides },
  );
  await page.reload();
  if (!overrides.meltdown) await page.locator("#continue-shift").click();
  await page.waitForTimeout(200);
};
try {
  await page.goto(url);
  assert.equal(await page.locator("#setup").evaluate((el) => el.open), true);
  await page.locator("input[name=mode][value=standard]").check();
  await page.locator("#start-shift").click();
  assert.match(
    await page.locator("#difficulty").innerText(),
    /STANDARD.*LOCKED/,
  );
  for (let i = 0; i < 6; i++) {
    assert.equal(await page.locator("#tutorial").isVisible(), true);
    await page.locator("#tutorial-next").click();
  }
  assert.equal(await page.locator("#tutorial").isVisible(), false);
  await page.waitForTimeout(800);
  assert.ok(
    Number(
      await page.locator("#core-animation").getAttribute("data-particles"),
    ) > 0,
  );
  const particlesBefore = await page
    .locator("#core-animation")
    .evaluate((el) => el.toDataURL());
  await page.waitForTimeout(150);
  assert.notEqual(
    particlesBefore,
    await page.locator("#core-animation").evaluate((el) => el.toDataURL()),
  );
  assert.equal(await page.locator("#pump-a,#pump-b,[data-bank]").count(), 0);
  await page.locator("#rod-insertion").fill("47");
  assert.equal(await page.locator("#rod-insertion").inputValue(), "47");
  await page.waitForTimeout(400);
  const position = Number(
    await page.locator("#core-animation").getAttribute("data-position"),
  );
  assert.ok(position > 42 && position < 47);
  await page.locator("#trip").click();
  await page.waitForTimeout(1300);
  assert.equal(
    await page.locator("#core-animation").getAttribute("data-position"),
    "100.0",
  );
  assert.equal(await page.locator("#rod-insertion").isDisabled(), true);
  await page.waitForTimeout(4000);
  assert.ok(
    Number(
      await page.locator("#core-animation").getAttribute("data-particles"),
    ) < 3,
  );
  await page.getByRole("button", { name: "RELEASE STOP", exact: true }).click();
  assert.equal(await page.locator("#rod-insertion").inputValue(), "100");
  assert.equal(await page.locator("#rod-insertion").isDisabled(), false);
  await page.locator("#rod-insertion").fill("95");
  assert.equal(await page.locator("#rod-insertion").inputValue(), "95");
  await page.reload();
  await page.locator("input[name=mode][value=challenging]").check();
  await page.locator("#continue-shift").click();
  assert.match(await page.locator("#difficulty").innerText(), /STANDARD/);
  assert.equal(await page.locator("#rod-insertion").inputValue(), "95");
  await seed({});
  await page.locator("#pump").click();
  assert.equal(
    await page.locator("#alarm-pumps").getAttribute("data-level"),
    "2",
  );
  await page.locator("#alarm-pumps").click();
  assert.match(await page.locator("#alarm-advice").innerText(), /pump/);
  assert.equal(
    await page.locator("#acknowledge,#insert-rods,#withdraw-rods").count(),
    0,
  );
  assert.equal(
    await page.locator("#pump").getAttribute("aria-pressed"),
    "false",
  );
  await page.locator("#pump").click();
  assert.equal(
    await page.locator("#alarm-pumps").getAttribute("data-level"),
    "0",
  );
  await page.locator("#feed-manual").click();
  await page.locator("#feed-less").click();
  assert.equal(await page.locator("#feedwater-value").innerText(), "60%");
  await page.locator("#feed-auto").click();
  assert.equal(await page.locator("#feed-less").isDisabled(), true);
  await page.locator("#bypass").click();
  assert.equal(
    await page.locator("#bypass").getAttribute("aria-pressed"),
    "true",
  );
  await seed({ minute: 0 });
  assert.match(await page.locator("#ticker-track").innerText(), /Kettle/);
  assert.doesNotMatch(
    await page.locator("#ticker-track").innerText(),
    /Minister|Bake-off/,
  );
  await page.locator("#open-news").click();
  assert.equal(await page.locator("#news .news-item").count(), 1);
  await page.getByRole("button", { name: "Close news" }).click();
  await seed({ minute: 225 });
  assert.match(
    await page.locator("#ticker-track").innerText(),
    /No demand events/,
  );
  assert.doesNotMatch(
    await page.locator("#ticker-track").innerText(),
    /Kettle/,
  );
  await seed({ minute: 240 });
  assert.match(await page.locator("#ticker-track").innerText(), /Minister/);
  assert.doesNotMatch(
    await page.locator("#ticker-track").innerText(),
    /Bake-off/,
  );
  await page.locator("#ticker-pause").click();
  assert.equal(
    await page.locator("#ticker-pause").getAttribute("aria-pressed"),
    "true",
  );
  for (const [temperature, stage] of [
    [350, "hot"],
    [430, "sparks"],
    [550, "fire"],
  ]) {
    await seed({ temperature });
    assert.equal(await page.locator("body").getAttribute("data-heat"), stage);
    assert.equal(
      await page.locator("#heat-effects").getAttribute("data-stage"),
      stage,
    );
    assert.equal(await page.locator("#rod-insertion").inputValue(), "42");
    assert.equal(await page.locator("#trip").innerText(), "EMERGENCY STOP");
  }
  await page.screenshot({
    path: join(tmpdir(), "baseload-v3-fire.png"),
    fullPage: true,
  });
  await seed({
    temperature: 699.9,
    heat: 100,
    rodInsertion: 0,
    rodPosition: 0,
    neutrons: 100,
    pump: false,
    paused: false,
  });
  await page.locator("#game-over").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("body").getAttribute("data-heat"),
    "meltdown",
  );
  assert.equal(await page.locator("#output").innerText(), "0");
  await page.locator("#inspect-meltdown").click();
  assert.equal(await page.locator("#trip").isDisabled(), true);
  assert.equal(await page.locator("#pump").isDisabled(), true);
  assert.equal(await page.locator("#rod-insertion").isDisabled(), true);
  const endClock = await page.locator("#clock").innerText();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#clock").innerText(), endClock);
  await page.reload();
  assert.equal(
    await page.locator("#game-over").evaluate((el) => el.open),
    true,
  );
  assert.equal(await page.locator("#setup").evaluate((el) => el.open), false);
  await page.locator("#new-after-meltdown").click();
  assert.equal(await page.locator("#continue-shift").isVisible(), false);
  await page.locator("input[name=mode][value=challenging]").check();
  await page.locator("#include-tutorial").uncheck();
  await page.locator("#start-shift").click();
  assert.equal(await page.locator("body").getAttribute("data-heat"), "normal");
  assert.equal(await page.locator("#clock").innerText(), "06:00");
  assert.match(await page.locator("#difficulty").innerText(), /CHALLENGING/);
  await seed({ paused: false });
  await page.waitForTimeout(1200);
  const normalParticles = Number(
    await page.locator("#core-animation").getAttribute("data-particles"),
  );
  await seed({
    paused: false,
    rodInsertion: 0,
    rodPosition: 0,
    neutrons: 400,
    heat: 350,
    cooling: 100,
  });
  await page.waitForTimeout(1200);
  const surgeParticles = Number(
    await page.locator("#core-animation").getAttribute("data-particles"),
  );
  assert.ok(surgeParticles > normalParticles * 2);
  assert.ok(surgeParticles <= 220);
  await seed({ minute: 195 });
  await page.locator("#motion").click();
  assert.equal(
    await page.locator("#motion").getAttribute("aria-pressed"),
    "true",
  );
  await page.waitForTimeout(100);
  const still = await page
    .locator("#core-animation")
    .evaluate((el) => el.toDataURL());
  await page.waitForTimeout(150);
  assert.equal(
    still,
    await page.locator("#core-animation").evaluate((el) => el.toDataURL()),
  );
  await page.screenshot({
    path: join(tmpdir(), "baseload-v3-desktop.png"),
    fullPage: true,
  });
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1280, 720],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    const d = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      actions: document.querySelector(".plant-actions").getBoundingClientRect()
        .bottom,
      rods: document.querySelector(".core-limit").getBoundingClientRect()
        .bottom,
      panel: document.querySelector(".plant-panel").getBoundingClientRect()
        .bottom,
    }));
    assert.ok(
      d.scrollWidth <= d.width,
      `horizontal overflow ${JSON.stringify(d)}`,
    );
    assert.ok(
      d.actions <= d.panel - 5 && d.rods <= d.panel - 5,
      `controls overflow ${JSON.stringify(d)}`,
    );
    if (width >= 1024 && height >= 768)
      assert.ok(
        d.scrollHeight <= d.height + 10,
        `desktop overflow ${JSON.stringify(d)}`,
      );
    console.log("Layout", d);
    if (width === 390)
      await page.screenshot({
        path: join(tmpdir(), "baseload-v3-mobile.png"),
        fullPage: true,
      });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: moving neutrons and rods, manual stop and residual response, single pump, persistent alarms, fixed difficulty, tutorial, feedwater, bypass, bounded news, escalating heat effects, terminal meltdown, saved game-over state, new shift and responsive layouts.",
  );
} finally {
  await browser.close();
}
