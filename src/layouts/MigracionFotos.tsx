import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ImageDown, Loader2 } from "lucide-react";
import { comprimirImagen, partesDataUrl } from "../lib/imageCompression";
import { useFeedback } from "../components/ui/Feedback";

interface Pendiente {
  tabla: "amortizaciones" | "pagos_alquiler" | "documentos_cliente";
  id: string;
  driveId: string;
  tipo: "comprobante" | "documento";
  etiqueta: string;
}

/** Archivos en paralelo (de filas distintas). Más no acelera: el cuello es Drive. */
const EN_PARALELO = 3;

/**
 * Migración única de fotos antiguas de Drive a Storage, desde el navegador:
 * descarga cada una por el proxy de Drive, la comprime con el mismo compresor de la app y la sube.
 * Solo se muestra mientras queden fotos en Drive.
 */
export const MigracionFotos: React.FC = () => {
  const { notify } = useFeedback();
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);
  const [migrando, setMigrando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, fallidos: 0, total: 0, ahorroKb: 0 });

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/archivos-migracion/pendientes");
      if (!res.ok) return setPendientes(null); // sin Storage configurado aún: no mostrar nada
      setPendientes((await res.json()).pendientes || []);
    } catch {
      setPendientes(null);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const migrarUno = async (p: Pendiente): Promise<number> => {
    const proxy = p.tabla === "documentos_cliente" ? "documentos" : "vouchers";
    const res = await fetch(`/api/${proxy}/proxy/${encodeURIComponent(p.driveId)}`);
    if (!res.ok) throw new Error(`No se pudo descargar de Drive (${res.status})`);
    const original = await res.blob();

    const { mimeType, base64Data } = partesDataUrl(await comprimirImagen(original, p.tipo));
    const guardar = await fetch("/api/archivos-migracion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tabla: p.tabla, id: p.id, driveId: p.driveId, fileName: p.tipo === "documento" ? p.etiqueta : "comprobante", mimeType, base64Data }),
    });
    if (!guardar.ok) throw new Error((await guardar.json().catch(() => ({}))).error || "No se pudo guardar");
    return Math.max(0, original.size - (base64Data.length * 3) / 4) / 1024;
  };

  const migrar = async () => {
    if (!pendientes?.length) return;
    setMigrando(true);
    setProgreso({ hechos: 0, fallidos: 0, total: pendientes.length, ahorroKb: 0 });

    // Las fotos de un mismo pago se procesan en orden (actualizan la misma fila); filas distintas, en paralelo
    const porFila = new Map<string, Pendiente[]>();
    for (const p of pendientes) porFila.set(`${p.tabla}:${p.id}`, [...(porFila.get(`${p.tabla}:${p.id}`) || []), p]);
    const grupos = [...porFila.values()];
    const errores: string[] = [];

    const trabajador = async () => {
      for (let g = grupos.shift(); g; g = grupos.shift()) {
        for (const p of g) {
          try {
            const ahorro = await migrarUno(p);
            setProgreso((s) => ({ ...s, hechos: s.hechos + 1, ahorroKb: s.ahorroKb + ahorro }));
          } catch (err: any) {
            errores.push(`${p.etiqueta}: ${err.message}`);
            setProgreso((s) => ({ ...s, fallidos: s.fallidos + 1 }));
          }
        }
      }
    };
    await Promise.all(Array.from({ length: EN_PARALELO }, trabajador));

    setMigrando(false);
    await cargar();
    if (errores.length) {
      console.warn("[Migración] Fallaron:", errores);
      notify(`Migración terminada con ${errores.length} error(es). ${errores[0]}`);
    } else {
      notify("Todas las fotos están en Storage", "success");
    }
  };

  if (!pendientes) return null;
  if (pendientes.length === 0 && !migrando) {
    return progreso.total > 0 ? (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
        <p className="text-xs font-bold text-emerald-800">Fotos antiguas migradas a Storage</p>
      </div>
    ) : null;
  }

  const pct = progreso.total ? Math.round(((progreso.hechos + progreso.fallidos) / progreso.total) * 100) : 0;

  return (
    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 space-y-2.5">
      <div className="flex items-center gap-3">
        <ImageDown className="w-5 h-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">Fotos antiguas en Drive</p>
          <p className="text-[11px] text-slate-600">
            {migrando
              ? `${progreso.hechos + progreso.fallidos} de ${progreso.total} · ahorro ${Math.round(progreso.ahorroKb / 1024 * 10) / 10} MB`
              : `${pendientes.length} por pasar a Storage (se comprimen al migrar)`}
          </p>
        </div>
      </div>
      {migrando && (
        <div className="h-2 rounded-full bg-amber-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <button
        type="button"
        onClick={migrar}
        disabled={migrando}
        className="w-full h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {migrando && <Loader2 className="w-4 h-4 animate-spin" />}
        {migrando ? "Migrando... no cierres la app" : "Migrar fotos a Storage"}
      </button>
    </div>
  );
};
