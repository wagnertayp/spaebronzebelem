import { useState } from 'react';
import { useRoute } from 'wouter';
import { 
  useGetPublicQuote,
  useApprovePublicQuote
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetPublicQuoteQueryKey } from '@workspace/api-client-react';
import { format, parseISO } from 'date-fns';
import { CheckCircle, MessageSquare, Calendar } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export function OrcamentoPublico() {
  const [, params] = useRoute('/proposta/:token');
  const token = params?.token || '';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quote, isLoading, error } = useGetPublicQuote(token, { query: { enabled: !!token, queryKey: getGetPublicQuoteQueryKey(token) } });
  const approveQuote = useApprovePublicQuote();

  const [confirmDialog, setConfirmDialog] = useState(false);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-text-secondary">Carregando proposta...</div>;
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
        <h2 className="text-xl font-bold text-text-primary mb-2">Proposta não encontrada</h2>
        <p className="text-text-secondary text-center max-w-md">O link pode ter expirado ou estar incorreto. Por favor, entre em contato com o SPA.</p>
      </div>
    );
  }

  const isApproved = quote.status === 'approved';
  const isTerminal = quote.status === 'cancelled' || quote.status === 'rejected' || quote.status === 'expired';

  const handleApprove = () => {
    approveQuote.mutate({ token }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPublicQuoteQueryKey(token) });
        setConfirmDialog(false);
        toast({ title: 'Orçamento aprovado!', description: 'Nossa equipe entrará em contato em breve.' });
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Erro ao aprovar', description: 'Por favor, tente novamente ou entre em contato.' });
      }
    });
  };

  const handleWhatsApp = () => {
    window.open('https://wa.me/5591900000000', '_blank');
  };

  return (
    <div className="min-h-[100dvh] bg-background selection:bg-primary/20">
      {/* Brand Header */}
      <div className="bg-surface border-b border-border/60 py-6 px-4 md:px-8 text-center sticky top-0 z-10">
        <h1 className="text-[24px] font-black text-primary-dark tracking-tight uppercase">SPA & Bronze</h1>
        <p className="text-[13px] font-medium text-text-secondary uppercase tracking-[0.2em] mt-1">Sua proposta personalizada</p>
      </div>

      <div className="max-w-[720px] mx-auto p-4 md:p-8 space-y-6 pb-24">
        {/* Client Info */}
        <div className="text-center py-6">
          <p className="text-[15px] text-text-secondary font-medium">Olá, <strong className="text-text-primary">{quote.clientName}</strong>!</p>
          <p className="text-[14px] text-text-secondary mt-2">
            Preparamos esta proposta com muito carinho para você. Confira os detalhes abaixo.
          </p>
        </div>

        {isApproved && (
          <div className="bg-success/5 border border-success/20 rounded-2xl p-6 text-center shadow-sm">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
            <h3 className="text-[18px] font-bold text-success mb-2">Orçamento aprovado com sucesso!</h3>
            <p className="text-[14px] text-success/80 mb-6">Agradecemos a confiança. Estamos aguardando você.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-[#25D366] text-white hover:bg-[#25D366]/90 transition-colors shadow-sm">
                <MessageSquare className="w-4 h-4" /> Falar com o SPA
              </button>
            </div>
          </div>
        )}

        {isTerminal && !isApproved && (
          <div className="bg-error/5 border border-error/20 rounded-2xl p-6 text-center shadow-sm">
            <h3 className="text-[18px] font-bold text-error mb-2">Proposta Indisponível</h3>
            <p className="text-[14px] text-error/80">O status desta proposta é: <strong>{quote.status}</strong></p>
          </div>
        )}

        <Card className="p-6 md:p-8 border-border/60 shadow-card rounded-3xl space-y-8">
          <div className="flex justify-between items-center border-b border-border/40 pb-4">
            <span className="text-[13px] font-semibold text-text-secondary uppercase tracking-widest">Orçamento #{quote.number || quote.id}</span>
            <span className="text-[13px] font-medium text-text-secondary">Validade: {quote.validUntil ? format(parseISO(quote.validUntil), 'dd/MM/yyyy') : '-'}</span>
          </div>

          <div className="space-y-4">
            {quote.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start py-3 border-b border-border/20 last:border-0">
                <div>
                  <p className="text-[15px] font-bold text-text-primary">{item.name}</p>
                  <p className="text-[13px] text-text-secondary mt-1">{item.quantity} × R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                </div>
                <div className="text-right">
                  <p className="text-[16px] font-bold text-text-primary">
                    R$ {((item.unitPrice - (item.discount || 0)) * item.quantity).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface-soft rounded-2xl p-5 md:p-6 space-y-3">
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
            <div className="flex justify-between items-center pt-4 mt-2 border-t border-border/40">
              <span className="text-[18px] font-bold text-text-primary">TOTAL</span>
              <span className="text-[24px] font-black text-primary-dark">R$ {quote.total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <span className="block text-[12px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">Formas de Pagamento</span>
              <div className="flex flex-wrap gap-2">
                {quote.paymentMethods?.map(m => (
                  <span key={m} className="px-3 py-1.5 bg-surface border border-border/60 rounded-lg text-[13px] font-semibold text-text-primary capitalize shadow-sm">
                    {m}
                  </span>
                ))}
                {quote.paymentMethods?.includes('credit') && quote.installments > 1 && (
                  <span className="px-3 py-1.5 bg-surface border border-border/60 rounded-lg text-[13px] font-semibold text-text-primary shadow-sm">
                    Até {quote.installments}x
                  </span>
                )}
              </div>
            </div>

            {quote.customerNotes && (
              <div className="pt-2">
                <span className="block text-[12px] font-semibold text-text-secondary mb-2 uppercase tracking-wider">Observações</span>
                <p className="text-[14px] text-text-primary leading-relaxed bg-surface border border-border/40 p-4 rounded-xl">{quote.customerNotes}</p>
              </div>
            )}
          </div>
        </Card>

        {!isApproved && !isTerminal && (
          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={() => setConfirmDialog(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary-dark transition-all shadow-button text-[16px]"
            >
              <CheckCircle className="w-5 h-5" /> APROVAR ORÇAMENTO
            </button>
            <button 
              onClick={handleWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold border-2 border-primary/20 text-primary-dark hover:bg-primary-soft transition-all text-[16px]"
            >
              FALAR NO WHATSAPP
            </button>
          </div>
        )}
      </div>

      <Dialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <DialogContent className="max-w-[400px] rounded-[24px] p-0 overflow-hidden bg-surface border-border">
          <div className="p-8 text-center">
            <DialogHeader className="mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <DialogTitle className="text-[22px] font-bold text-text-primary tracking-tight">Confirmar aprovação</DialogTitle>
            </DialogHeader>
            <p className="text-[15px] text-text-secondary mb-8 leading-relaxed">
              Você deseja aprovar este orçamento no valor de <strong className="text-text-primary">R$ {quote.total.toFixed(2).replace('.', ',')}</strong>?
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleApprove} 
                disabled={approveQuote.isPending} 
                className="w-full px-5 py-3.5 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button text-[15px]"
              >
                {approveQuote.isPending ? 'Aprovando...' : 'Confirmar aprovação'}
              </button>
              <button 
                onClick={() => setConfirmDialog(false)} 
                className="w-full px-5 py-3.5 rounded-xl font-semibold text-text-secondary hover:bg-surface-soft transition-colors text-[15px]"
              >
                Voltar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}