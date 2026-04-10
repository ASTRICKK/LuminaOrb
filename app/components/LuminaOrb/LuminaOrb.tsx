"use client";

import { useRef, useMemo, useEffect, memo, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders";

// Types
export interface SphereTheme {
  /** Deep / shadow colour  */
  colorA: string;
  /** Mid-blend colour       */
  colorB: string;
  /** Bright inner highlight */
  colorC: string;
}

export const THEMES = {
  nova: {
    colorA: "#1b88ff",
    colorB: "#d24495",
    colorC: "#ffb347",
  } satisfies SphereTheme,
  fusion: {
    colorA: "#00f2fe",
    colorB: "#4facfe",
    colorC: "#ff0844",
  } satisfies SphereTheme,
  terracotta: {
    colorA: "#D97757",
    colorB: "#E5A88B",
    colorC: "#F4DFCD",
  } satisfies SphereTheme,
  emerald: {
    colorA: "#10a37f",
    colorB: "#145347",
    colorC: "#ffffff",
  } satisfies SphereTheme,
  nebula: {
    colorA: "#00f0ff",
    colorB: "#0022ff",
    colorC: "#7a00ff",
  } satisfies SphereTheme,
  iridescent: { 
    colorA: "#FF99CC",
    colorB: "#A2D2FF",
    colorC: "#FCF6BD",
  } satisfies SphereTheme,
  cyberpunk: {
    colorA: "#00ff9f",
    colorB: "#001eff",
    colorC: "#bd00ff",
  } satisfies SphereTheme,
  midnight: {
    colorA: "#1e00ff",
    colorB: "#6800ff",
    colorC: "#00e5ff",
  } satisfies SphereTheme,
  gold: {
    colorA: "#b87333",
    colorB: "#ffb000",
    colorC: "#fff8e7",
  } satisfies SphereTheme,
  flare: {
    colorA: "#ff5e00",
    colorB: "#00f0ff",
    colorC: "#0022ff",
  } satisfies SphereTheme,
  cipher: {
    colorA: "#42B9FF",  
    colorB: "#8E83FF",
    colorC: "#E68AFF",
  } satisfies SphereTheme,
} as const;

export type ThemeName = keyof typeof THEMES;

// Sphere Mesh Component
export const SphereMesh = memo(function SphereMesh({
  theme,
  rimThickness,
  colorSpeed,
  hoverColorSpeed,
  blobDensity,
  chromaticAberration,
  distortion,
  hoverDistortion,
  roughness,
  lightColor,
  shadowColor,
}: {
  theme: SphereTheme;
  rimThickness: number;
  colorSpeed: number;
  hoverColorSpeed?: number;
  blobDensity: number;
  chromaticAberration: number;
  distortion: number;
  hoverDistortion?: number;
  roughness: number;
  lightColor: string;
  shadowColor: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial>(null!);
  const { camera } = useThree();
  const [hovered, setHovered] = useState(false);
  const animTime = useRef(0);

  const uniforms = useMemo(() => {
    const toVec3 = (hex: string) => {
      const c = new THREE.Color(hex);
      return new THREE.Vector3(c.r, c.g, c.b);
    };
    return {
      uTime:         new THREE.Uniform(0),
      uColorA:       new THREE.Uniform(toVec3(theme.colorA)),
      uColorB:       new THREE.Uniform(toVec3(theme.colorB)),
      uColorC:       new THREE.Uniform(toVec3(theme.colorC)),
      uCameraPos:    new THREE.Uniform(new THREE.Vector3()),
      uRimThickness: new THREE.Uniform(rimThickness),
      uColorSpeed:   new THREE.Uniform(colorSpeed),
      uBlobDensity:  new THREE.Uniform(blobDensity),
      uChromaticAberration: new THREE.Uniform(chromaticAberration),
      uDistortion:   new THREE.Uniform(distortion),
      uRoughness:    new THREE.Uniform(roughness),
      uLightColor:   new THREE.Uniform(toVec3(lightColor)),
      uShadowColor:  new THREE.Uniform(toVec3(shadowColor)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once for setup

  // Update uniforms when theme or physical props change
  useEffect(() => {
    if (matRef.current) {
      const cA = new THREE.Color(theme.colorA);
      const cB = new THREE.Color(theme.colorB);
      const cC = new THREE.Color(theme.colorC);
      const u = matRef.current.uniforms;
      u.uColorA.value.set(cA.r, cA.g, cA.b);
      u.uColorB.value.set(cB.r, cB.g, cB.b);
      u.uColorC.value.set(cC.r, cC.g, cC.b);
      u.uRimThickness.value = rimThickness;
      // We no longer hard-set colorSpeed here because we will smoothly animate it in useFrame
      u.uBlobDensity.value  = blobDensity;
      u.uChromaticAberration.value = chromaticAberration;
      u.uRoughness.value = roughness;
      
      const lc = new THREE.Color(lightColor);
      const sc = new THREE.Color(shadowColor);
      if (u.uLightColor) u.uLightColor.value.set(lc.r, lc.g, lc.b);
      if (u.uShadowColor) u.uShadowColor.value.set(sc.r, sc.g, sc.b);
    }
  }, [theme, rimThickness, blobDensity, chromaticAberration, roughness, lightColor, shadowColor]);

  // Keep camera position uniform in sync (for fresnel)
  useFrame((state, delta) => {
    if (!matRef.current) return;
    
    (camera as THREE.PerspectiveCamera).getWorldPosition(
      matRef.current.uniforms.uCameraPos.value,
    );

    // Smoothly interpolate the color speed based on hover state
    const targetSpeed = hovered ? (hoverColorSpeed ?? colorSpeed) : colorSpeed;
    const currentSpeed = matRef.current.uniforms.uColorSpeed.value;
    matRef.current.uniforms.uColorSpeed.value += (targetSpeed - currentSpeed) * 5.0 * delta;

    // Accumulate time based on speed
    animTime.current += delta * matRef.current.uniforms.uColorSpeed.value;
    matRef.current.uniforms.uTime.value = animTime.current;

    // Smoothly interpolate the shape distortion based on hover state
    const targetDist = hovered ? (hoverDistortion ?? distortion) : distortion;
    const currentDist = matRef.current.uniforms.uDistortion.value;
    matRef.current.uniforms.uDistortion.value += (targetDist - currentDist) * 5.0 * delta;
  });

  return (
    <mesh 
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Low-poly geometry; fragment shader handles the smoothness */}
      <sphereGeometry args={[1, 32, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
});

// LuminaOrb Component
interface LuminaOrbProps {
  theme?: ThemeName | SphereTheme;
  size?: number;        // px — diameter of the widget
  className?: string;
  rimThickness?: number; // Controls the thickness of the internal white rim (0.0 to 1.0)
  colorSpeed?: number;   // Normal speed
  hoverColorSpeed?: number; // Speed when hovered
  blobDensity?: number;  // How many color blobs appear (low = large clumps, high = small scattered clouds)
  chromaticAberration?: number; // Spread of RGB split (CA effect)
  distortion?: number;       // How much the sphere warps (default 0.0)
  hoverDistortion?: number;  // How much the sphere warps when hovered
  roughness?: number;        // How jagged or frequent the waves are
  lightColor?: string;       // Color of the direct light reflection (default "#ffffff")
  shadowColor?: string;      // Color of the dark shaded areas (default "#000000")
  blur?: number;             // Amount of global blur to apply to the module in pixels (default 0)
  glow?: string;             // Outer aura color (e.g., "#ffffff")
  glowSize?: number;         // Controls how far the light reaches (scale multiplier of size, default 0.25)
  glowIntensity?: number;    // Stacks the brightness of the light (default 2)
  backgroundColor?: string;   // Background color of the container (e.g., "black" or "transparent")
  onClick?: () => void;      // Optional click handler
}

export default function LuminaOrb({
  theme   = "cipher",
  size    = 100,
  className,
  rimThickness = 0.6,
  colorSpeed = 3,
  hoverColorSpeed = 10,
  blobDensity = 3,
  chromaticAberration = 3,
  distortion = 0,
  hoverDistortion = 0.06,
  roughness = 15.0,
  lightColor = "#ffffff",
  shadowColor = "#000000",
  blur = 1.5,
  glow = "#ffffff", // If provided, adds a drop-shadow aura, e.g. "#ffffff"
  glowSize = 0.01,
  glowIntensity = 0.04,
  backgroundColor = "transparent",
  onClick,
}: LuminaOrbProps) {
  const resolvedTheme: SphereTheme =
    typeof theme === "string" ? THEMES[theme] : theme;

  // Browser tab visibility tracking for performance optimization
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Initial check
    handleVisibilityChange();
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        width:  size,
        height: size,
        filter: [
          blur > 0 ? `blur(${blur}px)` : "",
          glow ? Array.from({ length: Math.max(1, glowIntensity) }).map((_, i) => `drop-shadow(0 0 ${size * glowSize * ((i * 0.5) + 1)}px ${glow})`).join(" ") : ""
        ].filter(Boolean).join(" ") || "none",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: backgroundColor,
        borderRadius: "50%", // Optional: makes the bg area circular too
      }}
      onClick={onClick}
      aria-label="Lumina Orb"
    >
      <Canvas
        style={{ width: "100%", height: "100%", display: "block" }}
        camera={{ position: [0, 0, 3], fov: 44 }}
        // Pause rendering when tab is hidden
        frameloop={isTabVisible ? "always" : "demand"}
        performance={{ min: 0.5 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          depth: false,
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0); // fully transparent clear
        }}
      >
        <SphereMesh 
          theme={resolvedTheme} 
          rimThickness={rimThickness} 
          colorSpeed={colorSpeed}
          hoverColorSpeed={hoverColorSpeed}
          blobDensity={blobDensity}
          chromaticAberration={chromaticAberration}
          distortion={distortion}
          hoverDistortion={hoverDistortion}
          roughness={roughness}
          lightColor={lightColor}
          shadowColor={shadowColor}
        />
      </Canvas>
    </div>
  );
}
