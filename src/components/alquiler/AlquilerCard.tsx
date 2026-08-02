import React from "react";
import { Home, MessageCircle, DollarSign, Calendar, AlertTriangle, Clock, CheckCircle2, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alquiler } from "../../types";

export interface AlquilerItemCalculado extends Alquiler {
  cliente_nombre?: string;
  cliente_apodo?: string;
  cliente_telefono?: string;
  dia_cobro?: number;
  dias_restantes?: number;
  mes_actual_estado?: "pagado" | "parcial" | "pendiente";
  mes_actual_pendiente?: number;
  meses_atrasados?: number;
  total_pendiente?: number;
}

interface AlquilerCardProps {
  alquiler: AlquilerItemCalculado;
  onSelectParaPago: (alquilerId: string) => void;
}

export const AlquilerCard: React.FC<AlquilerCardProps> = ({
  alquiler,
  onSelectParaPago
}) => {
  const navigate = useNavigate();

  const getWhatsAppLink = () => {
    const telSanitized = (alquiler.cliente_telefono || "").replace(/\D/g, "");
    const telFinal = telSanitized.startsWith("51") ? telSanitized : `51${telSanitized}`;
    const mensaje = `Hola ${alquiler.cliente_nombre}, le saludamos de PrestaFacilito. Le recordamos el pago de su mensualidad de alquiler (${alquiler.descripcion_inmueble}) por el monto de S/ ${alquiler.monto_mensual.toFixed(2)}. Gracias.`;
    return `https://wa.me/${telFinal}?text=${encodeURIComponent(mensaje)}`;
  };

  const isPagado = alquiler.mes_actual_estado === "pagado";
  const isParcial = alquiler.mes_actual_estado === "parcial";
  const tieneAtrasos = (alquiler.meses_atrasados || 0) > 0;
  const isPendiente = !isPagado && !tieneAtrasos;

  const diaInicio = alquiler.fecha_inicio ? parseInt(alquiler.fecha_inicio.split("-")[2] || "1", 10) : 1;
  const diaCobro = alquiler.dia_cobro || diaInicio;
  const diasRestantes = alquiler.dias_restantes !== undefined ? alquiler.dias_restantes : 0;

  return (
    <div
      className={`p-4 rounded-2xl border transition-all space-y-3 ${
        tieneAtrasos
          ? "bg-red-50/30 border-red-200 shadow-sm"
          : isPagado
          ? "bg-emerald-50/20 border-emerald-200"
          : "bg-amber-50/20 border-amber-200"
      }`}
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 pb-2.5">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <Home className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{alquiler.descripcion_inmueble || "Alquiler de Inmueble"}</span>
          </h3>
          <p className="text-xs font-semibold text-slate-600 mt-0.5">
            Inquilino: <span className="font-bold text-slate-800">{alquiler.cliente_nombre}</span>
            {alquiler.cliente_apodo && (
              <span className="italic text-slate-500 font-semibold ml-1">({alquiler.cliente_apodo})</span>
            )}
          </p>
        </div>

        {/* Badge de Estado del Mes */}
        <div>
          {tieneAtrasos && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" /> POR COBRAR
            </span>
          )}
          {isPagado && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> PAGADO
            </span>
          )}
          {isParcial && !tieneAtrasos && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
              <Clock className="w-3.5 h-3.5" /> PARCIAL
            </span>
          )}
          {isPendiente && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold">
              <Clock className="w-3.5 h-3.5" /> PENDIENTE
            </span>
          )}
        </div>
      </div>

      {/* Datos del Contrato */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-white/90 border border-slate-200/60 rounded-xl text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Monto Mensual</span>
          <span className="font-bold text-slate-900">S/ {alquiler.monto_mensual.toFixed(2)}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Día de Cobro Mensual</span>
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" /> Día {diaCobro} {diasRestantes > 0 ? `(Quedan ${diasRestantes}d)` : ""}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 block font-medium">Meses Atrasados</span>
          <span className={`font-bold ${tieneAtrasos ? "text-red-600 font-extrabold" : "text-emerald-600"}`}>
            {tieneAtrasos ? `${alquiler.meses_atrasados} mes(es) debiendo` : "Al día"}
          </span>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={() => navigate(`/alquileres/${alquiler.id}`)}
          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
        >
          <FileText className="w-3.5 h-3.5 text-slate-500" /> Ver Detalle
        </button>

        <button
          onClick={() => onSelectParaPago(alquiler.id)}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs"
        >
          <DollarSign className="w-3.5 h-3.5" /> Registrar Pago
        </button>

        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
        </a>
      </div>
    </div>
  );
};
