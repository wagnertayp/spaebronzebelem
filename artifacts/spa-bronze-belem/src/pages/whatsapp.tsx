import { 
  useGetAiAgentConfig,
  useUpdateAiAgentConfig,
  getGetAiAgentConfigQueryKey,
  useTestAiAgent,
  useListServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  getListServicesQueryKey,
  useGetWhatsappConnection,
  getGetWhatsappConnectionQueryKey,
  useConnectWhatsapp,
  useDisconnectWhatsapp,
  useGetWhatsappAutomation,
  useUpdateWhatsappAutomation,
  getGetWhatsappAutomationQueryKey,
  useListWhatsappMessages,
  getListWhatsappMessagesQueryKey,
  useListWhatsappConversations,
  getListWhatsappConversationsQueryKey,
  useUpdateWhatsappConversation,
  useDeleteWhatsappConversation,
  useSendWhatsappReply,
  useSendWhatsappDocument,
  AiAgentConfig,
  Service,
  WhatsappAutomation,
  WhatsappConversation,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  BrainCircuit, Sparkles, Settings2, Database, 
  Plus, Edit2, Trash2, SendHorizontal, Trash, 
  CheckCircle2, XCircle, Clock, Loader2, Bot, AlertTriangle,
  Save, MessageCircle, CalendarCheck, BellRing, RefreshCw
} from 'lucide-react';

