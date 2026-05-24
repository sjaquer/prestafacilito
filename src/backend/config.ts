import "dotenv/config";
import jwt from "jsonwebtoken";

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
export const config = {
  get jwtSecret() { return getEnv("JWT_SECRET") || "fallback-secret-para-evitar-crashes"; },
  get adminUser() { return getEnv("ADMIN_USER"); },
  get adminPass() { return getEnv("ADMIN_PASS"); },
  get isProduction() { return process.env.NODE_ENV === "production"; }
};

export const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "strict" as const,
  maxAge: 24 * 60 * 60 * 1000,
};

// Middleware genérico para verificar Auth sin caer si no hay JWT
export const requireAuth = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
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
