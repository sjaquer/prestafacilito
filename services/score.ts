import { supabase } from "../src/lib/supabase.js";
import { calcularScoreCliente } from "../src/lib/scoreLogic.js";
import { todas } from "./consultas.js";

/**
 * Score A/B/C guardado en `score_clientes` (lo leen Inicio, Clientes y Reportes desde la vista).
 * Se recalcula para todos cada día (cron) y para un cliente cuando se registra, edita o borra un pago.
 * El score manual (override) nunca se toca.
 */
export async function recalcularScores(clienteIds?: string[]): Promise<{ actualizados: number }> {
  const soloAlgunos = clienteIds && clienteIds.length > 0;
  const filtrar = (q: any) => (soloAlgunos ? q.in("cliente_id", clienteIds) : q);

  const { data: prestamos, error } = await todas(() => filtrar(supabase.from("prestamos").select("*")));
  if (error) throw new Error(error.message);
  const ids = prestamos.map((p: any) => p.id);
  if (ids.length === 0) return { actualizados: 0 };

  const [{ data: pagos, error: e1 }, { data: ajustes, error: e2 }] = await Promise.all([
    todas(() => supabase.from("amortizaciones").select("*").in("prestamo_id", ids)),
    todas(() => supabase.from("ajustes_prestamo").select("*").in("prestamo_id", ids)),
  ]);
  if (e1 || e2) throw new Error((e1 || e2)!.message);

  const porCliente = new Map<string, any[]>();
  for (const p of prestamos) porCliente.set(p.cliente_id, [...(porCliente.get(p.cliente_id) || []), p]);

  const ahora = new Date().toISOString();
  const filas = [...porCliente].map(([clienteId, delCliente]) => {
    const ids = new Set(delCliente.map((p) => p.id));
    const s = calcularScoreCliente(
      delCliente,
      pagos.filter((a: any) => ids.has(a.prestamo_id)),
      ajustes.filter((a: any) => ids.has(a.prestamo_id))
    );
    return {
      cliente_id: clienteId,
      score_numerico: s.scoreNumerico,
      score_letra: s.scoreLetra,
      cuotas_totales: s.cuotasTotales,
      cuotas_a_tiempo: s.cuotasPagadasATiempo,
      cuotas_completas: s.cuotasPagadasCompletas,
      prestamos_liquidados: s.prestamosLiquidados,
      prestamos_totales: s.prestamosTotales,
      dias_atraso_promedio: s.diasAtrasoPromedio,
      ultima_actualizacion: ahora,
    };
  });

  // upsert sin columnas de override: score_manual y motivo_override se conservan
  const { error: e3 } = await supabase.from("score_clientes").upsert(filas, { onConflict: "cliente_id" });
  if (e3) throw new Error(e3.message);
  return { actualizados: filas.length };
}

/** Recalcula en segundo plano el score del cliente de un préstamo (no demora la respuesta del pago). */
export function programarScore(prestamoId: string) {
  setImmediate(async () => {
    try {
      const { data } = await supabase.from("prestamos").select("cliente_id").eq("id", prestamoId).maybeSingle();
      if (data?.cliente_id) await recalcularScores([data.cliente_id]);
    } catch (err: any) {
      console.warn("[Score] No se pudo recalcular:", err.message);
    }
  });
}
