import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventoPrestamo, eventoAlquiler } from "../../../services/calendario-eventos.js";

const prestamo = (extra: any = {}) => ({
  id: "p1",
  cliente_id: "c1",
  monto_capital: 600,
  tasa_interes_porcentaje: 20,
  fecha_emision: "2026-08-06",
  estado: "activo",
  tipo_prestamo: "Personal",
  ...extra,
});
const cliente = { nombre_completo: "Ana Pérez", telefono: "987654321" };

describe("eventoPrestamo", () => {
  it("al día: evento en el próximo vencimiento con el interés del mes", () => {
    const pagos = [
      { id: "a", prestamo_id: "p1", monto: 120, fecha_pago: "2026-09-06" },
      { id: "b", prestamo_id: "p1", monto: 120, fecha_pago: "2026-10-06" },
    ];
    const ev = eventoPrestamo(prestamo(), cliente, pagos, [], "2026-10-15");
    assert.ok(ev);
    assert.equal(ev!.ref, "prestamo:p1");
    assert.equal(ev!.fecha, "2026-11-06");
    assert.match(ev!.summary, /Cobrar S\/ 120\.00 — Ana Pérez/);
    assert.equal(ev!.colorId, "5");
  });

  it("con atraso: el recordatorio va en el siguiente vencimiento futuro, marcado en rojo", () => {
    const ev = eventoPrestamo(prestamo(), cliente, [], [], "2026-10-15");
    assert.ok(ev);
    assert.ok(ev!.fecha >= "2026-10-15");
    assert.equal(ev!.colorId, "11");
    assert.match(ev!.summary, /^⚠️/);
  });

  it("estancado (5+ cuotas atrasadas): no va al calendario", () => {
    const ev = eventoPrestamo(prestamo({ fecha_emision: "2026-02-06" }), cliente, [], [], "2026-10-15");
    assert.equal(ev, null);
  });

  it("liquidado: no va al calendario", () => {
    const pagos = [{ id: "a", prestamo_id: "p1", monto: 720, fecha_pago: "2026-09-06" }];
    assert.equal(eventoPrestamo(prestamo(), cliente, pagos, [], "2026-10-15"), null);
  });
});

describe("eventoAlquiler", () => {
  const alquiler = { id: "r1", cliente_id: "c1", monto_mensual: 800, fecha_inicio: "2026-07-10", estado: "activo", descripcion_inmueble: "Dpto 2" };

  it("al día: próximo cobro en el día fijo del contrato", () => {
    const pagos = [8, 9, 10].map((mes) => ({ id: `m${mes}`, alquiler_id: "r1", monto: 800, periodo_mes: mes, periodo_anio: 2026, fecha_pago: `2026-${String(mes).padStart(2, "0")}-10` }));
    const ev = eventoAlquiler(alquiler, cliente, pagos, "2026-10-15");
    assert.ok(ev);
    assert.equal(ev!.ref, "alquiler:r1");
    assert.equal(ev!.fecha, "2026-11-10");
    assert.match(ev!.summary, /Renta S\/ 800\.00/);
  });

  it("contrato con fecha de fin pasada: sin evento", () => {
    const ev = eventoAlquiler({ ...alquiler, fecha_fin: "2026-10-01" }, cliente, [], "2026-10-15");
    assert.equal(ev, null);
  });
});
