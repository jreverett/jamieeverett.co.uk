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
  await page.locator("#continue-shift").click();
  await page.waitForTimeout(200);
};
try {
  await page.goto(url);
  assert.equal(await page.locator("#setup").evaluate((el) => el.open), true);
  const frozen = await page.locator("#clock").innerText();
  await page.waitForTimeout(300);
  assert.equal(await page.locator("#clock").innerText(), frozen);
  await page.locator("input[name=mode][value=standard]").check();
  await page.locator("#start-shift").click();
  assert.match(
    await page.locator("#difficulty").innerText(),
    /STANDARD.*LOCKED/,
  );
  assert.equal(await page.locator("#tutorial").isVisible(), true);
  assert.equal(await page.locator("#pause").isDisabled(), true);
  for (let i = 0; i < 6; i++) {
    assert.match(
      await page.locator("#tutorial-step").innerText(),
      new RegExp(`0${i + 1} / 06`),
    );
    await page.locator("#tutorial-next").click();
  }
  assert.equal(await page.locator("#tutorial").isVisible(), false);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Withdraw bank A rods" }).click();
  assert.equal(await page.locator("#bank-0-value").innerText(), "63%");
  await page.getByRole("button", { name: "Insert bank C rods" }).click();
  await page.locator("#equalise").click();
  assert.equal(await page.locator("#bank-0-value").innerText(), "58%");
  await page.locator("#pump-a").click();
  assert.equal(
    await page.locator("#alarm-pumps").getAttribute("data-level"),
    "1",
  );
  assert.equal(
    await page
      .locator("#alarm-pumps")
      .evaluate((el) => el.classList.contains("unacknowledged")),
    true,
  );
  await page.locator("#alarm-pumps").click();
  assert.match(
    await page.locator("#alarm-advice").innerText(),
    /Switch on both primary pumps/,
  );
  await page.locator("#acknowledge").click();
  assert.equal(
    await page
      .locator("#alarm-pumps")
      .evaluate((el) => el.classList.contains("acknowledged")),
    true,
  );
  assert.equal(
    await page.locator("#pump-a").getAttribute("aria-pressed"),
    "false",
  );
  await page.locator("#pump-b").click();
  assert.equal(
    await page.locator("#alarm-pumps").getAttribute("data-level"),
    "2",
  );
  assert.equal(
    await page
      .locator("#alarm-pumps")
      .evaluate((el) => el.classList.contains("unacknowledged")),
    true,
  );
  await page.locator("#pump-a").click();
  await page.locator("#pump-b").click();
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
  await page.reload();
  assert.equal(await page.locator("#setup").evaluate((el) => el.open), true);
  await page.locator("input[name=mode][value=challenging]").check();
  await page.locator("#continue-shift").click();
  assert.match(await page.locator("#difficulty").innerText(), /STANDARD/);
  assert.equal(
    await page.locator("#bypass").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator("#tutorial").isVisible(), false);
  await page.locator("#help").click();
  await page.locator("#tutorial-skip").click();
  assert.equal(
    await page
      .getByRole("button", { name: "Resume simulation", exact: true })
      .count(),
    1,
  );
  await seed({ bankHeat: [20, 58, 90], rods: [20, 58, 90] });
  const colours = await page
    .locator(".fuel-cell")
    .evaluateAll((cells) => [
      getComputedStyle(cells[37]).backgroundColor,
      getComputedStyle(cells[43]).backgroundColor,
    ]);
  assert.notEqual(colours[0], colours[1]);
  assert.equal(
    await page.locator("#alarm-banks").getAttribute("data-level"),
    "2",
  );
  await seed({ minute: 120, cooling: 100 });
  assert.match(await page.locator("#ticker-track").innerText(), /Kettle/);
  const highPlume = await page
    .locator("#landscape")
    .evaluate((el) => el.toDataURL());
  await seed({ minute: 120, cooling: 0 });
  assert.notEqual(
    highPlume,
    await page.locator("#landscape").evaluate((el) => el.toDataURL()),
  );
  await page.locator("#ticker-pause").click();
  assert.equal(
    await page.locator("#ticker-pause").getAttribute("aria-pressed"),
    "true",
  );
  await page.locator("#open-news").click();
  assert.match(await page.locator("#news").innerText(), /HAPPENING NOW/);
  await page.getByRole("button", { name: "Close news" }).click();
  await seed({ breaker: false });
  assert.equal(await page.locator("#emergency-banner").isVisible(), true);
  await page.locator("#breaker").click();
  assert.equal(await page.locator("#emergency-banner").isVisible(), false);
  await page.locator("#trip").click();
  assert.equal(
    await page
      .getByRole("button", { name: "Withdraw bank A rods" })
      .isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "RESTART", exact: true }).click();
  assert.equal(await page.locator("#bank-0-value").innerText(), "35%");
  await seed({
    tripped: true,
    tripReason: "High steam pressure",
    pressure: 100,
  });
  assert.equal(
    await page.getByRole("button", { name: "RESTART LOCKED" }).isDisabled(),
    true,
  );
  assert.equal(
    await page.locator("#alarm-pressure").getAttribute("data-level"),
    "2",
  );
  await seed({
    minute: 195,
    bankHeat: [44, 58, 73],
    rods: [44, 58, 73],
    pumps: [true, false],
  });
  await page.screenshot({
    path: join(tmpdir(), "baseload-v2-desktop.png"),
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
    await page.waitForTimeout(120);
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      actionsBottom: document
        .querySelector(".plant-actions")
        .getBoundingClientRect().bottom,
      panelBottom: document
        .querySelector(".plant-panel")
        .getBoundingClientRect().bottom,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.width,
      `horizontal overflow ${JSON.stringify(dimensions)}`,
    );
    assert.ok(
      dimensions.actionsBottom <= dimensions.panelBottom - 5,
      `controls overflow panel ${JSON.stringify(dimensions)}`,
    );
    if (width >= 1024)
      assert.ok(
        dimensions.scrollHeight <= dimensions.height + 10,
        `desktop overflow ${JSON.stringify(dimensions)}`,
      );
    console.log("Layout", dimensions);
    if (width === 390)
      await page.screenshot({
        path: join(tmpdir(), "baseload-v2-mobile.png"),
        fullPage: true,
      });
  }
  await page.locator("#reset").click();
  await page.locator("input[name=mode][value=challenging]").check();
  await page.locator("#include-tutorial").uncheck();
  await page.locator("#start-shift").click();
  assert.match(await page.locator("#difficulty").innerText(), /CHALLENGING/);
  assert.equal(await page.locator("#clock").innerText(), "06:00");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: difficulty selection and locking, tutorial, rod banks, fuel grid, alarm severity and acknowledgement, pumps, feedwater, bypass, saved game, news, plumes, lighting, recovery and responsive layouts.",
  );
} finally {
  await browser.close();
}
