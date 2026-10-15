import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolverCuenta, agruparPorCuenta, agruparPorTitular, SIN_IDENTIFICAR_ID } from "../cuentas.js";
import { diasHasta, toISODateLocal } from "../fechas.js";

describe("resolverCuenta", () => {
  it("reconoce el nombre oficial", () => {
    assert.equal(resolverCuenta("BBVA (Roberto)")?.id, "bbva-roberto");
  });

  it("reconoce alias antiguos sin importar mayúsculas ni tildes", () => {
    assert.equal(resolverCuenta("yape")?.id, "bcp-sebastian");
    assert.equal(resolverCuenta("Transferencia BBVA")?.id, "bbva-roberto");
    assert.equal(resolverCuenta("EFECTIVO")?.id, "efectivo");
  });

  it("usa el titular cuando el texto lo menciona", () => {
    assert.equal(resolverCuenta("Yape Roberto")?.id, "bcp-roberto");
    assert.equal(resolverCuenta("plin sebastián")?.id, "interbank-sebastian");
  });

  it("no adivina cuentas inexistentes", () => {
    assert.equal(resolverCuenta("BBVA Sebastián"), null);
    assert.equal(resolverCuenta("Otro"), null);
    assert.equal(resolverCuenta(""), null);
  });
});

describe("agrupar pagos", () => {
  const pagos = [
    { monto: 100, metodo_pago: "Yape" },
    { monto: 50, metodo_pago: "BCP / Yape (Sebastián)" },
    { monto: 30, metodo_pago: "BBVA (Roberto)" },
    { monto: 20, metodo_pago: "Otro" },
  ];

  it("el desglose por cuenta suma el total, incluyendo 'Sin identificar'", () => {
    const grupos = agruparPorCuenta(pagos);
    const total = grupos.reduce((s, g) => s + g.total, 0);
    assert.equal(total, 200);
    assert.equal(grupos.find((g) => g.id === "bcp-sebastian")?.total, 150);
    assert.equal(grupos.find((g) => g.id === SIN_IDENTIFICAR_ID)?.total, 20);
  });

  it("el resumen por titular es coherente con el desglose por cuenta", () => {
    const t = agruparPorTitular(pagos);
    assert.equal(t["Sebastián"].total, 150);
    assert.equal(t["Roberto"].total, 30);
    assert.equal(t["Sin identificar"].total, 20);
  });
});

describe("fechas locales", () => {
  it("toISODateLocal no se desplaza a UTC", () => {
    assert.equal(toISODateLocal(new Date(2026, 9, 15, 23, 30)), "2026-10-15");
  });

  it("diasHasta calcula días de calendario", () => {
    const hoy = new Date(2026, 9, 15, 21, 0);
    assert.equal(diasHasta("2026-10-15", hoy), 0);
    assert.equal(diasHasta("2026-10-16", hoy), 1);
    assert.equal(diasHasta("2026-10-10", hoy), -5);
    assert.equal(diasHasta(null, hoy), null);
  });
});
