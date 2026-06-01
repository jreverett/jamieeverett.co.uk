import React from "react"

// Fonts are self-hosted under /fonts (see @font-face in index.css). Preload the
// weights used in the above-the-fold hero (Regular body, Medium subtitle,
// SemiBold headline) so first text paint isn't blocked on CSS parse → font fetch.
// crossOrigin is required even for same-origin fonts (they're fetched in CORS
// mode), otherwise the preload wouldn't match the @font-face request.
const PRELOAD_FONTS = [
  "/fonts/Geist-Regular.woff2",
  "/fonts/Geist-Medium.woff2",
  "/fonts/Geist-SemiBold.woff2",
]

export const onRenderBody = ({ setHtmlAttributes, setHeadComponents, setPostBodyComponents }) => {
  setHtmlAttributes({ lang: "en" })

  setHeadComponents(
    PRELOAD_FONTS.map(href =>
      React.createElement("link", {
        key: `preload-${href}`,
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href,
        crossOrigin: "anonymous",
      })
    )
  )

  // Cloudflare Web Analytics beacon. The token is public (it ships in the client
  // HTML) but read from an env var so it's set per-environment (CF_BEACON_TOKEN in
  // Netlify). When unset (e.g. local dev) the script is skipped.
  const token = process.env.CF_BEACON_TOKEN
  if (!token) return

  setPostBodyComponents([
    React.createElement("script", {
      key: "cf-web-analytics",
      defer: true,
      src: "https://static.cloudflareinsights.com/beacon.min.js",
      "data-cf-beacon": JSON.stringify({ token }),
    }),
  ])
}
