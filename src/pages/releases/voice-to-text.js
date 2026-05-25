import React, { useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { Link } from "gatsby"

import { FluidBackground } from "../../components"
import "./voice-to-text.css"

const REPO = "jreverett/voice-to-text"
const ASSET_NAME = "voice-to-text.zip"
const DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}`
const RELEASES_URL = `https://github.com/${REPO}/releases`

const fallbackReleases = [
  {
    version: "v1.0.0",
    date: "2026-04-22",
    sizeBytes: 47323953,
    notes: [
      "Initial public release.",
      "Standalone Windows bundle: no installer, no dependencies to fetch.",
      "Push-to-talk speech-to-text with whisper.cpp (small.en model).",
      "WASAPI microphone capture via bundled mic-capture tool.",
      "Tray icon with idle / starting / recording / transcribing states.",
      "Configurable hotkey, model, threads, and audio device via config.ini.",
    ],
  },
]

const requirements = [
  {
    title: "Windows 10+",
    sub: "64-bit only",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="8" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
        <rect x="13" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
  },
  {
    title: "Any microphone",
    sub: "WASAPI input",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    title: "~150 MB",
    sub: "Free disk space",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="7" cy="14" r="1.1" fill="currentColor" />
        <circle cx="11" cy="14" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: "Admin rights",
    sub: "For global hotkeys (UAC)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
]

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return ""
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function formatDate(iso) {
  if (!iso) return ""
  return iso.slice(0, 10)
}

function parseReleaseNotes(body) {
  if (!body) return []
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s+/, "").trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
}

