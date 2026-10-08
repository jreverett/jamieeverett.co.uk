const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const targets = [
  ["process-file.js", "cb6019ba71d3d8b82d3ea7203070d2c0896d5534817d0128ceb88f2d621acd68", "clonedPipeline.trim(transformArgs.trim)", 'clonedPipeline.trim(typeof transformArgs.trim === "number" ? { threshold: transformArgs.trim } : transformArgs.trim)'],
  ["index.js", "27d16088b3c06fb88263e3bdcc318095b9130f043f250fa29e0da84de1aa213e", "pipeline.trim(options.trim)", 'pipeline.trim(typeof options.trim === "number" ? { threshold: options.trim } : options.trim)'],
]
const hash = value => crypto.createHash("sha256").update(value).digest("hex")
function repair(root = path.resolve(__dirname, ".."), { verifyOnly = false } = {}) {
  const plugin = path.join(root, "node_modules/gatsby-plugin-sharp")
  for (const [name, version] of [["gatsby-plugin-sharp", "5.16.0"], ["sharp", "0.35.5"]]) {
    const installed = JSON.parse(fs.readFileSync(path.join(root, "node_modules", name, "package.json"))).version
    if (installed !== version) throw new Error(`Sharp trim compatibility requires ${name}@${version}; got ${installed}. Review/remove the patch before updating.`)
  }
  // Validate both files before writing either; never patch unknown upstream code.
  const changes = targets.map(([file, expectedHash, before, after]) => {
    const filename = path.join(plugin, file)
    const source = fs.readFileSync(filename, "utf8")
    const original = source.includes(after) ? source.replace(after, before) : source
    if (hash(original) !== expectedHash) throw new Error(`Unexpected ${file}; refusing to apply Sharp trim compatibility`)
    if (verifyOnly && !source.includes(after)) throw new Error(`Missing Sharp trim repair in ${file}; run npm install or npm run build`)
    return [filename, original.replace(before, after), source]
  })
  if (!verifyOnly) {
    for (const [filename, patched, source] of changes) {
      if (patched !== source && require.cache[filename]) throw new Error(`Apply Sharp trim repair before loading ${filename}; refusing to patch a cached module`)
    }
    for (const [filename, patched, source] of changes) if (patched !== source) fs.writeFileSync(filename, patched)
  }
  return { plugin: "5.16.0", sharp: "0.35.5", files: changes.map(([filename]) => path.basename(filename)) }
}
module.exports = { repair }
if (require.main === module) console.log("Sharp trim compatibility:", JSON.stringify(repair()))
