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

// Easing Functions for First Render (GSAP-like)
const EASING_FUNCTIONS: Record<string, (t: number) => number> = {
  // Linear
  "none": (t: number) => t,
  "linear": (t: number) => t,

  // Power1 (Quad)
  "power1.in": (t: number) => t * t,
  "power1.out": (t: number) => t * (2 - t),
  "power1.inOut": (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Power2 (Cubic)
  "power2.in": (t: number) => t * t * t,
  "power2.out": (t: number) => (--t) * t * t + 1,
  "power2.inOut": (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Power3 (Quart)
  "power3.in": (t: number) => t * t * t * t,
  "power3.out": (t: number) => 1 - (--t) * t * t * t,
  "power3.inOut": (t: number) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Power4 (Quint)
  "power4.in": (t: number) => t * t * t * t * t,
  "power4.out": (t: number) => 1 + (--t) * t * t * t * t,
  "power4.inOut": (t: number) => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,

  // Expo
  "expo.in": (t: number) => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  "expo.out": (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  "expo.inOut": (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if ((t /= 0.5) < 1) return 0.5 * Math.pow(2, 10 * (t - 1));
    return 0.5 * (2 - Math.pow(2, -10 * (--t)));
  },

  // Sine
  "sine.in": (t: number) => 1 - Math.cos(t * Math.PI / 2),
  "sine.out": (t: number) => Math.sin(t * Math.PI / 2),
  "sine.inOut": (t: number) => 0.5 * (1 - Math.cos(Math.PI * t)),

  // Circ
  "circ.in": (t: number) => 1 - Math.sqrt(1 - t * t),
  "circ.out": (t: number) => Math.sqrt(1 - (t - 1) * (t - 1)),
  "circ.inOut": (t: number) => {
    if ((t /= 0.5) < 1) return -0.5 * (Math.sqrt(1 - t * t) - 1);
    return 0.5 * (Math.sqrt(1 - (t -= 2) * t) + 1);
  },

  // Back
  "back.in": (t: number) => {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },
  "back.out": (t: number) => {
    const s = 1.70158;
    return --t * t * ((s + 1) * t + s) + 1;
  },
  "back.inOut": (t: number) => {
    let s = 1.70158 * 1.525;
    if ((t /= 0.5) < 1) return 0.5 * (t * t * ((s + 1) * t - s));
    return 0.5 * ((t -= 2) * t * (((s *= 1.525) + 1) * t + s) + 2);
  },

  // Elastic
  "elastic.in": (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
  "elastic.out": (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
  },
  "elastic.inOut": (t: number) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    t *= 2;
    if (t < 1) return -0.5 * Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
    return 0.5 * Math.pow(2, -10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI) + 1;
  },

  // Bounce
  "bounce.in": (t: number) => 1 - EASING_FUNCTIONS["bounce.out"](1 - t),
  "bounce.out": (t: number) => {
    if (t < (1 / 2.75)) return 7.5625 * t * t;
    if (t < (2 / 2.75)) return 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75;
    if (t < (2.5 / 2.75)) return 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375;
    return 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375;
  },
  "bounce.inOut": (t: number) => t < 0.5 ? EASING_FUNCTIONS["bounce.in"](t * 2) * 0.5 : EASING_FUNCTIONS["bounce.out"](t * 2 - 1) * 0.5 + 0.5,
};

export type EaseName = keyof typeof EASING_FUNCTIONS;

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
  animatedFirstRender,
  afrSpeed,
  afrColorSpeed,
  afrColorSpeedDelay,
  afrColorSpeedDuration,
  afrEase,
  hovered,
  setHovered,
  isIdleRef,
  segments = 32,
  iconSrc,
  iconSize,
  iconColor,
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
  animatedFirstRender?: boolean;
  afrSpeed?: number;
  afrColorSpeed?: number;
  afrColorSpeedDelay?: number;
  afrColorSpeedDuration?: number;
  afrEase?: EaseName;
  hovered: boolean;
  setHovered: (v: boolean) => void;
  isIdleRef: React.MutableRefObject<boolean>;
  segments?: number;
  iconSrc?: string;
  iconSize?: number;
  iconColor?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const matRef  = useRef<THREE.ShaderMaterial>(null!);
  const { camera } = useThree();
  const animTime = useRef(0);
  const renderTime = useRef(0);
  const isFinished = useRef(false);

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
      uColorSpeed:   new THREE.Uniform(animatedFirstRender ? (afrColorSpeed ?? 20) : colorSpeed),
      uBlobDensity:  new THREE.Uniform(blobDensity),
      uChromaticAberration: new THREE.Uniform(chromaticAberration),
      uDistortion:   new THREE.Uniform(distortion),
      uRoughness:    new THREE.Uniform(roughness),
      uLightColor:   new THREE.Uniform(toVec3(lightColor)),
      uShadowColor:  new THREE.Uniform(toVec3(shadowColor)),
      uIconTexture:  new THREE.Uniform(new THREE.Texture()),
      uHasIcon:      new THREE.Uniform(0.0),
      uIconSize:     new THREE.Uniform(iconSize ?? 1.6),
      uIconColor:    new THREE.Uniform(new THREE.Vector3(1, 1, 1)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once for setup

  // Load and apply Icon Texture natively into WebGL!
  useEffect(() => {
    if (!iconSrc || !matRef.current) {
      if (matRef.current) matRef.current.uniforms.uHasIcon.value = 0.0;
      return;
    }

    // High-Res SVG Rasterization Trick
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = iconSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 512; // Upscale to 512px for sharpness
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = true;
        if (matRef.current) {
          matRef.current.uniforms.uIconTexture.value = tex;
          matRef.current.uniforms.uHasIcon.value = 1.0;
        }
      }
    };
  }, [iconSrc]);

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
      if (u.uIconSize) u.uIconSize.value = iconSize ?? 1.6;
      
      const ic = new THREE.Color(iconColor ?? "white");
      if (u.uIconColor) u.uIconColor.value.set(ic.r, ic.g, ic.b);

      const lc = new THREE.Color(lightColor);
      const sc = new THREE.Color(shadowColor);
      if (u.uLightColor) u.uLightColor.value.set(lc.r, lc.g, lc.b);
      if (u.uShadowColor) u.uShadowColor.value.set(sc.r, sc.g, sc.b);
    }
  }, [theme, rimThickness, blobDensity, chromaticAberration, roughness, lightColor, shadowColor, iconSize, iconColor]);

  // Keep camera position uniform in sync (for fresnel)
  const lastRenderTime = useRef(performance.now());
  const idleFpsInterval = 1000 / 16; // 16 FPS limit for idle

  useFrame((state, delta) => {
    if (!matRef.current) return;
    
    (camera as THREE.PerspectiveCamera).getWorldPosition(
      matRef.current.uniforms.uCameraPos.value,
    );

    // Animate scale and speed on first render with easing
    if (animatedFirstRender && !isFinished.current) {
      renderTime.current += delta;
      const speed = afrSpeed ?? 2.5;
      const t = Math.min(renderTime.current * speed, 1.0);
      
      const easeFn = EASING_FUNCTIONS[afrEase || "power2.out"] || EASING_FUNCTIONS["power2.out"];
      const easeOutExpo = EASING_FUNCTIONS["expo.out"]; // Always use Expo for color speed for smoothness

      const scaleVal = easeFn(t);
      meshRef.current.scale.setScalar(scaleVal);

      // Color speed decay with its own delay and logic
      const startColorSpeed = afrColorSpeed ?? 20;
      const targetColorSpeed = hovered ? (hoverColorSpeed ?? colorSpeed) : colorSpeed;
      const colorDelay = afrColorSpeedDelay ?? 0;
      const colorDur   = afrColorSpeedDuration ?? 1.5;
      
      // Calculate color progress: (time - delay) / duration
      const colorProgress = Math.min(Math.max(0, renderTime.current - colorDelay) / colorDur, 1.0);
      matRef.current.uniforms.uColorSpeed.value = startColorSpeed + (targetColorSpeed - startColorSpeed) * easeOutExpo(colorProgress);

      if (t >= 1.0 && colorProgress >= 1.0) {
        isFinished.current = true;
        meshRef.current.scale.setScalar(1.0);
      }
    } else {
      // Normal hover/idle behavior
      const targetSpeed = hovered ? (hoverColorSpeed ?? colorSpeed) : colorSpeed;
      const currentSpeed = matRef.current.uniforms.uColorSpeed.value;
      matRef.current.uniforms.uColorSpeed.value += (targetSpeed - currentSpeed) * 5.0 * delta;

      if (!animatedFirstRender) {
        meshRef.current.scale.setScalar(1.0);
      }
    }

    // Accumulate time based on speed
    animTime.current += delta * matRef.current.uniforms.uColorSpeed.value;
    matRef.current.uniforms.uTime.value = animTime.current;

    // Smoothly interpolate the shape distortion based on hover state
    const targetDist = hovered ? (hoverDistortion ?? distortion) : distortion;
    const currentDist = matRef.current.uniforms.uDistortion.value;
    matRef.current.uniforms.uDistortion.value += (targetDist - currentDist) * 5.0 * delta;

    // --- Performance Rendering Tactic (FPS Limiter) ---
    if (!isIdleRef.current || (animatedFirstRender && !isFinished.current)) {
      // 60+ FPS while Hovered/Fading or Animating First Render
      state.gl.render(state.scene, state.camera);
    } else {
      // Throttle to 30 FPS while Idle/Fading down
      const now = performance.now();
      if (now - lastRenderTime.current >= idleFpsInterval) {
        lastRenderTime.current = now - ((now - lastRenderTime.current) % idleFpsInterval);
        state.gl.render(state.scene, state.camera);
      }
    }
  }, 1); // priority 1 takes over R3F's internal render loop!

  return (
    <mesh 
      ref={meshRef}
      scale={animatedFirstRender ? 0 : 1}
    >
      {/* Low-poly geometry; fragment shader handles the smoothness */}
      <sphereGeometry args={[1, segments, segments]} />
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
  // --- Core & Layout ---
  theme?: ThemeName | SphereTheme;
  size?: number;        // px — diameter of the widget
  className?: string;
  backgroundColor?: string;
  segments?: number;    // Resolution of the sphere (default 32)
  onClick?: () => void;

  // --- Visuals (Shader) ---
  rimThickness?: number;
  colorSpeed?: number;
  hoverColorSpeed?: number;
  blobDensity?: number;
  chromaticAberration?: number;
  distortion?: number;
  hoverDistortion?: number;
  roughness?: number;
  lightColor?: string;
  shadowColor?: string;
  blur?: number;

  // --- Embedded Icon ---
  iconSrc?: string;
  iconSize?: number;
  iconColor?: string;

  // --- Interactive Glow ---
  glow?: string;
  glowSize?: number;
  glowIntensity?: number;
  hoverGlow?: string;
  hoverGlowSize?: number;
  hoverGlowIntensity?: number;
  
  // --- Opacity & States ---
  opacity?: number;
  hoverOpacity?: number;
  opacityDuration?: number;
  opacityDelay?: number;
  hoverOpacityDuration?: number;
  hoverOpacityDelay?: number;

  // --- First Render Animation (AFR) ---
  animatedFirstRender?: boolean;
  afrSpeed?: number;
  afrColorSpeed?: number;
  afrColorSpeedDelay?: number;
  afrColorSpeedDuration?: number;
  afrGlowSize?: number;
  afrGlowIntensity?: number;
  afrGlowDelay?: number;
  afrGlowDuration?: number;
  afrOpacity?: number;
  afrOpacityDelay?: number;
  afrOpacityDuration?: number;
  afrEase?: EaseName;

  // --- Interactive Sounds ---
  hoverSound?: string;
  clickSound?: string;
  hoverVolume?: number;
  clickVolume?: number;
}