export function WhatsApp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading: isConfigLoading } = useGetAiAgentConfig();
  const updateConfig = useUpdateAiAgentConfig();
  const testAgent = useTestAiAgent();
  const { data: whatsappConnection, isLoading: isConnectionLoading } = useGetWhatsappConnection({
    query: { queryKey: getGetWhatsappConnectionQueryKey(), refetchInterval: 30_000 },
  });
  const connectWhatsapp = useConnectWhatsapp();
  const disconnectWhatsapp = useDisconnectWhatsapp();
  const { data: whatsappAutomation } = useGetWhatsappAutomation();
  const updateWhatsappAutomation = useUpdateWhatsappAutomation();
  const sendWhatsappReply = useSendWhatsappReply();
  const sendWhatsappDocument = useSendWhatsappDocument();
  const { data: whatsappMessages = [] } = useListWhatsappMessages({ limit: 50 });
  const { data: whatsappConversations = [] } = useListWhatsappConversations({ limit: 50 });
  const updateWhatsappConversation = useUpdateWhatsappConversation();
  const deleteWhatsappConversation = useDeleteWhatsappConversation();
  
  const { data: services = [], isLoading: isServicesLoading } = useListServices();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [activeTab, setActiveTab] = useState<'config' | 'services' | 'test'>('config');
  const [automationForm, setAutomationForm] = useState<WhatsappAutomation>({
    enabled: false,
    aiReplies: false,
    humanSupervision: true,
    confirmations: true,
    reminder24h: true,
    reminder2h: true,
    timezone: 'America/Belem',
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [manualReply, setManualReply] = useState('');

  // Config Form State
  const [formData, setFormData] = useState<AiAgentConfig>({
    active: false,
    name: '',
    tone: 'profissional',
    greeting: '',
    objective: '',
    instructions: '',
    businessHours: '',
    address: '',
    paymentMethods: '',
    bookingRules: '',
    policies: '',
    humanHandoff: ''
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  useEffect(() => {
    if (whatsappAutomation) setAutomationForm(whatsappAutomation);
  }, [whatsappAutomation]);

  const handleSaveConfig = () => {
    updateConfig.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetAiAgentConfigQueryKey(), data);
          toast({ title: 'Configuração salva', description: 'As diretrizes do agente foram atualizadas.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível salvar a configuração.', variant: 'destructive' })
      }
    );
  };

  const handleSaveAutomation = () => {
    updateWhatsappAutomation.mutate(
      { data: automationForm },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetWhatsappAutomationQueryKey(), data);
          setAutomationForm(data);
          toast({ title: 'Automação salva', description: 'As confirmações e lembretes foram atualizados.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível salvar as automações.', variant: 'destructive' }),
      },
    );
  };

  const handleConnectWhatsapp = () => {
    connectWhatsapp.mutate(
      undefined,
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getGetWhatsappConnectionQueryKey() });
          if (data.qrCode) setQrCode(data.qrCode);
          toast({
            title: data.connected ? 'WhatsApp conectado' : data.qrCode ? 'QR Code gerado' : 'Instância criada',
            description: data.message,
            variant: data.connected ? 'default' : 'destructive',
          });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível gerar o QR Code.', variant: 'destructive' }),
      },
    );
  };

  const handleDisconnectWhatsapp = () => {
    if (!whatsappConnection?.connected || disconnectWhatsapp.isPending) return;
    if (!window.confirm('Desconectar o WhatsApp atual para conectar outro número? As conversas e configurações serão mantidas.')) return;
    disconnectWhatsapp.mutate(undefined, {
      onSuccess: (data) => {
        if (!data.disconnected) {
          toast({ title: 'Não foi possível desconectar', description: data.message, variant: 'destructive' });
          return;
        }
        setQrCode(null);
        queryClient.invalidateQueries({ queryKey: getGetWhatsappConnectionQueryKey() });
        toast({ title: 'WhatsApp desconectado', description: data.message });
      },
      onError: () => toast({ title: 'Erro', description: 'Não foi possível desconectar o WhatsApp.', variant: 'destructive' }),
    });
  };

  useEffect(() => {
    if (!selectedPhone && whatsappConversations[0]?.phone) {
      setSelectedPhone(whatsappConversations[0].phone);
    } else if (selectedPhone && !whatsappConversations.some((conversation) => conversation.phone === selectedPhone)) {
      setSelectedPhone(whatsappConversations[0]?.phone ?? '');
    }
  }, [selectedPhone, whatsappConversations]);

  const selectedConversation = whatsappConversations.find((conversation) => conversation.phone === selectedPhone);
  const selectedClientName = selectedConversation?.clientName || selectedPhone;
  const selectedConversationMessages = whatsappMessages
    .filter((message) => message.phone === selectedPhone)
    .slice()
    .reverse();
  const conversationStatusLabel: Record<WhatsappConversation['status'], string> = {
    agent: 'Agente',
    human: 'Atendimento humano',
    closed: 'Encerrada',
  };

  const invalidateWhatsapp = () => {
    void queryClient.invalidateQueries({ queryKey: getListWhatsappMessagesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListWhatsappConversationsQueryKey() });
  };

  const handleConversationStatus = (status: WhatsappConversation['status']) => {
    if (!selectedPhone) return;
    updateWhatsappConversation.mutate(
      { phone: selectedPhone, data: { status } },
      {
        onSuccess: () => {
          invalidateWhatsapp();
          toast({
            title: status === 'human' ? 'Atendimento assumido' : status === 'agent' ? 'Conversa devolvida ao agente' : 'Conversa encerrada',
            description: `O status de ${selectedClientName} foi atualizado.`,
          });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível alterar o status da conversa.', variant: 'destructive' }),
      },
    );
  };

  const handleDeleteConversation = () => {
    if (!selectedPhone || !window.confirm(`Excluir permanentemente a conversa com ${selectedClientName}? Todas as mensagens serão removidas.`)) return;
    const phoneToDelete = selectedPhone;
    deleteWhatsappConversation.mutate(
      { phone: phoneToDelete },
      {
        onSuccess: () => {
          setSelectedPhone('');
          invalidateWhatsapp();
          toast({ title: 'Conversa excluída', description: 'O histórico foi removido permanentemente.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível excluir a conversa.', variant: 'destructive' }),
      },
    );
  };

  const handleManualReply = () => {
    const text = manualReply.trim();
    if (!selectedPhone || !text) return;
    sendWhatsappReply.mutate(
      { data: { phone: selectedPhone, clientName: selectedClientName, text } },
      {
        onSuccess: () => {
          setManualReply('');
          invalidateWhatsapp();
          toast({ title: 'Mensagem enviada', description: 'A resposta foi enviada pelo WhatsApp.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível enviar a resposta.', variant: 'destructive' }),
      },
    );
  };

  const handleSendCatalog = (document: 'menu' | 'advanced') => {
    if (!selectedPhone) return;
    sendWhatsappDocument.mutate(
      {
        data: {
          phone: selectedPhone,
          clientName: selectedClientName,
          document,
          caption: document === 'menu'
            ? 'Segue o nosso cardápio de serviços e bronzeamento.'
            : 'Segue o nosso catálogo de serviços de estética avançada.',
        },
      },
      {
        onSuccess: () => {
          invalidateWhatsapp();
          toast({ title: 'Catálogo enviado', description: 'O PDF foi enviado pelo WhatsApp.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível enviar o catálogo.', variant: 'destructive' }),
      },
    );
  };

  // Services State
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean, mode: 'create' | 'edit', service?: Service }>({ open: false, mode: 'create' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, service?: Service }>({ open: false });

  const handleSaveService = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data = {
      name: fd.get('name') as string,
      category: fd.get('category') as string,
      duration: fd.get('duration') as string,
      price: fd.get('price') as string,
      accent: (fd.get('category') as string) === 'Bronze' ? 'bg-[#D2895C]' : 'bg-[#E7EEE4]', // default based on category for simplicity
    };

    if (serviceDialog.mode === 'create') {
      createService.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          setServiceDialog({ open: false, mode: 'create' });
          toast({ title: 'Serviço adicionado', description: 'O serviço já está disponível para orçamentos e para a IA.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível adicionar o serviço.', variant: 'destructive' })
      });
    } else if (serviceDialog.mode === 'edit' && serviceDialog.service) {
      updateService.mutate({ id: serviceDialog.service.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
          setServiceDialog({ open: false, mode: 'create' });
          toast({ title: 'Serviço atualizado' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível atualizar o serviço.', variant: 'destructive' })
      });
    }
  };

  const confirmDeleteService = () => {
    if (!deleteDialog.service) return;
    deleteService.mutate({ id: deleteDialog.service.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        setDeleteDialog({ open: false });
        toast({ title: 'Serviço removido' });
      },
      onError: () => toast({ title: 'Erro', description: 'Não foi possível remover o serviço.', variant: 'destructive' })
    });
  };

  // Chat Simulator State
  const [chatMessages, setChatMessages] = useState<{ id: string, role: 'user' | 'agent', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, testAgent.isPending]);

  const handleSendChat = (text: string = chatInput) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessageId = Math.random().toString();
    setChatMessages(prev => [...prev, { id: userMessageId, role: 'user', text: trimmed }]);
    setChatInput('');
    
    testAgent.mutate({ data: { message: trimmed } }, {
      onSuccess: (data) => {
        setChatMessages(prev => [...prev, { id: Math.random().toString(), role: 'agent', text: data.reply }]);
      },
      onError: () => {
        toast({ title: 'Erro', description: 'Falha de comunicação com o agente.', variant: 'destructive' });
      }
    });
  };

  const samplePrompts = [
    `Qual o valor de ${services[0]?.name || 'um dos serviços'}?`,
    "Que horas vocês abrem amanhã?",
    "Quero agendar um horário para sábado"
  ];

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader 
        title="Agente IA"
        description="Configuração do assistente virtual inteligente."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", formData.active ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted")}>
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[13px] text-text-muted font-medium uppercase tracking-wider mb-1">Status do Agente</div>
            <div className="font-semibold text-text-primary text-lg">{formData.active ? 'Ativo' : 'Inativo'}</div>
          </div>
        </Card>
        
        <Card className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[13px] text-text-muted font-medium uppercase tracking-wider mb-1">Base de Conhecimento</div>
            <div className="font-semibold text-text-primary text-lg">{services.length} serviços</div>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", whatsappConnection?.connected ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
            <MessageCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] text-text-muted font-medium uppercase tracking-wider mb-1">WhatsApp</div>
            <div className="font-semibold text-text-primary text-lg">
              {isConnectionLoading ? 'Verificando...' : whatsappConnection?.connected ? 'WhatsApp conectado' : 'Não conectado'}
            </div>
            <div className="text-xs text-text-muted truncate mb-3">{whatsappConnection?.message || 'Gere um QR Code para conectar o WhatsApp'}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleConnectWhatsapp} disabled={connectWhatsapp.isPending || disconnectWhatsapp.isPending} className="gap-2">
                {connectWhatsapp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                {whatsappConnection?.connected ? 'Gerar QR Code novamente' : 'Gerar QR Code'}
              </Button>
              {whatsappConnection?.connected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnectWhatsapp}
                  disabled={disconnectWhatsapp.isPending || connectWhatsapp.isPending}
                  className="gap-2"
                >
                  {disconnectWhatsapp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Desconectar e trocar número
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-5">
          <div>
            <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-primary" />
              Confirmações e lembretes de agenda
            </h3>
            <p className="text-sm text-text-muted mt-1">
              O sistema só envia quando o cliente tem telefone cadastrado e a agenda possui data completa.
            </p>
          </div>
          <Button onClick={handleSaveAutomation} disabled={updateWhatsappAutomation.isPending} className="gap-2 shrink-0">
            {updateWhatsappAutomation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar automações
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'enabled' as const, title: 'Automação ativa', description: 'Permite o envio automático pelo WhatsApp.', icon: Bot },
            { key: 'aiReplies' as const, title: 'Respostas do agente', description: 'Permite que o agente responda conversas com a base de conhecimento.', icon: Sparkles },
            { key: 'humanSupervision' as const, title: 'Supervisão humana', description: 'Mantém as conversas visíveis para acompanhamento e resposta manual.', icon: CheckCircle2 },
            { key: 'confirmations' as const, title: 'Confirmar agendamento', description: 'Envia a confirmação após criar ou alterar a agenda.', icon: CalendarCheck },
            { key: 'reminder24h' as const, title: 'Lembrete de 24 horas', description: 'Lembra o cliente no dia anterior.', icon: BellRing },
            { key: 'reminder2h' as const, title: 'Lembrete de 2 horas', description: 'Lembra o cliente próximo do atendimento.', icon: Clock },
          ].map((item) => {
            const Icon = item.icon;
            const enabled = automationForm[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setAutomationForm((current) => ({ ...current, [item.key]: !current[item.key] }))}
                className={cn("text-left p-4 rounded-xl border transition-colors", enabled ? "border-primary/40 bg-primary/5" : "border-border bg-background")}
              >
                <div className="flex items-start justify-between gap-3">
                  <Icon className={cn("w-5 h-5", enabled ? "text-primary" : "text-text-muted")} />
                  <span className={cn("relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors", enabled ? "bg-primary" : "bg-surface-soft")}>
                    <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform", enabled ? "translate-x-5" : "translate-x-1")} />
                  </span>
                </div>
                <div className="font-semibold text-sm text-text-primary mt-3">{item.title}</div>
                <div className="text-xs text-text-muted mt-1 leading-relaxed">{item.description}</div>
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <RefreshCw className="w-4 h-4 text-primary" /> Supervisão do atendimento
              </div>
              <p className="text-xs text-text-muted mt-1">
                Acompanhe as conversas, assuma um atendimento e responda sem sair desta tela.
              </p>
            </div>
            <span className="self-start rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
              {whatsappConversations.length} {whatsappConversations.length === 1 ? 'conversa' : 'conversas'}
            </span>
          </div>
          <div>
            {whatsappConversations.length === 0 ? (
              <p className="text-sm text-text-muted rounded-lg border border-dashed border-border p-3">
                Nenhuma conversa registrada ainda. Quando chegar uma mensagem, ela aparecerá aqui para a equipe acompanhar.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.78fr)_minmax(0,1.5fr)] gap-4">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {whatsappConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedPhone(conversation.phone)}
                      className={cn(
                        "w-full min-w-0 text-left flex items-start justify-between gap-3 rounded-xl border p-3 text-xs transition-colors",
                        selectedPhone === conversation.phone ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-text-primary truncate">
                          {conversation.clientName || conversation.phone}
                          <span className="font-normal text-text-muted ml-2">{conversation.messageCount} mensagens</span>
                        </div>
                        <div className="text-text-muted truncate">{conversation.lastMessage || 'Sem mensagens'}</div>
                      </div>
                      <span className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 font-semibold",
                        conversation.status === 'human' ? "bg-warning/10 text-warning" :
                          conversation.status === 'closed' ? "bg-text-muted/10 text-text-muted" : "bg-success/10 text-success",
                      )}>
                        {conversationStatusLabel[conversation.status]}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-background p-3 sm:p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-medium text-text-primary">
                      {selectedPhone ? `Conversa com ${selectedClientName}` : 'Selecione uma conversa'}
                      {selectedPhone && <div className="text-[11px] text-text-muted font-normal mt-0.5 break-all">{selectedPhone}</div>}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={handleDeleteConversation}
                      disabled={!selectedPhone || deleteWhatsappConversation.isPending}
                      className="h-7 w-7 text-error hover:text-error"
                      title="Excluir conversa"
                    >
                      {deleteWhatsappConversation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {selectedConversation && (
                    <>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          value={selectedConversation.status}
                          onChange={(event) => handleConversationStatus(event.target.value as WhatsappConversation['status'])}
                          disabled={updateWhatsappConversation.isPending}
                          className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-xs"
                          aria-label="Status da conversa"
                        >
                          <option value="agent">Agente</option>
                          <option value="human">Atendimento humano</option>
                          <option value="closed">Encerrada</option>
                        </select>
                        {selectedConversation.status !== 'human' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleConversationStatus('human')} disabled={updateWhatsappConversation.isPending}>
                            Assumir atendimento
                          </Button>
                        )}
                        {selectedConversation.status === 'human' && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleConversationStatus('agent')} disabled={updateWhatsappConversation.isPending}>
                            Devolver ao agente
                          </Button>
                        )}
                      </div>
                      <div className="min-h-40 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-soft p-2.5 space-y-2">
                        {selectedConversationMessages.length === 0 ? (
                          <p className="text-[11px] text-text-muted">Carregando histórico...</p>
                        ) : selectedConversationMessages.map((message) => (
                          <div key={message.id} className={cn("flex", message.direction === 'outbound' ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[92%] break-words rounded-lg px-2.5 py-1.5 text-[11px]",
                              message.direction === 'outbound' ? "bg-primary/10 text-text-primary" : "bg-background border border-border text-text-secondary",
                            )}>
                              <div>{message.text}</div>
                              <div className="mt-1 text-[10px] text-text-muted">
                                {message.direction === 'outbound' ? 'Equipe' : 'Cliente'} · {message.status}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <textarea
                    value={manualReply}
                    onChange={(event) => setManualReply(event.target.value)}
                    placeholder={selectedPhone ? 'Escreva uma resposta para o cliente...' : 'Selecione uma conversa à esquerda.'}
                    disabled={!selectedPhone || sendWhatsappReply.isPending}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      size="sm"
                      onClick={handleManualReply}
                      disabled={!selectedPhone || !manualReply.trim() || sendWhatsappReply.isPending}
                      className="w-full gap-1.5 sm:w-auto"
                    >
                      {sendWhatsappReply.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizontal className="w-3.5 h-3.5" />}
                      Responder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendCatalog('menu')}
                      disabled={!selectedPhone || sendWhatsappDocument.isPending}
                      className="w-full sm:w-auto"
                    >
                      Enviar cardápio
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendCatalog('advanced')}
                      disabled={!selectedPhone || sendWhatsappDocument.isPending}
                      className="w-full sm:w-auto"
                    >
                      Enviar catálogo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={Boolean(qrCode)} onOpenChange={(open) => !open && setQrCode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular, entre em <strong>Aparelhos conectados</strong> e escaneie este QR Code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCode && <img src={qrCode} alt="QR Code para conectar o WhatsApp" className="w-64 h-64 rounded-xl border border-border p-2" />}
            <p className="text-xs text-center text-text-muted">
              Depois de escanear, esta janela pode levar alguns segundos para atualizar o status da conexão.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-1 overflow-x-auto border-b border-border">
        <button 
          onClick={() => setActiveTab('config')} 
          className={cn("shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'config' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
        >
          <Settings2 className="w-4 h-4" />
          Configuração
        </button>
        <button 
          onClick={() => setActiveTab('services')} 
          className={cn("shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'services' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
        >
          <Database className="w-4 h-4" />
          Serviços e Preços
        </button>
        <button 
          onClick={() => setActiveTab('test')} 
          className={cn("shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'test' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
        >
          <Sparkles className="w-4 h-4" />
          Testar Agente
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'config' && (
          <div className="max-w-4xl space-y-8 pb-8">
            {isConfigLoading ? (
              <div className="flex items-center justify-center h-64 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <>
                <Card className="p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">Status Principal</h3>
                      <p className="text-sm text-text-muted">Ative ou desative o atendimento automatizado do agente.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, active: !prev.active }))}
                      className={cn(
                        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        formData.active ? "bg-primary" : "bg-surface-soft"
                      )}
                    >
                      <span className={cn("pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform", formData.active ? "translate-x-5" : "translate-x-0")} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Nome do Agente</label>
                      <input 
                        value={formData.name}
                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" 
                        placeholder="Ex: Iza (Inteligência Spa e Bronze)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Tom de Voz</label>
                      <select 
                        value={formData.tone}
                        onChange={e => setFormData(p => ({ ...p, tone: e.target.value as AiAgentConfig['tone'] }))}
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all"
                      >
                        <option value="acolhedor">Acolhedor e Amigável</option>
                        <option value="profissional">Profissional e Direto</option>
                        <option value="objetivo">Objetivo (Focado em Vendas)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Mensagem de Saudação</label>
                    <textarea 
                      value={formData.greeting}
                      onChange={e => setFormData(p => ({ ...p, greeting: e.target.value }))}
                      rows={2}
                      className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      placeholder="Ex: Olá! Sou a assistente do Spa e Bronze Belém. Como posso ajudar?"
                    />
                  </div>
                </Card>

                <Card className="p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Comportamento e Instruções</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Objetivo Principal do Agente</label>
                    <input 
                      value={formData.objective}
                      onChange={e => setFormData(p => ({ ...p, objective: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" 
                      placeholder="Ex: Qualificar o lead, tirar dúvidas e realizar o agendamento."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Instruções Customizadas (Prompt Base)</label>
                    <textarea 
                      value={formData.instructions}
                      onChange={e => setFormData(p => ({ ...p, instructions: e.target.value }))}
                      rows={4}
                      className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      placeholder="Descreva como o agente deve se comportar, o que evitar, como lidar com objeções, etc."
                    />
                  </div>
                </Card>

                <Card className="p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Informações do Estabelecimento</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Horário de Funcionamento</label>
                      <textarea 
                        value={formData.businessHours}
                        onChange={e => setFormData(p => ({ ...p, businessHours: e.target.value }))}
                        rows={3}
                        className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-primary">Endereço</label>
                      <textarea 
                        value={formData.address}
                        onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                        rows={3}
                        className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Formas de Pagamento Aceitas</label>
                    <input 
                      value={formData.paymentMethods}
                      onChange={e => setFormData(p => ({ ...p, paymentMethods: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" 
                    />
                  </div>
                </Card>

                <Card className="p-6 space-y-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Regras e Políticas</h3>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Regras de Agendamento</label>
                    <textarea 
                      value={formData.bookingRules}
                      onChange={e => setFormData(p => ({ ...p, bookingRules: e.target.value }))}
                      rows={3}
                      className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      placeholder="Ex: Pedimos 50% de sinal para confirmar. Tolerância de atraso de 15 minutos."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Outras Políticas Importantes</label>
                    <textarea 
                      value={formData.policies}
                      onChange={e => setFormData(p => ({ ...p, policies: e.target.value }))}
                      rows={2}
                      className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-primary">Regras para Transbordo Humano</label>
                    <textarea 
                      value={formData.humanHandoff}
                      onChange={e => setFormData(p => ({ ...p, humanHandoff: e.target.value }))}
                      rows={2}
                      className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none"
                      placeholder="Ex: Se o cliente pedir desconto ou ficar irritado, transferir para humano."
                    />
                  </div>
                </Card>

                <div className="flex justify-end gap-3 pt-4">
                  <Button 
                    onClick={handleSaveConfig} 
                    disabled={updateConfig.isPending}
                    className="gap-2"
                  >
                    {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Configurações
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'services' && (
          <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                A IA usará esta lista para responder dúvidas sobre preços e serviços.
              </p>
              <Button onClick={() => setServiceDialog({ open: true, mode: 'create' })} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Serviço
              </Button>
            </div>

            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-soft text-text-muted font-medium">
                    <tr>
                      <th className="px-6 py-4">Nome do Serviço</th>
                      <th className="px-6 py-4">Categoria</th>
                      <th className="px-6 py-4">Duração</th>
                      <th className="px-6 py-4">Preço</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {isServicesLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : services.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                          Nenhum serviço cadastrado. Adicione o primeiro para treinar o agente.
                        </td>
                      </tr>
                    ) : (
                      services.map(service => (
                        <tr key={service.id} className="hover:bg-surface-soft/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-text-primary">{service.name}</td>
                          <td className="px-6 py-4 text-text-secondary">{service.category}</td>
                          <td className="px-6 py-4 text-text-secondary">{service.duration}</td>
                          <td className="px-6 py-4 text-text-secondary">{service.price}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => setServiceDialog({ open: true, mode: 'edit', service })}
                            >
                              <Edit2 className="w-4 h-4 text-text-muted" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setDeleteDialog({ open: true, service })}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'test' && (
          <div className="flex h-[calc(100vh-250px)] min-h-[500px] flex-col gap-4 lg:flex-row lg:gap-6">
            {/* Chat Simulator */}
            <Card className="min-h-0 flex-1 flex flex-col overflow-hidden border-border shadow-sm">
              <div className="bg-surface-soft border-b border-border p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary text-sm">{formData.name || 'Agente IA'}</h3>
                  <p className="text-[11px] text-success font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success inline-block"></span> Online
                  </p>
                </div>
                <div className="ml-auto">
                  <Button variant="ghost" size="sm" onClick={() => setChatMessages([])} className="text-text-muted h-8">
                    <Trash className="w-4 h-4 mr-2" /> Limpar conversa
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background" ref={chatScrollRef}>
                {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-text-muted p-6">
                    <Sparkles className="w-10 h-10 mb-4 opacity-50" />
                    <p className="text-sm font-medium">Simulador do Agente</p>
                    <p className="text-[13px] mt-1 max-w-xs">As mensagens enviadas aqui usarão a configuração atual para gerar respostas reais da IA.</p>
                  </div>
                )}
                
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div 
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                        msg.role === 'user' 
                          ? "bg-primary text-primary-foreground rounded-br-sm" 
                          : "bg-surface-soft text-text-primary border border-border rounded-bl-sm"
                      )}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                
                {testAgent.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-surface-soft text-text-muted border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-text-muted/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-border bg-surface">
                <div className="relative">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChat();
                      }
                    }}
                    placeholder="Digite uma mensagem... (Enter para enviar)"
                    className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-[14px] resize-none overflow-hidden min-h-[50px] max-h-[120px]"
                    rows={1}
                  />
                  <Button 
                    size="sm" 
                    className="absolute right-2 bottom-2.5 h-8 w-8 p-0 rounded-lg"
                    disabled={!chatInput.trim() || testAgent.isPending}
                    onClick={() => handleSendChat()}
                  >
                    <SendHorizontal className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Quick Prompts */}
            <div className="w-full shrink-0 space-y-4 lg:w-[300px]">
              <h4 className="font-semibold text-text-primary text-sm uppercase tracking-wider">Testes Rápidos</h4>
              <div className="space-y-2">
                {samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendChat(prompt)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-surface-soft hover:border-primary/40 hover:bg-surface transition-all text-[13px] text-text-secondary leading-snug group"
                  >
                    {prompt}
                    <SendHorizontal className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 float-right mt-0.5 transition-opacity" />
                  </button>
                ))}
              </div>
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 mt-6">
                <div className="flex gap-2 items-start text-primary-dark">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[12px] font-medium leading-relaxed">O simulador usa a configuração atualizada e salva na aba "Configuração". Lembre-se de salvar suas alterações antes de testar.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Service Modal */}
      <Dialog open={serviceDialog.open} onOpenChange={(o) => !o && setServiceDialog({ open: false, mode: 'create' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{serviceDialog.mode === 'create' ? 'Novo Serviço' : 'Editar Serviço'}</DialogTitle>
            <DialogDescription>Cadastre as informações que a IA usará para apresentar aos clientes.</DialogDescription>
          </DialogHeader>
          <form id="service-form" onSubmit={handleSaveService} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Nome do Serviço *</label>
              <input 
                required 
                name="name" 
                defaultValue={serviceDialog.service?.name}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-primary">Categoria *</label>
              <select 
                required 
                name="category" 
                defaultValue={serviceDialog.service?.category || 'Bronze'}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
              >
                <option value="Bronze">Bronze</option>
                <option value="Spa">Spa</option>
                <option value="Estética">Estética</option>
                <option value="Beleza">Beleza</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Duração</label>
                <input 
                  name="duration" 
                  defaultValue={serviceDialog.service?.duration}
                  placeholder="Ex: 2h"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-primary">Preço *</label>
                <input 
                  required 
                  name="price" 
                  defaultValue={serviceDialog.service?.price}
                  placeholder="Ex: R$ 150,00"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm" 
                />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setServiceDialog({ open: false, mode: 'create' })}>Cancelar</Button>
              <Button type="submit" disabled={createService.isPending || updateService.isPending}>
                {createService.isPending || updateService.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialog.open} onOpenChange={(o) => !o && setDeleteDialog({ open: false })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover Serviço</DialogTitle>
            <DialogDescription>Tem certeza? Isso impedirá a IA de oferecer este serviço e ele não aparecerá em novos orçamentos.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteDialog({ open: false })}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={confirmDeleteService} disabled={deleteService.isPending}>
              {deleteService.isPending ? 'Removendo...' : 'Sim, remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
