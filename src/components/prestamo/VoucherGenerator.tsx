import React, { useRef } from "react";
import { Printer, Calendar, FileText, Landmark, User, Coins } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { formatCurrency, formatDate } from "../../lib/formatters";

interface VoucherGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  pago: any;
  prestamo: any;
}

export const VoucherGenerator: React.FC<VoucherGeneratorProps> = ({
  isOpen,
  onClose,
  pago,
  prestamo,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!pago || !prestamo) return null;

  const isAlquiler = prestamo.tipo_prestamo === "Alquiler de Casa";
  const folio = `REC-${pago.id.slice(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    const printContent = printAreaRef.current?.innerHTML;
    if (!printContent) return;

    // Crear ventana temporal para impresión limpia
    const originalContent = document.body.innerHTML;
    const printWindow = window.open("", "_blank");
    
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Comprobante de Pago ${folio}</title>
            <style>
              body {
                font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                color: #0f172a;
                background-color: #ffffff;
                padding: 40px;
                line-height: 1.5;
              }
              .voucher-card {
                max-width: 480px;
                margin: 0 auto;
                border: 1px solid #e2e8f0;
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              }
              .header {
                text-align: center;
                border-bottom: 2px dashed #e2e8f0;
                padding-bottom: 20px;
                margin-bottom: 25px;
              }
              .logo {
                font-size: 24px;
                font-weight: 900;
                color: #4f46e5;
                letter-spacing: -0.03em;
              }
              .subtitle {
                font-size: 11px;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 700;
                margin-top: 4px;
              }
              .folio-badge {
                display: inline-block;
                background: #f1f5f9;
                color: #334155;
                font-size: 12px;
                font-weight: 800;
                padding: 4px 12px;
                border-radius: 99px;
                margin-top: 12px;
                font-family: monospace;
              }
              .section-title {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: #64748b;
                font-weight: 800;
                margin-top: 20px;
                margin-bottom: 8px;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 4px;
              }
              .grid-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-weight: 600;
                margin-bottom: 8px;
              }
              .grid-label {
                color: #64748b;
              }
              .grid-value {
                color: #0f172a;
              }
              .amount-row {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                padding: 15px;
                border-radius: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 25px;
              }
              .amount-label {
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                color: #64748b;
              }
              .amount-value {
                font-size: 20px;
                font-weight: 900;
                color: #10b981;
                font-family: monospace;
              }
              .footer {
                text-align: center;
                margin-top: 35px;
                color: #94a3b8;
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
              }
              .qr-pattern {
                width: 70px;
                height: 70px;
                margin: 20px auto 0;
                opacity: 0.6;
              }
              @media print {
                body { padding: 0; }
                .voucher-card { 
                  border: none;
                  box-shadow: none;
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="voucher-card">
              ${printContent}
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.close();
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAlquiler ? "Recibo de Alquiler" : "Recibo de Amortización"}
      size="sm"
      footerActions={
        <>
          <Button onClick={onClose} variant="secondary" size="sm">
            Cerrar
          </Button>
          <Button
            onClick={handlePrint}
            variant="primary"
            size="sm"
            icon={<Printer size={14} />}
          >
            Imprimir Recibo
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center py-4 select-none font-sans">
        
        {/* Print Area Preview */}
        <div 
          ref={printAreaRef}
          className="w-full max-w-[420px] bg-white text-slate-900 rounded-3xl p-6 shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-slate-200 pb-5 mb-5 flex flex-col items-center">
            <span className="text-lg font-black text-indigo-650 flex items-center gap-1.5 leading-none">
              <Coins className="text-indigo-600" size={20} />
              PrestaFacilito
            </span>
            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1 block">
              {isAlquiler ? "Comprobante de Alquiler Oficial" : "Comprobante de Amortización Oficial"}
            </span>
            <span className="folio-badge inline-block bg-slate-100 text-slate-700 text-[11px] font-black font-mono px-3 py-1 rounded-full mt-3">
              {folio}
            </span>
          </div>

          {/* Detalles Cliente */}
          <div className="section-title text-[10px] text-slate-500 font-black uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
            {isAlquiler ? "Información del Arrendatario" : "Información del Prestatario"}
          </div>
          
          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">Cliente:</span>
            <span className="text-slate-800 text-right">{prestamo.cliente_nombre}</span>
          </div>
          
          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">Teléfono:</span>
            <span className="text-slate-800 text-right">{prestamo.cliente_telefono || "No registrado"}</span>
          </div>

          {/* Detalles Crédito */}
          <div className="section-title text-[10px] text-slate-500 font-black uppercase tracking-wider mt-4 mb-2 border-b border-slate-100 pb-1">
            {isAlquiler ? "Detalles del Alquiler" : "Detalles del Crédito"}
          </div>

          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">{isAlquiler ? "Categoría Contrato:" : "Categoría Préstamo:"}</span>
            <span className="text-slate-800 text-right">{prestamo.tipo_prestamo}</span>
          </div>
          
          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">{isAlquiler ? "Total Alquiler:" : "Capital Otorgado:"}</span>
            <span className="text-slate-800 font-mono font-extrabold text-right">{formatCurrency(prestamo.monto_capital)}</span>
          </div>

          {/* Detalles Pago */}
          <div className="section-title text-[10px] text-slate-500 font-black uppercase tracking-wider mt-4 mb-2 border-b border-slate-100 pb-1">
            Detalles del Pago
          </div>

          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">Fecha de Registro:</span>
            <span className="text-slate-800 font-mono text-right">{formatDate(pago.fecha_pago)}</span>
          </div>

          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">Método Utilizado:</span>
            <span className="text-slate-800 font-extrabold text-right uppercase">{pago.metodo_pago}</span>
          </div>
          
          <div className="grid-row flex justify-between text-xs font-semibold mb-1">
            <span className="text-slate-500">Clasificación abono:</span>
            <span className="text-slate-800 text-right font-extrabold">{pago.tipo_movimiento || "Pago Ordinario"}</span>
          </div>

          {/* Monto cobrado */}
          <div className="amount-row bg-slate-50 border border-slate-200 p-4 rounded-xl flex justify-between items-center mt-5 shadow-inner">
            <span className="amount-label text-[10px] text-slate-500 font-bold uppercase tracking-wider">{isAlquiler ? "Monto Cancelado" : "Monto Amortizado"}</span>
            <span className="amount-value text-lg font-black text-emerald-500 font-mono">
              {formatCurrency(pago.monto)}
            </span>
          </div>

          {/* QR Pattern SVG */}
          <svg className="qr-pattern w-16 h-16 opacity-50 mt-5 mx-auto" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="none" />
            <path d="M10,10 h20 v20 h-20 z M15,15 h10 v10 h-10 z" fill="#334155" />
            <path d="M70,10 h20 v20 h-20 z M75,15 h10 v10 h-10 z" fill="#334155" />
            <path d="M10,70 h20 v20 h-20 z M15,75 h10 v10 h-10 z" fill="#334155" />
            <path d="M40,10 h10 v10 h-10 z M55,10 h10 v10 h-10 z M45,25 h15 v5 h-15 z" fill="#334155" />
            <path d="M10,40 h10 v10 h-10 z M25,40 h15 v5 h-15 z M15,55 h10 v10 h-10 z" fill="#334155" />
            <path d="M45,45 h10 v10 h-10 z M60,45 h10 v10 h-10 z M45,60 h25 v5 h-25 z" fill="#334155" />
            <path d="M80,40 h10 v15 h-10 z M80,60 h10 v30 h-10 z M40,80 h30 v10 h-30 z" fill="#334155" />
          </svg>

          {/* Footer */}
          <div className="footer text-center text-[8.5px] text-slate-400 font-extrabold uppercase tracking-widest mt-5 pt-3 border-t border-slate-100">
            © 2026 PrestaFacilito · Validez Electrónica
          </div>
        </div>

      </div>
    </Modal>
  );
};
export default VoucherGenerator;
