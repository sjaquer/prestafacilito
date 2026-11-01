import React, { useMemo, useState } from "react";
import { formatSoles } from "../../lib/formatters";

/**
 * Gráficos de Reportes hechos en HTML (no SVG escalado): el texto mantiene su tamaño en el celular.
 * Paleta validada (scripts/validate_palette de la guía dataviz): serie 1 azul, serie 2 naranja.
 */
export const COLOR_SERIE = ["#2a78d6", "#eb6834"] as const;
export const COLOR_ESTADO = { bien: "#0ca30c", aviso: "#fab219", critico: "#d03b3b" } as const;

export interface Serie {
  nombre: string;
  color: string;
}

/** "S/ 2.5K" en los ejes; el detalle exacto va en la lectura y en la tabla. */
const compacto = (n: number) =>
  n >= 1000 ? `S/ ${(n / 1000).toLocaleString("es-PE", { maximumFractionDigits: 1 })}K` : `S/ ${Math.round(n)}`;

/** Tope "redondo" del eje para que las marcas sean números limpios. */
function topeLimpio(max: number) {
  if (max <= 0) return 100;
  const pot = 10 ** Math.floor(Math.log10(max));
  const paso = [1, 2, 2.5, 5, 10].find((m) => m * pot >= max) || 10;
  return paso * pot;
}

interface ColumnasProps {
  datos: { etiqueta: string; valores: number[] }[];
  series: Serie[];
  /** Nombre de lo que se mide, para la tabla y lectores de pantalla. */
  medida: string;
}

/**
 * Columnas por mes (una serie o apiladas). Tocar o pasar el mouse por una columna muestra sus valores
 * arriba del gráfico; por defecto se muestra el último mes.
 */
