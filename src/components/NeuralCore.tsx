import { useEffect, useRef } from "react";

const NeuralCore = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 800;
    const H = 500;
    canvas.width = W;
    canvas.height = H;
    const cx = W / 2;
    const cy = H / 2;

    const rand = (a: number, b: number) => Math.random() * (b - a) + a;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // ---------------- 3D Simplex Noise (Stefan Gustavson, public domain) ----------------
    const grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
    ];
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Array(512);
    const permMod12 = new Array(512);
    for (let i = 0; i < 512; i++) {
      perm[i] = p[i & 255];
      permMod12[i] = perm[i] % 12;
    }
    const F3 = 1 / 3;
    const G3 = 1 / 6;
    const noise3 = (xin: number, yin: number, zin: number) => {
      let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const k = Math.floor(zin + s);
      const tt = (i + j + k) * G3;
      const X0 = i - tt, Y0 = j - tt, Z0 = k - tt;
      const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (t0 >= 0) {
        const gi0 = permMod12[ii + perm[jj + perm[kk]]];
        t0 *= t0;
        n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0 + grad3[gi0][2] * z0);
      }
      let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (t1 >= 0) {
        const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]];
        t1 *= t1;
        n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1 + grad3[gi1][2] * z1);
      }
      let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (t2 >= 0) {
        const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]];
        t2 *= t2;
        n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2 + grad3[gi2][2] * z2);
      }
      let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (t3 >= 0) {
        const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]];
        t3 *= t3;
        n3 = t3 * t3 * (grad3[gi3][0] * x3 + grad3[gi3][1] * y3 + grad3[gi3][2] * z3);
      }
      return 32 * (n0 + n1 + n2 + n3);
    };
    // fBm: octaves of noise for richer organic feel
    const fbm = (x: number, y: number, z: number, oct = 3) => {
      let amp = 1, freq = 1, sum = 0, norm = 0;
      for (let o = 0; o < oct; o++) {
        sum += amp * noise3(x * freq, y * freq, z * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2;
      }
      return sum / norm;
    };

    type Particle = {
      r: number;
      angle: number;
      speed: number;
      size: number;
      wobble: number;
      wobbleSpeed: number;
      wobbleAmp: number;
      alpha: number;
      color: string;
      x?: number;
      y?: number;
      currentAlpha?: number;
    };
    type Tendril = {
      angle: number;
      length: number;
      segments: { drift: number; phase: number }[];
      width: number;
      phase: number;
    };
    type Spark = {
      x: number;
      y: number;
      tx: number;
      ty: number;
      life: number;
      speed: number;
    };

    const particles: Particle[] = [];
    const tendrils: Tendril[] = [];
    const sparks: Spark[] = [];
    let t = 0;

    for (let i = 0; i < 1100; i++) {
      particles.push({
        r: rand(30, 210),
        angle: rand(0, Math.PI * 2),
        speed: rand(0.001, 0.008) * (Math.random() < 0.5 ? 1 : -1),
        size: rand(0.3, 2.0),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.01, 0.06),
        wobbleAmp: rand(5, 22),
        alpha: rand(0.4, 1),
        color:
          Math.random() < 0.65
            ? `hsla(${rand(275, 330)},100%,72%,`
            : `hsla(${rand(190, 245)},100%,72%,`,
      });
    }

    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2 + rand(-0.08, 0.08);
      tendrils.push({
        angle,
        length: rand(220, 320),
        segments: Array.from({ length: 22 }, () => ({
          drift: rand(-26, 26),
          phase: rand(0, Math.PI * 2),
        })),
        width: rand(1.0, 3.4),
        phase: rand(0, Math.PI * 2),
      });
    }

    // breathing pulse for the whole organism
    const breath = () => 1 + 0.04 * Math.sin(t * 1.4) + 0.02 * fbm(0, 0, t * 0.5, 2);

    function drawAura() {
      const br = breath();
      const g = ctx!.createRadialGradient(cx, cy, 60, cx, cy, 320 * br);
      g.addColorStop(0, "rgba(180,90,255,0.18)");
      g.addColorStop(0.4, "rgba(120,60,220,0.08)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);
    }

    function drawBrainLobe() {
      const br = breath();
      for (let pass = 0; pass < 4; pass++) {
        const alpha = [0.05, 0.09, 0.16, 0.22][pass];
        const scale = [1.14, 1.08, 1.03, 1][pass] * br;
        ctx!.beginPath();
        const steps = 180;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          // domain warping: noise of noise
          const nx = Math.cos(a) * 1.7;
          const ny = Math.sin(a) * 1.7;
          const wx = nx + 0.6 * fbm(nx + 5.2, ny + 1.3, t * 0.18, 2);
          const wy = ny + 0.6 * fbm(nx + 9.7, ny + 4.1, t * 0.18, 2);
          const lobe =
            1 +
            0.18 * fbm(wx, wy, t * 0.22, 4) +
            0.06 * noise3(nx * 4.0, ny * 4.0, t * 0.4);
          const r = 192 * scale * lobe;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.closePath();
        const g = ctx!.createRadialGradient(cx, cy, 20, cx, cy, 230);
        g.addColorStop(0, `rgba(200,110,255,${alpha})`);
        g.addColorStop(0.5, `rgba(110,50,210,${alpha})`);
        g.addColorStop(1, `rgba(50,15,130,${alpha * 0.3})`);
        ctx!.fillStyle = g;
        ctx!.fill();
        ctx!.strokeStyle = `rgba(180,90,255,${alpha * 1.7})`;
        ctx!.lineWidth = pass === 3 ? 1.4 : 0.6;
        ctx!.stroke();
      }
    }

    function drawTendrils() {
      tendrils.forEach((td) => {
        const pts: [number, number][] = [];
        for (let i = 0; i < td.segments.length; i++) {
          const prog = i / (td.segments.length - 1);
          const r = prog * td.length * breath();
          const seed = td.segments[i].phase;
          // domain-warped fBm for snake-like flow
          const wxN = Math.cos(td.angle) * prog * 2.4 + seed;
          const wyN = Math.sin(td.angle) * prog * 2.4 + seed;
          const warp = fbm(wxN + 3.1, wyN - 2.7, t * 0.3, 2);
          const nVal = fbm(wxN + warp, wyN + warp, t * 0.4, 3);
          const wave = td.segments[i].drift * 1.8 * nVal;
          const perp = td.angle + Math.PI / 2;
          const along = 10 * noise3(seed, prog * 3, t * 0.5);
          pts.push([
            cx + Math.cos(td.angle) * (r + along) + Math.cos(perp) * wave,
            cy + Math.sin(td.angle) * (r + along) + Math.sin(perp) * wave,
          ]);
        }
        const last = pts[pts.length - 1];
        const fade = 0.55 + 0.35 * Math.sin(t * 1.2 + td.phase);

        // outer glow stroke
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const gGlow = ctx!.createLinearGradient(cx, cy, last[0], last[1]);
        gGlow.addColorStop(0, `rgba(140,90,255,${fade * 0.35})`);
        gGlow.addColorStop(1, "rgba(60,90,210,0)");
        ctx!.strokeStyle = gGlow;
        ctx!.lineWidth = td.width * 4;
        ctx!.stroke();

        // core stroke
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const g = ctx!.createLinearGradient(cx, cy, last[0], last[1]);
        g.addColorStop(0, `rgba(180,220,255,${fade})`);
        g.addColorStop(0.5, `rgba(110,160,255,${fade * 0.7})`);
        g.addColorStop(1, "rgba(50,90,210,0)");
        ctx!.strokeStyle = g;
        ctx!.lineWidth = td.width;
        ctx!.stroke();

        // bright tip
        const tipPulse = 0.5 + 0.5 * Math.sin(t * 2.4 + td.phase);
        const tg = ctx!.createRadialGradient(last[0], last[1], 0, last[0], last[1], 14);
        tg.addColorStop(0, `rgba(220,200,255,${0.6 * tipPulse})`);
        tg.addColorStop(1, "rgba(120,80,255,0)");
        ctx!.fillStyle = tg;
        ctx!.beginPath();
        ctx!.arc(last[0], last[1], 14, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    function drawVeins() {
      for (let v = 0; v < 14; v++) {
        const baseA = (v / 14) * Math.PI * 2 + t * 0.05;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        for (let i = 1; i <= 14; i++) {
          const r = i * 15;
          const wa =
            baseA +
            fbm(Math.cos(baseA) * 0.8, Math.sin(baseA) * 0.8 + i * 0.3, t * 0.4, 2) * 0.6;
          ctx!.lineTo(cx + Math.cos(wa) * r, cy + Math.sin(wa) * r);
        }
        const pulse = 0.4 + 0.35 * Math.sin(t * 2.2 + v);
        ctx!.strokeStyle = `rgba(120,200,255,${pulse})`;
        ctx!.lineWidth = 1.2;
        ctx!.stroke();
      }
    }

    function drawCore() {
      const br = breath();
      // chromatic aberration: 3 offset cores
      const offsets: [number, number, string][] = [
        [-1.5, 0, "rgba(255,80,180,"],
        [1.5, 0, "rgba(80,160,255,"],
        [0, 0, "rgba(255,230,255,"],
      ];
      offsets.forEach(([ox, oy, col]) => {
        for (let ring = 7; ring > 0; ring--) {
          const r = (ring * 14 + 5 * Math.sin(t * 3 + ring)) * br;
          const alpha = (8 - ring) * 0.04;
          const g = ctx!.createRadialGradient(
            cx + ox,
            cy + oy,
            0,
            cx + ox,
            cy + oy,
            r
          );
          g.addColorStop(0, `${col}${alpha * 2.4})`);
          g.addColorStop(0.5, `${col}${alpha * 1.2})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx!.beginPath();
          ctx!.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }
      });
      // hot center
      const hot = ctx!.createRadialGradient(cx, cy, 0, cx, cy, 22 * br);
      hot.addColorStop(0, "rgba(255,255,255,0.9)");
      hot.addColorStop(0.4, "rgba(255,200,255,0.4)");
      hot.addColorStop(1, "rgba(180,80,255,0)");
      ctx!.fillStyle = hot;
      ctx!.beginPath();
      ctx!.arc(cx, cy, 22 * br, 0, Math.PI * 2);
      ctx!.fill();
    }

    function updateParticles() {
      particles.forEach((p) => {
        p.angle += p.speed;
        p.wobble += p.wobbleSpeed;
        // noise-based radial breathing for each particle
        const wobR =
          p.r +
          Math.sin(p.wobble) * p.wobbleAmp +
          8 * noise3(Math.cos(p.angle) * 0.6, Math.sin(p.angle) * 0.6, t * 0.4);
        p.x = cx + Math.cos(p.angle) * wobR;
        p.y = cy + Math.sin(p.angle) * wobR;
        p.currentAlpha =
          p.alpha * (0.4 + 0.6 * Math.abs(Math.sin(p.wobble * 0.65)));
      });
    }

    function drawParticles() {
      particles.forEach((p) => {
        const a = p.currentAlpha ?? p.alpha;
        ctx!.beginPath();
        ctx!.arc(p.x!, p.y!, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = p.color + a + ")";
        ctx!.fill();
        if (p.size > 1.0) {
          const g = ctx!.createRadialGradient(
            p.x!,
            p.y!,
            0,
            p.x!,
            p.y!,
            p.size * 4
          );
          g.addColorStop(0, p.color + a * 0.45 + ")");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx!.beginPath();
          ctx!.arc(p.x!, p.y!, p.size * 4, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }
      });
    }

    function spawnSpark() {
      const count = Math.random() < 0.4 ? 2 : 1;
      for (let n = 0; n < count; n++) {
        if (Math.random() < 0.45) {
          const a = rand(0, Math.PI * 2);
          const r = rand(40, 200);
          sparks.push({
            x: cx + Math.cos(a) * r,
            y: cy + Math.sin(a) * r,
            tx: cx + Math.cos(a + rand(-0.9, 0.9)) * (r + rand(30, 110)),
            ty: cy + Math.sin(a + rand(-0.9, 0.9)) * (r + rand(30, 110)),
            life: 1,
            speed: rand(0.018, 0.05),
          });
        }
      }
    }

    function drawSparks() {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= s.speed;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        const prog = 1 - s.life;
        const x = lerp(s.x, s.tx, prog);
        const y = lerp(s.y, s.ty, prog);
        // glow line
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(x, y);
        ctx!.strokeStyle = `rgba(220,170,255,${s.life * 0.55})`;
        ctx!.lineWidth = 2.4;
        ctx!.stroke();
        // core line
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(x, y);
        ctx!.strokeStyle = `rgba(255,230,255,${s.life})`;
        ctx!.lineWidth = 0.8;
        ctx!.stroke();
        // head halo
        const hg = ctx!.createRadialGradient(x, y, 0, x, y, 6);
        hg.addColorStop(0, `rgba(255,230,255,${s.life})`);
        hg.addColorStop(1, "rgba(255,150,255,0)");
        ctx!.fillStyle = hg;
        ctx!.beginPath();
        ctx!.arc(x, y, 6, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    let frameId = 0;
    const frame = () => {
      // motion-blur trail instead of hard clear
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";
      drawAura();
      drawTendrils();
      drawBrainLobe();
      drawVeins();
      updateParticles();
      drawParticles();
      spawnSpark();
      drawSparks();
      drawCore();
      ctx.globalCompositeOperation = "source-over";

      t += 0.016;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <canvas ref={canvasRef} className="block w-full max-w-[800px]" />
    </div>
  );
};

export default NeuralCore;
