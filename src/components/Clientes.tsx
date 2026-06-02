import React, { useState, useEffect, useRef } from "react";
import {
  UserPlus, Search, Phone, Calendar, Loader2, Check, User, AlertCircle,
  CheckCircle, ChevronDown, ChevronUp, Edit3, X, Users,
  Shield, ShieldCheck, ShieldAlert, MapPin, CreditCard,
  FileText, Trash2, Eye, Upload, Bell, ExternalLink, Info
} from "lucide-react";
import { Cliente, DocumentoCliente, TipoDocumento, TIPOS_DOCUMENTO_CONFIG, ACCEPT_DOCUMENTOS } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../hooks/useAuth";
import { getNombreUsuario } from "../lib/formatters";

// ── Detección de género por nombre ─────────────────────────
const NOMBRES_FEMENINOS = new Set([
  'maria','ana','lucia','sofia','elena','carmen','rosa','claudia','andrea','patricia',
  'laura','diana','gloria','monica','sandra','alejandra','valentina','gabriela','lorena',
  'jessica','vanessa','adriana','paola','natalia','carolina','fernanda','daniela','sara',
  'isabel','pilar','julia','alicia','beatriz','cristina','irene','mariana','raquel',
  'silvia','yolanda','angela','consuelo','esperanza','graciela','luz','mercedes','norma',
  'olga','rebeca','susana','veronica','wendy','xiomara','yasmin','zoraida','pamela',
  'karina','brenda','gisela','rocio','miriam','nancy','marisol','milagros','flor',
  'liliana','estela','cecilia','catalina','evelyn','fabiola','helen','iliana'
]);

function detectarGenero(nombre: string): 'SR.' | 'SRA.' {
  const primerNombre = nombre.trim().split(/\s+/)[0].toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return NOMBRES_FEMENINOS.has(primerNombre) ? 'SRA.' : 'SR.';
}

// ── Generador de mensaje recordatorio ─────────────────────
function getMensajeRecordatorio(cliente: Cliente, username: string | null, montoCuota?: number, fechaVencimiento?: string): string {
  const tratamiento = detectarGenero(cliente.nombre_completo);
  const nombre = cliente.nombre_completo.toUpperCase();
  const cuota = montoCuota ? `S/ ${montoCuota.toFixed(2)}` : 'la cuota o mensualidad pendiente';
  const fecha = fechaVencimiento || 'la fecha de vencimiento';
  const remitente = getNombreUsuario(username);
  return (
    `¡Hola, ${tratamiento} ${nombre}! Te saluda ${remitente}.\n` +
    `Te escribo para recordarte amablemente tu pago pendiente a cancelar:\n\n` +
    `${cuota} con vencimiento el ${fecha}.\n\n` +
    `Agradezco tu puntualidad y apoyo. ¡Que tengas un gran día!\n` +
    `Cualquier cosa me lo escribe.`
  );
}

