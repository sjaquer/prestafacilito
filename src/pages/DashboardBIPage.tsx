import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronRight, CircleSlash, TrendingDown, TrendingUp } from "lucide-react";
import { ScoreBadge } from "../components/ui/ScoreBadge";
import { ErrorState, Kpi, ListSkeleton, PageHeader, Panel, RefreshButton } from "../components/ui/Page";
import { BarraSegmentada, COLOR_ESTADO, COLOR_SERIE, ColumnasMensuales, Medidor } from "../components/reportes/Graficos";
import { formatCurrency, formatSoles } from "../lib/formatters";

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
  historialCobros: { mes: string; cobrado: number }[];
  distribucionIngresos: { mes: string; prestamos: number; alquileres: number }[];
  estadoCartera: { alDia: number; atrasados: number; estancados: number };
  controlInquilinos: {
    totalInmuebles: number;
    ocupados: number;
    desocupados: number;
    tasaOcupacion: number;
    rentasMesActual: number;
    rentasMesAnterior: number;
    alquileresAlDia: number;
    alquileresAtrasados: number;
  };
  top5Clientes: {
    id: string;
    nombre: string;
    apodo: string;
    capitalActivo: number;
    prestamosActivos: number;
    score: "A" | "B" | "C" | null;
    scoreSobreescrito?: boolean;
  }[];
}

/** Variación contra el mes anterior: flecha + porcentaje (nunca solo color). */
const Variacion: React.FC<{ actual: number; anterior: number }> = ({ actual, anterior }) => {
  if (anterior <= 0) return <>Sin datos del mes anterior</>;
  const pct = ((actual - anterior) / anterior) * 100;
  const sube = pct >= 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1">
      <Icono className={`w-3.5 h-3.5 ${sube ? "text-emerald-600" : "text-rose-600"}`} />
      <b className="text-slate-700">
        {sube ? "+" : ""}
        {pct.toFixed(0)}%
      </b>
      vs. mes anterior
    </span>
  );
};

