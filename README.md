<p align="center">
  <a href="https://www.gatsbyjs.com/?utm_source=starter&utm_medium=readme&utm_campaign=minimal-starter">
    <img alt="Gatsby" src="https://www.gatsbyjs.com/Gatsby-Monogram.svg" width="60" />
  </a>
</p>
<h1 align="center">
  <a href="https://www.jamieeverett.co.uk">jamieeverett.co.uk</a>
</h1>

[![Netlify Status](https://api.netlify.com/api/v1/badges/956fb36f-20ea-4546-a857-1ba9234d0703/deploy-status)](https://app.netlify.com/sites/quirky-chandrasekhar-d7c462/deploys)

## Local Development

Requires [Node.js 24.x](https://nodejs.org/).

```bash
npm install
npm start
```

The site will be available at `http://localhost:8000`.

## Sharp security override compatibility

Sharp 0.35.5 is pinned outside Gatsby's declared 0.32.x range. The temporary,
site-owned `scripts/sharp-trim-compat.cjs` repair converts numeric trim thresholds
to Sharp's options-object API in both Gatsby shared transform implementations.
This covers workers (including StaticImage), inline previews and legacy APIs,
including numeric trim introduced by merged plugin defaults. It does not change
Sharp's validation of nonnumeric options.

The repair runs after installation and before npm build/develop/start. It checks
exact package versions and upstream file hashes, validates both files before any
write, and is idempotent. Unknown upstream code fails rather than receiving a
blind patch. The Gatsby config also applies it before plugin loading, covering
direct CLI
builds even when installation scripts were skipped. A required file already
loaded unpatched fails rather than attempting unsafe cache eviction.
Review/remove the repair when Gatsby gains native support for newer Sharp.

Run `npm run test:sharp-compat` for fresh-process native trim regressions.
Every Gatsby build also emits `FRESH_SHARP_NATIVE_PROOF` before bootstrap after
new PNG/WebP/AVIF outputs and an inline preview are processed in a unique temporary
directory. The proof records platform, Node, Sharp, libvips and librsvg versions;
a cached green deployment without this proof is insufficient for this PR's
hosting gate. For full-site fresh-image evidence, build with an empty `.cache`
and `public` directory and check the completed Sharp job count.
