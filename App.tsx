
import React, { useState } from 'react';
import Scene from './components/Scene';
import UIOverlay from './components/UIOverlay';
import WebcamController from './components/WebcamController';
import IntroModal from './components/IntroModal';
import { ThemeType } from './types';
import { THEMES } from './constants';

const App: React.FC = () => {
  const [currentThemeType, setCurrentThemeType] = useState<ThemeType>(ThemeType.VECNA);
  const [hasStarted, setHasStarted] = useState(false);
  
  // Active theme config
  const activeTheme = THEMES[currentThemeType];

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene theme={activeTheme} />
      </div>

      {/* UI Layer - visible only after start or partially visible behind modal? 
          We keep it visible so it renders behind the modal for atmosphere */}
      <div className="absolute inset-0 z-10">
        <UIOverlay 
          currentTheme={currentThemeType} 
          setTheme={setCurrentThemeType} 
        />
      </div>

      {/* Logic Layer - Camera only starts after permission acknowledgment */}
      {hasStarted && <WebcamController />}

      {/* Modal Layer */}
      {!hasStarted && <IntroModal onEnter={() => setHasStarted(true)} />}
    </div>
  );
};

export default App;
