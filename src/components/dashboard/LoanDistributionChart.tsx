import React, { useMemo } from "react";
import { Card } from "../ui/Card";

interface LoanDistributionChartProps {
  activeCount: number;
  paidCount: number;
  overdueCount: number;
}

export const LoanDistributionChart: React.FC<LoanDistributionChartProps> = ({
  activeCount,
  paidCount,
  overdueCount,
}) => {
  const total = activeCount + paidCount + overdueCount;

  const data = useMemo(() => {
    if (total === 0) return [];
    return [
      { label: "Activos", count: activeCount, pct: (activeCount / total) * 100, color: "#6366f1", strokeClass: "stroke-indigo-500", textClass: "text-indigo-600" },
      { label: "Pagados", count: paidCount, pct: (paidCount / total) * 100, color: "#10b981", strokeClass: "stroke-emerald-500", textClass: "text-emerald-700" },
      { label: "En Mora", count: overdueCount, pct: (overdueCount / total) * 100, color: "#f43f5e", strokeClass: "stroke-rose-500", textClass: "text-rose-600" },
    ];
  }, [activeCount, paidCount, overdueCount, total]);

  // SVG parameters for donut
  const size = 120;
  const radius = 40;
  const strokeWidth = 10;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius; // 251.32

  const segments = useMemo(() => {
    let accumulatedCircumference = 0;
    return data.map((seg) => {
      const strokeLength = (seg.pct / 100) * circumference;
      const strokeOffset = circumference - strokeLength + accumulatedCircumference;
      accumulatedCircumference -= strokeLength;
      return {
        ...seg,
        strokeLength,
        strokeOffset,
      };
    });
  }, [data, circumference]);

  return (
    <Card variant="bento" className="w-full select-none font-sans flex flex-col h-full justify-between">
      <div className="flex items-end justify-between gap-3 mb-1">
        <div>
          <span className="badge bg-fuchsia-50 border border-fuchsia-200 text-fuchsia-700 w-fit mb-2">Cartera</span>
          <h3 className="font-black text-slate-800 text-base tracking-tight">Distribución de préstamos</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Estado actual de la cartera de créditos
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end text-[10px] font-black uppercase tracking-widest text-slate-500">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600">Total {total}</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around my-auto gap-5 py-3">
        {/* Gráfico Donut SVG */}
        <div className="relative" style={{ width: size, height: size }}>
          {total === 0 ? (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth={strokeWidth}
              />
            </svg>
          ) : (
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ transform: "rotate(-90deg)", overflow: "visible" }}
            >
              <defs>
                {/* Sombras suaves para los aros */}
                <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Círculo de fondo oscuro */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />

              {segments.map((seg, idx) => (
                <circle
                  key={idx}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="transparent"
                  className={`${seg.strokeClass} transition-all duration-700 ease-out`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${seg.strokeLength} ${circumference}`}
                  strokeDashoffset={seg.strokeOffset}
                  strokeLinecap="round"
                  filter="url(#ringGlow)"
                  style={{
                    transformOrigin: "center",
                  }}
                />
              ))}
            </svg>
          )}

          {/* Texto central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center font-sans">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total</span>
            <span className="text-xl font-black text-slate-800 leading-none font-mono mt-0.5">{total}</span>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-3xl p-4 shrink-0 min-w-[150px] w-full sm:w-auto">
          {total === 0 ? (
            <div className="text-[10px] font-bold text-slate-500 py-1 text-center">
              Sin préstamos registrados
            </div>
          ) : (
            data.map((seg, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold leading-none">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-slate-550 text-[10px] uppercase font-black">{seg.label}</span>
                </div>
                <div className="text-right font-mono font-black ml-3">
                  <span className="text-slate-800 block text-[11px]">{seg.count}</span>
                  <span className={`block text-[8px] font-bold ${seg.textClass}`}>{seg.pct.toFixed(0)}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};
