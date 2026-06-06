import React, { useEffect, useRef, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"
import SEO from "../components/SEO/SEO.jsx"
import { ProjectCard } from "../components"
import { createFluidEngine } from "../fluid/fluidEngine"
import "./index.css"

export default function Home() {
  const canvasRef = useRef(null)
  const subtitleRef = useRef(null)
  const subtitleOverlayRef = useRef(null)
  const dragHintRef = useRef(null)
  const dragHintIconRef = useRef(null)
  const dragHintTextRef = useRef(null)
  const dragHintDismissedRef = useRef(false)
  const [dragHintDismissed, setDragHintDismissed] = useState(false)
  const [dragHintVisible, setDragHintVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDragHintVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return undefined
    let pointerDown = false
    const markDismissed = () => {
      if (dragHintDismissedRef.current) return
      dragHintDismissedRef.current = true
      setDragHintDismissed(true)
    }
    const onDown = () => { pointerDown = true }
    const onMove = () => {
      if (pointerDown) markDismissed()
    }
    const onUp = () => { pointerDown = false }
    const onTouchMove = () => markDismissed()

    document.addEventListener("mousedown", onDown)
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    document.addEventListener("touchstart", onDown, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    document.addEventListener("touchend", onUp, { passive: true })
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.removeEventListener("touchstart", onDown)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", onUp)
    }
  }, [])

  const data = useStaticQuery(graphql`
    query ProjectsQuery {
      site {
        siteMetadata {
          projects {
            name
            description
            imageName
            sourceUrl
            liveUrl
            downloadsUrl
            closedSource
            tags
          }
          tagUrls {
            name
            url
          }
        }
      }
      allFile(filter: { sourceInstanceName: { eq: "images" } }) {
        edges {
          node {
            name
            childImageSharp {
              gatsbyImageData(
                width: 600
                placeholder: BLURRED
                formats: [AUTO, WEBP, AVIF]
                layout: CONSTRAINED
              )
            }
          }
        }
      }
    }
  `)

  const projects = data.site.siteMetadata.projects
  const tagUrls = data.site.siteMetadata.tagUrls
  const images = data.allFile.edges

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined
    }

    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    // Render WebGL output at device pixel resolution so the rasterised text mask
    // doesn't get upscaled by the browser (which was the cause of the blur).
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    // Homepage-specific display shader: tints the CV button region gold and paints
    // the drag-hint icon/text mask, per-pixel from the fluid intensity. The shared
    // engine renders the dye to this shader and we set its extra uniforms each frame
    // in configureDisplay below.
    const HOME_DISPLAY_SHADER = `
      precision highp float;
      uniform sampler2D uTexture;
      uniform float uOpacity;
      uniform vec4 uButtonBounds; // x: left, y: top, z: right, w: bottom
      uniform vec2 uCanvasSize; // canvas width and height in pixels
      uniform float uButtonRadius; // border radius in pixels
      uniform float uButtonOpacity; // opacity for smooth fade during scroll
      uniform bool uHasButton;
      uniform sampler2D uHintMask;
      uniform vec4 uHintMaskRect; // left, top, right, bottom in viewport pixels (top-left origin)
      uniform float uHintOpacity;
      uniform bool uHasHint;
      varying vec2 vUv;

      // Paint a rasterised text/icon mask directly into the framebuffer.
      // Each masked pixel is cyan at rest and shifts toward gold based on the
      // fluid splash intensity sampled at exactly that pixel, so the colour
      // change is per-pixel and clearly visible.
      vec3 paintMask(vec3 c, sampler2D mask, vec4 rect, float opacity, float sharpen) {
        if (opacity <= 0.0) return c;
        vec2 viewportPos = vec2(vUv.x, 1.0 - vUv.y) * uCanvasSize;
        if (viewportPos.x >= rect.x && viewportPos.x <= rect.z &&
            viewportPos.y >= rect.y && viewportPos.y <= rect.w) {
          vec2 maskUv = vec2(
            (viewportPos.x - rect.x) / (rect.z - rect.x),
            (viewportPos.y - rect.y) / (rect.w - rect.y)
          );
          // Sharpen coverage so glyph interiors paint at full opacity (brighter,
          // less washed-out over the dark background) while edges stay smooth.
          float maskAlpha = clamp(texture2D(mask, maskUv).a * sharpen, 0.0, 1.0);
          if (maskAlpha > 0.01) {
            vec3 cyan = vec3(0.0, 0.83, 0.83);
            vec3 gold = vec3(1.0, 0.78, 0.15);
            float intensity = clamp(length(c) * 1.6, 0.0, 1.0);
            vec3 letter = mix(cyan, gold, intensity);
            // Boost brightness slightly where splash is bright so it pops more
            letter *= 1.0 + intensity * 0.35;
            c = mix(c, letter, opacity * maskAlpha);
          }
        }
        return c;
      }

      bool isInsideRoundedRect(vec2 pos, vec4 bounds, float radius) {
        // Convert from UV space to pixel space for accurate radius calculation
        vec2 pixelPos = pos * uCanvasSize;
        vec4 pixelBounds = vec4(
          bounds.x * uCanvasSize.x,
          bounds.y * uCanvasSize.y,
          bounds.z * uCanvasSize.x,
          bounds.w * uCanvasSize.y
        );

        // Check if outside the bounding box
        if (pixelPos.x < pixelBounds.x || pixelPos.x > pixelBounds.z ||
            pixelPos.y < pixelBounds.y || pixelPos.y > pixelBounds.w) {
          return false;
        }

        // Check corners with rounded radius
        float left = pixelBounds.x + radius;
        float right = pixelBounds.z - radius;
        float top = pixelBounds.y + radius;
        float bottom = pixelBounds.w - radius;

        // Inside the non-rounded area
        if (pixelPos.x >= left && pixelPos.x <= right) return true;
        if (pixelPos.y >= top && pixelPos.y <= bottom) return true;

        // Check rounded corners
        vec2 cornerDist;

        // Top-left corner
        if (pixelPos.x < left && pixelPos.y < top) {
          cornerDist = pixelPos - vec2(left, top);
          return length(cornerDist) <= radius;
        }
        // Top-right corner
        if (pixelPos.x > right && pixelPos.y < top) {
          cornerDist = pixelPos - vec2(right, top);
          return length(cornerDist) <= radius;
        }
        // Bottom-left corner
        if (pixelPos.x < left && pixelPos.y > bottom) {
          cornerDist = pixelPos - vec2(left, bottom);
          return length(cornerDist) <= radius;
        }
        // Bottom-right corner
        if (pixelPos.x > right && pixelPos.y > bottom) {
          cornerDist = pixelPos - vec2(right, bottom);
          return length(cornerDist) <= radius;
        }

        return true;
      }

      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;

        // Check if current pixel is within CV button bounds (with rounded corners)
        if (uHasButton && uButtonOpacity > 0.0 && isInsideRoundedRect(vUv, uButtonBounds, uButtonRadius)) {
          // Convert to gold/yellow color while preserving intensity
          float intensity = length(c);
          if (intensity > 0.01) {
            vec3 gold = vec3(1.0, 0.85, 0.2);
            vec3 tinted = gold * intensity * 1.5;
            // Blend between original and tinted based on button opacity
            c = mix(c, tinted, uButtonOpacity);
          }
        }

        // Drag hint — paint the glyph/icon shapes directly, per-pixel cyan→gold.
        // (The subtitle uses a separate DOM overlay canvas above the legibility scrim.)
        if (uHasHint) c = paintMask(c, uHintMask, uHintMaskRect, uHintOpacity, 1.0);

        gl_FragColor = vec4(c * uOpacity, 1.0);
      }
    `

    const engine = createFluidEngine(canvas, {
      dpr,
      displayShaderSource: HOME_DISPLAY_SHADER,
    })
    if (!engine) {
      return undefined
    }
    const { gl } = engine

    // Cache CV button position relative to document (not viewport)
    // This avoids getBoundingClientRect() lag during scroll
    let cvButtonDocPos = null

    // Scroll state for fading button overlay
    let scrollTimeout = null
    let buttonOpacity = 1.0
    let targetButtonOpacity = 1.0

    // Drag hint: rasterised mask of the icon + text used to tint fluid in shader
    let hintOpacity = 0.0
    let targetHintOpacity = 0.0
    let hintMaskRect = null
    const hintMaskCanvas = document.createElement("canvas")
    const hintMaskCtx = hintMaskCanvas.getContext("2d")
    const hintMaskTexture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, hintMaskTexture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Subtitle: rendered on a separate DOM overlay <canvas> that sits ABOVE the hero's
    // dark legibility scrim (so it stays bright) and scrolls with the content (so it
    // never floats). Each frame we read the fluid pixels behind the subtitle out of the
    // WebGL framebuffer, recolour them cyan→gold by intensity, and mask them to the glyph
    // shapes — giving the same per-pixel reactive effect as the drag hint, but legible.
    let subOpacity = 0.0
    let targetSubOpacity = 0.0
    // Cached glyph alpha mask for the overlay (built at the overlay's pixel resolution)
    let subGlyphAlpha = null
    let subGlyphW = 0
    let subGlyphH = 0
    let subReadBuf = null
    let subImageData = null
    const subColorCanvas = document.createElement("canvas")
    const subColorCtx = subColorCanvas.getContext("2d")

    const updateCvButtonPosition = () => {
      const cvButton = document.querySelector('.cv-link')
      if (cvButton) {
        const rect = cvButton.getBoundingClientRect()
        const scrollY = window.scrollY || window.pageYOffset
        cvButtonDocPos = {
          left: rect.left,
          right: rect.right,
          top: rect.top + scrollY,
          bottom: rect.bottom + scrollY,
          borderRadius: parseFloat(window.getComputedStyle(cvButton).borderRadius) || 8
        }
      }
    }

    const updateHintMask = () => {
      const iconEl = dragHintIconRef.current
      const textEl = dragHintTextRef.current
      if (!iconEl && !textEl) {
        hintMaskRect = null
        return
      }
      const iconRect = iconEl ? iconEl.getBoundingClientRect() : null
      const textRect = textEl ? textEl.getBoundingClientRect() : null
      const rects = [iconRect, textRect].filter(Boolean)
      if (rects.length === 0) {
        hintMaskRect = null
        return
      }
      const pad = 3
      const left = Math.floor(Math.min(...rects.map(r => r.left)) - pad)
      const right = Math.ceil(Math.max(...rects.map(r => r.right)) + pad)
      const top = Math.floor(Math.min(...rects.map(r => r.top)) - pad)
      const bottom = Math.ceil(Math.max(...rects.map(r => r.bottom)) + pad)
      const width = right - left
      const height = bottom - top
      if (width <= 0 || height <= 0) {
        hintMaskRect = null
        return
      }

      const pxWidth = Math.round(width * dpr)
      const pxHeight = Math.round(height * dpr)
      if (hintMaskCanvas.width !== pxWidth) hintMaskCanvas.width = pxWidth
      if (hintMaskCanvas.height !== pxHeight) hintMaskCanvas.height = pxHeight
      hintMaskCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      hintMaskCtx.clearRect(0, 0, width, height)
      hintMaskCtx.fillStyle = "#ffffff"

      if (iconRect) {
        hintMaskCtx.save()
        hintMaskCtx.translate(iconRect.left - left, iconRect.top - top)
        const sx = iconRect.width / 11
        const sy = iconRect.height / 16
        hintMaskCtx.scale(sx, sy)
        hintMaskCtx.beginPath()
        hintMaskCtx.moveTo(1, 1)
        hintMaskCtx.lineTo(1, 14)
        hintMaskCtx.lineTo(4, 11)
        hintMaskCtx.lineTo(6, 15)
        hintMaskCtx.lineTo(8, 14)
        hintMaskCtx.lineTo(6, 10)
        hintMaskCtx.lineTo(10, 10)
        hintMaskCtx.closePath()
        hintMaskCtx.fill()
        hintMaskCtx.restore()
      }

      if (textEl && textRect) {
        const style = window.getComputedStyle(textEl)
        hintMaskCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        hintMaskCtx.textBaseline = "middle"
        if ("letterSpacing" in hintMaskCtx) {
          hintMaskCtx.letterSpacing = style.letterSpacing
        }
        const content = (textEl.textContent || "").toUpperCase()
        const cy = (textRect.top + textRect.bottom) / 2 - top
        hintMaskCtx.fillText(content, textRect.left - left, cy)
      }

      hintMaskRect = { left, top, right, bottom }
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_2D, hintMaskTexture)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hintMaskCanvas)
    }

    // Rasterise the subtitle glyphs into an alpha mask sized to the overlay canvas, and
    // size the overlay to match the subtitle box. Only needed on layout changes
    // (init / resize / font load); the per-frame loop reuses the cached mask.
    const buildSubtitleGlyphMask = () => {
      const el = subtitleRef.current
      const overlay = subtitleOverlayRef.current
      if (!el || !overlay) {
        subGlyphAlpha = null
        return
      }
      const rect = el.getBoundingClientRect()
      const h = Math.max(1, Math.round(rect.height))
      const content = (el.textContent || "").trim()
      const style = window.getComputedStyle(el)

      // Measure the actual text width so the overlay (and the per-frame readPixels)
      // only span the glyphs, not the full left-aligned <p> block (~40% narrower).
      // measureText is independent of canvas size; set the font before measuring.
      subColorCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      if ("letterSpacing" in subColorCtx) {
        subColorCtx.letterSpacing = style.letterSpacing
      }
      const textW = subColorCtx.measureText(content).width
      // +8px guard: measureText returns the advance width, which can slightly
      // under-measure the final glyph's ink — pad so the last letter never clips.
      const w = Math.max(1, Math.min(Math.round(rect.width), Math.ceil(textW) + 8))
      const pw = Math.round(w * dpr)
      const ph = Math.round(h * dpr)
      // Shrink the displayed canvas to the text width (overrides the CSS width:100%)
      // so the narrower backing store isn't stretched across the whole block.
      overlay.style.width = `${w}px`
      if (overlay.width !== pw) overlay.width = pw
      if (overlay.height !== ph) overlay.height = ph
      if (subColorCanvas.width !== pw) subColorCanvas.width = pw
      if (subColorCanvas.height !== ph) subColorCanvas.height = ph

      // Resizing a canvas resets its 2D context, so re-establish state before drawing.
      subColorCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      subColorCtx.clearRect(0, 0, w, h)
      subColorCtx.fillStyle = "#ffffff"
      subColorCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      subColorCtx.textBaseline = "middle"
      if ("letterSpacing" in subColorCtx) {
        subColorCtx.letterSpacing = style.letterSpacing
      }
      subColorCtx.fillText(content, 0, h / 2)

      const data = subColorCtx.getImageData(0, 0, pw, ph).data
      subGlyphAlpha = new Uint8ClampedArray(pw * ph)
      for (let i = 0, j = 3; i < subGlyphAlpha.length; i += 1, j += 4) {
        subGlyphAlpha[i] = data[j]
      }
      subGlyphW = pw
      subGlyphH = ph
      subReadBuf = new Uint8Array(pw * ph * 4)
      subImageData = subColorCtx.createImageData(pw, ph)
    }

    // Per-frame: read the fluid behind the subtitle out of the WebGL framebuffer,
    // recolour cyan→gold by intensity, mask to the glyphs, and blit onto the overlay.
    const CY = [0, 212, 212]
    const GO = [255, 199, 38]
    const updateSubtitleOverlay = () => {
      const el = subtitleRef.current
      const overlay = subtitleOverlayRef.current
      if (!el || !overlay || !subGlyphAlpha) return
      const octx = overlay.getContext("2d")
      if (!octx) return
      if (subOpacity < 0.003) {
        octx.clearRect(0, 0, overlay.width, overlay.height)
        return
      }
      const rect = el.getBoundingClientRect()
      const ch = canvas.clientHeight
      const cw = canvas.clientWidth
      if (rect.bottom <= 0 || rect.top >= ch || rect.right <= 0 || rect.left >= cw) {
        octx.clearRect(0, 0, overlay.width, overlay.height)
        return
      }
      const pw = subGlyphW
      const ph = subGlyphH
      const xfb = Math.round(rect.left * dpr)
      const yfb = Math.round((ch - rect.bottom) * dpr) // readPixels origin is bottom-left
      subReadBuf.fill(0)
      gl.readPixels(xfb, yfb, pw, ph, gl.RGBA, gl.UNSIGNED_BYTE, subReadBuf)

      const out = subImageData.data
      const fade = Math.min(1, subOpacity)
      for (let row = 0; row < ph; row += 1) {
        const srcRow = (ph - 1 - row) * pw // flip Y to match top-left canvas
        const dstRow = row * pw
        for (let col = 0; col < pw; col += 1) {
          const gi = dstRow + col
          const di = gi * 4
          const a = subGlyphAlpha[gi]
          if (a === 0) {
            out[di + 3] = 0
            continue
          }
          const si = (srcRow + col) * 4
          const fr = subReadBuf[si] / 255
          const fg = subReadBuf[si + 1] / 255
          const fb = subReadBuf[si + 2] / 255
          let inten = Math.sqrt(fr * fr + fg * fg + fb * fb) * 1.6
          if (inten > 1) inten = 1
          const boost = 1 + inten * 0.35
          out[di] = Math.min(255, (CY[0] + (GO[0] - CY[0]) * inten) * boost)
          out[di + 1] = Math.min(255, (CY[1] + (GO[1] - CY[1]) * inten) * boost)
          out[di + 2] = Math.min(255, (CY[2] + (GO[2] - CY[2]) * inten) * boost)
          out[di + 3] = a * fade
        }
      }
      octx.putImageData(subImageData, 0, 0)
    }

    // Per-frame display setup: interpolate the overlay fades and set the homepage
    // display shader's extra uniforms. Runs after the engine binds the display
    // program and sets uTexture/uOpacity, before the blit to canvas.
    const configureDisplay = (glCtx, display) => {
      // Smoothly interpolate button opacity
      buttonOpacity += (targetButtonOpacity - buttonOpacity) * 0.15

      // Sync hint visibility with React dismissal state
      if (dragHintDismissedRef.current) {
        targetHintOpacity = 0.0
      }
      hintOpacity += (targetHintOpacity - hintOpacity) * 0.15
      // Subtitle effect is persistent — fades in once and stays (no scroll fade)
      subOpacity += (targetSubOpacity - subOpacity) * 0.15

      glCtx.uniform2f(display.uniforms.uCanvasSize, canvas.clientWidth, canvas.clientHeight)
      glCtx.uniform1f(display.uniforms.uButtonOpacity, buttonOpacity)
      glCtx.uniform1f(display.uniforms.uHintOpacity, hintOpacity)

      // Use cached button position to avoid getBoundingClientRect() lag during scroll
      if (cvButtonDocPos) {
        const scrollY = window.scrollY || window.pageYOffset
        // Calculate viewport position from cached document position
        const viewportTop = cvButtonDocPos.top - scrollY
        const viewportBottom = cvButtonDocPos.bottom - scrollY

        // Only render overlay if button is in viewport
        if (viewportBottom > 0 && viewportTop < canvas.clientHeight) {
          const left = cvButtonDocPos.left / canvas.clientWidth
          const right = cvButtonDocPos.right / canvas.clientWidth
          const top = (canvas.clientHeight - viewportBottom) / canvas.clientHeight
          const bottom = (canvas.clientHeight - viewportTop) / canvas.clientHeight

          glCtx.uniform4f(display.uniforms.uButtonBounds, left, top, right, bottom)
          glCtx.uniform1f(display.uniforms.uButtonRadius, cvButtonDocPos.borderRadius)
          glCtx.uniform1i(display.uniforms.uHasButton, 1)
        } else {
          glCtx.uniform1i(display.uniforms.uHasButton, 0)
        }
      } else {
        glCtx.uniform1i(display.uniforms.uHasButton, 0)
      }

      // Drag hint tint via rasterised mask — refresh each frame so it tracks the icon's drift
      if (hintOpacity > 0.001) {
        updateHintMask()
      }
      if (hintMaskRect && hintOpacity > 0.001) {
        glCtx.activeTexture(glCtx.TEXTURE2)
        glCtx.bindTexture(glCtx.TEXTURE_2D, hintMaskTexture)
        glCtx.uniform1i(display.uniforms.uHintMask, 2)
        glCtx.uniform4f(
          display.uniforms.uHintMaskRect,
          hintMaskRect.left,
          hintMaskRect.top,
          hintMaskRect.right,
          hintMaskRect.bottom
        )
        glCtx.uniform1i(display.uniforms.uHasHint, 1)
      } else {
        glCtx.uniform1i(display.uniforms.uHasHint, 0)
      }
    }

    // Reveal section cards as they scroll into view (unrelated to the fluid).
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible")
          }
        })
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    )

    const cards = document.querySelectorAll(".section-card")
    cards.forEach(card => observer.observe(card))

    const handleScroll = () => {
      // Fade out button overlay while scrolling
      targetButtonOpacity = 0

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }

      // Fade back in after scrolling stops
      scrollTimeout = setTimeout(() => {
        targetButtonOpacity = 1
      }, 300)
    }

    // Freeze the simulation while the tab is hidden (switched away / minimised) and
    // resume from exactly where it left off — no reset. All FBO state persists; the
    // engine only stops the rAF loop and resets its clock on return so dt doesn't jump.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        engine.pause()
      } else {
        engine.resume()
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // Hand off subtitle colouring to the shader now that WebGL is confirmed
    document.documentElement.classList.add("fluid-active")

    updateCvButtonPosition()
    updateHintMask()
    buildSubtitleGlyphMask()
    targetSubOpacity = 1.0
    // Match the CSS fade-in: animation begins at 0.6s, fully visible by ~1.4s
    const hintFadeInTimeout = setTimeout(() => {
      if (!dragHintDismissedRef.current) {
        updateHintMask()
        targetHintOpacity = 1.0
      }
      // Re-rasterise the subtitle glyphs once layout has settled after first paint
      buildSubtitleGlyphMask()
    }, 600)

    // Glyph metrics shift when web fonts finish loading — re-cache once they're ready
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        updateHintMask()
        buildSubtitleGlyphMask()
      })
    }

    engine.start({
      configureDisplay,
      onAfterBlit: updateSubtitleOverlay,
      onResize: () => {
        updateCvButtonPosition()
        updateHintMask()
        buildSubtitleGlyphMask()
      },
      onContextRestored: updateCvButtonPosition,
    })

    return () => {
      clearTimeout(hintFadeInTimeout)
      window.removeEventListener("scroll", handleScroll)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      observer.disconnect()
      document.documentElement.classList.remove("fluid-active")
      engine.destroy()
    }
  }, [])

  return (
    <>
      <canvas id="fluid-canvas" ref={canvasRef} />
      <div className="content">
        <section className="hero">
          <div className="hero-content">
            <h1>Jamie Everett</h1>
            <p className="subtitle" ref={subtitleRef}>
              Software Engineering Manager
              <canvas className="subtitle-overlay" ref={subtitleOverlayRef} aria-hidden="true" />
            </p>
            <p className="hero-intro">
              Building robust desktop and cloud applications with 5+ years of experience.
              Currently focused on ultrasonic NDT monitoring systems at Inductosense.
            </p>
            <div className="hero-links">
              <a href="https://linkedin.com/in/jamieeverett1" target="_blank" rel="noreferrer" data-splash="link">
                LinkedIn
              </a>
              <a href="https://github.com/jreverett" target="_blank" rel="noreferrer" data-splash="link">
                GitHub
              </a>
              <a href="/cv.pdf" className="cv-link" target="_blank" rel="noreferrer" data-splash="link">
                View CV
              </a>
            </div>
          </div>
          <div className="scroll-hint">
            <span>Scroll for more</span>
            <div className="arrow" />
          </div>
          <div
            ref={dragHintRef}
            className={`drag-hint${dragHintVisible && !dragHintDismissed ? " visible" : ""}${dragHintDismissed ? " dismissed" : ""}`}
            aria-hidden="true"
          >
            <svg
              ref={dragHintIconRef}
              className="drag-hint-cursor"
              width="13"
              height="17"
              viewBox="0 0 11 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 1 L1 14 L4 11 L6 15 L8 14 L6 10 L10 10 Z"
                fill="rgba(180, 240, 240, 0.95)"
                stroke="rgba(255, 255, 255, 0.9)"
                strokeWidth="0.9"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span ref={dragHintTextRef}>Drag anywhere</span>
          </div>
        </section>

        <section id="about">
          <div className="section-card">
            <div className="glow-line" />
            <h2 className="section-title">About</h2>
            <p className="section-body">
              I&apos;m a{" "}
              <a
                href="https://goo.gl/maps/VbZyJHhXb4CwRYxN9"
                target="_blank"
                rel="noreferrer"
              >
                Bristol-based
              </a>{" "}
              software engineering manager leading the development of ultrasonic NDT monitoring
              tools at{" "}
              <a href="https://www.inductosense.com/" target="_blank" rel="noreferrer">
                Inductosense
              </a>
              . I focus on building reliable cross-platform products that blend desktop
              performance with cloud connectivity.
            </p>
            <p className="section-body">
              I earned a first-class BSc (Hons.) in Computing from the{" "}
              <a href="https://www.plymouth.ac.uk/" target="_blank" rel="noreferrer">
                University of Plymouth
              </a>{" "}
              and have since specialised in .NET, Azure cloud services, and DevOps automation
              that helps teams ship with confidence.
            </p>
            <p className="section-body">
              As well as exploring the latest AI tools, I also enjoy baking desserts and trying new recipes.
              I like building things that work well and taste good.
            </p>
            <p className="section-body">
              You can explore more detail in my{" "}
              <a href="/cv.pdf" target="_blank" rel="noreferrer">
                CV
              </a>
              .
            </p>
          </div>
        </section>

        <section id="skills">
          <div className="section-card">
            <div className="glow-line" />
            <h2 className="section-title">Skills</h2>
            <div className="skills-grid">
              <div className="skill-category">
                <h3>Languages &amp; Frameworks</h3>
                <ul>
                  <li>C# / .NET 8</li>
                  <li>MAUI Blazor Hybrid</li>
                  <li>Entity Framework</li>
                  <li>SignalR</li>
                </ul>
              </div>
              <div className="skill-category">
                <h3>Cloud &amp; DevOps</h3>
                <ul>
                  <li>Azure SQL / App Services</li>
                  <li>Azure DevOps / CI/CD</li>
                  <li>SQL Server</li>
                  <li>Git</li>
                </ul>
              </div>
              <div className="skill-category">
                <h3>Practices</h3>
                <ul>
                  <li>System Architecture</li>
                  <li>xUnit / TDD</li>
                  <li>Agile / Scrum</li>
                  <li>AI-assisted Dev</li>
                </ul>
              </div>
              <div className="skill-category">
                <h3>Leadership</h3>
                <ul>
                  <li>Team Management</li>
                  <li>Technical Mentoring</li>
                  <li>Code Review</li>
                  <li>Project Planning</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="experience">
          <div className="section-card">
            <div className="glow-line" />
            <h2 className="section-title">Experience</h2>

            <div className="experience-item">
              <div className="experience-header">
                <div>
                  <div className="experience-title">
                    Software Engineer → Senior SE → Engineering Manager
                  </div>
                  <div className="experience-company">Inductosense</div>
                </div>
                <div className="experience-date">Nov 2023 → Present</div>
              </div>
              <p className="experience-desc">
                Developing ultrasonic NDT monitoring software for oil and gas, serving 100+
                enterprise customers.
              </p>
              <ul className="experience-highlights">
                <li>Led architecture of next-gen platform with .NET MAUI Blazor Hybrid.</li>
                <li>Designed offline-first architecture with dual sync (device↔local, local↔cloud).</li>
                <li>Built enterprise installer with complex install/uninstall workflows.</li>
                <li>Drove xUnit test coverage adoption for critical code paths.</li>
                <li>Promoted through team election to manage a team of 4.</li>
              </ul>
            </div>

            <div className="experience-item">
              <div className="experience-header">
                <div>
                  <div className="experience-title">Graduate SE → Software Engineer</div>
                  <div className="experience-company">Malvern Panalytical</div>
                </div>
                <div className="experience-date">Nov 2020 → Nov 2023</div>
              </div>
              <p className="experience-desc">
                International leader in scientific instrumentation producing Windows-based .NET
                desktop applications.
              </p>
              <ul className="experience-highlights">
                <li>Established CI/CD infrastructure on Azure DevOps across multiple teams.</li>
                <li>Designed and implemented automated testing frameworks.</li>
                <li>Served as Radiation Protection Supervisor for the Bristol office.</li>
              </ul>
            </div>

            <div className="experience-item">
              <div className="experience-header">
                <div>
                  <div className="experience-title">Software Developer (Industrial Placement)</div>
                  <div className="experience-company">BMT</div>
                </div>
                <div className="experience-date">Jun 2018 → Jun 2019</div>
              </div>
              <p className="experience-desc">
                Year-long placement at a world-leading defence consultancy.
              </p>
              <ul className="experience-highlights">
                <li>Upgraded legacy C# application for GDPR and ISO 27001 compliance.</li>
                <li>Developed SQL scripts for Ministry of Defence data restructuring.</li>
                <li>Prototyped a blockchain solution within one month.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="projects">
          <div className="section-card">
            <div className="glow-line" />
            <h2 className="section-title">Projects</h2>
            <div className="project-grid">
              {projects.map((project, index) => {
                const projectImage = images.find(
                  (image) => image.node.name === project.imageName
                )
                return (
                  <ProjectCard
                    key={index}
                    project={project}
                    image={projectImage}
                    tagUrls={tagUrls}
                  />
                )
              })}
            </div>
          </div>
        </section>

        <section id="contact">
          <div className="section-card">
            <div className="glow-line" />
            <h2 className="section-title">Get in Touch</h2>
            <div className="contact-links">
              <a href="https://linkedin.com/in/jamieeverett1" target="_blank" rel="noreferrer" data-splash="link">
                LinkedIn
              </a>
              <a href="https://github.com/jreverett" target="_blank" rel="noreferrer" data-splash="link">
                GitHub
              </a>
              <a href="/cv.pdf" target="_blank" rel="noreferrer" data-splash="link">
                View CV
              </a>
            </div>
          </div>
        </section>

      </div>
    </>
  )
}

// eslint-disable-next-line react/jsx-pascal-case
export const Head = () => <SEO title="Jamie Everett - Portfolio" titleTemplate={false} />