export const ColumnasMensuales: React.FC<ColumnasProps> = ({ datos, series, medida }) => {
  const [sel, setSel] = useState<number | null>(null);
  const totales = datos.map((d) => d.valores.reduce((s, v) => s + v, 0));
  const tope = useMemo(() => topeLimpio(Math.max(...totales, 0)), [totales]);
  const i = sel ?? datos.length - 1;
  const actual = datos[i];

  if (datos.length === 0) return <p className="text-xs text-slate-500 py-6 text-center">Sin datos todavía.</p>;

  return (
    <div className="space-y-3">
      {/* Lectura del mes seleccionado */}
      <div className="flex items-end justify-between gap-3 min-h-[44px]" aria-live="polite">
        <div>
          <p className="text-[11px] font-bold text-slate-500">{actual.etiqueta}</p>
          <p className="text-xl font-black font-mono text-slate-900 leading-tight">{formatSoles(totales[i])}</p>
        </div>
        {series.length > 1 && (
          <div className="text-right space-y-0.5">
            {series.map((s, k) => (
              <p key={s.nombre} className="text-[11px] font-semibold text-slate-600 flex items-center justify-end gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                {s.nombre} <span className="font-mono font-bold text-slate-800">{formatSoles(actual.valores[k])}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Gráfico */}
      <div className="relative h-40 mt-4">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%` }}>
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-semibold text-slate-400 font-mono w-12 text-right -translate-y-1/2 leading-none">
              {compacto(tope * f)}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 right-14 flex items-end">
          {datos.map((d, k) => {
            const activo = k === i;
            return (
              <button
                key={d.etiqueta}
                type="button"
                onClick={() => setSel(k)}
                onMouseEnter={() => setSel(k)}
                aria-label={`${d.etiqueta}: ${formatSoles(totales[k])}`}
                aria-pressed={activo}
                className={`flex-1 h-full flex items-end justify-center rounded-lg transition-colors ${activo ? "bg-slate-100/70" : ""}`}
              >
                {/* Segmentos apilados, con 2 px de separación; solo el extremo superior redondeado */}
                <span className="w-6 flex flex-col-reverse gap-[2px]" style={{ height: `${(totales[k] / tope) * 100}%` }}>
                  {d.valores.map((v, s) =>
                    v > 0 ? (
                      <span
                        key={s}
                        className="w-full"
                        style={{
                          flexGrow: v,
                          background: series[s].color,
                          opacity: activo ? 1 : 0.55,
                          borderTopLeftRadius: s === d.valores.length - 1 || d.valores.slice(s + 1).every((x) => x <= 0) ? 4 : 0,
                          borderTopRightRadius: s === d.valores.length - 1 || d.valores.slice(s + 1).every((x) => x <= 0) ? 4 : 0,
                        }}
                      />
                    ) : null
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex pr-14">
        {datos.map((d, k) => (
          <span key={d.etiqueta} className={`flex-1 text-center text-[11px] font-bold ${k === i ? "text-slate-900" : "text-slate-400"}`}>
            {d.etiqueta.slice(0, 3)}
          </span>
        ))}
      </div>

      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.nombre} className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.nombre}
            </span>
          ))}
        </div>
      )}

      <details className="group">
        <summary className="text-[11px] font-bold text-indigo-600 cursor-pointer select-none py-1">Ver como tabla</summary>
        <table className="w-full mt-2 text-xs">
          <caption className="sr-only">{medida}</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400">
              <th className="text-left font-bold py-1">Mes</th>
              {series.length > 1 && series.map((s) => <th key={s.nombre} className="text-right font-bold py-1">{s.nombre}</th>)}
              <th className="text-right font-bold py-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d, k) => (
              <tr key={d.etiqueta} className="border-t border-slate-100">
                <td className="py-1.5 font-semibold text-slate-700">{d.etiqueta}</td>
                {series.length > 1 && d.valores.map((v, s) => <td key={s} className="py-1.5 text-right font-mono text-slate-600">{formatSoles(v)}</td>)}
                <td className="py-1.5 text-right font-mono font-bold text-slate-900">{formatSoles(totales[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

/** Un todo dividido en partes (ej. estado de la cartera), con leyenda de íconos y cantidades. */
export const BarraSegmentada: React.FC<{
  partes: { nombre: string; valor: number; color: string; icono: React.ReactNode }[];
  unidad: string;
}> = ({ partes, unidad }) => {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  return (
    <div className="space-y-3">
      <div className="flex h-3 gap-[2px] rounded-full overflow-hidden bg-slate-100" role="img" aria-label={partes.map((p) => `${p.nombre}: ${p.valor}`).join(", ")}>
        {total > 0 &&
          partes.filter((p) => p.valor > 0).map((p) => <span key={p.nombre} style={{ flexGrow: p.valor, background: p.color }} />)}
      </div>
      <ul className="space-y-1.5">
        {partes.map((p) => (
          <li key={p.nombre} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-slate-700">
              <span className="shrink-0" style={{ color: p.color }}>
                {p.icono}
              </span>
              {p.nombre}
            </span>
            <span className="font-mono font-bold text-slate-900">
              {p.valor} <span className="text-[11px] text-slate-400 font-sans font-semibold">{total > 0 ? `${Math.round((p.valor / total) * 100)}%` : ""}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500 font-semibold">
        {total} {unidad}
      </p>
    </div>
  );
};

/** Medidor de 0 a 100 %: la parte vacía es un tono claro del mismo color. */
export const Medidor: React.FC<{ porcentaje: number; etiqueta: string }> = ({ porcentaje, etiqueta }) => {
  const p = Math.max(0, Math.min(100, porcentaje));
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between">
        <span className="text-xs font-bold text-slate-600">{etiqueta}</span>
        <span className="text-2xl font-black font-mono text-slate-900 leading-none">{Math.round(p)}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "#cde2fb" }} role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={etiqueta}>
        <div className="h-full rounded-full" style={{ width: `${p}%`, background: COLOR_SERIE[0] }} />
      </div>
    </div>
  );
};
