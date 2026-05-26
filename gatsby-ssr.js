import React from "react"

// Inject the Cloudflare Web Analytics beacon site-wide.
// The token is public (it ships in the client HTML), but we read it from an
// env var so it's set per-environment. Set CF_BEACON_TOKEN in Netlify
// (Site settings -> Environment variables). When unset (e.g. local dev) the
// script is skipped, so localhost traffic isn't tracked.
export const onRenderBody = ({ setPostBodyComponents }) => {
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
