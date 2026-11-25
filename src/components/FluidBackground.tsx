import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { gradientFragmentShader } from "@/lib/hero/gradient-shader";
import { TouchTexture } from "@/lib/hero/touch-texture";
import { markBackgroundReady } from "@/lib/background-ready";

function Plane({ reducedMotion }: { reducedMotion: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const [touch, setTouch] = useState<TouchTexture | null>(null);
  const uniforms = useMemo(() => {
    const color = (_token: string) => new THREE.Vector3();
    return {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor1: { value: color("--hero-energy") },
      uColor2: { value: color("--hero-navy") },
      uColor3: { value: color("--hero-rust") },
      uColor4: { value: color("--hero-blue") },
      uColor5: { value: color("--hero-energy") },
      uColor6: { value: color("--hero-navy") },
      uDarkNavy: { value: color("--hero-navy") },
      uSpeed: { value: 0.25 },
      uGradientSize: { value: 1 },
      uColor1Weight: { value: 1 },
      uColor2Weight: { value: 1 },
      uTouchTexture: { value: null as THREE.Texture | null },
    };
  }, []);

  useEffect(() => {
    const palette = getComputedStyle(document.documentElement);
    const mappings = [
      [uniforms.uColor1, "--hero-energy"],
      [uniforms.uColor2, "--hero-navy"],
      [uniforms.uColor3, "--hero-rust"],
      [uniforms.uColor4, "--hero-blue"],
      [uniforms.uColor5, "--hero-energy"],
      [uniforms.uColor6, "--hero-navy"],
      [uniforms.uDarkNavy, "--hero-navy"],
    ] as const;
    for (const [uniform, token] of mappings) {
      const [r = 0, g = 0, b = 0] = palette.getPropertyValue(token).trim().split(/\s+/).map(Number);
      uniform.value.set(r, g, b);
    }
    const texture = new TouchTexture();
    uniforms.uTouchTexture.value = texture.texture;
    setTouch(texture);
    const move = (e: PointerEvent) => {
      if (!reducedMotion)
        texture.addTouch({
          x: e.clientX / window.innerWidth,
          y: 1 - e.clientY / window.innerHeight,
        });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      texture.dispose();
    };
  }, [uniforms, reducedMotion]);

  const signalled = useRef(false);
  useFrame((state, delta) => {
    const activeUniforms = material.current?.uniforms;
    if (!activeUniforms) return;
    // This frame renders the gradient; the next animation frame runs after it
    // has been painted, which is when the page may be revealed.
    if (!signalled.current) {
      signalled.current = true;
      requestAnimationFrame(markBackgroundReady);
    }
    if (!reducedMotion) {
      const dt = Math.min(delta, 0.1);
      if (activeUniforms["uTime"]) activeUniforms["uTime"].value += dt;
      touch?.update(dt);
    }
    activeUniforms["uResolution"]?.value.set(state.size.width, state.size.height);
    if (activeUniforms["uTouchTexture"] && touch)
      activeUniforms["uTouchTexture"].value = touch.texture;
  });
  if (!touch) return null;
  return (
    <mesh frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader="varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.); }"
        fragmentShader={gradientFragmentShader}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function FluidBackground() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        stencil: false,
        depth: false,
        powerPreference: "high-performance",
      }}
    >
      <Plane reducedMotion={reducedMotion} />
    </Canvas>
  );
}
