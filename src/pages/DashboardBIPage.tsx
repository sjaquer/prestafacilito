import React, { useState, useEffect, useCallback } from "react";
import { 
  BarChart3, TrendingUp, DollarSign, Wallet, AlertTriangle, 
  Users, CheckCircle2, RefreshCw, ArrowUpRight, Home, ShieldCheck 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScoreBadge } from "../components/ui/ScoreBadge";

interface BiResumenData {
  kpis: {
    capitalEnCirculacion: number;
    saldoPendienteTotal: number;
    cobradoMesActual: number;
    cobradoMesAnterior: number;
    prestamosActivosCount: number;
    prestamosPagadosCount: number;
    prestamosAtrasadosCount: number;
    totalClientes: number;
    alquileresActivos: number;
  };
  historialCobros: Array<{
    mes: string;
    cobrado: number;
  }>;
  top5Clientes: Array<{
    id: string;
    nombre: string;
    apodo: string;
    capitalActivo: number;
    prestamosActivos: number;
    score: "A" | "B" | "C" | null;
    scoreSobreescrito?: boolean;
  }>;
}

export const DashboardBIPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<BiResumenData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const loadBiData = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/bi/resumen");
      if (!res.ok) {
        throw new Error("No se pudieron obtener las estadísticas de BI");
      }
      const biData = await res.json();
      setData(biData);
    } catch (err: any) {
      setErrorMsg(err.message || "Error de red al conectar con el servidor BI");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBiData();
  }, [loadBiData]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Calculando métricas BI en tiempo real...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl space-y-3">
        <p className="text-sm font-bold text-red-800">{errorMsg || "Error al cargar las métricas gerenciales"}</p>
        <button
          onClick={loadBiData}
          className="px-3.5 py-2 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const { kpis, historialCobros, top5Clientes } = data;
  const maxCobrado = Math.max(...historialCobros.map((d) => d.cobrado), 1);

  const diffMes = kpis.cobradoMesActual - kpis.cobradoMesAnterior;
  const pctDiff = kpis.cobradoMesAnterior > 0 ? (diffMes / kpis.cobradoMesAnterior) * 100 : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Principal de BI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-semibold">
              Fase 10 — Dashboard BI
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <BarChart3 className="w-3.5 h-3.5" /> Métricas Reales en Tiempo Real
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Estadísticas y Dashboard BI</h1>
          <p className="text-xs text-slate-300">
            Resumen gerencial de capital en circulación, cobranzas históricas y salud financiera.
          </p>
        </div>

        <button
          onClick={loadBiData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold rounded-xl transition-all shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Seccion 1 — KPIs Principales (4 Tarjetas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Capital en Circulación */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Capital en Circulación
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            S/ {kpis.capitalEnCirculacion.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            S/ {kpis.saldoPendienteTotal.toFixed(2)} exigibles totales
          </p>
        </div>

        {/* KPI 2: Cobrado Mes Actual */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Cobrado Mes Actual
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600">
            S/ {kpis.cobradoMesActual.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            {diffMes >= 0 ? (
              <span className="text-emerald-600 font-bold">+{pctDiff.toFixed(1)}%</span>
            ) : (
              <span className="text-red-600 font-bold">{pctDiff.toFixed(1)}%</span>
            )}
            <span>vs. mes anterior (S/ {kpis.cobradoMesAnterior.toFixed(2)})</span>
          </p>
        </div>

        {/* KPI 3: Préstamos Activos vs Vencidos */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Operaciones Activas
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            {kpis.prestamosActivosCount} préstamos
          </div>
          <p className="text-[11px] font-semibold flex items-center gap-1 text-slate-500">
            {kpis.prestamosAtrasadosCount > 0 ? (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {kpis.prestamosAtrasadosCount} atrasados
              </span>
            ) : (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 100% al día
              </span>
            )}
          </p>
        </div>

        {/* KPI 4: Alquileres y Clientes */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Clientes & Alquileres
            </span>
            <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            {kpis.totalClientes} prestatarios
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            {kpis.alquileresActivos} inmuebles en alquiler activos
          </p>
        </div>
      </div>

      {/* Sección 2 y 3 — Gráfica de Barras SVG + Top 5 Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Gráfica de Barras SVG (Últimos 6 Meses) (Tarea 10.2.4) */}
        <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Cobranza Histórica Mensual</h3>
              <p className="text-xs text-slate-500">Últimos 6 meses (Amortizaciones + Alquileres)</p>
            </div>
          </div>

          <div className="py-4">
            <svg viewBox="0 0 600 220" className="w-full h-auto max-h-[260px] overflow-visible">
              {/* Líneas horizontales de guía */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="70" x2="580" y2="70" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="120" x2="580" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="170" x2="580" y2="170" stroke="#e2e8f0" strokeWidth="1" />

              {/* Dibujo de Barras */}
              {historialCobros.map((item, idx) => {
                const height = (item.cobrado / maxCobrado) * 140;
                const barHeight = Math.max(height, 4);
                const x = idx * 90 + 65;
                const y = 170 - barHeight;

                return (
                  <g key={item.mes} className="group cursor-pointer">
                    {/* Barra de Cobro */}
                    <rect
                      x={x}
                      y={y}
                      width="42"
                      height={barHeight}
                      rx="6"
                      className="fill-indigo-600 hover:fill-indigo-700 transition-all duration-300"
                    />

                    {/* Texto Monto sobre la barra */}
                    <text
                      x={x + 21}
                      y={y - 6}
                      textAnchor="middle"
                      className="text-[10px] font-extrabold fill-slate-700"
                    >
                      S/ {item.cobrado >= 1000 ? `${(item.cobrado / 1000).toFixed(1)}k` : item.cobrado.toFixed(0)}
                    </text>

                    {/* Etiqueta del Mes abajo */}
                    <text
                      x={x + 21}
                      y="190"
                      textAnchor="middle"
                      className="text-[11px] font-bold fill-slate-500"
                    >
                      {item.mes}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Ranking Top 5 Clientes por Capital (Tarea 10.2.4) */}
        <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Top 5 Prestatarios</h3>
              <p className="text-xs text-slate-500">Ordenados por capital activo expuesto</p>
            </div>
          </div>

          <div className="space-y-3">
            {top5Clientes.length === 0 ? (
              <p className="text-xs text-slate-500 font-medium py-6 text-center">
                No hay préstamos activos registrados.
              </p>
            ) : (
              top5Clientes.map((c, idx) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="p-3 bg-slate-50 border border-slate-200/80 hover:border-indigo-300 rounded-xl text-xs flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-white"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="w-5 h-5 bg-slate-900 text-white rounded-md text-[10px] font-extrabold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="truncate">
                      <span className="font-extrabold text-slate-900 block truncate">
                        {c.nombre}
                      </span>
                      {c.apodo && (
                        <span className="text-[10px] text-slate-500 italic font-semibold">
                          ({c.apodo})
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <ScoreBadge score={c.score} sobreescrito={c.scoreSobreescrito} size="sm" />
                    <div className="text-right">
                      <span className="font-extrabold text-slate-900 block">
                        S/ {c.capitalActivo.toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {c.prestamosActivos} activo(s)
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardBIPage;
