import React from "react";

interface ScoreBadgeProps {
  score?: "A" | "B" | "C" | null;
  sobreescrito?: boolean;
  size?: "sm" | "md" | "lg";
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  sobreescrito = false,
  size = "md"
}) => {
  if (!score) {
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-md text-[10px] font-bold">
        S/D
      </span>
    );
  }

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm font-extrabold"
  };

  const colors = {
    A: "bg-emerald-100 text-emerald-800 border-emerald-300",
    B: "bg-amber-100 text-amber-800 border-amber-300",
    C: "bg-red-100 text-red-800 border-red-300"
  };

  const labels = {
    A: "Excelente",
    B: "Aceptable",
    C: "Riesgo"
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-extrabold border rounded-md shadow-2xs ${colors[score]} ${sizeClasses[size]}`}
      title={`Score ${score}: ${labels[score]}${sobreescrito ? " (Sobreescrito manualmente)" : ""}`}
    >
      <span>Score: {score}</span>
      {sobreescrito && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" title="Score Manual" />
      )}
    </span>
  );
};
