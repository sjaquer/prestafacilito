import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentSchedule } from "../loanLogic";
import { Prestamo } from "../../types";

describe("buildPaymentSchedule — Modelo Francés Adaptativo", () => {
  // Caso de la Misión (Sección 3.1): S/100 al 10% en 2 cuotas
  it("S/100 al 10% en 2 cuotas produce cuotas de S/60 y S/55", () => {
    const prestamo: Prestamo = {
      id: "p-test-1",
      cliente_id: "c-test-1",
      monto_capital: 100,
      tasa_interes_porcentaje: 10,
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-03-01",
      estado: "activo",
      tipo_prestamo: "Personal"
    };

    const resultado = buildPaymentSchedule(prestamo, []);
    assert.equal(resultado.cuotas.length, 2);
    assert.equal(resultado.cuotas[0].montoCuotaBase, 60); // S/50 capital + S/10 interés
    assert.equal(resultado.cuotas[1].montoCuotaBase, 55); // S/50 capital + S/5 interés (sobre S/50 restante)
    assert.equal(resultado.resumen.totalExigible, 115);
  });

  // Ejemplo 3 cuotas: S/1000 al 15% en 3 cuotas
  it("S/1000 al 15% en 3 cuotas produce amortizaciones de capital constante y cuotas decrecientes", () => {
    const prestamo: Prestamo = {
      id: "p-test-2",
      cliente_id: "c-test-2",
      monto_capital: 1000,
      tasa_interes_porcentaje: 15,
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-04-01",
      estado: "activo",
      tipo_prestamo: "Personal"
    };

    const resultado = buildPaymentSchedule(prestamo, []);
    assert.equal(resultado.cuotas.length, 3);
    assert.equal(resultado.cuotas[0].capitalAmortizado, 333.33);
    assert.equal(resultado.cuotas[0].interesOriginal, 150); // 1000 * 15%
    assert.equal(resultado.cuotas[0].montoCuotaBase, 483.33);

    assert.equal(resultado.cuotas[1].capitalAmortizado, 333.33);
    assert.equal(resultado.cuotas[1].interesOriginal, 100); // 666.67 * 15%
    assert.equal(resultado.cuotas[1].montoCuotaBase, 433.33);
  });

  // Imputación de pago parcial
  it("Pago parcial cubre primero interés y luego capital", () => {
    const prestamo: Prestamo = {
      id: "p-test-3",
      cliente_id: "c-test-3",
      monto_capital: 100,
      tasa_interes_porcentaje: 10,
      fecha_emision: "2026-01-01",
      fecha_vencimiento: "2026-03-01",
      estado: "activo",
      tipo_prestamo: "Personal"
    };

    const pagos = [
      {
        id: "pago-1",
        prestamo_id: "p-test-3",
        monto: 30, // Cuota 1 exige S/60 (S/10 int + S/50 cap). Pago de S/30 cubre S/10 int + S/20 cap
        fecha_pago: "2026-01-15",
        tipo_movimiento: "Pago Ordinario",
        metodo_pago: "Efectivo"
      }
    ];

    const resultado = buildPaymentSchedule(prestamo, pagos);
    assert.equal(resultado.cuotas[0].estado, "Parcial");
    assert.equal(resultado.cuotas[0].interesPendiente, 0);
    assert.equal(resultado.cuotas[0].saldoPendiente, 30);
  });
});
