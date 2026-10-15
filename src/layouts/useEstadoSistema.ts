import { useCallback, useEffect, useState } from "react";
import { hoyISO } from "../lib/fechas";

interface BackupStatus {
  requiere_backup: boolean;
  dias_transcurridos: number;
  ultima_fecha_backup: string | null;
}

/** Estado de Google Drive y del backup semanal, más la acción de descargar el backup. */
export function useEstadoSistema() {
  const [driveOk, setDriveOk] = useState<boolean | null>(null);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [descargando, setDescargando] = useState(false);

  const cargarBackup = useCallback(async () => {
    try {
      const res = await fetch("/api/backup/status");
      if (res.ok) setBackup(await res.json());
    } catch (e) {
      console.error("Error al obtener estado de backup:", e);
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

  const descargarBackup = useCallback(async () => {
    setDescargando(true);
    try {
      const response = await fetch("/api/backup/excel");
      if (!response.ok) throw new Error("Error al descargar backup");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `Backup_Cartera_${hoyISO()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await cargarBackup();
    } finally {
      setDescargando(false);
    }
  }, [cargarBackup]);

  /** Hay algo que requiere atención (Drive caído o backup vencido). */
  const alerta = driveOk === false || !!backup?.requiere_backup;

  return { driveOk, backup, descargando, descargarBackup, alerta };
}
