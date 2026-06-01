import { useState, useEffect } from "react";
import { 
  Sparkles, 
  ArrowLeft, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp, 
  ShieldAlert, 
  Award, 
  Calendar, 
  ChevronRight, 
  Activity, 
  DollarSign,
  Percent,
  BarChart3,
  ListChecks,
  BellRing,
  MessageSquare,
  Send,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ReporteIAProps {
  onBack?: () => void;
}

type TabType = "cockpit" | "diagnostico" | "estrategias" | "alertas";

interface KPIItem {
  label: string;
  value: string;
  indicator: "up" | "down" | "stable";
  descripcion: string;
}

interface ProjectionItem {
  period: string;
  cobroEstimado: number;
  morosidadEstimada: number;
}

interface StrategyItem {
  titulo: string;
  descripcion: string;
  impacto: "Alto" | "Medio";
  prioridad: "Alta" | "Media" | "Baja";
}

interface OverdueLoanItem {
  cliente: string;
  capital: number | string;
  vencimiento: string;
  tipo?: string;
}

interface FinancialContext {
  totalClientes: number;
  totalPrestamos: number;
  prestamosActivosCount: number;
  prestamosPagadosCount: number;
  prestamosVencidosCount: number;
  resumenFinanciero: {
    totalCapitalPrestado: number;
    totalExigibleConIntereses: number;
    totalRecuperadoAmortizado: number;
    saldoPendienteCobro: number;
    porcentajeRecuperacion: number;
  };
  metodosPagoPopulares: Record<string, number>;
  prestamosVencidosDetalle: OverdueLoanItem[];
}

interface ReportData {
  fechaReporte?: string;
  saludFinanciera?: string;
  tasaMorosidadPorcentaje?: number;
  resumenDesempeño?: string;
  kpis?: KPIItem[];
  analisisDetallado?: {
    liquidez: string;
    riesgos: string;
    eficiencia: string;
  };
  proyeccionesCaja?: ProjectionItem[];
  estrategiasCobranza?: StrategyItem[];
  contextoFinanciero?: FinancialContext;
}

export function ReporteIA({ onBack }: ReporteIAProps) {
  const [activeTab, setActiveTab] = useState<TabType>("cockpit");
  const [report, setReport] = useState<ReportData | null>(() => {
    const saved = localStorage.getItem("presta_weekly_report");
    return saved ? (JSON.parse(saved) as ReportData) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para generador de WhatsApp por IA
  const [generatingMsgId, setGeneratingMsgId] = useState<string | null>(null);
  const [generatedMsgText, setGeneratedMsgText] = useState<Record<string, string>>({});

  const fetchReport = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/reporte-gerencial", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok) {
        setReport(data);
        localStorage.setItem("presta_weekly_report", JSON.stringify(data));
      } else {
        setError(data.error || "Ocurrió un error al obtener el informe.");
      }
    } catch (err) {
      setError("Error de comunicación con el servidor backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!report) {
      fetchReport();
    }
  }, [report]);

  const generateWhatsAppMessage = async (loan: OverdueLoanItem) => {
    setGeneratingMsgId(loan.cliente);
    try {
      const res = await fetch("/api/ai/mensaje-cobro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: loan.cliente,
          saldoPendiente: loan.capital,
          fechaVencimiento: loan.vencimiento
        })
      });
      const data = await res.json();
      if (res.ok && data.mensaje) {
        setGeneratedMsgText(prev => ({
          ...prev,
          [loan.cliente]: data.mensaje
        }));
      } else {
        alert("No se pudo generar el mensaje.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al contactar con la IA para redactar el mensaje.");
    } finally {
      setGeneratingMsgId(null);
    }
  };

  const formatCurrency = (amount: number | string) => {
    const numericAmount = typeof amount === "string" ? Number(amount) : amount;
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
  };

  const finCtx: FinancialContext = report?.contextoFinanciero || {
    totalClientes: 0,
    totalPrestamos: 0,
    prestamosActivosCount: 0,
    prestamosPagadosCount: 0,
    prestamosVencidosCount: 0,
    resumenFinanciero: {
      totalCapitalPrestado: 0,
      totalExigibleConIntereses: 0,
      totalRecuperadoAmortizado: 0,
      saldoPendienteCobro: 0,
      porcentajeRecuperacion: 0
    },
    metodosPagoPopulares: {},
    prestamosVencidosDetalle: [] as OverdueLoanItem[]
  };

  const totalCapital = finCtx.resumenFinanciero?.totalCapitalPrestado || 0;
  const totalExigible = finCtx.resumenFinanciero?.totalExigibleConIntereses || 0;
  const totalRecuperado = finCtx.resumenFinanciero?.totalRecuperadoAmortizado || 0;
  const saldoPendiente = finCtx.resumenFinanciero?.saldoPendienteCobro || 0;
  const porcentajeRecup = finCtx.resumenFinanciero?.porcentajeRecuperacion || 0;

  const tasaMorosidad = report?.tasaMorosidadPorcentaje ?? 
    (finCtx.prestamosActivosCount > 0 
      ? Math.round((finCtx.prestamosVencidosCount / finCtx.prestamosActivosCount) * 100) 
      : 0);

  const getRiskDetails = (tasa: number) => {
    if (tasa > 15) return { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", label: "RIESGO CRÍTICO", ringColor: "#f43f5e" };
    if (tasa > 5) return { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "RIESGO MODERADO", ringColor: "#f59e0b" };
    return { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "RIESGO BAJO", ringColor: "#10b981" };
  };

  const risk = getRiskDetails(tasaMorosidad);

  const metodos = finCtx.metodosPagoPopulares || {};
  const totalPagos = Object.values(metodos).reduce((sum: number, val: number) => sum + val, 0);
  const metodosList = Object.entries(metodos).map(([name, count]) => {
    const qty = count as number;
    const pct = totalPagos > 0 ? Math.round((qty / totalPagos) * 100) : 0;
    return { name, qty, pct };
  }).sort((a, b) => b.qty - a.qty);

  // SVG Area Chart Math
  const proyecciones: ProjectionItem[] = report?.proyeccionesCaja || [
    { period: "Semana 1", cobroEstimado: 0, morosidadEstimada: 0 },
    { period: "Semana 2", cobroEstimado: 0, morosidadEstimada: 0 },
    { period: "Semana 3", cobroEstimado: 0, morosidadEstimada: 0 },
    { period: "Semana 4", cobroEstimado: 0, morosidadEstimada: 0 }
  ];

  const maxCobro = Math.max(...proyecciones.map((projection) => projection.cobroEstimado || 0), 100);
  const maxVal = maxCobro > 0 ? maxCobro : 100;

  type GraphPoint = {
    x: number;
    y: number;
    label: string;
    value: number;
  };

  // Mapeo de coordenadas para el gráfico de área
  const graphPoints: GraphPoint[] = proyecciones.map((projection: ProjectionItem, idx: number) => {
    const x = 60 + idx * 115;
    const y = 150 - ((projection.cobroEstimado || 0) / maxVal) * 100;
    return { x, y, label: projection.period || `Sem ${idx + 1}`, value: projection.cobroEstimado || 0 };
  });

  const pathD = graphPoints.length > 0 
    ? `M ${graphPoints[0].x} ${graphPoints[0].y} ` + graphPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const areaD = graphPoints.length > 0
    ? `${pathD} L ${graphPoints[graphPoints.length - 1].x} 160 L ${graphPoints[0].x} 160 Z`
    : "";

  // Mapeo de coordenadas para el gráfico de morosidad proyectada (línea secundaria en rojo)
  const maxMora = Math.max(...proyecciones.map((projection) => projection.morosidadEstimada || 0), 10);
  const maxMoraVal = maxMora > 0 ? maxMora : 10;

  const graphMoraPoints: Array<{ x: number; y: number; value: number }> = proyecciones.map((projection: ProjectionItem, idx: number) => {
    const x = 60 + idx * 115;
    const y = 150 - ((projection.morosidadEstimada || 0) / maxMoraVal) * 80;
    return { x, y, value: projection.morosidadEstimada || 0 };
  });

  const topProjection = proyecciones.length > 0
    ? proyecciones.reduce((max, current) => (current.cobroEstimado > max.cobroEstimado ? current : max))
    : null;

  const pathMoraD = graphMoraPoints.length > 0
    ? `M ${graphMoraPoints[0].x} ${graphMoraPoints[0].y} ` + graphMoraPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ")
    : "";

  const tabClassName = (tab: TabType) =>
    `ai-tab flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
      activeTab === tab ? "ai-tab-active" : ""
    }`;

  return (
    <div id="ai-report-view" className="ai-shell space-y-6 max-w-6xl mx-auto pb-10">
      
      {/* Hero / Cabecera */}
      <div className="ai-hero rounded-[2rem] p-5 md:p-6 space-y-5 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_28%)]" />
        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
          <div className="flex items-start gap-3.5">
            {onBack && (
              <button
                onClick={onBack}
                className="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-2xl transition duration-150 cursor-pointer shadow-sm"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="ai-chip font-mono">
                  <Sparkles size={11} className="animate-pulse" />
                  Executive CFO AI v2.5
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em]">
                  Sincronización: {report?.fechaReporte || "Semanal"}
                </span>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Informe de Inteligencia Financiera
                </h1>
                <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                  Un cockpit ejecutivo para priorizar riesgos, visualizar caja y tomar decisiones de cobranza con contexto.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => fetchReport(true)}
            disabled={loading}
            className="w-full md:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-cyan-500 text-white font-extrabold text-xs rounded-2xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/15 disabled:opacity-50 min-h-[44px]"
          >
            <RefreshCw className={`shrink-0 ${loading ? "animate-spin" : ""}`} size={14} />
            <span>{loading ? "Calculando Diagnóstico..." : "Refrescar Auditoría de IA"}</span>
          </button>
        </div>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="ai-panel p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-1">Morosidad estimada</p>
            <p className="text-xl font-black text-white font-mono">{tasaMorosidad}%</p>
          </div>
          <div className="ai-panel p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-1">Recuperación</p>
            <p className="text-xl font-black text-white font-mono">{porcentajeRecup}%</p>
          </div>
          <div className="ai-panel p-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.18em] mb-1">Saldo pendiente</p>
            <p className="text-xl font-black text-white font-mono">{formatCurrency(saldoPendiente)}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="ai-panel p-4 border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="shrink-0 text-amber-400 animate-bounce" size={16} />
          <div>
            <span className="font-bold block">Error al generar informe con Inteligencia Artificial</span>
            <span className="opacity-95 leading-normal">{error}</span>
          </div>
        </div>
      )}

      {loading && !report ? (
        <div className="ai-panel flex flex-col items-center justify-center py-28 space-y-4 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl" />
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Sparkles className="text-emerald-400 animate-pulse" size={24} />
          </div>
          <div className="text-center space-y-1 relative z-10">
            <h4 className="text-sm font-extrabold text-white">Analizando métricas corporativas...</h4>
            <p className="text-xs text-slate-400 max-w-xs leading-normal">
              Gemini está evaluando los balances, deudas cruzadas y proyecciones de cobro de tus clientes.
            </p>
          </div>
        </div>
      ) : (
        report && (
          <div className="space-y-6">
            
            {/* Tab Navigation Menu */}
            <div className="ai-panel p-1.5 flex max-w-2xl overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab("cockpit")}
                className={tabClassName("cockpit")}
              >
                <BarChart3 size={14} />
                <span>CFO Cockpit</span>
              </button>
              
              <button
                onClick={() => setActiveTab("diagnostico")}
                className={tabClassName("diagnostico")}
              >
                <Award size={14} />
                <span>Diagnóstico Ejecutivo</span>
              </button>

              <button
                onClick={() => setActiveTab("estrategias")}
                className={tabClassName("estrategias")}
              >
                <ListChecks size={14} />
                <span>Estrategias de Cobranza</span>
              </button>

              <button
                onClick={() => setActiveTab("alertas")}
                className={`${tabClassName("alertas")} relative`}
              >
                <BellRing size={14} />
                <span>Alertas de Cartera</span>
                {finCtx.prestamosVencidosDetalle?.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white font-mono">
                    {finCtx.prestamosVencidosDetalle.length}
                  </span>
                )}
              </button>
            </div>

            {/* Contenido Dinámico de Pestañas */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                
                {/* 1. COCKPIT FINANCIERO */}
                {activeTab === "cockpit" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Sección Principal del Cockpit */}
                    <div className="lg:col-span-2 space-y-6">
                      
                      {/* KPIs del Negocio */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {report.kpis?.map((kpi: KPIItem, idx: number) => (
                          <div key={idx} className="bento-card p-5 rounded-2xl relative overflow-hidden group">
                            <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-2.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{kpi.label}</span>
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                                kpi.indicator === "up" ? "bg-emerald-500/10 text-emerald-400" :
                                kpi.indicator === "down" ? "bg-rose-500/10 text-rose-400" :
                                "bg-indigo-500/10 text-indigo-400"
                              }`}>
                                {kpi.indicator === "up" ? "▲" : kpi.indicator === "down" ? "▼" : "■"}
                              </span>
                            </div>
                            <span className="text-2xl font-black text-white block font-mono tracking-tight">{kpi.value}</span>
                            <p className="text-[10px] text-slate-455 leading-normal mt-1">{kpi.descripcion}</p>
                          </div>
                        ))}
                      </div>

                      {/* Gráfico de Proyección de Caja */}
                        <div className="ai-panel ai-panel-accent p-6 rounded-[1.75rem] relative overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-white/5 pb-4 mb-4">
                          <div>
                            <h3 className="font-black text-white text-sm">Flujo de Caja Proyectado a 4 Semanas</h3>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Proyección por IA en base a fechas de vencimiento</p>
                          </div>
                          <div className="flex gap-4 text-[10px] font-bold">
                            <span className="flex items-center gap-1.5 text-indigo-400">
                              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                              <span>Cobro Estimado (S/.)</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-400">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                              <span>Mora Estimada (%)</span>
                            </span>
                          </div>
                        </div>

                        {/* Contenedor del Gráfico SVG */}
                        <div className="relative w-full h-48 mt-2">
                          <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
                            {/* Gridlines */}
                            <line x1="50" y1="30" x2="450" y2="30" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                            <line x1="50" y1="70" x2="450" y2="70" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                            <line x1="50" y1="110" x2="450" y2="110" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="3" />
                            <line x1="50" y1="150" x2="450" y2="150" stroke="#1e293b" strokeWidth="0.5" />

                            <defs>
                              <linearGradient id="area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                              </linearGradient>
                              <linearGradient id="mora-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.15" />
                                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>

                            {/* Área Cobro */}
                            {graphPoints.length > 0 && (
                              <path d={areaD} fill="url(#area-grad)" />
                            )}

                            {/* Línea Cobro */}
                            {graphPoints.length > 0 && (
                              <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
                            )}

                            {/* Línea Mora */}
                            {graphMoraPoints.length > 0 && (
                              <path d={pathMoraD} fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="4" strokeLinecap="round" />
                            )}

                            {/* Puntos y Etiquetas Cobro */}
                            {graphPoints.map((pt, idx) => (
                              <g key={`c-${idx}`} className="group/dot cursor-pointer">
                                <circle cx={pt.x} cy={pt.y} r="4.5" fill="#0f172a" stroke="#6366f1" strokeWidth="3" />
                                <circle cx={pt.x} cy={pt.y} r="8" fill="#6366f1" opacity="0" className="hover:opacity-20 transition-opacity" />
                                <text x={pt.x} y={pt.y - 12} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" className="font-mono">
                                  {formatCurrency(pt.value)}
                                </text>
                                <text x={pt.x} y="168" fill="#64748b" fontSize="8" fontWeight="bold" textAnchor="middle">
                                  {pt.label}
                                </text>
                              </g>
                            ))}

                            {/* Puntos Mora */}
                            {graphMoraPoints.map((pt, idx) => (
                              <circle key={`m-${idx}`} cx={pt.x} cy={pt.y} r="3" fill="#f43f5e" />
                            ))}
                          </svg>
                        </div>
                        
                        <div className="mt-4 p-3 bg-white/[0.02] border border-white/5 rounded-2xl flex gap-2 items-start text-[11px] text-slate-350 leading-relaxed">
                          <Info className="text-emerald-400 shrink-0 mt-0.5" size={13} />
                            <p>
                            <strong>Insight Ejecutivo:</strong> La proyección indica que la **{topProjection?.period || "semana de mayor volumen"}** será el pico de recaudo más alto, acumulando una amortización estimada de cobro óptima. Se sugiere desplegar notificaciones masivas 48h antes de este lapso.
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* Columnas Financieras Laterales */}
                    <div className="space-y-6">
                      
                      {/* Gauge de Morosidad */}
                      <div className="bento-card p-6 rounded-3xl flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center block mb-4">
                          Tasa de Morosidad
                        </span>

                        <div className="relative w-44 h-24 flex items-center justify-center">
                          <svg className="w-full h-full" viewBox="0 0 100 50">
                            <path
                              d="M 10 50 A 40 40 0 0 1 90 50"
                              fill="none"
                              stroke="#1e293b"
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                            <path
                              d="M 10 50 A 40 40 0 0 1 90 50"
                              fill="none"
                              stroke={risk.ringColor}
                              strokeWidth="8"
                              strokeLinecap="round"
                              strokeDasharray="125.6"
                              strokeDashoffset={125.6 - (125.6 * Math.min(100, tasaMorosidad)) / 100}
                              className="transition-all duration-1000 ease-out"
                            />
                          </svg>
                          
                          <div className="absolute bottom-0 text-center">
                            <span className="text-3xl font-black text-white font-mono block leading-none">
                              {tasaMorosidad}%
                            </span>
                            <span className={`text-[9px] font-black tracking-widest uppercase block mt-1.5 ${risk.color}`}>
                              {risk.label}
                            </span>
                          </div>
                        </div>

                        <div className={`w-full mt-4 p-3 rounded-2xl border ${risk.bg} text-center`}>
                          <p className="text-[10.5px] font-semibold text-slate-350 leading-relaxed">
                            {tasaMorosidad > 15 
                              ? "Alta incidencia de mora. Prioriza congelar colocaciones nuevas y activar visitas domiciliarias."
                              : tasaMorosidad > 5
                              ? "Riesgo intermedio. Monitorea los plazos de la semana de inmediato."
                              : "Cartera saludable y sólida. Bajos niveles de morosidad permiten recolocación fluida."
                            }
                          </p>
                        </div>
                      </div>

                      {/* Círculo de Recuperación */}
                      <div className="bento-card p-6 rounded-3xl flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center block mb-4">
                          Eficiencia de Cobro
                        </span>

                        <div className="relative w-36 h-36 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="#1e293b"
                              strokeWidth="7"
                            />
                            <circle
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke="url(#emerald-grad)"
                              strokeWidth="8"
                              strokeDasharray="251.2"
                              strokeDashoffset={251.2 - (251.2 * Math.min(100, porcentajeRecup)) / 100}
                              strokeLinecap="round"
                              className="transition-all duration-1000 ease-out"
                            />
                            <defs>
                              <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#059669" />
                              </linearGradient>
                            </defs>
                          </svg>
                          
                          <div className="absolute text-center">
                            <span className="text-2xl font-black text-white font-mono leading-none block">
                              {porcentajeRecup}%
                            </span>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                              Recuperado
                            </span>
                          </div>
                        </div>

                        <div className="w-full mt-4 space-y-1.5 pt-3 border-t border-white/5">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-slate-400">Deuda Global Emitida:</span>
                            <span className="text-slate-200 font-mono">{formatCurrency(totalExigible)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-slate-400">Total Amortizado:</span>
                            <span className="text-emerald-400 font-mono font-bold">{formatCurrency(totalRecuperado)}</span>
                          </div>
                        </div>
                      </div>

                    </div>

                  </div>
                )}

                {/* 2. DIAGNÓSTICO EJECUTIVO */}
                {activeTab === "diagnostico" && (
                  <div className="space-y-6">
                    
                    {/* Diagnóstico Resumen */}
                    <div className="ai-panel ai-panel-accent p-6 rounded-[1.75rem] relative overflow-hidden group">
                      <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
                        <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center text-emerald-400">
                          <Award size={20} />
                        </div>
                        <div>
                          <h3 className="font-black text-white text-sm">Resumen Estratégico General</h3>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold font-mono">Dictamen de Cartera AI</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-slate-200 leading-relaxed">
                        {report.saludFinanciera}
                      </p>
                      {report.resumenDesempeño && (
                        <div className="mt-4 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                          <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block font-mono">Recomendación a la Dirección</span>
                          <p className="text-xs text-indigo-200 italic mt-1 leading-relaxed">
                            "{report.resumenDesempeño}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Desglose Detallado */}
                    {report.analisisDetallado && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        <div className="bento-card p-5 rounded-2xl border border-white/5 space-y-3 relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/70" />
                          <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs">
                            <Activity size={15} />
                            <span>1. ANÁLISIS DE LIQUIDEZ</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {report.analisisDetallado.liquidez}
                          </p>
                        </div>

                        <div className="bento-card p-5 rounded-2xl border border-white/5 space-y-3 relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/70" />
                          <div className="flex items-center gap-2 text-rose-400 font-extrabold text-xs">
                            <ShieldAlert size={15} />
                            <span>2. CONTROL DE IMPAGO & MORA</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {report.analisisDetallado.riesgos}
                          </p>
                        </div>

                        <div className="bento-card p-5 rounded-2xl border border-white/5 space-y-3 relative">
                          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/70" />
                          <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs">
                            <ShieldCheck size={15} />
                            <span>3. EFICIENCIA OPERATIVA</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {report.analisisDetallado.eficiencia}
                          </p>
                        </div>

                      </div>
                    )}

                    {/* Distribución de Métodos de Pago */}
                    <div className="ai-panel p-6 rounded-[1.75rem] max-w-2xl">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-4 text-center">
                        Distribución de Canales de Cobro Utilizados
                      </span>

                      <div className="space-y-4">
                        {metodosList.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-xs font-semibold">
                            Sin datos de abonos suficientes.
                          </div>
                        ) : (
                          metodosList.map((m, idx) => (
                            <div key={idx} className="space-y-1.5">
                              <div className="flex justify-between items-center text-[10px] font-extrabold uppercase">
                                <span className="text-slate-200">{m.name}</span>
                                <span className="text-indigo-400 font-mono">{m.qty} abono(s) ({m.pct}%)</span>
                              </div>
                              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-white/[0.02]">
                                <div
                                  className="bg-gradient-to-r from-indigo-500 to-indigo-650 h-full rounded-full transition-all duration-1000 ease-out"
                                  style={{ width: `${m.pct}%` }}
                                />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* 3. ESTRATEGIAS DE COBRANZA */}
                {activeTab === "estrategias" && (
                  <div className="space-y-5">
                    
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl text-xs flex items-start gap-2.5">
                      <Sparkles className="shrink-0 text-emerald-400 mt-0.5" size={16} />
                      <div>
                        <span className="font-bold block">Hoja de Ruta Estratégica</span>
                        <span className="opacity-90 leading-normal">
                          Estas medidas de contingencia y prevención han sido personalizadas en tiempo real por Gemini basándose en la salud del recaudo y los retrasos históricos.
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {report.estrategiasCobranza?.map((est: StrategyItem, idx: number) => (
                        <div key={idx} className="bento-card p-6 rounded-3xl border border-white/5 hover:border-white/10 transition-all duration-200 flex flex-col justify-between space-y-4">
                          
                          <div className="space-y-3">
                            <div className="flex justify-between items-start border-b border-white/5 pb-2.5 gap-2">
                              <span className="text-xs font-black text-white">{est.titulo}</span>
                              <div className="flex gap-1.5">
                                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase font-mono ${
                                  est.prioridad === "Alta" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                                  est.prioridad === "Media" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                  "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}>
                                  Prioridad: {est.prioridad}
                                </span>
                                <span className="text-[8px] font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-mono">
                                  Impacto: {est.impacto}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                              {est.descripcion}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="font-bold">Acción Recomendada #{idx + 1}</span>
                            <span className="text-emerald-500 font-extrabold flex items-center gap-1">
                              <CheckCircle2 size={11} />
                              <span>Ejecución Inmediata</span>
                            </span>
                          </div>

                        </div>
                      ))}
                    </div>

                  </div>
                )}

                {/* 4. ALERTAS DE CARTERA & WHATSAPP GENERATOR */}
                {activeTab === "alertas" && (
                  <div className="space-y-6">
                    
                    <div className="bento-card p-6 rounded-3xl">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
                        <ShieldAlert className="text-rose-400 animate-pulse shrink-0" size={18} />
                        <h4 className="text-xs font-black text-rose-300">Créditos Expirados en Alta Prioridad ({finCtx.prestamosVencidosDetalle?.length || 0})</h4>
                      </div>

                      {(!finCtx.prestamosVencidosDetalle || finCtx.prestamosVencidosDetalle.length === 0) ? (
                        <div className="text-center py-10 text-slate-500">
                          <ShieldCheck className="mx-auto text-emerald-500 mb-2.5" size={32} />
                          <p className="text-sm font-bold text-slate-300">¡Ningún préstamo vencido en la cartera!</p>
                          <p className="text-xs text-slate-500 mt-0.5">Todos los clientes activos están dentro de sus plazos de pago ordinarios.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {finCtx.prestamosVencidosDetalle.map((p: OverdueLoanItem, idx: number) => (
                            <div 
                              key={idx} 
                              className="p-4 bg-[#0f172a]/80 border border-rose-500/10 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-rose-500/25"
                            >
                              <div className="space-y-1">
                                <span className="font-extrabold text-slate-205 block text-sm">{p.cliente}</span>
                                <div className="flex flex-wrap gap-2 items-center text-[10.5px]">
                                  <span className="text-slate-400 font-medium">{p.tipo || "Personal"}</span>
                                  <span className="text-slate-600 font-bold">•</span>
                                  <span className="text-rose-400 font-semibold flex items-center gap-1">
                                    <TrendingDown size={11} />
                                    <span>Venció el {p.vencimiento}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-4">
                                <div className="text-right">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase block">Saldo Vencido</span>
                                  <span className="text-rose-400 font-mono font-bold text-sm">{formatCurrency(Number(p.capital) || 0)}</span>
                                </div>

                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                  {generatedMsgText[p.cliente] ? (
                                    <div className="space-y-1.5">
                                      <a
                                        href={`https://web.whatsapp.com/send?text=${encodeURIComponent(generatedMsgText[p.cliente])}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full px-3 py-2 bg-emerald-650 hover:bg-emerald-550 text-white font-extrabold text-[10px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <Send size={11} />
                                        <span>Enviar por WhatsApp</span>
                                      </a>
                                      <button
                                        onClick={() => generateWhatsAppMessage(p)}
                                        className="w-full text-center text-[9px] font-bold text-slate-500 hover:text-slate-300 underline cursor-pointer"
                                      >
                                        Redactar otra opción
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => generateWhatsAppMessage(p)}
                                      disabled={generatingMsgId === p.cliente}
                                      className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-cyan-500 text-white font-extrabold text-[10.5px] rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/20 disabled:opacity-50 min-h-[36px]"
                                    >
                                      {generatingMsgId === p.cliente ? (
                                        <>
                                          <RefreshCw className="animate-spin text-purple-200" size={12} />
                                          <span>Redactando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <MessageSquare size={12} />
                                          <span>Redactar Cobro IA</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Vista previa del mensaje redactado */}
                              {generatedMsgText[p.cliente] && (
                                <div className="w-full md:hidden mt-2 p-3 bg-black/35 rounded-xl border border-white/5">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">Recordatorio Formateado</span>
                                  <p className="text-[10px] text-slate-300 whitespace-pre-wrap italic font-semibold leading-relaxed">
                                    "{generatedMsgText[p.cliente]}"
                                  </p>
                                </div>
                              )}

                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pre-visualización global de mensajes generados (Desktop) */}
                    {Object.keys(generatedMsgText).length > 0 && (
                      <div className="hidden md:block bento-card p-5 rounded-3xl max-w-2xl border border-emerald-500/10">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                          <CheckCircle2 size={13} />
                          <span>Mensajes de Cobro Redactados por Gemini ({Object.keys(generatedMsgText).length})</span>
                        </span>
                        
                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                          {Object.entries(generatedMsgText).map(([name, text]) => (
                            <div key={name} className="p-3 bg-black/20 border border-white/5 rounded-2xl space-y-1.5 text-xs">
                              <span className="font-extrabold text-slate-350 block">Destinatario: {name}</span>
                              <p className="text-[11px] text-slate-300 font-medium italic leading-relaxed whitespace-pre-wrap bg-white/[0.01] p-2.5 rounded-xl border border-white/3">
                                "{text}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )}

              </motion.div>
            </AnimatePresence>

          </div>
        )
      )}

    </div>
  );
}
