import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentSchedule } from "../loanLogic.js";
import { montosDePago, proximoCobroPrestamo } from "../proximoCobro.js";

const hoy = "2026-10-15";
const ref = new Date(`${hoy}T12:00:00`);
const pagos = (prestamoId: string, lista: [number, string][]) =>
  lista.map(([monto, fecha_pago], i) => ({ id: `${prestamoId}-${i}`, prestamo_id: prestamoId, monto, fecha_pago })) as any[];

const casos = [
  { nombre: "vence hoy con pago parcial", p: { id: "a", monto_capital: 1000, tasa_interes_porcentaje: 10, fecha_emision: "2026-07-15" }, pg: pagos("a", [[100, "2026-08-15"], [100, "2026-09-15"], [50, "2026-10-15"]]), cuota: 50, liquidar: 1050, atrasado: false },
  { nombre: "al día", p: { id: "b", monto_capital: 1500, tasa_interes_porcentaje: 15, fecha_emision: "2026-06-16" }, pg: pagos("b", [[225, "2026-07-16"], [225, "2026-08-16"], [225, "2026-09-16"]]), cuota: 225, liquidar: 1725, atrasado: false },
  { nombre: "dos cuotas atrasadas", p: { id: "c", monto_capital: 2000, tasa_interes_porcentaje: 10, fecha_emision: "2026-08-05" }, pg: [], cuota: 600, liquidar: 2600, atrasado: true },
];

describe("montosDePago (coherente con el cálculo de préstamos)", () => {
  for (const c of casos) {
    it(`${c.nombre}: montos esperados`, () => {
      const m = montosDePago(buildPaymentSchedule(c.p as any, c.pg, { referenceDate: ref }), c.p.fecha_emision, hoy);
      assert.equal(m.cuota, c.cuota);
      assert.equal(m.liquidar, c.liquidar);
      assert.equal(m.atrasado, c.atrasado);
    });

    it(`${c.nombre}: pagar 'liquidar' deja el saldo en 0 y pagar 'cuota' deja la mora en 0`, () => {
      const m = montosDePago(buildPaymentSchedule(c.p as any, c.pg, { referenceDate: ref }), c.p.fecha_emision, hoy);
      const tras = (monto: number) =>
        buildPaymentSchedule(c.p as any, [...c.pg, { id: "n", prestamo_id: c.p.id, monto, fecha_pago: hoy }], { referenceDate: ref }).resumen;
      assert.equal(tras(m.liquidar).saldoPendiente, 0);
      assert.equal(tras(m.cuota).moraAcumulada, 0);
    });
  }

  it("lo que vence hoy no cuenta como atrasado", () => {
    const p = { id: "d", monto_capital: 1000, tasa_interes_porcentaje: 10, fecha_emision: "2026-08-15" } as any;
    const prox = proximoCobroPrestamo(buildPaymentSchedule(p, pagos("d", [[100, "2026-09-15"]]), { referenceDate: ref }), p.fecha_emision, hoy);
    assert.equal(prox.atrasado, false);
    assert.equal(prox.fecha, hoy);
  });
});
