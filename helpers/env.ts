import dotenv from "dotenv";

/**
 * Variables de entorno locales: `.env.local` tiene prioridad sobre `.env` (ambos fuera de git).
 * En Vercel no se usan archivos: las variables se configuran en el panel del proyecto.
 *
 * Los valores de ejemplo "PEGAR_AQUI_..." se descartan: así un placeholder olvidado nunca se usa
 * como clave real (en local se toma el de `.env`; en Vercel queda como "falta configurar").
 */
const esPlaceholder = (v?: string) => !!v && v.trim().startsWith("PEGAR_AQUI");

dotenv.config({ path: ".env.local", quiet: true });
for (const [clave, valor] of Object.entries(process.env)) {
  if (esPlaceholder(valor)) {
    delete process.env[clave];
    console.warn(`[ENV] ${clave} todavía tiene el valor de ejemplo: complétalo en .env.local / Vercel.`);
  }
}
dotenv.config({ path: ".env", quiet: true });
