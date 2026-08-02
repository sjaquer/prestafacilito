import crypto from "crypto";

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

let fallbackJwtSecret: string | null = null;

export const getJwtSecret = () => {
  const secret = getEnv("JWT_SECRET");
  if (!secret) {
    if (!fallbackJwtSecret) {
      fallbackJwtSecret = "prestafacilito-production-fallback-jwt-secret-2026-secure-key";
      console.warn("⚠️ Advertencia: JWT_SECRET no está configurada en .env. Usando clave secreta predeterminada.");
    }
    return fallbackJwtSecret;
  }
  return secret;
};
