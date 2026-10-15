import React from "react";
import { Minus, Plus } from "lucide-react";
import { useFontSize } from "../../hooks/useFontSize";

/** Control de tamaño de letra de toda la app. */
export const FontSizeControl: React.FC = () => {
  const { fontScale, increaseFontSize, decreaseFontSize, resetFontSize } = useFontSize();
  const btn = "w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center justify-center";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={decreaseFontSize} className={btn} aria-label="Letra más pequeña">
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={resetFontSize}
        className="min-w-[56px] h-10 px-2 rounded-xl text-sm font-black text-slate-800 hover:bg-slate-100"
        title="Restablecer tamaño normal"
      >
        {Math.round(fontScale * 100)}%
      </button>
      <button type="button" onClick={increaseFontSize} className={btn} aria-label="Letra más grande">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
