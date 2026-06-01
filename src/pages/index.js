import React, { useEffect, useRef, useState } from "react"
import { useStaticQuery, graphql } from "gatsby"
import SEO from "../components/SEO/SEO.jsx"
import { ProjectCard } from "../components"
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

    const gl = canvas.getContext("webgl", { alpha: false, antialias: false })

    if (!gl) {
      // eslint-disable-next-line no-console
      console.error("WebGL not supported")
      return undefined
    }

    const SIM_RESOLUTION = 256
    const DYE_RESOLUTION = 1024
    const SPLAT_RADIUS = 0.25
    const SPLAT_FORCE = 4000

    const ext = {
      formatRGBA: { internalFormat: gl.RGBA, format: gl.RGBA },
      formatRG: { internalFormat: gl.RGBA, format: gl.RGBA },
      formatR: { internalFormat: gl.RGBA, format: gl.RGBA },
      halfFloatTexType: gl.UNSIGNED_BYTE,
    }

    const halfFloat = gl.getExtension("OES_texture_half_float")
    const supportLinearFiltering = gl.getExtension(
      "OES_texture_half_float_linear"
    )

    if (halfFloat) {
      ext.halfFloatTexType = halfFloat.HALF_FLOAT_OES
    }

    const baseVertexShader = `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;
      
      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `

    const clearShader = `
      precision mediump float;
      uniform sampler2D uTexture;
      uniform float value;
      varying vec2 vUv;
      
      void main () {
        gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `

    const displayShader = `
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

    const splatShader = `
      precision highp float;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;
      varying vec2 vUv;
      
      void main () {
        vec2 p = vUv - point.xy;
        p.x *= aspectRatio;
        vec3 splat = exp(-dot(p, p) / radius) * color;
        vec3 base = texture2D(uTarget, vUv).xyz;
        gl_FragColor = vec4(base + splat, 1.0);
      }
    `

    const advectionShader = `
      precision highp float;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform float dt;
      uniform float dissipation;
      varying vec2 vUv;
      
      void main () {
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec3 result = dissipation * texture2D(uSource, coord).xyz;
        gl_FragColor = vec4(result, 1.0);
      }
    `

    const divergenceShader = `
      precision mediump float;
      uniform sampler2D uVelocity;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      
      void main () {
        float L = texture2D(uVelocity, vL).x;
        float R = texture2D(uVelocity, vR).x;
        float T = texture2D(uVelocity, vT).y;
        float B = texture2D(uVelocity, vB).y;
        float div = 0.5 * (R - L + T - B);
        gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `

    const curlShader = `
      precision mediump float;
      uniform sampler2D uVelocity;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      
      void main () {
        float L = texture2D(uVelocity, vL).y;
        float R = texture2D(uVelocity, vR).y;
        float T = texture2D(uVelocity, vT).x;
        float B = texture2D(uVelocity, vB).x;
        float vorticity = R - L - T + B;
        gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `

    const vorticityShader = `
      precision highp float;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      
      void main () {
        float L = texture2D(uCurl, vL).x;
        float R = texture2D(uCurl, vR).x;
        float T = texture2D(uCurl, vT).x;
        float B = texture2D(uCurl, vB).x;
        float C = texture2D(uCurl, vUv).x;
        
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C;
        force.y *= -1.0;
        
        vec2 vel = texture2D(uVelocity, vUv).xy;
        gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
      }
    `

    const pressureShader = `
      precision mediump float;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        float C = texture2D(uPressure, vUv).x;
        float divergence = texture2D(uDivergence, vUv).x;
        float pressure = (L + R + B + T - divergence) * 0.25;
        gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `

    const gradientSubtractShader = `
      precision mediump float;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      
      void main () {
        float L = texture2D(uPressure, vL).x;
        float R = texture2D(uPressure, vR).x;
        float T = texture2D(uPressure, vT).x;
        float B = texture2D(uPressure, vB).x;
        vec2 velocity = texture2D(uVelocity, vUv).xy;
        velocity.xy -= vec2(R - L, T - B);
        gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `

    const compileShader = (type, source) => {
      const shader = gl.createShader(type)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error(gl.getShaderInfoLog(shader))
      }
      return shader
    }

    const createProgram = (vertexSource, fragmentSource) => {
      const program = gl.createProgram()
      const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource)
      const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource)
      gl.attachShader(program, vertexShader)
      gl.attachShader(program, fragmentShader)
      gl.linkProgram(program)

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        // eslint-disable-next-line no-console
        console.error(gl.getProgramInfoLog(program))
      }

      const uniforms = {}
      const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
      for (let i = 0; i < uniformCount; i += 1) {
        const uniformName = gl.getActiveUniform(program, i).name
        uniforms[uniformName] = gl.getUniformLocation(program, uniformName)
      }

      return { program, uniforms }
    }

    const createFBO = (w, h, internalFormat, format, type, filter) => {
      gl.activeTexture(gl.TEXTURE0)
      const texture = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null
      )

      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      )
      gl.viewport(0, 0, w, h)
      gl.clear(gl.COLOR_BUFFER_BIT)

      return {
        texture,
        fbo,
        width: w,
        height: h,
        attach(id) {
          gl.activeTexture(gl.TEXTURE0 + id)
          gl.bindTexture(gl.TEXTURE_2D, texture)
          return id
        },
      }
    }

    const createDoubleFBO = (w, h, internalFormat, format, type, filter) => {
      let fbo1 = createFBO(w, h, internalFormat, format, type, filter)
      let fbo2 = createFBO(w, h, internalFormat, format, type, filter)

      return {
        width: w,
        height: h,
        texelSizeX: 1.0 / w,
        texelSizeY: 1.0 / h,
        get read() {
          return fbo1
        },
        set read(value) {
          fbo1 = value
        },
        get write() {
          return fbo2
        },
        set write(value) {
          fbo2 = value
        },
        swap() {
          const temp = fbo1
          fbo1 = fbo2
          fbo2 = temp
        },
      }
    }

    let programs = {}
    let velocity
    let divergence
    let curl
    let pressure
    let dye

    // Cache CV button position relative to document (not viewport)
    // This avoids getBoundingClientRect() lag during scroll
    let cvButtonDocPos = null

    // Scroll state for fading button overlay
    let scrollTimeout = null
    let buttonOpacity = 1.0
    let targetButtonOpacity = 1.0

    // Render WebGL output at device pixel resolution so the rasterised text mask
    // doesn't get upscaled by the browser (which was the cause of the blur).
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

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

    const initFluid = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)

      const simRes = getResolution(SIM_RESOLUTION)
      const dyeRes = getResolution(DYE_RESOLUTION)

      programs = {
        clear: createProgram(baseVertexShader, clearShader),
        display: createProgram(baseVertexShader, displayShader),
        splat: createProgram(baseVertexShader, splatShader),
        advection: createProgram(baseVertexShader, advectionShader),
        divergence: createProgram(baseVertexShader, divergenceShader),
        curl: createProgram(baseVertexShader, curlShader),
        vorticity: createProgram(baseVertexShader, vorticityShader),
        pressure: createProgram(baseVertexShader, pressureShader),
        gradientSubtract: createProgram(baseVertexShader, gradientSubtractShader),
      }

      const texType = ext.halfFloatTexType
      const rgba = ext.formatRGBA
      const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST

      velocity = createDoubleFBO(
        simRes.width,
        simRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      )
      divergence = createFBO(
        simRes.width,
        simRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        gl.NEAREST
      )
      curl = createFBO(
        simRes.width,
        simRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        gl.NEAREST
      )
      pressure = createDoubleFBO(
        simRes.width,
        simRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        gl.NEAREST
      )
      dye = createDoubleFBO(
        dyeRes.width,
        dyeRes.height,
        rgba.internalFormat,
        rgba.format,
        texType,
        filtering
      )

      const buffer = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      )
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      gl.enableVertexAttribArray(0)
    }

    const getResolution = resolution => {
      let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight
      if (aspectRatio < 1) {
        aspectRatio = 1 / aspectRatio
      }

      const min = Math.round(resolution)
      const max = Math.round(resolution * aspectRatio)

      if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
        return { width: max, height: min }
      }
      return { width: min, height: max }
    }

    const blit = target => {
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
        gl.viewport(0, 0, target.width, target.height)
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
      }
      gl.drawArrays(gl.TRIANGLE_FAN, 0, 4)
    }

    const splat = (x, y, dx, dy, color, radius = SPLAT_RADIUS) => {
      const prog = programs.splat
      gl.useProgram(prog.program)
      gl.uniform1i(prog.uniforms.uTarget, velocity.read.attach(0))
      gl.uniform1f(prog.uniforms.aspectRatio, canvas.width / canvas.height)
      gl.uniform2f(prog.uniforms.point, x, y)
      gl.uniform3f(prog.uniforms.color, dx, dy, 0.0)
      gl.uniform1f(prog.uniforms.radius, radius / 100.0)
      blit(velocity.write)
      velocity.swap()

      gl.uniform1i(prog.uniforms.uTarget, dye.read.attach(0))
      gl.uniform3f(prog.uniforms.color, color.r, color.g, color.b)
      blit(dye.write)
      dye.swap()
    }

    const step = dt => {
      gl.useProgram(programs.curl.program)
      gl.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0))
      blit(curl)

      gl.useProgram(programs.vorticity.program)
      gl.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(programs.vorticity.uniforms.uCurl, curl.attach(1))
      gl.uniform1f(programs.vorticity.uniforms.curl, 12)
      gl.uniform1f(programs.vorticity.uniforms.dt, dt)
      blit(velocity.write)
      velocity.swap()

      gl.useProgram(programs.divergence.program)
      gl.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0))
      blit(divergence)

      gl.useProgram(programs.clear.program)
      gl.uniform1i(programs.clear.uniforms.uTexture, pressure.read.attach(0))
      gl.uniform1f(programs.clear.uniforms.value, 0.8)
      blit(pressure.write)
      pressure.swap()

      gl.useProgram(programs.pressure.program)
      gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.pressure.uniforms.uDivergence, divergence.attach(0))
      for (let i = 0; i < 20; i += 1) {
        gl.uniform1i(programs.pressure.uniforms.uPressure, pressure.read.attach(1))
        blit(pressure.write)
        pressure.swap()
      }

      gl.useProgram(programs.gradientSubtract.program)
      gl.uniform2f(programs.gradientSubtract.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.gradientSubtract.uniforms.uPressure, pressure.read.attach(0))
      gl.uniform1i(programs.gradientSubtract.uniforms.uVelocity, velocity.read.attach(1))
      blit(velocity.write)
      velocity.swap()

      gl.useProgram(programs.advection.program)
      gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY)
      gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(programs.advection.uniforms.uSource, velocity.read.attach(0))
      gl.uniform1f(programs.advection.uniforms.dt, dt)
      gl.uniform1f(programs.advection.uniforms.dissipation, 0.995)
      blit(velocity.write)
      velocity.swap()

      gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0))
      gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1))
      gl.uniform1f(programs.advection.uniforms.dissipation, 0.985)
      blit(dye.write)
      dye.swap()
    }

    const render = () => {
      // Smoothly interpolate button opacity
      buttonOpacity += (targetButtonOpacity - buttonOpacity) * 0.15

      // Sync hint visibility with React dismissal state
      if (dragHintDismissedRef.current) {
        targetHintOpacity = 0.0
      }
      hintOpacity += (targetHintOpacity - hintOpacity) * 0.15
      // Subtitle effect is persistent — fades in once and stays (no scroll fade)
      subOpacity += (targetSubOpacity - subOpacity) * 0.15

      gl.useProgram(programs.display.program)
      gl.uniform1i(programs.display.uniforms.uTexture, dye.read.attach(0))
      gl.uniform1f(programs.display.uniforms.uOpacity, 1.0)
      gl.uniform2f(programs.display.uniforms.uCanvasSize, canvas.clientWidth, canvas.clientHeight)
      gl.uniform1f(programs.display.uniforms.uButtonOpacity, buttonOpacity)
      gl.uniform1f(programs.display.uniforms.uHintOpacity, hintOpacity)

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

          gl.uniform4f(programs.display.uniforms.uButtonBounds, left, top, right, bottom)
          gl.uniform1f(programs.display.uniforms.uButtonRadius, cvButtonDocPos.borderRadius)
          gl.uniform1i(programs.display.uniforms.uHasButton, 1)
        } else {
          gl.uniform1i(programs.display.uniforms.uHasButton, 0)
        }
      } else {
        gl.uniform1i(programs.display.uniforms.uHasButton, 0)
      }

      // Drag hint tint via rasterised mask — refresh each frame so it tracks the icon's drift
      if (hintOpacity > 0.001) {
        updateHintMask()
      }
      if (hintMaskRect && hintOpacity > 0.001) {
        gl.activeTexture(gl.TEXTURE2)
        gl.bindTexture(gl.TEXTURE_2D, hintMaskTexture)
        gl.uniform1i(programs.display.uniforms.uHintMask, 2)
        gl.uniform4f(
          programs.display.uniforms.uHintMaskRect,
          hintMaskRect.left,
          hintMaskRect.top,
          hintMaskRect.right,
          hintMaskRect.bottom
        )
        gl.uniform1i(programs.display.uniforms.uHasHint, 1)
      } else {
        gl.uniform1i(programs.display.uniforms.uHasHint, 0)
      }

      blit(null)

      // Subtitle overlay — read the fluid we just drew and paint the glyphs above the scrim
      updateSubtitleOverlay()
    }

    const pointers = []
    let lastTime = Date.now()
    let mouseStartedOnBackground = false

    const updatePointerPos = (pointer, x, y) => {
      pointer.prevX = pointer.x
      pointer.prevY = pointer.y
      pointer.x = x / canvas.clientWidth
      pointer.y = 1.0 - y / canvas.clientHeight
      pointer.dx = (pointer.x - pointer.prevX) * SPLAT_FORCE
      pointer.dy = (pointer.y - pointer.prevY) * SPLAT_FORCE
    }

    const createPointer = () => ({
      x: 0,
      y: 0,
      prevX: 0,
      prevY: 0,
      dx: 0,
      dy: 0,
      down: false,
      moved: false,
      color: { r: 0, g: 0.8, b: 0.85 },
    })

    pointers.push(createPointer())

    const isInteractiveElement = element => {
      if (!element) return false
      const interactiveTags = ['A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT']
      if (interactiveTags.includes(element.tagName)) return true
      if (element.closest('a, button, input, textarea, select')) return true
      const style = window.getComputedStyle(element)
      if (style.userSelect !== 'none' && style.cursor === 'text') return true
      return false
    }

    const isTextElement = element => {
      if (!element) return false
      // Check if element or ancestors contain direct text
      const textTags = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SPAN', 'LI', 'A', 'LABEL']
      if (textTags.includes(element.tagName)) return true
      if (element.closest('p, h1, h2, h3, h4, h5, h6, span, li, a, label')) return true
      return false
    }

    const handleMouseDown = event => {
      const clickedOnText = isTextElement(event.target)
      mouseStartedOnBackground = !clickedOnText && !isInteractiveElement(event.target)

      if (isInteractiveElement(event.target)) return
      const pointer = pointers[0]
      pointer.down = true
      updatePointerPos(pointer, event.clientX, event.clientY)

      // Prevent text selection if starting on background (not on text)
      if (mouseStartedOnBackground) {
        document.body.classList.add('no-select')
        // Clear any existing text selection
        window.getSelection()?.removeAllRanges()
      }
    }

    const handleMouseMove = event => {
      const pointer = pointers[0]
      updatePointerPos(pointer, event.clientX, event.clientY)
      if (pointer.down && !isInteractiveElement(event.target)) {
        pointer.moved = true
      }
    }

    const handleMouseUp = () => {
      pointers[0].down = false
      mouseStartedOnBackground = false
      document.body.classList.remove('no-select')
    }

    const handleTouchStart = event => {
      if (event.target !== canvas) return
      const touches = event.targetTouches
      while (pointers.length < touches.length) {
        pointers.push(createPointer())
      }
      for (let i = 0; i < touches.length; i += 1) {
        pointers[i].down = true
        updatePointerPos(pointers[i], touches[i].clientX, touches[i].clientY)
      }
    }

    const handleTouchMove = event => {
      if (event.target !== canvas) return
      const touches = event.targetTouches
      for (let i = 0; i < touches.length; i += 1) {
        updatePointerPos(pointers[i], touches[i].clientX, touches[i].clientY)
        pointers[i].moved = true
      }
    }

    const handleTouchEnd = event => {
      const touches = event.changedTouches
      for (let i = 0; i < touches.length; i += 1) {
        if (pointers[i]) {
          pointers[i].down = false
        }
      }
    }

    const handleClick = event => {
      const isLink = event.target.closest('a[data-splash="link"]')
      const color = isLink
        ? { r: 1.0, g: 0.4, b: 0.3 }
        : { r: 0, g: 0.85, b: 0.9 }

      const x = event.clientX / canvas.clientWidth
      const y = 1.0 - event.clientY / canvas.clientHeight

      for (let i = 0; i < 3; i += 1) {
        const angle = Math.random() * Math.PI * 2
        const force = 80 + Math.random() * 60
        setTimeout(() => {
          splat(
            x + (Math.random() - 0.5) * 0.02,
            y + (Math.random() - 0.5) * 0.02,
            Math.cos(angle) * force,
            Math.sin(angle) * force,
            color
          )
        }, i * 30)
      }
    }

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

    let animationFrameId
    let resizeTimeout
    let lastWidth = window.innerWidth
    let lastHeight = window.innerHeight

    const resize = () => {
      const newWidth = window.innerWidth
      const newHeight = window.innerHeight

      // Calculate changes
      const widthChanged = Math.abs(newWidth - lastWidth) > 1
      const heightDiff = Math.abs(newHeight - lastHeight)

      // Ignore small height-only changes (mobile address bar show/hide)
      // These typically cause 50-100px height changes but no width change
      const isMobileAddressBarChange = !widthChanged && heightDiff > 0 && heightDiff < 150

      if (isMobileAddressBarChange) {
        // Don't resize at all - this preserves the splashes
        return
      }

      // For real resize events, update canvas and reinitialize
      if (widthChanged || heightDiff > 0) {
        canvas.width = Math.round(newWidth * dpr)
        canvas.height = Math.round(newHeight * dpr)
        lastWidth = newWidth
        lastHeight = newHeight
        initFluid()
        updateCvButtonPosition()
        updateHintMask()
        buildSubtitleGlyphMask()
      }
    }

    const debouncedResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resize, 150)
    }

    const handleContextLost = (event) => {
      event.preventDefault()
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }

    const handleContextRestored = () => {
      initFluid()
      updateCvButtonPosition()
      animate()
    }
    const animate = () => {
      const now = Date.now()
      const dt = Math.min((now - lastTime) / 1000, 0.016)
      lastTime = now

      pointers.forEach(pointer => {
        if (pointer.moved) {
          pointer.moved = false
          splat(pointer.x, pointer.y, pointer.dx, pointer.dy, pointer.color)
        }
      })

      if (Math.random() < 0.012) {
        const x = Math.random()
        const y = Math.random()
        const angle = Math.random() * Math.PI * 2
        const force = 60 + Math.random() * 40
        const radius = 0.1 + Math.random() * 0.35

        let color
        const colorRoll = Math.random()
        if (colorRoll < 0.7) {
          color = {
            r: 0,
            g: 0.7 + Math.random() * 0.2,
            b: 0.8 + Math.random() * 0.15,
          }
        } else if (colorRoll < 0.8) {
          color = { r: 0.5 + Math.random() * 0.3, g: 0.2, b: 0.8 + Math.random() * 0.2 }
        } else if (colorRoll < 0.9) {
          color = {
            r: 0.9 + Math.random() * 0.1,
            g: 0.3 + Math.random() * 0.2,
            b: 0.6 + Math.random() * 0.2,
          }
        } else if (colorRoll < 0.95) {
          color = { r: 1.0, g: 0.7 + Math.random() * 0.2, b: 0.2 + Math.random() * 0.1 }
        } else {
          color = { r: 0.2, g: 0.8 + Math.random() * 0.2, b: 0.5 + Math.random() * 0.2 }
        }

        splat(x, y, Math.cos(angle) * force, Math.sin(angle) * force, color, radius)
      }

      step(dt)
      render()

      animationFrameId = window.requestAnimationFrame(animate)
    }

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
    // resume from exactly where it left off — no reset. All FBO state persists; we
    // only stop the rAF loop, then reset the clock on return so dt doesn't jump.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameId) {
          window.cancelAnimationFrame(animationFrameId)
          animationFrameId = null
        }
      } else if (!animationFrameId) {
        lastTime = Date.now()
        animationFrameId = window.requestAnimationFrame(animate)
      }
    }

    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: true })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })
    document.addEventListener("click", handleClick)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", debouncedResize)
    canvas.addEventListener("webglcontextlost", handleContextLost, false)
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false)

    // Hand off subtitle colouring to the shader now that WebGL is confirmed
    document.documentElement.classList.add("fluid-active")

    initFluid()
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
    animate()

    return () => {
      clearTimeout(hintFadeInTimeout)
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchstart", handleTouchStart)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
      document.removeEventListener("click", handleClick)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", debouncedResize)
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      canvas.removeEventListener("webglcontextrestored", handleContextRestored)
      observer.disconnect()
      clearTimeout(resizeTimeout)
      document.body.classList.remove('no-select')
      document.documentElement.classList.remove('fluid-active')
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
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
