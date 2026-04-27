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

    for (let i = 0; i < 700; i++) {
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

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + rand(-0.08, 0.08);
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

    function drawBrainLobe() {
      for (let pass = 0; pass < 3; pass++) {
        const alpha = [0.05, 0.1, 0.18][pass];
        const scale = [1.09, 1.04, 1][pass];
        const lobes = 18;
        ctx!.beginPath();
        for (let i = 0; i <= lobes * 5; i++) {
          const a = (i / lobes / 5) * Math.PI * 2;
          const lobe =
            1 +
            0.11 * Math.sin(lobes * a + t * 0.28) +
            0.055 * Math.sin(lobes * 2 * a - t * 0.18);
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

    function drawTendrils() {
      tendrils.forEach((td) => {
        const pts: [number, number][] = [];
        for (let i = 0; i < td.segments.length; i++) {
          const prog = i / (td.segments.length - 1);
          const r = prog * td.length;
          const wave =
            td.segments[i].drift *
            Math.sin(t * 0.75 + td.phase + td.segments[i].phase);
          const perp = td.angle + Math.PI / 2;
          pts.push([
            cx + Math.cos(td.angle) * r + Math.cos(perp) * wave,
            cy + Math.sin(td.angle) * r + Math.sin(perp) * wave,
          ]);
        }
        ctx!.beginPath();
        ctx!.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx!.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const fade = 0.45 + 0.3 * Math.sin(t * 1.1 + td.phase);
        const g = ctx!.createLinearGradient(
          cx,
          cy,
          pts[pts.length - 1][0],
          pts[pts.length - 1][1]
        );
        g.addColorStop(0, `rgba(90,170,255,${fade})`);
        g.addColorStop(0.5, `rgba(70,130,255,${fade * 0.55})`);
        g.addColorStop(1, "rgba(50,90,210,0)");
        ctx!.strokeStyle = g;
        ctx!.lineWidth = td.width;
        ctx!.stroke();
      });
    }

    function drawVeins() {
      for (let v = 0; v < 8; v++) {
        const a = (v / 8) * Math.PI * 2 + t * 0.045;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        for (let i = 1; i <= 9; i++) {
          const r = i * 21;
          const wa = a + Math.sin(t * 0.45 + v + i * 0.45) * 0.28;
          ctx!.lineTo(cx + Math.cos(wa) * r, cy + Math.sin(wa) * r);
        }
        const pulse = 0.35 + 0.28 * Math.sin(t * 2 + v);
        ctx!.strokeStyle = `rgba(90,190,255,${pulse})`;
        ctx!.lineWidth = 1.4;
        ctx!.stroke();
      }
    }

    function drawCore() {
      for (let ring = 5; ring > 0; ring--) {
        const r = ring * 13 + 4 * Math.sin(t * 3 + ring);
        const alpha = (6 - ring) * 0.038;
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

    function updateParticles() {
      particles.forEach((p) => {
        p.angle += p.speed;
        p.wobble += p.wobbleSpeed;
        const wobR = p.r + Math.sin(p.wobble) * p.wobbleAmp;
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
        if (p.size > 1.1) {
          const g = ctx!.createRadialGradient(
            p.x!,
            p.y!,
            0,
            p.x!,
            p.y!,
            p.size * 3
          );
          g.addColorStop(0, p.color + a * 0.35 + ")");
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx!.beginPath();
          ctx!.arc(p.x!, p.y!, p.size * 3, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
        }
      });
    }

    function spawnSpark() {
      if (Math.random() < 0.22) {
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
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(x, y);
        ctx!.strokeStyle = `rgba(195,140,255,${s.life * 0.75})`;
        ctx!.lineWidth = 0.7;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,195,255,${s.life})`;
        ctx!.fill();
      }
    }

    let frameId = 0;
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      drawTendrils();
      drawBrainLobe();
      drawVeins();
      updateParticles();
      drawParticles();
      spawnSpark();
      drawSparks();
      drawCore();
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
