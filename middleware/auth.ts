import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../helpers/jwt.js";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" && process.env.DISABLE_SECURE_COOKIE !== "true",
  sameSite: "lax" as const,
  maxAge: 24 * 60 * 60 * 1000,
};

export const clearCookieOptions = {
  httpOnly: cookieOptions.httpOnly,
  secure: cookieOptions.secure,
  sameSite: cookieOptions.sameSite,
};

export interface AuthRequest extends express.Request {
  user?: any;
}

export const requireAuth = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: "Sesión inválida o expirada" });
  }
};