export default function LuminaOrb({
  // --- Core & Layout ---
  theme = "cipher",
  size = 100,
  className,
  backgroundColor = "transparent",
  segments = 24,
  onClick,

  // --- Visuals (Shader) ---
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
  blur = 1,

  // --- Embedded Icon ---
  iconSrc = "",
  iconSize = 0.3,
  iconColor = "black",

  // --- Interactive Glow ---
  glow = "#ffffff",
  glowSize = 0.01,
  glowIntensity = 0.04,
  hoverGlow = "#ffffff",
  hoverGlowSize = 0.03,
  hoverGlowIntensity = 0.08,

  // --- Opacity & States ---
  opacity = 0.5,
  hoverOpacity = 1,
  opacityDuration = 1,
  opacityDelay = 3,
  hoverOpacityDuration = 0.3,
  hoverOpacityDelay = 0,

  // --- First Render Animation (AFR) ---
  animatedFirstRender = true,
  afrSpeed = 1,
  afrColorSpeed = 30,
  afrColorSpeedDelay = 0.5,
  afrColorSpeedDuration = 2.5,
  afrGlowSize = 0.1,
  afrGlowIntensity = 0.5,
  afrGlowDelay = 0.4,
  afrGlowDuration = 4,
  afrOpacity = 1,
  afrOpacityDelay = 2,
  afrOpacityDuration = 3,
  afrEase = "power2.out",

  // --- Interactive Sounds ---
  hoverSound = "/sounds/chat-hover.mp3",
  clickSound = "/sounds/chat-open-3.mp3",
  hoverVolume = 0.005,
  clickVolume = 0.05,

  
}: LuminaOrbProps) {
  const resolvedTheme: SphereTheme =
    typeof theme === "string" ? THEMES[theme] : theme;

  const [isTabVisible, setIsTabVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const afrProgressRef = useRef<number>(-1);

  const isIdleRef = useRef(false);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Audio setup
  const hoverAudio = useMemo(() => (typeof Audio !== "undefined" && hoverSound) ? new Audio(hoverSound) : null, [hoverSound]);
  const clickAudio = useMemo(() => (typeof Audio !== "undefined" && clickSound) ? new Audio(clickSound) : null, [clickSound]);

  // Sync volume
  useEffect(() => {
    if (hoverAudio) hoverAudio.volume = hoverVolume;
    if (clickAudio) clickAudio.volume = clickVolume;
  }, [hoverAudio, clickAudio, hoverVolume, clickVolume]);

  // Directly update DOM styles without triggering React re-renders to save immense CPU time.
  const updateStylesAPI = useMemo(() => {
    return (progress: number, currentHover: boolean) => {
      if (!containerRef.current) return;
      const el = containerRef.current;
      
      let currentBaseGlowSize = glowSize;
      let currentBaseGlowIntensity = glowIntensity;
      let currentBaseOpacity = opacity;

      if (animatedFirstRender && progress >= 0) {
        const easeOutExpo = EASING_FUNCTIONS["expo.out"];
        const gSizeT = Math.min(Math.max(0, progress - (afrGlowDelay ?? 0)) / (afrGlowDuration ?? 4.0), 1.0);
        currentBaseGlowSize = (afrGlowSize ?? 0.1) + (glowSize - (afrGlowSize ?? 0.1)) * easeOutExpo(gSizeT);

        const gIntT = Math.min(Math.max(0, progress - (afrGlowDelay ?? 0)) / (afrGlowDuration ?? 4.0), 1.0);
        currentBaseGlowIntensity = (afrGlowIntensity ?? 0.5) + (glowIntensity - (afrGlowIntensity ?? 0.5)) * easeOutExpo(gIntT);

        const oT = Math.min(Math.max(0, progress - (afrOpacityDelay ?? 0)) / (afrOpacityDuration ?? 1.5), 1.0);
        currentBaseOpacity = (afrOpacity ?? 0) + (opacity - (afrOpacity ?? 0)) * easeOutExpo(oT);
      }

      const activeGlowSize = currentHover ? (hoverGlowSize ?? currentBaseGlowSize) : currentBaseGlowSize;
      const activeGlowIntensity = currentHover ? (hoverGlowIntensity ?? currentBaseGlowIntensity) : currentBaseGlowIntensity;
      const activeOpacity = currentHover ? hoverOpacity : currentBaseOpacity;
      const activeGlow = currentHover ? (hoverGlow ?? glow) : glow;

      el.style.opacity = activeOpacity.toString();

      let filterString = blur > 0 ? `blur(${blur}px) ` : "";
      if (activeGlow) {
        // PERF: hardcap `drop-shadow` to 2 layers to prevent rendering lag on mobile
        // Instead of unlimited stacking, we stack max 2 but multiply the size internally.
        const layers = Math.min(2, Math.ceil(Math.max(1, activeGlowIntensity)));
        const shadowIntensityMultiplier = activeGlowIntensity / layers;
        const shadows = Array.from({ length: layers }).map((_, i) => {
          return `drop-shadow(0 0 ${size * activeGlowSize * ((i * 0.5) + 1) * shadowIntensityMultiplier}px ${activeGlow})`;
        }).join(" ");
        filterString += shadows;
      }
      el.style.filter = filterString || "none";

      if (animatedFirstRender && progress >= 0 && progress < 1.0) {
        el.style.transition = "none";
      } else {
        el.style.transition = `filter 0.3s ease-out, opacity ${currentHover ? hoverOpacityDuration : opacityDuration}s ease-out ${currentHover ? hoverOpacityDelay : opacityDelay}s`;
      }
    };
  }, [
    animatedFirstRender, glowSize, glowIntensity, opacity, afrGlowDelay, afrGlowDuration, 
    afrGlowSize, afrGlowIntensity, afrOpacityDelay, afrOpacityDuration, afrOpacity, 
    hoverGlowSize, hoverGlowIntensity, hoverOpacity, hoverGlow, glow, blur, size, 
    hoverOpacityDuration, opacityDuration, hoverOpacityDelay, opacityDelay
  ]);

  const handlePointerOver = () => { 
    hoveredRef.current = true; 
    setHovered(true); 
    isIdleRef.current = false;
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    updateStylesAPI(afrProgressRef.current, true);
    if (hoverAudio) {
      hoverAudio.currentTime = 0;
      hoverAudio.play().catch(() => {}); // catch to prevent error on first load/user interaction policy
    }
  };

  const handlePointerOut = () => { 
    hoveredRef.current = false; 
    setHovered(false); 
    updateStylesAPI(afrProgressRef.current, false); 
    
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => {
      isIdleRef.current = true;
    }, (opacityDelay + opacityDuration) * 1000);
  };

  const handleOnClick = () => {
    if (clickAudio) {
      clickAudio.currentTime = 0;
      clickAudio.play().catch(() => {});
    }
    onClick?.();
  };

  useEffect(() => {
    updateStylesAPI(animatedFirstRender ? 0 : 100, hoveredRef.current);
  }, [updateStylesAPI, animatedFirstRender]);

  useEffect(() => {
    if (!animatedFirstRender) return;
    
    let startTime = performance.now();
    let frameId: number;

    const update = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      afrProgressRef.current = elapsed;
      
      updateStylesAPI(elapsed, hoveredRef.current);
      
      const maxTime = Math.max(
        1.0 / (afrSpeed || 1) + 0.5, 
        (afrColorSpeedDelay || 0) + (afrColorSpeedDuration || 0), 
        (afrGlowDelay || 0) + (afrGlowDuration || 0),
        (afrOpacityDelay || 0) + (afrOpacityDuration || 0)
      ) + 0.5;

      if (elapsed < maxTime) {
        frameId = requestAnimationFrame(update);
      }
    };
    
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [animatedFirstRender, afrSpeed, afrColorSpeedDelay, afrColorSpeedDuration, afrGlowDelay, afrGlowDuration, afrOpacityDelay, afrOpacityDuration, updateStylesAPI]);

  useEffect(() => {
    // Start initial idle timer
    const totalAfrDelay = animatedFirstRender ? (afrOpacityDelay + afrOpacityDuration) : 0;
    idleTimeoutRef.current = setTimeout(() => {
      if (!hoveredRef.current) isIdleRef.current = true;
    }, (opacityDelay + opacityDuration + totalAfrDelay) * 1000);

    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // Initial check
    handleVisibilityChange();
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [opacityDelay, opacityDuration, afrOpacityDelay, afrOpacityDuration, animatedFirstRender]);

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      style={{
        width:  size,
        height: size,
        position: "relative",
        cursor: "pointer",
        userSelect: "none",
        backgroundColor: backgroundColor,
        borderRadius: "50%",
        // Initial state for SSR and first frame before updateStylesAPI runs
        opacity: animatedFirstRender ? (afrOpacity ?? 0) : opacity,
        filter: blur > 0 ? `blur(${blur}px)` : "none",
        transition: "none",
      }}
      onClick={handleOnClick}
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
          animatedFirstRender={animatedFirstRender}
          afrSpeed={afrSpeed}
          afrColorSpeed={afrColorSpeed}
          afrColorSpeedDelay={afrColorSpeedDelay}
          afrColorSpeedDuration={afrColorSpeedDuration}
          afrEase={afrEase}
          hovered={hovered}
          setHovered={setHovered}
          isIdleRef={isIdleRef}
          segments={segments}
          iconSrc={iconSrc}
          iconSize={iconSize}
          iconColor={iconColor}
        />
      </Canvas>
    </div>
  );
}
