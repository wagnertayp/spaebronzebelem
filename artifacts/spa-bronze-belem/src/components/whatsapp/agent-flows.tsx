import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type AgentFlow = {
  id: string;
  name: string;
  keywords: string[];
  enabled: boolean;
  message: string;
  imageUrl: string | null;
};

export type AgentFlowsProps = {
  flows?: AgentFlow[];
  onSave?: (flows: AgentFlow[]) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  isLoading?: boolean;
};

const existingSystemFlows = [
  {
    title: 'Catálogos do Spa',
    media: '2 PDFs',
    details: 'O interesse geral em serviços pode enviar o cardápio do Spa e o catálogo de estética avançada.',
  },
  {
    title: 'DAP com fotos de referência',
    media: 'Texto + 2 imagens',
    details: 'As fotos são acompanhadas de uma explicação de que cada caso é individual e os resultados variam.',
  },
  {
    title: 'Banho de Lua',
    media: 'Texto + banner',
    details: 'Há banners separados para 5 passos (R$ 120) e Clareador de 7 passos (R$ 150).',
  },
  {
    title: 'Preparo para sessão de bronze',
    media: 'Texto + imagem',
    details: 'O agente pode enviar a imagem com as orientações confirmadas para a sessão.',
  },
  {
    title: 'Áudios de bronze e combos',
    media: 'Texto + áudio',
    details: 'Os áudios são enviados apenas quando pertinentes e cada um pode ser tentado uma vez por conversa.',
  },
  {
    title: 'Fila de bronze',
    media: 'Triagem + confirmação',
    details: 'A equipe só inclui a cliente após a triagem de gravidez e a confirmação explícita da ida.',
  },
  {
    title: 'Agendamento e lembretes',
    media: 'Agenda',
    details: 'O sistema valida horários e controla confirmações e lembretes, sem retomar conversas antigas.',
  },
];

const emptyFlow = (): AgentFlow => ({
  id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  keywords: [],
  enabled: false,
  message: '',
  imageUrl: null,
});

