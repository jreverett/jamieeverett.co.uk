import React, { useEffect, useRef } from "react"
import { createFluidEngine } from "../../fluid/fluidEngine"

export default function FluidBackground({ reactiveTitleSelector } = {}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    // Component renders the fluid framebuffer at 1x (no DPR); the title overlay
    // below is rendered at DPR for crisp text and samples the 1x fluid readback.
    const engine = createFluidEngine(canvas, { dpr: 1 })
    if (!engine) {
      return undefined
    }
    const { gl } = engine

    // --- Reactive title overlay ---------------------------------------------
    // Optional: paint a page title (e.g. the gradient .releases-title) on an
    // overlay canvas that reads the fluid behind it and shifts the glyphs
    // white→cyan (at rest) toward gold over splashes — the same effect as the
    // home-page subtitle. Gated by the reactiveTitleSelector prop so other
    // consumers (e.g. the 404 page) are unaffected.
    const titleDpr = Math.min(window.devicePixelRatio || 1, 2)
    const TITLE_WHITE = [255, 255, 255]
    const TITLE_CYAN = [0, 212, 212]
    const TITLE_GOLD = [255, 199, 38]
    let titleEl = null
    let titleOverlay = null
    let titleOverlayCtx = null
    let titleGlyphAlpha = null
    let titleW = 0
    let titleH = 0
    let titleCssW = 0
    let titleCssH = 0
    let titleReadBuf = null
    let titleImageData = null

    const setupTitleOverlay = () => {
      if (!reactiveTitleSelector) return
      titleEl = document.querySelector(reactiveTitleSelector)
      if (!titleEl) return
      if (window.getComputedStyle(titleEl).position === "static") {
        titleEl.style.position = "relative"
      }
      if (!titleOverlay) {
        titleOverlay = document.createElement("canvas")
        titleOverlay.setAttribute("aria-hidden", "true")
        titleOverlay.style.cssText =
          "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none"
        titleEl.appendChild(titleOverlay)
        titleOverlayCtx = titleOverlay.getContext("2d")
        // The title's own (gradient) text stays in the DOM for accessibility/fallback,
        // but is hidden visually so it can't ghost behind the overlay glyphs. Removing
        // the gradient background leaves the existing transparent text-fill = invisible.
        // If WebGL is unavailable this code never runs, so the gradient title still shows.
        titleEl.style.background = "none"
        titleEl.style.color = "transparent"
      }
    }

    const buildTitleGlyphMask = () => {
      if (!titleEl || !titleOverlayCtx) return
      const rect = titleEl.getBoundingClientRect()
      titleCssW = Math.max(1, Math.round(rect.width))
      titleCssH = Math.max(1, Math.round(rect.height))
      const pw = Math.round(titleCssW * titleDpr)
      const ph = Math.round(titleCssH * titleDpr)
      titleOverlay.width = pw
      titleOverlay.height = ph

      const ctx = titleOverlayCtx
      ctx.setTransform(titleDpr, 0, 0, titleDpr, 0, 0)
      ctx.clearRect(0, 0, titleCssW, titleCssH)
      ctx.fillStyle = "#ffffff"
      const style = window.getComputedStyle(titleEl)
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ctx.textBaseline = "middle"
      ctx.textAlign = "center" // .releases-title is centre-aligned
      if ("letterSpacing" in ctx) ctx.letterSpacing = style.letterSpacing
      const content = (titleEl.textContent || "").trim()
      ctx.fillText(content, titleCssW / 2, titleCssH / 2)

      const data = ctx.getImageData(0, 0, pw, ph).data
      titleGlyphAlpha = new Uint8ClampedArray(pw * ph)
      for (let i = 0, j = 3; i < titleGlyphAlpha.length; i += 1, j += 4) {
        titleGlyphAlpha[i] = data[j]
      }
      titleW = pw
      titleH = ph
      titleReadBuf = new Uint8Array(titleCssW * titleCssH * 4)
      titleImageData = ctx.createImageData(pw, ph)
    }

    const updateTitleOverlay = () => {
      if (!titleEl || !titleOverlayCtx || !titleGlyphAlpha) return
      const rect = titleEl.getBoundingClientRect()
      const cw = canvas.clientWidth
      const ch = canvas.clientHeight
      if (rect.bottom <= 0 || rect.top >= ch || rect.right <= 0 || rect.left >= cw) {
        titleOverlayCtx.clearRect(0, 0, titleOverlay.width, titleOverlay.height)
        return
      }
      const rw = titleCssW
      const rh = titleCssH
      // fluid framebuffer is 1x, origin bottom-left
      const xfb = Math.round(rect.left)
      const yfb = Math.round(ch - rect.bottom)
      titleReadBuf.fill(0)
      gl.readPixels(xfb, yfb, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, titleReadBuf)

      const out = titleImageData.data
      const pw = titleW
      const ph = titleH
      for (let row = 0; row < ph; row += 1) {
        const fyBuf = rh - 1 - Math.min(rh - 1, Math.floor(row / titleDpr))
        for (let col = 0; col < pw; col += 1) {
          const gi = row * pw + col
          const di = gi * 4
          const a = titleGlyphAlpha[gi]
          if (a === 0) {
            out[di + 3] = 0
            continue
          }
          const fx = Math.min(rw - 1, Math.floor(col / titleDpr))
          const si = (fyBuf * rw + fx) * 4
          const fr = titleReadBuf[si] / 255
          const fg = titleReadBuf[si + 1] / 255
          const fb = titleReadBuf[si + 2] / 255
          let inten = Math.sqrt(fr * fr + fg * fg + fb * fb) * 1.6
          if (inten > 1) inten = 1
          // base white→cyan gradient across the box (approximates the 135° CSS gradient)
          const t = pw > 1 ? col / (pw - 1) : 0
          const baseR = TITLE_WHITE[0] + (TITLE_CYAN[0] - TITLE_WHITE[0]) * t
          const baseG = TITLE_WHITE[1] + (TITLE_CYAN[1] - TITLE_WHITE[1]) * t
          const baseB = TITLE_WHITE[2] + (TITLE_CYAN[2] - TITLE_WHITE[2]) * t
          const boost = 1 + inten * 0.35
          out[di] = Math.min(255, (baseR + (TITLE_GOLD[0] - baseR) * inten) * boost)
          out[di + 1] = Math.min(255, (baseG + (TITLE_GOLD[1] - baseG) * inten) * boost)
          out[di + 2] = Math.min(255, (baseB + (TITLE_GOLD[2] - baseB) * inten) * boost)
          out[di + 3] = a
        }
      }
      titleOverlayCtx.putImageData(titleImageData, 0, 0)
    }

    setupTitleOverlay()
    buildTitleGlyphMask()
    // Re-cache once web fonts settle (glyph metrics shift on font load)
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(buildTitleGlyphMask)
    }

    engine.start({
      onAfterBlit: updateTitleOverlay,
      onResize: buildTitleGlyphMask,
    })

    return () => {
      engine.destroy()
      if (titleEl) {
        titleEl.style.background = ""
        titleEl.style.color = ""
      }
      if (titleOverlay && titleOverlay.parentNode) {
        titleOverlay.parentNode.removeChild(titleOverlay)
      }
    }
    // Mount-once WebGL setup; reactiveTitleSelector is fixed per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <canvas id="fluid-canvas" ref={canvasRef} />
}
