export const vertexShader = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform float uColorSpeed;
  uniform float uDistortion;
  uniform float uRoughness;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vSpherePos;
  varying vec2 vUv;
  varying float vDisplacement;
  varying vec3 vLiquidNormal; // Calculated normal for fragment shader

  void main() {
    vUv        = uv;
    vNormal    = normal;
    vSpherePos = position;
    
    float t = uTime * 0.5;
    
    // 1. Core Displacement
    vec3 p = position * (uRoughness * 0.4); 
    float wave1 = sin(p.x + p.y + t) * cos(p.z + t);
    float wave2 = sin(p.z - p.x - t * 0.8) * cos(p.y - t * 0.8);
    float noiseVal = (wave1 + wave2 * 0.5) * 0.5;
                     
    vDisplacement = noiseVal;
                     
    vec3 displacedPos = position + normal * (noiseVal * uDistortion);

    // 2. Liquid Normal Calculation
    vec3 tVec = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
    if (length(tVec) < 0.001) tVec = normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
    vec3 bVec = cross(normal, tVec);
    
    float eps = 0.01;
    
    // Sample wave depth slightly to the right
    vec3 pX = normalize(position + tVec * eps) * (uRoughness * 0.4);
    float w1X = sin(pX.x + pX.y + t) * cos(pX.z + t);
    float w2X = sin(pX.z - pX.x - t * 0.8) * cos(pX.y - t * 0.8);
    float hX = (w1X + w2X * 0.5) * 0.5;

    // Sample wave depth slightly up
    vec3 pY = normalize(position + bVec * eps) * (uRoughness * 0.4);
    float w1Y = sin(pY.x + pY.y + t) * cos(pY.z + t);
    float w2Y = sin(pY.z - pY.x - t * 0.8) * cos(pY.y - t * 0.8);
    float hY = (w1Y + w2Y * 0.5) * 0.5;

    vLiquidNormal = normalize(normal - tVec * (hX - noiseVal) * uDistortion / eps 
                                     - bVec * (hY - noiseVal) * uDistortion / eps);

    vPosition   = displacedPos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(vPosition, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform vec3  uCameraPos;
  uniform float uRimThickness; 
  uniform float uColorSpeed;
  uniform float uBlobDensity;
  uniform float uChromaticAberration;
  uniform vec3  uLightColor;
  uniform vec3  uShadowColor;
  uniform float uDistortion;
  uniform float uRoughness;
  uniform vec3  uIconColor;
  uniform sampler2D uIconTexture;
  uniform float uHasIcon;
  uniform float uIconSize;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vSpherePos;
  varying vec2 vUv;
  varying float vDisplacement;
  varying vec3 vLiquidNormal; // From vertex shader

  float smoothNoise(vec3 p) {
    return sin(p.x)*cos(p.y) + sin(p.y)*cos(p.z) + sin(p.z)*cos(p.x);
  }

  vec3 getFluidColor(vec3 p, float t) {
    float n1 = smoothNoise(p + vec3(0.0, t * 0.15, t * 0.1));
    float n2 = smoothNoise(p + vec3(t * 0.12, 0.0, -t * 0.15));
    vec3 fluidColor = mix(uColorA, uColorB, smoothstep(-0.3, 0.3, n1));
    fluidColor = mix(fluidColor, uColorC, smoothstep(-0.4, 0.4, n2) * 0.6);
    return clamp(fluidColor, 0.0, 1.0);
  }

  void main() {
    vec3 N_base = normalize(vNormal);
    vec3 sp = normalize(vSpherePos);
    
    vec3 liquidNormal = normalize(vLiquidNormal);

    vec3  V     = normalize(uCameraPos - vPosition);
    float NdotV = clamp(dot(liquidNormal, V), 0.0, 1.0);
    
    float t = uTime;

    // 1. Color Blobs & Chromatic Aberration
    vec3 p = sp * uBlobDensity; 
    
    float chromaticIntensity = uChromaticAberration * (1.0 - clamp(dot(N_base, V), 0.0, 1.0)) * 0.4;
    
    vec3 fluidColor;
    if (chromaticIntensity > 0.01) {
      float r = getFluidColor(p + vec3(chromaticIntensity, chromaticIntensity*0.5, 0.0), t).r;
      float g = getFluidColor(p, t).g;
      float b = getFluidColor(p - vec3(chromaticIntensity, chromaticIntensity*0.5, 0.0), t).b;
      fluidColor = vec3(r, g, b);
    } else {
      fluidColor = getFluidColor(p, t);
    }

    // --- 1.5 3D Refracted Inside Icon ---
    if (uHasIcon > 0.5 && sp.z > 0.0) {
      // Scale is inverse: smaller multiplier = larger icon
      float iconScale = 1.0 / clamp(uIconSize, 0.01, 10.0);
      vec2 iconUv = sp.xy * iconScale; 
      
      // Magic Refraction: perturb the UVs based on the liquid waves!
      iconUv -= liquidNormal.xy * clamp(uDistortion, 0.0, 1.0) * 0.5;
      
      // Remap to 0..1 range
      iconUv = iconUv * 0.5 + 0.5;
      
      if (iconUv.x >= 0.0 && iconUv.x <= 1.0 && iconUv.y >= 0.0 && iconUv.y <= 1.0) {
        vec4 iconTex = texture2D(uIconTexture, iconUv);
        if (iconTex.a > 0.05) {
          fluidColor = mix(fluidColor, uIconColor, iconTex.a);
        }
      }
    }

    // 2. Internal White Rim
    float fadeEdge = 1.0 - clamp(dot(N_base, V), 0.0, 1.0); 
    float startFade = mix(0.9, 0.1, clamp(uRimThickness, 0.0, 1.0));
    float whiteRim = smoothstep(startFade, 1.0, fadeEdge);
    vec3 col = mix(fluidColor, vec3(1.0, 1.0, 1.0), whiteRim);

    // 3. Lighting & Shadows
    vec3 lightDir = normalize(vec3(-1.0, 1.0, 1.0));
    float diff = max(dot(liquidNormal, lightDir), 0.0);
    
    float shadowIntensity = pow(1.0 - diff, 2.0) * clamp(uDistortion * 2.0, 0.0, 1.0);
    col = mix(col, uShadowColor, shadowIntensity);

    float highlight = pow(diff, 5.0);
    col += vec3(1.0) * highlight * 0.4 * clamp(uDistortion * 5.0, 0.0, 1.0);

    float baseHighlight = pow(max(dot(N_base, lightDir), 0.0), 3.0);
    col += uLightColor * baseHighlight * 0.15;

    col = smoothstep(0.02, 0.95, col);
    gl_FragColor = vec4(col, 1.0);
  }
`;
