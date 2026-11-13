import { 
  useGetAiAgentConfig,
  useUpdateAiAgentConfig,
  getGetAiAgentConfigQueryKey,
  useTestAiAgent,
  useListServices,
  useCreateService,
  useUpdateService,
  getListServicesQueryKey,
  useGetWhatsappConnection,
  getGetWhatsappConnectionQueryKey,
  useConnectWhatsapp,
  useDisconnectWhatsapp,
  useGetWhatsappAutomation,
  useUpdateWhatsappAutomation,
  getGetWhatsappAutomationQueryKey,
  uploadWhatsappFlowImage,
  useListWhatsappMessages,
  getListWhatsappMessagesQueryKey,
  useListWhatsappConversations,
  getListWhatsappConversationsQueryKey,
  useListWhatsappUnanswered,
  getListWhatsappUnansweredQueryKey,
  getListArchivedRecordsQueryKey,
  useUpdateWhatsappConversation,
  useManageArchivedRecords,
  useSendWhatsappReply,
  useSendWhatsappDocument,
  AiAgentConfig,
  Service,
  WhatsappAutomation,
  WhatsappConversation,
  WhatsappMessage,
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useBulkArchiveSelection } from '@/hooks/use-bulk-archive-selection';
import { BulkArchiveToolbar } from '@/components/archive/bulk-archive-toolbar';
import { AgentFlows, type AgentFlow } from '@/components/whatsapp/agent-flows';
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
  Save, MessageCircle, CalendarCheck, BellRing, RefreshCw, QrCode, Workflow
} from 'lucide-react';

const DEFAULT_BUSINESS_HOURS = [
  'segunda-feira: 07:30–20:00',
  'terça-feira: 07:30–20:00',
  'quarta-feira: 07:30–20:00',
  'quinta-feira: 07:30–20:00',
  'sexta-feira: 07:30–20:00',
  'sábado: 07:30–18:00',
  'domingo: 07:30–11:30',
].join('\n');

