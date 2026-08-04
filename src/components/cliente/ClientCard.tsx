import React from "react";
import { MessageCircle, ArrowUpRight, Phone, MapPin, Edit3, Coins, Wallet, CheckCircle2, Paperclip, FileUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Cliente } from "../../types";
import { ScoreBadge } from "../ui/ScoreBadge";
import { formatCurrency } from "../../lib/formatters";

interface ClientCardProps {
  cliente: Cliente;
  onEditClient?: (cliente: Cliente) => void;
  onUploadDocumento?: (cliente: Cliente) => void;
}

export const ClientCard: React.FC<ClientCardProps> = ({ cliente, onEditClient, onUploadDocumento }) => {
  const navigate = useNavigate();

  const getWhatsAppLink = () => {
    const telSanitized = (cliente.telefono || "").replace(/\D/g, "");
    const telFinal = telSanitized.startsWith("51") ? telSanitized : `51${telSanitized}`;
    const mensaje = `Hola ${cliente.nombre_completo}, le saludamos de PrestaFacilito. ¿En qué le podemos ayudar hoy?`;
    return `https://wa.me/${telFinal}?text=${encodeURIComponent(mensaje)}`;
  };

  const prestamosActivos = cliente.prestamos_activos || 0;
  const prestamosLiquidados = cliente.prestamos_liquidados || 0;
  const capitalHistorico = Number(cliente.capital_total_prestado) || 0;

  return (
    <div className="bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* Header de la tarjeta */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-extrabold text-slate-900">
              {cliente.nombre_completo}
            </h3>
            {cliente.apodo && (
              <span className="text-xs font-semibold text-slate-500 italic">
                ({cliente.apodo})
              </span>
            )}
          </div>
          {cliente.telefono && (
            <span className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> {cliente.telefono}
            </span>
          )}
        </div>

        {/* Badge de Score */}
        <ScoreBadge
          score={cliente.score_efectivo}
          sobreescrito={cliente.score_sobreescrito}
          size="md"
        />
      </div>

      {/* Indicadores Clave del Cliente (Sección 7.2) */}
      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
        <div>
          <span className="text-[10px] text-slate-400 font-bold block uppercase">Activos</span>
          <span className="font-extrabold text-emerald-600 flex items-center gap-1">
            <Wallet className="w-3.5 h-3.5" /> {prestamosActivos}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 font-bold block uppercase">Liquidados</span>
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" /> {prestamosLiquidados}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 font-bold block uppercase">Cap. Histórico</span>
          <span className="font-bold text-slate-900">
            S/ {capitalHistorico.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Acciones de la Tarjeta */}
      <div className="flex items-center justify-end gap-2 pt-1">
        {onEditClient && (
          <button
            onClick={() => onEditClient(cliente)}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            title="Editar Cliente"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        )}

        {onUploadDocumento && (
          <button
            onClick={() => onUploadDocumento(cliente)}
            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
            title="Subir Documento a Google Drive"
          >
            <FileUp className="w-3.5 h-3.5" /> Subir Documento
          </button>
        )}

        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
        >
          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
        </a>

        <button
          onClick={() => navigate(`/clientes/${cliente.id}`)}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 shadow-2xs"
        >
          <span>Ver Detalle</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
