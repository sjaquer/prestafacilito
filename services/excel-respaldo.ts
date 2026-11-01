import * as XLSX from "xlsx";
import { supabase } from "../src/lib/supabase.js";

import { traerTodasLasPaginas } from "./consultas.js";

const traerTodo = (tabla: string, orden: string, ascendente = false): Promise<any[]> =>
  traerTodasLasPaginas(
    (desde, hasta) =>
      supabase
        .from(tabla)
        .select("*")
        .order(orden, { ascending: ascendente })
        .order("id", { ascending: true })
        .range(desde, hasta),
    `la tabla ${tabla}`
  );

/** Excel con toda la información del negocio (una hoja por tabla). Falla si alguna tabla no se puede leer. */
export async function generarExcelRespaldo(): Promise<Buffer> {
  const [clientes, prestamos, amortizaciones, alquileres, pagosAlquiler, documentos] = await Promise.all([
    traerTodo("clientes", "nombre_completo", true),
    traerTodo("prestamos", "fecha_emision"),
    traerTodo("amortizaciones", "fecha_pago"),
    traerTodo("alquileres", "fecha_inicio"),
    traerTodo("pagos_alquiler", "fecha_pago"),
    traerTodo("documentos_cliente", "fecha_subida"),
  ]);

  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre_completo]));
  const clienteDePrestamo = new Map(prestamos.map((p) => [p.id, p.cliente_id]));
  const clienteDeAlquiler = new Map(alquileres.map((a) => [a.id, a.cliente_id]));

  const libro = XLSX.utils.book_new();
  const hoja = (filas: Record<string, unknown>[], nombre: string) =>
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), nombre);

  hoja(
    clientes.map((c) => ({
      "ID Cliente": c.id,
      "Nombre Completo": c.nombre_completo,
      Apodo: c.apodo || "",
      Teléfono: c.telefono || "",
      Dirección: c.direccion || "",
      Banco: c.banco_cuenta || "",
      "Número de Cuenta": c.numero_cuenta || "",
      Observaciones: c.observaciones || "",
      "Información Adicional": c.informacion_adicional || "",
      "Fecha Registro": c.fecha_registro || "",
    })),
    "Clientes"
  );

  hoja(
    prestamos.map((p) => ({
      "ID Préstamo": p.id,
      "ID Cliente": p.cliente_id,
      Cliente: nombreCliente.get(p.cliente_id) || "",
      "Tipo Préstamo": p.tipo_prestamo,
      "Monto Capital (S/)": p.monto_capital,
      "Tasa Interés (%)": p.tasa_interes_porcentaje,
      "Día Cobro Mensual": p.dia_vencimiento_mes || "",
      "Fecha Emisión": p.fecha_emision,
      "Fecha Vencimiento": p.fecha_vencimiento || "",
      Estado: p.estado,
      Notas: p.notas || "",
    })),
    "Préstamos"
  );

  hoja(
    amortizaciones.map((a) => ({
      "ID Pago": a.id,
      "ID Préstamo": a.prestamo_id,
      Cliente: nombreCliente.get(clienteDePrestamo.get(a.prestamo_id)) || "",
      "Monto Pagado (S/)": a.monto,
      "Fecha Pago": a.fecha_pago,
      "Método Pago": a.metodo_pago || "Efectivo",
      "Comprobante(s)": a.comprobante_url || "",
    })),
    "Pagos de Préstamos"
  );

  hoja(
    alquileres.map((alq) => ({
      "ID Alquiler": alq.id,
      "ID Cliente (Inquilino)": alq.cliente_id,
      Inquilino: nombreCliente.get(alq.cliente_id) || "",
      "Inmueble / Descripción": alq.descripcion_inmueble,
      "Monto Mensual (S/)": alq.monto_mensual,
      "Fecha Inicio": alq.fecha_inicio,
      "Fecha Fin": alq.fecha_fin || "",
      Estado: alq.estado,
      Notas: alq.notas || "",
    })),
    "Alquileres"
  );

  hoja(
    pagosAlquiler.map((pa) => ({
      "ID Pago": pa.id,
      "ID Alquiler": pa.alquiler_id,
      Inquilino: nombreCliente.get(clienteDeAlquiler.get(pa.alquiler_id)) || "",
      "Período Mes": pa.periodo_mes,
      "Período Año": pa.periodo_anio,
      "Monto (S/)": pa.monto,
      "Fecha Pago": pa.fecha_pago,
      "Método Pago": pa.metodo_pago || "Efectivo",
      "Es Pago Completo": pa.es_pago_completo ? "Sí" : "No",
      "Comprobante(s)": pa.comprobante_url || "",
    })),
    "Pagos de Alquiler"
  );

  hoja(
    documentos.map((d) => ({
      "ID Documento": d.id,
      "ID Cliente": d.cliente_id,
      Cliente: nombreCliente.get(d.cliente_id) || "",
      Tipo: d.tipo_documento,
      "Nombre Archivo": d.nombre_archivo,
      "Ruta en Storage": d.storage_path || "",
      "Fecha Subida": d.fecha_subida || "",
      Observación: d.observacion || "",
    })),
    "Documentos de Clientes"
  );

  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
