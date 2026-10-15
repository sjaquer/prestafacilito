import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency } from "../../lib/formatters";
import { DistribucionFinanciera } from "./clienteFinanzas";

const ESTADO_PRESTAMO: Record<string, { label: string; variant: "success" | "neutral" | "danger" }> = {
  activo: { label: "Activo", variant: "success" },
  estancado: { label: "Estancado", variant: "danger" },
  pagado: { label: "Pagado", variant: "neutral" },
};

const SectionTitle: React.FC<{ title: React.ReactNode; subtitle: string }> = ({ title, subtitle }) => (
  <>
    <div>
      <h3 className="font-black text-slate-900 text-base tracking-tight leading-none flex items-center gap-2">{title}</h3>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">{subtitle}</p>
    </div>
    <div className="border-t border-slate-200/80" />
  </>
);

interface ClienteCreditosProps {
  loans: any[];
  loading: boolean;
  error: string;
}

/** Tabla con los préstamos del cliente. */
export const ClienteCreditos: React.FC<ClienteCreditosProps> = ({ loans, loading, error }) => (
  <Card variant="simple" className="space-y-4">
    <SectionTitle title="Cartera de Créditos" subtitle="Historial de financiamientos y saldos exigibles" />

    {loading ? (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="animate-spin text-indigo-650 mb-3" size={24} />
        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cargando deudas del prestatario...</p>
      </div>
    ) : error ? (
      <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-bold leading-normal">
        {error}
      </div>
    ) : loans.length === 0 ? (
      <div className="text-center py-16 text-slate-500 text-xs md:text-sm font-semibold bg-slate-50/40 border border-dashed border-slate-200 rounded-3xl p-6 select-none">
        El cliente no cuenta con deudas u operaciones en el sistema.
      </div>
    ) : (
      <div className="w-full overflow-x-auto border border-slate-200 bg-white rounded-2xl shadow-sm">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {["Código", "Monto", "Frecuencia / Tasa", "Estado"].map((h) => (
                <th key={h} className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  {h}
                </th>
              ))}
              <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Ver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loans.map((loan) => {
              const estado = ESTADO_PRESTAMO[loan.estado] || ESTADO_PRESTAMO.pagado;
              return (
                <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3 text-xs font-mono font-bold text-indigo-650">{loan.id.slice(0, 8).toUpperCase()}</td>
                  <td className="p-3 text-xs font-mono font-extrabold text-slate-800">{formatCurrency(loan.monto_capital)}</td>
                  <td className="p-3 text-xs font-semibold text-slate-600">
                    {loan.tipo_prestamo === "Alquiler de Casa" ? (
                      <span>Alquiler (Día {parseInt(loan.fecha_emision.split("-")[2])} c/mes)</span>
                    ) : (
                      <span>
                        {loan.tipo_prestamo} ({loan.tasa_interes_porcentaje}%)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <Badge variant={estado.variant}>{estado.label}</Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      to={`/prestamos/${loan.id}`}
                      aria-label="Ver préstamo"
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition inline-flex items-center justify-center shrink-0 border border-slate-200 decoration-none cursor-pointer"
                    >
                      <ArrowUpRight size={13} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </Card>
);

/** Lista de contratos de alquiler del cliente. */
export const ClienteAlquileres: React.FC<{ alquileres: any[] }> = ({ alquileres }) => {
  if (alquileres.length === 0) return null;
  return (
    <Card variant="simple" className="space-y-4">
      <SectionTitle title="🏠 Contratos de Alquiler" subtitle="Contratos de arrendamiento activos e históricos del cliente" />
      <div className="space-y-2">
        {alquileres.map((alq) => (
          <Link
            key={alq.id}
            to={`/alquileres/${alq.id}`}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3 transition decoration-none"
          >
            <div>
              <span className="font-extrabold text-slate-900 block">
                {alq.descripcion_inmueble || "Inmueble sin descripción"}
              </span>
              <span className="text-slate-500 font-medium">
                Renta: {formatCurrency(alq.monto_mensual)}/mes
                {alq.fecha_inicio && ` • Día ${parseInt(alq.fecha_inicio.split("-")[2])} c/mes`}
              </span>
            </div>
            <Badge variant={alq.estado === "activo" ? "success" : "neutral"}>
              {alq.estado === "activo" ? "Activo" : "Finalizado"}
            </Badge>
          </Link>
        ))}
      </div>
    </Card>
  );
};

const BarraProgreso: React.FC<{ label: string; parte: number; total: number; pct: number; textClass: string; barClass: string }> = ({
  label,
  parte,
  total,
  pct,
  textClass,
  barClass,
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center text-xs gap-2">
      <span className="text-slate-500 font-bold uppercase">{label}</span>
      <span className={`${textClass} font-black font-mono text-right`}>
        {formatCurrency(parte)} / {formatCurrency(total)} ({pct.toFixed(1)}%)
      </span>
    </div>
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
      <div className={`h-full rounded-full ${barClass} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  </div>
);

/** Barras de recuperación de capital, interés y mora del cliente. */
export const ClienteDistribucionCard: React.FC<{ data: DistribucionFinanciera | null }> = ({ data }) => {
  if (!data || data.capitalTotal <= 0) return null;
  return (
    <Card variant="simple" className="p-5 space-y-4">
      <div>
        <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none">📊 Distribución de Amortización Acumulada</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
          Estado total de recuperación de capital, intereses y mora del cliente (excluye Alquileres)
        </p>
      </div>
      <div className="border-t border-slate-200/60 pt-3 grid grid-cols-1 md:grid-cols-3 gap-5">
        <BarraProgreso
          label="Capital Recuperado"
          parte={data.capitalAmortizado}
          total={data.capitalTotal}
          pct={data.capitalPct}
          textClass="text-emerald-700"
          barClass="bg-emerald-500"
        />
        <BarraProgreso
          label="Interés Cobrado"
          parte={data.interesPagado}
          total={data.interesTotal}
          pct={data.interesPct}
          textClass="text-indigo-700"
          barClass="bg-indigo-500"
        />
        <BarraProgreso
          label="Mora Cobrada"
          parte={data.moraPagado}
          total={data.moraTotal}
          pct={data.moraPct}
          textClass="text-amber-700"
          barClass="bg-amber-500"
        />
      </div>
    </Card>
  );
};
