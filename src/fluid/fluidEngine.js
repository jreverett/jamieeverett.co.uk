// Shared WebGL fluid-simulation engine ("Stable Fluids" GPU solver).
//
// Owns the solver core AND the animation loop, so the physics, the frame-rate
// compensation, and the ambient-splat cadence live in exactly one place and can
// never drift between consumers. Each consumer supplies only its own display
// shader and DOM overlays, wired in via the hooks passed to engine.start().
//
// Usage (two-phase so a consumer can build overlay closures against engine.gl
// before the loop starts):
//
//   const engine = createFluidEngine(canvas, { dpr, displayShaderSource })
//   if (!engine) return                       // WebGL unavailable
//   // ... define overlay fns using engine.gl / engine.canvas / engine.dpr ...
//   engine.start({ configureDisplay, onAfterBlit, onResize, onContextRestored })
//   // ... later: engine.destroy()
//
// This module is plain JS with no top-level DOM access, so it is SSR-safe; it is
// only ever invoked from inside a `typeof window` guarded effect.

import {
  baseVertexShader,
  clearShader,
  DEFAULT_DISPLAY_SHADER,
  splatShader,
  advectionShader,
  divergenceShader,
  curlShader,
  vorticityShader,
  pressureShader,
  gradientSubtractShader,
} from "./shaders"
import { rollAmbientColor } from "./ambientPalette"

const SIM_RESOLUTION = 256
const DYE_RESOLUTION = 1024
const SPLAT_RADIUS = 0.25
const SPLAT_FORCE = 4000
// Tuned for 60Hz; scaled by frame time so behaviour is identical at any
// refresh rate (these are the per-frame values at 60fps).
const VELOCITY_DISSIPATION = 0.995
const DYE_DISSIPATION = 0.985
const AMBIENT_SPLAT_CHANCE = 0.012

