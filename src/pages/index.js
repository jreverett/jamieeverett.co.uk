import React, { useEffect, useRef } from "react"
import SEO from "../components/SEO/SEO.jsx"
import "./index.css"

export default function Home() {
  const canvasRef = useRef(null)

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
      varying vec2 vUv;

      void main () {
        vec3 c = texture2D(uTexture, vUv).rgb;
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

    const initFluid = () => {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight

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
      gl.useProgram(programs.display.program)
      gl.uniform1i(programs.display.uniforms.uTexture, dye.read.attach(0))
      gl.uniform1f(programs.display.uniforms.uOpacity, 1.0)
      blit(null)
    }

    const pointers = []
    let lastTime = Date.now()

    const updatePointerPos = (pointer, x, y) => {
      pointer.prevX = pointer.x
      pointer.prevY = pointer.y
      pointer.x = x / canvas.width
      pointer.y = 1.0 - y / canvas.height
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

    const handleMouseDown = event => {
      if (isInteractiveElement(event.target)) return
      const pointer = pointers[0]
      pointer.down = true
      updatePointerPos(pointer, event.clientX, event.clientY)
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

      const x = event.clientX / canvas.width
      const y = 1.0 - event.clientY / canvas.height

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
        canvas.width = newWidth
        canvas.height = newHeight
        lastWidth = newWidth
        lastHeight = newHeight
        initFluid()
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

    initFluid()
    animate()

    return () => {
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
      observer.disconnect()
      clearTimeout(resizeTimeout)
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  return (
    <>
      {/* eslint-disable-next-line react/jsx-pascal-case */}
      <SEO title="Jamie Everett - Software Engineering Manager" />
      <canvas id="fluid-canvas" ref={canvasRef} />
      <div className="content">
        <section className="hero">
          <div className="hero-content">
            <h1>Jamie Everett</h1>
            <p className="subtitle">Software Engineering Manager</p>
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
              <div className="project-card">
                <h3>jamieeverett.co.uk</h3>
                <p>Personal portfolio with interactive WebGL fluid simulation background.</p>
                <div className="project-tech">
                  <span>React</span>
                  <span>Gatsby</span>
                  <span>WebGL</span>
                  <span>Netlify</span>
                </div>
              </div>
              <div className="project-card">
                <h3>Upvent</h3>
                <p>Event management system with real-time notifications and subscription features.</p>
                <div className="project-tech">
                  <span>React</span>
                  <span>Node.js</span>
                  <span>MongoDB</span>
                  <span>Express</span>
                </div>
              </div>
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
