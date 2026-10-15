import { useCallback, useEffect, useState } from "react";
import { hoyISO, toISODateLocal } from "../lib/fechas";

export interface Movimiento {
  id: string;
  fecha_pago: string;
  monto: number;
  metodo_pago: string;
  cliente_nombre: string;
  cliente_apodo?: string;
  tipo_operacion: "prestamo" | "alquiler";
  ref_id?: string;
  detalle: string;
  comprobante_url?: string | null;
}

export type Periodo = "hoy" | "semana" | "mes" | "mes_anterior" | "todo";

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Este mes" },
  { id: "mes_anterior", label: "Mes pasado" },
  { id: "todo", label: "Todo" },
];

/** Rango [desde, hasta] (YYYY-MM-DD, inclusivo) de un período, en hora local. */
export function rangoPeriodo(periodo: Periodo, ahora = new Date()): [string, string] | null {
  const hoy = toISODateLocal(ahora);
  switch (periodo) {
    case "hoy":
      return [hoy, hoy];
    case "semana": {
      const diaSemana = (ahora.getDay() + 6) % 7; // lunes = 0
      const lunes = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diaSemana);
      return [toISODateLocal(lunes), hoy];
    }
    case "mes":
      return [toISODateLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 1)), hoy];
    case "mes_anterior":
      return [
        toISODateLocal(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)),
        toISODateLocal(new Date(ahora.getFullYear(), ahora.getMonth(), 0)),
      ];
    default:
      return null;
  }
}

export const filtrarPorPeriodo = <T extends { fecha_pago: string }>(lista: T[], periodo: Periodo) => {
  const rango = rangoPeriodo(periodo);
  if (!rango) return lista;
  return lista.filter((m) => {
    const f = String(m.fecha_pago).slice(0, 10);
    return f >= rango[0] && f <= rango[1];
  });
};

/** Todos los pagos recibidos (préstamos y alquileres), del más reciente al más antiguo. */
export function useMovimientosCuentas() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizado, setActualizado] = useState<string>(hoyISO());

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/llegada-cuentas");
      if (res.ok) {
        const data = await res.json();
        setMovimientos(data.allPayments || []);
        setActualizado(hoyISO());
      }
    } catch (err) {
      console.error("Error al cargar movimientos de cuentas:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { movimientos, loading, recargar: cargar, actualizado };
}
