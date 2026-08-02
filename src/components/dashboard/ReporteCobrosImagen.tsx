import React from "react";
import { DeudorMesItem } from "./DeudoresMesList";

interface ReporteCobrosImagenProps {
  items: DeudorMesItem[];
}

export const ReporteCobrosImagen: React.FC<ReporteCobrosImagenProps> = ({ items }) => {
  const fechaHoyStr = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const fechaHoyCapitalizada = fechaHoyStr.charAt(0).toUpperCase() + fechaHoyStr.slice(1);

  // Totales
  const totalAtrasado = items
    .filter((d) => d.estado_pago_mes === "atrasado")
    .reduce((sum, d) => sum + d.cuota_actual, 0);

  const totalPendienteSemana = items
    .filter((d) => d.estado_pago_mes === "pendiente")
    .reduce((sum, d) => sum + d.cuota_actual, 0);

  const totalGeneral = totalAtrasado + totalPendienteSemana;

  return (
    <div
      id="reporte-cobros-container"
      className="bg-white text-slate-900 font-sans p-6 rounded-2xl border-2 border-slate-300 w-[800px] space-y-5 shadow-2xl"
      style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
    >
      {/* Encabezado del Reporte Estilo Ejecutivo */}
      <div className="flex items-center justify-between border-b-2 border-emerald-600 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-lg">
              P
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">PrestaFacilito</h1>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
            Reporte Semanal de Cobros y Vencimientos
          </p>
        </div>

        <div className="text-right">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-black">
            📋 LISTA PARA WHATSAPP
          </span>
          <p className="text-[11px] font-semibold text-slate-500 mt-1">{fechaHoyCapitalizada}</p>
        </div>
      </div>

      {/* Tabla Estilo Excel Moderno */}
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="bg-slate-900 text-white font-bold border-b-2 border-slate-900">
            <th className="py-2.5 px-3 rounded-tl-lg font-black text-[11px] uppercase">#</th>
            <th className="py-2.5 px-3 font-black text-[11px] uppercase">Cliente / Inquilino</th>
            <th className="py-2.5 px-3 font-black text-[11px] uppercase">Concepto</th>
            <th className="py-2.5 px-3 font-black text-[11px] uppercase">Día de Cobro</th>
            <th className="py-2.5 px-3 font-black text-[11px] uppercase text-right">Cuota (S/)</th>
            <th className="py-2.5 px-3 rounded-tr-lg font-black text-[11px] uppercase text-center">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item, index) => {
            const isAtrasado = item.estado_pago_mes === "atrasado";
            const dayNum = item.dia_vencimiento_mes
              ? parseInt(item.dia_vencimiento_mes.split("-")[2] || item.dia_vencimiento_mes, 10)
              : 5;

            return (
              <tr
                key={item.prestamo_id}
                className={index % 2 === 0 ? "bg-slate-50/60" : "bg-white"}
              >
                <td className="py-2.5 px-3 font-extrabold text-slate-400">{index + 1}</td>
                <td className="py-2.5 px-3">
                  <span className="font-extrabold text-slate-900 block text-sm">
                    {item.cliente_nombre}
                  </span>
                  {item.cliente_apodo && (
                    <span className="text-[11px] font-semibold text-slate-500 italic">
                      ({item.cliente_apodo})
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 font-semibold text-slate-700">
                  {item.es_alquiler ? (
                    <span className="text-indigo-700 font-bold">
                      🏠 Alquiler: {item.descripcion_inmueble || "Inmueble"}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold">
                      💰 Préstamo ({item.tipo_prestamo})
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 font-extrabold text-slate-800">
                  📅 Día {dayNum}
                  {isAtrasado ? (
                    <span className="block text-[10px] font-black text-red-600">
                      ⚠️ Atrasado ({item.dias_atraso || 1}d)
                    </span>
                  ) : item.dias_restantes !== undefined && item.dias_restantes > 0 ? (
                    <span className="block text-[10px] font-extrabold text-amber-700">
                      ⚡ Quedan {item.dias_restantes}d
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 px-3 font-black text-slate-900 text-sm text-right">
                  S/ {item.cuota_actual.toFixed(2)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  {isAtrasado ? (
                    <span className="px-2.5 py-1 bg-red-600 text-white rounded-full font-black text-[10px] uppercase shadow-xs">
                      🔴 POR COBRAR
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-amber-400 text-slate-950 rounded-full font-black text-[10px] uppercase shadow-xs">
                      ⚡ PENDIENTE
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Resumen de Totales al Pie */}
      <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-900 text-white rounded-xl text-xs">
        <div>
          <span className="text-[10px] font-extrabold text-red-400 uppercase block">Total Por Cobrar (Atrasado)</span>
          <span className="text-base font-black text-red-300">S/ {totalAtrasado.toFixed(2)}</span>
        </div>

        <div>
          <span className="text-[10px] font-extrabold text-amber-400 uppercase block">Total Pendiente Esta Semana</span>
          <span className="text-base font-black text-amber-300">S/ {totalPendienteSemana.toFixed(2)}</span>
        </div>

        <div className="border-l border-slate-700 pl-3">
          <span className="text-[10px] font-extrabold text-emerald-400 uppercase block">Gran Total a Recaudar</span>
          <span className="text-lg font-black text-emerald-400">S/ {totalGeneral.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center pt-1 border-t border-slate-200">
        <p className="text-[10px] font-bold text-slate-400">
          PrestaFacilito v2.0 • Sistema de Gestión de Préstamos y Alquileres
        </p>
      </div>
    </div>
  );
};
