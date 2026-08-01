import React, { useState } from "react";
import { MessageCircle, FileText, DollarSign, Calendar, AlertTriangle, Clock, CheckCircle2, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface DeudorMesItem {
  prestamo_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  score?: 'A' | 'B' | 'C' | null;
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
    const stateMatch = filterState === "todos" || d.estado_pago_mes === filterState;
    return (nombreMatch || apodoMatch) && stateMatch;
  });

  const getWhatsAppLink = (deudor: DeudorMesItem) => {
    const telSanitized = (deudor.cliente_telefono || "").replace(/\D/g, "");
    const telFinal = telSanitized.startsWith("51") ? telSanitized : `51${telSanitized}`;

    let mensaje = "";
    if (deudor.estado_pago_mes === "atrasado") {
      mensaje = `Hola ${deudor.cliente_nombre}, le saludamos de PrestaFacilito. Le recordamos que tiene una cuota vencida de S/ ${deudor.cuota_actual.toFixed(2)} correspondiente a su préstamo. Por favor coordinar su pago a la brevedad. Gracias.`;
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
        <p className="text-xs font-medium text-slate-500">Cargando deudores del mes actual...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            Deudores del Mes Actual
            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full font-semibold">
              {deudores.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500">Sección C — Lista completa de vencimientos del mes</p>
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
            Atrasados ({deudores.filter((d) => d.estado_pago_mes === "atrasado").length})
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
          placeholder="Filtrar por deudor o apodo..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-50 transition-all"
        />
      </div>

      {filteredDeudores.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
          <p className="text-xs text-slate-500">No se encontraron deudores con los criterios seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filteredDeudores.map((deudor) => {
            const isAtrasado = deudor.estado_pago_mes === "atrasado";
            const isPagado = deudor.estado_pago_mes === "pagado";

            return (
              <div
                key={deudor.prestamo_id}
                className={`p-4 rounded-xl border transition-all space-y-3 ${
                  isAtrasado
                    ? "bg-red-50/40 border-red-200 shadow-sm"
                    : isPagado
                    ? "bg-emerald-50/30 border-emerald-200"
                    : "bg-amber-50/20 border-amber-200"
                }`}
              >
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        {deudor.cliente_nombre}
                      </h3>
                      {deudor.cliente_apodo && (
                        <span className="text-xs font-semibold text-slate-500 italic">
                          ({deudor.cliente_apodo})
                        </span>
                      )}
                      {getScoreBadge(deudor.score)}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {deudor.tipo_prestamo} • Capital prestado: S/ {deudor.monto_capital.toFixed(2)} (Tasa {deudor.tasa_interes_porcentaje}%)
                    </p>
                  </div>

                  {/* Insignia de Estado */}
                  <div>
                    {isAtrasado && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold">
                        <AlertTriangle className="w-3.5 h-3.5" /> ATRASADO ({deudor.dias_atraso}d)
                      </span>
                    )}
                    {isPagado && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PAGADO
                      </span>
                    )}
                    {!isAtrasado && !isPagado && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
                        <Clock className="w-3.5 h-3.5" /> PENDIENTE
                      </span>
                    )}
                  </div>
                </div>

                {/* Detalles de la Cuota del Mes */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-white/80 border border-slate-200/60 rounded-lg text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Cuota {deudor.cuota_numero}/{deudor.total_cuotas}</span>
                    <span className="font-bold text-slate-800">S/ {deudor.cuota_actual.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Vencimiento del Mes</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" /> {deudor.dia_vencimiento_mes}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium">Saldo Pendiente Deuda</span>
                    <span className="font-bold text-red-600">S/ {deudor.saldo_pendiente.toFixed(2)}</span>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => navigate(`/prestamos/${deudor.prestamo_id}`)}
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
