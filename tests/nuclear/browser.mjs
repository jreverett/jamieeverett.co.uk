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
    { ...initialState(), paused: true, ...overrides },
  );
  await page.reload();
  await page.waitForTimeout(150);
};
try {
  await page.goto(url);
  assert.equal(await page.locator("#guide").evaluate((el) => el.open), true);
  await page.getByRole("button", { name: "TAKE THE CONTROLS" }).click();
  await page.getByRole("button", { name: "Pause simulation" }).click();
  const clock = await page.locator("#clock").innerText();
  await page.waitForTimeout(400);
  assert.equal(await page.locator("#clock").innerText(), clock);
  await page.locator("#reactor").focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page.locator("#reactor").inputValue(),
    String(initialState().reactor + 1),
  );
  await page.locator("#cooling").click({ position: { x: 10, y: 12 } });
  assert.ok(Number(await page.locator("#cooling").inputValue()) < 10);
  await page.getByRole("button", { name: "6×", exact: true }).click();
  await page.locator("#difficulty").selectOption("challenging");
  await page.locator("#help").click();
  await page.getByRole("button", { name: "Close guide" }).click();
  await page.reload();
  assert.equal(
    await page.locator("#reactor").inputValue(),
    String(initialState().reactor + 1),
  );
  assert.equal(await page.locator("#difficulty").inputValue(), "challenging");
  assert.equal(
    await page
      .getByRole("button", { name: "6×", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await seed({ minute: 120, cooling: 100 });
  assert.match(await page.locator("#news").innerText(), /HAPPENING NOW/);
  const highPlume = await page
    .locator("#landscape")
    .evaluate((el) => el.toDataURL());
  await seed({ minute: 120, cooling: 0 });
  const lowPlume = await page
    .locator("#landscape")
    .evaluate((el) => el.toDataURL());
  assert.notEqual(highPlume, lowPlume, "cooling must change the visible plume");
  await seed({ minute: 870, breaker: true, output: 606 });
  const powered = await page
    .locator("#landscape")
    .evaluate((el) => el.toDataURL());
  await page.locator("#breaker").click();
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#emergency-banner").isVisible(), true);
  assert.notEqual(
    powered,
    await page.locator("#landscape").evaluate((el) => el.toDataURL()),
    "power loss must change building lights",
  );
  await page.screenshot({ path: join(tmpdir(), "baseload-emergency.png") });
  await page.locator("#breaker").click();
  assert.equal(await page.locator("#emergency-banner").isVisible(), false);
  await page.locator("#trip").click();
  assert.equal(await page.locator("#reactor").isDisabled(), true);
  await page.getByRole("button", { name: "RESTART", exact: true }).click();
  assert.equal(await page.locator("#reactor").isDisabled(), false);
  assert.equal(await page.locator("#reactor").inputValue(), "35");
  await seed({ tripped: true, reactor: 0, temperature: 330 });
  assert.equal(
    await page.getByRole("button", { name: "COOLING DOWN" }).isDisabled(),
    true,
  );
  await seed({ minute: 195, cooling: 82 });
  await page.locator("#look-right").click();
  assert.equal(await page.locator("#bearing").innerText(), "110° E");
  await page.locator("#motion").click();
  assert.equal(
    await page.locator("#motion").getAttribute("aria-pressed"),
    "true",
  );
  await page.screenshot({
    path: join(tmpdir(), "baseload-desktop.png"),
    fullPage: true,
  });
  for (const [width, height] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.width,
      `horizontal overflow at ${width}`,
    );
    if (width >= 1024)
      assert.ok(
        dimensions.scrollHeight <= dimensions.height + 10,
        `desktop should fit one screen: ${JSON.stringify(dimensions)}`,
      );
    console.log("Layout", dimensions);
    if (width === 390)
      await page.screenshot({
        path: join(tmpdir(), "baseload-mobile.png"),
        fullPage: true,
      });
  }
  await page.locator("#reset").click();
  await page.getByRole("button", { name: "Keep this shift" }).click();
  assert.equal(await page.locator("#cooling").inputValue(), "82");
  await page.locator("#reset").click();
  await page.getByRole("button", { name: "Start again" }).click();
  assert.equal(
    await page.locator("#cooling").inputValue(),
    String(initialState().cooling),
  );
  assert.equal(await page.locator("#clock").innerText(), "06:00");
  await page.evaluate(() =>
    sessionStorage.setItem("baseload-test-seed", "corrupt"),
  );
  await page.reload();
  assert.equal(
    await page.locator("#reactor").inputValue(),
    String(initialState().reactor),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: controls, pause, difficulty, persistence, news, visible plumes, emergency lighting, restart, pan, reduced motion, responsive layouts, reset and corrupt-save recovery.",
  );
} finally {
  await browser.close();
}
