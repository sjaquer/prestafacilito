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

const prestamoBase: Prestamo = {
  id: "p9",
  cliente_id: "c9",
  monto_capital: 1000,
  tasa_interes_porcentaje: 10,
  fecha_emision: "2026-01-10",
  fecha_vencimiento: "2026-02-10",
  estado: "activo",
  tipo_prestamo: "Personal",
};
const hoy = new Date("2026-05-20T12:00:00");
const pago = (fecha: string, monto: number): Amortizacion =>
  ({ id: fecha, prestamo_id: "p9", monto, fecha_pago: fecha, metodo_pago: "Yape" }) as Amortizacion;

test("Score — un préstamo al 0 % sin pagos no castiga al cliente (sin cuotas que cobrar)", () => {
  const score = calcularScoreCliente([{ ...prestamoBase, tasa_interes_porcentaje: 0 }], [], [], hoy);
  assert.equal(score.cuotasTotales, 0);
  assert.equal(score.scoreLetra, null);
});

test("Score — un pago adelantado de otro mes no hace 'puntual' a una cuota impaga", () => {
  // Paga bien enero, febrero y marzo; abril (vence 10/05) queda sin pagar
  const pagos = [pago("2026-02-05", 100), pago("2026-03-05", 100), pago("2026-04-05", 100)];
  const score = calcularScoreCliente([prestamoBase], pagos, [], hoy);
  assert.equal(score.cuotasTotales, 4);
  assert.equal(score.cuotasPagadasATiempo, 3);
  assert.equal(score.cuotasAtrasadasHoy, 1);
});

test("Score — las cuotas con interés congelado no cuentan como impagas", () => {
  const ajuste = { id: "aj", prestamo_id: "p9", tipo: "congelar_interes_temporal", fecha_inicio: "2026-03-10", fecha_fin: "2026-04-10", activo: true } as any;
  const pagos = [pago("2026-02-05", 100), pago("2026-05-05", 100)];
  const score = calcularScoreCliente([prestamoBase], pagos, [ajuste], hoy);
  // Cuotas vencidas: feb (pagada), mar y abr congeladas (no cuentan), may (pagada) → 2 de 2 a tiempo
  assert.equal(score.cuotasTotales, 2);
  assert.equal(score.cuotasPagadasATiempo, 2);
  assert.equal(score.scoreLetra, "A");
});

test("Score — cuenta los préstamos liquidados (estado 'liquidado')", () => {
  const score = calcularScoreCliente([{ ...prestamoBase, estado: "liquidado" }], [pago("2026-02-05", 1100)], [], hoy);
  assert.equal(score.prestamosLiquidados, 1);
});
