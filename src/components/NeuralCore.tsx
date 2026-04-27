import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";
import GUI from "lil-gui";

// Classic 3D simplex noise (Ashima)
const SIMPLEX_NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0,1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const NeuralCore = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x05010a, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    mount.appendChild(renderer.domElement);

    // Scene + camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3;
    controls.maxDistance = 14;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;

    // ---------- Uniforms ----------
    const uniforms = {
      uTime: { value: 0 },
      uPulse: { value: 1.0 },
      uNoiseAmp: { value: 0.22 },
      uNoiseFreq: { value: 1.4 },
      uColorA: { value: new THREE.Color("#6a00ff") }, // deep violet
      uColorB: { value: new THREE.Color("#ff3df0") }, // pink
      uColorC: { value: new THREE.Color("#ffffff") }, // white core
      uFresnelPower: { value: 2.2 },
      uGlow: { value: 0.6 },
    };

    // ---------- Inner core sphere (deformed, fresnel + gradient) ----------
    const coreGeo = new THREE.IcosahedronGeometry(1.0, 64);
    const coreMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vPos;
        varying float vDisp;
        uniform float uTime;
        uniform float uNoiseAmp;
        uniform float uNoiseFreq;
        ${SIMPLEX_NOISE_GLSL}
        void main(){
          vec3 p = position;
          float n = snoise(p * uNoiseFreq + vec3(0.0, uTime*0.25, 0.0));
          float n2 = snoise(p * (uNoiseFreq*2.1) - vec3(uTime*0.15));
          float disp = n * 0.7 + n2 * 0.3;
          vDisp = disp;
          p += normal * disp * uNoiseAmp;
          vec4 wp = modelMatrix * vec4(p,1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - wp.xyz);
          vPos = p;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vPos;
        varying float vDisp;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        uniform float uFresnelPower;
        uniform float uTime;
        uniform float uPulse;
        uniform float uGlow;
        void main(){
          float fres = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), uFresnelPower);
          float radius = length(vPos);
          float pulse = 0.6 + 0.4 * sin(uTime * 2.0) * uPulse;
          float shellMask = smoothstep(1.02, 0.72, radius);
          float coreMask = 1.0 - smoothstep(0.0, 0.42, radius);
          float filament = smoothstep(0.18, 0.72, abs(vDisp));
          vec3 shell = uColorA * (fres * 0.5 + filament * 0.22) * shellMask;
          vec3 inner = uColorB * shellMask * 0.18 * (0.7 + pulse * 0.3);
          vec3 nucleus = mix(uColorB, uColorC, coreMask) * coreMask * (1.0 + pulse * 0.18);
          vec3 col = (shell + inner + nucleus) * uGlow;
          float alpha = clamp(fres * 0.22 + shellMask * 0.12 + coreMask * 0.34, 0.0, 0.58);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // Bright inner nucleus
    const nucleusMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        uniform float uTime;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        void main(){
          float r = length(vP);
          float pulse = 0.7 + 0.3 * sin(uTime*3.0);
          float core = smoothstep(0.32, 0.0, r) * pulse;
          vec3 c = mix(uColorB, uColorC, smoothstep(0.4, 0.0, r));
          gl_FragColor = vec4(c * core * 1.45, core * 0.55);
        }`,
    });
    const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 32), nucleusMat);
    scene.add(nucleus);

    // ---------- Neural connections (lines) ----------
    const NEURON_COUNT = 220;
    const neuronPoints: THREE.Vector3[] = [];
    for (let i = 0; i < NEURON_COUNT; i++) {
      // Distribute on sphere with slight inward jitter
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 1.0 + (Math.random() - 0.5) * 0.08;
      neuronPoints.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        ),
      );
    }

    const lineSegments: number[] = [];
    const lineSeeds: number[] = [];
    const MAX_DIST = 0.55;
    for (let i = 0; i < neuronPoints.length; i++) {
      for (let j = i + 1; j < neuronPoints.length; j++) {
        const d = neuronPoints[i].distanceTo(neuronPoints[j]);
        if (d < MAX_DIST) {
          const a = neuronPoints[i];
          const b = neuronPoints[j];
          lineSegments.push(a.x, a.y, a.z, b.x, b.y, b.z);
          const seed = Math.random();
          lineSeeds.push(0, seed, 1, seed);
        }
      }
    }

    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setAttribute("position", new THREE.Float32BufferAttribute(lineSegments, 3));
    linesGeo.setAttribute("aLine", new THREE.Float32BufferAttribute(lineSeeds, 2));

    const linesMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        attribute vec2 aLine; // x: t (0 or 1), y: seed
        varying float vT;
        varying float vSeed;
        uniform float uTime;
        ${SIMPLEX_NOISE_GLSL}
        void main(){
          vT = aLine.x;
          vSeed = aLine.y;
          vec3 p = position;
          float n = snoise(p * 1.8 + vec3(uTime * 0.4 + aLine.y * 10.0));
          p += normalize(p) * n * 0.04;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        varying float vT;
        varying float vSeed;
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        void main(){
          float flow = fract(vT - uTime * (0.4 + vSeed * 0.6) + vSeed);
          float pulse = smoothstep(0.0, 0.15, flow) * smoothstep(1.0, 0.6, flow);
          float base = 0.18;
          vec3 col = mix(uColorA, uColorB, vSeed);
          float a = base + pulse * 0.9;
          gl_FragColor = vec4(col * (0.6 + pulse * 1.8), a);
        }`,
    });
    const lines = new THREE.LineSegments(linesGeo, linesMat);
    scene.add(lines);

    // ---------- Tendrils (curved energy rays) ----------
    const tendrilGroup = new THREE.Group();
    const TENDRIL_COUNT = 14;
    const tendrilMats: THREE.ShaderMaterial[] = [];
    for (let i = 0; i < TENDRIL_COUNT; i++) {
      const dir = new THREE.Vector3().randomDirection();
      const points: THREE.Vector3[] = [];
      const segs = 40;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const r = 1.0 + t * (1.5 + Math.random() * 1.2);
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 0.4 * t,
          (Math.random() - 0.5) * 0.4 * t,
          (Math.random() - 0.5) * 0.4 * t,
        );
        points.push(dir.clone().multiplyScalar(r).add(offset));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const geo = new THREE.TubeGeometry(curve, 64, 0.012, 6, false);
      const seed = Math.random();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: uniforms.uTime,
          uColorA: uniforms.uColorA,
          uColorB: uniforms.uColorB,
          uSeed: { value: seed },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexShader: `
          varying float vT;
          void main(){
            vT = uv.x;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }`,
        fragmentShader: `
          varying float vT;
          uniform float uTime;
          uniform float uSeed;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          void main(){
            float flow = fract(vT * 2.0 - uTime * (0.6 + uSeed));
            float pulse = smoothstep(0.0, 0.2, flow) * smoothstep(1.0, 0.7, flow);
            float fade = smoothstep(1.0, 0.2, vT);
            vec3 c = mix(uColorA, uColorB, vT);
            gl_FragColor = vec4(c * (0.4 + pulse * 2.5) * fade, (0.25 + pulse) * fade);
          }`,
      });
      tendrilMats.push(mat);
      tendrilGroup.add(new THREE.Mesh(geo, mat));
    }
    scene.add(tendrilGroup);

    // ---------- Particles ----------
    const PARTICLE_COUNT = 1200;
    const pPositions = new Float32Array(PARTICLE_COUNT * 3);
    const pSeeds = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = 0.6 + Math.random() * 2.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPositions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPositions[i * 3 + 2] = r * Math.cos(phi);
      pSeeds[i] = Math.random();
    }
    const partGeo = new THREE.BufferGeometry();
    partGeo.setAttribute("position", new THREE.Float32BufferAttribute(pPositions, 3));
    partGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(pSeeds, 1));

    const partMat = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexShader: `
        attribute float aSeed;
        varying float vSeed;
        uniform float uTime;
        void main(){
          vSeed = aSeed;
          vec3 p = position;
          float a = uTime * (0.15 + aSeed * 0.4) + aSeed * 6.28;
          // Orbit around y-axis with slight wobble
          float c = cos(a), s = sin(a);
          p.xz = mat2(c, -s, s, c) * p.xz;
          p.y += sin(uTime * (0.5 + aSeed) + aSeed * 10.0) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.0 + aSeed * 3.0) * (300.0 / -mv.z);
        }`,
      fragmentShader: `
        varying float vSeed;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uTime;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float glow = pow(1.0 - d * 2.0, 2.5);
          float pulse = 0.6 + 0.4 * sin(uTime * 3.0 + vSeed * 12.0);
          vec3 c = mix(uColorA, uColorB, vSeed);
          gl_FragColor = vec4(c * glow * pulse * 1.6, glow);
        }`,
    });
    const particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    // ---------- Postprocessing ----------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.25, 0.4, 0.7);
    composer.addPass(bloom);
    const fxaa = new ShaderPass(FXAAShader);
    fxaa.material.uniforms["resolution"].value.set(1 / width, 1 / height);
    composer.addPass(fxaa);

    // ---------- GUI ----------
    const gui = new GUI({ title: "Neural Core" });
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "12px";
    gui.domElement.style.right = "12px";
    mount.appendChild(gui.domElement);

    const params = {
      glow: 0.9,
      bloom: 0.25,
      pulse: 1.0,
      speed: 1.0,
      noise: 0.22,
      density: 1.0,
      autoRotate: true,
    };
    gui.add(params, "glow", 0, 4, 0.01).onChange((v: number) => (uniforms.uGlow.value = v));
    gui.add(params, "bloom", 0, 3, 0.01).onChange((v: number) => (bloom.strength = v));
    gui.add(params, "pulse", 0, 2, 0.01).onChange((v: number) => (uniforms.uPulse.value = v));
    gui.add(params, "speed", 0, 3, 0.01);
    gui.add(params, "noise", 0, 0.6, 0.01).onChange((v: number) => (uniforms.uNoiseAmp.value = v));
    gui.add(params, "density", 0.2, 1, 0.01).onChange((v: number) => {
      // Hide a fraction of lines by alpha scaling via material opacity-ish trick:
      (linesMat as THREE.ShaderMaterial).opacity = v;
    });
    gui.add(params, "autoRotate").onChange((v: boolean) => (controls.autoRotate = v));

    // ---------- Resize ----------
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fxaa.material.uniforms["resolution"].value.set(1 / w, 1 / h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    // ---------- Loop ----------
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      const dt = clock.getDelta() * params.speed;
      uniforms.uTime.value += dt;
      coreMesh.rotation.y += dt * 0.15;
      coreMesh.rotation.x += dt * 0.05;
      lines.rotation.copy(coreMesh.rotation);
      tendrilGroup.rotation.copy(coreMesh.rotation);
      particles.rotation.y += dt * 0.05;
      controls.update();
      composer.render();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gui.destroy();
      controls.dispose();
      composer.dispose();
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      nucleus.geometry.dispose();
      nucleusMat.dispose();
      linesGeo.dispose();
      linesMat.dispose();
      partGeo.dispose();
      partMat.dispose();
      tendrilGroup.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
      tendrilMats.forEach((m) => m.dispose());
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="relative h-screen w-screen overflow-hidden bg-background" />;
};

export default NeuralCore;
