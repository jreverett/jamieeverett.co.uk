// Validates a submission against FLAG_HASH (an env var, never in the repo) and,
// on success, returns/extends a small roll of {name, ts}. Persisted in Netlify
// Blobs in production; if Blobs isn't reachable (e.g. a local `netlify dev`
// without a linked site) it falls back to a temp file so names survive the
// function cold-starting between requests.
const crypto = require("node:crypto")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const FLAG_HASH = process.env.FLAG_HASH || ""
const MAX_NAME = 32
const MAX_ROLL = 500
const RL_PER_DAY = 1 // one Hall-of-Fame entry per IP per day
const FALLBACK_FILE = path.join(os.tmpdir(), "void-roll.json")

const sha256 = s => crypto.createHash("sha256").update(String(s), "utf8").digest("hex")

function clean(name) {
  let out = ""
  for (const ch of String(name || "")) {
    const c = ch.codePointAt(0)
    if (c >= 32 && c !== 127) out += ch
  }
  return out.replace(/\s+/g, " ").trim().slice(0, MAX_NAME)
}

const json = (statusCode, obj) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(obj),
})

// Returns a usable store, or null if Blobs isn't available (we probe with a read
// so a missing local context surfaces here, not mid-write).
async function openStore() {
  try {
    const { getStore } = await import("@netlify/blobs")
    const store = getStore("void-roll")
    await store.get("roll")
    return store
  } catch (e) {
    return null
  }
}

function readFallback() {
  try {
    const data = JSON.parse(fs.readFileSync(FALLBACK_FILE, "utf8"))
    return Array.isArray(data) ? data : []
  } catch (e) {
    return []
  }
}

function writeFallback(roll) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(roll))
  } catch (e) {
    // best-effort
  }
}

async function underRateLimit(store, event) {
  if (!store) return true // no durable counter locally; don't block testing
  try {
    const ip = (
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["x-forwarded-for"] ||
      "0.0.0.0"
    )
      .split(",")[0]
      .trim()
    const day = new Date().toISOString().slice(0, 10)
    const rlKey = `rl:${day}:${sha256(ip).slice(0, 16)}`
    const count = Number((await store.get(rlKey)) || 0)
    if (count >= RL_PER_DAY) return false
    await store.set(rlKey, String(count + 1))
    return true
  } catch (e) {
    return true
  }
}

exports.handler = async event => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false })
  }

  let body
  try {
    body = JSON.parse(event.body || "{}")
  } catch (e) {
    return json(400, { ok: false })
  }

  const flag = String(body.flag || "").trim()
  if (!FLAG_HASH || sha256(flag) !== FLAG_HASH) {
    return json(200, { ok: false })
  }

  const store = await openStore()
  let roll
  if (store) {
    try {
      roll = (await store.get("roll", { type: "json" })) || []
    } catch (e) {
      roll = []
    }
  } else {
    roll = readFallback()
  }

  const name = clean(body.name)
  if (
    name &&
    roll.length < MAX_ROLL &&
    !roll.some(e => e.name.toLowerCase() === name.toLowerCase()) &&
    (await underRateLimit(store, event))
  ) {
    roll.push({ name, ts: Date.now() })
    if (store) {
      try {
        await store.setJSON("roll", roll)
      } catch (e) {
        // best-effort; the name is still returned below
      }
    } else {
      writeFallback(roll)
    }
  }

  const hall = roll.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return json(200, { ok: true, hall })
}
