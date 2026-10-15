import express from "express";
import fs from "fs";
import path from "path";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { requireAuth, cookieOptions, clearCookieOptions } from "../middleware/auth.js";
import { isGoogleCalendarConfigured, sincronizarCalendario } from "../services/google-calendar.js";
import {
  getGoogleClientId,
  getGoogleClientSecret
} from "../services/google-drive.js";

const router = express.Router();

const getRedirectUri = (req: express.Request) => {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.get("host");
  return `${protocol}://${host}/api/auth/google/callback`;
};

const OAUTH_STATE_COOKIE = "google_oauth_state";

// Solo un usuario con sesión puede vincular la cuenta de Google de la app
router.get("/google/login", requireAuth, (req: express.Request, res: express.Response) => {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  if (!clientId || !clientSecret) {
    res.status(400).send("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo .env");
    return;
  }

  const redirectUri = getRedirectUri(req);
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

  // `state` aleatorio contra CSRF: el callback solo acepta la respuesta de este mismo navegador
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(OAUTH_STATE_COOKIE, state, { ...cookieOptions, maxAge: 10 * 60 * 1000 });

  const authUrl = oauth2Client.generateAuthUrl({
    state,
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/calendar"
    ],
    prompt: "consent"
  });

  res.redirect(authUrl);
});

router.get("/google/callback", requireAuth, async (req: express.Request, res: express.Response) => {
  const code = req.query.code as string;
  const state = String(req.query.state || "");
  const expectedState = req.cookies?.[OAUTH_STATE_COOKIE];
  res.clearCookie(OAUTH_STATE_COOKIE, clearCookieOptions);

  if (!code) {
    res.status(400).send("Código de autorización ausente.");
    return;
  }
  if (!expectedState || state.length !== expectedState.length || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState))) {
    res.status(400).send("Solicitud de autorización inválida o expirada. Vuelve a intentarlo desde la app.");
    return;
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();

  const redirectUri = getRedirectUri(req);
  const oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
            <div style="max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #ef4444;">
              <h2 style="color: #f87171;">⚠️ ¡Error al obtener el Refresh Token!</h2>
              <p>Google no ha devuelto un <code>refresh_token</code>.</p>
              <p>Esto ocurre porque ya habías autorizado la aplicación antes. Para solucionarlo:</p>
              <ol>
                <li>Ve a la configuración de tu cuenta de Google.</li>
                <li>Elimina el acceso de la aplicación.</li>
                <li>Vuelve a intentar ingresar a: <a href="/api/auth/google/login" style="color: #60a5fa;">/api/auth/google/login</a></li>
              </ol>
            </div>
          </body>
        </html>
      `);
      return;
    }

    let envWriteStatus = "No se pudo escribir en el archivo .env automáticamente.";
    let envWriteSuccess = false;
    try {
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf8");
        if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}`;
        }
        fs.writeFileSync(envPath, envContent, "utf8");
        envWriteStatus = "¡Guardado automáticamente en tu archivo <code>.env</code>!";
        envWriteSuccess = true;
      }
      process.env.GOOGLE_REFRESH_TOKEN = refreshToken;
    } catch (fsErr: any) {
      console.warn("No se pudo escribir en el archivo .env:", fsErr);
    }

    const manualCopyBlock = envWriteSuccess
      ? ""
      : `
            <div style="margin-top: 18px; background: #0f172a; border: 1px dashed #f59e0b; border-radius: 10px; padding: 16px;">
              <p style="color: #fbbf24; font-weight: bold; margin: 0 0 8px;">El token quedó activo solo en esta instancia del servidor.</p>
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">Para que sea permanente, copia <code>GOOGLE_REFRESH_TOKEN</code> desde los logs del servidor (no se muestra aquí por seguridad) a las variables de entorno de Vercel (Production).</p>
            </div>
      `;
    if (!envWriteSuccess) {
      console.warn("[GOOGLE] Nuevo GOOGLE_REFRESH_TOKEN (guárdalo en las variables de entorno):", refreshToken);
    }

    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; background: #0f172a; color: #f8fafc;">
          <div style="max-width: 600px; margin: 40px auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #3b82f6; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
            <h2 style="color: #4ade80; margin-top: 0;">🎉 ¡Autenticación de Google Exitosa!</h2>
            <p>Hemos obtenido tu <b>Refresh Token</b> de larga duración de forma segura.</p>
            <p><b>Estado del archivo .env:</b> <span style="color: #4ade80; font-weight: bold;">${envWriteStatus}</span></p>
            ${manualCopyBlock}
            <a href="/" style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: bold; margin-top: 15px;">
              Volver a PrestaFacilito
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).send(`Error al intercambiar el código por tokens: ${error.message}`);
  }
});

/** Sincronización completa a pedido (botón en la app). */
const handlerSincronizar = async (_req: express.Request, res: express.Response) => {
  if (!isGoogleCalendarConfigured()) {
    res.status(503).json({ success: false, error: "Google Calendar no está configurado." });
    return;
  }
  try {
    const r = await sincronizarCalendario();
    res.json({
      success: true,
      ...r,
      message: `Calendario al día: ${r.creados} creados, ${r.actualizados} actualizados, ${r.eliminados + r.antiguosEliminados} eliminados.`,
    });
  } catch (err: any) {
    console.error("Error al sincronizar el calendario:", err);
    res.status(500).json({ success: false, error: "Error al sincronizar el calendario", detail: err.message });
  }
};

router.post("/calendar/sincronizar", requireAuth, handlerSincronizar);

/**
 * Sincronización diaria automática (Vercel Cron, ver vercel.json).
 * Vercel envía `Authorization: Bearer <CRON_SECRET>`; sin CRON_SECRET configurado, la ruta queda deshabilitada.
 */
router.get("/cron/calendario", async (req: express.Request, res: express.Response) => {
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
  try {
    const r = await sincronizarCalendario();
    console.log("[Cron calendario]", r);
    res.json({ success: true, ...r });
  } catch (err: any) {
    console.error("[Cron calendario] Error:", err);
    res.status(500).json({ success: false, detail: err.message });
  }
});

export default router;
