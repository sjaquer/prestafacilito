import "dotenv/config";
import jwt from "jsonwebtoken";
import crypto from "crypto";

export const getEnv = (name: string): string => {
  return process.env[name]?.trim() || "";
};

export const requireEnv = (name: string, throwOnMissing = false): string => {
  const value = getEnv(name);
  if (!value && throwOnMissing) {
    throw new Error(`Falta configurar la variable de entorno ${name}.`);
  }
  return value;
};

// Variables cacheadas o dinámicas
let fallbackJwtSecret: string | null = null;

export const config = {
  get jwtSecret() {
    const secret = getEnv("JWT_SECRET");
    if (!secret) {
      if (!fallbackJwtSecret) {
        fallbackJwtSecret = "prestafacilito-production-fallback-jwt-secret-2026-secure-key";
        console.warn("⚠️ Advertencia: JWT_SECRET no está configurada en .env. Usando clave secreta predeterminada.");
      }
      return fallbackJwtSecret;
    }
    return secret;
  },
  get adminUser() { return getEnv("ADMIN_USER"); },
  get adminPass() { return getEnv("ADMIN_PASS"); },
  get isProduction() { return process.env.NODE_ENV === "production"; }
};

export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction && process.env.DISABLE_SECURE_COOKIE !== "true",
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60 * 1000,
};

export const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
};
