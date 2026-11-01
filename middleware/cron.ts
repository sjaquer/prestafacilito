import crypto from "crypto";
import express from "express";

/**
 * Protege las rutas que llama Vercel Cron. Vercel envía `Authorization: Bearer <CRON_SECRET>`;
 * sin CRON_SECRET configurado, las rutas quedan deshabilitadas.
 */
export function requireCron(req: express.Request, res: express.Response, next: express.NextFunction) {
  const secreto = process.env.CRON_SECRET;
  const recibido = String(req.headers.authorization || "");
  const esperado = `Bearer ${secreto}`;
  if (
    !secreto ||
    recibido.length !== esperado.length ||
    !crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado))
  ) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  next();
}
