import crypto from "crypto";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

let fallbackJwtSecret: string | null = null;

export const getJwtSecret = () => {
  const secret = getEnv("JWT_SECRET");
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: La variable de entorno JWT_SECRET no está configurada. Operación abortada por seguridad.");
    }
    if (!fallbackJwtSecret) {
      fallbackJwtSecret = crypto.randomBytes ? crypto.randomBytes(32).toString("hex") : "dev-fallback-insecure-string-backup";
      console.warn("⚠️ Advertencia: JWT_SECRET no está configurada en desarrollo. Generada clave aleatoria temporal.");
    }
    return fallbackJwtSecret;
  }
  return secret;
};