export function Clientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"todos" | "con_deuda" | "sin_deuda">("todos");
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulario nuevo cliente
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [direccion, setDireccion] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [bancoCuenta, setBancoCuenta] = useState("");
  const [infoAdicional, setInfoAdicional] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Documentos - formulario nuevo cliente
  const [pendingDocs, setPendingDocs] = useState<{ tipo: TipoDocumento; file: File; preview: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const newDocInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocTipo, setSelectedDocTipo] = useState<TipoDocumento>('dni_frontal');

  // Edición cliente
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditCliente, setSelectedEditCliente] = useState<Cliente | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const [editNumeroCuenta, setEditNumeroCuenta] = useState("");
  const [editBancoCuenta, setEditBancoCuenta] = useState("");
  const [editInfoAdicional, setEditInfoAdicional] = useState("");
  const [updatingCliente, setUpdatingCliente] = useState(false);

  // Documentos del cliente en modal de edición
  const [editDocs, setEditDocs] = useState<DocumentoCliente[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingEditDoc, setUploadingEditDoc] = useState(false);
  const [selectedEditDocTipo, setSelectedEditDocTipo] = useState<TipoDocumento>('dni_frontal');
  const editDocInputRef = useRef<HTMLInputElement>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentoCliente | null>(null);

  // ── Fetch ─────────────────────────────────────────────────
  const fetchClientes = async () => {
    try {
      setLoading(true); setError(null);
      const res = await fetch("/api/clientes");
      const data = await res.json();
      if (res.ok) setClientes(data);
      else setError(data.error || "Error al obtener clientes.");
    } catch { setError("Error al conectar con el servidor."); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClientes(); }, []);

  // ── Crear cliente ─────────────────────────────────────────
  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre) return;
    setSubmitting(true); setSuccessMsg(""); setError(null);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: nombre,
          telefono,
          observaciones,
          direccion,
          numero_cuenta: numeroCuenta,
          banco_cuenta: bancoCuenta,
          informacion_adicional: infoAdicional
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Subir documentos pendientes si hay
        if (pendingDocs.length > 0 && data.id) {
          setUploadingDocs(true);
          for (const pd of pendingDocs) {
            try {
              const base64 = await fileToBase64(pd.file);
              await fetch(`/api/clientes/${data.id}/documentos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  fileName: pd.file.name,
                  mimeType: pd.file.type || 'application/octet-stream',
                  base64Data: base64,
                  tipo_documento: pd.tipo
                })
              });
            } catch { /* continuar con el siguiente */ }
          }
          setUploadingDocs(false);
        }
        setSuccessMsg("Cliente registrado correctamente ✅");
        setNombre(""); setTelefono(""); setObservaciones("");
        setDireccion(""); setNumeroCuenta(""); setBancoCuenta(""); setInfoAdicional("");
        setPendingDocs([]);
        fetchClientes();
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        setError(data.error || "No se pudo registrar el cliente.");
      }
    } catch { setError("Error de red al crear el cliente."); }
    finally { setSubmitting(false); setUploadingDocs(false); }
  };

  // ── Editar cliente ────────────────────────────────────────
  const openEditCliente = async (cliente: Cliente) => {
    setSelectedEditCliente(cliente);
    setEditNombre(cliente.nombre_completo || "");
    setEditTelefono(cliente.telefono || "");
    setEditDireccion(cliente.direccion || "");
    setEditObservaciones(cliente.observaciones || "");
    setEditNumeroCuenta(cliente.numero_cuenta || "");
    setEditBancoCuenta(cliente.banco_cuenta || "");
    setEditInfoAdicional(cliente.informacion_adicional || "");
    setEditDocs([]);
    setShowEditModal(true);
    // Cargar documentos del cliente
    setLoadingDocs(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}/documentos`);
      if (res.ok) setEditDocs(await res.json());
    } catch { /* silencioso */ }
    finally { setLoadingDocs(false); }
  };

  const handleUpdateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditCliente) return;
    setUpdatingCliente(true);
    try {
      const res = await fetch(`/api/clientes/${selectedEditCliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: editNombre,
          telefono: editTelefono,
          observaciones: editObservaciones,
          direccion: editDireccion,
          numero_cuenta: editNumeroCuenta,
          banco_cuenta: editBancoCuenta,
          informacion_adicional: editInfoAdicional
        })
      });
      if (res.ok) {
        setShowEditModal(false); setSelectedEditCliente(null);
        await fetchClientes();
      } else {
        const d = await res.json();
        setError(d.error || "No se pudo actualizar el cliente.");
      }
    } catch { setError("Error de red al actualizar el cliente."); }
    finally { setUpdatingCliente(false); }
  };

  // ── Documentos helpers ────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddPendingDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingDocs(prev => [...prev, { tipo: selectedDocTipo, file, preview }]);
    e.target.value = '';
  };

  const removePendingDoc = (i: number) => {
    setPendingDocs(prev => { const n = [...prev]; n.splice(i, 1); return n; });
  };

  const handleUploadEditDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEditCliente) return;
    setUploadingEditDoc(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(`/api/clientes/${selectedEditCliente.id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64,
          tipo_documento: selectedEditDocTipo
        })
      });
      if (res.ok) {
        const newDoc = await res.json();
        setEditDocs(prev => [newDoc, ...prev]);
      }
    } catch { /* silencioso */ }
    finally { setUploadingEditDoc(false); e.target.value = ''; }
  };

  const handleDeleteDoc = async (docId: string, clienteId: string) => {
    if (!confirm('¿Eliminar este documento?')) return;
    const res = await fetch(`/api/clientes/${clienteId}/documentos/${docId}`, { method: 'DELETE' });
    if (res.ok) setEditDocs(prev => prev.filter(d => d.id !== docId));
  };

  // ── Filtrado ──────────────────────────────────────────────
  const filteredClientes = clientes.filter(c => {
    const matchesSearch =
      c.nombre_completo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.telefono || '').includes(searchQuery);
    if (!matchesSearch) return false;
    if (filterType === "con_deuda") return c.prestamos_activos && c.prestamos_activos > 0;
    if (filterType === "sin_deuda") return !c.prestamos_activos || c.prestamos_activos === 0;
    return true;
  });

  const displayPhone = (phoneNum: string) => {
    if (!phoneNum) return "Sin teléfono";
    const clean = phoneNum.replace(/\D/g, '');
    if (clean.startsWith('51') && clean.length === 11) return `+51 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`;
    return phoneNum.startsWith("'") ? phoneNum.substring(1) : phoneNum;
  };

  const getClientRiskAssessment = (cliente: Cliente) => {
    const activeLoans = cliente.prestamos_activos || 0;
    const totalLoans = cliente.total_prestamos || 0;
    const exigible = Number(cliente.total_exigible) || 0;
    const amortizado = Number(cliente.total_amortizado) || 0;
    const outstanding = Math.max(0, exigible - amortizado);
    let level: "Excelente" | "Bajo" | "Medio" | "Alto";
    let score = 100;
    let rationale = "";
    let recommendations: string[] = [];
    if (activeLoans > 1 || outstanding > 1500) {
      level = "Alto"; score = activeLoans > 2 ? 25 : 45;
      rationale = `El prestatario tiene un nivel de endeudamiento elevado con ${activeLoans} deudas activas y un saldo pendiente de S/. ${outstanding.toLocaleString("es-PE", { minimumFractionDigits: 2 })}.`;
      recommendations = ["Rechazar preventivamente nuevos préstamos hasta liquidar deudas vigentes.", "Priorizar visitas y llamadas en el canal de cobros.", "Solicitar un codeudor solidario o aval para futuras deudas."];
    } else if (activeLoans === 1 || outstanding > 0) {
      level = "Medio"; score = 70;
      rationale = `El cliente cuenta con una deuda vigente y un saldo pendiente de S/. ${outstanding.toLocaleString("es-PE", { minimumFractionDigits: 2 })}. Comportamiento regular.`;
      recommendations = ["Limitar nuevas deudas o ampliaciones de capital por el momento.", "Monitorear la puntualidad de sus cuotas actuales.", "Enviar recordatorios amistosos 2 días antes de la fecha de cobro."];
    } else if (totalLoans > 0) {
      level = "Excelente"; score = 98;
      rationale = `¡Excelente historial! Cuenta con ${totalLoans} deuda(s) totalmente cancelada(s) y sin atrasos.`;
      recommendations = ["Aprobar ampliaciones de crédito de forma rápida y preferente.", "Ofrecer incentivos de fidelidad o flexibilizar plazos."];
    } else {
      level = "Bajo"; score = 90;
      rationale = "Cliente nuevo sin historial de deudas registrado en la plataforma.";
      recommendations = ["Comenzar con montos prudentes (menores a S/. 500) para medir puntualidad.", "Evaluar estabilidad residencial y referencias personales básicas."];
    }
    return { level, score, rationale, recommendations };
  };

  const getAvatarGradient = (name: string) => {
    const gradients = ["from-indigo-500 to-violet-600","from-emerald-500 to-teal-600","from-amber-500 to-orange-500","from-rose-500 to-pink-600","from-blue-500 to-cyan-600","from-purple-500 to-fuchsia-600"];
    return gradients[name.charCodeAt(0) % gradients.length];
  };

  const riskConfig = {
    Excelente: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500", Icon: ShieldCheck },
    Bajo: { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", bar: "bg-blue-500", Icon: Shield },
    Medio: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500", Icon: ShieldAlert },
    Alto: { color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20", bar: "bg-rose-500", Icon: ShieldAlert },
  };

  const getMimeIcon = (mime: string) => {
    if (mime.startsWith('image/')) return '🖼️';
    if (mime === 'application/pdf') return '📄';
    if (mime.includes('word')) return '📝';
    return '📎';
  };

  return (
    <div id="clientes-view" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-5 bg-indigo-500 rounded-full" />
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.18em]">Directorio</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">Gestión de Clientes</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} registrados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Formulario de Registro ── */}
        <div id="new-client-card" className="bento-card p-5 rounded-3xl h-fit space-y-4 lg:sticky lg:top-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
              <UserPlus size={18} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="font-black text-white text-sm leading-none">Nuevo Cliente</h2>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Registrar en el directorio</p>
            </div>
          </div>

          <div className="border-t border-white/[0.06]" />

          <form onSubmit={handleCreateCliente} className="space-y-3">
            <AnimatePresence>
              {successMsg && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-2xl text-xs font-bold">
                  <Check size={14} /><span>{successMsg}</span>
                </motion.div>
              )}
              {error && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl text-xs font-bold">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nombre Completo *</label>
              <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Juan Pérez Gómez"
                className="w-full glass-input rounded-2xl px-4 py-3 text-sm font-medium" required autoComplete="off" />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-black select-none">+51</span>
                <input type="text" value={telefono} onChange={e => setTelefono(e.target.value.replace(/\D/g, ""))}
                  placeholder="987654321" maxLength={9}
                  className="w-full glass-input rounded-2xl pl-12 pr-4 py-3 text-sm font-mono" autoComplete="off" />
              </div>
              <p className="text-[10px] text-slate-600">9 dígitos del celular — el +51 se agrega automáticamente</p>
            </div>

            {/* Dirección */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                <MapPin size={9} /> Dirección <span className="text-slate-600 normal-case font-medium">(opcional)</span>
              </label>
              <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
                placeholder="Av. Principal 123, Lima"
                className="w-full glass-input rounded-2xl px-4 py-3 text-sm" autoComplete="off" />
            </div>

            {/* Datos bancarios */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                <CreditCard size={9} /> Cuenta Bancaria <span className="text-slate-600 normal-case font-medium">(opcional)</span>
              </label>
              <input type="text" value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)}
                placeholder="BCP 191-123456789-0-23 / Yape 987654321"
                className="w-full glass-input rounded-2xl px-4 py-3 text-sm font-mono text-[11px]" autoComplete="off" />
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones</label>
              <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)}
                placeholder="Detalles del cliente, referencias, trabajo..."
                rows={2} className="w-full glass-input rounded-2xl px-4 py-3 text-sm resize-none" />
            </div>

            {/* ── Zona de Documentos ── */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Documentos</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Selector de tipo */}
              <div className="flex gap-2 items-center">
                <select value={selectedDocTipo} onChange={e => setSelectedDocTipo(e.target.value as TipoDocumento)}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-[11px] font-semibold cursor-pointer">
                  {(Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, { label: string; icon: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <button type="button"
                  onClick={() => newDocInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                  <Upload size={12} /> Subir
                </button>
                <input ref={newDocInputRef} type="file" className="hidden"
                  accept={ACCEPT_DOCUMENTOS} onChange={handleAddPendingDoc} />
              </div>

              {/* Lista de docs pendientes */}
              {pendingDocs.length > 0 && (
                <div className="space-y-1.5">
                  {pendingDocs.map((pd, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                      {pd.preview ? (
                        <img src={pd.preview} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-sm shrink-0">
                          {TIPOS_DOCUMENTO_CONFIG[pd.tipo].icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-white truncate">{pd.file.name}</p>
                        <p className="text-[10px] text-indigo-400">{TIPOS_DOCUMENTO_CONFIG[pd.tipo].label}</p>
                      </div>
                      <button type="button" onClick={() => removePendingDoc(i)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition cursor-pointer">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pendingDocs.length === 0 && (
                <p className="text-[10px] text-slate-600 text-center py-1">
                  Opcionalmente sube DNI, recibos u otros archivos
                </p>
              )}
            </div>

            <button type="submit" disabled={submitting || uploadingDocs}
              className="w-full btn-primary py-3 rounded-2xl text-sm cursor-pointer flex items-center justify-center gap-2">
              {submitting || uploadingDocs ? (
                <><Loader2 className="animate-spin" size={16} /><span>{uploadingDocs ? 'Subiendo documentos...' : 'Guardando...'}</span></>
              ) : (
                <><UserPlus size={15} /><span>Registrar Cliente</span></>
              )}
            </button>
          </form>
        </div>

        {/* ── RIGHT: Lista de Clientes ── */}
        <div id="clients-list-card" className="bento-card rounded-3xl lg:col-span-2 overflow-hidden flex flex-col">

          {/* Header */}
          <div className="p-5 border-b border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-indigo-400" />
                <h2 className="font-black text-white text-sm">Directorio de Clientes</h2>
              </div>
              <span className="text-[10px] bg-white/[0.04] border border-white/[0.06] text-slate-400 px-2.5 py-1 rounded-lg font-bold">
                {filteredClientes.length} resultado{filteredClientes.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Buscar por nombre o teléfono..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 glass-input rounded-xl text-xs font-medium" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 gap-0.5 shrink-0">
                {(["todos","con_deuda","sin_deuda"] as const).map(f => (
                  <button key={f} onClick={() => setFilterType(f)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${filterType === f ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"}`}>
                    {f === "todos" ? "Todos" : f === "con_deuda" ? "Con Deuda" : "Sin Deuda"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 flex-1">
              <Loader2 className="animate-spin text-indigo-400 mb-3" size={28} />
              <p className="text-xs text-slate-500 font-semibold">Cargando directorio...</p>
            </div>
          ) : filteredClientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center flex-1">
              <div className="w-16 h-16 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4">
                <Users size={28} className="text-slate-600" />
              </div>
              <p className="text-sm font-bold text-slate-300 mb-1">Sin resultados</p>
              <p className="text-xs text-slate-500">{searchQuery ? "Ajusta la búsqueda" : "Registra tu primer cliente"}</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[680px] overflow-y-auto">
              {filteredClientes.map(cliente => {
                const assessment = getClientRiskAssessment(cliente);
                const isExpanded = expandedClientId === cliente.id;
                const initials = cliente.nombre_completo.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
                const avatarGradient = getAvatarGradient(cliente.nombre_completo);
                const hasDebt = (cliente.prestamos_activos || 0) > 0;
                const exigible = Number(cliente.total_exigible) || 0;
                const amortizado = Number(cliente.total_amortizado) || 0;
                const saldo = Math.max(0, exigible - amortizado);
                const risk = riskConfig[assessment.level];
                const waPhone = (cliente.telefono || '').replace(/\D/g, '');
                const mensajeRecordatorio = encodeURIComponent(getMensajeRecordatorio(cliente, user));

                return (
                  <div key={cliente.id} className="hover:bg-white/[0.012] transition-colors duration-150">
                    {/* Main row */}
                    <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${avatarGradient} flex items-center justify-center shrink-0 shadow-md text-white font-black text-sm select-none`}>
                        {initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm truncate">{cliente.nombre_completo}</span>
                          {hasDebt ? (
                            <span className="badge bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 shrink-0">
                              {cliente.prestamos_activos} deuda{(cliente.prestamos_activos || 0) > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="badge bg-white/[0.04] border border-white/[0.08] text-slate-500 shrink-0">Al día</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {cliente.telefono && (
                            <span className="text-[11px] text-slate-500 font-mono">{displayPhone(cliente.telefono)}</span>
                          )}
                          {hasDebt && saldo > 0 && (
                            <span className="text-[11px] text-rose-400 font-bold font-mono">
                              S/ {saldo.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                            </span>
                          )}
                          {cliente.direccion && (
                            <span className="text-[10px] text-slate-600 flex items-center gap-1">
                              <MapPin size={9} />{cliente.direccion}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-600 flex items-center gap-1">
                            <Calendar size={9} />{cliente.fecha_registro}
                          </span>
                        </div>
                        {cliente.observaciones && (
                          <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[280px]">{cliente.observaciones}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        <button onClick={() => setExpandedClientId(isExpanded ? null : cliente.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${risk.bg} ${risk.color}`}
                          title="Ver evaluación de riesgo">
                          <risk.Icon size={11} />
                          <span className="hidden sm:inline">{assessment.level}</span>
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>

                        {/* Botón Recordatorio */}
                        {waPhone && hasDebt && (
                          <a href={`https://wa.me/${waPhone}?text=${mensajeRecordatorio}`}
                            target="_blank" rel="noopener noreferrer"
                            className="btn-recordatorio p-2 rounded-lg flex items-center justify-center min-w-[34px] h-[34px] cursor-pointer"
                            title="Enviar recordatorio de cuota">
                            <Bell size={13} />
                          </a>
                        )}

                        {/* Botón WhatsApp */}
                        {cliente.telefono && (
                          <a href={`https://wa.me/${waPhone}`}
                            target="_blank" rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-emerald-600/15 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/25 transition min-w-[34px] h-[34px] flex items-center justify-center"
                            title="Abrir WhatsApp">
                            <Phone size={13} />
                          </a>
                        )}

                        <button onClick={() => openEditCliente(cliente)}
                          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] transition cursor-pointer min-w-[34px] h-[34px] flex items-center justify-center"
                          title="Editar cliente">
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Panel expandible de riesgo */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="overflow-hidden">
                          <div className="mx-4 sm:mx-5 mb-4 p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Evaluación de Riesgo</span>
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${risk.bg} ${risk.color}`}>Score {assessment.score}/100</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                              <div className={`h-full rounded-full transition-all duration-700 ${risk.bar}`} style={{ width: `${assessment.score}%` }} />
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed font-medium">{assessment.rationale}</p>

                            {/* Info adicional del cliente */}
                            {(cliente.numero_cuenta || cliente.informacion_adicional) && (
                              <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                                {cliente.numero_cuenta && (
                                  <div className="flex items-start gap-2 text-[11px]">
                                    <CreditCard size={11} className="text-indigo-400 shrink-0 mt-0.5" />
                                    <span className="text-slate-400 font-mono">{cliente.numero_cuenta}</span>
                                  </div>
                                )}
                                {cliente.informacion_adicional && (
                                  <div className="flex items-start gap-2 text-[11px]">
                                    <Info size={11} className="text-slate-500 shrink-0 mt-0.5" />
                                    <span className="text-slate-400">{cliente.informacion_adicional}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Acciones recomendadas</span>
                              <ul className="space-y-1.5">
                                {assessment.recommendations.map((rec, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[11px] text-slate-400 font-medium leading-relaxed">
                                    <CheckCircle size={11} className="text-indigo-400 shrink-0 mt-0.5" />{rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Editar Cliente ── */}
      <AnimatePresence>
        {showEditModal && selectedEditCliente && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay">
            <motion.div initial={{ scale: 0.97, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 20 }} transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[92dvh] sm:max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/[0.08] bg-[#0d1120] shadow-2xl flex flex-col modal-mobile-full">

              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarGradient(selectedEditCliente.nombre_completo)} flex items-center justify-center text-white font-black text-sm`}>
                    {selectedEditCliente.nombre_completo.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm">Editar Cliente</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-semibold">{selectedEditCliente.nombre_completo}</p>
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-xl hover:bg-white/[0.06] text-slate-400 hover:text-white transition cursor-pointer">
                  <X size={17} />
                </button>
              </div>

              <form onSubmit={handleUpdateCliente} className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-4">
                  {/* Datos básicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nombre *</label>
                      <input type="text" value={editNombre} onChange={e => setEditNombre(e.target.value)}
                        className="w-full glass-input rounded-2xl px-4 py-3 text-sm" required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 text-xs font-black select-none">+51</span>
                        <input type="text" value={editTelefono.replace(/^51/, '')} maxLength={9}
                          onChange={e => setEditTelefono(e.target.value.replace(/\D/g, ""))}
                          className="w-full glass-input rounded-2xl pl-12 pr-4 py-3 text-sm font-mono" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                      <MapPin size={9} /> Dirección
                    </label>
                    <input type="text" value={editDireccion} onChange={e => setEditDireccion(e.target.value)}
                      placeholder="Opcional" className="w-full glass-input rounded-2xl px-4 py-3 text-sm" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block flex items-center gap-1.5">
                      <CreditCard size={9} /> Cuenta Bancaria <span className="text-slate-600 normal-case font-medium">(texto libre)</span>
                    </label>
                    <textarea value={editNumeroCuenta} onChange={e => setEditNumeroCuenta(e.target.value)}
                      placeholder="BCP 191-123456789-0-23 / Yape 987654321"
                      rows={2} className="w-full glass-input rounded-2xl px-4 py-3 text-sm resize-none font-mono text-[11px]" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Info Adicional</label>
                      <input type="text" value={editInfoAdicional} onChange={e => setEditInfoAdicional(e.target.value)}
                        placeholder="Trabajo, referencia..." className="w-full glass-input rounded-2xl px-4 py-3 text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Observaciones</label>
                      <input type="text" value={editObservaciones} onChange={e => setEditObservaciones(e.target.value)}
                        className="w-full glass-input rounded-2xl px-4 py-3 text-sm" />
                    </div>
                  </div>

                  {/* ── Sección de Documentos ── */}
                  <div className="border-t border-white/[0.06] pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                        <FileText size={11} /> Documentos del Cliente
                      </span>
                      <div className="flex items-center gap-2">
                        <select value={selectedEditDocTipo} onChange={e => setSelectedEditDocTipo(e.target.value as TipoDocumento)}
                          className="glass-input rounded-xl px-2 py-1.5 text-[10px] font-semibold cursor-pointer">
                          {(Object.entries(TIPOS_DOCUMENTO_CONFIG) as [TipoDocumento, { label: string; icon: string }][]).map(([k, v]) => (
                            <option key={k} value={k}>{v.icon} {v.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => editDocInputRef.current?.click()}
                          disabled={uploadingEditDoc}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 transition text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
                          {uploadingEditDoc ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                          Subir
                        </button>
                        <input ref={editDocInputRef} type="file" className="hidden"
                          accept={ACCEPT_DOCUMENTOS} onChange={handleUploadEditDoc} />
                      </div>
                    </div>

                    {/* Lista de documentos */}
                    {loadingDocs ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={20} className="animate-spin text-indigo-400" />
                      </div>
                    ) : editDocs.length === 0 ? (
                      <div className="text-center py-6 text-slate-600 text-[11px]">
                        No hay documentos subidos aún
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {editDocs.map(doc => (
                          <div key={doc.id} className="doc-preview-card group relative">
                            {/* Preview */}
                            <div className="aspect-[4/3] bg-black/30 flex items-center justify-center overflow-hidden">
                              {doc.mime_type.startsWith('image/') ? (
                                <img src={doc.drive_url} alt={doc.nombre_archivo}
                                  className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center gap-1 text-slate-500 p-3 text-center">
                                  <span className="text-3xl">{getMimeIcon(doc.mime_type)}</span>
                                  <span className="text-[9px] truncate w-full">{doc.nombre_archivo}</span>
                                </div>
                              )}
                            </div>
                            {/* Info */}
                            <div className="p-2">
                              <p className="text-[9px] font-black text-indigo-400 uppercase">
                                {TIPOS_DOCUMENTO_CONFIG[doc.tipo_documento]?.icon} {TIPOS_DOCUMENTO_CONFIG[doc.tipo_documento]?.label}
                              </p>
                              <p className="text-[9px] text-slate-500 truncate">{doc.nombre_archivo}</p>
                            </div>
                            {/* Overlay actions */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <a href={doc.drive_url} target="_blank" rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                                title="Ver en la app">
                                <Eye size={14} />
                              </a>
                              <button type="button"
                                onClick={() => handleDeleteDoc(doc.id, selectedEditCliente.id)}
                                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition cursor-pointer"
                                title="Eliminar documento">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/[0.06] flex items-center justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setShowEditModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" disabled={updatingCliente}
                    className="px-5 py-2.5 rounded-xl text-xs btn-primary cursor-pointer flex items-center gap-2">
                    {updatingCliente ? <><Loader2 className="animate-spin" size={14} /><span>Guardando...</span></> : "Guardar Cambios"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal Preview Documento ── */}
      <AnimatePresence>
        {previewDoc && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center modal-overlay" onClick={() => setPreviewDoc(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl w-full mx-4 rounded-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              {previewDoc.mime_type.startsWith('image/') ? (
                <img src={previewDoc.drive_url} alt={previewDoc.nombre_archivo} className="w-full max-h-[80vh] object-contain bg-black" />
              ) : (
                <iframe src={previewDoc.drive_url} className="w-full h-[80vh]" title={previewDoc.nombre_archivo} />
              )}
              <button onClick={() => setPreviewDoc(null)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition cursor-pointer">
                <X size={18} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
