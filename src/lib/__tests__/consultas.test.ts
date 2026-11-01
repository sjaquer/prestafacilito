import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { todas, traerTodasLasPaginas } from "../../../services/consultas.js";

/** Consulta falsa que imita a Supabase: devuelve como máximo 1000 filas por `.range()`. */
function consultaFalsa(total: number, fallaEnPagina?: number) {
  const filas = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
  let ordenadoPorId = false;
  const q = {
    order(col: string) {
      if (col === "id") ordenadoPorId = true;
      return q;
    },
    async range(desde: number, hasta: number) {
      if (fallaEnPagina !== undefined && desde / 1000 === fallaEnPagina) return { data: null, error: { message: "caída" } };
      return { data: filas.slice(desde, Math.min(hasta + 1, desde + 1000)), error: null, ordenadoPorId };
    },
  };
  return q;
}

describe("Consultas por páginas (límite de 1000 filas de Supabase)", () => {
  it("trae todas las filas aunque sean más de 1000", async () => {
    const { data, error } = await todas(() => consultaFalsa(2500));
    assert.equal(error, null);
    assert.equal(data.length, 2500);
    assert.equal(new Set(data.map((f: any) => f.id)).size, 2500);
  });

  it("con exactamente 1000 filas hace una página extra vacía y termina", async () => {
    const filas = await traerTodasLasPaginas((d, h) => consultaFalsa(1000).range(d, h), "prueba");
    assert.equal(filas.length, 1000);
  });

  it("si una página falla, devuelve el error (no datos a medias)", async () => {
    const { data, error } = await todas(() => consultaFalsa(2500, 1));
    assert.equal(data.length, 0);
    assert.match(error!.message, /caída/);
  });
});
