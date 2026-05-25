import React, { useEffect, useState } from "react"
import { Helmet } from "react-helmet"
import { Link } from "gatsby"

import { FluidBackground } from "../../components"
import "./voice-to-text.css"

const REPO = "jreverett/voice-to-text"
const ASSET_NAME = "voice-to-text.zip"
const DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download/${ASSET_NAME}`

const fallbackReleases = [
  {
    version: "v1.0.0",
    date: "2026-04-22",
    sizeBytes: 47323953,
    notes: [
      "Initial public release.",
      "Standalone Windows bundle — no installer, no dependencies to fetch.",
      "Push-to-talk speech-to-text with whisper.cpp (small.en model).",
      "WASAPI microphone capture via bundled mic-capture tool.",
      "Tray icon with idle / starting / recording / transcribing states.",
      "Configurable hotkey, model, threads, and audio device via config.ini.",
    ],
  },
]

const features = [
  {
    title: "100% local",
    body: "Audio and transcripts never leave your machine. No cloud, no API keys, no usage limits.",
  },
  {
    title: "Push-to-talk",
    body: "Hold Shift+Alt (or any hotkey you like), speak, release. Text lands in your clipboard.",
  },
  {
    title: "Fast on CPU",
    body: "~1.5–3s turnaround on a modern CPU with the small.en model. Tune threads and model to taste.",
  },
  {
    title: "Tray-native UX",
    body: "Coloured tray icon shows state at a glance: idle, starting, recording, transcribing.",
  },
]

const requirements = [
  "Windows 10 or later (x64)",
  "~150 MB free disk space (extracted)",
  "A microphone (any WASAPI capture device)",
]

const installSteps = [
  "Download the zip and extract it into a folder you own (e.g. C:\\Tools\\voice-to-text\\).",
  "(Optional) open config.ini and set your preferred hotkey or microphone.",
  "Double-click voice-to-text.exe. It will auto-elevate for global hotkey support.",
  "Hold Shift+Alt, speak, release — then paste anywhere with Ctrl+V.",
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
        <title>Voice-to-Text — Downloads | Jamie Everett</title>
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

          <span className="releases-eyebrow">Windows · offline · free</span>
          <h1 className="releases-title">Voice-to-Text</h1>
          <p className="releases-tagline">
            Local push-to-talk speech-to-text. Hold a hotkey, speak, release —
            transcribed text lands in your clipboard. Powered by{" "}
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
                Couldn&apos;t fetch live release metadata from GitHub. Showing cached info —
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
                SmartScreen may warn you — that&apos;s expected for open-tool binaries.
              </p>
            </div>
          </div>
        </section>

        <section className="releases-section">
          <h2 className="section-title">What&apos;s inside</h2>
          <div className="feature-grid">
            {features.map((feature) => (
              <div className="feature-card" key={feature.title}>
                <div className="feature-card-dot" />
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="releases-section">
          <h2 className="section-title">Requirements</h2>
          <ul className="requirements-list">
            {requirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
        </section>

        <section className="releases-section">
          <h2 className="section-title">Install</h2>
          <ol className="install-steps">
            {installSteps.map((step, i) => (
              <li key={i}>
                <span className="install-step-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="install-step-body">{step}</span>
              </li>
            ))}
          </ol>
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
