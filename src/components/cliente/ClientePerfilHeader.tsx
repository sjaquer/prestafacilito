import React from "react";
import { Calendar, CreditCard, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Cliente } from "../../types";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { ClienteMoraResumen } from "./clienteFinanzas";

const DatoContacto: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1">
    <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">{label}</span>
    {children}
  </div>
);

/** Cabecera del perfil del cliente: avatar, estado y datos de contacto. */
export const ClientePerfilHeader: React.FC<{ cliente: Cliente }> = ({ cliente }) => {
  const initials = cliente.nombre_completo
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const esDeudorActivo = (cliente.prestamos_activos || 0) > 0;

  return (
    <Card variant="simple" className="relative overflow-hidden p-6 md:p-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shrink-0 select-none">
          {initials}
        </div>

        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap justify-center md:justify-start">
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                {cliente.nombre_completo}
              </h1>
              <Badge variant={esDeudorActivo ? "success" : "neutral"} className="w-fit mx-auto md:mx-0">
                {esDeudorActivo ? "Deudor Activo" : "Historial Limpio"}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 flex items-center justify-center md:justify-start gap-1">
              <Calendar size={12} /> Cliente desde: {formatDate(cliente.fecha_registro || "")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-slate-500 pt-2 border-t border-slate-200/80 text-left">
            <DatoContacto label="Canal Telefónico">
              <span className="text-slate-800 font-mono">{cliente.telefono || "Sin teléfono registrado"}</span>
            </DatoContacto>

            {cliente.direccion && (
              <DatoContacto label="Domicilio">
                <span className="text-slate-800 flex items-center gap-1">
                  <MapPin size={11} className="text-indigo-650 shrink-0" /> {cliente.direccion}
                </span>
              </DatoContacto>
            )}

            {cliente.numero_cuenta && (
              <DatoContacto label="Datos de Abono">
                <span className="text-slate-800 flex items-center gap-1 font-mono">
                  <CreditCard size={11} className="text-indigo-650 shrink-0" /> {cliente.numero_cuenta}
                </span>
              </DatoContacto>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

/** Banner con el estado de cobro del cliente: cuotas vencidas o próximo vencimiento. */
export const ClienteMoraBanner: React.FC<{ resumen: ClienteMoraResumen }> = ({ resumen }) => {
  if (resumen.tieneMora) {
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
