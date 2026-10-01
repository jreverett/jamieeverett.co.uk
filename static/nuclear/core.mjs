import { clamp, heatStage } from "./model.mjs";
export function createCore(canvas, effects) {
  const ctx = canvas.getContext("2d"),
    fx = effects.getContext("2d");
  let width = 0,
    height = 0,
    screenW = 0,
    screenH = 0,
    spawn = 0,
    seed = 731;
  const particles = [];
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles.length = 0;
  }).observe(canvas);
  function resizeEffects() {
    screenW = innerWidth;
    screenH = innerHeight;
    effects.width = screenW;
    effects.height = screenH;
  }
  addEventListener("resize", resizeEffects);
  resizeEffects();
  function draw(s, dt, time, lowMotion) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const top = 8,
      bottom = height - 8,
      depth = ((bottom - top) * s.rodPosition) / 100;
    const rods = [0.16, 0.33, 0.5, 0.67, 0.84].map((x) => x * width);
    const moving = !s.paused && !s.meltdown && !lowMotion;
    if (moving) {
      spawn += dt * Math.min(s.neutrons, 700) * 0.85;
      while (spawn >= 1 && particles.length < 220) {
        spawn--;
        const angle = random() * Math.PI * 2;
        particles.push({
          x: 10 + random() * (width - 20),
          y: 10 + random() * (height - 20),
          vx: Math.cos(angle) * (30 + random() * 35),
          vy: Math.sin(angle) * (30 + random() * 35),
          life: 0.5 + random() * 1.2,
        });
      }
      spawn = Math.min(spawn, 1);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        const absorbed =
          p.y < top + depth && rods.some((x) => Math.abs(x - p.x) < 4);
        if (
          p.life <= 0 ||
          p.x < 8 ||
          p.x > width - 8 ||
          p.y < 8 ||
          p.y > height - 8 ||
          absorbed
        ) {
          particles.splice(i, 1);
          continue;
        }
      }
    }
    ctx.lineWidth = 1;
    const dots = lowMotion
      ? Array.from(
          { length: Math.min(220, Math.round(s.neutrons * 0.35)) },
          (_, i) => ({
            x: 12 + (((i * 47) % 100) / 100) * (width - 24),
            y: 12 + (((i * 71) % 100) / 100) * (height - 24),
            vx: 20,
            vy: 12,
            life: 1,
          }),
        )
      : particles;
    for (const p of dots) {
      ctx.strokeStyle = `rgba(154,237,255,${Math.min(0.75, p.life)})`;
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 0.07, p.y - p.vy * 0.07);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.fillStyle = "#efffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const x of rods) {
      ctx.fillStyle = "#080e16aa";
      ctx.fillRect(x - 4, top, 8, bottom - top);
      if (depth > 0) {
        const metal = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
        metal.addColorStop(0, "#577e91");
        metal.addColorStop(0.45, "#d3eaf0");
        metal.addColorStop(1, "#496879");
        ctx.fillStyle = metal;
        ctx.fillRect(x - 3, top, 6, depth);
        ctx.fillStyle = "#c9f2ff";
        ctx.fillRect(x - 3, top + depth - 2, 6, 2);
      }
      ctx.fillStyle = "#b7ced0";
      ctx.fillRect(x - 5, 2, 10, 5);
    }
    canvas.dataset.particles = String(dots.length);
    canvas.dataset.position = s.rodPosition.toFixed(1);
    drawHeat(s, lowMotion ? 0 : time);
  }
  function drawHeat(s, time) {
    fx.clearRect(0, 0, screenW, screenH);
    const stage = heatStage(s);
    effects.dataset.stage = stage;
    if (stage === "normal") return;
    const stress = clamp((s.temperature - 330) / 370, 0, 1);
    const glow = fx.createRadialGradient(
      screenW * 0.5,
      screenH * 0.5,
      screenH * 0.25,
      screenW * 0.5,
      screenH * 0.5,
      screenW * 0.7,
    );
    glow.addColorStop(0, "#ff4d0000");
    glow.addColorStop(1, `rgba(234,65,15,${stress * 0.35})`);
    fx.fillStyle = glow;
    fx.fillRect(0, 0, screenW, screenH);
    if (s.temperature >= 400) {
      fx.lineWidth = 1.5;
      for (let i = 0; i < 24; i++) {
        const age = (time * 0.8 + i * 0.179) % 1;
        const side = i % 2 ? screenW - 8 : 8;
        const direction = i % 2 ? -1 : 1;
        const x = side + direction * age * (25 + (i % 5) * 12);
        const y =
          screenH * (0.35 + (i % 7) * 0.08) -
          Math.sin(age * Math.PI) * 48 +
          age * age * 35;
        fx.strokeStyle = `rgba(255,${190 - (i % 3) * 30},75,${(1 - age) * stress})`;
        fx.beginPath();
        fx.moveTo(x, y);
        fx.lineTo(x - direction * 5, y + 3);
        fx.stroke();
      }
    }
    if (s.temperature >= 500) {
      for (let i = 0; i < 18; i++) {
        const x = ((i + 0.5) / 18) * screenW;
        const h =
          (25 + stress * 65) * (1 + 0.25 * Math.sin(time * 3 + i * 2.1));
        const w = 20 + stress * 20;
        const gradient = fx.createLinearGradient(0, screenH, 0, screenH - h);
        gradient.addColorStop(0, "#ff972cbb");
        gradient.addColorStop(0.4, "#e34c1966");
        gradient.addColorStop(1, "#ffb52600");
        fx.fillStyle = gradient;
        fx.beginPath();
        fx.moveTo(x - w, screenH);
        fx.bezierCurveTo(
          x - w * 0.5,
          screenH - h * 0.6,
          x + w * 0.3 + Math.sin(time * 2 + i) * 9,
          screenH - h,
          x,
          screenH - h,
        );
        fx.bezierCurveTo(
          x + w,
          screenH - h * 0.35,
          x + w * 0.5,
          screenH - h * 0.2,
          x + w,
          screenH,
        );
        fx.closePath();
        fx.fill();
      }
    }
  }
  return {
    draw,
    reset() {
      particles.length = 0;
      spawn = 0;
    },
  };
}
