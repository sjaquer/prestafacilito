import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { getJwtSecret } from "./helpers/jwt.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import { prestamosRouter, amortizacionesRouter } from "./routes/prestamos.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import driveRoutes from "./routes/drive.routes.js";
import calendarRoutes from "./routes/calendar.routes.js";
import alquileresRoutes from "./routes/alquileres.routes.js";
import biRoutes from "./routes/bi.routes.js";
import backupRoutes from "./routes/backup.routes.js";

// Validar JWT_SECRET al arrancar
getJwtSecret();

const app = express();

// Middlewares de seguridad
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet, noodp, noydir");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: blob: https://*.googleusercontent.com https://*.googleapis.com; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com; " +
    "frame-src 'self' https://docs.google.com https://drive.google.com;"
  );
  next();
});

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(cookieParser());

// Montaje de rutas modularizadas
app.use("/api/auth", authRoutes);
app.use("/api/clientes", clientesRoutes);
app.use("/api/prestamos", prestamosRouter);
app.use("/api/amortizaciones", amortizacionesRouter);
app.use("/api/alquileres", alquileresRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/drive", driveRoutes);
app.use("/api", driveRoutes);
app.use("/api/auth", calendarRoutes);
app.use("/api", calendarRoutes);
app.use("/api/bi", biRoutes);
app.use("/api/backup", backupRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Middleware global de manejo de errores
app.use(globalErrorHandler);

export default app;
