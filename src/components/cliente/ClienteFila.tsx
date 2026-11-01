import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home as HomeIcon, MessageCircle, Phone, Wallet } from "lucide-react";
import { Cliente } from "../../types";
import { ScoreBadge } from "../ui/ScoreBadge";
import { estandarizarTelefono } from "../../../helpers/telefono";
import { getSaludoPorHora } from "../../lib/formatters";

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

/** Fila compacta de cliente: quién es, qué tiene vigente y acciones rápidas de contacto. */
export const ClienteFila: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
  const prestamos = cliente.prestamos_activos || 0;
  const alquileres = cliente.alquileres_activos || 0;
  const tel = estandarizarTelefono(cliente.telefono || "");
  const tieneTel = tel.length >= 9;
  const conDeuda = prestamos + alquileres > 0;
  const wa = tieneTel
    ? `https://wa.me/${tel}?text=${encodeURIComponent(`Hola, ${getSaludoPorHora().toLowerCase()}.`)}`
    : null;

  return (
    <li className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Link to={`/clientes/${cliente.id}`} className="flex items-center gap-3 flex-1 min-w-0 decoration-none">
          <span
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
              conDeuda ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
            }`}
          >
            {iniciales(cliente.nombre_completo) || "?"}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-900 text-sm truncate">{cliente.nombre_completo}</span>
              {cliente.score_efectivo && <ScoreBadge score={cliente.score_efectivo} sobreescrito={cliente.score_sobreescrito} size="sm" />}
            </span>
            <span className="block text-[11px] text-slate-500 font-semibold truncate">
              {cliente.apodo ? `${cliente.apodo} · ` : ""}
              {cliente.telefono || "Sin teléfono"}
            </span>
            <span className="flex flex-wrap gap-1 mt-1">
              {prestamos > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                  <Wallet className="w-3 h-3" /> {prestamos} préstamo{prestamos > 1 ? "s" : ""}
                </span>
              )}
              {alquileres > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 text-[10px] font-bold">
                  <HomeIcon className="w-3 h-3" /> {alquileres} alquiler{alquileres > 1 ? "es" : ""}
                </span>
              )}
              {!conDeuda && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold">Sin deudas vigentes</span>}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        </Link>
      </div>
      {tieneTel && (
        <div className="grid grid-cols-2 border-t border-slate-100 text-xs font-bold">
          <a href={`tel:+${tel}`} className="h-10 inline-flex items-center justify-center gap-1.5 text-slate-600 hover:bg-slate-50 decoration-none border-r border-slate-100">
            <Phone className="w-3.5 h-3.5" /> Llamar
          </a>
          <a href={wa!} target="_blank" rel="noopener noreferrer" className="h-10 inline-flex items-center justify-center gap-1.5 text-emerald-700 hover:bg-emerald-50 decoration-none">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        </div>
      )}
    </li>
  );
};
