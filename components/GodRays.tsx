
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHandState } from '../store';
import { ThemeConfig } from '../types';

// -----------------------------------------------------------------------------
// SHADER CHUNKS (Noise for Core)
// -----------------------------------------------------------------------------
const noiseChunk = `
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
`;

// -----------------------------------------------------------------------------
// RAY SHADERS (Beams)
// -----------------------------------------------------------------------------

const rayVertexShader = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uLengthScale;

  void main() {
    vUv = uv;
    vec3 pos = position;
    
    // Shift geometry so Y ranges from 0.0 to 1.0
    pos.y += 0.5;
    
    // Scale length
    pos.y *= uLengthScale;
    
    // Subtle sway at the tip
    float sway = sin(uTime * 1.5 + pos.x * 5.0) * 0.1 * uv.y;
    pos.x += sway;

    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const rayFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFlickerSpeed;
  uniform float uFlickerOffset;
  uniform float uOpenness;
  
  varying vec2 vUv;

  void main() {
    // Length Fade (Tip of ray fades out)
    float lenFade = 1.0 - smoothstep(0.0, 1.0, vUv.y);
    
    // Width Fade (Aperture Simulation)
    // When closed (uOpenness small), beam is tight/thin (high power)
    // When open, beam spreads (low power)
    // This simulates the light squeezing through the crack
    float beamTightness = mix(25.0, 3.0, uOpenness); 
    float widthFade = pow(sin(vUv.x * 3.14159), beamTightness);
    
    float pulse = sin(uTime * uFlickerSpeed + uFlickerOffset);
    float intensity = 0.8 + pulse * 0.2;
    
    // Core color logic derived from theme color
    vec3 coreBase = uColor * 3.0; 
    vec3 finalColor = mix(uColor, coreBase, widthFade * lenFade); 
    
    // Edge Boost (at the tear exit point)
    // Create a hot spot near the base of the ray to simulate light breaking through the wall edge
    float startGlow = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.15, 0.5, vUv.y));
    // Boost intensity significantly at this point
    finalColor += uColor * startGlow * 3.0;

    // HDR Boost
    finalColor *= 2.0;
    
    // Smooth opacity transition based on openness
    float openFade = smoothstep(0.0, 0.1, uOpenness);
    
    float alpha = lenFade * widthFade * uOpacity * intensity * openFade;
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// -----------------------------------------------------------------------------
// CORE SHADERS (Distorted Sphere)
// -----------------------------------------------------------------------------

const coreVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vNoise;
  
  uniform float uTime;
  uniform float uOpenness;
  
  ${noiseChunk}

  void main() {
    vUv = uv;
    vNormal = normal;
    vec3 pos = position;
    
    // Boiling Noise
    float n = snoise(vec3(pos * 2.5 + uTime * 0.4)); // Slow animation
    vNoise = n;
    
    // Displace outward based on noise and openness
    // If closed, it shrinks. If open, it expands and boils.
    float displacement = n * 0.1 * uOpenness;
    pos += normal * displacement;
    
    // Heartbeat pulse
    float pulse = sin(uTime * 2.0) * 0.05;
    pos += normal * pulse * uOpenness;
    
    // Scale entire sphere by openness
    float scale = smoothstep(0.0, 0.2, uOpenness);
    pos *= scale;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const coreFragmentShader = `
  varying float vNoise;
  varying vec3 vNormal;
  
  uniform vec3 uColor;
  uniform float uOpenness;
  
  void main() {
    // Hot energy core look
    
    // Mix theme color with brighter version of itself (no white desaturation)
    vec3 hotColor = uColor * 4.0;
    vec3 baseColor = uColor;
    
    float noiseIntensity = smoothstep(-0.2, 0.5, vNoise);
    vec3 finalColor = mix(baseColor, hotColor, noiseIntensity);
    
    // Fresnel-like edge glow
    // Boost intensity for HDR
    finalColor *= 2.0;
    
    // Alpha fade if barely open
    float alpha = smoothstep(0.0, 0.1, uOpenness);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// -----------------------------------------------------------------------------
// COMPONENTS
// -----------------------------------------------------------------------------

interface RayProps {
  theme: ThemeConfig;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  flickerSpeed: number;
  flickerOffset: number;
}

const Ray: React.FC<RayProps> = ({ theme, position, rotation, scale, flickerSpeed, flickerOffset }) => {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const currentLength = useRef(0);
    
    useFrame((state, delta) => {
        if (materialRef.current) {
            const handState = getHandState();
            
            materialRef.current.uniforms.uTime.value += delta;
            materialRef.current.uniforms.uColor.value.set(theme.coreColor); // Use Core Color
            
            const targetLen = handState.openness * scale[1]; 
            currentLength.current += (targetLen - currentLength.current) * 4.0 * delta;
            
            materialRef.current.uniforms.uLengthScale.value = currentLength.current;
            materialRef.current.uniforms.uOpenness.value = handState.openness;
            materialRef.current.uniforms.uOpacity.value = 0.7;
        }
    });
    
    const uniforms = useMemo(() => ({
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(theme.coreColor) },
        uOpacity: { value: 0 },
        uLengthScale: { value: 0 },
        uOpenness: { value: 0 },
        uFlickerSpeed: { value: flickerSpeed },
        uFlickerOffset: { value: flickerOffset }
    }), [theme.coreColor, flickerSpeed, flickerOffset]);

    return (
        <group position={position} rotation={rotation}>
            <mesh> 
                <planeGeometry args={[scale[0], 1.0]} /> 
                <shaderMaterial 
                    ref={materialRef}
                    vertexShader={rayVertexShader}
                    fragmentShader={rayFragmentShader}
                    uniforms={uniforms}
                    transparent
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    )
}

const DistortedCore: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const opennessRef = useRef(0);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(theme.coreColor) }, // Use Core Color
    uOpenness: { value: 0 },
  }), [theme.coreColor]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uColor.value.set(theme.coreColor);
      
      const handState = getHandState();
      // Interpolate openness for smooth scaling
      opennessRef.current += (handState.openness - opennessRef.current) * 3.0 * delta;
      materialRef.current.uniforms.uOpenness.value = opennessRef.current;
      
      // Rotate core slowly
      if (meshRef.current) {
        meshRef.current.rotation.y += delta * 0.5;
        meshRef.current.rotation.z += delta * 0.3;
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -0.1]}>
      {/* High poly icosahedron for detailed noise displacement */}
      <icosahedronGeometry args={[0.25, 30]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={coreVertexShader}
        fragmentShader={coreFragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

interface GodRaysProps {
    theme: ThemeConfig;
}

const GodRays: React.FC<GodRaysProps> = ({ theme }) => {
    // 1. Central Core Rays
    const centerRays = useMemo(() => {
        const count = 25; 
        return new Array(count).fill(0).map((_, i) => {
            const angleZ = (i / count) * Math.PI * 2 + (Math.random() * 0.5);
            // Point towards camera with some chaos
            const angleX = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;

            const width = 0.4 + Math.random() * 0.4; 
            const length = 5.0 + Math.random() * 3.0; 

            return {
                position: [0, 0, -0.2] as [number, number, number],
                rotationZ: angleZ,
                rotationX: angleX,
                scale: [width, length, 1] as [number, number, number],
                flickerSpeed: 1.0 + Math.random() * 2.0,
                flickerOffset: Math.random() * 10.0
            }
        })
    }, [theme]);

    // 2. Top Emitter Rays (Upwards)
    const topRays = useMemo(() => {
        const count = 8;
        return new Array(count).fill(0).map((_, i) => {
            // Fan out around 0 radians (Up)
            const angleZ = (Math.random() - 0.5) * 1.5; 
            // Shallow angle, streaming along wall/out
            const angleX = -Math.PI / 2 + 0.3 + (Math.random() * 0.3);

            return {
                position: [0, 2.2, -0.2] as [number, number, number],
                rotationZ: angleZ,
                rotationX: angleX,
                scale: [0.3 + Math.random() * 0.3, 3.0 + Math.random() * 2.0, 1] as [number, number, number],
                flickerSpeed: 1.0 + Math.random() * 2.0,
                flickerOffset: Math.random() * 10.0
            }
        });
    }, [theme]);

    // 3. Bottom Emitter Rays (Downwards)
    const bottomRays = useMemo(() => {
        const count = 8;
        return new Array(count).fill(0).map((_, i) => {
            // Fan out around PI radians (Down)
            const angleZ = Math.PI + (Math.random() - 0.5) * 1.5; 
             // Shallow angle
            const angleX = -Math.PI / 2 + 0.3 + (Math.random() * 0.3);

            return {
                position: [0, -2.2, -0.2] as [number, number, number],
                rotationZ: angleZ,
                rotationX: angleX,
                scale: [0.3 + Math.random() * 0.3, 3.0 + Math.random() * 2.0, 1] as [number, number, number],
                flickerSpeed: 1.0 + Math.random() * 2.0,
                flickerOffset: Math.random() * 10.0
            }
        });
    }, [theme]);

    return (
        <group key={theme.primaryColor}>
            {/* The Central Distorted Energy Core */}
            <DistortedCore theme={theme} />
            
            {/* Center Rays */}
            {centerRays.map((props, i) => (
                <group key={`c-${i}`} position={props.position} rotation={[0, 0, props.rotationZ]}>
                   <group rotation={[props.rotationX, 0, 0]}>
                      <Ray theme={theme} {...props} position={[0,0,0]} rotation={[0,0,0]} />
                   </group>
                </group>
            ))}

            {/* Top Rays */}
            {topRays.map((props, i) => (
                <group key={`t-${i}`} position={props.position} rotation={[0, 0, props.rotationZ]}>
                   <group rotation={[props.rotationX, 0, 0]}>
                      <Ray theme={theme} {...props} position={[0,0,0]} rotation={[0,0,0]} />
                   </group>
                </group>
            ))}

            {/* Bottom Rays */}
            {bottomRays.map((props, i) => (
                <group key={`b-${i}`} position={props.position} rotation={[0, 0, props.rotationZ]}>
                   <group rotation={[props.rotationX, 0, 0]}>
                      <Ray theme={theme} {...props} position={[0,0,0]} rotation={[0,0,0]} />
                   </group>
                </group>
            ))}
        </group>
    )
}

export default GodRays;
