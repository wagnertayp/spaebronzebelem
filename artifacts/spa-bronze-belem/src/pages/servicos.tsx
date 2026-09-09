import { useState } from 'react';
import { 
  useListServices, 
  useListQuotes, 
  useCreateQuote, 
  useUpdateQuote,
  useDeleteQuote,
  useCreateService,
  getListQuotesQueryKey,
  getListServicesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Plus, ArrowLeft, Trash2, Download, Receipt, Save, Phone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function Servicos() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: services = [], isLoading: isLoadingServices } = useListServices();
  const { data: quotes = [], isLoading: isLoadingQuotes } = useListQuotes();
  
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const deleteQuote = useDeleteQuote();
  const createService = useCreateService();

  const [view, setView] = useState<'list' | 'create'>('list');
  const [editingQuoteId, setEditingQuoteId] = useState<number | null>(null);
  
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [discount, setDiscount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Array<{ id: string, serviceId: number, name: string, quantity: number, unitPrice: number }>>([]);
  const [quoteNumber, setQuoteNumber] = useState('');
  
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dialog states
  const [quoteToDelete, setQuoteToDelete] = useState<number | null>(null);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    category: 'Procedimentos Faciais',
    duration: '60 min',
    price: '',
    accent: 'bg-primary-soft text-primary-dark'
  });

  const resetForm = () => {
    setEditingQuoteId(null);
    setClientName('');
    setPhone('');
    setValidUntil('');
    setDiscount('');
    setNotes('');
    setItems([]);
    setQuoteNumber('');
    setErrorMsg('');
  };

  const openQuote = (quote: typeof quotes[number]) => {
    setEditingQuoteId(quote.id);
    setClientName(quote.clientName);
    setPhone(quote.phone);
    setValidUntil(quote.validUntil);
    setDiscount(quote.discount || '');
    setNotes(quote.notes);
    setItems(quote.items.map((item, index) => ({
      ...item,
      id: `${quote.id}-${item.serviceId}-${index}`,
    })));
    setQuoteNumber(quote.number);
    setErrorMsg('');
    setView('create');
  };

  const handleAddService = (serviceIdStr: string) => {
    const serviceId = parseInt(serviceIdStr, 10);
    if (!serviceId) return;
    const svc = services.find(s => s.id === serviceId);
    if (!svc) return;
    
    const parsedPrice = parseFloat(svc.price.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    
    setItems(prev => [
      ...prev, 
      { id: Math.random().toString(36).substring(7), serviceId: svc.id, name: svc.name, quantity: 1, unitPrice: parsedPrice }
    ]);
  };

  const handleCreateService = () => {
    if (!newService.name || !newService.price) {
      toast({ variant: 'destructive', title: 'Preencha os campos obrigatórios' });
      return;
    }
    
    let finalPrice = newService.price;
    if (!finalPrice.toLowerCase().includes('r$')) {
      finalPrice = `R$ ${finalPrice}`;
    }

    createService.mutate({
      data: {
        ...newService,
        price: finalPrice
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        setIsServiceDialogOpen(false);
        setNewService({
          name: '',
          category: 'Procedimentos Faciais',
          duration: '60 min',
          price: '',
          accent: 'bg-primary-soft text-primary-dark'
        });
        toast({
          title: 'Serviço criado com sucesso',
          description: 'Você já pode adicioná-lo ao orçamento.',
        });
      },
      onError: () => {
        toast({
          variant: 'destructive',
          title: 'Erro ao criar serviço',
          description: 'Verifique os dados e tente novamente.',
        });
      }
    });
  };

  const handleDeleteQuote = (id: number) => {
    deleteQuote.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
        setQuoteToDelete(null);
        toast({
          title: 'Orçamento excluído',
          description: 'O orçamento foi removido com sucesso.',
        });
      },
      onError: () => {
        toast({
          variant: 'destructive',
          title: 'Erro ao excluir',
          description: 'Não foi possível excluir o orçamento.',
        });
      }
    });
  };

  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const numDiscount = Number(discount) || 0;
  const total = Math.max(0, subtotal - numDiscount);
  const isExportReady = clientName.trim().length >= 2 && items.length > 0;
  const displayQuoteNumber = quoteNumber || `ORC-${String(quotes.length + 1).padStart(4, '0')}`;

  const exportQuoteAsJPEG = async () => {
    if (!isExportReady) {
      setErrorMsg('Adicione um cliente e pelo menos um item para exportar.');
      return;
    }
    
    setIsExporting(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas não suportado no navegador.');
      
      const width = 800;
      const padding = 50;
      let currentY = padding;
      
      const notesHeight = notes ? 120 : 0;
      const height = 300 + (items.length * 45) + 180 + notesHeight + padding * 2;
      canvas.width = width;
      canvas.height = height;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        logo.onload = resolve;
        logo.onerror = reject;
        logo.src = '/logo-clean.png';
      });
      
      const logoWidth = 160;
      const logoHeight = (logo.height / logo.width) * logoWidth;
      ctx.drawImage(logo, padding, currentY, logoWidth, logoHeight);
      
      ctx.fillStyle = '#272A27';
      ctx.font = 'bold 28px "Montserrat", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('ORÇAMENTO', width - padding, currentY + 30);
      
      ctx.font = '500 14px "Montserrat", sans-serif';
      ctx.fillStyle = '#747871';
      ctx.fillText(`#${displayQuoteNumber}`, width - padding, currentY + 50);
      ctx.fillText(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, width - padding, currentY + 70);
      if (validUntil) {
        const [year, month, day] = validUntil.split('-');
        ctx.fillText(`Válido até: ${day}/${month}/${year}`, width - padding, currentY + 90);
      }
      
      currentY += Math.max(logoHeight, 100) + 40;
      
      ctx.textAlign = 'left';
      ctx.fillStyle = '#272A27';
      ctx.font = 'bold 18px "Montserrat", sans-serif';
      ctx.fillText('Dados do Cliente', padding, currentY);
      
      currentY += 30;
      ctx.font = '500 15px "Montserrat", sans-serif';
      ctx.fillText(`Nome: ${clientName}`, padding, currentY);
      if (phone) {
        currentY += 25;
        ctx.fillText(`WhatsApp/Telefone: ${phone}`, padding, currentY);
      }
      
      currentY += 40;
      
      ctx.fillStyle = '#FAF9F6';
      ctx.beginPath();
      ctx.roundRect(padding, currentY, width - padding * 2, 45, 8);
      ctx.fill();
      
      ctx.fillStyle = '#272A27';
      ctx.font = 'bold 14px "Montserrat", sans-serif';
      ctx.fillText('Serviço', padding + 20, currentY + 28);
      ctx.textAlign = 'center';
      ctx.fillText('Qtd', width - 260, currentY + 28);
      ctx.textAlign = 'right';
      ctx.fillText('V. Unitário', width - 140, currentY + 28);
      ctx.fillText('Total', width - padding - 20, currentY + 28);
      
      currentY += 55;
      
      ctx.font = '500 14px "Montserrat", sans-serif';
      items.forEach((item) => {
        ctx.fillStyle = '#272A27';
        ctx.textAlign = 'left';
        ctx.fillText(item.name, padding + 20, currentY + 28);
        
        ctx.textAlign = 'center';
        ctx.fillText(item.quantity.toString(), width - 260, currentY + 28);
        
        ctx.textAlign = 'right';
        ctx.fillText(`R$ ${item.unitPrice.toFixed(2).replace('.', ',')}`, width - 140, currentY + 28);
        ctx.fillText(`R$ ${(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}`, width - padding - 20, currentY + 28);
        
        currentY += 45;
      });
      
      currentY += 10;
      ctx.strokeStyle = 'rgba(39, 42, 39, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width - 350, currentY);
      ctx.lineTo(width - padding, currentY);
      ctx.stroke();
      currentY += 30;
      
      ctx.textAlign = 'right';
      ctx.font = '500 15px "Montserrat", sans-serif';
      ctx.fillStyle = '#747871';
      ctx.fillText('Subtotal:', width - 160, currentY);
      ctx.fillStyle = '#272A27';
      ctx.fillText(`R$ ${subtotal.toFixed(2).replace('.', ',')}`, width - padding - 20, currentY);
      
      if (numDiscount > 0) {
        currentY += 30;
        ctx.fillStyle = '#747871';
        ctx.fillText('Desconto:', width - 160, currentY);
        ctx.fillStyle = '#B96E68';
        ctx.fillText(`- R$ ${numDiscount.toFixed(2).replace('.', ',')}`, width - padding - 20, currentY);
      }
      
      currentY += 40;
      ctx.font = 'bold 20px "Montserrat", sans-serif';
      ctx.fillStyle = '#272A27';
      ctx.fillText('Total:', width - 160, currentY);
      ctx.fillStyle = '#596653';
      ctx.fillText(`R$ ${total.toFixed(2).replace('.', ',')}`, width - padding - 20, currentY);
      
      if (notes) {
        currentY += 60;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#272A27';
        ctx.font = 'bold 15px "Montserrat", sans-serif';
        ctx.fillText('Observações:', padding, currentY);
        
        currentY += 25;
        ctx.font = '500 14px "Montserrat", sans-serif';
        ctx.fillStyle = '#747871';
        
        const words = notes.split(' ');
        let line = '';
        const maxWidth = width - padding * 2;
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, padding, currentY);
            line = words[i] + ' ';
            currentY += 22;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, padding, currentY);
      }
      
      currentY = height - padding;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#A0A49E';
      ctx.font = '500 12px "Montserrat", sans-serif';
      ctx.fillText('Spa e Bronze Belém - Este documento não possui valor fiscal', width / 2, currentY);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      const link = document.createElement('a');
      link.download = `Orcamento_${clientName.replace(/\s+/g, '_')}.jpeg`;
      link.href = dataUrl;
      link.click();
      
      setErrorMsg('');
      toast({
        title: 'JPEG gerado com sucesso',
        description: 'O orçamento foi baixado e está pronto para compartilhar.',
      });
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar a imagem. Verifique se o navegador suporta exportação.');
      toast({
        variant: 'destructive',
        title: 'Não foi possível gerar o JPEG',
        description: 'Tente novamente em alguns instantes.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSave = () => {
    if (!isExportReady) {
      setErrorMsg('Preencha o nome do cliente e adicione pelo menos um serviço.');
      return;
    }
    
    const quoteData = {
      clientName,
      phone,
      validUntil,
      discount: numDiscount,
      notes,
      items: items.map(it => ({
        serviceId: it.serviceId,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice
      }))
    };

    if (editingQuoteId) {
      updateQuote.mutate({
        id: editingQuoteId,
        data: quoteData
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          resetForm();
          setView('list');
          toast({
            title: 'Orçamento atualizado',
            description: 'As alterações foram salvas com sucesso.',
          });
        },
        onError: () => {
          setErrorMsg('Erro ao atualizar o orçamento no servidor.');
          toast({
            variant: 'destructive',
            title: 'Erro ao atualizar',
            description: 'Confira os dados e tente novamente.',
          });
        }
      });
    } else {
      createQuote.mutate({
        data: quoteData
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          resetForm();
          setView('list');
          toast({
            title: 'Orçamento salvo com sucesso',
            description: 'Ele já está disponível na lista de orçamentos.',
          });
        },
        onError: () => {
          setErrorMsg('Erro ao salvar o orçamento no servidor.');
          toast({
            variant: 'destructive',
            title: 'Erro ao salvar o orçamento',
            description: 'Confira os dados e tente novamente.',
          });
        }
      });
    }
  };

  return (
    <>
      {view === 'create' ? (
        <div className="space-y-6 max-w-[1200px] mx-auto pb-10">
          <div className="flex items-center gap-3 mb-6">
            <button 
              onClick={() => { setView('list'); resetForm(); }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-surface hover:bg-border transition-colors text-text-secondary"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-[24px] md:text-[28px] font-bold text-text-primary tracking-tight">
                {quoteNumber ? `Orçamento #${quoteNumber}` : 'Novo Orçamento'}
              </h1>
              <p className="text-[14px] md:text-[15px] text-text-secondary mt-1">
                {quoteNumber
                  ? 'Revise os dados e exporte novamente o JPEG personalizado.'
                  : 'Preencha os dados para gerar a proposta.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <Card className="p-6 space-y-5 shadow-sm border-border/60">
                <h3 className="font-semibold text-[16px] text-text-primary flex items-center gap-2 border-b border-border/60 pb-3">
                  <FileText className="w-4 h-4 text-text-muted" />
                  Dados do Cliente
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Nome do Cliente *</label>
                    <input 
                      type="text"
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60"
                      placeholder="Ex: Maria Silva"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">WhatsApp / Telefone</label>
                    <input 
                      type="text"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-text-muted/60"
                      placeholder="(91) 90000-0000"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Validade do Orçamento</label>
                    <input 
                      type="date"
                      value={validUntil}
                      onChange={e => setValidUntil(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-text-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Observações (opcional)</label>
                    <textarea 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-y transition-all placeholder:text-text-muted/60"
                      placeholder="Detalhes adicionais ou condições..."
                    />
                  </div>
                </div>
              </Card>
            </div>
            
            <div className="lg:col-span-7 space-y-6">
              <Card className="p-6 flex flex-col h-full shadow-sm border-border/60">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4 mb-5">
                  <h3 className="font-semibold text-[16px] text-text-primary">Itens e Valores</h3>
                  
                  <div className="flex w-full sm:w-auto items-center gap-2">
                    <select 
                      className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 sm:max-w-[240px] transition-all"
                      onChange={(e) => {
                        handleAddService(e.target.value);
                        e.target.value = "";
                      }}
                      defaultValue=""
                      disabled={isLoadingServices}
                    >
                      <option value="" disabled>+ Adicionar serviço...</option>
                      {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name} - {s.price}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsServiceDialogOpen(true)}
                      className="shrink-0 w-[38px] h-[38px] flex items-center justify-center rounded-lg border border-border bg-surface text-text-secondary hover:text-primary-dark hover:border-primary/30 transition-colors"
                      title="Novo serviço"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 space-y-3 mb-6">
                  {items.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-surface-soft/50">
                      <p className="text-[14px] text-text-muted font-medium">Nenhum serviço adicionado.</p>
                      <p className="text-[12px] text-text-muted mt-1">Selecione um serviço acima para começar.</p>
                    </div>
                  ) : (
                    items.map((item) => (
                      <div key={item.id} className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-surface-soft border border-border/50 p-4 rounded-xl group hover:border-border transition-colors">
                        <div className="flex-1 min-w-0 w-full">
                          <p className="text-[14px] font-semibold text-text-primary truncate">{item.name}</p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-text-secondary font-medium">Qtd:</span>
                            <input 
                              type="number" 
                              min="1"
                              value={item.quantity}
                              onChange={e => {
                                const q = parseInt(e.target.value) || 1;
                                setItems(items.map(it => it.id === item.id ? { ...it, quantity: q } : it));
                              }}
                              className="w-16 bg-surface border border-border rounded-lg px-2 py-1.5 text-[13px] text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-text-secondary font-medium">R$</span>
                            <input 
                              type="number" 
                              min="0"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={e => {
                                const p = parseFloat(e.target.value) || 0;
                                setItems(items.map(it => it.id === item.id ? { ...it, unitPrice: p } : it));
                              }}
                              className="w-24 bg-surface border border-border rounded-lg px-2 py-1.5 text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          
                          <button 
                            onClick={() => setItems(items.filter(it => it.id !== item.id))}
                            className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors ml-1"
                          >
                            <Trash2 className="w-[18px] h-[18px]" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="border-t border-border/60 pt-5 mt-auto">
                  <div className="space-y-3 max-w-sm ml-auto">
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-text-secondary font-medium">Subtotal</span>
                      <span className="text-text-primary font-semibold">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-text-secondary font-medium">Desconto (R$)</span>
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        value={discount}
                        onChange={e => setDiscount(e.target.value ? parseFloat(e.target.value) : '')}
                        className="w-28 bg-surface border border-border rounded-lg px-3 py-1.5 text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-text-muted/60"
                        placeholder="0,00"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between text-[18px] pt-3 mt-1 border-t border-border/40">
                      <span className="text-text-primary font-bold">Total</span>
                      <span className="text-primary-dark font-bold">R$ {total.toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                  
                  {errorMsg && (
                    <div className="mt-6 p-3 bg-error/10 text-error text-[13px] font-medium rounded-xl text-center border border-error/20">
                      {errorMsg}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                    <button
                      onClick={exportQuoteAsJPEG}
                      disabled={!isExportReady || isExporting}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold border border-primary/30 text-primary-dark hover:bg-primary-soft transition-colors disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Download className="w-[18px] h-[18px]" />
                      {isExporting ? 'Gerando...' : 'Exportar JPEG'}
                    </button>
                    
                    <button
                      onClick={handleSave}
                      disabled={!isExportReady || createQuote.isPending || updateQuote.isPending}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button disabled:opacity-50 disabled:pointer-events-none"
                    >
                      <Save className="w-[18px] h-[18px]" />
                      {editingQuoteId 
                        ? (updateQuote.isPending ? 'Atualizando...' : 'Atualizar Orçamento') 
                        : (createQuote.isPending ? 'Salvando...' : 'Salvar Orçamento')}
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-[1200px] mx-auto pb-10">
          <PageHeader 
            title="Orçamentos"
            description="Crie e gerencie os orçamentos de clientes."
            action={
              <button 
                onClick={() => { resetForm(); setView('create'); }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button"
              >
                <Plus className="w-[18px] h-[18px]" />
                Novo orçamento
              </button>
            }
          />

          {isLoadingQuotes ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-surface-soft rounded-[18px] animate-pulse" />
                ))}
              </div>
            </div>
          ) : quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center border border-dashed border-border rounded-2xl bg-surface-soft/30">
              <div className="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center mb-5 shadow-sm">
                <Receipt className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="text-[18px] font-bold text-text-primary mb-2">Nenhum orçamento</h3>
              <p className="text-[15px] text-text-secondary max-w-[340px] mb-8 leading-relaxed">
                Você ainda não gerou nenhum orçamento no sistema. Clique no botão para começar.
              </p>
              <button 
                onClick={() => { resetForm(); setView('create'); }}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button"
              >
                <Plus className="w-[18px] h-[18px]" />
                Criar primeiro orçamento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {quotes.map(q => (
                <Card key={q.id} className="p-5 hover:border-primary/30 transition-all duration-300 hover:shadow-card group cursor-default border-border/60">
                  <div className="flex justify-between items-start mb-5">
                    <div className="min-w-0 pr-3">
                      <h4 className="font-bold text-[16px] text-text-primary truncate">{q.clientName}</h4>
                      <p className="text-[13px] font-medium text-text-muted mt-1 bg-surface-soft inline-block px-2 py-0.5 rounded-md">
                        #{q.number}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setQuoteToDelete(q.id); }}
                        className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                        title="Excluir orçamento"
                      >
                        <Trash2 className="w-[16px] h-[16px]" />
                      </button>
                      <div className="text-right">
                        <div className="font-bold text-[16px] text-primary-dark">
                          R$ {q.total.toFixed(2).replace('.', ',')}
                        </div>
                        <div className="text-[12px] font-medium text-text-muted mt-1">
                          {format(new Date(q.createdAt), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] font-medium text-text-secondary pt-4 border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-primary/60" />
                      {q.items.length} {q.items.length === 1 ? 'serviço' : 'serviços'}
                    </div>
                    {q.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-primary/60" />
                        {q.phone}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openQuote(q)}
                    className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold text-text-primary hover:bg-surface-soft transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Abrir e editar / exportar
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Excluir Orçamento Dialog */}
      <Dialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir orçamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <button
              onClick={() => setQuoteToDelete(null)}
              className="px-4 py-2 text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => quoteToDelete && handleDeleteQuote(quoteToDelete)}
              disabled={deleteQuote.isPending}
              className="px-4 py-2 text-[14px] font-semibold bg-error text-white rounded-lg hover:bg-error/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {deleteQuote.isPending ? 'Excluindo...' : 'Sim, excluir'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo Serviço Dialog */}
      <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo serviço rápido</DialogTitle>
            <DialogDescription>
              Crie um serviço para adicioná-lo imediatamente ao orçamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Nome do Serviço *</label>
              <input 
                type="text"
                value={newService.name}
                onChange={e => setNewService({...newService, name: e.target.value})}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Ex: Limpeza de Pele"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Preço *</label>
                <input 
                  type="text"
                  value={newService.price}
                  onChange={e => setNewService({...newService, price: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="150,00"
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Duração</label>
                <input 
                  type="text"
                  value={newService.duration}
                  onChange={e => setNewService({...newService, duration: e.target.value})}
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ex: 60 min"
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Categoria</label>
              <input 
                type="text"
                value={newService.category}
                onChange={e => setNewService({...newService, category: e.target.value})}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Ex: Procedimentos Faciais"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Cor (Etiqueta)</label>
              <select
                value={newService.accent}
                onChange={e => setNewService({...newService, accent: e.target.value})}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="bg-primary-soft text-primary-dark">Verde Musgo (Padrão)</option>
                <option value="bg-blue-50 text-blue-700">Azul</option>
                <option value="bg-rose-50 text-rose-700">Rosa</option>
                <option value="bg-orange-50 text-orange-700">Laranja</option>
                <option value="bg-purple-50 text-purple-700">Roxo</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsServiceDialogOpen(false)}
              className="px-4 py-2 text-[14px] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateService}
              disabled={createService.isPending}
              className="px-4 py-2 text-[14px] font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50"
            >
              {createService.isPending ? 'Salvando...' : 'Salvar serviço'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
