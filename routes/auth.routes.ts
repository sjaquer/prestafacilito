import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../helpers/jwt.js";
import { requireAuth, cookieOptions, clearCookieOptions, AuthRequest } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";

const router = express.Router();

function getEnv(name: string) {
  return process.env[name]?.trim() || "";
}

const getPinForUser = (username: string) => {
  const envKey = `PIN_${username.trim().toUpperCase()}`;
  return getEnv(envKey);
};

router.post("/login", async (req: express.Request, res: express.Response) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ success: false, message: "Usuario y contraseña / PIN requeridos" });
      return;
    }

    const cleanUser = String(username).trim().toLowerCase();
    const expectedPin = getPinForUser(cleanUser);

    const isValid = !!(expectedPin && String(password) === expectedPin);

    if (isValid) {
      const token = jwt.sign({ username: cleanUser }, getJwtSecret(), { expiresIn: "24h" });
      res.cookie("token", token, cookieOptions);
      res.json({ success: true, username: cleanUser });
    } else {
      res.status(401).json({ success: false, message: "Usuario o contraseña / PIN de acceso incorrecto" });
    }
  } catch (err: any) {
    console.error("Error en /api/auth/login:", err);
    res.status(500).json({ success: false, message: "Error interno en la autenticación", detail: err.message });
  }
});

router.get("/me", (req: express.Request, res: express.Response) => {
  const token = req.cookies?.token;
  if (!token) {
    res.json({ authenticated: false });
    return;
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    res.json({ authenticated: true, user: (decoded as any).username });
  } catch (err) {
    res.json({ authenticated: false });
  }
});

router.post("/logout", requireAuth, async (req: AuthRequest, res: express.Response) => {
  res.clearCookie("token", clearCookieOptions);
  res.json({ success: true });
});

router.post("/initialize-sheets", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { error } = await supabase.from("clientes").select("id").limit(1);
    if (error) throw error;
    res.json({ success: true, message: "Conexión con Supabase verificada correctamente." });
  } catch (err: any) {
    console.error("Error de conectividad a Supabase:", err);
    res.status(500).json({ error: "No se pudo conectar a la base de datos de Supabase", detail: err.message });
  }
});

export default router;
