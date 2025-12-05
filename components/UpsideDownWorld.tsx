
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ThemeConfig } from '../types';

const noiseChunk = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      value += amplitude * snoise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }
  
  float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
  }
  
  // Vesica shape for the head (pointed oval)
  float sdVesica(vec2 p, float r, float d) {
      p = abs(p);
      float b = sqrt(r*r-d*d);
      return ((p.y-b)*d>p.x*b) ? length(p-vec2(0.0,b))
                             : length(p-vec2(-d,0.0))-r;
  }
  
  // Bezier SDF helper
  float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {    
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;
    float kk = 1.0/dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);      
    float res = 0.0;
    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float h = q*q + 4.0*p3;
    if(h >= 0.0) { 
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp( uv.x+uv.y-kx, 0.0, 1.0 );
        res = dot(d + (c + b*t)*t, d + (c + b*t)*t);
    } else {
        float z = sqrt(-p);
        float v = acos( q/(p*z*2.0) ) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3 t = vec3(m+m,-n-m,n-m)*z-kx;
        t = clamp( t, 0.0, 1.0 );
        res = min( dot(d+(c+b*t.x)*t.x, d+(c+b*t.x)*t.x),
                   min( dot(d+(c+b*t.y)*t.y, d+(c+b*t.y)*t.y),
                        dot(d+(c+b*t.z)*t.z, d+(c+b*t.z)*t.z) ) );
    }
    return sqrt(res);
  }
