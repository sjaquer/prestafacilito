import test from "node:test";
import assert from "node:assert/strict";
import { calcularScoreCliente } from "../scoreLogic.js";
import { Prestamo, Amortizacion } from "../../types.js";

test("calcularScoreCliente — cliente sin historial", () => {
  const score = calcularScoreCliente([], []);
  assert.equal(score.scoreLetra, null);
  assert.equal(score.scoreNumerico, 0);
  assert.equal(score.prestamosTotales, 0);
});

test("calcularScoreCliente — cliente perfecto (Score A)", () => {
  const prestamos: Prestamo[] = [
    {
      id: "p1",
      cliente_id: "c1",
      monto_capital: 1000,
      tasa_interes_porcentaje: 10,
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-02-01",
      estado: "pagado",
      tipo_prestamo: "Personal"
    }
  ];

  const amortizaciones: Amortizacion[] = [
    {
      id: "a1",
      prestamo_id: "p1",
      monto: 1100,
      fecha_pago: "2026-01-15",
      metodo_pago: "Efectivo",
      tipo_movimiento: "Pago exacto de cuota"
    }
  ];

  const score = calcularScoreCliente(prestamos, amortizaciones);
  assert.equal(score.scoreLetra, "A");
  assert.ok(score.scoreNumerico >= 70);
  assert.equal(score.prestamosLiquidados, 1);
});

test("calcularScoreCliente — cliente con atrasos frecuentes (Score C)", () => {
  const prestamos: Prestamo[] = [
    {
      id: "p1",
      cliente_id: "c1",
      monto_capital: 1000,
      tasa_interes_porcentaje: 10,
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-02-01",
      estado: "activo",
      tipo_prestamo: "Personal"
    }
  ];

  const score = calcularScoreCliente(prestamos, []);
  assert.equal(score.scoreLetra, "C");
  assert.ok(score.scoreNumerico < 40);
});
