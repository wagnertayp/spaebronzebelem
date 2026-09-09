import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { 
  useListQuotes,
  useCreateQuote,
  useUpdateQuote,
  useListClients,
  useListServices,
  useListPackages,
  useListInventory,
  useListProfessionals,
  useCreateClient,
  QuoteInput,
  QuoteItem,
  DiscountMode,
  QuoteInputPaymentMethodsItem
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { getListQuotesQueryKey } from '@workspace/api-client-react';
import { ArrowLeft, Search, Plus, Trash2, Tag, Calendar, Clock, DollarSign, Save, FileText, UserPlus, Gift } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface QuoteFormProps {
  quoteId?: number;
}

export function QuoteForm({ quoteId }: QuoteFormProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [] } = useListQuotes({ search: quoteId?.toString() });
  const { data: clients = [] } = useListClients();
  const { data: services = [] } = useListServices();
  const { data: packages = [] } = useListPackages();
  const { data: inventory = [] } = useListInventory();
  const { data: professionals = [] } = useListProfessionals();

  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const createClient = useCreateClient();

  const existingQuote = useMemo(() => quotes.find(q => q.id === quoteId), [quotes, quoteId]);

  // Form State
  const [clientId, setClientId] = useState<number | ''>('');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [discountMode, setDiscountMode] = useState<DiscountMode>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  
  const [paymentMethods, setPaymentMethods] = useState<QuoteInputPaymentMethodsItem[]>([]);
  const [installments, setInstallments] = useState(1);
  
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // UI State
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [itemTypeToAdd, setItemTypeToAdd] = useState<'service' | 'package' | 'product' | 'gift_card'>('service');
  
  const [newClientDialog, setNewClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');

  // Configurator Modal State
  const [selectedRefId, setSelectedRefId] = useState<number | ''>('');
  const [cfgQuantity, setCfgQuantity] = useState(1);
  const [cfgPrice, setCfgPrice] = useState(0);
  const [cfgDiscount, setCfgDiscount] = useState(0);
  const [cfgProfId, setCfgProfId] = useState<number | ''>('');
  const [cfgDate, setCfgDate] = useState('');
  const [cfgTime, setCfgTime] = useState('');
  const [cfgSessions, setCfgSessions] = useState(1);
  const [cfgGiftValue, setCfgGiftValue] = useState(100);

  // Initialize from existing
  useEffect(() => {
    if (existingQuote) {
      setClientId(existingQuote.clientId);
      setClientName(existingQuote.clientName);
      setPhone(existingQuote.phone);
      setValidUntil(existingQuote.validUntil);
      setDiscountMode(existingQuote.discountMode);
      setDiscountValue(existingQuote.discountValue);
      setPaymentMethods(existingQuote.paymentMethods);
      setInstallments(existingQuote.installments);
      setCustomerNotes(existingQuote.customerNotes);
      setInternalNotes(existingQuote.internalNotes);
      setItems(existingQuote.items);
    }
  }, [existingQuote]);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients.slice(0, 5);
    const lower = clientSearch.toLowerCase();
    return clients.filter(c => c.name.toLowerCase().includes(lower) || c.phone.includes(lower)).slice(0, 5);
  }, [clients, clientSearch]);

  const selectClient = (c: any) => {
    setClientId(c.id);
    setClientName(c.name);
    setPhone(c.phone);
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const handleCreateClient = () => {
    if (!newClientName) return;
    createClient.mutate({
      data: {
        name: newClientName,
        phone: newClientPhone,
        email: '',
        notes: '',
        service: '',
        status: 'new',
        source: 'Quote Form'
      }
    }, {
      onSuccess: (c) => {
        selectClient(c);
        setNewClientDialog(false);
        setNewClientName('');
        setNewClientPhone('');
        toast({ title: 'Cliente cadastrado com sucesso.' });
      },
      onError: () => {
        toast({ variant: 'destructive', title: 'Erro ao cadastrar cliente. Verifique duplicidade.' });
      }
    });
  };

  const setValidityDays = (days: number) => {
    setValidUntil(format(addDays(new Date(), days), 'yyyy-MM-dd'));
  };

  const openAddItem = (type: 'service' | 'package' | 'product' | 'gift_card') => {
    setItemTypeToAdd(type);
    setSelectedRefId('');
    setCfgQuantity(1);
    setCfgPrice(0);
    setCfgDiscount(0);
    setCfgProfId('');
    setCfgDate('');
    setCfgTime('');
    setCfgSessions(1);
    setCfgGiftValue(100);
    setShowAddItemDialog(true);
  };

  const handleRefSelect = (idStr: string) => {
    const id = parseInt(idStr);
    setSelectedRefId(id);
    if (itemTypeToAdd === 'service') {
      const s = services.find(x => x.id === id);
      if (s) setCfgPrice(parseFloat(s.price.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0);
    } else if (itemTypeToAdd === 'package') {
      const p = packages.find(x => x.id === id);
      if (p) {
        setCfgPrice(p.price);
        setCfgSessions(p.sessions);
      }
    } else if (itemTypeToAdd === 'product') {
      const p = inventory.find(x => x.id === id);
      if (p) setCfgPrice(p.price);
    }
  };

  const confirmAddItem = () => {
    let newItem: QuoteItem;

    if (itemTypeToAdd === 'gift_card') {
      newItem = {
        type: 'gift_card',
        name: 'Gift Card Personalizado',
        quantity: cfgQuantity,
        unitPrice: cfgGiftValue,
        discount: cfgDiscount
      };
    } else {
      if (!selectedRefId) return;
      if (itemTypeToAdd === 'service') {
        const s = services.find(x => x.id === selectedRefId);
        const p = professionals.find(x => x.id === cfgProfId);
        newItem = {
          type: 'service',
          refId: s!.id,
          name: s!.name,
          quantity: cfgQuantity,
          unitPrice: cfgPrice,
          discount: cfgDiscount,
          professionalId: p?.id,
          professionalName: p?.name,
          commissionPercent: p?.commissionRate,
          estimatedCommission: p?.commissionRate ? ((cfgPrice - cfgDiscount) * (p.commissionRate / 100)) : 0,
          scheduledDate: cfgDate || undefined,
          scheduledTime: cfgTime || undefined
        };
      } else if (itemTypeToAdd === 'package') {
        const p = packages.find(x => x.id === selectedRefId);
        newItem = {
          type: 'package',
          refId: p!.id,
          name: p!.name,
          quantity: cfgQuantity,
          unitPrice: cfgPrice,
          discount: cfgDiscount,
          sessions: cfgSessions
        };
      } else {
        const p = inventory.find(x => x.id === selectedRefId);
        newItem = {
          type: 'product',
          refId: p!.id,
          name: p!.name,
          quantity: cfgQuantity,
          unitPrice: cfgPrice,
          discount: cfgDiscount
        };
      }
    }

    setItems([...items, newItem]);
    setShowAddItemDialog(false);
  };

  const togglePaymentMethod = (m: QuoteInputPaymentMethodsItem) => {
    if (paymentMethods.includes(m)) {
      setPaymentMethods(paymentMethods.filter(x => x !== m));
    } else {
      setPaymentMethods([...paymentMethods, m]);
    }
  };

  const subtotal = items.reduce((acc, it) => acc + ((it.unitPrice - (it.discount || 0)) * it.quantity), 0);
  const totalDiscount = discountMode === 'fixed' ? discountValue : subtotal * (discountValue / 100);
  const total = Math.max(0, subtotal - totalDiscount);

  const handleSave = (isDraft: boolean) => {
    if (!clientId && !isDraft) {
      toast({ variant: 'destructive', title: 'Selecione um cliente' });
      return;
    }
    if (items.length === 0 && !isDraft) {
      toast({ variant: 'destructive', title: 'Adicione pelo menos um item' });
      return;
    }

    const payload: QuoteInput = {
      clientId: clientId as number || 0,
      clientName: clientName || 'Rascunho sem cliente',
      phone,
      validUntil,
      discountMode,
      discountValue,
      customerNotes,
      internalNotes,
      paymentMethods,
      installments: paymentMethods.includes('credit') ? installments : 1,
      items
    };

    if (quoteId) {
      updateQuote.mutate({ id: quoteId, data: payload }, {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          toast({ title: 'Orçamento atualizado' });
          setLocation(`/orcamentos/${res.id}`);
        }
      });
    } else {
      createQuote.mutate({ data: payload }, {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListQuotesQueryKey() });
          toast({ title: 'Orçamento criado' });
          setLocation(`/orcamentos/${res.id}`);
        }
      });
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-10">
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <button 
            onClick={() => setLocation('/servicos')}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-surface hover:bg-border transition-colors text-text-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[24px] md:text-[28px] font-bold text-text-primary tracking-tight">
              {quoteId ? 'Editar Orçamento' : 'Novo Orçamento'}
            </h1>
            <p className="text-[14px] md:text-[15px] text-text-secondary mt-1">
              Monte uma proposta personalizada para seu cliente.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-3">
          <button
            onClick={() => handleSave(true)}
            disabled={createQuote.isPending || updateQuote.isPending}
            className="min-h-11 px-4 py-2 rounded-xl font-medium border border-border text-text-secondary hover:bg-surface-soft transition-colors"
          >
            Rascunho
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={createQuote.isPending || updateQuote.isPending}
            className="flex min-h-11 items-center justify-center gap-2 px-5 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button"
          >
            <Save className="w-[18px] h-[18px]" />
            Salvar orçamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 space-y-5 border-border/60 shadow-sm">
            <h3 className="font-semibold text-[15px] text-text-primary flex items-center gap-2 border-b border-border/60 pb-3">
              CLIENTE
            </h3>
            
            {clientId ? (
              <div className="bg-surface-soft border border-border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-[15px] text-text-primary">{clientName}</h4>
                    <p className="text-[13px] text-text-secondary mt-1">WhatsApp: {phone || 'Não informado'}</p>
                  </div>
                  <button 
                    onClick={() => { setClientId(''); setClientName(''); setPhone(''); }}
                    className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={clientSearch}
                    onChange={e => {
                      setClientSearch(e.target.value);
                      setShowClientDropdown(true);
                    }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                {showClientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-border rounded-xl shadow-modal overflow-hidden z-10">
                    {filteredClients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-4 py-3 hover:bg-surface-soft border-b border-border/40 last:border-0 transition-colors"
                      >
                        <p className="font-semibold text-[14px] text-text-primary">{c.name}</p>
                        <p className="text-[12px] text-text-secondary">{c.phone}</p>
                      </button>
                    ))}
                    <button
                      onClick={() => { setShowClientDropdown(false); setNewClientDialog(true); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary/5 hover:bg-primary/10 text-primary-dark font-medium text-[13px] transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Cadastrar novo cliente
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-5 border-border/60 shadow-sm">
            <h3 className="font-semibold text-[15px] text-text-primary flex items-center gap-2 border-b border-border/60 pb-3">
              VALIDADE
            </h3>
            <input 
              type="date"
              value={validUntil}
              onChange={e => setValidUntil(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <div className="flex flex-wrap gap-2">
              {[3, 5, 7, 15, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setValidityDays(d)}
                  className="px-3 py-1.5 rounded-lg border border-border text-[12px] font-medium text-text-secondary hover:border-primary/50 hover:text-primary-dark transition-colors bg-surface-soft"
                >
                  {d} dias
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5 space-y-5 border-border/60 shadow-sm">
            <h3 className="font-semibold text-[15px] text-text-primary flex items-center gap-2 border-b border-border/60 pb-3">
              OBSERVAÇÕES
            </h3>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Para o cliente (visível)</label>
              <textarea
                value={customerNotes}
                onChange={e => setCustomerNotes(e.target.value)}
                placeholder="Condições especiais..."
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Internas (oculto)</label>
              <textarea
                value={internalNotes}
                onChange={e => setInternalNotes(e.target.value)}
                placeholder="Anotações para a equipe..."
                className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px] resize-none"
              />
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 border-border/60 shadow-sm min-h-[400px] flex flex-col">
            <div className="border-b border-border/60 pb-5 mb-5">
              <h3 className="font-bold text-[16px] text-text-primary tracking-tight mb-3">SERVIÇOS E ITENS</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { type: 'service' as const, label: 'Serviço' },
                  { type: 'package' as const, label: 'Pacote' },
                  { type: 'product' as const, label: 'Produto' },
                  { type: 'gift_card' as const, label: 'Gift Card' },
                ].map(option => (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => openAddItem(option.type)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary-soft/55 px-3 py-2.5 text-[12px] font-bold text-primary-dark transition-all hover:border-primary hover:bg-primary hover:text-white hover:shadow-button focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Plus className="h-4 w-4" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl bg-surface-soft/30">
                  <p className="text-[14px] text-text-muted font-medium">Nenhum item adicionado.</p>
                  <p className="text-[12px] text-text-muted mt-1">Adicione um serviço, pacote ou produto para começar.</p>
                </div>
              ) : (
                items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-surface-soft border border-border/50 rounded-xl group hover:border-border transition-colors">
                    <div>
                      <p className="text-[14px] font-bold text-text-primary">
                        {item.name}
                        {item.type === 'service' && item.scheduledDate && ` • ${format(new Date(item.scheduledDate), 'dd/MM')} às ${item.scheduledTime}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[12px] text-text-secondary font-medium">
                        {item.type === 'service' && item.professionalName && <span>Prof: {item.professionalName}</span>}
                        {item.type === 'package' && <span>{item.sessions} sessões</span>}
                        {item.type === 'service' && item.estimatedCommission ? (
                          <span className="text-primary-dark/60 ml-2">Comissão est: R$ {item.estimatedCommission.toFixed(2).replace('.', ',')}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[12px] text-text-secondary font-medium">{item.quantity} × R$ {item.unitPrice.toFixed(2).replace('.', ',')}</p>
                        <p className="text-[15px] font-bold text-text-primary">
                          R$ {((item.unitPrice - (item.discount || 0)) * item.quantity).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => {
                          const duplicate = { ...item };
                          setItems([...items.slice(0, idx + 1), duplicate, ...items.slice(idx + 1)]);
                        }} className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Duplicar">
                          <Plus className="w-[14px] h-[14px]" />
                        </button>
                        <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-1.5 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors" title="Excluir">
                          <Trash2 className="w-[14px] h-[14px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 border-t border-border/60 pt-5">
              <div className="flex flex-col md:flex-row gap-8 justify-between">
                <div className="flex-1 max-w-sm space-y-4">
                  <h4 className="font-semibold text-[13px] text-text-secondary uppercase tracking-wider">Forma de Pagamento</h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'pix', label: 'PIX' },
                      { id: 'credit', label: 'Crédito' },
                      { id: 'debit', label: 'Débito' },
                      { id: 'cash', label: 'Dinheiro' },
                      { id: 'boleto', label: 'Boleto' },
                    ].map(m => (
                      <button
                        key={m.id}
                        onClick={() => togglePaymentMethod(m.id as any)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[13px] font-semibold transition-all border",
                          paymentMethods.includes(m.id as any)
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-surface text-text-secondary border-border hover:border-primary/40"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {paymentMethods.includes('credit') && (
                    <div className="mt-3">
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">Parcelamento (Crédito)</label>
                      <select 
                        value={installments} 
                        onChange={e => setInstallments(parseInt(e.target.value))}
                        className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value={1}>À vista</option>
                        {[2,3,4,5,6,10,12].map(n => (
                          <option key={n} value={n}>{n}x</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="w-full md:w-[320px] bg-surface-soft border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="font-semibold text-[13px] text-text-secondary uppercase tracking-wider mb-2">Resumo</h4>
                  <div className="flex justify-between items-center text-[14px]">
                    <span className="text-text-secondary font-medium">Subtotal</span>
                    <span className="text-text-primary font-semibold">R$ {subtotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  <div className="flex justify-between items-center text-[14px]">
                    <span className="text-text-secondary font-medium">Desconto</span>
                    <div className="flex gap-2 items-center">
                      <select 
                        value={discountMode} 
                        onChange={e => setDiscountMode(e.target.value as any)}
                        className="bg-transparent border border-border rounded-lg text-[12px] px-1 py-1 focus:outline-none"
                      >
                        <option value="fixed">R$</option>
                        <option value="percent">%</option>
                      </select>
                      <input 
                        type="number" 
                        min="0"
                        value={discountValue}
                        onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                        className="w-20 bg-surface border border-border rounded-lg px-2 py-1 text-[13px] text-right focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 mt-1 border-t border-border/40">
                    <span className="text-[18px] font-bold text-text-primary">TOTAL</span>
                    <span className="text-[20px] font-black text-primary-dark">R$ {total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={newClientDialog} onOpenChange={setNewClientDialog}>
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden bg-surface border-border">
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-[20px] font-bold text-text-primary tracking-tight">Cadastrar Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Nome Completo</label>
                <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">WhatsApp / Telefone</label>
                <input type="text" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
              </div>
            </div>
            <DialogFooter className="mt-8 border-t border-border/40 pt-4 gap-3">
              <button onClick={() => setNewClientDialog(false)} className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:bg-surface-soft transition-colors">Cancelar</button>
              <button onClick={handleCreateClient} disabled={createClient.isPending} className="px-5 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button">
                Cadastrar
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="max-w-lg rounded-2xl p-0 overflow-hidden bg-surface border-border">
          <div className="p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-[20px] font-bold text-text-primary tracking-tight capitalize">Adicionar {itemTypeToAdd.replace('_', ' ')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {itemTypeToAdd !== 'gift_card' && (
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Buscar item</label>
                  <select 
                    value={selectedRefId} 
                    onChange={e => handleRefSelect(e.target.value)}
                    className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]"
                  >
                    <option value="" disabled>Selecione...</option>
                    {itemTypeToAdd === 'service' && services.map(s => <option key={s.id} value={s.id}>{s.name} - {s.price}</option>)}
                    {itemTypeToAdd === 'package' && packages.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.price}</option>)}
                    {itemTypeToAdd === 'product' && inventory.map(p => <option key={p.id} value={p.id}>{p.name} - R$ {p.price}</option>)}
                  </select>
                </div>
              )}

              {itemTypeToAdd === 'service' && selectedRefId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Profissional</label>
                    <select value={cfgProfId} onChange={e => setCfgProfId(parseInt(e.target.value))} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]">
                      <option value="">Selecione...</option>
                      {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Data</label>
                    <input type="date" value={cfgDate} onChange={e => setCfgDate(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Horário</label>
                    <input type="time" value={cfgTime} onChange={e => setCfgTime(e.target.value)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                  </div>
                </div>
              )}

              {itemTypeToAdd === 'gift_card' && (
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Valor do Gift Card (R$)</label>
                  <input type="number" value={cfgGiftValue} onChange={e => setCfgGiftValue(parseFloat(e.target.value) || 0)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px]" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 border-t border-border/40 pt-4">
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Qtd</label>
                  <input type="number" min="1" value={cfgQuantity} onChange={e => setCfgQuantity(parseInt(e.target.value) || 1)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px] text-center" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">V. Unit (R$)</label>
                  <input type="number" min="0" value={itemTypeToAdd === 'gift_card' ? cfgGiftValue : cfgPrice} onChange={e => setCfgPrice(parseFloat(e.target.value) || 0)} disabled={itemTypeToAdd === 'gift_card'} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px] text-center" />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-text-secondary mb-1.5">Desconto (R$)</label>
                  <input type="number" min="0" value={cfgDiscount} onChange={e => setCfgDiscount(parseFloat(e.target.value) || 0)} className="w-full bg-surface-soft border border-border rounded-xl px-4 py-2.5 text-[14px] text-center" />
                </div>
              </div>

            </div>
            <DialogFooter className="mt-8 border-t border-border/40 pt-4 gap-3">
              <button onClick={() => setShowAddItemDialog(false)} className="px-4 py-2 rounded-xl font-medium text-text-secondary hover:bg-surface-soft transition-colors">Cancelar</button>
              <button onClick={confirmAddItem} disabled={!selectedRefId && itemTypeToAdd !== 'gift_card'} className="px-5 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary-dark transition-colors shadow-button">
                Confirmar
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}