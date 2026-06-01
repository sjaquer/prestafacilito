import React, { useMemo } from "react";
import { Card } from "../ui/Card";
import { formatCurrency } from "../../lib/formatters";
import { Amortizacion } from "../../types";

interface MonthlyTrendChartProps {
  amortizaciones: Amortizacion[];
}

export const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ amortizaciones }) => {
  const chartData = useMemo(() => {
    const monthsData: { label: string; yearMonth: string; total: number }[] = [];
    const now = new Date();

    // Generar los últimos 6 meses cronológicos
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("es-ES", { month: "short" }).toUpperCase();
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthsData.push({ label, yearMonth, total: 0 });
    }

    // Agrupar amortizaciones por mes
    amortizaciones.forEach((a) => {
      if (!a.fecha_pago) return;
      const [year, month] = a.fecha_pago.split("-");
      const key = `${year}-${month}`;
      const found = monthsData.find((m) => m.yearMonth === key);
      if (found) {
        found.total += parseFloat(String(a.monto)) || 0;
      }
    });

    return monthsData;
  }, [amortizaciones]);

  const maxVal = useMemo(() => {
    const highest = Math.max(...chartData.map((d) => d.total));
    return highest > 0 ? highest * 1.15 : 1000; // Agregar un margen del 15% arriba
  }, [chartData]);

  // SVG Dimensiones
  const width = 500;
  const height = 200;
  const paddingX = 40;
  const paddingY = 30;

  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  return (
    <Card variant="bento" className="w-full select-none font-sans">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <span className="dashboard-chip text-indigo-300 border-indigo-500/15 bg-indigo-500/10 mb-2 w-fit">Cobros</span>
          <h3 className="font-black text-white text-base tracking-tight">Tendencia de cobros mensuales</h3>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
            Ingresos recolectados en los últimos 6 meses
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5">Vista ejecutiva</span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/15">Actualizada</span>
        </div>
      </div>

      <div className="relative w-full h-[220px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full text-slate-400"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Gradiente de las barras */}
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.2" />
            </linearGradient>
            {/* Efecto resplandor */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Gridlines horizontales */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = paddingY + graphHeight * (1 - ratio);
            const valLabel = maxVal * ratio;
            return (
              <g key={index} className="opacity-20">
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#ffffff"
                  strokeWidth="0.75"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[8px] font-mono fill-slate-450 font-bold"
                >
                  {valLabel >= 1000
                    ? `S/. ${(valLabel / 1000).toFixed(1)}k`
                    : `S/. ${valLabel.toFixed(0)}`}
                </text>
              </g>
            );
          })}

          {/* Barras y etiquetas */}
          {chartData.map((d, index) => {
            const count = chartData.length;
            const barWidth = 32;
            const spaceBetween = graphWidth / (count - 1 || 1);
            const x = paddingX + index * spaceBetween - barWidth / 2;

            const barRatio = d.total / maxVal;
            const barHeight = Math.max(4, graphHeight * barRatio);
            const y = paddingY + graphHeight - barHeight;

            return (
              <g key={d.yearMonth} className="group cursor-pointer">
                {/* Barra de fondo hoverable (zona táctil aumentada) */}
                <rect
                  x={x - 10}
                  y={paddingY}
                  width={barWidth + 20}
                  height={graphHeight}
                  fill="transparent"
                  className="hover:fill-white/[0.02] transition-colors duration-200"
                />

                {/* Barra real */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="6"
                  ry="6"
                  fill={d.total > 0 ? "url(#barGradient)" : "rgba(255,255,255,0.08)"}
                  className="transition-all duration-300 group-hover:filter group-hover:brightness-125"
                  style={{ filter: "drop-shadow(0px 0px 4px rgba(139, 92, 246, 0.15))" }}
                />

                {/* Resplandor superior de la barra */}
                {d.total > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={4}
                    rx="2"
                    ry="2"
                    fill="#f472b6"
                    className="opacity-60"
                  />
                )}

                {/* Texto del valor al hacer hover */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  {/* Fondo del tooltip */}
                  <rect
                    x={Math.max(5, Math.min(width - 95, x + barWidth / 2 - 45))}
                    y={y - 24}
                    width="90"
                    height="18"
                    rx="6"
                    fill="#080c16"
                    stroke="#8b5cf6"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.max(5, Math.min(width - 95, x + barWidth / 2 - 45)) + 45}
                    y={y - 12}
                    textAnchor="middle"
                    className="text-[9px] font-bold font-mono fill-white"
                  >
                    {formatCurrency(d.total)}
                  </text>
                </g>

                {/* Etiqueta del mes (Eje X) */}
                <text
                  x={x + barWidth / 2}
                  y={height - paddingY + 16}
                  textAnchor="middle"
                  className="text-[9px] font-black fill-slate-400 group-hover:fill-indigo-300 transition-colors duration-200"
                >
                  {d.label}
                </text>
              </g>
            );
          })}

          {/* Eje X Línea */}
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#ffffff"
            strokeWidth="1"
            className="opacity-10"
          />
        </svg>
      </div>
    </Card>
  );
};
