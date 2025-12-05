import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Lightning: React.FC<{ color: string }> = ({ color }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  
  useFrame(() => {
    if (lightRef.current) {
      if (Math.random() > 0.96) { // Occasional flash
        lightRef.current.intensity = 5 + Math.random() * 10;
        lightRef.current.position.set(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          -2
        );
      } else {
        lightRef.current.intensity = Math.max(0, lightRef.current.intensity * 0.8); // Fast decay
      }
    }
  });

  return (
    <pointLight ref={lightRef} color={color} distance={20} decay={2} intensity={0} />
  );
};

export default Lightning;