export function createFluidEngine(canvas, options = {}) {
  const { dpr = 1, displayShaderSource = DEFAULT_DISPLAY_SHADER } = options

  const gl = canvas.getContext("webgl", { alpha: false, antialias: false })
  if (!gl) {
    // eslint-disable-next-line no-console
    console.error("WebGL not supported")
    return null
  }

  const ext = {
    formatRGBA: { internalFormat: gl.RGBA, format: gl.RGBA },
    formatRG: { internalFormat: gl.RGBA, format: gl.RGBA },
    formatR: { internalFormat: gl.RGBA, format: gl.RGBA },
    halfFloatTexType: gl.UNSIGNED_BYTE,
  }

  const halfFloat = gl.getExtension("OES_texture_half_float")
  const supportLinearFiltering = gl.getExtension("OES_texture_half_float_linear")

  if (halfFloat) {
    ext.halfFloatTexType = halfFloat.HALF_FLOAT_OES
  }

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
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null)

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

  const initFluid = () => {
    // dpr=1 → 1x backing store (identical to the component); homepage passes
    // min(devicePixelRatio,2) so its rasterised text masks stay crisp.
    canvas.width = Math.round(canvas.clientWidth * dpr)
    canvas.height = Math.round(canvas.clientHeight * dpr)

    const simRes = getResolution(SIM_RESOLUTION)
    const dyeRes = getResolution(DYE_RESOLUTION)

    programs = {
      clear: createProgram(baseVertexShader, clearShader),
      display: createProgram(baseVertexShader, displayShaderSource),
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
    // Convert the per-frame (60fps) decay rates into the rate for this frame's
    // actual duration, so the fluid loses energy at the same speed regardless
    // of refresh rate.
    const frameScale = dt * 60
    const velocityDissipation = Math.pow(VELOCITY_DISSIPATION, frameScale)
    const dyeDissipation = Math.pow(DYE_DISSIPATION, frameScale)

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
    gl.uniform1f(programs.advection.uniforms.dissipation, velocityDissipation)
    blit(velocity.write)
    velocity.swap()

    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0))
    gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1))
    gl.uniform1f(programs.advection.uniforms.dissipation, dyeDissipation)
    blit(dye.write)
    dye.swap()
  }

  // --- Hooks (set in start) ---------------------------------------------------
  let hooks = {}

  const render = () => {
    const display = programs.display
    gl.useProgram(display.program)
    gl.uniform1i(display.uniforms.uTexture, dye.read.attach(0))
    gl.uniform1f(display.uniforms.uOpacity, 1.0)
    // Page sets any extra display uniforms here (homepage: button/hint/opacity).
    if (hooks.configureDisplay) hooks.configureDisplay(gl, display, { canvas, dpr })
    blit(null)
    // Page DOM overlays read the default framebuffer we just drew.
    if (hooks.onAfterBlit) hooks.onAfterBlit()
  }

  // --- Pointer handling -------------------------------------------------------
  const pointers = []
  let lastTime = Date.now()
  let mouseStartedOnBackground = false

  // Accumulate the drag delta rather than overwriting it, so every pointer move
  // that lands between two animation frames contributes to the velocity injected
  // that frame. This ties the injected force to total cursor displacement
  // regardless of how many moves arrive per frame (i.e. regardless of refresh
  // rate or mouse polling rate); dx/dy are cleared each frame in animate().
  const updatePointerPos = (pointer, x, y) => {
    const nx = x / canvas.clientWidth
    const ny = 1.0 - y / canvas.clientHeight
    pointer.dx += (nx - pointer.x) * SPLAT_FORCE
    pointer.dy += (ny - pointer.y) * SPLAT_FORCE
    pointer.x = nx
    pointer.y = ny
  }

  // Seat a fresh contact point (mouse-down / touch-start) without producing a
  // delta, so the first drag frame doesn't splat a spurious jump from the
  // pointer's stale (or zero) origin.
  const setPointerPos = (pointer, x, y) => {
    pointer.x = x / canvas.clientWidth
    pointer.y = 1.0 - y / canvas.clientHeight
    pointer.dx = 0
    pointer.dy = 0
  }

  const createPointer = () => ({
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
    down: false,
    moved: false,
    color: { r: 0, g: 0.8, b: 0.85 },
  })

  pointers.push(createPointer())

  const isInteractiveElement = element => {
    if (!element) return false
    const interactiveTags = ["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT"]
    if (interactiveTags.includes(element.tagName)) return true
    if (element.closest("a, button, input, textarea, select")) return true
    const style = window.getComputedStyle(element)
    if (style.userSelect !== "none" && style.cursor === "text") return true
    return false
  }

  const isTextElement = element => {
    if (!element) return false
    const textTags = ["P", "H1", "H2", "H3", "H4", "H5", "H6", "SPAN", "LI", "A", "LABEL"]
    if (textTags.includes(element.tagName)) return true
    if (element.closest("p, h1, h2, h3, h4, h5, h6, span, li, a, label")) return true
    return false
  }

  const handleMouseDown = event => {
    const clickedOnText = isTextElement(event.target)
    mouseStartedOnBackground = !clickedOnText && !isInteractiveElement(event.target)

    if (isInteractiveElement(event.target)) return
    const pointer = pointers[0]
    pointer.down = true
    setPointerPos(pointer, event.clientX, event.clientY)

    if (mouseStartedOnBackground) {
      document.body.classList.add("no-select")
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
    document.body.classList.remove("no-select")
  }

  const handleTouchStart = event => {
    if (event.target !== canvas) return
    const touches = event.targetTouches
    while (pointers.length < touches.length) {
      pointers.push(createPointer())
    }
    for (let i = 0; i < touches.length; i += 1) {
      pointers[i].down = true
      setPointerPos(pointers[i], touches[i].clientX, touches[i].clientY)
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
    const color = isLink ? { r: 1.0, g: 0.4, b: 0.3 } : { r: 0, g: 0.85, b: 0.9 }

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

  // --- Resize / context loss --------------------------------------------------
  let animationFrameId = null
  let running = false
  let resizeTimeout
  let lastWidth = window.innerWidth
  let lastHeight = window.innerHeight

  const resize = () => {
    const newWidth = window.innerWidth
    const newHeight = window.innerHeight

    const widthChanged = Math.abs(newWidth - lastWidth) > 1
    const heightDiff = Math.abs(newHeight - lastHeight)

    // Ignore small height-only changes (mobile address bar show/hide), which
    // would otherwise wipe the splashes.
    const isMobileAddressBarChange = !widthChanged && heightDiff > 0 && heightDiff < 150

    if (isMobileAddressBarChange) {
      return
    }

    if (widthChanged || heightDiff > 0) {
      lastWidth = newWidth
      lastHeight = newHeight
      initFluid()
      if (hooks.onResize) hooks.onResize()
    }
  }

  const debouncedResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(resize, 150)
  }

  const handleContextLost = event => {
    event.preventDefault()
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    running = false
  }

  const handleContextRestored = () => {
    initFluid()
    if (hooks.onContextRestored) hooks.onContextRestored()
    running = true
    lastTime = Date.now()
    animationFrameId = window.requestAnimationFrame(animate)
  }

  // --- Animation loop ---------------------------------------------------------
  function animate() {
    const now = Date.now()
    const dt = Math.min((now - lastTime) / 1000, 0.016)
    lastTime = now

    // Velocity (dx/dy) is displacement-based and already refresh-rate
    // independent, so it is injected as-is. Dye, however, is deposited once per
    // frame, so scale its contribution by the frame's duration to keep the
    // trail's brightness constant per second of dragging rather than per frame
    // (a held drag would otherwise read brighter on high-refresh displays).
    // dx/dy are then cleared so the next frame accumulates fresh.
    const dragFrameScale = dt * 60
    pointers.forEach(pointer => {
      if (pointer.moved) {
        pointer.moved = false
        const c = pointer.color
        splat(pointer.x, pointer.y, pointer.dx, pointer.dy, {
          r: c.r * dragFrameScale,
          g: c.g * dragFrameScale,
          b: c.b * dragFrameScale,
        })
      }
      pointer.dx = 0
      pointer.dy = 0
    })

    if (Math.random() < AMBIENT_SPLAT_CHANCE * dt * 60) {
      const x = Math.random()
      const y = Math.random()
      const angle = Math.random() * Math.PI * 2
      const force = 60 + Math.random() * 40
      const radius = 0.1 + Math.random() * 0.35
      const color = rollAmbientColor()
      splat(x, y, Math.cos(angle) * force, Math.sin(angle) * force, color, radius)
    }

    step(dt)
    render()

    animationFrameId = window.requestAnimationFrame(animate)
  }

  // --- Lifecycle --------------------------------------------------------------
  const addListeners = () => {
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchstart", handleTouchStart, { passive: true })
    document.addEventListener("touchmove", handleTouchMove, { passive: true })
    document.addEventListener("touchend", handleTouchEnd, { passive: true })
    document.addEventListener("click", handleClick)
    window.addEventListener("resize", debouncedResize)
    canvas.addEventListener("webglcontextlost", handleContextLost, false)
    canvas.addEventListener("webglcontextrestored", handleContextRestored, false)
  }

  const removeListeners = () => {
    document.removeEventListener("mousedown", handleMouseDown)
    document.removeEventListener("mousemove", handleMouseMove)
    document.removeEventListener("mouseup", handleMouseUp)
    document.removeEventListener("touchstart", handleTouchStart)
    document.removeEventListener("touchmove", handleTouchMove)
    document.removeEventListener("touchend", handleTouchEnd)
    document.removeEventListener("click", handleClick)
    window.removeEventListener("resize", debouncedResize)
    canvas.removeEventListener("webglcontextlost", handleContextLost)
    canvas.removeEventListener("webglcontextrestored", handleContextRestored)
  }

  const start = (h = {}) => {
    hooks = h
    addListeners()
    running = true
    lastTime = Date.now()
    animationFrameId = window.requestAnimationFrame(animate)
  }

  // Freeze the loop without tearing anything down (FBO state persists) and resume
  // from where it left off; resetting lastTime avoids a dt spike on return.
  const pause = () => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    running = false
  }

  const resume = () => {
    if (running) return
    running = true
    lastTime = Date.now()
    animationFrameId = window.requestAnimationFrame(animate)
  }

  const destroy = () => {
    removeListeners()
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    running = false
    clearTimeout(resizeTimeout)
    document.body.classList.remove("no-select")
  }

  // Build gl/programs/FBOs now; the loop and listeners start on engine.start().
  initFluid()

  return {
    gl,
    canvas,
    dpr,
    splat,
    blit,
    getDye: () => dye,
    getPrograms: () => programs,
    start,
    pause,
    resume,
    destroy,
  }
}
