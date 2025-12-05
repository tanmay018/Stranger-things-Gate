
export enum ThemeType {
  LABORATORY = 'Laboratory Rift',
  VECNA = 'Vecna’s Curse'
}

export interface HandState {
  isOpen: boolean;
  openness: number; // 0 to 1
  position: { x: number; y: number; z: number }; // Normalized screen coordinates
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  fogColor: string;
  coreColor: string; // Added for specific rift energy color separate from atmosphere
  noiseSpeed: number;
  noiseScale: number;
  particleCount: number;
  lightning: boolean;
}

// Augment JSX namespace to allow R3F elements if they are missing from the environment
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      planeGeometry: any;
      shaderMaterial: any;
      points: any;
      bufferGeometry: any;
      bufferAttribute: any;
      pointsMaterial: any;
      pointLight: any;
      fog: any;
      ambientLight: any;
      spotLight: any;
      cylinderGeometry: any;
      group: any;
      icosahedronGeometry: any;
    }
  }
}
