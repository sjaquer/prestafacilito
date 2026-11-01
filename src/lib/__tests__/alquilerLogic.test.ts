import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAlquilerSchedule } from "../alquilerLogic.js";

const contrato = { id: "a1", cliente_id: "c1", monto_mensual: 330, fecha_inicio: "2025-12-07", estado: "activo" as const };
const pago = (mes: number, monto: number, id = `${mes}-${monto}`) => ({ id, alquiler_id: "a1", monto, fecha_pago: `2026-${String(mes).padStart(2, "0")}-05`, periodo_mes: mes, periodo_anio: 2026 });
const ref = new Date("2026-10-31T12:00:00");

describe("Alquileres — cada pago cuenta para el mes elegido", () => {
  it("el pago queda en su mes, no en el mes impago más antiguo", () => {
    const e = buildAlquilerSchedule(contrato, [pago(6, 330)], ref);
    const junio = e.mesesGenerados.find((m) => m.mes === 6)!;
    const enero = e.mesesGenerados.find((m) => m.mes === 1)!;
    assert.equal(junio.montoPagado, 330);
    assert.equal(junio.estado, "Saldada");
    assert.equal(enero.montoPagado, 0);
    assert.equal(enero.estado, "Vencida");
  });

  it("lo pagado de más en un mes cubre el mes impago más antiguo y el total adeudado no cambia", () => {
    const e = buildAlquilerSchedule(contrato, [pago(7, 330, "x"), pago(7, 330, "y")], ref);
    const julio = e.mesesGenerados.find((m) => m.mes === 7)!;
    const enero = e.mesesGenerados.find((m) => m.mes === 1)!;
    assert.equal(julio.montoPagado, 330);
    assert.equal(enero.montoPagado, 330);
    assert.equal(enero.cubiertoConExcedente, 330);
    // 10 meses (ene–oct) × 330 = 3300; pagado 660 → debe 2640
    assert.equal(e.totalPendiente, 2640);
  });

  it("un pago para un mes futuro se guarda para ese mes (no tapa deudas viejas)", () => {
    const e = buildAlquilerSchedule(contrato, [pago(12, 330)], ref);
    assert.equal(e.mesesGenerados.every((m) => m.montoPagado === 0), true);
  });

  it("'debe a la fecha' (totalVencido) no incluye la mensualidad que aún no vence", () => {
    const e = buildAlquilerSchedule(contrato, [], new Date("2026-11-01T12:00:00"));
    assert.equal(e.totalPendiente, 11 * 330);
    assert.equal(e.totalVencido, 10 * 330);
  });
});
