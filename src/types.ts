export interface Cliente {
  id: string;
  nombre_completo: string;
  telefono: string;
  observaciones: string;
  fecha_registro: string;
  // Campos ampliados v2
  direccion?: string;
  numero_cuenta?: string;
  banco_cuenta?: string;
  informacion_adicional?: string;
  drive_folder_id?: string;
  // Campos calculados desde la vista
  prestamos_activos?: number;
  total_prestamos?: number;
  capital_total_prestado?: number;
  total_exigible?: number;
  total_amortizado?: number;
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
  configuracion_ayuda?: {
    periodo_gracia_dias?: number;
    [key: string]: any;
  };
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
  ajustesAplicados?: string[];     // IDs de ajustes que afectan esta cuota
  interesOriginal?: number;         // Para mostrar el ahorro de intereses
  congelada?: boolean;              // Si el interés de la cuota está congelado
  moraOriginal?: number;            // Mora original antes de reducción/eliminación
  capitalAmortizado?: number;       // Parte del abono del cliente que va directamente a capital (principal)
  interesPagado?: number;           // Total de interés pagado en esta cuota
  moraPagado?: number;              // Total de mora pagada en esta cuota
  ultimoCalculoMoraDate?: Date;     // Última fecha en la que se calculó la mora
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
}

export interface AjustePrestamo {
  id: string;
  prestamo_id: string;
  tipo: 'congelar_interes_temporal' | 'congelar_interes_permanente' | 
        'eliminar_interes_cuota' | 'reducir_mora' | 'eliminar_mora' | 'periodo_gracia';
  monto_afectado: number;
  monto_antes: number;
  monto_despues: number;
  cuota_numero?: number;
  fecha_inicio: string;
  fecha_fin?: string;
  periodo_gracia_dias: number;
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
  planAyuda?: PlanAyudaCliente; // Resumen del plan de ayuda aplicado
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
