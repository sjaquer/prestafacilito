import express from "express";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { supabase } from "../src/lib/supabase.js";
import { buildAlquilerSchedule } from "../src/lib/alquilerLogic.js";

const router = express.Router();

// Listar todos los alquileres
router.get("/", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const [aRes, cRes, pRes] = await Promise.all([
      supabase.from("alquileres").select("*").order("fecha_registro", { ascending: false }),
      supabase.from("clientes").select("id, nombre_completo, apodo, telefono"),
      supabase.from("pagos_alquiler").select("*")
    ]);

    if (aRes.error) throw aRes.error;
    if (cRes.error) throw cRes.error;
    if (pRes.error) throw pRes.error;

    const alquileres = aRes.data || [];
    const clientes = cRes.data || [];
    const pagos = pRes.data || [];

    const resultado = alquileres.map(al => {
      const cliente = clientes.find(c => c.id === al.cliente_id);
      const pagosAlquiler = pagos.filter(p => p.alquiler_id === al.id);
      const estadoAlquiler = buildAlquilerSchedule(al, pagosAlquiler);

      return {
        ...al,
        cliente_nombre: cliente?.nombre_completo || "Desconocido",
        cliente_apodo: cliente?.apodo || "",
        cliente_telefono: cliente?.telefono || "",
        estado_calculado: estadoAlquiler
      };
    });

    res.json(resultado);
  } catch (err: any) {
    console.error("Error al listar alquileres:", err);
    res.status(500).json({ error: "Error al listar alquileres", detail: err.message });
  }
});

// Detalle de un alquiler específico
router.get("/:id", requireAuth, async (req: express.Request, res: express.Response) => {
  try {
    const { id } = req.params;

    const [aRes, pRes] = await Promise.all([
      supabase.from("alquileres").select("*").eq("id", id).single(),
      supabase.from("pagos_alquiler").select("*").eq("alquiler_id", id).order("fecha_pago", { ascending: true })
    ]);

    if (aRes.error) throw aRes.error;
    if (pRes.error) throw pRes.error;

    const alquiler = aRes.data;
    const pagos = pRes.data || [];

    const clienteRes = await supabase
      .from("clientes")
      .select("*")
      .eq("id", alquiler.cliente_id)
      .single();

    const estadoAlquiler = buildAlquilerSchedule(alquiler, pagos);

    res.json({
      alquiler,
      cliente: clienteRes.data || null,
      pagos,
      estado_calculado: estadoAlquiler
    });
  } catch (err: any) {
    console.error("Error al obtener detalle del alquiler:", err);
    res.status(500).json({ error: "Error al obtener alquiler", detail: err.message });
  }
});

// Crear nuevo contrato de alquiler
router.post("/", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { cliente_id, monto_mensual, descripcion_inmueble, fecha_inicio, fecha_fin, notas } = req.body;

    if (!cliente_id || !monto_mensual) {
      res.status(400).json({ error: "El cliente y el monto mensual son requeridos" });
      return;
    }

    const { data, error } = await supabase
      .from("alquileres")
      .insert({
        cliente_id,
        monto_mensual: parseFloat(monto_mensual),
        descripcion_inmueble: descripcion_inmueble || '',
        fecha_inicio: fecha_inicio || new Date().toISOString().split("T")[0],
        fecha_fin: fecha_fin || null,
        estado: 'activo',
        notas: notas || ''
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al crear alquiler:", err);
    res.status(500).json({ error: "Error al crear alquiler", detail: err.message });
  }
});

// Editar contrato de alquiler
router.put("/:id", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    const { monto_mensual, descripcion_inmueble, fecha_inicio, fecha_fin, estado, notas } = req.body;

    const updateData: any = {};
    if (monto_mensual !== undefined) updateData.monto_mensual = parseFloat(monto_mensual);
    if (descripcion_inmueble !== undefined) updateData.descripcion_inmueble = descripcion_inmueble;
    if (fecha_inicio !== undefined) updateData.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) updateData.fecha_fin = fecha_fin;
    if (estado !== undefined) updateData.estado = estado;
    if (notas !== undefined) updateData.notas = notas;

    const { data, error } = await supabase
      .from("alquileres")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("Error al actualizar alquiler:", err);
    res.status(500).json({ error: "Error al actualizar alquiler", detail: err.message });
  }
});

// Registrar pago de alquiler
router.post("/:id/pagos", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;
    const { monto, fecha_pago, periodo_mes, periodo_anio, metodo_pago, comprobante_url, voucher_drive_file_id } = req.body;

    if (!monto || !periodo_mes || !periodo_anio) {
      res.status(400).json({ error: "Monto, periodo_mes y periodo_anio son requeridos" });
      return;
    }

    const { data, error } = await supabase
      .from("pagos_alquiler")
      .insert({
        alquiler_id: id,
        monto: parseFloat(monto),
        fecha_pago: fecha_pago || new Date().toISOString().split("T")[0],
        periodo_mes: parseInt(periodo_mes, 10),
        periodo_anio: parseInt(periodo_anio, 10),
        metodo_pago: metodo_pago || "Efectivo",
        comprobante_url: comprobante_url || null,
        voucher_drive_file_id: voucher_drive_file_id || null,
        es_pago_completo: true
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err: any) {
    console.error("Error al registrar pago de alquiler:", err);
    res.status(500).json({ error: "Error al registrar pago de alquiler", detail: err.message });
  }
});

// Eliminar pago de alquiler
router.delete("/:id/pagos/:pagoId", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { pagoId } = req.params;

    const { error } = await supabase
      .from("pagos_alquiler")
      .delete()
      .eq("id", pagoId);

    if (error) throw error;
    res.json({ message: "Pago de alquiler eliminado correctamente" });
  } catch (err: any) {
    console.error("Error al eliminar pago de alquiler:", err);
    res.status(500).json({ error: "Error al eliminar pago de alquiler", detail: err.message });
  }
});

// Finalizar contrato de alquiler (Fase 8)
router.put("/:id/finalizar", requireAuth, async (req: AuthRequest, res: express.Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("alquileres")
      .update({
        estado: "finalizado",
        fecha_fin: new Date().toISOString().split("T")[0]
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, alquiler: data });
  } catch (err: any) {
    console.error("Error al finalizar contrato de alquiler:", err);
    res.status(500).json({ error: "Error al finalizar contrato de alquiler", detail: err.message });
  }
});

export default router;
