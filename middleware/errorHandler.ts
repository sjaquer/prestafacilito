import express from "express";

export const globalErrorHandler = (
  err: Error,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  console.error("Error no controlado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    detail: process.env.NODE_ENV !== "production" ? err.message : undefined
  });
};
