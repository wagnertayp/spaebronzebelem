import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Plus, Users, BadgeDollarSign, Download } from 'lucide-react';
import { Professional, useGetCommissionsSummary, getGetCommissionsSummaryQueryKey, CommissionItemStatus } from '@workspace/api-client-react';
import { format } from "date-fns";

import { ProfessionalsTab } from '@/components/commissions/ProfessionalsTab';
import { CommissionsTab } from '@/components/commissions/CommissionsTab';
import { ProfessionalDialog } from '@/components/commissions/ProfessionalDialog';
import { CommissionConfigDrawer } from '@/components/commissions/CommissionConfigDrawer';
import { CommissionDetailDrawer } from '@/components/commissions/CommissionDetailDrawer';
import { ExportDialog } from '@/components/export/export-dialog';
import { formatCurrency } from '@/components/commissions/utils';
import { StaffAccessTab } from '@/components/staff-access/staff-access-tab';
import { useAuth } from '@/hooks/use-auth';

type Tab = 'profissionais' | 'comissoes' | 'acessos';
type Period = 'today' | 'month' | 'custom';
type TabStatus = 'all' | 'open' | 'closed' | 'paid';
type DetailState = { open: boolean, prof: Professional | null, period: { from: string; to: string } | null, statusFilter: 'all' | 'open' | 'closed' | 'paid' };

