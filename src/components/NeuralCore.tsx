import { useEffect, useRef, useState } from "react";

type Settings = {
  particleCount: number;
  tendrilCount: number;
  veinCount: number;
  lobeAmp: number;
  tendrilWaveAmp: number;
  sparkRate: number;
  coreSize: number;
  glowAlpha: number;
  speed: number;
};

const DEFAULTS: Settings = {
  particleCount: 700,
  tendrilCount: 16,
  veinCount: 8,
  lobeAmp: 0.13,
  tendrilWaveAmp: 1.4,
  sparkRate: 0.22,
  coreSize: 1,
  glowAlpha: 1,
  speed: 1,
};

const NeuralCore = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const settingsRef = useRef<Settings>(DEFAULTS);
  const [showPanel, setShowPanel] = useState(true);

  // keep ref in sync so the rAF loop always reads latest values
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

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

    // ---------------- 3D Simplex Noise ----------------
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
      r: number; angle: number; speed: number; size: number;
      wobble: number; wobbleSpeed: number; wobbleAmp: number;
      alpha: number; color: string;
      x?: number; y?: number; currentAlpha?: number;
    };
    type Tendril = {
      angle: number; length: number;
      segments: { drift: number; phase: number }[];
      width: number; phase: number;
    };
    type Spark = {
      x: number; y: number; tx: number; ty: number; life: number; speed: number;
    };

    // Pools sized to MAX so we can change count via slider without re-init
    const MAX_PARTICLES = 1500;
    const MAX_TENDRILS = 40;
    const particles: Particle[] = [];
    const tendrils: Tendril[] = [];
    const sparks: Spark[] = [];
    let t = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        r: rand(40, 195),
        angle: rand(0, Math.PI * 2),
        speed: rand(0.001, 0.006),
        size: rand(0.3, 1.6),
        wobble: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.01, 0.05),
        wobbleAmp: rand(5, 18),
        alpha: rand(0.4, 1),
        color:
          Math.random() < 0.65
            ? `hsla(${rand(275, 330)},100%,72%,`
            : `hsla(${rand(195, 245)},100%,72%,`,
      });
    }
    for (let i = 0; i < MAX_TENDRILS; i++) {
      const angle = (i / MAX_TENDRILS) * Math.PI * 2 + rand(-0.08, 0.08);
      tendrils.push({
        angle,
        length: rand(200, 290),
        segments: Array.from({ length: 14 }, () => ({
          drift: rand(-20, 20),
          phase: rand(0, Math.PI * 2),
        })),
        width: rand(1.2, 3.2),
        phase: rand(0, Math.PI * 2),
      });
    }

    function drawBrainLobe(s: Settings) {
      for (let pass = 0; pass < 3; pass++) {
        const alpha = [0.05, 0.1, 0.18][pass] * s.glowAlpha;
        const scale = [1.09, 1.04, 1][pass];
        ctx!.beginPath();
        const steps = 90;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const nx = Math.cos(a) * 1.6;
          const ny = Math.sin(a) * 1.6;
          const lobe =
            1 +
            s.lobeAmp * fbm(nx, ny, t * 0.18, 3) +
            (s.lobeAmp * 0.4) * noise3(nx * 3.5, ny * 3.5, t * 0.32);
          const r = 188 * scale * lobe;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y);
        }
        ctx!.closePath();
        const g = ctx!.createRadialGradient(cx, cy, 20, cx, cy, 210);
        g.addColorStop(0, `rgba(180,90,255,${alpha})`);
        g.addColorStop(0.5, `rgba(110,50,210,${alpha})`);
        g.addColorStop(1, `rgba(50,15,130,${alpha * 0.3})`);
        ctx!.fillStyle = g;
        ctx!.fill();
        ctx!.strokeStyle = `rgba(155,70,255,${alpha * 1.6})`;
        ctx!.lineWidth = pass === 2 ? 1.1 : 0.5;
        ctx!.stroke();
      }
    }

    function drawTendrils(s: Settings) {
      const n = Math.min(s.tendrilCount, tendrils.length);
      for (let k = 0; k < n; k++) {
        const td = tendrils[k];
        const pts: [number, number][] = [];
        for (let i = 0; i < td.segments.length; i++) {
          const prog = i / (td.segments.length - 1);
          const r = prog * td.length;
          const seed = td.segments[i].phase;
          const nVal = fbm(
            Math.cos(td.angle) * prog * 2.2 + seed,
            Math.sin(td.angle) * prog * 2.2 + seed,
            t * 0.35,
            2
          );
          const wave = td.segments[i].drift * s.tendrilWaveAmp * nVal;
          const perp = td.angle + Math.PI / 2;
          const along = 6 * noise3(seed, prog * 3, t * 0.4);
          pts.push([
            cx + Math.cos(td.angle) * (r + along) + Math.cos(perp) * wave,
            cy + Math.sin(td.angle) * (r + along) + Math.sin(perp) * wave,
          ]);
        }
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const fade = (0.45 + 0.3 * Math.sin(t * 1.1 + td.phase)) * s.glowAlpha;
        const g = ctx!.createLinearGradient(
          cx, cy, pts[pts.length - 1][0], pts[pts.length - 1][1]
        );
        g.addColorStop(0, `rgba(90,170,255,${fade})`);
        g.addColorStop(0.5, `rgba(70,130,255,${fade * 0.55})`);
        g.addColorStop(1, "rgba(50,90,210,0)");
        ctx!.strokeStyle = g;
        ctx!.lineWidth = td.width;
        ctx!.stroke();
      }
    }

    function drawVeins(s: Settings) {
      for (let v = 0; v < s.veinCount; v++) {
        const a = (v / s.veinCount) * Math.PI * 2 + t * 0.045;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        for (let i = 1; i <= 9; i++) {
          const r = i * 21;
          const wa = a + Math.sin(t * 0.45 + v + i * 0.45) * 0.28;
          ctx!.lineTo(cx + Math.cos(wa) * r, cy + Math.sin(wa) * r);
        }
        const pulse = (0.35 + 0.28 * Math.sin(t * 2 + v)) * s.glowAlpha;
        ctx!.strokeStyle = `rgba(90,190,255,${pulse})`;
        ctx!.lineWidth = 1.4;
        ctx!.stroke();
      }
    }

    function drawCore(s: Settings) {
      for (let ring = 5; ring > 0; ring--) {
        const r = (ring * 13 + 4 * Math.sin(t * 3 + ring)) * s.coreSize;
        const alpha = (6 - ring) * 0.038 * s.glowAlpha;
        const g = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(255,215,255,${alpha * 3})`);
        g.addColorStop(0.4, `rgba(210,90,255,${alpha * 2})`);
        g.addColorStop(1, "rgba(130,50,240,0)");
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.fillStyle = g;
        ctx!.fill();
      }
    }

    function updateParticles(s: Settings) {
      const n = Math.min(s.particleCount, particles.length);
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        p.angle += p.speed * s.speed;
        p.wobble += p.wobbleSpeed * s.speed;
        const wobR = p.r + Math.sin(p.wobble) * p.wobbleAmp;
        p.x = cx + Math.cos(p.angle) * wobR;
        p.y = cy + Math.sin(p.angle) * wobR;
        p.currentAlpha =
          p.alpha * (0.4 + 0.6 * Math.abs(Math.sin(p.wobble * 0.65)));
      }
    }

    function drawParticles(s: Settings) {
      const n = Math.min(s.particleCount, particles.length);
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        const a = (p.currentAlpha ?? p.alpha) * s.glowAlpha;
        ctx!.beginPath();
        ctx!.arc(p.x!, p.y!, p.size, 0, Math.PI * 2);
        ctx!.fillStyle = p.color + a + ")";
        ctx!.fill();
        if (p.size > 1.1) {
          const g = ctx!.createRadialGradient(p.x!, p.y!, 0, p.x!, p.y!, p.size * 3);
          g.addColorStop(0, p.color + a * 0.35 + ")");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx!.beginPath();
          ctx!.arc(p.x!, p.y!, p.size * 3, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }
      }
    }

    function spawnSpark(s: Settings) {
      if (Math.random() < s.sparkRate) {
        const a = rand(0, Math.PI * 2);
        const r = rand(50, 190);
        sparks.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          tx: cx + Math.cos(a + rand(-0.7, 0.7)) * (r + rand(25, 85)),
          ty: cy + Math.sin(a + rand(-0.7, 0.7)) * (r + rand(25, 85)),
          life: 1,
          speed: rand(0.018, 0.045),
        });
      }
    }

    function drawSparks(s: Settings) {
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.life -= sp.speed * s.speed;
        if (sp.life <= 0) { sparks.splice(i, 1); continue; }
        const prog = 1 - sp.life;
        const x = lerp(sp.x, sp.tx, prog);
        const y = lerp(sp.y, sp.ty, prog);
        ctx!.beginPath();
        ctx!.moveTo(sp.x, sp.y);
        ctx!.lineTo(x, y);
        ctx!.strokeStyle = `rgba(195,140,255,${sp.life * 0.75 * s.glowAlpha})`;
        ctx!.lineWidth = 0.7;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,195,255,${sp.life * s.glowAlpha})`;
        ctx!.fill();
      }
    }

    let frameId = 0;
    const frame = () => {
      const s = settingsRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      drawTendrils(s);
      drawBrainLobe(s);
      drawVeins(s);
      updateParticles(s);
      drawParticles(s);
      spawnSpark(s);
      drawSparks(s);
      drawCore(s);
      t += 0.016 * s.speed;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(frameId);
  }, []);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [k]: v }));

  const Slider = ({
    label, k, min, max, step,
  }: {
    label: string; k: keyof Settings; min: number; max: number; step: number;
  }) => (
    <label className="flex flex-col gap-1 text-xs text-white/80">
      <div className="flex justify-between font-mono">
        <span>{label}</span>
        <span className="text-white/50">{Number(settings[k]).toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[k]}
        onChange={(e) => set(k, Number(e.target.value) as Settings[typeof k])}
        className="w-full accent-fuchsia-400"
      />
    </label>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <canvas ref={canvasRef} className="block w-full max-w-[800px]" />

      <button
        onClick={() => setShowPanel((v) => !v)}
        className="absolute top-4 right-4 rounded-md border border-white/20 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-widest text-white/80 backdrop-blur hover:bg-white/10"
      >
        {showPanel ? "Hide" : "Controls"}
      </button>

      {showPanel && (
        <div className="absolute top-16 right-4 w-64 space-y-3 rounded-lg border border-white/10 bg-black/60 p-4 backdrop-blur">
          <div className="text-xs font-semibold uppercase tracking-widest text-fuchsia-300">
            Neural Controls
          </div>
          <Slider label="Particles" k="particleCount" min={0} max={1500} step={50} />
          <Slider label="Tendrils" k="tendrilCount" min={0} max={40} step={1} />
          <Slider label="Veins" k="veinCount" min={0} max={20} step={1} />
          <Slider label="Lobe deform" k="lobeAmp" min={0} max={0.5} step={0.01} />
          <Slider label="Tendril wave" k="tendrilWaveAmp" min={0} max={4} step={0.1} />
          <Slider label="Sparks rate" k="sparkRate" min={0} max={1} step={0.02} />
          <Slider label="Core size" k="coreSize" min={0.3} max={3} step={0.05} />
          <Slider label="Glow" k="glowAlpha" min={0} max={2} step={0.05} />
          <Slider label="Speed" k="speed" min={0} max={3} step={0.05} />
          <button
            onClick={() => setSettings(DEFAULTS)}
            className="w-full rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default NeuralCore;
