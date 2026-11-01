import crypto from "crypto";

let secretoDesarrollo: string | null = null;

/**
 * Secreto para firmar las sesiones. En producción es obligatorio (sin él, el servidor no arranca):
 * un secreto por defecto escrito en el código permitiría a cualquiera falsificar sesiones.
 * En desarrollo se genera uno aleatorio por proceso (las sesiones caducan al reiniciar).
 */
export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("JWT_SECRET no está configurada. Defínela en las variables de entorno antes de desplegar.");
  }
  if (!secretoDesarrollo) {
    secretoDesarrollo = crypto.randomBytes(32).toString("hex");
    console.warn("⚠️ JWT_SECRET no está configurada: usando un secreto temporal (solo desarrollo).");
  }
  return secretoDesarrollo;
};