/** Visión general del negocio: cuánto hay prestado, cuánto entra cada mes y quién debe más. */
export const DashboardBIPage: React.FC = () => {
  const [data, setData] = useState<BiResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/bi/resumen");
      if (!res.ok) throw new Error("No se pudieron obtener los reportes.");
      setData(await res.json());
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const header = (
    <PageHeader
      title="Reportes"
      icon={<BarChart3 className="w-6 h-6" />}
      subtitle="Resumen del negocio en tiempo real"
      actions={<RefreshButton onClick={cargar} loading={loading} />}
    />
  );

  if (error) {
    return (
      <div className="space-y-4 pb-12 max-w-6xl mx-auto">
        {header}
        <ErrorState mensaje={error} onReintentar={cargar} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4 pb-12 max-w-6xl mx-auto">
        {header}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <ListSkeleton filas={2} alto="h-64" />
      </div>
    );
  }

  const { kpis, historialCobros, distribucionIngresos, estadoCartera, controlInquilinos: inq, top5Clientes } = data;

  return (
    <div className="space-y-4 pb-12 max-w-6xl mx-auto">
      {header}

      {/* 1. Cifras principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Kpi
          label="Cobrado este mes"
          valor={formatCurrency(kpis.cobradoMesActual)}
          detalle={<Variacion actual={kpis.cobradoMesActual} anterior={kpis.cobradoMesAnterior} />}
          tono="text-emerald-700"
        />
        <Kpi label="Capital prestado" valor={formatCurrency(kpis.capitalEnCirculacion)} detalle={`${formatSoles(kpis.saldoPendienteTotal)} por cobrar`} />
        <Kpi
          label="Préstamos activos"
          valor={kpis.prestamosActivosCount}
          detalle={
            kpis.prestamosAtrasadosCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-rose-700">
                <AlertTriangle className="w-3 h-3" /> {kpis.prestamosAtrasadosCount} con atraso
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" /> Todos al día
              </span>
            )
          }
        />
        <Kpi label="Clientes" valor={kpis.totalClientes} detalle={`${kpis.alquileresActivos} alquiler${kpis.alquileresActivos === 1 ? "" : "es"} activo${kpis.alquileresActivos === 1 ? "" : "s"}`} />
      </div>

      {/* 2. Ingresos en el tiempo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Cobranza por mes" subtitle="Préstamos + alquileres, últimos 6 meses · toca una columna">
          <ColumnasMensuales
            medida="Cobranza mensual"
            series={[{ nombre: "Cobrado", color: COLOR_SERIE[0] }]}
            datos={historialCobros.map((h) => ({ etiqueta: h.mes, valores: [h.cobrado] }))}
          />
        </Panel>

        <Panel title="De dónde viene el dinero" subtitle="Préstamos vs. alquileres por mes · toca una columna">
          <ColumnasMensuales
            medida="Ingresos por tipo"
            series={[
              { nombre: "Préstamos", color: COLOR_SERIE[0] },
              { nombre: "Alquileres", color: COLOR_SERIE[1] },
            ]}
            datos={distribucionIngresos.map((d) => ({ etiqueta: d.mes, valores: [d.prestamos, d.alquileres] }))}
          />
        </Panel>
      </div>

      {/* 3. Estado y riesgo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel title="Estado de la cartera" subtitle="Clientes con préstamos activos">
          <BarraSegmentada
            unidad="clientes con préstamos activos"
            partes={[
              { nombre: "Al día", valor: estadoCartera.alDia, color: COLOR_ESTADO.bien, icono: <CheckCircle2 className="w-4 h-4" /> },
              { nombre: "Atrasados", valor: estadoCartera.atrasados, color: COLOR_ESTADO.aviso, icono: <AlertTriangle className="w-4 h-4" /> },
              { nombre: "Estancados", valor: estadoCartera.estancados, color: COLOR_ESTADO.critico, icono: <CircleSlash className="w-4 h-4" /> },
            ]}
          />
        </Panel>

        <Panel title="Alquileres" subtitle="Ocupación y rentas del mes">
          <Medidor porcentaje={inq.tasaOcupacion} etiqueta={`${inq.ocupados} de ${inq.totalInmuebles} inmuebles ocupados`} />
          <dl className="grid grid-cols-2 gap-2 pt-1">
            {[
              { k: "Rentas este mes", v: formatSoles(inq.rentasMesActual) },
              { k: "Mes anterior", v: formatSoles(inq.rentasMesAnterior) },
              { k: "Al día", v: inq.alquileresAlDia },
              { k: "Pendientes", v: inq.alquileresAtrasados },
            ].map((x) => (
              <div key={x.k} className="bg-slate-50 rounded-xl px-3 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{x.k}</dt>
                <dd className="text-sm font-black font-mono text-slate-900">{x.v}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Quién debe más" subtitle="Top 5 por capital activo">
          {top5Clientes.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No hay préstamos activos.</p>
          ) : (
            <ol className="-mx-2">
              {top5Clientes.map((c, idx) => (
                <li key={c.id}>
                  <Link
                    to={`/clientes/${c.id}`}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 decoration-none"
                  >
                    <span className="w-6 text-center text-xs font-black text-slate-400">{idx + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-slate-900 truncate">{c.nombre}</span>
                      <span className="block text-[11px] text-slate-500 font-semibold">
                        {c.prestamosActivos} préstamo{c.prestamosActivos === 1 ? "" : "s"}
                        {c.apodo ? ` · ${c.apodo}` : ""}
                      </span>
                    </span>
                    <ScoreBadge score={c.score} sobreescrito={c.scoreSobreescrito} size="sm" />
                    <span className="font-mono font-black text-sm text-slate-900">{formatSoles(c.capitalActivo)}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default DashboardBIPage;
