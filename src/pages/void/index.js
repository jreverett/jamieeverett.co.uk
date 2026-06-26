import React from "react"
import "./void.css"

const LINES = [
  "Keys alone I keep from sight;",
  "Everything else I bring to light.",
  "Read my every cog and gear —",
  "Cracked I'm not, though all is clear.",
  "Knowing the method opens nought;",
  "Hidden in plain sight, never sought.",
  "Out of plain words the key is grown;",
  "Find it, and let the loaf be shown.",
  "First letters fall where eyes won't tread —",
  "Seasoned, then hashed; enough is said.",
]

const CIPHER =
  "KKFQN JCTPZ SHVUG OOYBG XXIKC LTNSV YRVXO YSYYW KXJVR LISQA " +
  "CXVFV VOKSS WIUKW WCXXA LPVUY BFITM QLZVV PSXFT YYKKD ZZJFN " +
  "ORZPQ ZDJFC DLVYY YRXXS VXIKC PBLYG ERCQM RWY"

export default function Void() {
  return (
    <main className="void">
      <div className="void-inner">
        <p className="void-sigil">∴</p>
        <p className="void-lede">
          No link brought you here. Curiosity did. Everything below is
          deliberate; read it the way it wants to be read.
        </p>

        <div className="void-block">
          <div className="void-stanza">
            {LINES.map((line, i) => (
              <p className="void-line" key={i}>
                {line}
              </p>
            ))}
          </div>
        </div>

        <pre className="void-cipher">{CIPHER}</pre>

        <hr className="void-rule" />

        <figure className="void-seal">
          <img src="/void/seed.png" alt="" />
          <figcaption className="void-cap">salt &amp; pepper, ground fine.</figcaption>
        </figure>
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