export function AgentFlows({
  flows = [],
  onSave,
  onUploadImage,
  isLoading = false,
}: AgentFlowsProps) {
  const [drafts, setDrafts] = useState<AgentFlow[]>(flows);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingFlowId, setUploadingFlowId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [uploadError, setUploadError] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState('');
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setDrafts(flows);
  }, [flows]);

  const updateFlow = (id: string, update: Partial<AgentFlow>) => {
    setDrafts((current) => current.map((flow) => flow.id === id ? { ...flow, ...update } : flow));
    setSaveMessage('');
  };

  const addFlow = () => {
    setDrafts((current) => [...current, emptyFlow()]);
    setSaveError('');
    setSaveMessage('');
  };

  const removeFlow = (flow: AgentFlow) => {
    if (!window.confirm(`Remover o fluxo “${flow.name || 'Sem nome'}”? Essa alteração será aplicada ao salvar.`)) return;
    setDrafts((current) => current.filter((item) => item.id !== flow.id));
    setSaveMessage('');
  };

  const handleSave = async () => {
    if (!onSave) {
      setSaveError('A gravação dos fluxos ainda não está conectada. Nenhuma alteração foi salva.');
      return;
    }
    if (drafts.length > 30) {
      setSaveError('O limite é de 30 fluxos personalizados.');
      return;
    }
    const incomplete = drafts.find((flow) =>
      !flow.name.trim() ||
      !flow.keywords.some((keyword) => keyword.trim()) ||
      !flow.message.trim() ||
      flow.keywords.length > 20 ||
      flow.keywords.some((keyword) => keyword.length > 80) ||
      flow.message.length > 1500
    );
    if (incomplete) {
      setSaveError('Preencha o nome, ao menos uma palavra-chave e a mensagem. Cada fluxo aceita até 20 palavras-chave e 1.500 caracteres.');
      return;
    }
    setIsSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      await onSave(drafts);
      setSaveMessage('Fluxos salvos. As alterações foram aplicadas com segurança.');
    } catch {
      setSaveError('Não foi possível salvar os fluxos. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImage = async (flow: AgentFlow, file?: File) => {
    if (!file) return;
    setUploadError((current) => ({ ...current, [flow.id]: '' }));
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setUploadError((current) => ({ ...current, [flow.id]: 'Use uma imagem JPG, PNG, WebP ou GIF.' }));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError((current) => ({ ...current, [flow.id]: 'A imagem deve ter até 8 MB.' }));
      return;
    }
    if (!onUploadImage) {
      setUploadError((current) => ({
        ...current,
        [flow.id]: 'O envio de imagens ainda não está conectado.',
      }));
      return;
    }

    const previousImage = flow.imageUrl;
    const previewUrl = URL.createObjectURL(file);
    updateFlow(flow.id, { imageUrl: previewUrl });
    setUploadingFlowId(flow.id);
    try {
      const uploadedUrl = await onUploadImage(file);
      updateFlow(flow.id, { imageUrl: uploadedUrl });
    } catch {
      updateFlow(flow.id, { imageUrl: previousImage });
      setUploadError((current) => ({
        ...current,
        [flow.id]: 'Não foi possível enviar a imagem. Tente novamente.',
      }));
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingFlowId(null);
    }
  };

  const hasUnsavedChanges = JSON.stringify(drafts) !== JSON.stringify(flows);

  if (isLoading) {
    return (
      <section className="space-y-5 pb-8" aria-labelledby="agent-flows-heading" aria-busy="true">
        <div className="rounded-2xl border border-border/75 bg-surface p-5 sm:p-6">
          <div className="h-5 w-48 animate-pulse rounded-md bg-surface-soft" />
          <div className="mt-3 h-4 max-w-xl animate-pulse rounded-md bg-surface-soft" />
          <div className="mt-2 h-4 w-2/3 animate-pulse rounded-md bg-surface-soft" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="h-72 animate-pulse rounded-2xl border border-border/70 bg-surface p-5">
              <div className="h-5 w-40 rounded bg-surface-soft" />
              <div className="mt-5 h-10 rounded-lg bg-surface-soft" />
              <div className="mt-4 h-28 rounded-lg bg-surface-soft" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando fluxos de atendimento</span>
      </section>
    );
  }

  return (
    <section className="space-y-5 pb-8" aria-labelledby="agent-flows-heading">
      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-surface to-surface p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Atendimento no WhatsApp</p>
              <h2 id="agent-flows-heading" className="mt-1 text-lg font-semibold tracking-tight text-text-primary">
                Respostas por palavra-chave
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-secondary">
                Organize respostas prontas para dúvidas frequentes. Cada fluxo combina palavras que a cliente pode enviar e uma mensagem da equipe.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addFlow}
            disabled={isSaving || Boolean(uploadingFlowId)}
            data-testid="button-add-agent-flow"
            className="min-h-10 shrink-0 gap-2 rounded-xl border-primary/20 bg-surface/80 px-3.5 text-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Novo fluxo
          </Button>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/[0.07] px-3.5 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="text-xs font-semibold text-text-primary">Os novos fluxos começam desligados</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
              Para enviar automaticamente, ative este fluxo e mantenha a automação do WhatsApp e as respostas da IA ligadas. Revise o texto antes de ativar.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Fluxos já usados pelo agente</h3>
            <p className="mt-1 text-xs text-text-muted">Regras e mídias que já fazem parte do atendimento atual.</p>
          </div>
          <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-muted">
            {existingSystemFlows.length} fluxos existentes
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {existingSystemFlows.map((flow) => (
            <Card key={flow.title} className="rounded-xl border-border/75 bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-semibold text-text-primary">{flow.title}</h4>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{flow.media}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">{flow.details}</p>
            </Card>
          ))}
        </div>
      </div>

      {drafts.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-primary/25 bg-surface p-7 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" />
          </span>
          <h3 className="mt-4 font-semibold text-text-primary">Nenhum fluxo personalizado</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-secondary">
            Os fluxos atuais estão listados acima. Crie respostas por palavra-chave aqui; elas ficam desligadas até você ativá-las.
          </p>
          <Button type="button" onClick={addFlow} data-testid="button-create-first-flow" className="mt-5 gap-2 rounded-xl">
            <Plus className="h-4 w-4" />
            Criar primeiro fluxo
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((flow, index) => {
            const isUploading = uploadingFlowId === flow.id;
            return (
              <Card
                key={flow.id}
                data-testid={`card-agent-flow-${flow.id}`}
                className="overflow-hidden rounded-2xl border-border/75 bg-surface shadow-[0_8px_26px_-22px_rgba(44,33,25,0.36)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface-soft/40 px-4 py-3.5 sm:px-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-text-primary">
                        {flow.name.trim() || 'Novo fluxo'}
                      </h3>
                      <p className="text-[11px] text-text-muted">
                        {flow.enabled ? 'Resposta automática ativa' : 'Resposta automática desligada'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flow.enabled}
                      aria-label={`${flow.enabled ? 'Desativar' : 'Ativar'} ${flow.name || 'fluxo'}`}
                      onClick={() => updateFlow(flow.id, { enabled: !flow.enabled })}
                      disabled={isSaving || isUploading}
                      data-testid={`switch-agent-flow-${flow.id}`}
                      className={cn(
                        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                        flow.enabled ? 'bg-success' : 'bg-border',
                      )}
                    >
                      <span className={cn(
                        'h-5 w-5 rounded-full bg-surface shadow-sm transition-transform',
                        flow.enabled ? 'translate-x-6' : 'translate-x-1',
                      )} />
                    </button>
                    <span className={cn(
                      'min-w-[58px] text-xs font-semibold',
                      flow.enabled ? 'text-success' : 'text-text-muted',
                    )}>
                      {flow.enabled ? 'Ligado' : 'Desligado'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFlow(flow)}
                      disabled={isSaving || isUploading}
                      aria-label={`Remover fluxo ${flow.name || 'sem nome'}`}
                      data-testid={`button-remove-agent-flow-${flow.id}`}
                      className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                  <div className="space-y-4">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Nome do fluxo</span>
                      <input
                        type="text"
                        value={flow.name}
                        onChange={(event) => updateFlow(flow.id, { name: event.target.value })}
                        disabled={isSaving || isUploading}
                        placeholder="Ex.: Valores e horários"
                        data-testid={`input-flow-name-${flow.id}`}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Palavras-chave</span>
                      <input
                        type="text"
                        value={flow.keywords.join(', ')}
                        onChange={(event) => updateFlow(flow.id, {
                          keywords: event.target.value.split(',').map((word) => word.trim()).filter(Boolean),
                        })}
                        disabled={isSaving || isUploading}
                        placeholder="preço, valor, quanto custa"
                        data-testid={`input-flow-keywords-${flow.id}`}
                        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                      />
                      <span className="mt-1.5 block text-[11px] leading-relaxed text-text-muted">
                        Separe cada termo por vírgula. Use expressões que as clientes realmente escrevem.
                      </span>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-text-secondary">
                        Mensagem de resposta
                        <span className="font-normal text-text-muted">{flow.message.length} caracteres</span>
                      </span>
                      <textarea
                        value={flow.message}
                        onChange={(event) => updateFlow(flow.id, { message: event.target.value })}
                        disabled={isSaving || isUploading}
                        rows={5}
                        placeholder="Escreva uma resposta acolhedora e objetiva..."
                        data-testid={`textarea-flow-message-${flow.id}`}
                        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-text-primary outline-none transition placeholder:text-text-muted/80 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:opacity-60"
                      />
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-text-secondary">Imagem opcional</p>
                        <p className="mt-0.5 text-[11px] text-text-muted">A mensagem será usada como legenda no WhatsApp.</p>
                      </div>
                      {flow.imageUrl && (
                        <button
                          type="button"
                          onClick={() => updateFlow(flow.id, { imageUrl: null })}
                          disabled={isSaving || isUploading}
                          data-testid={`button-remove-flow-image-${flow.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-text-muted transition hover:bg-error/10 hover:text-error disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Remover imagem
                        </button>
                      )}
                    </div>

                    {flow.imageUrl ? (
                      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-soft">
                        <img
                          src={flow.imageUrl}
                          alt={`Prévia da imagem do fluxo ${flow.name || 'novo fluxo'}`}
                          data-testid={`img-flow-preview-${flow.id}`}
                          className="h-44 w-full object-cover"
                        />
                        {isUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-dark/45 text-sm font-semibold text-white">
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            Enviando imagem
                          </div>
                        )}
                        <div className="border-t border-border/70 bg-[#e8f1e9] px-3 py-2.5">
                          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[#263b2c]">
                            {flow.message.trim() || 'A legenda da imagem aparece aqui quando você escrever a mensagem.'}
                          </p>
                          <p className="mt-1 text-right text-[10px] text-[#617566]">prévia de envio</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-[168px] flex-col items-center justify-center rounded-xl border border-dashed border-primary/25 bg-primary/[0.025] px-4 py-5 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <ImagePlus className="h-5 w-5" />
                        </span>
                        <p className="mt-2 text-xs font-semibold text-text-secondary">Sem imagem nesta resposta</p>
                        <p className="mt-1 text-[11px] text-text-muted">JPG, PNG, WebP ou GIF · até 8 MB</p>
                        <input
                          ref={(element) => { fileInputs.current[flow.id] = element; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(event) => {
                            void handleImage(flow, event.currentTarget.files?.[0]);
                            event.currentTarget.value = '';
                          }}
                          disabled={isSaving || Boolean(uploadingFlowId)}
                          data-testid={`input-flow-image-${flow.id}`}
                          className="sr-only"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputs.current[flow.id]?.click()}
                          disabled={isSaving || Boolean(uploadingFlowId)}
                          data-testid={`button-upload-flow-image-${flow.id}`}
                          className="mt-3 h-9 gap-2 rounded-lg border-primary/20 bg-surface px-3 text-xs text-primary hover:bg-primary/5"
                        >
                          {isUploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {isUploading ? 'Enviando...' : 'Escolher imagem'}
                        </Button>
                      </div>
                    )}
                    {flow.imageUrl && (
                      <>
                        <input
                          ref={(element) => { fileInputs.current[flow.id] = element; }}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(event) => {
                            void handleImage(flow, event.currentTarget.files?.[0]);
                            event.currentTarget.value = '';
                          }}
                          disabled={isSaving || Boolean(uploadingFlowId)}
                          data-testid={`input-flow-image-${flow.id}`}
                          className="sr-only"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputs.current[flow.id]?.click()}
                          disabled={isSaving || Boolean(uploadingFlowId)}
                          data-testid={`button-replace-flow-image-${flow.id}`}
                          className="h-9 gap-2 rounded-lg border-border px-3 text-xs text-text-secondary hover:border-primary/30 hover:text-primary"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Trocar imagem
                        </Button>
                      </>
                    )}
                    {uploadError[flow.id] && (
                      <p role="alert" data-testid={`error-flow-upload-${flow.id}`} className="flex items-start gap-1.5 text-xs leading-relaxed text-error">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {uploadError[flow.id]}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="sticky bottom-3 z-10 rounded-2xl border border-border/80 bg-surface/95 p-3 shadow-[0_12px_32px_-16px_rgba(44,33,25,0.35)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:px-4">
        <div className="min-w-0 sm:pr-4">
          {saveError ? (
            <p role="alert" data-testid="error-agent-flows-save" className="flex items-start gap-2 text-xs leading-relaxed text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {saveError}
            </p>
          ) : saveMessage ? (
            <p role="status" data-testid="status-agent-flows-saved" className="flex items-center gap-2 text-xs font-medium text-success">
              <Check className="h-4 w-4 shrink-0" />
              {saveMessage}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-text-muted">
              {hasUnsavedChanges ? 'Há alterações que ainda não foram salvas.' : 'Salve as alterações para atualizar os fluxos.'}
            </p>
          )}
        </div>
        <Button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || Boolean(uploadingFlowId) || !hasUnsavedChanges}
          data-testid="button-save-agent-flows"
          className="mt-2 min-h-10 w-full shrink-0 gap-2 rounded-xl px-4 text-sm font-semibold sm:mt-0 sm:w-auto"
        >
          {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? 'Salvando fluxos...' : 'Salvar alterações'}
        </Button>
      </div>
    </section>
  );
}
