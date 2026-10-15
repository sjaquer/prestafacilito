import "dotenv/config";
import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import app from "./server-app.js";
import { sincronizarCalendario } from "./services/google-calendar.js";

const PORT = Number(process.env.PORT || 3000);
const httpServer = http.createServer(app);

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 Starting development server with Vite middleware & HMR binding...");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server: httpServer }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("📦 Starting production server serving static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Fuera de Vercel no hay cron: sincronización diaria opcional del calendario.
  // Desactivada por defecto para que un entorno local no modifique el calendario real.
  if (process.env.ENABLE_CALENDAR_CRON === "true") {
    const correr = () =>
      sincronizarCalendario()
        .then((r) => console.log("[Calendario] Sincronización diaria:", r))
        .catch((err) => console.error("[Calendario] Error en sincronización diaria:", err.message));
    correr();
    setInterval(correr, 24 * 60 * 60 * 1000);
  }
}

startServer().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
