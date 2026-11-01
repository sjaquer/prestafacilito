import React from "react";
import { CreditCard, MapPin, AlertTriangle, CheckCircle2, Edit3, MessageCircle, Phone, Plus } from "lucide-react";
import { estandarizarTelefono } from "../../../helpers/telefono";
import { Card } from "../ui/Card";
import { Cliente } from "../../types";
import { formatCurrency, formatDate, getSaludoPorHora } from "../../lib/formatters";
import { ClienteAtrasoResumen } from "./clienteFinanzas";

const DatoContacto: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">{label}</span>
    {children}
  </div>
);

interface ClientePerfilHeaderProps {
  cliente: Cliente;
  onNuevoPrestamo: () => void;
  onEditar: () => void;
}

/** Cabecera del perfil: quién es, cómo contactarlo y acciones principales. */
export const ClientePerfilHeader: React.FC<ClientePerfilHeaderProps> = ({ cliente, onNuevoPrestamo, onEditar }) => {
  const initials = cliente.nombre_completo
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const tel = estandarizarTelefono(cliente.telefono || "");
  const tieneTel = tel.length >= 9;
  const accion = "h-11 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 decoration-none transition";

  return (
    <Card variant="simple" className="p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-lg shrink-0 select-none">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">{cliente.nombre_completo}</h1>
          <p className="text-xs text-slate-500 font-semibold truncate">
            {cliente.apodo ? `"${cliente.apodo}" · ` : ""}Cliente desde {formatDate(cliente.fecha_registro || "")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <DatoContacto label="Teléfono">
          <span className="text-slate-800 font-mono">{cliente.telefono || "Sin teléfono"}</span>
        </DatoContacto>
        {cliente.direccion && (
          <DatoContacto label="Domicilio">
            <span className="text-slate-800 flex items-center gap-1">
              <MapPin size={11} className="text-indigo-600 shrink-0" /> {cliente.direccion}
            </span>
          </DatoContacto>
        )}
        {cliente.numero_cuenta && (
          <DatoContacto label="Cuenta para abonos">
            <span className="text-slate-800 flex items-center gap-1 font-mono">
              <CreditCard size={11} className="text-indigo-600 shrink-0" /> {cliente.banco_cuenta ? `${cliente.banco_cuenta} · ` : ""}
              {cliente.numero_cuenta}
            </span>
          </DatoContacto>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button type="button" onClick={onNuevoPrestamo} className={`${accion} col-span-2 sm:col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white`}>
          <Plus className="w-4 h-4" /> Nuevo préstamo
        </button>
        {tieneTel && (
          <>
            <a
              href={`https://wa.me/${tel}?text=${encodeURIComponent(`Hola, ${getSaludoPorHora().toLowerCase()}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`${accion} bg-emerald-50 hover:bg-emerald-100 text-emerald-700`}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a href={`tel:+${tel}`} className={`${accion} bg-slate-100 hover:bg-slate-200 text-slate-700`}>
              <Phone className="w-4 h-4" /> Llamar
            </a>
          </>
        )}
        <button type="button" onClick={onEditar} className={`${accion} bg-slate-100 hover:bg-slate-200 text-slate-700 ${tieneTel ? "" : "col-span-2 sm:col-span-1"}`}>
          <Edit3 className="w-4 h-4" /> Editar datos
        </button>
      </div>
    </Card>
  );
};

/** Banner con el estado de cobro del cliente: cuotas vencidas o próximo vencimiento. */
export const ClienteAtrasoBanner: React.FC<{ resumen: ClienteAtrasoResumen }> = ({ resumen }) => {
  if (resumen.tieneAtraso) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn">
        <div className="w-10 h-10 rounded-2xl bg-rose-100/80 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="text-sm font-black text-rose-900 leading-none">
            Este cliente tiene mensualidades o cuotas pendientes vencidas
          </p>
          <p className="text-xs text-rose-700 mt-2 font-medium">
            Tiene{" "}
            <strong className="font-extrabold">
              {resumen.totalCuotasAtrasadas} mensualidad(es) o cuota(s) vencida(s)
            </strong>{" "}
            sin pagar. Total atrasado:{" "}
            <strong className="font-mono font-extrabold">{formatCurrency(resumen.totalMontoAtrasado)}</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!resumen.proximaCuotaFecha) return null;

  const esAlquiler = resumen.proximaCuotaTipo === "Alquiler de Casa";
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 flex items-start gap-4 shadow-sm animate-fadeIn">
      <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
        <CheckCircle2 size={20} />
      </div>
      <div>
        <p className="text-sm font-black text-emerald-900 leading-none">
          {esAlquiler ? "Alquiler al día" : "Cliente al día en sus cuotas"}
        </p>
        <p className="text-xs text-emerald-700 mt-2 font-medium">
          {esAlquiler ? "Próxima mensualidad de alquiler programada para el " : "Próximo vencimiento programado para el "}
          <strong className="font-extrabold">{formatDate(resumen.proximaCuotaFecha)}</strong>
          {esAlquiler && ` (Día ${parseInt(resumen.proximaCuotaFecha.split("-")[2])} de cada mes)`} por un monto de{" "}
          <strong className="font-mono font-extrabold">{formatCurrency(resumen.proximaCuotaMonto)}</strong>.
        </p>
      </div>
    </div>
  );
};
