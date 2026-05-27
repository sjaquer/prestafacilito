import React from "react";
import { PlusCircle, UploadCloud, CalendarDays, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";

interface QuickActionsProps {
  onNewLoanClick: () => void;
  onRegisterPagoClick: () => void;
  onSyncCalendarClick: () => void;
  syncingCalendar: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onNewLoanClick,
  onRegisterPagoClick,
  onSyncCalendarClick,
  syncingCalendar,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 select-none">
      <Button
        onClick={onSyncCalendarClick}
        disabled={syncingCalendar}
        variant="secondary"
        icon={
          syncingCalendar ? (
            <Loader2 size={15} className="text-indigo-400 animate-spin" />
          ) : (
            <CalendarDays size={15} className="text-indigo-400" />
          )
        }
        title="Sincronizar cuotas del mes actual y limpiar mes pasado"
      >
        Sincronizar Calendario
      </Button>

      <Button
        onClick={onRegisterPagoClick}
        variant="secondary"
        icon={<UploadCloud size={15} className="text-emerald-400" />}
      >
        Registrar Pago Rápido
      </Button>

      <Button
        onClick={onNewLoanClick}
        variant="primary"
        icon={<PlusCircle size={16} />}
      >
        Otorgar Préstamo
      </Button>
    </div>
  );
};
