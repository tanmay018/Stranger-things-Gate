
import React from 'react';
import { ThemeType } from '../types';

interface UIOverlayProps {
  currentTheme: ThemeType;
  setTheme: (t: ThemeType) => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ currentTheme, setTheme }) => {
  // Explicitly defining order: Vecna first, then Laboratory
  const themeOrder = [ThemeType.VECNA, ThemeType.LABORATORY];

  const subHeading = currentTheme === ThemeType.VECNA 
    ? "The Creel House" 
    : "Hawkins National Laboratory - Upside Down Gate Control";

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 font-serif">
      {/* Header */}
      <header className="pointer-events-auto">
        <img 
          src="https://www.freepnglogos.com/uploads/stranger-things-logo-png/stranger-things-red-logo-vector-free-download-5.png" 
          alt="Stranger Things" 
          className="w-60 h-auto drop-shadow-[0_0_15px_rgba(220,0,0,0.6)]"
        />
        <p className="text-red-400 text-sm tracking-widest mt-4 uppercase border-t border-red-900 pt-2 inline-block">
          {subHeading}
        </p>
      </header>

      {/* Theme Selector Panel */}
      <div className="pointer-events-auto w-full max-w-md self-end bg-black/80 border-2 border-red-800 p-6 rounded-sm shadow-[0_0_20px_rgba(150,0,0,0.3)] backdrop-blur-sm">
        <h2 className="text-red-500 font-bold mb-4 uppercase tracking-wider text-xs flex items-center">
          <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
          Dimensional Frequency
        </h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          {themeOrder.map((theme) => (
            <button
              key={theme}
              onClick={() => setTheme(theme)}
              className={`
                px-4 py-2 text-xs font-bold uppercase tracking-wide border transition-all duration-300
                ${currentTheme === theme 
                  ? 'bg-red-900/50 border-red-500 text-white shadow-[0_0_10px_rgba(255,0,0,0.5)] scale-105' 
                  : 'bg-transparent border-red-900 text-red-700 hover:border-red-600 hover:text-red-500'}
              `}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      {/* Instructional Footer */}
      <div className="absolute bottom-8 left-8 text-red-800/60 font-bold text-xs uppercase tracking-[0.2em]">
        <p className="mb-1">Gesture Protocol:</p>
        <ul className="list-disc list-inside">
          <li>Clenched Fist: Seal Rift</li>
          <li>Open Hand: Tear Reality</li>
        </ul>
      </div>
    </div>
  );
};

export default UIOverlay;
