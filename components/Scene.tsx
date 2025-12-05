
import React from 'react';
import { Canvas } from '@react-three/fiber';
import { ThemeConfig } from '../types';
import RiftGate from './RiftGate';
import Particles from './Particles';
import Lightning from './Lightning';
import LightShafts from './LightShafts';
import UpsideDownWorld from './UpsideDownWorld';

interface SceneProps {
  theme: ThemeConfig;
}

const Scene: React.FC<SceneProps> = ({ theme }) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 55 }} // Moved back slightly to see full tear
      gl={{ antialias: true, alpha: false }}
      className="w-full h-full block"
      style={{ background: theme.fogColor }}
    >
      <fog attach="fog" args={[theme.fogColor, 1, 12]} />
      
      {/* Ambient lighting - very dim to keep shadows dark */}
      <ambientLight intensity={0.1} color={theme.secondaryColor} />
      
      {/* Rim Light for the membrane surface */}
      <pointLight 
        position={[2, 2, 2]} 
        intensity={0.5} 
        color={theme.primaryColor} 
        distance={5}
      />

      {/* "God Ray" source BEHIND the gate to blast through the hole */}
      <spotLight
        position={[0, 0, -4]}
        target-position={[0, 0, 5]}
        angle={0.6}
        penumbra={1}
        intensity={3}
        color={theme.primaryColor}
        castShadow={false}
      />
      
      {/* The World Behind The Gate (Visible through the tear) */}
      <UpsideDownWorld theme={theme} />

      {/* Main Rift Interaction (The Wall & Tear) */}
      <RiftGate theme={theme} />

      {/* Volumetric Fog/Light Volume */}
      <LightShafts theme={theme} />
      
      {/* Environmental Effects */}
      <Particles theme={theme} />
      
      {theme.lightning && <Lightning color={theme.primaryColor} />}
      
    </Canvas>
  );
};

export default Scene;
