import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "../lib/motion";

type Props = {
  className?: string;
  density?: number;
  linkDistance?: number;
};

/**
 * A calm WebGL particle-network background.
 * Reads as a "detection mesh" rather than sci-fi — blue nodes drifting on white,
 * with thin hairlines connecting nearby pairs. A single yellow sentinel particle
 * orbits slowly as the semantic accent.
 */
export default function ParticleNet({
  className,
  density = 68,
  linkDistance = 1.6,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // On phones, run fewer particles — the per-frame O(n^2) link pass is the hot path.
    const isMobile =
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 768px)").matches;
    const effectiveDensity = isMobile ? Math.min(density, 40) : density;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    const aspect = w / h;
    const frustum = 6;
    const camera = new THREE.OrthographicCamera(
      (-frustum * aspect) / 2,
      (frustum * aspect) / 2,
      frustum / 2,
      -frustum / 2,
      0.1,
      100,
    );
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // --- Particles ---
    const count = effectiveDensity;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const basePositions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const BLUE = new THREE.Color("#005ABE");
    const INK = new THREE.Color("#0B0F1A");
    const YELLOW = new THREE.Color("#FFCD00");

    // Sentinel indices — get the yellow highlight
    const sentinelIdx = Math.floor(count * 0.55);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * frustum * aspect * 1.1;
      const y = (Math.random() - 0.5) * frustum * 1.1;
      const z = (Math.random() - 0.5) * 0.4;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;

      velocities[i * 3] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
      velocities[i * 3 + 2] = 0;

      const c = i === sentinelIdx ? YELLOW : Math.random() < 0.08 ? INK : BLUE;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const pointGeom = new THREE.BufferGeometry();
    pointGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointGeom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    // Round-dot sprite texture
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = dotCanvas.height = 64;
    const dctx = dotCanvas.getContext("2d")!;
    const g = dctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, 64, 64);
    const dotTex = new THREE.CanvasTexture(dotCanvas);

    const pointMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      map: dotTex,
      alphaTest: 0.02,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointGeom, pointMat);
    scene.add(points);

    // Sentinel halo — a single larger translucent yellow point
    const haloGeom = new THREE.BufferGeometry();
    haloGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(3), 3),
    );
    const haloMat = new THREE.PointsMaterial({
      size: 0.6,
      color: YELLOW,
      transparent: true,
      opacity: 0.18,
      map: dotTex,
      alphaTest: 0.001,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const halo = new THREE.Points(haloGeom, haloMat);
    scene.add(halo);

    // --- Lines (connections) ---
    const MAX_LINKS = count * 5;
    const linePositions = new Float32Array(MAX_LINKS * 2 * 3);
    const lineColors = new Float32Array(MAX_LINKS * 2 * 3);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute(
      "position",
      new THREE.BufferAttribute(linePositions, 3),
    );
    lineGeom.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
    });
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(lines);

    // --- Mouse parallax ---
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      pointer.ty = -((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
    };
    window.addEventListener("pointermove", onMove);

    // --- Resize ---
    const resize = () => {
      if (!mount) return;
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      const na = nw / nh;
      camera.left = (-frustum * na) / 2;
      camera.right = (frustum * na) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Animate ---
    let raf = 0;
    let t = 0;
    const render = () => {
      t += 0.006;
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      // Drift + gentle oscillation + mouse parallax
      const posAttr = pointGeom.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        arr[i * 3] =
          bx +
          Math.sin(t + i * 0.37) * 0.06 +
          velocities[i * 3] * t * 14 +
          pointer.x * (0.15 + (i % 3) * 0.05);
        arr[i * 3 + 1] =
          by +
          Math.cos(t * 0.8 + i * 0.21) * 0.06 +
          velocities[i * 3 + 1] * t * 14 +
          pointer.y * (0.15 + (i % 3) * 0.05);
      }
      posAttr.needsUpdate = true;

      // Sentinel halo tracks sentinel particle
      const hArr = (halo.geometry.getAttribute("position") as THREE.BufferAttribute)
        .array as Float32Array;
      hArr[0] = arr[sentinelIdx * 3];
      hArr[1] = arr[sentinelIdx * 3 + 1];
      hArr[2] = arr[sentinelIdx * 3 + 2];
      (halo.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      haloMat.opacity = 0.14 + Math.sin(t * 2) * 0.06;

      // Rebuild connections
      let linkCount = 0;
      const lineArr = linePositions;
      const lineColArr = lineColors;
      const d2 = linkDistance * linkDistance;
      for (let i = 0; i < count; i++) {
        const ix = arr[i * 3];
        const iy = arr[i * 3 + 1];
        for (let j = i + 1; j < count; j++) {
          if (linkCount >= MAX_LINKS) break;
          const dx = ix - arr[j * 3];
          const dy = iy - arr[j * 3 + 1];
          const dist2 = dx * dx + dy * dy;
          if (dist2 < d2) {
            const o = linkCount * 6;
            lineArr[o] = ix;
            lineArr[o + 1] = iy;
            lineArr[o + 2] = 0;
            lineArr[o + 3] = arr[j * 3];
            lineArr[o + 4] = arr[j * 3 + 1];
            lineArr[o + 5] = 0;

            // Fade line alpha with distance via color luminance toward white
            const t01 = 1 - dist2 / d2;
            const r = 0.0 * t01 + (1 - t01) * 1;
            const g = 0.35 * t01 + (1 - t01) * 1;
            const b = 0.74 * t01 + (1 - t01) * 1;
            lineColArr[o] = r;
            lineColArr[o + 1] = g;
            lineColArr[o + 2] = b;
            lineColArr[o + 3] = r;
            lineColArr[o + 4] = g;
            lineColArr[o + 5] = b;
            linkCount++;
          }
        }
      }
      // zero the rest
      for (let k = linkCount * 6; k < MAX_LINKS * 6; k++) {
        lineArr[k] = 0;
      }
      (lineGeom.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (lineGeom.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
      lineGeom.setDrawRange(0, linkCount * 2);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    if (reduced) {
      // Render one static frame, no RAF loop
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      renderer.dispose();
      pointGeom.dispose();
      pointMat.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      dotTex.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [density, linkDistance, reduced]);

  return (
    <div
      ref={mountRef}
      className={className}
      aria-hidden
      style={{ pointerEvents: "none" }}
    />
  );
}
