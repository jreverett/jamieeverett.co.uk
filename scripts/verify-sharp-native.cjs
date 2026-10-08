const fs = require("node:fs/promises")
const os = require("node:os")
const path = require("node:path")
const assert = require("node:assert/strict")
const { repair } = require("./sharp-trim-compat.cjs")
async function verifyNativeTrim() {
  repair(undefined, { verifyOnly: true })
  const sharp = require("sharp")
  const { processFile } = require("gatsby-plugin-sharp/process-file")
  const { generateBase64 } = require("gatsby-plugin-sharp")
  const { createTransformObject, mergeDefaults, setPluginOptions, getPluginOptions } = require("gatsby-plugin-sharp/plugin-options")
  const savedOptions = { ...getPluginOptions(), defaults: getPluginOptions().defaults }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "site-sharp-trim-"))
  try {
    const input = path.join(directory, "border.png")
    const buffer = Buffer.alloc(32 * 32 * 3, 255)
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) buffer.fill(0, (y * 32 + x) * 3, (y * 32 + x) * 3 + 3)
    await sharp(buffer, { raw: { width: 32, height: 32, channels: 3 } }).png().toFile(input)
    let operations = 0
    for (const defaults of [false, true]) {
      setPluginOptions({ defaults: defaults ? { trim: 10 } : undefined })
      for (const format of ["png", "webp", "avif"]) {
        const args = createTransformObject(mergeDefaults({ toFormat: format, width: 16, height: 16, ...(defaults ? {} : { trim: 10 }) }))
        const outputPath = path.join(directory, `${defaults}-${format}.${format}`)
        await processFile(input, [{ outputPath, args }], { stripMetadata: true })
        const metadata = await sharp(outputPath).metadata()
        assert.equal(metadata.width, 16)
        assert.equal(metadata.height, 16)
        const stats = await sharp(outputPath).stats()
        assert(stats.channels.slice(0, 3).every(channel => channel.max <= 4), "Trimmed output must contain no white border")
        operations++
      }
    }
    setPluginOptions({ defaults: undefined })
    const inline = await generateBase64({ file: { absolutePath: input, extension: "png" }, args: { trim: 10, base64Width: 16 } })
    assert.match(inline.src, /^data:image\//)
    const metadata = await sharp(Buffer.from(inline.src.split(",")[1], "base64")).metadata()
    assert.equal(metadata.width, 16)
    assert.equal(metadata.height, 16)
    return { platform: process.platform, arch: process.arch, node: process.version, versions: sharp.versions, freshTransforms: operations, numericTrim: true, mergedDefaultTrim: true, inlinePreview: true }
  } finally {
    setPluginOptions(savedOptions)
    const resolved = path.resolve(directory)
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + "site-sharp-trim-")) throw new Error("Refusing cleanup outside probe directory")
    await fs.rm(resolved, { recursive: true, force: true })
  }
}
module.exports = { verifyNativeTrim }
if (require.main === module) verifyNativeTrim().then(result => console.log("FRESH_SHARP_NATIVE_PROOF", JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1 })
