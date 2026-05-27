import React from "react";
import { useFontSize } from "../../hooks/useFontSize";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

export const FontSizeControl: React.FC = () => {
  const { fontScale, increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();

  return (
    <div className="flex items-center gap-1.5 bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-1 md:p-1.5 shadow-lg select-none">
      <button
        onClick={decreaseFontSize}
        className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white transition-all duration-150 cursor-pointer"
        title="Disminuir tamaño de letra (Aa-)"
        aria-label="Disminuir tamaño de letra"
      >
        <ZoomOut size={18} className="md:w-5 md:h-5" />
      </button>
      
      <div 
        className="px-2 md:px-3 text-xs md:text-sm font-bold text-slate-300 min-w-[50px] text-center"
        title="Escala de visualización actual"
      >
        {Math.round(fontScale * 100)}%
      </div>

      <button
        onClick={increaseFontSize}
        className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white transition-all duration-150 cursor-pointer"
        title="Aumentar tamaño de letra (Aa+)"
        aria-label="Aumentar tamaño de letra"
      >
        <ZoomIn size={18} className="md:w-5 md:h-5" />
      </button>

      {fontScale !== 1.0 && (
        <button
          onClick={resetFontSize}
          className="flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-all duration-150 cursor-pointer border border-indigo-500/15"
          title="Restablecer tamaño normal"
          aria-label="Restablecer tamaño normal"
        >
          <RefreshCw size={14} className="md:w-4 md:h-4 animate-spin-hover" />
        </button>
      )}
    </div>
  );
};
