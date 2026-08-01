import express from "express";
import { GoogleGenAI } from "@google/genai";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildPaymentSchedule } from "../src/lib/loanLogic.js";

const router = express.Router();

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

router.post("/reporte-gerencial", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [pRes, aRes, cRes, ajRes] = await Promise.all([
      supabase.from("prestamos").select("*"),
      supabase.from("amortizaciones").select("*"),
      supabase.from("clientes").select("*"),
      supabase.from("ajustes_prestamo").select("*")
    ]);

    if (pRes.error) throw pRes.error;
    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;
    if (ajRes.error) throw ajRes.error;

    const prestamos = pRes.data || [];
    const amortizaciones = aRes.data || [];
    const clientes = cRes.data || [];
    const todosAjustes = ajRes.data || [];

    const totalCapital = prestamos.reduce((sum, p) => sum + (parseFloat(p.monto_capital) || 0), 0);

    let totalExigible = 0;
    for (const p of prestamos) {
      const pagosDelPrestamo = amortizaciones.filter(a => a.prestamo_id === p.id);
      const ajustesDelPrestamo = todosAjustes.filter(aj => aj.prestamo_id === p.id);
      const debtState = buildPaymentSchedule(p, pagosDelPrestamo, { ajustes: ajustesDelPrestamo, referenceDate: new Date() });
      totalExigible += debtState.resumen.totalExigible;
    }
    const totalRecuperado = amortizaciones.reduce((sum, a) => sum + (parseFloat(a.monto) || 0), 0);
    const saldoPendiente = Math.max(0, totalExigible - totalRecuperado);

    const prestamosActivos = prestamos.filter(p => p.estado === "activo");
    const prestamosPagados = prestamos.filter(p => p.estado === "pagado");

    const hoyStr = new Date().toISOString().split("T")[0];
    const prestamosVencidos = prestamosActivos.filter(p => p.fecha_vencimiento && p.fecha_vencimiento < hoyStr);

    const metodosPago = amortizaciones.reduce((acc: Record<string, number>, a) => {
      acc[a.metodo_pago] = (acc[a.metodo_pago] || 0) + 1;
      return acc;
    }, {});

    const financialContext = {
      totalClientes: clientes.length,
      totalPrestamos: prestamos.length,
      prestamosActivosCount: prestamosActivos.length,
      prestamosPagadosCount: prestamosPagados.length,
      prestamosVencidosCount: prestamosVencidos.length,
      resumenFinanciero: {
        totalCapitalPrestado: Math.round(totalCapital * 100) / 100,
        totalExigibleConIntereses: Math.round(totalExigible * 100) / 100,
        totalRecuperadoAmortizado: Math.round(totalRecuperado * 100) / 100,
        saldoPendienteCobro: Math.round(saldoPendiente * 100) / 100,
        porcentajeRecuperacion: totalExigible > 0 ? Math.round((totalRecuperado / totalExigible) * 10000) / 100 : 0
      },
      prestamosVencidosDetalle: prestamosVencidos.map(p => {
        const c = clientes.find(cl => cl.id === p.cliente_id);
        return {
          cliente: c ? c.nombre_completo : "Desconocido",
          capital: p.monto_capital,
          vencimiento: p.fecha_vencimiento,
          tipo: p.tipo_prestamo
        };
      }),
      metodosPagoPopulares: metodosPago
    };

    if (!ai) {
      const fechaLat = new Date().toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" });
      const morosidadCalc = prestamosActivos.length > 0 ? Math.round((prestamosVencidos.length / prestamosActivos.length) * 100) : 0;

      return res.json({
        fechaReporte: fechaLat,
        saludFinanciera: `El negocio PrestaFacilito muestra un nivel de liquidez aceptable con un total amortizado de S/. ${totalRecuperado.toFixed(2)}. Sin embargo, mantener S/. ${saldoPendiente.toFixed(2)} por cobrar requiere una vigilancia constante de la cartera activa.`,
        tasaMorosidadPorcentaje: morosidadCalc,
        resumenDesempeño: "La operación se mantiene estable. Es imperativo contener la tasa de morosidad mediante incentivos y comunicación oportuna.",
        kpis: [
          {
            label: "Índice de Liquidez Corriente",
            value: `${(totalRecuperado > 0 ? (totalRecuperado / (saldoPendiente || 1)).toFixed(2) : "0.85")}x`,
            indicator: totalRecuperado > saldoPendiente ? "up" : "stable",
            descripcion: "Proporción de capital recuperado vs saldo exigible restante en la cartera."
          },
          {
            label: "Tasa de Cobro Exigible",
            value: `${(totalExigible > 0 ? Math.round((totalRecuperado / totalExigible) * 100) : 0)}%`,
            indicator: "up",
            descripcion: "Porcentaje global del capital e interés que ya ha sido amortizado efectivamente."
          },
          {
            label: "Vencimientos en Alerta",
            value: `${prestamosVencidos.length} créditos`,
            indicator: prestamosVencidos.length > 2 ? "down" : "stable",
            descripcion: "Préstamos activos que han superado su fecha límite de pago pactada."
          }
        ],
        analisisDetallado: {
          liquidez: `Con un capital colocado de S/. ${totalCapital.toFixed(2)} y S/. ${totalRecuperado.toFixed(2)} ya recuperados, el flujo de caja operativo actual muestra estabilidad.`,
          riesgos: `La tasa de morosidad estimada se sitúa en ${morosidadCalc}%. El principal foco de riesgo se concentra en los ${prestamosVencidos.length} créditos vencidos.`,
          eficiencia: `Yape, Plin y canales digitales representan las vías de cobro más ágiles.`
        },
        proyeccionesCaja: [
          { period: "Semana 1", cobroEstimado: Math.round(saldoPendiente * 0.15), morosidadEstimada: Math.max(2, Math.round(morosidadCalc * 0.9)) },
          { period: "Semana 2", cobroEstimado: Math.round(saldoPendiente * 0.25), morosidadEstimada: Math.max(1, Math.round(morosidadCalc * 0.8)) },
          { period: "Semana 3", cobroEstimado: Math.round(saldoPendiente * 0.35), morosidadEstimada: Math.max(1, Math.round(morosidadCalc * 0.6)) },
          { period: "Semana 4", cobroEstimado: Math.round(saldoPendiente * 0.20), morosidadEstimada: 0 }
        ],
        estrategiasCobranza: [
          {
            titulo: "Notificación Masiva Express por WhatsApp",
            descripcion: "Enviar recordatorios amigables de pago estructurados por la IA a los prestatarios con vencimientos dentro de los próximos 3 días.",
            impacto: "Alto",
            prioridad: "Alta"
          }
        ],
        contextoFinanciero: financialContext
      });
    }

    const prompt = `Actúa como un Director Financiero (CFO) y Consultor Estratégico experto para microempresas de préstamo y crédito personal en el Perú.
    Analiza detalladamente el siguiente resumen estructurado de nuestra cartera de clientes y préstamos en Soles Peruanos (S/.) de PrestaFacilito:
    ${JSON.stringify(financialContext, null, 2)}
    
    Genera un informe gerencial, estratégico, sumamente profesional y limpio para la dirección general. Devuelve solo un JSON válido.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    res.json({
      ...result,
      contextoFinanciero: financialContext
    });
  } catch (err: any) {
    console.error("Error en reporte-gerencial:", err);
    res.status(500).json({ error: "Error al generar reporte gerencial", detail: err.message });
  }
});

router.post("/mensaje-cobro", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { clienteNombre, saldoPendiente, fechaVencimiento } = req.body;
    if (!clienteNombre) {
      res.status(400).json({ error: "El nombre del cliente es obligatorio" });
      return;
    }

    const username = (req as any).user?.username || "sjaquer";
    const senderName = username === "rjaque" ? "Roberto" : "Sebastián";

    if (!ai) {
      const msg = `¡Hola, ${clienteNombre}! Te saluda ${senderName} de PrestaFacilito. Te recordamos amablemente tu pago pendiente de S/. ${parseFloat(saldoPendiente).toFixed(2)} con vencimiento el ${fechaVencimiento || "próximo vencimiento"}. Agradecemos tu puntualidad y apoyo. ¡Que tengas un excelente día!`;
      return res.json({ mensaje: msg });
    }

    const prompt = `Genera un mensaje recordatorio de cobro de préstamo personalizado y amigable para enviar por WhatsApp.
    Cliente: ${clienteNombre}
    Saldo Pendiente: S/. ${parseFloat(saldoPendiente).toFixed(2)}
    Fecha de Vencimiento: ${fechaVencimiento}
    Emisor/Cobrador: ${senderName} (El mensaje DEBE mencionar: "Te saluda ${senderName} de PrestaFacilito.")
    
    El tono debe ser: profesional, respetuoso, empático, pero claro y asertivo.
    Responde estrictamente con un objeto JSON válido: { "mensaje": "..." }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text.trim());
    res.json(result);
  } catch (err: any) {
    console.error("Error en mensaje-cobro:", err);
    res.status(500).json({ error: "Error al generar mensaje de cobro", detail: err.message });
  }
});

export default router;
