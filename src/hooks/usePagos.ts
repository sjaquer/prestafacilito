import { useState, useCallback } from "react";
import { Amortizacion } from "../types";

export function usePagos() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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

  const updatePago = async (
    pagoId: string,
    pagoData: {
      fecha_pago?: string;
      prestamo_id?: string;
      monto?: number;
      metodo_pago?: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/amortizaciones/${pagoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pagoData),
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo actualizar el pago." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    } finally {
      setLoading(false);
    }
  };

  const deletePago = async (pagoId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/amortizaciones/${pagoId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo eliminar el pago." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchAmortizaciones,
    updatePago,
    deletePago,
  };
}
