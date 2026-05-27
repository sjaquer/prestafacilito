import { useState, useCallback } from "react";
import { Amortizacion } from "../types";

export function usePagos() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const registerPago = async (
    loanId: string,
    pagoData: {
      monto: number;
      metodo_pago: string;
      fecha_pago: string;
      comprobante_url?: string | null;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${loanId}/pagos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pagoData),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo registrar el cobro." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    } finally {
      setLoading(false);
    }
  };

  const uploadVoucherToAmortizacion = async (
    pagoId: string,
    voucherData: { fileName: string; mimeType: string; base64Data: string }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/amortizaciones/${pagoId}/voucher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voucherData),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo asociar el comprobante." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al subir comprobante." };
    } finally {
      setLoading(false);
    }
  };

  const smartAutoSelectLoan = async (
    clienteId: string,
    monto: number,
    fechaPago?: string
  ) => {
    try {
      const res = await fetch("/api/prestamos/autoseleccionar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cliente_id: clienteId, monto, fecha_pago: fechaPago }),
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Error en autoseleccionar préstamo:", err);
    }
    return { success: false };
  };

  const fetchAmortizaciones = useCallback(async (): Promise<Amortizacion[]> => {
    try {
      setLoading(true);
      const res = await fetch("/api/amortizaciones");
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Error al cargar amortizaciones:", err);
    } finally {
      setLoading(false);
    }
    return [];
  }, []);

  const uploadVoucherDirectly = async (voucherData: {
    fileName: string;
    mimeType: string;
    base64Data: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/upload-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voucherData),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo procesar el voucher." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al subir voucher." };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    registerPago,
    uploadVoucherToAmortizacion,
    smartAutoSelectLoan,
    fetchAmortizaciones,
    uploadVoucherDirectly,
  };
}
