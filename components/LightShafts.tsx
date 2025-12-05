
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHandState } from '../store';
import { ThemeConfig } from '../types';

// -----------------------------------------------------------------------------
// SHADER CHUNKS
// -----------------------------------------------------------------------------

const noiseChunk = `
  // 3D Simplex Noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) { 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; 
    vec3 x3 = x0 - D.yyy;      

    i = mod289(i); 
    vec4 p = permute( permute( permute( 
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 0.142857142857; 
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z); 

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }

  // Fractional Brownian Motion
  float fbm(vec3 x) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 4; ++i) {
      v += a * snoise(x);
      x = x * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }
`;

const vertexShader = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    
    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;
    
    vNormal = normalize(normalMatrix * normal);
    
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpenness;
  
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  ${noiseChunk}

  void main() {
    // ----------------------------------------------------
    // SETUP
    // ----------------------------------------------------
    vec3 viewDir = normalize(vViewPosition);
    // Relative position from the Rift Center (Z=0)
    vec3 p = vWorldPos; 
    
    // ----------------------------------------------------
    // 1. SOFT FRESNEL (HIDE EDGES)
    // ----------------------------------------------------
    float fresnel = dot(vNormal, viewDir);
    fresnel = clamp(1.0 - abs(fresnel), 0.0, 1.0);
    fresnel = pow(fresnel, 1.5); 

    // ----------------------------------------------------
    // 2. VERTICAL SLIT MASK (THE RIFT SHAPE)
    // ----------------------------------------------------
    float widthAtDepth = 0.3 + p.z * 0.6; // Slightly wider base
    float normX = p.x / widthAtDepth;
    
    // The slit width is controlled by hand openness
    float opening = uOpenness * 0.8; 
    float slitMask = 1.0 - smoothstep(opening, opening + 0.5, abs(normX));
    
    // Vertical fade at extreme top/bottom
    float vFade = 1.0 - smoothstep(2.0, 4.0, abs(p.y));

    // ----------------------------------------------------
    // 3. VOLUMETRIC NOISE (SMOKE & RAYS)
    // ----------------------------------------------------
    // Atmosphere / Dust only, removed sharp rays
    vec3 fogCoord = vec3(p.x * 0.5, p.y * 0.5, p.z * 0.5 - uTime * 0.2);
    float fog = fbm(fogCoord + vec3(0.0, 0.0, uTime * 0.1));
    
    // Soft streaks
    vec3 rayCoord = vec3(p.x * 2.0, p.y * 2.0, p.z * 0.2 - uTime * 0.5);
    float rays = fbm(rayCoord);
    
    float density = (rays * 0.3 + fog * 0.7);
    
    // ----------------------------------------------------
    // 4. COLOR GRADING
    // ----------------------------------------------------
    
    vec3 finalColor = uColor;
    
    // Boost intensity slightly for visibility
    finalColor *= 2.0;

    // ----------------------------------------------------
    // 5. FINAL ALPHA
    // ----------------------------------------------------
    
    float alpha = density * slitMask * fresnel * vFade;
    
    // Distance fade out (far form camera/rift)
    alpha *= (1.0 - smoothstep(5.0, 8.0, p.z));
    
    // Openness control (Gate closed = No light)
    alpha *= smoothstep(0.01, 0.2, uOpenness);
    
    // REMOVED CENTER DENSITY CALCULATION TO FIX GHOST SPHERE ARTIFACT

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

interface LightShaftsProps {
  theme: ThemeConfig;
}

const LightShafts: React.FC<LightShaftsProps> = ({ theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const currentOpenness = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(theme.primaryColor) },
      uOpenness: { value: 0 },
    }),
    []
  );

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uColor.value.set(theme.primaryColor);
      
      const handState = getHandState();
      
      const target = handState.openness;
      currentOpenness.current += (target - currentOpenness.current) * 2.0 * delta;
      
      materialRef.current.uniforms.uOpenness.value = currentOpenness.current;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      position={[0, 0, 3.5]} 
      rotation={[Math.PI / 2, 0, 0]} 
    >
      {/* 
        Tapered Cylinder (Frustum)
        Increased Bottom Radius to 0.4 to prevent pinching point artifact
      */}
      <cylinderGeometry args={[4.0, 0.4, 7.0, 64, 1, true]} />
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

export default LightShafts;
