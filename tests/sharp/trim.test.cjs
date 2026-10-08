const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const { spawnSync } = require("node:child_process")
const { repair } = require("../../scripts/sharp-trim-compat.cjs")
test("installed trim patch is verified and idempotent", () => {
  const target = require.resolve("gatsby-plugin-sharp/process-file")
  const before = fs.readFileSync(target)
  repair()
  repair(undefined, { verifyOnly: true })
  assert.deepEqual(fs.readFileSync(target), before)
})
test("fresh child process covers worker numeric/default trim and inline previews", () => {
  const result = spawnSync(process.execPath, [path.resolve(__dirname, "../../scripts/verify-sharp-native.cjs")], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stderr + result.stdout)
  const line = result.stdout.split(/\r?\n/).find(line => line.startsWith("FRESH_SHARP_NATIVE_PROOF "))
  const proof = JSON.parse(line.slice("FRESH_SHARP_NATIVE_PROOF ".length))
  assert.equal(proof.versions.sharp, "0.35.5")
  assert.equal(proof.freshTransforms, 6)
  assert.equal(proof.inlinePreview, true)
})
test("numeric conversion preserves unsupported values for Sharp validation", () => {
  // Native API still rejects invalid options; the caller adapter must not suppress errors.
  const sharp = require("sharp")
  assert.throws(() => sharp().trim({ threshold: -1 }))
  assert.throws(() => sharp().trim("invalid"))
})

test("legacy fixed, fluid and resize dispatch numeric trim through real native jobs", async () => {
  const fsp = require("node:fs/promises")
  const os = require("node:os")
  const sharp = require("sharp")
  const plugin = require("gatsby-plugin-sharp")
  const { processFile } = require("gatsby-plugin-sharp/process-file")
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "site-sharp-legacy-"))
  const oldDirectory = process.cwd()
  const jobs = []
  const reporter = { panic: (...args) => { throw new Error(args.join(" ")) }, warn() {}, info() {}, verbose() {} }
  try {
    process.chdir(directory)
    const input = path.join(directory, "input.png")
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "white" } }).composite([{ input: Buffer.from('<svg width="32" height="32"><rect x="8" y="8" width="16" height="16" fill="black"/></svg>') }]).png().toFile(input)
    const file = { absolutePath: input, extension: "png", base: "input.png", name: "input", internal: { contentDigest: "trim-fixture" } }
    plugin.setActions({ createJobV2: job => {
      const run = processFile(job.inputPaths[0], job.args.operations.map(operation => ({ ...operation, outputPath: path.join(job.outputDir, operation.outputPath) })), job.args.pluginOptions)
      jobs.push(run)
      return run
    } })
    assert(await plugin.fixed({ file, args: { width: 16, height: 16, trim: 10, toFormat: "png" }, reporter }))
    assert(await plugin.fluid({ file, args: { maxWidth: 16, trim: 10, toFormat: "png", srcSetBreakpoints: [16] }, reporter }))
    const resized = plugin.resize({ file, args: { width: 16, trim: 10, toFormat: "png" }, reporter })
    await resized.finishedPromise
    await Promise.all(jobs)
    assert(jobs.length >= 3)
    assert.equal((await sharp(resized.absolutePath).metadata()).width, 16)
  } finally {
    plugin.setActions(undefined)
    process.chdir(oldDirectory)
    const resolved = path.resolve(directory)
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + "site-sharp-legacy-")) throw new Error("Unsafe fixture cleanup path")
    await fsp.rm(resolved, { recursive: true, force: true })
  }
})

test("unexpected installed code fails closed without changing either file", async () => {
  const fsp = require("node:fs/promises")
  const os = require("node:os")
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "site-sharp-patch-test-"))
  try {
    const plugin = path.join(directory, "node_modules/gatsby-plugin-sharp")
    const native = path.join(directory, "node_modules/sharp")
    await fsp.mkdir(plugin, { recursive: true })
    await fsp.mkdir(native, { recursive: true })
    await fsp.writeFile(path.join(plugin, "package.json"), JSON.stringify({ version: "5.16.0" }))
    await fsp.writeFile(path.join(native, "package.json"), JSON.stringify({ version: "0.35.5" }))
    for (const name of ["process-file.js", "index.js"]) await fsp.copyFile(require.resolve(`gatsby-plugin-sharp/${name}`), path.join(plugin, name))
    await fsp.appendFile(path.join(plugin, "index.js"), "\n// Unknown upstream change\n")
    const before = await fsp.readFile(path.join(plugin, "process-file.js"))
    assert.throws(() => repair(directory), /Unexpected index.js/)
    assert.deepEqual(await fsp.readFile(path.join(plugin, "process-file.js")), before)
    // Recreate pristine upstream callers and simulate a preloaded module.
    for (const name of ["process-file.js", "index.js"]) {
      const source = await fsp.readFile(require.resolve(`gatsby-plugin-sharp/${name}`), "utf8")
      const upstream = source.replace(/\.trim\(typeof ([A-Za-z]+)\.trim === "number" \? \{ threshold: \1\.trim \} : \1\.trim\)/g, ".trim($1.trim)")
      await fsp.writeFile(path.join(plugin, name), upstream)
    }
    const cachedFile = path.join(plugin, "index.js")
    const pristine = await fsp.readFile(path.join(plugin, "process-file.js"))
    require.cache[cachedFile] = { exports: {}, loaded: true }
    try {
      assert.throws(() => repair(directory), /refusing to patch a cached module/)
      assert.deepEqual(await fsp.readFile(path.join(plugin, "process-file.js")), pristine)
    } finally {
      delete require.cache[cachedFile]
    }
    await fsp.writeFile(path.join(native, "package.json"), JSON.stringify({ version: "0.36.0" }))
    assert.throws(() => repair(directory), /requires sharp@0.35.5/)
  } finally {
    const resolved = path.resolve(directory)
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + "site-sharp-patch-test-")) throw new Error("Unsafe fixture cleanup path")
    await fsp.rm(resolved, { recursive: true, force: true })
  }
})
