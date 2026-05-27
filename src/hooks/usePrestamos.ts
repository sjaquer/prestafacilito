import { useState, useCallback } from "react";
import { Prestamo, AjustePrestamo, EstadoDeudaPrestamo, Amortizacion } from "../types";

export function usePrestamos() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createPrestamo = async (prestamoData: {
    cliente_id: string;
    monto_capital: number;
    tasa_interes_porcentaje: number;
    fecha_emision: string;
    fecha_vencimiento: string | null;
    tipo_prestamo: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/prestamos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prestamoData),
      });

      if (res.ok) {
        const newLoan = await res.json();
        return { success: true, prestamo: newLoan };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo otorgar el préstamo." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    } finally {
      setLoading(false);
    }
  };

  const fetchLoanDetails = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${id}`);
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          prestamo: data.prestamo,
          pagosRealizados: data.pagosRealizados as Amortizacion[],
          ajustes: data.ajustes as AjustePrestamo[],
          planAyuda: data.planAyuda,
          deuda: data.deuda,
          cuotas: data.cuotas,
          cuotaSiguiente: data.cuota_siguiente,
          cuotasVencidasDetalle: data.cuotas_vencidas_detalle,
        };
      } else {
        const errData = await res.json();
        setError(errData.error || "No se pudieron cargar los detalles del préstamo.");
        return { success: false };
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePrestamo = async (
    id: string,
    data: {
      fecha_emision?: string;
      fecha_vencimiento?: string | null;
      monto_capital?: number;
      tasa_interes_porcentaje?: number;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const updated = await res.json();
        return { success: true, prestamo: updated };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo actualizar el préstamo." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error al conectar con el servidor." };
    } finally {
      setLoading(false);
    }
  };

  const createAdjustment = async (
    loanId: string,
    adjustment: {
      tipo: string;
      monto_afectado: number;
      cuota_numero?: number;
      fecha_inicio: string;
      fecha_fin?: string;
      periodo_gracia_dias?: number;
      descripcion?: string;
      usuario: string;
      motivo: string;
    }
  ) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${loanId}/ajustes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adjustment),
      });

      if (res.ok) {
        const newAdjustment = await res.json();
        return { success: true, ajuste: newAdjustment };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo crear la facilidad de pago." };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Error de red al aplicar ajuste." };
    } finally {
      setLoading(false);
    }
  };

  const toggleAdjustmentActive = async (loanId: string, ajusteId: string, active: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/prestamos/${loanId}/ajustes/${ajusteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: active }),
      });

      if (res.ok) {
        const updated = await res.json();
        return { success: true, ajuste: updated };
      } else {
        const errData = await res.json();
        return { success: false, error: errData.error || "No se pudo cambiar el estado del ajuste." };
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
    createPrestamo,
    fetchLoanDetails,
    updatePrestamo,
    createAdjustment,
    toggleAdjustmentActive,
  };
}
