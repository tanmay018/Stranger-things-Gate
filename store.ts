import { createRef } from 'react';
import { HandState } from './types';

// We use a mutable ref for the hand state to avoid React re-render overhead 
// on every frame update from MediaPipe. Three.js components will read this directly.
export const handStateRef = createRef<HandState>();

// Initialize
if (!handStateRef.current) {
  // @ts-ignore
  handStateRef.current = {
    isOpen: false,
    openness: 0,
    position: { x: 0, y: 0, z: 0 }
  };
}

export const getHandState = () => handStateRef.current!;