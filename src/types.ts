export interface Cliente {
  id: string;
  nombre_completo: string;
  apodo?: string;
  telefono: string;
  observaciones: string;
  fecha_registro: string;
  direccion?: string;
  numero_cuenta?: string;
  banco_cuenta?: string;
  informacion_adicional?: string;
  drive_folder_id?: string;
  // Campos calculados desde la vista
  prestamos_activos?: number;
  prestamos_liquidados?: number;
  total_prestamos?: number;
  capital_total_prestado?: number;
  total_exigible?: number;
  total_amortizado?: number;
  alquileres_activos?: number;
  score?: 'A' | 'B' | 'C' | null;
  score_efectivo?: 'A' | 'B' | 'C' | null;
  score_sobreescrito?: boolean;
  score_numerico?: number;
}

export interface Prestamo {
  id: string;
  cliente_id: string;
  monto_capital: number;
  tasa_interes_porcentaje: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: 'activo' | 'pagado';
  tipo_prestamo: string;
  notas?: string;
}

export interface Amortizacion {
  id: string;
  prestamo_id: string;
  tipo_movimiento: string;
  monto: number;
  fecha_pago: string;
  metodo_pago: string;
  comprobante_url?: string | null;
  voucher_drive_file_id?: string | null;
}

export interface Alquiler {
  id: string;
  cliente_id: string;
  monto_mensual: number;
  descripcion_inmueble?: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: 'activo' | 'finalizado';
  notas?: string;
  google_calendar_events?: any[];
  fecha_registro?: string;
}

export interface PagoAlquiler {
  id: string;
  alquiler_id: string;
  monto: number;
  fecha_pago: string;
  periodo_mes: number;
  periodo_anio: number;
  metodo_pago?: string;
  comprobante_url?: string | null;
  voucher_drive_file_id?: string | null;
  es_pago_completo?: boolean;
  fecha_registro?: string;
}

export interface CuotaPrestamo {
  numero: number;
  fechaVencimiento: string;
  capitalPendiente: number;
  interesPendiente: number;
  moraPendiente: number;
  penalidad: number;
  cargosAdicionales: number;
  montoCuotaBase: number;
  montoExigible: number;
  pagado: number;
  saldoPendiente: number;
  diasVencidos: number;
  estado: "Saldada" | "Pendiente" | "Vencida" | "Parcial";
  ajustesAplicados?: string[];
  interesOriginal?: number;
  congelada?: boolean;
  moraOriginal?: number;
  capitalAmortizado?: number;
  capitalAmortizadoPagado?: number;
  interesPagado?: number;
  moraPagado?: number;
  ultimoCalculoMoraDate?: Date;
  expressLiquidacion?: boolean;
  pagosRecibidos?: any[];
}

export interface ResumenDeudaPrestamo {
  totalCuotas: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  capitalPendiente: number;
  interesPendiente: number;
  moraAcumulada: number;
  penalidadesAcumuladas: number;
  cargosAdicionalesAcumulados: number;
  totalExigible: number;
  totalPagado: number;
  saldoPendiente: number;
  esElegibleLiquidacionExpress?: boolean;
  montoLiquidacionExpress?: number;
}

export interface AjustePrestamo {
  id: string;
  prestamo_id: string;
  tipo: 'congelar_interes_temporal' | 'acuerdo_especial';
  cuota_numero?: number;
  fecha_inicio: string;
  fecha_fin?: string;
  descripcion?: string;
  usuario: string;
  motivo: string;
  fecha_registro: string;
  activo: boolean;
}

export interface PlanAyudaCliente {
  tieneAjustesActivos: boolean;
  interesCongelado: boolean;
  fechaCongelamientoHasta?: string | null;
  moraEliminada: boolean;
  totalBeneficioAplicado: number;
}

export interface EstadoDeudaPrestamo {
  resumen: ResumenDeudaPrestamo;
  cuotas: CuotaPrestamo[];
  cuotaSiguiente: CuotaPrestamo | null;
  cuotasVencidasDetalle: CuotaPrestamo[];
  clasificacionPagoSugerida?: string;
  planAyuda?: PlanAyudaCliente;
  pagosDistribuidos?: any[];
}

// ── Documentos de Cliente (v2) ─────────────────────────────
export type TipoDocumento = 
  | 'dni_frontal'
  | 'dni_reverso'
  | 'recibo_luz'
  | 'recibo_agua'
  | 'foto_cliente'
  | 'otro';

export interface DocumentoCliente {
  id: string;
  cliente_id: string;
  tipo_documento: TipoDocumento;
  nombre_archivo: string;
  drive_file_id: string;
  drive_url: string;
  mime_type: string;
  fecha_subida: string;
  observacion?: string;
}

export const TIPOS_DOCUMENTO_CONFIG: Record<TipoDocumento, { label: string; icon: string; accept: string }> = {
  dni_frontal:   { label: 'DNI Frontal',        icon: '🪪', accept: 'image/*,application/pdf' },
  dni_reverso:   { label: 'DNI Reverso',         icon: '🪪', accept: 'image/*,application/pdf' },
  recibo_luz:    { label: 'Recibo de Luz',        icon: '⚡', accept: 'image/*,application/pdf,.doc,.docx' },
  recibo_agua:   { label: 'Recibo de Agua',       icon: '💧', accept: 'image/*,application/pdf,.doc,.docx' },
  foto_cliente:  { label: 'Foto del Cliente',     icon: '📷', accept: 'image/*' },
  otro:          { label: 'Otro Documento',        icon: '📎', accept: 'image/*,application/pdf,.doc,.docx' },
};

export const ACCEPT_DOCUMENTOS = 'image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
