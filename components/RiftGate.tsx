import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHandState } from '../store';
import { ThemeConfig } from '../types';

// Enhanced noise functions including FBM for detailed biological texture
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

  // Fractional Brownian Motion for fleshy details
  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(st);
      st *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  // Rounded Box SDF
  float sdRoundedBox(in vec2 p, in vec2 b, in float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }
`;

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vPos;
  varying float vDisplacement;
  
  uniform float uTime;
  uniform float uNoiseScale;
  uniform float uOpenness;
  
  ${noiseChunk}

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Organic Breathing (Low Frequency)
    float breath = snoise(vec2(uTime * 0.2, 0.0)) * 0.2;
    
    // Membrane Tension (High Frequency)
    float tension = 1.0 - (uOpenness * 0.8);
    float noise = fbm(uv * uNoiseScale + uTime * 0.1);
    
    // --- SHAPE DISTORTION UPDATE ---
    vec2 centered = uv - 0.5;
    
    // Shape: Organic Rounded Rectangle
    // We add noise to the domain to distort the box shape
    float angle = atan(centered.y, centered.x);
    float shapeWobble = snoise(vec2(angle * 2.5, uTime * 0.1)) * 0.08;
    
    // Base shape dimensions (Half-width, Half-height, Corner Radius)
    // 0.35 width, 0.5 height, 0.15 radius
    float boxDist = sdRoundedBox(centered, vec2(0.35, 0.5), 0.15);
    
    // Add wobble to the distance
    float distortedDist = boxDist + shapeWobble;
    
    // Mask out displacement outside the organic shape
    // 0 inside shape, 1 outside. Invert for mask.
    float edgeMask = 1.0 - smoothstep(0.0, 0.1, distortedDist); 
    
    float displacement = noise * 0.8 * tension * edgeMask;
    
    pos.z += displacement + breath;
    vDisplacement = displacement; 
    
    vPos = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorPrimary;   
  uniform vec3 uColorSecondary; 
  uniform float uOpenness;
  uniform float uNoiseScale;
  
  varying vec2 vUv;
  varying float vDisplacement;
  
  ${noiseChunk}

  void main() {
    vec2 center = vec2(0.5, 0.5);
    vec2 p = vUv - center;
    
    // ----------------------
    // 1. SHAPE DEFINITION (THE TEAR - UNCHANGED)
    // ----------------------
    // Jagged Vertical Crack Logic
    float spineWiggle = snoise(vec2(p.y * 1.5, uTime * 0.1)) * 0.15;
    float xPos = p.x - spineWiggle;
    float jagged = fbm(vec2(p.y * 10.0, uTime * 0.2)) * 0.1;
    float distToSpine = abs(xPos + jagged);
    float verticalFade = smoothstep(0.48, 0.3, abs(p.y)); 
    float effectiveDist = distToSpine / (verticalFade + 0.001);

    // ----------------------
    // 2. TEXTURE & VEINS
    // ----------------------
    float veinNoise = snoise(vUv * 6.0 + fbm(vUv * 10.0));
    float ridges = smoothstep(0.4, 0.6, abs(veinNoise));
    float flesh = fbm(vUv * 15.0 + uTime * 0.05);
    
    // ----------------------
    // 3. TEAR LOGIC (The Hole)
    // ----------------------
    float openThreshold = mix(0.005, 0.4, uOpenness);
    
    // ----------------------
    // 4. STRANDS / WEBBING
    // ----------------------
    float strandNoise = snoise(vec2(p.x * 0.5, p.y * 20.0) + uTime * 0.1);
    float strandMask = verticalFade;
    float strandStrength = smoothstep(0.4 + uOpenness, 0.9 + uOpenness, strandNoise);
    
    // ----------------------
    // 5. COMPOSITING ALPHA (HOLE)
    // ----------------------
    float membraneAlpha = smoothstep(openThreshold, openThreshold + 0.05, effectiveDist);
    float holeContent = strandStrength * strandMask * (1.0 - uOpenness);
    float contentAlpha = max(membraneAlpha, holeContent);
    
    // ----------------------
    // 6. COLOR GRADING
    // ----------------------
    vec3 wallColor = mix(uColorSecondary * 0.5, uColorSecondary, flesh);
    wallColor = mix(wallColor, uColorPrimary * 0.8, (1.0 - ridges) * 0.3);
    
    float rim = 1.0 - smoothstep(openThreshold, openThreshold + 0.15, effectiveDist);
    rim *= verticalFade; 
    
    vec3 glowColor = uColorPrimary * 2.5; 
    vec3 finalColor = mix(wallColor, glowColor, rim * rim); 
    
    // ----------------------
    // 7. OUTER BOUNDARY (ORGANIC PORTAL)
    // ----------------------
    // Same organic distortion logic as vertex shader for consistency
    float angle = atan(p.y, p.x);
    float shapeWobble = snoise(vec2(angle * 2.5, uTime * 0.1)) * 0.08;
    
    // Use Rounded Box SDF for a "Portal" shape rather than hard rect
    // Dimensions match vertex shader
    float baseDist = sdRoundedBox(p, vec2(0.35, 0.5), 0.15);
    
    // Add roughness to the edge itself (separate from overall shape wobble)
    float edgeRoughness = fbm(p * 20.0 + uTime * 0.05) * 0.02;
    
    float finalBoundaryDist = baseDist + shapeWobble + edgeRoughness;
    
    // Smooth fade for the organic edge
    float outerFade = 1.0 - smoothstep(0.0, 0.03, finalBoundaryDist);
    
    gl_FragColor = vec4(finalColor, contentAlpha * outerFade);
    
    if (gl_FragColor.a < 0.05) discard;
  }
`;

interface RiftGateProps {
  theme: ThemeConfig;
}

const RiftGate: React.FC<RiftGateProps> = ({ theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentOpenness = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColorPrimary: { value: new THREE.Color(theme.primaryColor) },
      uColorSecondary: { value: new THREE.Color(theme.secondaryColor) },
      uOpenness: { value: 0 },
      uNoiseScale: { value: theme.noiseScale },
    }),
    []
  );

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta * theme.noiseSpeed;
      materialRef.current.uniforms.uNoiseScale.value = theme.noiseScale;
      materialRef.current.uniforms.uColorPrimary.value.set(theme.primaryColor);
      materialRef.current.uniforms.uColorSecondary.value.set(theme.secondaryColor);

      const handState = getHandState();
      
      const target = handState.openness;
      const speed = handState.isOpen ? 1.5 : 3.0; 
      currentOpenness.current += (target - currentOpenness.current) * speed * delta;
      
      materialRef.current.uniforms.uOpenness.value = currentOpenness.current;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <planeGeometry args={[6, 6, 200, 200]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default RiftGate;