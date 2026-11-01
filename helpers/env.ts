import dotenv from "dotenv";

/**
 * Variables de entorno locales: `.env.local` tiene prioridad sobre `.env` (ambos fuera de git).
 * En Vercel no se usan archivos: las variables se configuran en el panel del proyecto.
 */
dotenv.config({ path: [".env.local", ".env"], quiet: true });