`;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorCore;
  
  varying vec2 vUv;
  
  ${noiseChunk}

  float sdMindFlayer(vec2 p) {
      // SHAPE CONSTRUCTION
      
      // Mirror Symmetry on X
      vec2 q = p;
      q.x = abs(q.x);
      
      // 1. HEAD SCULPTING (Shadow Horn)
      // Raised slightly higher to detach from legs
      vec2 headPos = vec2(0.0, 1.8);
      
      // Reduced width (0.8 -> 0.6) to make it sleeker
      float dHead = sdVesica(q - headPos, 0.6, 0.25);
      
      // Horn tip curve
      vec2 hA = headPos + vec2(0.0, 0.4);
      vec2 hB = headPos + vec2(0.05, 1.0); 
      vec2 hC = headPos + vec2(0.0, 1.6);
      float dHorn = sdBezier(q, hA, hB, hC) - mix(0.2, 0.01, clamp((q.y - hA.y)/1.2, 0.0, 1.0));
      
      dHead = smin(dHead, dHorn, 0.15); // Tighter blend for horn

      // BLEND FACTOR for Body
      // Reverted to 0.6 for organic, fleshy look
      float k = 0.6; 

      // 2. LEGS - MASSIVE CURVES
      vec2 shoulder = vec2(0.15, 1.4);
      
      // -- Leg Pair 1: The Sky Arch (Outer) --
      vec2 l1_A = shoulder;
      vec2 l1_B = vec2(3.5, 4.5); 
      vec2 l1_C = vec2(3.6, -4.0); 
      
      float leg1_base = sdBezier(q, l1_A, l1_B, l1_C);
      float l1_thickness = mix(0.1, 0.25, smoothstep(-4.0, 3.0, q.y)); 
      float leg1 = leg1_base - l1_thickness;

      // -- Leg Pair 2: The Sprawl (Middle) --
      vec2 l2_A = shoulder + vec2(0.05, -0.2);
      vec2 l2_B = vec2(3.0, 0.0); 
      vec2 l2_C = vec2(2.5, -4.0);
      float leg2 = sdBezier(q, l2_A, l2_B, l2_C) - 0.12;

      // -- Leg Pair 3: Inner Support --
      vec2 l3_A = shoulder + vec2(0.0, -0.4);
      vec2 l3_B = vec2(1.5, -1.0);
      vec2 l3_C = vec2(1.2, -4.0);
      float leg3 = sdBezier(q, l3_A, l3_B, l3_C) - 0.1;

      // Combine Body Parts
      float d = dHead;
      d = smin(d, leg1, k);
      d = smin(d, leg2, k);
      d = smin(d, leg3, k);
      
      // 3. SMOKE/SHADOW TEXTURE (Subtle)
      float smoke1 = fbm(p * 2.5 - vec2(0.0, uTime * 0.3));
      float smoke2 = fbm(p * 6.0 + vec2(uTime * 0.1, uTime * 0.4));
      
      d += smoke1 * 0.05; // Low distortion to keep silhouette sharp
      d += smoke2 * 0.02;
      
      return d;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(7.0, 8.0);

    // ---------------------------
    // 1. ATMOSPHERE (Apocalyptic)
    // ---------------------------
    vec3 colDeepRed = vec3(0.2, 0.0, 0.02);
    vec3 colBrightRed = vec3(0.8, 0.1, 0.05);
    vec3 colOrange = vec3(1.0, 0.4, 0.1);
    
    float yGrad = smoothstep(-5.0, 3.0, p.y);
    vec3 sky = mix(colDeepRed, colBrightRed, yGrad);
    
    float cloudStructure = fbm(p * 0.4 + vec2(uTime * 0.05, 0.0));
    float cloudDetail = fbm(p * 1.5 - vec2(uTime * 0.1, uTime * 0.1));
    
    vec3 cloudCol = mix(colBrightRed, colOrange, cloudStructure);
    sky = mix(sky, cloudCol, cloudDetail * 0.7);
    sky *= (0.6 + 0.4 * cloudStructure);

    // ---------------------------
    // 2. LIGHTNING (Regular Intervals)
    // ---------------------------
    float interval = 3.5;
    float timeInCycle = mod(uTime, interval);
    float flashProfile = smoothstep(0.0, 0.1, timeInCycle) * (1.0 - smoothstep(0.1, 1.2, timeInCycle));
    float strobe = snoise(vec2(uTime * 8.0, 42.0)) * 0.2 + 0.8; 
    float flash = flashProfile * strobe;

    float sheet = smoothstep(0.4, 0.8, cloudStructure) * flash;
    vec3 sheetColor = colBrightRed * 3.5; 
    sky += sheetColor * sheet * 0.8; 

    // ---------------------------
    // 3. MIND FLAYER RENDER
    // ---------------------------
    float dist = sdMindFlayer(p);
    
    float shadowAlpha = 1.0 - smoothstep(0.0, 0.6, dist);
    float rim = smoothstep(0.0, 0.3, dist) * smoothstep(0.4, 0.0, dist);
    rim *= (0.2 + sheet * 1.5); 
    
    vec3 monsterCol = vec3(0.02, 0.0, 0.05); 
    
    sky = mix(sky, monsterCol, shadowAlpha * 0.95);
    sky += vec3(0.5, 0.1, 0.1) * rim * shadowAlpha;
    
    float fogHeight = smoothstep(-4.0, -1.0, p.y);
    sky = mix(sky, colDeepRed * 0.5, (1.0 - fogHeight) * 0.3 * shadowAlpha);

    // ---------------------------
    // 4. FOREGROUND TREELINE
    // ---------------------------
    float treeNoise = fbm(vec2(p.x * 8.0, 0.0));
    float treeLine = -3.2 + treeNoise * 0.5;
    treeLine += abs(snoise(vec2(p.x * 30.0, 0.0))) * 0.3;
    
    float treeMask = 1.0 - smoothstep(treeLine, treeLine + 0.15, p.y);
    sky = mix(sky, vec3(0.0), treeMask);

    // ---------------------------
    // 5. POST
    // ---------------------------
    float vig = 1.0 - smoothstep(3.0, 3.6, abs(p.x));
    sky *= vig;
    
    float ash = snoise(p * 8.0 - vec2(uTime * 0.5, uTime * 1.5));
    float ashMask = smoothstep(0.65, 1.0, ash);
    sky += vec3(0.4) * ashMask * 0.15;

    gl_FragColor = vec4(sky, 1.0);
  }
`;

interface UpsideDownWorldProps {
  theme: ThemeConfig;
}

const UpsideDownWorld: React.FC<UpsideDownWorldProps> = ({ theme }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorPrimary: { value: new THREE.Color(theme.primaryColor) },
      uColorSecondary: { value: new THREE.Color(theme.secondaryColor) },
      uColorCore: { value: new THREE.Color(theme.coreColor) },
    }),
    []
  );

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uColorPrimary.value.set(theme.primaryColor);
      materialRef.current.uniforms.uColorSecondary.value.set(theme.secondaryColor);
      materialRef.current.uniforms.uColorCore.value.set(theme.coreColor);
    }
  });

  return (
    <mesh position={[0, 0, -2]}>
      <planeGeometry args={[7.0, 8.0]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export default UpsideDownWorld;
