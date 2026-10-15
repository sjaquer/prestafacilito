import express from "express";

interface Registro {
  fallos: number;
  bloqueadoHasta: number;
  primerFallo: number;
}

/**
 * Limitador de intentos fallidos por IP, en memoria.
 * Suficiente para frenar fuerza bruta contra el PIN en una app pequeña. En Vercel cada
 * instancia tiene su propia memoria, así que el límite es por instancia (no global).
 */
export function crearLimitadorLogin({ maxFallos = 5, ventanaMs = 15 * 60 * 1000, bloqueoMs = 15 * 60 * 1000 } = {}) {
  const registros = new Map<string, Registro>();

  // En Vercel, x-real-ip lo fija la plataforma (el cliente no puede falsificarlo)
  const ipDe = (req: express.Request) =>
    String(req.headers["x-real-ip"] || "").trim() ||
    String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "desconocida";

  const limpiar = (ahora: number) => {
    for (const [ip, r] of registros) {
      if (r.bloqueadoHasta < ahora && ahora - r.primerFallo > ventanaMs) registros.delete(ip);
    }
  };

  return {
    /** Middleware: rechaza con 429 si la IP está bloqueada. */
    verificar(req: express.Request, res: express.Response, next: express.NextFunction) {
      const r = registros.get(ipDe(req));
      const ahora = Date.now();
      if (r && r.bloqueadoHasta > ahora) {
        const minutos = Math.ceil((r.bloqueadoHasta - ahora) / 60000);
        res.status(429).json({ success: false, message: `Demasiados intentos. Intenta de nuevo en ${minutos} min.` });
        return;
      }
      next();
    },
    registrarFallo(req: express.Request) {
      const ahora = Date.now();
      limpiar(ahora);
      const ip = ipDe(req);
      const r = registros.get(ip);
      if (!r || ahora - r.primerFallo > ventanaMs) {
        registros.set(ip, { fallos: 1, bloqueadoHasta: 0, primerFallo: ahora });
        return;
      }
      r.fallos += 1;
      if (r.fallos >= maxFallos) r.bloqueadoHasta = ahora + bloqueoMs;
    },
    registrarExito(req: express.Request) {
      registros.delete(ipDe(req));
    },
  };
}
