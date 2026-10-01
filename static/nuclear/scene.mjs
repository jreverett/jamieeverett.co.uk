import { clamp, environment, pumpFlow } from "./model.mjs";
export function createScene(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let width = 0,
    height = 0,
    bearing = 0,
    target = 0;
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  new ResizeObserver(resize).observe(canvas);
  const rect = (x, y, w, h, colour) => {
    ctx.fillStyle = colour;
    ctx.fillRect(x, y, w, h);
  };
  const path = (points, fill) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  function tower(x, ground, size, light) {
    const w = size * 0.57,
      top = ground - size;
    const shade = ctx.createLinearGradient(x - w, 0, x + w, 0);
    shade.addColorStop(0, light ? "#8d9991" : "#283c44");
    shade.addColorStop(0.32, light ? "#bdc5b7" : "#4a5e65");
    shade.addColorStop(0.7, light ? "#a0afa5" : "#354a53");
    shade.addColorStop(1, light ? "#697f7b" : "#243943");
    ctx.beginPath();
    ctx.moveTo(x - w, ground);
    ctx.bezierCurveTo(
      x - w * 0.44,
      ground - size * 0.4,
      x - w * 0.42,
      top + size * 0.25,
      x - w * 0.65,
      top,
    );
    ctx.lineTo(x + w * 0.65, top);
    ctx.bezierCurveTo(
      x + w * 0.42,
      top + size * 0.25,
      x + w * 0.44,
      ground - size * 0.4,
      x + w,
      ground,
    );
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "#132e3320";
    ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (i * w) / 9, ground);
      ctx.quadraticCurveTo(
        x + (i * w) / 22,
        top + size * 0.4,
        x + (i * w) / 13,
        top,
      );
      ctx.stroke();
    }
    for (let y = top + 8; y < ground; y += 9) {
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(x, top, w * 0.65, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = light ? "#60736e" : "#1e323b";
    ctx.fill();
    ctx.strokeStyle = "#ced5c244";
    ctx.stroke();
    rect(x - w, ground - 5, w * 2, 5, light ? "#647b72" : "#243a3d");
    for (let i = -5; i <= 5; i++)
      rect(x + (i * w) / 6, ground - 10, 3, 10, "#1f373a");
  }
  function building(x, y, w, h, lit, light, time, emergency) {
    rect(x, y - h, w, h, light ? "#73887d" : "#253c42");
    path(
      [
        [x, y - h],
        [x + 12, y - h - 7],
        [x + w + 12, y - h - 7],
        [x + w, y - h],
      ],
      light ? "#a1ad9e" : "#41575b",
    );
    path(
      [
        [x + w, y - h],
        [x + w + 12, y - h - 7],
        [x + w + 12, y - 6],
        [x + w, y],
      ],
      light ? "#536e67" : "#192f37",
    );
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < Math.floor(w / 13) - 1; col++) {
        const on = lit && (col + row) % 4 !== 0;
        const emergencyOn =
          emergency && col % 5 === 0 && Math.sin(time * 9 + col) > -0.85;
        rect(
          x + 8 + col * 13,
          y - h + 9 + row * 12,
          7,
          5,
          on ? "#ebd997" : emergencyOn ? "#eaa36d" : "#1b343a",
        );
        if (on || emergencyOn) {
          ctx.fillStyle = on ? "#f6dc7610" : "#eaa36d15";
          ctx.fillRect(x + 5 + col * 13, y - h + 6 + row * 12, 13, 11);
        }
      }
  }
  function draw(s, time, lowMotion) {
    if (!width || !height) return;
    bearing += (target - bearing) * 0.06;
    const e = environment(s.minute),
      day = clamp(Math.sin(((e.hour - 6) / 12) * Math.PI) * 2 + 0.22, 0.04, 1);
    const light = day > 0.35,
      lit = s.output > 45 && s.breaker,
      emergency = !lit;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(
      0,
      `rgb(${Math.round(20 + day * 91)},${Math.round(37 + day * 110)},${Math.round(49 + day * 102)})`,
    );
    sky.addColorStop(
      1,
      `rgb(${Math.round(49 + day * 125)},${Math.round(62 + day * 124)},${Math.round(71 + day * 110)})`,
    );
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    if (day < 0.3) {
      ctx.fillStyle = "#dae6db77";
      for (let i = 0; i < 40; i++)
        ctx.fillRect((i * 137.3) % width, (i * i * 23) % (height * 0.55), 1, 1);
      ctx.beginPath();
      ctx.arc(width * 0.28, height * 0.22, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#dfe7d6";
      ctx.fill();
    }
    ctx.save();
    ctx.translate(-bearing * 1.6, 0);
    const scale = width / 1280,
      ground = height * 0.86;
    for (let layer = 0; layer < 3; layer++) {
      const pts = [[-100, height]];
      for (let x = -100; x < width + 200; x += 20)
        pts.push([
          x,
          height * (0.64 + layer * 0.06) +
            Math.sin(x / 130 + layer * 1.8) * 8 +
            Math.sin(x / 49) * 3,
        ]);
      pts.push([width + 200, height]);
      path(
        pts,
        light
          ? ["#7b938744", "#607e7166", "#456b5f99"][layer]
          : ["#274653", "#203f46", "#163c3e"][layer],
      );
    }
    rect(-100, ground, width + 300, height, "#203d36");
    path(
      [
        [-100, height],
        [width * 0.3, ground + 7],
        [width * 0.9, ground],
        [width + 200, height],
      ],
      light ? "#607e6c" : "#233f3d",
    );
    path(
      [
        [width * 0.4, height],
        [width * 0.56, ground],
        [width * 0.57, ground],
        [width * 0.47, height],
      ],
      light ? "#8c9887" : "#435853",
    );
    const sx = (v) => v * scale;
    // The far bank uses repeated small buildings to keep the scene inexpensive.
    for (let i = 0; i < 15; i++) {
      const x = sx(50 + i * 80);
      building(
        x,
        ground - 10,
        sx(22),
        12 + (i % 3) * 5,
        lit,
        light,
        time,
        emergency,
      );
    }
    const towers = [
      { x: sx(770), y: ground - 8, size: height * 0.49 },
      { x: sx(927), y: ground - 3, size: height * 0.57 },
    ];
    const plume = clamp(
      (Math.min(s.heat, 6 + (6 + s.cooling * 1.35) * pumpFlow(s)) / 100) *
        (0.2 + s.cooling / 100),
      0,
      1.3,
    );
    for (const t of towers) {
      if (plume > 0.015) {
        for (let i = 25; i >= 0; i--) {
          const age =
            ((lowMotion ? i * 0.151 : time * 0.13 + i * 0.151) % 4) / 4;
          const drift = e.wind * age * 1.3;
          const x = t.x + drift + Math.sin(i * 3.7 + age * 2) * 12 * age;
          const y = t.y - t.size - age * height * 0.8;
          const radius = (5 + age * 40) * (0.6 + plume * 0.65);
          ctx.beginPath();
          ctx.ellipse(x, y, radius * 1.5, radius, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${light ? "226,234,220" : "137,166,176"},${(1 - age) * plume * 0.12})`;
          ctx.fill();
        }
      }
      tower(t.x, t.y, t.size, light);
    }
    const domeX = sx(572),
      domeY = ground - 4,
      domeR = height * 0.14;
    ctx.fillStyle = light ? "#aab6a8" : "#4a6165";
    ctx.beginPath();
    ctx.arc(domeX, domeY - 25, domeR, Math.PI, 0);
    ctx.lineTo(domeX + domeR, domeY);
    ctx.lineTo(domeX - domeR, domeY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#384e4c55";
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(
        domeX,
        domeY - 24,
        (Math.abs(i) * domeR) / 3 + 2,
        domeR,
        0,
        Math.PI,
        0,
      );
      ctx.stroke();
    }
    building(
      sx(616),
      ground + 6,
      sx(133),
      height * 0.18,
      lit,
      light,
      time,
      emergency,
    );
    building(
      sx(453),
      ground + 12,
      sx(77),
      height * 0.13,
      lit,
      light,
      time,
      emergency,
    );
    building(
      sx(780),
      ground + 19,
      sx(67),
      height * 0.12,
      lit,
      light,
      time,
      emergency,
    );
    for (const x of [1045, 1150, 1230]) {
      const px = sx(x),
        y = ground + 5;
      ctx.strokeStyle = light ? "#455f56" : "#344d4d";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px - 11, y);
      ctx.lineTo(px, y - 60);
      ctx.lineTo(px + 11, y);
      ctx.moveTo(px - 17, y - 40);
      ctx.lineTo(px + 17, y - 40);
      ctx.moveTo(px - 13, y - 51);
      ctx.lineTo(px + 13, y - 51);
      ctx.moveTo(px - 8, y - 21);
      ctx.lineTo(px + 7, y - 39);
      ctx.moveTo(px + 8, y - 21);
      ctx.lineTo(px - 7, y - 39);
      ctx.stroke();
      if (x < 1230) {
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(px, y - 51);
        ctx.quadraticCurveTo(
          px + sx(50),
          y - 35,
          px + sx(x === 1045 ? 105 : 80),
          y - 51,
        );
        ctx.stroke();
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = sx(430 + i * 52),
        y = ground + 24;
      rect(x, y - 15, 1, 15, "#2b4540");
      if (lit || i % 3 === 0) {
        ctx.fillStyle = lit ? "#f6dfab" : "#eea36d";
        ctx.beginPath();
        ctx.arc(x, y - 15, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 36; i++) {
      const x = ((i * 47 + 19) % (width + 150)) - 50,
        y = height - 3;
      path(
        [
          [x - 7, y],
          [x, y - 18 - (i % 3) * 5],
          [x + 7, y],
        ],
        light ? "#2f5143" : "#142f31",
      );
    }
    ctx.restore();
    if (e.cloud > 0.7) {
      ctx.fillStyle = `rgba(110,135,144,${(e.cloud - 0.7) * 0.25})`;
      ctx.fillRect(0, 0, width, height);
      if (!lowMotion) {
        ctx.strokeStyle = "#c0dbd420";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (let i = 0; i < 35; i++) {
          const x = (i * 97 + time * 24) % width,
            y = (i * 37 + time * 95) % height;
          ctx.moveTo(x, y);
          ctx.lineTo(x - 3, y + 9);
        }
        ctx.stroke();
      }
    }
  }
  return {
    draw,
    look(delta) {
      target = clamp(target + delta, -70, 70);
      return Math.round(90 + target);
    },
  };
}