export default function VoiceToTextReleases() {
  const [copied, setCopied] = useState(false)
  const [releases, setReleases] = useState(fallbackReleases)
  const [fetchFailed, setFetchFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`https://api.github.com/repos/${REPO}/releases`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return
        if (!Array.isArray(data) || data.length === 0) {
          setFetchFailed(true)
          return
        }
        const mapped = data
          .filter((r) => !r.draft && !r.prerelease)
          .map((r) => {
            const asset =
              (r.assets || []).find((a) => a.name === ASSET_NAME) ||
              (r.assets || [])[0]
            return {
              version: r.tag_name || r.name,
              date: formatDate(r.published_at || r.created_at),
              sizeBytes: asset ? asset.size : null,
              notes: parseReleaseNotes(r.body),
            }
          })
        if (mapped.length > 0) {
          setReleases(mapped)
        } else {
          setFetchFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setFetchFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const latest = releases[0]

  const handleCopyHotkey = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return
    navigator.clipboard.writeText("Shift+Alt").then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <>
      <Helmet>
        <title>Voice-to-Text Downloads | Jamie Everett</title>
        <meta
          name="description"
          content="Download Voice-to-Text: a local, offline push-to-talk speech-to-text app for Windows, powered by whisper.cpp."
        />
      </Helmet>
      <FluidBackground />

      <div className="releases-page">
        <nav className="releases-nav">
          <Link to="/" className="releases-back" data-splash="link">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to portfolio
          </Link>
          <span className="releases-breadcrumb">
            releases / <strong>voice-to-text</strong>
          </span>
        </nav>

        <header className="releases-hero">
          <div className="releases-mic" aria-hidden="true">
            <div className="mic-pulse mic-pulse-1" />
            <div className="mic-pulse mic-pulse-2" />
            <div className="mic-pulse mic-pulse-3" />
            <svg
              className="mic-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
              <path d="M12 19v3" />
            </svg>
          </div>

          <span className="releases-eyebrow">Windows · offline · free · open source</span>
          <h1 className="releases-title">Voice-to-Text</h1>
          <p className="releases-tagline">
            Local push-to-talk speech-to-text. Hold a hotkey, speak, release,
            and the transcribed text lands in your clipboard. Powered by{" "}
            <a
              href="https://github.com/ggerganov/whisper.cpp"
              target="_blank"
              rel="noreferrer"
              data-splash="link"
            >
              whisper.cpp
            </a>
            .
          </p>

          <div className="releases-hotkey" onClick={handleCopyHotkey} role="button" tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleCopyHotkey()}
            aria-label="Copy default hotkey">
            <span className="kbd">Shift</span>
            <span className="plus">+</span>
            <span className="kbd">Alt</span>
            <span className="hotkey-hint">{copied ? "copied" : "default hotkey"}</span>
          </div>
        </header>

        <section className="releases-download">
          {fetchFailed && (
            <div className="releases-fetch-notice" role="status">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                Couldn&apos;t fetch live release metadata from GitHub. Showing cached info;
                the download button still resolves to the latest release.
              </span>
            </div>
          )}
          <div className="download-card">
            <div className="glow-line" />
            <div className="download-card-body">
              <div className="download-meta">
                <span className="version-badge">{latest.version}</span>
                <span className="download-date">Released {latest.date}</span>
              </div>
              <h2 className="download-heading">Latest release</h2>
              <p className="download-sub">
                Windows bundle · <span className="download-size">{formatSize(latest.sizeBytes)}</span>
              </p>

              <a
                href={DOWNLOAD_URL}
                className="download-btn"
                data-splash="link"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
                Download {latest.version}
              </a>

              <p className="download-disclaimer">
                By downloading you agree this is an unsigned Windows build. Your browser or
                SmartScreen may warn you; that&apos;s expected for open-tool binaries.
              </p>

              <a
                href={RELEASES_URL}
                target="_blank"
                rel="noreferrer"
                className="download-releases-link"
                data-splash="link"
              >
                View all releases on GitHub
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17 17 7" />
                  <path d="M7 7h10v10" />
                </svg>
              </a>
            </div>
          </div>
        </section>

        <section className="releases-why">
          <p>
            I use Claude Code&apos;s <code>/voice</code> on Mac and it&apos;s great.
            On Windows it doesn&apos;t work nearly as well, especially in WSL through
            Windows Terminal, and most third-party alternatives are cloud-based or
            paywalled. So I built this. Works anywhere on Windows, runs entirely on
            your machine, free.
          </p>
          <p>
            One of the AI labs will probably ship something better eventually. Until then,
            this is yours: MIT-licensed and{" "}
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noreferrer"
              data-splash="link"
            >
              open source on GitHub
            </a>
            .
          </p>
        </section>

        <section className="releases-section">
          <h2 className="section-title">How it works</h2>
          <div className="how-flow">
            <div className="flow-step">
              <div className="flow-visual">
                <div className="flow-keys">
                  <span className="kbd">Shift</span>
                  <span className="flow-plus">+</span>
                  <span className="kbd">Alt</span>
                </div>
              </div>
              <h3>Press the hotkey</h3>
              <p>
                Default is <span className="kbd">Shift</span>+<span className="kbd">Alt</span>.
                Pick any combination you like in <code>config.ini</code>.
              </p>
            </div>

            <div className="flow-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>

            <div className="flow-step">
              <div className="flow-visual">
                <div className="tray-strip" aria-hidden="true">
                  <div className="tray-dot tray-dot-idle" />
                  <div className="tray-dot tray-dot-recording" />
                </div>
              </div>
              <h3>Wait for red</h3>
              <p>
                The tray icon flicks from green to red. That means it&apos;s recording.
                Now go.
              </p>
            </div>

            <div className="flow-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>

            <div className="flow-step">
              <div className="flow-visual">
                <div className="flow-waves" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </div>
              </div>
              <h3>Talk away</h3>
              <p>Hold the key for as long as you need. There&apos;s no time limit.</p>
            </div>

            <div className="flow-arrow" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </div>

            <div className="flow-step">
              <div className="flow-visual">
                <svg className="flow-scribble" viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 6c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2 2 2 4 2" />
                  <path d="M2 12c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
                  <path d="M2 18c2 0 2-2 4-2s2 2 4 2 2-2 4-2" />
                </svg>
              </div>
              <h3>Release</h3>
              <p>
                Transcribes locally on your CPU and copies straight to your clipboard.
                Paste anywhere with <span className="kbd">Ctrl</span>+<span className="kbd">V</span>.
              </p>
            </div>
          </div>
        </section>

        <section className="releases-section">
          <h2 className="section-title">Requirements</h2>
          <div className="requirements-grid">
            {requirements.map((req) => (
              <div className="requirement-card" key={req.title}>
                <div className="requirement-icon">{req.icon}</div>
                <div>
                  <div className="requirement-title">{req.title}</div>
                  <div className="requirement-sub">{req.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="releases-section">
          <h2 className="section-title">Release notes</h2>
          <div className="release-list">
            {releases.map((release) => (
              <div className="release-entry" key={release.version}>
                <div className="release-entry-header">
                  <span className="version-badge">{release.version}</span>
                  <span className="release-entry-date">{release.date}</span>
                  <a
                    className="release-entry-download"
                    href={`https://github.com/${REPO}/releases/download/${release.version}/${ASSET_NAME}`}
                    data-splash="link"
                  >
                    {ASSET_NAME} ({formatSize(release.sizeBytes)})
                  </a>
                </div>
                <ul>
                  {release.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <footer className="releases-footer">
          <Link to="/" className="releases-footer-link" data-splash="link">
            ← Back to portfolio
          </Link>
        </footer>
      </div>
    </>
  )
}
