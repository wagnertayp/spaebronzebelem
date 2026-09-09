import { useState, useMemo } from 'react';
import { useRoute, useLocation } from 'wouter';
import { 
  useListQuotes,
  useSendQuote,
  useCancelQuote,
  useDuplicateQuote,
  useCreateQuoteAppointment,
  useCreateQuotePayment,
  useListProfessionals,
  useListServices,
  QuotePaymentInputPaymentMethod,
  QuoteStatus
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListQuotesQueryKey, getListAppointmentsQueryKey, getListFinancialMovementsQueryKey } from '@workspace/api-client-react';
import { 
  ArrowLeft, Edit, Send, Link as LinkIcon, Download, Copy, Ban, CheckCircle, 
  Calendar, DollarSign, Clock, FileText, Smartphone 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, addHours } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function OrcamentoDetalhe() {
  const [, params] = useRoute('/orcamentos/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quoteId = parseInt(params?.id || '0', 10);

  const { data: quotes = [], isLoading } = useListQuotes({ search: quoteId.toString() });
  const { data: professionals = [] } = useListProfessionals();
  const { data: services = [] } = useListServices();
  const quote = useMemo(() => quotes.find(q => q.id === quoteId), [quotes, quoteId]);

  const sendQuote = useSendQuote();
  const cancelQuote = useCancelQuote();
  const duplicateQuote = useDuplicateQuote();
  const createAppointment = useCreateQuoteAppointment();
  const createPayment = useCreateQuotePayment();

  const [appointmentDialog, setAppointmentDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);

  // Appointment State
  const [aptDate, setAptDate] = useState('');
  const [aptTime, setAptTime] = useState('');
  const [aptEndTime, setAptEndTime] = useState('');
  const [aptProf, setAptProf] = useState<number | ''>('');

  // Payment State
  const [payMethod, setPayMethod] = useState<QuotePaymentInputPaymentMethod>('pix');
  const [payAmount, setPayAmount] = useState<number>(0);

  if (isLoading) {
    return <div className="p-8 text-center text-text-secondary">Carregando orçamento...</div>;
  }

  if (!quote) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold mb-4">Orçamento não encontrado</h2>
        <button onClick={() => setLocation('/servicos')} className="text-primary underline">Voltar para a lista</button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success border-success/20';
      case 'rejected': return 'bg-error/10 text-error border-error/20';
      case 'sent': return 'bg-primary/10 text-primary-dark border-primary/20';
      case 'viewed': return 'bg-accent/10 text-accent border-accent/20';
      case 'draft': return 'bg-surface border-border text-text-secondary';
      case 'expired': return 'bg-text-muted/10 text-text-secondary border-text-muted/20';
      case 'cancelled': return 'bg-text-muted/10 text-text-muted border-text-muted/20';
      default: return 'bg-surface border-border text-text-secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Recusado';
      case 'sent': return 'Enviado';
      case 'viewed': return 'Visualizado';
      case 'draft': return 'Rascunho';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleSendWhatsApp = () => {
    sendQuote.mutate({ id: quoteId }, {
      onSuccess: (res) => {
        window.open(res.whatsappUrl, '_blank');
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: 'Orçamento enviado', description: 'WhatsApp aberto com a mensagem.' });
      }
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/proposta/${quote.publicToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado!', description: 'O link da proposta pública foi copiado para a área de transferência.' });
  };

  const handleDuplicate = () => {
    duplicateQuote.mutate({ id: quoteId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        toast({ title: 'Orçamento duplicado com sucesso.' });
        setLocation('/servicos');
      }
    });
  };

  const handleCancel = () => {
    if (confirm('Deseja realmente cancelar este orçamento?')) {
      cancelQuote.mutate({ id: quoteId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          toast({ title: 'Orçamento cancelado.' });
        }
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const openAppointmentDialog = () => {
    const firstService = quote?.items?.find(i => i.type === 'service');
    setAptDate(firstService?.scheduledDate || format(new Date(), 'yyyy-MM-dd'));
    const start = firstService?.scheduledTime || '14:00';
    setAptTime(start);
    
    let durationMinutes = 60;
    if (firstService?.refId) {
      const serviceInfo = services.find(s => s.id === firstService.refId);
      if (serviceInfo?.duration) {
        const match = serviceInfo.duration.match(/(\d+)/);
        if (match) {
          durationMinutes = parseInt(match[1], 10);
          if (serviceInfo.duration.toLowerCase().includes('h') && !serviceInfo.duration.toLowerCase().includes('m')) {
            durationMinutes *= 60;
          }
        }
      }
    }
    
    try {
      const today = new Date(`2000-01-01T${start}:00`);
      const end = new Date(today.getTime() + durationMinutes * 60000);
      setAptEndTime(format(end, 'HH:mm'));
    } catch (e) {
      setAptEndTime('15:00');
    }
    
    setAptProf(firstService?.professionalId || '');
    setAppointmentDialog(true);
  };

  const handleSchedule = () => {
    if (!aptDate || !aptTime || !aptEndTime) return;
    const startStr = `${aptDate}T${aptTime}:00`;
    const endStr = `${aptDate}T${aptEndTime}:00`;

    createAppointment.mutate({
      id: quoteId,
      data: {
        start: startStr,
        end: endStr,
        professionalId: aptProf ? (aptProf as number) : undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setAppointmentDialog(false);
        toast({ title: 'Agendamento criado', description: 'Atendimento agendado na agenda com sucesso.' });
      }
    });
  };

  const handlePayment = () => {
    if (payAmount <= 0) return;
    createPayment.mutate({
      id: quoteId,
      data: {
        paymentMethod: payMethod,
        amount: payAmount
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListFinancialMovementsQueryKey() });
        setPaymentDialog(false);
        toast({ title: 'Pagamento registrado', description: 'O financeiro foi atualizado.' });
      }
    });
  };

  const openPaymentDialog = () => {
    if (quote.paidAt) {
      toast({ title: 'Já pago', description: 'Este orçamento já possui pagamento registrado.' });
      return;
    }
    setPayAmount(quote.total);
    setPaymentDialog(true);
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-10 print:bg-white print:p-0">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setLocation('/servicos')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface hover:bg-border transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[24px] md:text-[28px] font-bold text-text-primary tracking-tight">
                Orçamento {quote.number || `#${String(quote.id).padStart(5, '0')}`}
              </h1>
              <span className={cn("px-2.5 py-1 rounded-full text-[12px] font-medium border", getStatusColor(quote.status))}>
                {getStatusLabel(quote.status)}
              </span>
            </div>
            <p className="text-[14px] md:text-[15px] text-text-secondary mt-1">
              Criado em {format(parseISO(quote.createdAt), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status !== 'approved' && quote.status !== 'cancelled' && (
            <button 
              onClick={() => setLocation(`/servicos?action=edit&id=${quote.id}`)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
            >
              <Edit className="w-4 h-4" /> Editar
            </button>
          )}
          <button 
            onClick={handleSendWhatsApp}
            disabled={sendQuote.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 transition-colors"
          >
            <Smartphone className="w-4 h-4" /> Enviar WhatsApp
          </button>
          <button 
            onClick={handleCopyLink}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
          >
            <LinkIcon className="w-4 h-4" /> Link
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
          >
            <Download className="w-4 h-4" /> PDF
          </button>
          
          <div className="w-px h-6 bg-border mx-1 hidden md:block" />

          <button 
            onClick={handleDuplicate}
            disabled={duplicateQuote.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
          >
            <Copy className="w-4 h-4" /> Duplicar
          </button>

          {quote.status !== 'cancelled' && quote.status !== 'approved' && (
            <button 
              onClick={handleCancel}
              disabled={cancelQuote.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-error hover:bg-error/10 transition-colors"
            >
              <Ban className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Integration Actions */}
      {quote.status === 'approved' && (
        <div className="flex flex-col md:flex-row gap-4 p-4 bg-success/5 border border-success/20 rounded-2xl print:hidden">
          <div className="flex-1">
            <h4 className="font-bold text-success flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Orçamento Aprovado</h4>
            <p className="text-[14px] text-success/80 mt-1">Este orçamento foi aprovado pelo cliente. Você pode agora agendar e registrar o financeiro.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button 
              onClick={openAppointmentDialog}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-surface border border-success/30 rounded-xl text-success font-semibold hover:bg-success hover:text-white transition-colors shadow-sm"
            >
              <Calendar className="w-4 h-4" /> Agendar atendimento
            </button>
            <button 
              onClick={openPaymentDialog}
              disabled={!!quote.paidAt}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-success rounded-xl text-white font-semibold hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
            >
              <DollarSign className="w-4 h-4" /> {quote.paidAt ? 'Pagamento Registrado' : 'Registrar pagamento'}
            </button>
          </div>
        </div>
      )}

      {/* Print View Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
        <div className="lg:col-span-4 space-y-6 print:mb-6">
          <Card className="p-6 border-border/60 shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="font-bold text-[15px] text-text-primary border-b border-border/60 pb-3 mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-text-muted" /> Dados do Cliente</h3>
            <div className="space-y-3">
              <div>
                <span className="block text-[12px] font-semibold text-text-secondary">Nome</span>
                <span className="text-[15px] font-bold text-text-primary">{quote.clientName}</span>
              </div>
              <div>
                <span className="block text-[12px] font-semibold text-text-secondary">WhatsApp</span>
                <span className="text-[14px] text-text-primary">{quote.phone || 'Não informado'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[12px] font-semibold text-text-secondary">Data Emissão</span>
                  <span className="text-[14px] text-text-primary">{format(parseISO(quote.createdAt), 'dd/MM/yyyy')}</span>
                </div>
                <div>
                  <span className="block text-[12px] font-semibold text-text-secondary">Validade</span>
                  <span className="text-[14px] text-text-primary">{quote.validUntil ? format(parseISO(quote.validUntil), 'dd/MM/yyyy') : '-'}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border/60 shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="font-bold text-[15px] text-text-primary border-b border-border/60 pb-3 mb-4">Condições Comerciais</h3>
            <div className="space-y-4">
              <div>
                <span className="block text-[12px] font-semibold text-text-secondary mb-1.5">Formas de Pagamento Aceitas</span>
                <div className="flex flex-wrap gap-2">
                  {quote.paymentMethods?.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-surface-soft border border-border rounded-md text-[12px] font-medium capitalize">
                      {m}
                    </span>
                  ))}
                  {quote.paymentMethods?.includes('credit') && quote.installments > 1 && (
                    <span className="px-2.5 py-1 bg-surface-soft border border-border rounded-md text-[12px] font-medium">
                      Até {quote.installments}x
                    </span>
                  )}
                </div>
              </div>

              {quote.customerNotes && (
                <div>
                  <span className="block text-[12px] font-semibold text-text-secondary mb-1.5">Observações</span>
                  <p className="text-[13px] text-text-primary bg-surface-soft p-3 rounded-xl border border-border">{quote.customerNotes}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 border-border/60 shadow-sm print:shadow-none print:border-none print:p-0">
            <h3 className="font-bold text-[16px] text-text-primary border-b border-border/60 pb-3 mb-4">Itens do Orçamento</h3>
            
            <div className="space-y-3">
              {quote.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-3 border-b border-border/40 last:border-0 print:py-2">
                  <div>
                    <p className="text-[14px] font-bold text-text-primary">{item.name}</p>
                    <div className="flex gap-2 text-[12px] text-text-secondary mt-0.5">
                      <span className="capitalize">{item.type.replace('_', ' ')}</span>
                      {item.scheduledDate && <span>• {format(new Date(item.scheduledDate), 'dd/MM')} às {item.scheduledTime}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[12px] text-text-secondary">{item.quantity} × R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                    <p className="text-[15px] font-bold text-text-primary">
                      R$ {((item.unitPrice - (item.discount || 0)) * item.quantity).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <div className="w-full md:w-[320px] bg-surface-soft border border-border rounded-2xl p-5 space-y-3 print:border-none print:p-0 print:bg-transparent">
                <div className="flex justify-between items-center text-[14px]">
                  <span className="text-text-secondary font-medium">Subtotal</span>
                  <span className="text-text-primary font-semibold">R$ {quote.subtotal.toFixed(2).replace('.', ',')}</span>
                </div>
                {quote.discount > 0 && (
                  <div className="flex justify-between items-center text-[14px]">
                    <span className="text-text-secondary font-medium">Desconto</span>
                    <span className="text-error font-semibold">- R$ {quote.discount.toFixed(2).replace('.', ',')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-border/40">
                  <span className="text-[18px] font-bold text-text-primary">TOTAL</span>
                  <span className="text-[20px] font-black text-primary-dark">R$ {quote.total.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          </Card>

          {quote.internalNotes && (
            <Card className="p-6 border-warning/30 bg-warning/5 shadow-sm print:hidden">
              <h3 className="font-bold text-[14px] text-warning-dark border-b border-warning/20 pb-2 mb-3">Observações Internas (Ocultas do Cliente)</h3>
              <p className="text-[13px] text-text-primary">{quote.internalNotes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={appointmentDialog} onOpenChange={setAppointmentDialog}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-surface border-border">
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-[20px] font-bold text-text-primary">Agendar Atendimento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Profissional</label>
                <select value={aptProf} onChange={e => setAptProf(parseInt(e.target.value))} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]">
                  <option value="">Sem preferência</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Data</label>
                  <input type="date" value={aptDate} onChange={e => setAptDate(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Início</label>
                  <input type="time" value={aptTime} onChange={e => setAptTime(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Término</label>
                  <input type="time" value={aptEndTime} onChange={e => setAptEndTime(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-8 border-t border-border/40 pt-4 gap-3">
              <button onClick={() => setAppointmentDialog(false)} className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:bg-surface-soft">Cancelar</button>
              <button onClick={handleSchedule} disabled={createAppointment.isPending} className="px-5 py-2 rounded-xl font-semibold bg-success text-white hover:bg-success/90 shadow-sm">
                Confirmar Agenda
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-surface border-border">
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-[20px] font-bold text-text-primary">Registrar Pagamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Forma de Pagamento</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as any)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]">
                  <option value="pix">PIX</option>
                  <option value="credit">Cartão de Crédito</option>
                  <option value="debit">Cartão de Débito</option>
                  <option value="cash">Dinheiro</option>
                  <option value="boleto">Boleto</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Valor Recebido (R$)</label>
                <input type="number" step="0.01" min="0" value={payAmount} onChange={e => setPayAmount(parseFloat(e.target.value) || 0)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
              </div>
            </div>
            <DialogFooter className="mt-8 border-t border-border/40 pt-4 gap-3">
              <button onClick={() => setPaymentDialog(false)} className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:bg-surface-soft">Cancelar</button>
              <button onClick={handlePayment} disabled={createPayment.isPending} className="px-5 py-2 rounded-xl font-semibold bg-success text-white hover:bg-success/90 shadow-sm">
                Confirmar Recebimento
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}