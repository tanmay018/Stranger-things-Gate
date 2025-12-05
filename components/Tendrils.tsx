import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHandState } from '../store';
import { ThemeConfig } from '../types';

// Enhanced noise for sharp, electric/organic details
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
`;

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vNoise;
  
  uniform float uTime;
  uniform float uGrowth;

  ${noiseChunk}

  void main() {
    vUv = uv;
    vNormal = normal;
    vec3 pos = position;
    
    // UV.y is 0 at Rift, 1 at Camera.
    
    // Generate chaotic noise for displacement
    // Higher frequency on X (circumference), lower on Y (length) to make long strands
    float noise = snoise(vec2(uv.x * 12.0, uv.y * 1.5 - uTime * 1.5));
    vNoise = noise;

    // Displace vertices to break the perfect cone shape
    // We want the tendrils to feel like they are thrashing
    float thrash = snoise(vec2(uv.y * 2.0, uTime * 3.0)) * 0.5;
    
    // Expand outwards based on noise (spiky)
    // Only displace if growth is active to prevent static artifacts
    float displacement = (noise * 0.5 + thrash * 0.2) * uGrowth * 2.0;
    
    // Apply displacement along normal
    pos += normal * displacement;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uGrowth;
  
  varying vec2 vUv;
  varying float vNoise;

  ${noiseChunk}

  void main() {
    // ----------------------------------------------------
    // Create the "Vein" / "Lightning" Structure
    // ----------------------------------------------------
    
    // Domain warping to make the lines crooked
    vec2 warpedUV = vUv;
    warpedUV.x += snoise(vec2(vUv.y * 5.0, uTime)) * 0.1;
    
    // 1. Main Strands (Thick)
    // We use a high frequency X noise and stretch it along Y
    float n1 = snoise(vec2(warpedUV.x * 15.0, warpedUV.y * 0.5 - uTime * 1.2));
    // Sharpen the noise to create thin lines (1.0 / abs) technique or smoothstep
    float strands = 1.0 - smoothstep(0.02, 0.15, abs(n1));
    
    // 2. Secondary Detail (Webbing)
    float n2 = snoise(vec2(warpedUV.x * 30.0 + uTime, warpedUV.y * 5.0));
    float webbing = (1.0 - smoothstep(0.0, 0.1, abs(n2))) * 0.5;
    
    // Combine structure
    float structure = strands + webbing;
    
    // ----------------------------------------------------
    // Masking & Growth
    // ----------------------------------------------------
    
    float distFromRift = vUv.y; // 0..1
    
    // The "Growth Front" - where the tendrils stop
    // Add jagged noise to the tip
    float tipNoise = snoise(vec2(vUv.x * 10.0, uTime * 2.0)) * 0.2;
    float reach = uGrowth * 1.2; // Overshoot slightly to ensure full coverage at 1.0
    float limit = reach + tipNoise;
    
    float mask = smoothstep(limit + 0.1, limit, distFromRift);
    
    // Fade out very close to camera to avoid clipping artifacts
    float camFade = 1.0 - smoothstep(0.9, 1.0, distFromRift);
    
    // ----------------------------------------------------
    // Color & Intensity
    // ----------------------------------------------------
    
    // Hot core color (Bright Yellow/White)
    vec3 coreColor = vec3(1.0, 0.9, 0.6);
    
    // Outer glow color (The Theme Color)
    vec3 glowColor = uColor * 3.0; // Boost intensity for HDR look
    
    // Mix based on strand density
    vec3 finalColor = mix(glowColor, coreColor, structure * 0.8);
    
    // Add a pulsing effect along the length
    float pulse = smoothstep(0.3, 0.7, snoise(vec2(0.0, vUv.y * 2.0 - uTime * 3.0)));
    finalColor += pulse * uColor;

    float alpha = structure * mask * camFade;
    
    // Hard cut for clear silhouette
    if (alpha < 0.1) discard;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface TendrilsProps {
  theme: ThemeConfig;
}

const Tendrils: React.FC<TendrilsProps> = ({ theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentGrowth = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(theme.secondaryColor) },
      uGrowth: { value: 0 },
    }),
    []
  );

  useFrame((state, delta) => {
    if (materialRef.current && meshRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      
      // Use primary color for tendrils as it usually glows (unlike secondary which is dark)
      // Or mix them. Let's use Primary for the "energy" look.
      materialRef.current.uniforms.uColor.value.set(theme.primaryColor);

      const handState = getHandState();
      
      // If hand is open, grow fast. If closed, retract.
      const target = handState.isOpen ? 1.0 : 0.0;
      
      // Interpolate growth
      currentGrowth.current += (target - currentGrowth.current) * 2.0 * delta;
      materialRef.current.uniforms.uGrowth.value = currentGrowth.current;

      // Rotate the whole tunnel slowly for a vortex effect
      meshRef.current.rotation.z += delta * 0.2;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 4.0]} 
      rotation={[Math.PI / 2, 0, 0]} 
    >
      {/* 
        Geometry: Funnel shape.
        Top (Camera end): 4.0 radius
        Bottom (Rift end): 0.05 radius
        Height: 8.0
      */}
      <cylinderGeometry args={[4.0, 0.05, 8.0, 64, 30, true]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};

export default Tendrils;