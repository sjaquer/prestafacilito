/**
 * Resumen de un préstamo para listas (Cartera, ficha del cliente): grupo de cobro y cifras clave.
 * Todo sale de la lógica de préstamos; aquí solo se elige qué mostrar.
 */
import { buildPaymentSchedule } from "./loanLogic";
import { proximoCobroPrestamo } from "./proximoCobro";
import { clasificarCobro, GrupoCobro } from "./cobranza";

export type GrupoPrestamo = GrupoCobro | "liquidado";

export interface ResumenPrestamo {
  grupo: GrupoPrestamo;
  capitalRestante: number;
  interesMes: number;
  /** El interés de la cuota en curso está congelado por un ajuste. */
  congelado: boolean;
  /** Atrasados: interés atrasado. Resto: lo que vence en la próxima fecha. */
  aCobrar: number;
  /** Atrasados: desde cuándo debe. Resto: próxima fecha de cobro. */
  fecha: string | null;
  cuotasAtrasadas: number;
  saldoPendiente: number;
}

export function resumirPrestamo(prestamo: any, pagos: any[], hoy: string): ResumenPrestamo {
  const deuda = buildPaymentSchedule(prestamo, pagos, {
    ajustes: prestamo.ajustes || [],
    referenceDate: new Date(`${hoy}T12:00:00`),
  });
  const prox = proximoCobroPrestamo(deuda, prestamo.fecha_emision, hoy);
  const tasa = Number(prestamo.tasa_interes_porcentaje) || 0;
  const liquidado = prox.liquidado || prestamo.estado === "pagado" || prestamo.estado === "liquidado";
  return {
    grupo: liquidado ? "liquidado" : clasificarCobro({ fechaProxima: prox.fecha, atrasadas: prox.cuotasAtrasadas }),
    capitalRestante: deuda.resumen.capitalPendiente,
    interesMes: prox.cuota?.congelada ? 0 : prox.cuota?.interesOriginal ?? (deuda.resumen.capitalPendiente * tasa) / 100,
    congelado: !!prox.cuota?.congelada,
    aCobrar: prox.atrasado ? prox.interesVencido : prox.cuota?.saldoPendiente ?? 0,
    fecha: prox.atrasado ? prox.debeDesde : prox.fecha,
    cuotasAtrasadas: prox.cuotasAtrasadas,
    saldoPendiente: deuda.resumen.saldoPendiente,
  };
}
