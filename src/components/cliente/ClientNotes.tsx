import React, { useState, useMemo } from "react";
import {
  MessageSquare, Phone, MapPin, Calendar, Clock, Plus, Trash2,
  AlertCircle, Loader2, Sparkles, Smile
} from "lucide-react";
import { Cliente } from "../../types";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatDate } from "../../lib/formatters";

interface NoteItem {
  id: string;
  date: string;
  type: "llamada" | "visita" | "whatsapp" | "otra";
  text: string;
}

interface ClientNotesProps {
  cliente: Cliente;
  onUpdateClient: (id: string, data: Partial<Cliente>) => Promise<{ success: boolean; error?: string }>;
}

const TYPE_CONFIG = {
  llamada: { label: "Llamada", color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Phone },
  visita: { label: "Visita", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: MapPin },
  whatsapp: { label: "WhatsApp", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: MessageSquare },
  otra: { label: "Nota Libre", color: "text-slate-400 bg-slate-500/10 border-slate-500/20", icon: Sparkles }
};

export const ClientNotes: React.FC<ClientNotesProps> = ({ cliente, onUpdateClient }) => {
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteType, setNewNoteType] = useState<"llamada" | "visita" | "whatsapp" | "otra">("otra");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Parse notes list from observaciones
  const notesList: NoteItem[] = useMemo(() => {
    const raw = cliente.observaciones || "";
    if (!raw.trim()) return [];
    
    try {
      if (raw.trim().startsWith("[") && raw.trim().endsWith("]")) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as NoteItem[];
        }
      }
    } catch (e) {
      // Fallback if it was just plain text observations
    }

    // Return the observations field as a single default note
    return [
      {
        id: "initial-note",
        date: new Date(cliente.fecha_registro || new Date()).toISOString(),
        type: "otra",
        text: raw
      }
    ];
  }, [cliente.observaciones, cliente.fecha_registro]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSaving(true);
    setError("");

    const newNoteObj: NoteItem = {
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      type: newNoteType,
      text: newNoteText.trim()
    };

    // Filter out initial-note if text was empty or convert it
    const filteredOldNotes = notesList.filter(n => n.text.trim() !== "");
    const updatedNotes = [newNoteObj, ...filteredOldNotes];

    try {
      const result = await onUpdateClient(cliente.id, {
        observaciones: JSON.stringify(updatedNotes)
      });

      if (result.success) {
        setNewNoteText("");
        setNewNoteType("otra");
      } else {
        setError(result.error || "No se pudo agregar la nota.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta nota de seguimiento?")) return;

    setSaving(true);
    setError("");

    const updatedNotes = notesList.filter(n => n.id !== noteId);

    try {
      const result = await onUpdateClient(cliente.id, {
        observaciones: updatedNotes.length > 0 ? JSON.stringify(updatedNotes) : ""
      });

      if (!result.success) {
        setError(result.error || "No se pudo eliminar la nota.");
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="simple" className="space-y-4">
      <div>
        <h3 className="font-black text-white text-base tracking-tight leading-none">Seguimiento e Interacciones</h3>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">
          Registra llamadas, visitas domiciliarias y recordatorios
        </p>
      </div>

      <div className="border-t border-white/[0.04] pt-4" />

      {/* Editor de Nueva Nota */}
      <form onSubmit={handleAddNote} className="space-y-3 bg-white/[0.015] border border-white/[0.04] rounded-2xl p-4">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block">Registrar Interacción</span>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Selector de Tipo */}
          <div className="sm:w-44 flex flex-col gap-1 shrink-0">
            <select
              value={newNoteType}
              onChange={(e) => setNewNoteType(e.target.value as any)}
              className="w-full glass-input rounded-xl px-3 py-2.5 text-xs font-bold cursor-pointer bg-[#0b0e1b] border-white/6"
              disabled={saving}
            >
              <option value="otra">📝 Nota General</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="llamada">📞 Llamada Telefónica</option>
              <option value="visita">🏡 Visita Domicilio</option>
            </select>
          </div>

          {/* Caja de Texto */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Ej. Se acordó que pagará el viernes por la tarde..."
              className="w-full glass-input rounded-xl px-4 py-2.5 text-xs font-semibold border-white/6 focus:border-indigo-500/80 pr-12"
              disabled={saving}
              required
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={saving || !newNoteText.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center justify-center shrink-0 border-none cursor-pointer disabled:opacity-50 disabled:hover:bg-indigo-600"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[10px] text-rose-455 font-bold mt-1">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Historial / Timeline */}
      <div className="space-y-4 pt-2">
        <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest block">Historial Cronológico</span>

        {notesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center bg-white/[0.01] border border-dashed border-white/[0.05] rounded-2xl p-4 select-none">
            <Smile className="text-slate-600 mb-2" size={24} />
            <p className="text-xs font-bold text-slate-400">Sin notas de seguimiento</p>
            <p className="text-[10px] text-slate-550 mt-0.5">El historial de interacciones está limpio</p>
          </div>
        ) : (
          <div className="relative pl-4 border-l-2 border-white/[0.04] space-y-4 ml-2.5">
            {notesList.map((note) => {
              const config = TYPE_CONFIG[note.type] || TYPE_CONFIG.otra;
              const Icon = config.icon;
              
              return (
                <div key={note.id} className="relative group animate-fadeIn">
                  {/* Bullet */}
                  <div className={`absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#090b16] ${config.color} flex items-center justify-center`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current" />
                  </div>

                  <div className="bg-[#0b0f20]/35 border border-white/[0.035] rounded-xl p-3.5 space-y-2 hover:border-white/[0.06] transition duration-150">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-md border ${config.color}`}>
                          <Icon size={10} /> {config.label}
                        </span>
                        <span className="text-[10px] text-slate-550 font-semibold font-mono flex items-center gap-1 select-none">
                          <Clock size={9} /> {formatDate(note.date)}
                        </span>
                      </div>
                      
                      {note.id !== "initial-note" && (
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition opacity-0 group-hover:opacity-100 cursor-pointer border-none shrink-0"
                          title="Eliminar nota"
                          disabled={saving}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-slate-350 font-medium leading-relaxed break-words whitespace-pre-wrap">
                      {note.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};
