import React from "react";
import { useNavigate } from "react-router-dom";
import { Home as HomeIcon } from "lucide-react";
import { ESTILO_GRUPO } from "../../lib/cobranza";
import { formatFechaCorta, formatSoles } from "../../lib/formatters";
import { textoRelativo } from "../../lib/fechas";
import { ItemCobro } from "./tipos";

/**
 * Vista de tabla de los cobros: explica cada estado con sus datos (último pago, desde cuándo debe,
 * cuántas cuotas faltan, qué vence y cuánto cobrar). Solo muestra lo que ya calcula el sistema.
 */
export const TablaCobros: React.FC<{ items: ItemCobro[] }> = ({ items }) => {
  const navigate = useNavigate();
  const abrir = (it: ItemCobro) => navigate(it.es_alquiler ? `/alquileres/${it.id}` : `/prestamos/${it.id}`);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left font-bold px-3 py-2.5">Cliente</th>
              <th className="text-left font-bold px-3 py-2.5">Estado</th>
              <th className="text-left font-bold px-3 py-2.5">Último pago</th>
              <th className="text-left font-bold px-3 py-2.5">Debe desde</th>
              <th className="text-center font-bold px-3 py-2.5">Sin pagar</th>
              <th className="text-left font-bold px-3 py-2.5">Próximo vence</th>
              <th className="text-right font-bold px-3 py-2.5">Atrasado</th>
              <th className="text-right font-bold px-3 py-2.5">Cobrar</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const estilo = ESTILO_GRUPO[it.grupo];
              const esAtraso = it.grupo === "atrasado" || it.grupo === "estancado";
              const unidad = it.es_alquiler ? "mes" : "cuota";
              return (
                <tr
                  key={`${it.es_alquiler ? "a" : "p"}-${it.id}`}
                  onClick={() => abrir(it)}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {it.es_alquiler && <HomeIcon className="w-3 h-3 text-teal-600 shrink-0" />}
                      <span className="truncate max-w-[13rem]">{it.cliente_nombre}</span>
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate max-w-[13rem]">
                      {it.es_alquiler ? it.descripcion_inmueble : `${it.tipo} · ${it.tasa}% · capital ${formatSoles(it.capital_restante)}`}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black whitespace-nowrap ${
                        it.sinCobro ? "bg-sky-100 text-sky-800" : it.venceHoyTambien ? "bg-gradient-to-r from-amber-500 to-rose-600 text-white" : estilo.pill
                      }`}
                    >
                      {it.sinCobro ? "Sin cobro" : it.venceHoyTambien ? "Hoy + atrasado" : estilo.etiqueta}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{it.ultimo_pago_fecha ? formatFechaCorta(it.ultimo_pago_fecha) : "—"}</td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${esAtraso ? "text-rose-700 font-bold" : "text-slate-400"}`}>
                    {esAtraso && it.debe_desde ? formatFechaCorta(it.debe_desde) : "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-center whitespace-nowrap ${esAtraso ? "text-rose-700 font-bold" : "text-slate-400"}`}>
                    {esAtraso ? `${it.cuotas_atrasadas || 1} ${unidad}${(it.cuotas_atrasadas || 1) > 1 ? "s" : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {it.proximo_cobro ? (
                      <>
                        <span className="text-slate-800 font-semibold">{formatFechaCorta(it.proximo_cobro)}</span>
                        <span className={`block text-[10px] ${it.dias === 0 ? "text-amber-700 font-bold" : "text-slate-500"}`}>{textoRelativo(it.dias)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono whitespace-nowrap ${esAtraso ? "text-rose-700 font-bold" : "text-slate-300"}`}>
                    {esAtraso ? formatSoles(it.atrasado) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="font-mono font-black text-slate-900">{formatSoles(it.montoACobrar)}</span>
                    {it.venceHoyTambien && <span className="block text-[10px] text-amber-700 font-bold">atrasado + hoy</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400">
        Atrasado = cuotas vencidas antes de hoy sin pagar. La cuota que vence hoy todavía no cuenta como atraso. Toca una fila para ver el detalle.
      </p>
    </div>
  );
};
