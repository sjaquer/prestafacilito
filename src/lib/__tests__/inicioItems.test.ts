import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepararItems } from "../../components/inicio/tipos.js";

const base = {
  id: "p", es_alquiler: false, cliente_id: "c", cliente_nombre: "George", tipo: "Personal",
  cuotas_atrasadas: 1, debe_desde: "2026-10-01", saldo_pendiente: 800, ultimo_pago_fecha: "2026-09-01",
};
const hoy = new Date("2026-11-01T12:00:00");

describe("Inicio — atrasado al que además hoy le vence otra cuota", () => {
  it("sigue en Atrasados, avisa que hoy vence otra y cobra lo necesario para quedar al día", () => {
    const [it0] = prepararItems([{ ...base, proximo_cobro: "2026-11-01", atrasado: 66.95, monto_proximo: 133.9 }], hoy);
    assert.equal(it0.grupo, "atrasado");
    assert.equal(it0.venceHoyTambien, true);
    assert.equal(it0.montoACobrar, 133.9);
  });

  it("si la próxima cuota no es hoy, cobra solo lo atrasado", () => {
    const [it0] = prepararItems([{ ...base, proximo_cobro: "2026-11-24", atrasado: 58.71, monto_proximo: 117.42 }], hoy);
    assert.equal(it0.venceHoyTambien, false);
    assert.equal(it0.montoACobrar, 58.71);
  });

  it("atrasado cuya próxima cuota vence mañana: se marca para la pestaña Mañana y cobra solo lo atrasado", () => {
    const [it0] = prepararItems([{ ...base, proximo_cobro: "2026-11-02", atrasado: 66.95, monto_proximo: 133.9 }], hoy);
    assert.equal(it0.grupo, "atrasado");
    assert.equal(it0.venceMananaTambien, true);
    assert.equal(it0.venceHoyTambien, false);
    assert.equal(it0.montoACobrar, 66.95);
  });

  it("atrasado cuya próxima cuota vence en 3 días: se marca para la pestaña Esta semana", () => {
    const [it0] = prepararItems([{ ...base, proximo_cobro: "2026-11-04", atrasado: 50, monto_proximo: 100 }], hoy);
    assert.equal(it0.venceSemanaTambien, true);
    assert.equal(it0.venceMananaTambien, false);
    assert.equal(it0.montoACobrar, 50);
  });
});
