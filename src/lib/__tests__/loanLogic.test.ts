import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentSchedule, classifyPayment } from "../loanLogic.js";
import { Prestamo, Amortizacion } from "../../types.js";

describe("buildPaymentSchedule — Modelo de Crédito Abierto (Cuotas Infinitas)", () => {
  const basePrestamo: Prestamo = {
    id: "p-test-1",
    cliente_id: "c-test-1",
    monto_capital: 1000,
    tasa_interes_porcentaje: 10,
    fecha_emision: "2026-01-01",
    fecha_vencimiento: "2026-01-15",
    estado: "activo",
    tipo_prestamo: "Personal",
  };

  it("Pago exacto del interés mensual mantiene el capital sin reducir y no genera mora", () => {
    const pagos: Amortizacion[] = [
      {
        id: "pago-1",
        prestamo_id: "p-test-1",
        monto: 100, // Interés exacto del mes (1000 * 10%)
        fecha_pago: "2026-01-15",
        tipo_movimiento: "Pago mínimo",
        metodo_pago: "Efectivo",
      },
    ];

    const refDate = new Date("2026-01-31T00:00:00");
    const resultado = buildPaymentSchedule(basePrestamo, pagos, { referenceDate: refDate });

    assert.equal(resultado.resumen.capitalPendiente, 1000);
    assert.equal(resultado.resumen.moraAcumulada, 0);
    assert.equal(resultado.cuotas[0].estado, "Saldada");
  });

  it("Pago menor al interés genera mora para el mes siguiente y no reduce capital", () => {
    const pagos: Amortizacion[] = [
      {
        id: "pago-1",
        prestamo_id: "p-test-1",
        monto: 60, // Interés es 100, abono es 60
        fecha_pago: "2026-01-15",
        tipo_movimiento: "Pago incompleto",
        metodo_pago: "Efectivo",
      },
    ];

    const refDate = new Date("2026-01-31T00:00:00");
    const resultado = buildPaymentSchedule(basePrestamo, pagos, { referenceDate: refDate });

    assert.equal(resultado.resumen.capitalPendiente, 1000);
    assert.equal(resultado.resumen.moraAcumulada, 40); // 100 - 60 = 40 de mora
    assert.equal(resultado.cuotas[0].esPagoIncompleto, true);
    assert.equal(resultado.cuotas[0].moraGenerada, 40);
  });

  it("Pago mayor al interés reduce el capital global directamente por el excedente", () => {
    const pagos: Amortizacion[] = [
      {
        id: "pago-1",
        prestamo_id: "p-test-1",
        monto: 300, // 100 de interés + 200 de abono a capital
        fecha_pago: "2026-01-15",
        tipo_movimiento: "Pago con amortización",
        metodo_pago: "Efectivo",
      },
    ];

    const refDate = new Date("2026-01-31T00:00:00");
    const resultado = buildPaymentSchedule(basePrestamo, pagos, { referenceDate: refDate });

    assert.equal(resultado.resumen.capitalPendiente, 800); // 1000 - 200
    assert.equal(resultado.resumen.moraAcumulada, 0);
    assert.equal(resultado.cuotas[0].capitalAmortizado, 200);
  });

  it("Tres meses sin ningún abono marca el préstamo como estancado", () => {
    const refDate = new Date("2026-04-15T00:00:00");
    const resultado = buildPaymentSchedule(basePrestamo, [], { referenceDate: refDate });

    assert.equal(resultado.resumen.esEstancado, true);
    assert.equal(resultado.resumen.mesesSinPago, 4);
    assert.equal(resultado.resumen.capitalPendiente, 1000);
  });

  it("Capital en cero indica préstamo liquidado", () => {
    const pagos: Amortizacion[] = [
      {
        id: "pago-1",
        prestamo_id: "p-test-1",
        monto: 1100, // 100 interés + 1000 capital
        fecha_pago: "2026-01-15",
        tipo_movimiento: "Liquidación total",
        metodo_pago: "Efectivo",
      },
    ];

    const refDate = new Date("2026-01-31T00:00:00");
    const resultado = buildPaymentSchedule(basePrestamo, pagos, { referenceDate: refDate });

    assert.equal(resultado.resumen.capitalPendiente, 0);
    assert.equal(resultado.resumen.saldoPendiente, 0);
  });

  it("classifyPayment clasifica correctamente montos menores, iguales y mayores a la deuda", () => {
    const refDate = new Date("2026-01-31T00:00:00");
    const debtState = buildPaymentSchedule(basePrestamo, [], { referenceDate: refDate });

    assert.equal(classifyPayment(0, debtState), "Pago inválido");
    assert.equal(classifyPayment(50, debtState), "Pago incompleto");
    assert.equal(classifyPayment(100, debtState), "Pago mínimo");
    assert.equal(classifyPayment(500, debtState), "Pago con amortización");
    assert.equal(classifyPayment(1100, debtState), "Liquidación total");
    assert.equal(classifyPayment(2000, debtState), "Pago con excedente");
  });
});