export function WhatsApp() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [qrImageFailed, setQrImageFailed] = useState(false);
  const [qrRefreshFailed, setQrRefreshFailed] = useState(false);
  const qrRefreshInFlight = useRef(false);
  const qrRequestVersion = useRef(0);

  const {
    data: config,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useGetAiAgentConfig();
  const updateConfig = useUpdateAiAgentConfig();
  const testAgent = useTestAiAgent();
  const { data: whatsappConnection, isLoading: isConnectionLoading } = useGetWhatsappConnection({
    query: {
      queryKey: getGetWhatsappConnectionQueryKey(),
      refetchInterval: qrCode || pairingCode ? 5_000 : 30_000,
    },
  });
  const { mutate: requestWhatsappQr, isPending: isConnectPending } = useConnectWhatsapp();
  const disconnectWhatsapp = useDisconnectWhatsapp();
  const { data: whatsappAutomation } = useGetWhatsappAutomation();
  const updateWhatsappAutomation = useUpdateWhatsappAutomation();
  const sendWhatsappReply = useSendWhatsappReply();
  const sendWhatsappDocument = useSendWhatsappDocument();
  const { data: whatsappMessages = [] } = useListWhatsappMessages({ limit: 50 });
  const { data: whatsappConversations = [] } = useListWhatsappConversations({ limit: 50 });
  const {
    data: unansweredConversations = [],
    isLoading: isUnansweredLoading,
    isError: isUnansweredError,
  } = useListWhatsappUnanswered(
    { limit: 100 },
    {
      query: {
        queryKey: getListWhatsappUnansweredQueryKey({ limit: 100 }),
        refetchInterval: 30_000,
      },
    },
  );
  const updateWhatsappConversation = useUpdateWhatsappConversation();
  const archiveRecords = useManageArchivedRecords();
  
  const {
    data: services = [],
    isLoading: isServicesLoading,
    isError: isServicesError,
  } = useListServices();
  const agentStatusKnown = Boolean(config) && !isConfigLoading && !isConfigError;
  const agentIsActive = agentStatusKnown && Boolean(config?.active);
  const createService = useCreateService();
  const updateService = useUpdateService();
  const conversationArchiveSelection = useBulkArchiveSelection({
    records: whatsappConversations.map((conversation) => ({ entity: 'whatsappConversation', id: String(conversation.phone) })),
    action: 'archive',
  });
  const serviceArchiveSelection = useBulkArchiveSelection({
    records: services.map((service) => ({ entity: 'service', id: String(service.id) })),
    action: 'archive',
  });

  const [activeTab, setActiveTab] = useState<'config' | 'services' | 'flows' | 'test'>('config');
  const [automationForm, setAutomationForm] = useState<WhatsappAutomation>({
    enabled: false,
    aiReplies: false,
    humanSupervision: true,
    confirmations: true,
    reminder24h: true,
    reminder2h: true,
    followUp30m: true,
    timezone: 'America/Belem',
  });
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
    businessHours: DEFAULT_BUSINESS_HOURS,
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
          toast({ title: 'Automação salva', description: 'As respostas, confirmações e lembretes foram atualizados.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível salvar as automações.', variant: 'destructive' }),
      },
    );
  };

  const handleSaveKeywordFlows = async (flows: AgentFlow[]) => {
    const current = whatsappAutomation ?? automationForm;
    const data = await updateWhatsappAutomation.mutateAsync({
      data: {
        ...current,
        keywordFlows: flows.map((flow) => ({
          ...flow,
          name: flow.name.trim(),
          keywords: flow.keywords.map((keyword) => keyword.trim()).filter(Boolean),
          message: flow.message.trim(),
        })),
      },
    });
    queryClient.setQueryData(getGetWhatsappAutomationQueryKey(), data);
    setAutomationForm(data);
  };

  const handleUploadFlowImage = async (file: File) => {
    const response = await uploadWhatsappFlowImage(file, {
      headers: { 'X-Image-Type': file.type },
    });
    return response.imageUrl;
  };

  const handleConnectWhatsapp = () => {
    if (qrRefreshInFlight.current || isConnectPending) return;
    qrRefreshInFlight.current = true;
    const requestVersion = ++qrRequestVersion.current;
    setQrRefreshFailed(false);
    requestWhatsappQr(
      undefined,
      {
        onSuccess: (data) => {
          if (requestVersion !== qrRequestVersion.current) return;
          queryClient.invalidateQueries({ queryKey: getGetWhatsappConnectionQueryKey() });
          if (data.connected) {
            setQrCode(null);
            setPairingCode(null);
            setQrImageFailed(false);
            setQrRefreshFailed(false);
          } else if (data.qrCode || data.pairingCode) {
            setQrCode(data.qrCode);
            setPairingCode(data.pairingCode);
            setQrImageFailed(false);
            setQrRefreshFailed(false);
          } else {
            setQrRefreshFailed(true);
          }
          const connectionSucceeded = data.connected || Boolean(data.qrCode || data.pairingCode);
          toast({
            title: data.connected
              ? 'WhatsApp conectado'
              : data.qrCode
                ? 'QR Code gerado'
                : data.pairingCode
                  ? 'Código de pareamento gerado'
                  : 'QR Code inválido ou indisponível',
            description: data.message,
            variant: connectionSucceeded ? 'default' : 'destructive',
          });
        },
        onError: () => {
          if (requestVersion !== qrRequestVersion.current) return;
          setQrRefreshFailed(true);
          toast({ title: 'Erro', description: 'Não foi possível gerar o QR Code.', variant: 'destructive' });
        },
        onSettled: () => {
          qrRefreshInFlight.current = false;
        },
      },
    );
  };

  useEffect(() => {
    if (!whatsappConnection?.connected || (!qrCode && !pairingCode)) return;
    qrRequestVersion.current += 1;
    setQrCode(null);
    setPairingCode(null);
    setQrImageFailed(false);
    setQrRefreshFailed(false);
    toast({
      title: 'WhatsApp conectado',
      description: 'A conexão foi confirmada pela Evolution API.',
    });
  }, [whatsappConnection?.connected, qrCode, pairingCode, toast]);

  const handleDisconnectWhatsapp = () => {
    if (!whatsappConnection?.instance || disconnectWhatsapp.isPending) return;
    if (!window.confirm('Liberar a instância atual para conectar outro número? As conversas e configurações serão mantidas.')) return;
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
    const knownPhones = new Set([
      ...whatsappConversations.map((conversation) => conversation.phone),
      ...unansweredConversations.map((conversation) => conversation.phone),
    ]);
    if (!selectedPhone && whatsappConversations[0]?.phone) {
      setSelectedPhone(whatsappConversations[0].phone);
    } else if (!selectedPhone && unansweredConversations[0]?.phone) {
      setSelectedPhone(unansweredConversations[0].phone);
    } else if (selectedPhone && !knownPhones.has(selectedPhone)) {
      setSelectedPhone(whatsappConversations[0]?.phone ?? unansweredConversations[0]?.phone ?? '');
    }
  }, [selectedPhone, whatsappConversations, unansweredConversations]);

  const selectedConversation = whatsappConversations.find((conversation) => conversation.phone === selectedPhone);
  const selectedUnansweredConversation = unansweredConversations.find((conversation) => conversation.phone === selectedPhone);
  const selectedClientName = selectedConversation?.clientName || selectedUnansweredConversation?.clientName || selectedPhone;
  const selectedConversationMessages: WhatsappMessage[] = whatsappMessages
    .filter((message) => message.phone === selectedPhone)
    .slice();
  if (
    selectedUnansweredConversation &&
    !selectedConversationMessages.some((message) => message.id === selectedUnansweredConversation.messageId)
  ) {
    selectedConversationMessages.push({
      id: selectedUnansweredConversation.messageId,
      direction: 'inbound',
      phone: selectedUnansweredConversation.phone,
      clientName: selectedUnansweredConversation.clientName,
      appointmentId: null,
      text: selectedUnansweredConversation.text,
      status: 'received',
      kind: 'reply',
      providerMessageId: null,
      error: null,
      createdAt: selectedUnansweredConversation.createdAt,
    });
  }
  selectedConversationMessages.sort((left, right) => left.id - right.id);
  const conversationStatusLabel: Record<WhatsappConversation['status'], string> = {
    agent: 'Agente',
    human: 'Atendimento humano',
    closed: 'Encerrada',
  };

  const invalidateWhatsapp = () => {
    void queryClient.invalidateQueries({ queryKey: getListWhatsappMessagesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListWhatsappConversationsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getListWhatsappUnansweredQueryKey() });
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
    if (!selectedPhone || !window.confirm(`Arquivar a conversa com ${selectedClientName}? As mensagens serão preservadas e a conversa poderá ser restaurada no Arquivo.`)) return;
    const phoneToArchive = String(selectedPhone);
    archiveRecords.mutate(
      { data: { action: 'archive', records: [{ entity: 'whatsappConversation', id: phoneToArchive }] } },
      {
        onSuccess: () => {
          setSelectedPhone('');
          invalidateWhatsapp();
          void queryClient.invalidateQueries({ queryKey: getListArchivedRecordsQueryKey() });
          toast({ title: 'Conversa arquivada', description: 'As mensagens foram preservadas e a conversa pode ser restaurada no Arquivo.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível arquivar a conversa.', variant: 'destructive' }),
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
    archiveRecords.mutate({ data: { action: 'archive', records: [{ entity: 'service', id: String(deleteDialog.service.id) }] } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getListArchivedRecordsQueryKey() });
        setDeleteDialog({ open: false });
        toast({ title: 'Serviço arquivado', description: 'O serviço pode ser restaurado no Arquivo.' });
      },
      onError: () => toast({ title: 'Erro', description: 'Não foi possível arquivar o serviço.', variant: 'destructive' })
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-[22px] border-border/70 bg-surface p-5 shadow-[0_8px_28px_-24px_rgba(44,33,25,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_40px_-28px_rgba(44,33,25,0.34)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/[0.045] blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Status do agente</p>
              <p data-testid="status-ai-agent" className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
                {isConfigLoading
                  ? 'Verificando...'
                  : !agentStatusKnown
                    ? 'Indisponível'
                    : config?.active
                      ? 'Ativo'
                      : 'Inativo'}
              </p>
            </div>
            <span className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset",
              agentIsActive ? "bg-success/10 text-success ring-success/10" : "bg-surface-soft text-text-secondary ring-border/60",
            )}>
              <Bot className="h-5 w-5" strokeWidth={1.8} />
            </span>
          </div>
          <div className="relative mt-5 flex items-center gap-2 border-t border-border/70 pt-3.5 text-xs font-medium text-text-muted">
            <span className={cn("h-2 w-2 rounded-full", agentIsActive ? "bg-success" : "bg-text-muted/50")} />
            <span>
              {isConfigLoading
                ? 'Consultando a configuração do agente'
                : !agentStatusKnown
                  ? 'Não foi possível verificar o status atual'
                  : config?.active
                    ? 'Agente pronto para atender'
                    : 'Respostas automáticas pausadas'}
            </span>
          </div>
        </Card>

        <Card className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-[22px] border-border/70 bg-surface p-5 shadow-[0_8px_28px_-24px_rgba(44,33,25,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_40px_-28px_rgba(44,33,25,0.34)]">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/[0.045] blur-2xl transition-transform duration-500 group-hover:scale-125" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">Base de conhecimento</p>
              <p data-testid="text-service-count" className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
                {isServicesLoading
                  ? 'Carregando...'
                  : isServicesError
                    ? 'Indisponível'
                    : `${services.length} ${services.length === 1 ? 'serviço' : 'serviços'}`}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
              <Database className="h-5 w-5" strokeWidth={1.8} />
            </span>
          </div>
          <div className="relative mt-5 flex items-center gap-2 border-t border-border/70 pt-3.5 text-xs font-medium text-text-muted">
            <Database className="h-3.5 w-3.5 text-primary" />
            <span>
              {isServicesLoading
                ? 'Consultando serviços'
                : isServicesError
                  ? 'Não foi possível verificar o catálogo'
                  : services.length
                    ? 'Conteúdo disponível para o agente'
                    : 'Cadastre serviços para o agente'}
            </span>
          </div>
        </Card>

        <Card className="relative overflow-hidden rounded-[22px] border-primary/20 bg-gradient-to-br from-surface via-surface to-primary-soft/25 p-5 shadow-[0_10px_32px_-24px_rgba(44,33,25,0.38)] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_18px_42px_-28px_rgba(44,33,25,0.4)] md:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:flex-col">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">WhatsApp</p>
                  <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                    isConnectionLoading
                      ? "border-border bg-surface/70 text-text-secondary"
                      : whatsappConnection?.connected
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-warning/20 bg-warning/10 text-warning",
                  )}>
                    <span className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isConnectionLoading ? "bg-text-muted/60" : whatsappConnection?.connected ? "bg-success" : "bg-warning",
                    )} />
                    {isConnectionLoading ? 'Verificando...' : whatsappConnection?.connected ? 'Conectado' : 'Não conectado'}
                  </span>
                </div>
                <p data-testid="text-whatsapp-connection-message" className="mt-2 line-clamp-2 break-words text-sm leading-relaxed text-text-secondary">
                  {whatsappConnection?.message || 'Gere um QR Code para conectar o WhatsApp'}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px] sm:flex-row sm:flex-wrap xl:w-full xl:flex-col">
              <Button
                type="button"
                onClick={handleConnectWhatsapp}
                disabled={isConnectPending || disconnectWhatsapp.isPending}
                className="min-h-12 w-full justify-center gap-2.5 rounded-xl px-4 text-sm font-semibold shadow-[0_8px_18px_-10px_rgba(74,53,37,0.72)] transition-all duration-200 hover:shadow-[0_12px_22px_-10px_rgba(74,53,37,0.72)] active:translate-y-0 active:scale-[0.99] sm:flex-1 xl:w-full xl:flex-none"
                data-testid="button-generate-whatsapp-qr"
              >
                {isConnectPending
                  ? <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" />
                  : <QrCode className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />}
                <span>{isConnectPending ? 'Gerando QR Code...' : whatsappConnection?.connected ? 'Gerar QR Code novamente' : 'Gerar QR Code'}</span>
              </Button>
              {whatsappConnection?.instance && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDisconnectWhatsapp}
                  disabled={disconnectWhatsapp.isPending || isConnectPending}
                  className="min-h-11 w-full justify-center gap-2 whitespace-normal rounded-xl border-border/80 bg-surface/70 px-4 text-center text-xs font-semibold leading-snug text-text-secondary transition-colors hover:border-primary/35 hover:bg-primary/5 hover:text-primary sm:flex-1 xl:w-full xl:flex-none"
                  data-testid="button-disconnect-whatsapp"
                >
                  {disconnectWhatsapp.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <XCircle className="h-4 w-4 shrink-0" />}
                  <span>{whatsappConnection.connected ? 'Desconectar e trocar número' : 'Liberar instância e trocar número'}</span>
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
              As automações são verificadas a cada minuto. O follow-up só é enviado quando o agente faz uma pergunta e não recebe resposta por 30 minutos; qualquer nova resposta da cliente cancela o envio. O simulador não envia mensagens nem testa lembretes.
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
            { key: 'followUp30m' as const, title: 'Follow-up após 30 minutos', description: 'Envia uma mensagem leve quando a cliente não responde a uma pergunta do agente.', icon: MessageCircle },
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

        {!automationForm.enabled && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            A automação está desligada. Ative “Automação ativa” e salve para permitir respostas e mensagens automáticas.
          </div>
        )}

        <div className="pt-4 border-t border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <RefreshCw className="w-4 h-4 text-primary" /> Supervisão do atendimento
              </div>
              <p className="text-xs text-text-muted mt-1">
                Acompanhe as conversas e responda manualmente. A fila considera apenas mensagens já salvas no app e não envia respostas automáticas.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
                {whatsappConversations.length} {whatsappConversations.length === 1 ? 'conversa' : 'conversas'}
              </span>
              <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
                {unansweredConversations.length} sem resposta
              </span>
            </div>
          </div>
          <div>
             <BulkArchiveToolbar selection={conversationArchiveSelection} />
            {whatsappConversations.length === 0 && unansweredConversations.length === 0 ? (
              <p className="text-sm text-text-muted rounded-lg border border-dashed border-border p-3">
                Nenhuma conversa registrada ainda. Quando chegar uma mensagem, ela aparecerá aqui para a equipe acompanhar.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,0.78fr)_minmax(0,1.5fr)] gap-4">
                <div className="space-y-3">
                  <section className="rounded-xl border border-warning/30 bg-warning/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-text-primary">Aguardando resposta</h3>
                      <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                        {unansweredConversations.length}
                      </span>
                    </div>
                    {isUnansweredLoading ? (
                      <p className="text-[11px] text-text-muted">Verificando mensagens salvas...</p>
                    ) : isUnansweredError ? (
                      <p className="text-[11px] text-error">Não foi possível atualizar a fila de mensagens sem resposta.</p>
                    ) : unansweredConversations.length === 0 ? (
                      <p className="text-[11px] text-text-muted">Nenhuma mensagem pendente.</p>
                    ) : (
                      <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                        {unansweredConversations.map((item) => (
                          <button
                            key={item.messageId}
                            type="button"
                            onClick={() => setSelectedPhone(item.phone)}
                            className={cn(
                              "w-full rounded-lg border p-2 text-left text-[11px] transition-colors",
                              selectedPhone === item.phone ? "border-warning/60 bg-warning/10" : "border-border bg-background hover:border-warning/40",
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate font-semibold text-text-primary">{item.clientName || item.phone}</span>
                              <time className="shrink-0 text-[10px] text-text-muted">
                                {new Date(item.createdAt).toLocaleString('pt-BR', {
                                  timeZone: 'America/Belem',
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </time>
                            </span>
                            <span className="mt-1 block truncate text-text-secondary">{item.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </section>
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {whatsappConversations.map((conversation) => {
                      const isUnanswered = unansweredConversations.some((item) => item.phone === conversation.phone);
                      return (
                        <div
                          key={conversation.id}
                          className={cn(
                            "w-full min-w-0 flex items-start gap-3 rounded-xl border p-3 text-xs transition-colors",
                            selectedPhone === conversation.phone ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={conversationArchiveSelection.isSelected({ entity: 'whatsappConversation', id: String(conversation.phone) })}
                            onChange={() => conversationArchiveSelection.toggleRecord({ entity: 'whatsappConversation', id: String(conversation.phone) })}
                            aria-label={`Selecionar conversa com ${conversation.clientName || conversation.phone}`}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          />
                          <button
                            type="button"
                            onClick={() => setSelectedPhone(conversation.phone)}
                            className="flex min-w-0 flex-1 items-start justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 font-medium text-text-primary">
                                <span className="truncate">{conversation.clientName || conversation.phone}</span>
                                {isUnanswered && (
                                  <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                                    Sem resposta
                                  </span>
                                )}
                                <span className="shrink-0 font-normal text-text-muted">{conversation.messageCount} mensagens</span>
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
                        </div>
                      );
                    })}
                  </div>
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
                       disabled={!selectedPhone || archiveRecords.isPending}
                      className="h-7 w-7 text-error hover:text-error"
                       title="Arquivar conversa"
                    >
                       {archiveRecords.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {selectedConversation && (
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
                  )}
                  {selectedPhone && (
                    <div className="min-h-40 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-soft p-2.5 space-y-2">
                      {selectedConversationMessages.length === 0 ? (
                        <p className="text-[11px] text-text-muted">Nenhuma mensagem recente disponível para esta conversa.</p>
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

      <Dialog
        open={Boolean(qrCode || pairingCode)}
        onOpenChange={(open) => {
          if (!open) {
            qrRequestVersion.current += 1;
            setQrCode(null);
            setPairingCode(null);
            setQrImageFailed(false);
          }
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular, entre em <strong>Aparelhos conectados</strong> e escaneie este QR Code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-3">
            {qrCode && !qrImageFailed && (
              <img
                src={qrCode}
                alt="QR Code para conectar o WhatsApp"
                onError={() => setQrImageFailed(true)}
                className="aspect-square w-full max-w-80 rounded-2xl border border-border bg-white p-2 object-contain shadow-sm"
              />
            )}
            {qrImageFailed && (
              <p role="alert" className="max-w-sm text-center text-sm text-destructive">
                O WhatsApp não conseguiu carregar a imagem do QR Code. Gere outro código antes de tentar novamente.
              </p>
            )}
            {qrRefreshFailed && (
              <p role="status" className="max-w-sm text-center text-sm text-warning">
                Não foi possível gerar outro QR Code. O atual continua na tela; tente novamente se necessário.
              </p>
            )}
            {pairingCode && (
              <div className="w-full rounded-xl border border-border bg-surface/70 p-4 text-center">
                <p className="text-xs text-text-muted">Código de pareamento alternativo</p>
                <p className="mt-1 font-mono text-xl font-bold tracking-wider text-text-primary">{pairingCode}</p>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                  Se preferir, use a opção de conectar com número de telefone em Aparelhos conectados.
                </p>
              </div>
            )}
            <p className="text-xs text-center text-text-muted">
              O QR Code não será trocado automaticamente. O status é verificado automaticamente; se o QR expirar, use o botão para gerar outro.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleConnectWhatsapp}
              disabled={isConnectPending || disconnectWhatsapp.isPending}
              className="w-full"
            >
              {isConnectPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <RefreshCw className="mr-2 h-4 w-4" />}
              Atualizar QR Code
            </Button>
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
          onClick={() => setActiveTab('flows')} 
          className={cn("shrink-0 whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2", activeTab === 'flows' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-primary')}
          aria-current={activeTab === 'flows' ? 'page' : undefined}
        >
          <Workflow className="w-4 h-4" />
          Fluxos
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
            ) : isConfigError || !config ? (
              <div
                role="alert"
                className="rounded-xl border border-border bg-surface-soft p-4 text-sm text-text-secondary"
              >
                Não foi possível consultar a configuração. O status real do agente é desconhecido; tente novamente antes de alterar as opções.
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
                        data-testid="input-business-hours"
                        value={formData.businessHours}
                        onChange={e => setFormData(p => ({ ...p, businessHours: e.target.value }))}
                        rows={7}
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
                      <p className="text-xs text-text-muted">Informe o endereço completo. Apenas “Belém - PA” não basta para orientar a cliente.</p>
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

        {activeTab === 'flows' && (
          <AgentFlows
            flows={whatsappAutomation?.keywordFlows ?? []}
            isLoading={!whatsappAutomation}
            onSave={handleSaveKeywordFlows}
            onUploadImage={handleUploadFlowImage}
          />
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
            <BulkArchiveToolbar selection={serviceArchiveSelection} />

            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-surface-soft text-text-muted font-medium">
                    <tr>
                          <th className="px-6 py-4">Selecionar</th>
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
                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : isServicesError ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                          Não foi possível carregar o catálogo. Tente novamente; isso não significa que os serviços foram apagados.
                        </td>
                      </tr>
                    ) : services.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                          Nenhum serviço cadastrado. Adicione o primeiro para treinar o agente.
                        </td>
                      </tr>
                    ) : (
                      services.map(service => (
                        <tr key={service.id} className="hover:bg-surface-soft/50 transition-colors">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={serviceArchiveSelection.isSelected({ entity: 'service', id: String(service.id) })}
                              onChange={() => serviceArchiveSelection.toggleRecord({ entity: 'service', id: String(service.id) })}
                              aria-label={`Selecionar serviço ${service.name}`}
                              className="h-4 w-4 accent-primary"
                            />
                          </td>
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
                  <p className="text-[11px] text-text-muted font-medium">
                    Simulador de texto — não cria agendamentos nem envia WhatsApp ou lembretes
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
                    <p className="text-[13px] mt-1 max-w-xs">Digite mensagens fictícias para avaliar somente as respostas de texto do agente.</p>
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
            <DialogTitle>Arquivar Serviço</DialogTitle>
            <DialogDescription>O serviço deixará de aparecer nas listas ativas, mas poderá ser restaurado no Arquivo.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setDeleteDialog({ open: false })}>Cancelar</Button>
              <Button type="button" variant="destructive" onClick={confirmDeleteService} disabled={archiveRecords.isPending}>
               {archiveRecords.isPending ? 'Arquivando...' : 'Sim, arquivar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
