import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { formatCurrency, formatFechaCorta, formatSoles } from "../../lib/formatters";
import { ESTILO_GRUPO } from "../../lib/cobranza";
import { resumirPrestamo, ResumenPrestamo } from "../../lib/resumenPrestamo";
import { hoyISO } from "../../lib/fechas";
import { DistribucionFinanciera } from "./clienteFinanzas";

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
  amortizaciones: any[];
  loading: boolean;
  error: string;
}

interface FilaPrestamo extends ResumenPrestamo {
  loan: any;
}

/** Préstamos del cliente con lo esencial de cada uno, con los mismos colores que la pantalla de Inicio. */
export const ClienteCreditos: React.FC<ClienteCreditosProps> = ({ loans, amortizaciones, loading, error }) => {
  const filas: FilaPrestamo[] = useMemo(() => {
    const hoy = hoyISO();
    return loans
      .map((loan) => ({ loan, ...resumirPrestamo(loan, amortizaciones.filter((a) => a.prestamo_id === loan.id), hoy) }))
      .sort(
        (a, b) =>
          Number(a.grupo === "liquidado") - Number(b.grupo === "liquidado") ||
          String(b.loan.fecha_emision).localeCompare(String(a.loan.fecha_emision))
      );
  }, [loans, amortizaciones]);

  const vigentes = filas.filter((f) => f.grupo !== "liquidado");
  const liquidados = filas.filter((f) => f.grupo === "liquidado");

  return (
    <Card variant="simple" className="space-y-3">
      <SectionTitle title="Préstamos" subtitle={`${vigentes.length} vigente${vigentes.length === 1 ? "" : "s"} · ${liquidados.length} liquidado${liquidados.length === 1 ? "" : "s"}`} />

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="animate-spin text-indigo-600 mb-3" size={24} />
          <p className="text-xs text-slate-500 font-semibold">Cargando préstamos...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl text-xs font-bold">{error}</div>
      ) : filas.length === 0 ? (
        <p className="text-center py-10 text-slate-500 text-sm font-semibold border border-dashed border-slate-200 rounded-2xl">
          Este cliente aún no tiene préstamos.
        </p>
      ) : (
        <ul className="space-y-2">
          {filas.map((f) => {
            const estilo = f.grupo === "liquidado" ? null : ESTILO_GRUPO[f.grupo];
            const esAtraso = f.grupo === "atrasado" || f.grupo === "estancado";
            return (
              <li key={f.loan.id}>
                <Link
                  to={`/prestamos/${f.loan.id}`}
                  className={`block border rounded-2xl p-3 decoration-none ${estilo ? estilo.tarjeta : "bg-slate-50 border-slate-200 opacity-80"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${estilo ? estilo.pill : "bg-slate-200 text-slate-600"}`}>
                      {estilo ? estilo.etiqueta : "Liquidado"}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 truncate">
                      {f.loan.tipo_prestamo} · {formatSoles(f.loan.monto_capital)} al {f.loan.tasa_interes_porcentaje}% · desde {formatFechaCorta(f.loan.fecha_emision)}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                  {f.grupo !== "liquidado" && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                      <Dato label="Capital" valor={formatSoles(f.capitalRestante)} />
                      <Dato label="Interés/mes" valor={f.congelado ? "Congelado" : formatSoles(f.interesMes)} />
                      <Dato
                        label={esAtraso ? `Atrasado (${f.cuotasAtrasadas})` : `Cobrar ${f.fecha ? formatFechaCorta(f.fecha) : ""}`}
                        valor={formatSoles(f.aCobrar)}
                        fuerte
                      />
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};

const Dato: React.FC<{ label: string; valor: string; fuerte?: boolean }> = ({ label, valor, fuerte }) => (
  <div className={`rounded-xl px-2 py-1.5 ${fuerte ? "bg-white shadow-sm" : "bg-white/60"}`}>
    <p className="text-[9.5px] font-bold text-slate-500 uppercase truncate">{label}</p>
    <p className={`font-mono leading-tight ${fuerte ? "text-sm font-black text-slate-900" : "text-xs font-bold text-slate-700"}`}>{valor}</p>
  </div>
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

/** Barras de recuperación de capital, interés e interés atrasado del cliente. */
export const ClienteDistribucionCard: React.FC<{ data: DistribucionFinanciera | null }> = ({ data }) => {
  if (!data || data.capitalTotal <= 0) return null;
  return (
    <Card variant="simple" className="p-5 space-y-4">
      <div>
        <h3 className="font-black text-slate-800 text-sm tracking-tight leading-none">📊 Distribución de Amortización Acumulada</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
          Estado total de recuperación de capital, intereses e interés atrasado del cliente (excluye Alquileres)
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
          label="Interés atrasado cobrado"
          parte={data.interesAtrasadoPagado}
          total={data.interesAtrasadoTotal}
          pct={data.atrasadoPct}
          textClass="text-amber-700"
          barClass="bg-amber-500"
        />
      </div>
    </Card>
  );
};
