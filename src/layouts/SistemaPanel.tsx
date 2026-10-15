import React, { useState } from "react";
import { CalendarDays, CheckCircle2, Cloud, CloudOff, Download, FileSpreadsheet, Loader2, Type } from "lucide-react";
import { FontSizeControl } from "../components/common/FontSizeControl";
import { useFeedback } from "../components/ui/Feedback";
import { useEstadoSistema } from "./useEstadoSistema";

type Props = ReturnType<typeof useEstadoSistema>;

/** Estado de Drive, backup y tamaño de letra. Se usa en el menú de escritorio y en "Más" del celular. */
export const SistemaPanel: React.FC<Props> = ({ driveOk, backup, descargando, descargarBackup }) => {
  const { notify, confirm } = useFeedback();
  const [sincronizando, setSincronizando] = useState(false);

  const sincronizarCalendario = async () => {
    setSincronizando(true);
    try {
      const res = await fetch("/api/calendar/sincronizar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "No se pudo sincronizar");
      notify(data.message, "success");
    } catch (err: any) {
      notify(err.message || "Error al sincronizar el calendario");
    } finally {
      setSincronizando(false);
    }
  };

  const conectarDrive = async () => {
    const ok = await confirm({
      title: "Conectar Google Drive",
      message: "Se abrirá el inicio de sesión de Google para volver a vincular Drive.",
      confirmLabel: "Ir a Google",
    });
    if (ok) window.location.href = "/api/auth/google/login";
  };

  const handleBackup = async () => {
    try {
      await descargarBackup();
      notify("Backup descargado", "success");
    } catch (err: any) {
      notify("No se pudo descargar el backup: " + (err.message || "error desconocido"));
    }
  };

  return (
    <div className="space-y-3">
      {/* Google Drive */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
        {driveOk === false ? <CloudOff className="w-5 h-5 text-amber-500" /> : <Cloud className="w-5 h-5 text-emerald-600" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">Google Drive</p>
          <p className="text-[11px] text-slate-500">
            {driveOk === null ? "Verificando..." : driveOk ? "Conectado (comprobantes y documentos)" : "Desconectado: no se pueden subir archivos"}
          </p>
        </div>
        <button type="button" onClick={conectarDrive} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0">
          {driveOk ? "Reconectar" : "Conectar"}
        </button>
      </div>

      {/* Google Calendar */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
        <CalendarDays className="w-5 h-5 text-indigo-600" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">Calendario de cobros</p>
          <p className="text-[11px] text-slate-500">Se actualiza solo cada día y con cada pago</p>
        </div>
        <button
          type="button"
          onClick={sincronizarCalendario}
          disabled={sincronizando || driveOk === false}
          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0 inline-flex items-center gap-1 disabled:opacity-50"
        >
          {sincronizando && <Loader2 className="w-3 h-3 animate-spin" />}
          {sincronizando ? "Sincronizando" : "Sincronizar ahora"}
        </button>
      </div>

      {/* Backup */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className={`w-5 h-5 ${backup?.requiere_backup ? "text-rose-600" : "text-emerald-600"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800">Backup en Excel</p>
            <p className={`text-[11px] ${backup?.requiere_backup ? "text-rose-600 font-bold" : "text-slate-500"}`}>
              {backup?.ultima_fecha_backup
                ? `Último: ${new Date(backup.ultima_fecha_backup).toLocaleDateString("es-PE")}`
                : "Aún no hay backups"}
              {backup?.requiere_backup && ` · hace ${backup.dias_transcurridos} días`}
            </p>
          </div>
          {!backup?.requiere_backup && backup && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        </div>
        <button
          type="button"
          onClick={handleBackup}
          disabled={descargando}
          className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {descargando ? "Generando..." : "Descargar backup"}
        </button>
      </div>

      {/* Tamaño de letra */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
        <Type className="w-5 h-5 text-slate-500" />
        <p className="flex-1 text-xs font-bold text-slate-800">Tamaño de letra</p>
        <FontSizeControl />
      </div>
    </div>
  );
};
