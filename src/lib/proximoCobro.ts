/**
 * Próxima fecha de cobro de un préstamo o alquiler, a partir del estado que ya calcula
 * la lógica de préstamos/alquileres (no recalcula deudas).
 * Lo usan Inicio, Cartera y la sincronización con Google Calendar, para que coincidan.
 */
import { addMonthsClamped, round2 } from "./loanLogic.js";
import type { EstadoDeudaPrestamo, CuotaPrestamo } from "../types.js";
import type { EstadoAlquiler, MesAlquiler } from "./alquilerLogic.js";

const pad = (n: number) => String(n).padStart(2, "0");
const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface ProximoCobroPrestamo {
  /** Fecha (YYYY-MM-DD) del próximo vencimiento desde hoy (incluido). */
  fecha: string | null;
  /** Cuota de esa fecha, si ya está en el cronograma. */
  cuota: CuotaPrestamo | null;
  /** Hay dinero vencido sin pagar (mora). Es el criterio de "atrasado" para la vista. */
  atrasado: boolean;
  /** Cuotas vencidas sin cubrir (solo cuenta si hay mora pendiente). */
  cuotasAtrasadas: number;
  /** Fecha de la cuota impaga más antigua (para "debe desde"). */
  debeDesde: string | null;
  liquidado: boolean;
}

export function proximoCobroPrestamo(deuda: EstadoDeudaPrestamo, fechaEmision: string, hoy: string): ProximoCobroPrestamo {
  const { resumen, cuotas } = deuda;
  const liquidado = resumen.saldoPendiente <= 0.01;
  const atrasado = !liquidado && resumen.moraAcumulada > 0.009;

  let cuota = cuotas.find((c) => c.estado !== "Saldada" && c.fechaVencimiento >= hoy) || null;
  let fecha = cuota?.fechaVencimiento || null;
  if (!fecha && !liquidado) {
    for (let n = 1; n <= cuotas.length + 24; n++) {
      const f = isoLocal(addMonthsClamped(fechaEmision, n));
      if (f >= hoy) {
        fecha = f;
        break;
      }
    }
  }

  const impagas = cuotas.filter((c) => c.estado !== "Saldada" && c.fechaVencimiento < hoy);
  return {
    fecha: liquidado ? null : fecha,
    cuota: liquidado ? null : cuota,
    atrasado,
    cuotasAtrasadas: atrasado ? resumen.cuotasVencidas || impagas.length || 1 : 0,
    debeDesde: atrasado ? impagas[0]?.fechaVencimiento || null : null,
    liquidado,
  };
}

export interface ProximoCobroAlquiler {
  fecha: string | null;
  mes: MesAlquiler | null;
  /** Suma de mensualidades ya vencidas sin pagar. */
  atrasado: number;
  mesesAtrasados: number;
  debeDesde: string | null;
}

export function proximoCobroAlquiler(estado: EstadoAlquiler, hoy: string, fechaFin?: string | null): ProximoCobroAlquiler {
  const meses = estado.mesesGenerados;
  const vencidos = meses.filter((m) => m.saldoPendiente > 0.009 && m.fechaVencimiento < hoy);
  const atrasado = round2(vencidos.reduce((s, m) => s + m.saldoPendiente, 0));

  const mes = meses.find((m) => m.estado !== "Saldada" && m.fechaVencimiento >= hoy) || null;
  let fecha = mes?.fechaVencimiento || null;
  if (!fecha) {
    // Todo lo generado vencido o pagado: el siguiente cobro es el mes que sigue al último generado
    const ultimo = meses[meses.length - 1];
    const [hy, hm] = hoy.split("-").map(Number);
    const base = ultimo ? new Date(ultimo.anio, ultimo.mes, 1) : new Date(hy, hm - 1, 1);
    for (let n = 0; n < 24 && !fecha; n++) {
      const y = base.getFullYear();
      const m = base.getMonth() + n;
      const ultimoDia = new Date(y, m + 1, 0).getDate();
      const f = isoLocal(new Date(y, m, Math.min(estado.diaCobroFijo, ultimoDia)));
      if (f >= hoy) fecha = f;
    }
  }
  if (fecha && fechaFin && fecha > String(fechaFin).slice(0, 10)) fecha = null;

  return {
    fecha,
    mes,
    atrasado,
    mesesAtrasados: vencidos.length,
    debeDesde: vencidos[0]?.fechaVencimiento || null,
  };
}
