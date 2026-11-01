import { useCallback, useEffect, useState } from "react";
import { hoyISO } from "../lib/fechas";

interface BackupStatus {
  ultima_fecha_backup: string | null;
  dias_transcurridos: number | null;
  /** Pasaron 7 días o más desde el último respaldo completo en Drive. */
  requiere_backup: boolean;
  /** Hay un respaldo empezado al que le faltan archivos por copiar. */
  en_curso: boolean;
  drive_configurado: boolean;
  /** "solo_drive": Storage desactivado, las fotos se guardan y leen desde Drive. */
  modo_archivos?: "normal" | "solo_drive";
}

interface ResultadoRespaldo {
  copiados: number;
  fallidos: number;
  pendientes: number;
  completo: boolean;
  errores: string[];
}

/** Cada llamada al servidor dura ~40 s como máximo; con esto se cubren unos cientos de archivos. */
const MAX_TANDAS = 15;

/** Estado de Google Drive y del respaldo semanal, más las acciones de respaldar y descargar el Excel. */
export function useEstadoSistema() {
  const [driveOk, setDriveOk] = useState<boolean | null>(null);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  /** El servidor no pudo informar el estado del respaldo (ej. falta la migración de la BD). */
  const [backupError, setBackupError] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [respaldando, setRespaldando] = useState(false);

  const cargarBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/backup/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setBackup(await res.json());
      setBackupError(false);
    } catch (e) {
      console.error("Error al obtener estado de respaldo:", e);
      setBackupError(true);
    }
  }, []);

  useEffect(() => {
    cargarBackup();
  }, [cargarBackup]);

  useEffect(() => {
    let activo = true;
    const revisar = async () => {
      try {
        const res = await fetch("/api/drive/status");
        const data = res.ok ? await res.json() : null;
        if (activo) setDriveOk(!!data?.configured);
      } catch {
        if (activo) setDriveOk(false);
      }
    };
    revisar();
    // Se revisa cada 5 minutos: el estado de Drive cambia rara vez
    const intervalo = setInterval(revisar, 5 * 60 * 1000);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, []);

  /** Sube el Excel y las fotos nuevas a Drive. Repite mientras queden archivos y haya avance. */
  const respaldarAhora = useCallback(async (): Promise<ResultadoRespaldo> => {
    setRespaldando(true);
    const total: ResultadoRespaldo = { copiados: 0, fallidos: 0, pendientes: 0, completo: false, errores: [] };
    try {
      for (let tanda = 0; tanda < MAX_TANDAS; tanda++) {
        const res = await fetch("/api/backup/ejecutar", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "No se pudo completar el respaldo");
        total.copiados += data.copiados;
        total.fallidos += data.fallidos;
        total.pendientes = data.pendientes;
        total.completo = data.completo;
        total.errores.push(...(data.errores || []));
        // Si una tanda no copió nada, reintentar no ayudaría (p. ej. Google desconectado)
        if (data.completo || data.copiados === 0) break;
      }
      return total;
    } finally {
      setRespaldando(false);
      await cargarBackup();
    }
  }, [cargarBackup]);

  /** Descarga el Excel al equipo (además del respaldo en la nube). */
  const descargarExcel = useCallback(async () => {
    setDescargando(true);
    try {
      const response = await fetch("/api/backup/excel");
      if (!response.ok) throw new Error("Error al generar el Excel");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Respaldo_PrestaFacilito_${hoyISO()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDescargando(false);
    }
  }, []);

  /** Hay algo que requiere atención (Drive caído o respaldo vencido/incompleto). */
  const alerta = driveOk === false || backupError || !!backup?.requiere_backup || !!backup?.en_curso;

  return { driveOk, backup, backupError, descargando, descargarExcel, respaldando, respaldarAhora, alerta };
}
