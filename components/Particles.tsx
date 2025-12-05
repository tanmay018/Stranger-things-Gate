import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getHandState } from '../store';
import { ThemeConfig } from '../types';

interface ParticlesProps {
  theme: ThemeConfig;
}

const Particles: React.FC<ParticlesProps> = ({ theme }) => {
  // Increase particle count for denser ash effect
  const count = theme.particleCount + 200;
  const meshRef = useRef<THREE.Points>(null);
  
  // Initialize positions and velocities
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 10;
      const y = (Math.random() - 0.5) * 10;
      const z = (Math.random() - 0.5) * 5; // Closer to camera Z range
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      // Reduced base velocity for floaty ash feel
      vel[i * 3] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.005;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.005;
    }
    
    return [pos, vel];
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    const handState = getHandState();
    const handPos = new THREE.Vector3(handState.position.x * 3, handState.position.y * 3, 0);
    const time = state.clock.getElapsedTime();

    const positionAttribute = meshRef.current.geometry.attributes.position as THREE.BufferAttribute;

    // Calculate upward drift
    // Drifts faster when rift is closed (heat accumulation/idle state)
    // Drifts slower or gets disturbed when open
    const baseDrift = 0.0015;
    const closedDrift = (!handState.isOpen) ? 0.002 : 0;
    const upwardDrift = baseDrift + closedDrift;

    for (let i = 0; i < count; i++) {
      let ix = i * 3;
      let iy = i * 3 + 1;
      let iz = i * 3 + 2;
      
      // Basic drift + Upward bias
      positions[ix] += velocities[ix];
      positions[iy] += velocities[iy] + upwardDrift;
      positions[iz] += velocities[iz];

      // Turbulence/Flutter (Ash movement)
      positions[ix] += Math.sin(time * theme.noiseSpeed + positions[iy]) * 0.002;
      positions[iy] += Math.cos(time * theme.noiseSpeed + positions[ix]) * 0.001; // Reduced vertical noise to let drift dominate

      // Hand Interaction (Repel)
      if (handState.isOpen) {
        const dx = positions[ix] - handPos.x;
        const dy = positions[iy] - handPos.y;
        const dz = positions[iz] - handPos.z;
        const distSq = dx*dx + dy*dy + dz*dz;
        
        if (distSq < 2.0) {
          const force = (2.0 - distSq) * 0.05;
          positions[ix] += dx * force;
          positions[iy] += dy * force;
          positions[iz] += dz * force;
        }
      }

      // Reset if out of bounds (Looping)
      // If it goes too high, reset to bottom
      if (positions[iy] > 5) {
         positions[iy] = -5;
         // Randomize X/Z slightly on reset to avoid patterns
         positions[ix] = (Math.random() - 0.5) * 10;
         positions[iz] = (Math.random() - 0.5) * 5;
      }
      
      // X bounds wrap
      if (positions[ix] > 5) positions[ix] = -5;
      if (positions[ix] < -5) positions[ix] = 5;

      positionAttribute.setXYZ(i, positions[ix], positions[iy], positions[iz]);
    }
    
    positionAttribute.needsUpdate = true;
  });

  // Ash Texture: slightly smaller, possibly irregular (kept simple circle for performance but smaller size)
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        // Slightly smaller radius for fine ash
        ctx.arc(16, 16, 8, 0, Math.PI * 2);
        ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  return (
    <points ref={meshRef} key={count}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04} // Slightly smaller size for ash
        color={theme.primaryColor}
        map={texture}
        transparent
        opacity={0.7} // Slightly higher opacity for visibility
        alphaTest={0.01}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export default Particles;