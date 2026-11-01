import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planCuotaFija, planPagoFijo } from "../planPagos.js";
import { buildPaymentSchedule, addMonthsClamped } from "../loanLogic.js";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Paga el plan en cada vencimiento y comprueba con el cálculo real que el préstamo queda en 0. */
function liquidaConElMotor(capital: number, tasa: number, pagos: number[]) {
  const prestamo: any = { id: "p", cliente_id: "c", monto_capital: capital, tasa_interes_porcentaje: tasa, fecha_emision: "2026-01-15", estado: "activo" };
  const amort: any[] = pagos.map((monto, k) => ({ id: String(k), prestamo_id: "p", monto, fecha_pago: iso(addMonthsClamped("2026-01-15", k + 1)) }));
  const r = buildPaymentSchedule(prestamo, amort, { referenceDate: new Date("2036-01-01T12:00:00") });
  return r.resumen.saldoPendiente;
}

describe("Guía de pagos (previsualizar cuotas)", () => {
  it("cuota fija: pagando el plan a tiempo, el cálculo real deja el préstamo en 0", () => {
    for (const [c, t, n] of [[1000, 10, 3], [7000, 10, 6], [1500, 8, 4], [2000, 0, 5]] as const) {
      const plan = planCuotaFija(c, t, n)!;
      assert.equal(plan.meses.length, n);
      assert.ok(liquidaConElMotor(c, t, plan.meses.map((m) => m.pago)) <= 0.01, `${c} al ${t}% en ${n}`);
    }
  });

  it("cuota fija: las cuotas son iguales salvo el ajuste de la última", () => {
    const plan = planCuotaFija(1000, 10, 3)!;
    assert.equal(plan.meses[0].pago, plan.meses[1].pago);
    assert.ok(Math.abs(plan.meses[2].pago - plan.meses[0].pago) < 0.05);
  });

  it("pago fijo: calcula en cuántos meses termina y el interés total", () => {
    const plan = planPagoFijo(1000, 10, 300)!;
    assert.equal(plan.noTermina, false);
    assert.equal(plan.meses.length, 5);
    assert.ok(liquidaConElMotor(1000, 10, plan.meses.map((m) => m.pago)) <= 0.01);
  });

  it("pago fijo menor o igual al interés: avisa que nunca termina", () => {
    assert.equal(planPagoFijo(1000, 10, 100)!.noTermina, true);
  });
});
