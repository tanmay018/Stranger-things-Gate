
import React from 'react';

interface IntroModalProps {
  onEnter: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ onEnter }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-1000">
      <div className="max-w-xl w-full border-2 border-red-900 bg-black/80 shadow-[0_0_50px_rgba(220,0,0,0.2)] p-1 text-center relative overflow-hidden">
        
        {/* Decorative corner lines */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-red-600"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-red-600"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-red-600"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-red-600"></div>

        <div className="p-8 border border-red-900/50">
          <h1 className="font-serif text-3xl md:text-4xl text-red-500 font-bold mb-2 tracking-wider drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">
            HAWKINS LAB WARNING
          </h1>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-red-800 to-transparent mb-6"></div>

          <p className="font-serif text-red-200/80 text-lg mb-8 leading-relaxed">
            To channel your powers, the app needs <span className="text-red-500 font-bold">camera access</span>.
          </p>

          <div className="flex flex-col md:flex-row justify-center gap-12 mb-10 text-sm font-serif text-red-100/70 tracking-widest uppercase">
            <div className="flex flex-col items-center">
              <img 
                src="https://raw.githubusercontent.com/tanmay018/avst_web/refs/heads/main/open.png" 
                alt="Open Hand" 
                className="w-20 h-20 mb-3 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.5)] opacity-90"
              />
              <span>Open Palm</span>
              <span className="text-xs text-red-500 mt-1">Open The Gate</span>
            </div>
            <div className="flex flex-col items-center">
              <img 
                src="https://raw.githubusercontent.com/tanmay018/avst_web/refs/heads/main/closed.png" 
                alt="Clenched Fist" 
                className="w-20 h-20 mb-3 object-contain drop-shadow-[0_0_15px_rgba(255,0,0,0.5)] opacity-90"
              />
              <span>Clenched Fist</span>
              <span className="text-xs text-red-500 mt-1">Seal The Gate</span>
            </div>
          </div>

          <button 
            onClick={onEnter}
            className="group relative px-8 py-3 bg-transparent border-2 border-red-600 text-red-500 font-bold tracking-[0.2em] uppercase hover:bg-red-900/30 hover:text-white hover:border-red-500 transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]"
          >
            <span className="relative z-10">Enter The Upside Down</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroModal;