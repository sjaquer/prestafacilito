import express from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret, getAdminUser, getAdminPass } from "../helpers/jwt.js";
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
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, message: "Usuario y PIN de acceso requeridos" });
    return;
  }

  const cleanUser = username.trim().toLowerCase();
  const expectedPin = getPinForUser(cleanUser);

  const adminUser = getAdminUser();
  const adminPass = getAdminPass();
  const isAdminValid = !!(adminUser && adminPass &&
    cleanUser === adminUser.toLowerCase() && password === adminPass);

  const isValid = !!((expectedPin && password === expectedPin) || isAdminValid);

  if (isValid) {
    const token = jwt.sign({ username: cleanUser }, getJwtSecret(), { expiresIn: "24h" });
    res.cookie("token", token, cookieOptions);
    res.json({ success: true, username: cleanUser });
  } else {
    res.status(401).json({ success: false, message: "Usuario o PIN de acceso incorrecto" });
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

// Seed endpoint - TAREA 1.2.4: Deshabilitar en producción
router.post("/seed", requireAuth, async (req: AuthRequest, res: express.Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Este endpoint solo está disponible en desarrollo." });
    return;
  }

  try {
    const { data: existing, error: checkErr } = await supabase.from("clientes").select("id").limit(1);
    if (checkErr) throw checkErr;

    if (existing && existing.length > 0) {
      res.json({
        success: false,
        message: "La base de datos ya contiene registros. Se omitió la siembra para evitar duplicados."
      });
      return;
    }

    const clientesSeed = [
      {
        nombre_completo: "Sofía Vergara Ramos",
        telefono: "57 3201234567",
        observaciones: "Clienta habitual, comerciante de calzado."
      },
      {
        nombre_completo: "Alejandro Mendoza Soler",
        telefono: "52 5598765432",
        observaciones: "Crédito comercial para ampliación de panadería tradicional."
      },
      {
        nombre_completo: "Mariana Silva Duarte",
        telefono: "54 9114321098",
        observaciones: "Firma de préstamo personal con aval de propiedad familiar."
      }
    ];

    const { data: insertedClientes, error: insertClientsErr } = await supabase
      .from("clientes")
      .insert(clientesSeed)
      .select();

    if (insertClientsErr) throw insertClientsErr;

    const sc1 = insertedClientes.find(c => c.nombre_completo.includes("Sofía"));
    const sc2 = insertedClientes.find(c => c.nombre_completo.includes("Alejandro"));
    const sc3 = insertedClientes.find(c => c.nombre_completo.includes("Mariana"));

    const prestamosSeed = [
      {
        cliente_id: sc1?.id,
        monto_capital: 1500.0,
        tasa_interes: 10.0,
        duracion_meses: 3,
        frecuencia_pago: "Mensual",
        tipo_prestamo: "Personal",
        monto_total_con_interes: 1650.0,
        total_a_pagar: 1650.0,
        total_exigible_actual: 1650.0,
        fecha_emision: "2025-01-10",
        fecha_vencimiento: "2025-04-10",
        estado: "Activo"
      },
      {
        cliente_id: sc2?.id,
        monto_capital: 4000.0,
        tasa_interes: 12.0,
        duracion_meses: 6,
        frecuencia_pago: "Quincenal",
        tipo_prestamo: "Negocio",
        monto_total_con_interes: 4480.0,
        total_a_pagar: 4480.0,
        total_exigible_actual: 4480.0,
        fecha_emision: "2025-01-15",
        fecha_vencimiento: "2025-07-15",
        estado: "Activo"
      },
      {
        cliente_id: sc3?.id,
        monto_capital: 800.0,
        tasa_interes: 8.0,
        duracion_meses: 2,
        frecuencia_pago: "Semanal",
        tipo_prestamo: "Personal",
        monto_total_con_interes: 864.0,
        total_a_pagar: 864.0,
        total_exigible_actual: 864.0,
        fecha_emision: "2025-02-01",
        fecha_vencimiento: "2025-04-01",
        estado: "Activo"
      }
    ];

    const { error: insertLoansErr } = await supabase.from("prestamos").insert(prestamosSeed);
    if (insertLoansErr) throw insertLoansErr;

    res.json({
      success: true,
      message: "Base de datos poblada exitosamente con 3 clientes y préstamos iniciales de prueba."
    });
  } catch (err: any) {
    console.error("Error al sembrar base de datos:", err);
    res.status(500).json({ error: "Error al sembrar la base de datos", detail: err.message });
  }
});

export default router;
