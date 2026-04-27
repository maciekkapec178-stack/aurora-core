import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const NeuralCore = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 100);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // ---------------- CORE SPHERE ----------------
    const sphereGeo = new THREE.SphereGeometry(1, 256, 256);
    const sphereMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        uniform float time;
        void main() {
          vNormal = normal;
          float n = sin(position.y*6.0 + time*2.0)*0.04;
          vec3 pos = position + normal * n;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main(){
          float fresnel = pow(1.0 - dot(vNormal, vec3(0.0,0.0,1.0)), 3.0);
          vec3 col = mix(vec3(0.4,0.0,1.0), vec3(1.0,0.2,0.8), fresnel);
          gl_FragColor = vec4(col,1.0);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // ---------------- NEURAL LINES ----------------
    const lineMaterial = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 } },
      vertexShader: `
        varying float vT;
        void main() {
          vT = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying float vT;
        uniform float time;
        void main(){
          float flow = sin(vT*10.0 - time*5.0)*0.5+0.5;
          vec3 col = mix(vec3(0.2,0.6,1.0), vec3(1.0,0.2,0.8), flow);
          gl_FragColor = vec4(col,1.0);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });

    const lines: THREE.Line[] = [];
    const createNeuronLine = () => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 50; i++) {
        const t = i / 50;
        const r = 1 + Math.sin(t * 3.14) * 0.2;
        points.push(
          new THREE.Vector3(
            Math.sin(t * 6.28) * r,
            (t - 0.5) * 2,
            Math.cos(t * 6.28) * r
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geo, lineMaterial);
    };
    for (let i = 0; i < 40; i++) {
      const line = createNeuronLine();
      line.rotation.y = Math.random() * Math.PI;
      scene.add(line);
      lines.push(line);
    }

    // ---------------- PARTICLES ----------------
    const pGeo = new THREE.BufferGeometry();
    const count = 4000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 5;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xff66ff,
      size: 0.015,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ---------------- LIGHT ----------------
    const light = new THREE.PointLight(0xff00ff, 3, 10);
    scene.add(light);

    // ---------------- POSTPROCESSING ----------------
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.8,
      0.4,
      0.1
    );
    composer.addPass(bloom);

    // ---------------- ANIMATION ----------------
    let frameId = 0;
    const animate = (t: number) => {
      frameId = requestAnimationFrame(animate);
      const time = t * 0.001;
      sphereMat.uniforms.time.value = time;
      lineMaterial.uniforms.time.value = time;
      sphere.rotation.y += 0.002;
      particles.rotation.y += 0.0008;
      controls.update();
      composer.render();
    };
    frameId = requestAnimationFrame(animate);

    // ---------------- RESIZE ----------------
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      lineMaterial.dispose();
      lines.forEach((l) => l.geometry.dispose());
      pGeo.dispose();
      pMat.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="fixed inset-0 h-screen w-screen bg-background" />;
};

export default NeuralCore;
