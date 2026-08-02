import React, { useState } from "react";
import { MessageCircle, FileText, DollarSign, Calendar, AlertTriangle, Clock, CheckCircle2, Search, Home, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface DeudorMesItem {
  prestamo_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  score?: 'A' | 'B' | 'C' | null;
  es_alquiler?: boolean;
  descripcion_inmueble?: string;
  monto_capital: number;
  tasa_interes_porcentaje: number;
  tipo_prestamo: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  dia_vencimiento_mes: string;
  cuota_actual: number;
  cuota_exigible: number;
  cuota_pagado: number;
  cuota_numero: number;
  total_cuotas: number;
  cuotas_debiendo?: number;
  dias_restantes?: number;
  estado_pago_mes: 'atrasado' | 'pendiente' | 'pagado';
  saldo_pendiente: number;
  dias_atraso: number;
}

interface DeudoresMesListProps {
  deudores: DeudorMesItem[];
  onSelectDeudorParaPago: (prestamoId: string) => void;
  isLoading?: boolean;
}

export const DeudoresMesList: React.FC<DeudoresMesListProps> = ({
  deudores,
  onSelectDeudorParaPago,
  isLoading = false
}) => {
  const navigate = useNavigate();
  const [filterTerm, setFilterTerm] = useState("");
  const [filterState, setFilterState] = useState<"todos" | "atrasado" | "pendiente" | "pagado">("todos");

  const filteredDeudores = deudores.filter((d) => {
    const term = filterTerm.toLowerCase().trim();
    const nombreMatch = d.cliente_nombre.toLowerCase().includes(term);
    const apodoMatch = (d.cliente_apodo || "").toLowerCase().includes(term);
    const inmuebleMatch = (d.descripcion_inmueble || "").toLowerCase().includes(term);
    const stateMatch = filterState === "todos" || d.estado_pago_mes === filterState;
    return (nombreMatch || apodoMatch || inmuebleMatch) && stateMatch;
  });

  const getWhatsAppLink = (deudor: DeudorMesItem) => {
    const telSanitized = (deudor.cliente_telefono || "").replace(/\D/g, "");
    const telFinal = telSanitized.startsWith("51") ? telSanitized : `51${telSanitized}`;

    let mensaje = "";
    if (deudor.es_alquiler) {
      mensaje = `Hola ${deudor.cliente_nombre}, le saludamos de PrestaFacilito. Le recordamos la cuota de su alquiler (${deudor.descripcion_inmueble}) por S/ ${deudor.cuota_actual.toFixed(2)}. Gracias.`;
    } else if (deudor.estado_pago_mes === "atrasado") {
      mensaje = `Hola ${deudor.cliente_nombre}, te saludamos de PrestaFacilito. Te recordamos la cuota pendiente de S/ ${deudor.cuota_actual.toFixed(2)} de tu préstamo. Por favor coordinar el pago a la brevedad. Gracias.`;
    } else {
      mensaje = `Hola ${deudor.cliente_nombre}, le saludamos de PrestaFacilito. Le recordamos que su próxima cuota de S/ ${deudor.cuota_actual.toFixed(2)} vence el ${deudor.dia_vencimiento_mes}. ¡Gracias por su preferencia!`;
    }

    return `https://wa.me/${telFinal}?text=${encodeURIComponent(mensaje)}`;
  };

  const getScoreBadge = (score?: 'A' | 'B' | 'C' | null) => {
    if (!score) return null;
    const colors = {
      A: "bg-emerald-100 text-emerald-800 border-emerald-300",
      B: "bg-amber-100 text-amber-800 border-amber-300",
      C: "bg-red-100 text-red-800 border-red-300"
    };
    return (
      <span className={`px-2 py-0.5 text-[10px] font-extrabold border rounded-md ${colors[score]}`}>
        Score: {score}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-medium text-slate-500">Cargando cuentas del mes en Inicio...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Cobros y Vencimientos del Mes
            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
              {deudores.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500">Préstamos e Inquilinos de Alquiler del mes actual</p>
        </div>

        {/* Filtros rápidos de estado */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterState("todos")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterState === "todos"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Todos ({deudores.length})
          </button>
          <button
            onClick={() => setFilterState("atrasado")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterState === "atrasado"
                ? "bg-red-600 text-white shadow-sm"
                : "bg-red-50 text-red-700 hover:bg-red-100"
            }`}
          >
            Por cobrar ({deudores.filter((d) => d.estado_pago_mes === "atrasado").length})
          </button>
          <button
            onClick={() => setFilterState("pendiente")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterState === "pendiente"
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Pendientes ({deudores.filter((d) => d.estado_pago_mes === "pendiente").length})
          </button>
          <button
            onClick={() => setFilterState("pagado")}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              filterState === "pagado"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Pagados ({deudores.filter((d) => d.estado_pago_mes === "pagado").length})
          </button>
        </div>
      </div>

      {/* Buscador de la lista */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          placeholder="Filtrar por deudor, apodo o inmueble..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
        />
      </div>

      {filteredDeudores.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
          <p className="text-xs text-slate-500">No se encontraron cuentas con los criterios seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[850px] min-h-[650px] overflow-y-auto pr-1">
          {filteredDeudores.map((deudor) => {
            const isAtrasado = deudor.estado_pago_mes === "atrasado";
            const isPagado = deudor.estado_pago_mes === "pagado";
            const cuotasDebiendo = deudor.cuotas_debiendo || 0;

            return (
              <div
                key={deudor.prestamo_id}
                className={`p-4 rounded-2xl border transition-all space-y-3 shadow-xs ${
                  isAtrasado
                    ? "bg-red-50/50 border-red-200 shadow-sm"
                    : isPagado
                    ? "bg-emerald-50/30 border-emerald-200"
                    : "bg-amber-50/30 border-amber-200"
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {deudor.es_alquiler ? (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md text-[10px] font-black flex items-center gap-1">
                          <Home className="w-3 h-3" /> ALQUILER
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[10px] font-black flex items-center gap-1">
                          <Wallet className="w-3 h-3" /> PRÉSTAMO
                        </span>
                      )}
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {deudor.cliente_nombre}
                      </h3>
                      {deudor.cliente_apodo && (
                        <span className="text-xs font-semibold text-slate-500 italic">
                          ({deudor.cliente_apodo})
                        </span>
                      )}
                      {getScoreBadge(deudor.score)}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      {deudor.es_alquiler 
                        ? `Inmueble: ${deudor.descripcion_inmueble || "Alquiler"} • Mensualidad: S/ ${deudor.monto_capital.toFixed(2)}`
                        : `${deudor.tipo_prestamo} • Capital prestado: S/ ${deudor.monto_capital.toFixed(2)} (Tasa ${deudor.tasa_interes_porcentaje}%)`
                      }
                    </p>
                  </div>

                  {/* Insignia de Estado Destacada */}
                  <div className="shrink-0">
                    {isAtrasado && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-full text-xs font-black shadow-md tracking-wide animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" /> POR COBRAR
                      </span>
                    )}
                    {isPagado && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-full text-xs font-black shadow-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PAGADO
                      </span>
                    )}
                    {!isAtrasado && !isPagado && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 rounded-full text-xs font-black shadow-md">
                        <Clock className="w-3.5 h-3.5 text-slate-950" /> PENDIENTE
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalles de Cuota y Casilla de Meses/Cuotas en Deuda */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-white border border-slate-200/80 rounded-xl text-xs shadow-2xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cuota del Mes</span>
                    <span className="font-extrabold text-slate-900 text-sm">S/ {deudor.cuota_actual.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Día de Cobro / Venc.</span>
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> {deudor.dia_vencimiento_mes}
                      </span>
                      {isAtrasado ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded-md w-fit">
                          ⚠️ Vencido ({deudor.dias_atraso || 1}d)
                        </span>
                      ) : deudor.dias_restantes !== undefined && deudor.dias_restantes > 0 ? (
                        deudor.dias_restantes <= 7 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-200/90 border border-amber-400 px-1.5 py-0.5 rounded-md w-fit animate-pulse">
                            ⚡ Quedan {deudor.dias_restantes}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-800 bg-blue-100 border border-blue-300 px-1.5 py-0.5 rounded-md w-fit">
                            📅 Quedan {deudor.dias_restantes}d
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cuotas / Meses en Deuda</span>
                    <span className={`font-black block mt-1 text-xs ${cuotasDebiendo > 0 ? "text-red-600 underline decoration-red-300 underline-offset-2" : "text-emerald-600"}`}>
                      {cuotasDebiendo > 0 ? `${cuotasDebiendo} ${deudor.es_alquiler ? 'mes(es)' : 'cuota(s)'} en deuda` : "Al día"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Saldo Pendiente Total</span>
                    <span className="font-bold text-slate-900 block mt-1 text-xs">S/ {deudor.saldo_pendiente.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => navigate(deudor.es_alquiler ? `/alquileres/${deudor.prestamo_id}` : `/prestamos/${deudor.prestamo_id}`)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500" /> Ver Detalle
                  </button>

                  <button
                    onClick={() => onSelectDeudorParaPago(deudor.prestamo_id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
                  </button>

                  <a
                    href={getWhatsAppLink(deudor)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
