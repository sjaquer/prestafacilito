/**
 * Cálculo puro de los eventos de cobro para Google Calendar (sin acceso a base ni a Google).
 * Ver services/google-calendar.ts para la sincronización.
 */
import { buildPaymentSchedule, round2, toNumber } from "../src/lib/loanLogic.js";
import { proximoCobroAlquiler, proximoCobroPrestamo } from "../src/lib/proximoCobro.js";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic.js";

/** A partir de cuántas cuotas atrasadas un préstamo se considera estancado (igual que en la app). */
export const CUOTAS_ESTANCADO = 5;

// ── Fechas (hora de Lima, independiente del servidor) ─────────────────────

export const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const sumarDias = (fecha: string, dias: number) => {
  const [y, m, d] = fecha.split("-").map(Number);
  return isoLocal(new Date(y, m - 1, d + dias));
};

// ── Eventos deseados según el estado actual de la cartera ─────────────────

export interface EventoDeseado {
  ref: string;
  fecha: string;
  summary: string;
  description: string;
  colorId: string;
}

const enlaceApp = (ruta: string) => (process.env.APP_URL ? `${process.env.APP_URL.replace(/\/$/, "")}${ruta}` : "");

const dinero = (n: number) => `S/ ${round2(n).toFixed(2)}`;

export function eventoPrestamo(prestamo: any, cliente: any, pagos: any[], ajustes: any[], hoy: string): EventoDeseado | null {
  const deuda = buildPaymentSchedule(prestamo, pagos, { ajustes, referenceDate: new Date(`${hoy}T12:00:00`) });
  const prox = proximoCobroPrestamo(deuda, prestamo.fecha_emision, hoy);
  if (prox.liquidado || !prox.fecha || prox.cuotasAtrasadas >= CUOTAS_ESTANCADO) return null;

  const { resumen } = deuda;
  const atrasadas = prox.cuotasAtrasadas;
  const monto = prox.cuota ? prox.cuota.montoCuotaBase : resumen.moraAcumulada + resumen.interesPendiente;
  const nombre = cliente?.nombre_completo || "Cliente";
  const enlace = enlaceApp(`/prestamos/${prestamo.id}`);
  return {
    ref: `prestamo:${prestamo.id}`,
    fecha: prox.fecha,
    summary: `${atrasadas > 0 ? "⚠️" : "💰"} Cobrar ${dinero(monto)} — ${nombre}`,
    description: [
      `Préstamo ${prestamo.tipo_prestamo || "Personal"} de ${dinero(toNumber(prestamo.monto_capital))} al ${prestamo.tasa_interes_porcentaje}%`,
      `Capital restante: ${dinero(resumen.capitalPendiente)}`,
      `Mínimo a pagar ese día: ${dinero(monto)}`,
      atrasadas > 0 ? `Atrasado: ${atrasadas} cuota(s), mora ${dinero(resumen.moraAcumulada)}` : null,
      cliente?.telefono ? `Teléfono: ${cliente.telefono}` : null,
      enlace ? `\nAbrir en la app: ${enlace}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    colorId: atrasadas > 0 ? "11" : "5",
  };
}

export function eventoAlquiler(alquiler: any, cliente: any, pagos: any[], hoy: string): EventoDeseado | null {
  const estado = buildAlquilerSchedule(alquiler, pagos, new Date(`${hoy}T12:00:00`));
  const prox = proximoCobroAlquiler(estado, hoy, alquiler.fecha_fin);
  if (!prox.fecha || prox.mesesAtrasados >= CUOTAS_ESTANCADO) return null;

  const monto = round2((prox.mes ? prox.mes.saldoPendiente : toNumber(alquiler.monto_mensual)) + prox.atrasado);
  const nombre = cliente?.nombre_completo || "Inquilino";
  const enlace = enlaceApp(`/alquileres/${alquiler.id}`);
  return {
    ref: `alquiler:${alquiler.id}`,
    fecha: prox.fecha,
    summary: `${prox.atrasado > 0 ? "⚠️" : "🏠"} Renta ${dinero(monto)} — ${nombre}`,
    description: [
      `Alquiler: ${alquiler.descripcion_inmueble || "Inmueble"}`,
      `Renta mensual: ${dinero(toNumber(alquiler.monto_mensual))}`,
      prox.atrasado > 0 ? `Atrasado: ${dinero(prox.atrasado)} (${prox.mesesAtrasados} mes/es)` : null,
      cliente?.telefono ? `Teléfono: ${cliente.telefono}` : null,
      enlace ? `\nAbrir en la app: ${enlace}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    colorId: prox.atrasado > 0 ? "11" : "7",
  };
}
