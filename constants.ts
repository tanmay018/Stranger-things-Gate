
import { ThemeType, ThemeConfig } from './types';

export const THEMES: Record<ThemeType, ThemeConfig> = {
  // Season 1: Sticky, Glowing Orange/Yellow Core, Dark Red/Brown Flesh
  [ThemeType.LABORATORY]: {
    primaryColor: '#ffaa00', // Bright Amber/Yellow Atmosphere
    secondaryColor: '#2a0505', // Dried Blood/Dark Flesh
    fogColor: '#050202',       // Almost Black
    coreColor: '#ff5500',      // Intense Orange Core (requested override)
    noiseSpeed: 0.3,
    noiseScale: 2.5,
    particleCount: 2000,
    lightning: false
  },
  // Season 4: Red Lightning, Cold Blue/Red contrast, Cracking
  [ThemeType.VECNA]: {
    primaryColor: '#ff0000', // Pure Red
    secondaryColor: '#0a0a1a', // Dark Cold Blue/Black (Mind Lair)
    fogColor: '#000000',
    coreColor: '#ff0000',      // Pure Red Core
    noiseSpeed: 0.1,
    noiseScale: 6.0, 
    particleCount: 2500,
    lightning: true
  }
};