export function Usuarios() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';
  const [activeTab, setActiveTab] = useState<Tab>(isStaff ? 'comissoes' : 'profissionais');
  
  const [profDialog, setProfDialog] = useState<{ open: boolean, prof: Professional | null }>({ open: false, prof: null });
  const [configDrawer, setConfigDrawer] = useState<{ open: boolean, prof: Professional | null }>({ open: false, prof: null });
  const [detailDrawer, setDetailDrawer] = useState<DetailState>({ open: false, prof: null, period: null, statusFilter: 'all' });
  
  // Commissions Tab State (Lifted for Export)
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<TabStatus>('all');
  const [profFilter, setProfFilter] = useState<string>(
    isStaff && user?.professionalId != null ? String(user.professionalId) : "all",
  );
  
  const [exportOpen, setExportOpen] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    }
    if (period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd") };
    }
    return { from: customFrom, to: customTo };
  }, [period, customFrom, customTo]);

  const apiStatus = statusFilter === 'open' ? 'eligible' : statusFilter === 'closed' ? 'closed' : statusFilter === 'paid' ? 'paid' : undefined;
  const pId = isStaff && user?.professionalId != null
    ? user.professionalId
    : profFilter !== 'all' ? Number(profFilter) : undefined;
  const validDates = dateRange.from && dateRange.to && dateRange.from <= dateRange.to;

  const { data: summary } = useGetCommissionsSummary(
    { from: dateRange.from, to: dateRange.to, status: apiStatus as CommissionItemStatus, professionalId: pId },
    { 
      query: { 
        enabled: Boolean(validDates && activeTab === 'comissoes'),
        queryKey: getGetCommissionsSummaryQueryKey({ from: dateRange.from, to: dateRange.to, status: apiStatus as CommissionItemStatus, professionalId: pId })
      } 
    }
  );

  const handleExportCSV = (filename: string) => {
    if (!summary?.items || summary.items.length === 0) return;

    const bom = '\uFEFF';
    const headers = ['Data', 'Profissional', 'Serviço', 'Base de Cálculo', 'Taxa Aplicada', 'Comissão Gerada', 'Status'];
    
    const rows = summary.items.map(c => [
      c.date ? format(new Date(c.date), 'dd/MM/yyyy') : '-',
      c.professionalName,
      c.serviceName,
      c.baseAmount != null ? formatCurrency(c.baseAmount) : '0,00',
      c.rateType === 'percent' ? `${c.rateValue}%` : (c.rateValue != null ? formatCurrency(c.rateValue) : '-'),
      c.commissionAmount != null ? formatCurrency(c.commissionAmount) : '0,00',
      c.status === 'paid' ? 'PAGO' : c.status === 'closed' ? 'FECHADA' : c.status === 'blocked' ? 'BLOQUEADA' : 'EM ABERTO'
    ]);
    
    const csvContent = [
      `Relatório de Comissões`,
      `Período: ${dateRange.from} até ${dateRange.to}`,
      '',
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openProfDialog = (prof?: Professional) => {
    setProfDialog({ open: true, prof: prof || null });
  };

  const handleViewCommissions = (prof: Professional) => {
    setProfFilter(prof.id.toString());
    setActiveTab('comissoes');
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto pb-12">
      <PageHeader 
        title={isStaff ? "Minhas comissões" : "Usuários"}
        description={isStaff
          ? "Acompanhe suas comissões e os atendimentos do período."
          : "Profissionais, comissões, acessos e desempenho por período."}
        action={
          isStaff ? undefined : activeTab === 'profissionais' ? (
            <Button className="bg-primary hover:bg-primary-dark text-white shadow-none rounded-lg" onClick={() => openProfDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Profissional
            </Button>
          ) : activeTab === 'comissoes' ? (
             <Button variant="outline" className="gap-2 border-border" onClick={() => setExportOpen(true)}>
              <Download className="w-4 h-4" />
              Exportar Comissões
            </Button>
          ) : undefined
        }
      />
      
      {!isStaff && <div className="flex flex-wrap border-b border-border mb-6">
        <button
          className={cn("px-6 py-3 text-[14px] font-medium transition-colors border-b-2", activeTab === 'profissionais' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          onClick={() => setActiveTab('profissionais')}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Profissionais
          </div>
        </button>
        <button
          className={cn("px-6 py-3 text-[14px] font-medium transition-colors border-b-2", activeTab === 'comissoes' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          onClick={() => setActiveTab('comissoes')}
        >
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="w-4 h-4" /> Comissões
          </div>
        </button>
        <button
          className={cn("px-6 py-3 text-[14px] font-medium transition-colors border-b-2", activeTab === 'acessos' ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary")}
          onClick={() => setActiveTab('acessos')}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Acessos
          </div>
        </button>
      </div>}

      {activeTab === 'profissionais' && (
        <ProfessionalsTab 
          onEdit={(prof) => openProfDialog(prof)}
          onConfigCommission={(prof) => setConfigDrawer({ open: true, prof })}
          onViewCommissions={handleViewCommissions}
        />
      )}

      {activeTab === 'comissoes' && (
        <CommissionsTab 
          period={period}
          setPeriod={setPeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          profFilter={profFilter}
          setProfFilter={setProfFilter}
          dateRange={dateRange}
          validDates={validDates as boolean}
          apiStatus={apiStatus}
          pId={pId}
          lockedProfessionalId={isStaff ? user?.professionalId ?? undefined : undefined}
          onViewDetails={(prof, period, statusFilter) => setDetailDrawer({ open: true, prof, period, statusFilter })}
        />
      )}

      {activeTab === 'acessos' && !isStaff && <StaffAccessTab />}

      {!isStaff && <ProfessionalDialog 
        open={profDialog.open} 
        onOpenChange={(o) => !o && setProfDialog({ open: false, prof: null })} 
        professional={profDialog.prof} 
      />}

      {!isStaff && <CommissionConfigDrawer
        open={configDrawer.open}
        onOpenChange={(o) => !o && setConfigDrawer({ open: false, prof: null })}
        professional={configDrawer.prof}
      />}

      <CommissionDetailDrawer
        open={detailDrawer.open}
        onOpenChange={(o) => !o && setDetailDrawer({ open: false, prof: null, period: null, statusFilter: 'all' })}
        professional={detailDrawer.prof}
        period={detailDrawer.period}
        statusFilter={detailDrawer.statusFilter}
        readOnly={isStaff}
      />

      {!isStaff && <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar Comissões"
        defaultFilename={`comissoes_${period}`}
        count={summary?.items.length || 0}
        onExport={handleExportCSV}
      >
        <div className="py-2 text-sm text-text-secondary">
          Os dados exportados seguirão os filtros atualmente aplicados na aba Comissões.
        </div>
      </ExportDialog>}
    </div>
  );
}
