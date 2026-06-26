import React, { useState } from "react"
import "./void.css"

const ENDPOINT = "/.netlify/functions/hall"

const formatDate = ts => {
  if (!ts) return ""
  try {
    return new Date(ts).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  } catch (e) {
    return ""
  }
}

const CONFETTI_COLORS = ["#00d4d4", "#f5c542", "#5fd0a0", "#ff9b6a", "#7c9cff"]

const confetti = (x, y, count) => {
  if (typeof document === "undefined") return
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("div")
    bit.className = "confetti-bit"
    const angle = Math.random() * Math.PI * 2
    const speed = 50 + Math.random() * 140
    bit.style.left = `${x}px`
    bit.style.top = `${y}px`
    bit.style.background =
      CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
    bit.style.setProperty("--dx", `${Math.cos(angle) * speed}px`)
    bit.style.setProperty("--dy", `${Math.sin(angle) * speed - 70}px`)
    bit.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`)
    bit.style.setProperty("--life", `${0.7 + Math.random() * 0.5}s`)
    document.body.appendChild(bit)
    bit.addEventListener("animationend", () => bit.remove())
  }
}

let measureCanvas = null

// Pixel position of the caret in a single-line input, so confetti pops from the
// character just typed rather than the middle of the field.
const caretPoint = input => {
  const r = input.getBoundingClientRect()
  const cs = window.getComputedStyle(input)
  const pos =
    input.selectionStart == null ? input.value.length : input.selectionStart
  const text = input.value.slice(0, pos)
  measureCanvas = measureCanvas || document.createElement("canvas")
  const ctx = measureCanvas.getContext("2d")
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const spacing = (parseFloat(cs.letterSpacing) || 0) * text.length
  const padL = parseFloat(cs.paddingLeft) || 0
  const w = ctx.measureText(text).width + spacing - input.scrollLeft
  const x = Math.max(r.left, Math.min(r.left + padL + w, r.right - 2))
  return { x, y: r.top + r.height / 2 }
}

export default function VoidEnd() {
  const [flag, setFlag] = useState("")
  const [name, setName] = useState("")
  const [status, setStatus] = useState("idle")
  const [hall, setHall] = useState([])
  const [highlight, setHighlight] = useState("")

  const submitFlag = async e => {
    e.preventDefault()
    setStatus("checking")
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: flag.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setHall(data.hall || [])
        setStatus("open")
      } else {
        setStatus("denied")
      }
    } catch (err) {
      setStatus("error")
    }
  }

  const addName = async e => {
    e.preventDefault()
    const handle = name.trim()
    if (!handle) return
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: flag.trim(), name: handle }),
      })
      const data = await res.json()
      if (data.ok) {
        setHall(data.hall || [])
        setName("")
        setHighlight(handle.toLowerCase())
        setTimeout(() => setHighlight(""), 1600)
      }
    } catch (err) {
      // leaving a mark is optional; ignore failures
    }
  }

  return (
    <main className="void">
      <div className="void-inner">
        {status !== "open" ? (
          <form className="void-form" onSubmit={submitFlag}>
            <p className="void-sigil">∴</p>
            <p className="void-lede">Plate up. What did the three pieces spell?</p>
            <input
              className="void-input"
              value={flag}
              onChange={e => setFlag(e.target.value)}
              placeholder="JE&#123;...&#125;"
              autoComplete="off"
              spellCheck="false"
              aria-label="flag"
            />
            <button className="void-btn" type="submit">
              submit
            </button>
            {status === "checking" && <p className="void-cap">checking…</p>}
            {status === "denied" && (
              <p className="void-cap">not quite. wrong words.</p>
            )}
            {status === "error" && (
              <p className="void-cap">the kitchen is closed. try again.</p>
            )}
          </form>
        ) : (
          <div className="void-hall">
            <p className="void-mark">✓</p>
            <p className="void-lede">Seasoned, then hashed. You unwound it.</p>
            <p className="void-cap">Leave a mark, if you'd like.</p>
            <form className="void-form-inline" onSubmit={addName}>
              <input
                className="void-input"
                value={name}
                onChange={e => {
                  if (e.target.value.length > name.length) {
                    const p = caretPoint(e.target)
                    confetti(p.x, p.y, 5)
                  }
                  setName(e.target.value)
                }}
                placeholder="your handle"
                maxLength={32}
                autoComplete="off"
                aria-label="name"
              />
              <button className="void-btn" type="submit">
                sign
              </button>
            </form>
            <ul className="void-roll">
              {hall.map((entry, i) => (
                <li
                  key={i}
                  className={
                    entry.name.toLowerCase() === highlight
                      ? "void-roll-new"
                      : undefined
                  }
                >
                  <span className="void-roll-name">{entry.name}</span>
                  <span className="void-date">{formatDate(entry.ts)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}

export const Head = () => (
  <>
    <title>·</title>
    <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
    <meta name="referrer" content="no-referrer" />
  </>
)
