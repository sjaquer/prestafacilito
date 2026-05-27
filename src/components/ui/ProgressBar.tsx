import React from "react";

interface ProgressBarProps {
  value: number; // 0 a 100
  max?: number;
  height?: "sm" | "md" | "lg";
  showLabel?: boolean;
  color?: "indigo" | "emerald" | "rose" | "warning";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  height = "md",
  showLabel = false,
  color = "indigo",
}) => {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  const heights = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  const colors = {
    indigo: "bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/20",
    emerald: "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20",
    rose: "bg-gradient-to-r from-rose-500 to-pink-500 shadow-rose-500/20",
    warning: "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20",
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {showLabel && (
        <div className="flex justify-between items-center text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-wider">
          <span>Progreso</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={`w-full bg-white/[0.04] border border-white/[0.03] rounded-full overflow-hidden ${heights[height]}`}>
        <div
          style={{ width: `${percentage}%` }}
          className={`h-full rounded-full transition-all duration-500 ease-out shadow-lg ${colors[color]}`}
        />
      </div>
    </div>
  );
};
