import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { transformSync } from "esbuild";

/**
 * En Vercel el servidor corre con Node puro (ESM), que NO resuelve imports relativos sin extensión.
 * En desarrollo (tsx) y en `npm run build` (empaquetado) sí funcionan, así que el error solo aparece
 * en producción: la función revienta al arrancar (FUNCTION_INVOCATION_FAILED). Este test lo evita.
 *
 * Compila cada archivo como lo hace Vercel (TS → JS, archivo por archivo) y revisa los imports que
 * quedan en el resultado: los que solo traen tipos desaparecen y no importan.
 */
const RAIZ = path.resolve(import.meta.dirname, "../../..");

function resolver(desde: string, spec: string): string | null {
  const base = path.normalize(path.join(path.dirname(desde), spec));
  const candidatos = [base.endsWith(".js") ? base.slice(0, -3) + ".ts" : null, base + ".ts", base];
  return candidatos.find((c) => c && fs.existsSync(c) && fs.statSync(c).isFile()) || null;
}

function importsSinExtension(): string[] {
  const vistos = new Set<string>();
  const malos: string[] = [];
  const visitar = (archivo: string) => {
    if (vistos.has(archivo)) return;
    vistos.add(archivo);
    const { code } = transformSync(fs.readFileSync(archivo, "utf8"), { loader: "ts", format: "esm" });
    for (const m of code.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.endsWith(".js")) malos.push(`${path.relative(RAIZ, archivo)} → "${spec}"`);
      const destino = resolver(archivo, spec);
      if (destino) visitar(destino);
    }
  };
  visitar(path.join(RAIZ, "api/index.ts"));
  return malos;
}

describe("Imports del servidor (compatibles con Node en Vercel)", () => {
  it("todos los imports relativos que quedan tras compilar llevan extensión .js", () => {
    assert.deepEqual(importsSinExtension(), []);
  });
});
