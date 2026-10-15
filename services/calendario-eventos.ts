/**
 * Cálculo puro de los eventos de cobro para Google Calendar (sin acceso a base ni a Google).
 * Ver services/google-calendar.ts para la sincronización.
 */
import { buildPaymentSchedule, addMonthsClamped, round2, toNumber } from "../src/lib/loanLogic.js";
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
  const { resumen, cuotas } = deuda;
  if (resumen.saldoPendiente <= 0.01) return null;
  const atrasadas = resumen.cuotasVencidas || 0;
  if (atrasadas >= CUOTAS_ESTANCADO) return null;

  // Próxima fecha de cobro desde hoy (si hay atraso, el recordatorio va en el siguiente vencimiento)
  let cuota = cuotas.find((c) => c.estado !== "Saldada" && c.fechaVencimiento >= hoy);
  let fecha = cuota?.fechaVencimiento;
  if (!fecha) {
    for (let n = 1; n <= cuotas.length + 24; n++) {
      const f = isoLocal(addMonthsClamped(prestamo.fecha_emision, n));
      if (f >= hoy) {
        fecha = f;
        break;
      }
    }
  }
  if (!fecha) return null;

  const monto = cuota ? cuota.montoCuotaBase : resumen.moraAcumulada + resumen.interesPendiente;
  const nombre = cliente?.nombre_completo || "Cliente";
  const enlace = enlaceApp(`/prestamos/${prestamo.id}`);
  return {
    ref: `prestamo:${prestamo.id}`,
    fecha,
    summary: `${atrasadas > 0 ? "⚠️" : "💰"} Cobrar ${dinero(monto)} — ${nombre}`,
    description: [
      `Préstamo ${prestamo.tipo_prestamo || "Personal"} de ${dinero(toNumber(prestamo.monto_capital))} al ${prestamo.tasa_interes_porcentaje}%`,
      `Mínimo a pagar ese día: ${dinero(monto)}`,
      atrasadas > 0 ? `Atrasado: ${atrasadas} cuota(s), mora ${dinero(resumen.moraAcumulada)}` : null,
      `Saldo pendiente: ${dinero(resumen.saldoPendiente)}`,
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
  const meses = estado.mesesGenerados;
  if (estado.mesesAtrasados >= CUOTAS_ESTANCADO) return null;

  let mes = meses.find((m) => m.estado !== "Saldada" && m.fechaVencimiento >= hoy);
  let fecha = mes?.fechaVencimiento;
  if (!fecha) {
    // Todo lo generado está pagado (o vencido): el siguiente cobro es el mes que sigue al último generado
    const ultimo = meses[meses.length - 1];
    const base = ultimo ? new Date(ultimo.anio, ultimo.mes, 1) : new Date(`${hoy}T12:00:00`);
    for (let n = 0; n < 24 && !fecha; n++) {
      const y = base.getFullYear();
      const m = base.getMonth() + n;
      const ultimoDia = new Date(y, m + 1, 0).getDate();
      const f = isoLocal(new Date(y, m, Math.min(estado.diaCobroFijo, ultimoDia)));
      if (f >= hoy) fecha = f;
    }
  }
  if (!fecha) return null;
  if (alquiler.fecha_fin && fecha > String(alquiler.fecha_fin).slice(0, 10)) return null;

  const atrasado = round2(meses.filter((m) => m.fechaVencimiento < hoy).reduce((s, m) => s + m.saldoPendiente, 0));
  const monto = round2((mes ? mes.saldoPendiente : toNumber(alquiler.monto_mensual)) + atrasado);
  const nombre = cliente?.nombre_completo || "Inquilino";
  const enlace = enlaceApp(`/alquileres/${alquiler.id}`);
  return {
    ref: `alquiler:${alquiler.id}`,
    fecha,
    summary: `${atrasado > 0 ? "⚠️" : "🏠"} Renta ${dinero(monto)} — ${nombre}`,
    description: [
      `Alquiler: ${alquiler.descripcion_inmueble || "Inmueble"}`,
      `Renta mensual: ${dinero(toNumber(alquiler.monto_mensual))}`,
      atrasado > 0 ? `Atrasado: ${dinero(atrasado)} (${estado.mesesAtrasados} mes/es)` : null,
      cliente?.telefono ? `Teléfono: ${cliente.telefono}` : null,
      enlace ? `\nAbrir en la app: ${enlace}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    colorId: atrasado > 0 ? "11" : "7",
  };
}

