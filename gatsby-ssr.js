import React from "react"

// Fonts are served from jsDelivr (see @font-face in index.css). Open the
// connection early and preload the weights used in the above-the-fold hero
// (Regular body, Medium subtitle, SemiBold headline) so first text paint
// isn't blocked on CSS parse → cold connection → font fetch.
const FONT_BASE = "https://cdn.jsdelivr.net/npm/geist@1.2.0/dist/fonts/geist-sans"
const PRELOAD_FONTS = [
  `${FONT_BASE}/Geist-Regular.woff2`,
  `${FONT_BASE}/Geist-Medium.woff2`,
  `${FONT_BASE}/Geist-SemiBold.woff2`,
]

export const onRenderBody = ({ setHeadComponents, setPostBodyComponents }) => {
  setHeadComponents([
    React.createElement("link", {
      key: "preconnect-jsdelivr",
      rel: "preconnect",
      href: "https://cdn.jsdelivr.net",
      crossOrigin: "anonymous",
    }),
    ...PRELOAD_FONTS.map(href =>
      React.createElement("link", {
        key: `preload-${href}`,
        rel: "preload",
        as: "font",
        type: "font/woff2",
        href,
        crossOrigin: "anonymous",
      })
    ),
  ])

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
