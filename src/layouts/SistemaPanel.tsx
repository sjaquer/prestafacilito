import React, { useState } from "react";
import { CalendarDays, CheckCircle2, Cloud, CloudOff, CloudUpload, Download, FileSpreadsheet, Loader2, Type } from "lucide-react";
import { FontSizeControl } from "../components/common/FontSizeControl";
import { useFeedback } from "../components/ui/Feedback";
import { useEstadoSistema } from "./useEstadoSistema";

type Props = ReturnType<typeof useEstadoSistema>;

/** Estado de Drive, respaldo semanal y tamaño de letra. Se usa en el menú de escritorio y en "Más" del celular. */
export const SistemaPanel: React.FC<Props> = ({ driveOk, backup, descargando, descargarExcel, respaldando, respaldarAhora }) => {
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

  const handleRespaldo = async () => {
    try {
      const r = await respaldarAhora();
      if (r.completo && r.fallidos === 0) {
        notify(`Respaldo en Drive completo${r.copiados ? ` (${r.copiados} archivos nuevos)` : ""}`, "success");
      } else if (r.completo) {
        notify(`Respaldo terminado, pero ${r.fallidos} archivo(s) no existen en Storage`);
      } else {
        notify(`Respaldo incompleto: faltan ${r.pendientes} archivo(s). ${r.errores[0] || "Vuelve a intentarlo."}`);
      }
    } catch (err: any) {
      notify("No se pudo respaldar: " + (err.message || "error desconocido"));
    }
  };

  const handleDescarga = async () => {
    try {
      await descargarExcel();
    } catch (err: any) {
      notify("No se pudo descargar el Excel: " + (err.message || "error desconocido"));
    }
  };

  const atencion = !!backup?.requiere_backup || !!backup?.en_curso;
  const estadoRespaldo = !backup
    ? "Verificando..."
    : backup.en_curso
      ? "Respaldo a medias: faltan archivos por copiar"
      : backup.ultima_fecha_backup
        ? `Último: ${new Date(backup.ultima_fecha_backup).toLocaleDateString("es-PE")}` +
          (backup.requiere_backup ? ` · hace ${backup.dias_transcurridos} días` : "")
        : "Aún no hay respaldos en Drive";

  return (
    <div className="space-y-3">
      {/* Google Drive */}
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
        {driveOk === false ? <CloudOff className="w-5 h-5 text-amber-500" /> : <Cloud className="w-5 h-5 text-emerald-600" />}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800">Google Drive</p>
          <p className="text-[11px] text-slate-500">
            {driveOk === null ? "Verificando..." : driveOk ? "Conectado (respaldos y calendario)" : "Desconectado: no hay respaldos ni calendario"}
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

      {/* Respaldo semanal */}
      <div className={`p-3 rounded-2xl border space-y-2.5 ${atencion ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-100"}`}>
        <div className="flex items-center gap-3">
          <FileSpreadsheet className={`w-5 h-5 ${atencion ? "text-rose-600" : "text-emerald-600"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-800">Respaldo semanal en Drive</p>
            <p className={`text-[11px] ${atencion ? "text-rose-600 font-bold" : "text-slate-500"}`}>{estadoRespaldo}</p>
            <p className="text-[10px] text-slate-400">Excel + fotos nuevas, cada semana automáticamente</p>
          </div>
          {backup && !atencion && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        </div>
        <button
          type="button"
          onClick={handleRespaldo}
          disabled={respaldando || driveOk === false}
          className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {respaldando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {respaldando ? "Respaldando... no cierres la app" : "Respaldar ahora en Drive"}
        </button>
        <button
          type="button"
          onClick={handleDescarga}
          disabled={descargando}
          className="w-full h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {descargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {descargando ? "Generando..." : "Descargar Excel a este equipo"}
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
