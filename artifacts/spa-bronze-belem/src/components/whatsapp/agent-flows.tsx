import {
  CalendarCheck,
  Check,
  Clock3,
  HeartPulse,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Sun,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

const agentFlows = [
  {
    id: 'first-contact',
    title: 'Primeiro contato e continuidade',
    icon: MessageCircle,
    trigger: 'Nova conversa, dúvida ou continuação de um assunto.',
    steps: [
      'Consulta o histórico para entender o que a cliente já informou e qual foi a última pergunta.',
      'Na primeira resposta, usa a saudação configurada e já responde à dúvida principal.',
      'Agrupa mensagens seguidas e evita repetir perguntas, explicações ou ofertas recusadas.',
    ],
    guard: 'Se a intenção estiver ambígua, faz uma pergunta curta em vez de presumir.',
    owner: 'IA com regras de atendimento',
  },
  {
    id: 'services-catalogs',
    title: 'Dúvidas sobre serviços e catálogos',
    icon: ListChecks,
    trigger: 'Perguntas sobre procedimentos, serviços, preços ou opções do Spa.',
    steps: [
      'Identifica o serviço e a modalidade antes de explicar como funciona.',
      'Usa os dados cadastrados; não inventa preços, horários, contraindicações ou resultados.',
      'Quando o interesse é geral, envia o cardápio do Spa e o catálogo de estética avançada.',
    ],
    guard: 'Não envia os catálogos durante logística, atualização de chegada ou agendamento específico.',
    owner: 'IA com catálogo cadastrado',
  },
  {
    id: 'appointments',
    title: 'Agendamento',
    icon: CalendarCheck,
    trigger: 'Pedido claro para marcar ou continuar um agendamento em andamento.',
    steps: [
      'Mantém os dados já informados e pergunta somente o próximo dado necessário.',
      'Consulta horários disponíveis antes de oferecer uma opção.',
      'Revalida disponibilidade antes de criar a reserva; escolher um horário oferecido confirma a escolha.',
    ],
    guard: 'Não inicia agendamento só porque a cliente pediu um catálogo ou mudou de assunto.',
    owner: 'IA + validações do sistema',
  },
  {
    id: 'bronze-queue',
    title: 'Bronze por ordem de chegada e fila',
    icon: Sun,
    trigger: 'A cliente informa claramente que pretende ir ao Spa para fazer bronze.',
    steps: [
      'Confirma a triagem de gravidez antes de incluir a cliente na fila.',
      'Se a resposta for “não”, pede confirmação explícita da ida ao Spa.',
      'Após a confirmação, inclui a cliente na fila do dia e confirma o registro.',
    ],
    guard: 'Não inclui na fila se houver gravidez, dúvida sobre a triagem ou falta de confirmação da visita.',
    owner: 'Regras do sistema',
  },
  {
    id: 'bronze-guidance',
    title: 'Orientação sobre bronze',
    icon: Sparkles,
    trigger: 'Dúvidas sobre bronze natural, máquina, preparo ou primeira experiência.',
    steps: [
      'Usa o histórico para não perguntar de novo a modalidade ou experiência já informada.',
      'Respeita a escolha entre natural e máquina e envia áudio somente quando as regras permitem.',
      'Só recomenda o Neon para máquina quando a cliente ainda está avaliando opções.',
    ],
    guard: 'Não promete resultados ou segurança e não repete áudio já tentado.',
    owner: 'IA com regras de segurança',
  },
  {
    id: 'reminders',
    title: 'Confirmações e lembretes',
    icon: Clock3,
    trigger: 'Agendamento criado ou lembrete habilitado nas automações.',
    steps: [
      'Pode enviar confirmação após criar ou alterar um agendamento.',
      'Os lembretes de 24 horas e 2 horas dependem das opções salvas na tela.',
      'O follow-up de 30 minutos só ocorre após uma pergunta sem resposta; uma nova mensagem cancela o envio.',
    ],
    guard: 'As automações podem ser ligadas ou desligadas na seção “Confirmações e lembretes de agenda”.',
    owner: 'Automações configuráveis',
  },
  {
    id: 'human-support',
    title: 'Apoio da equipe',
    icon: UsersRound,
    trigger: 'Pedido por atendente, reclamação, questão de saúde ou informação não confirmada.',
    steps: [
      'Responde com acolhimento e explica brevemente que a equipe dará continuidade.',
      'Encaminha dúvidas de saúde, exceções e condições que não estão cadastradas.',
      'Não inventa prazo de retorno nem confirmação de transferência.',
    ],
    guard: 'A IA não dá diagnóstico nem cria informações para preencher lacunas.',
    owner: 'IA + equipe',
  },
];

export function AgentFlows() {
  return (
    <section className="space-y-5 pb-8" aria-labelledby="agent-flows-heading">
      <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Workflow className="h-5 w-5" />
          </span>
          <div>
            <h2 id="agent-flows-heading" className="text-lg font-semibold text-text-primary">
              Fluxos atuais do atendimento
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
              Resumo das principais regras já usadas pelo agente e pelas automações. Este painel é apenas para consulta:
              não edita as respostas nem altera o comportamento do WhatsApp.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-border/70 bg-surface/80 px-3.5 py-3 text-xs leading-relaxed text-text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Em vários fluxos, a IA ainda redige a resposta seguindo essas regras. As mensagens não são todas textos prontos.
            As etapas de fila e validação de agenda são controladas pelo sistema.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {agentFlows.map((flow) => {
          const Icon = flow.icon;
          return (
            <Card key={flow.id} className="overflow-hidden rounded-2xl border-border/75 bg-surface">
              <div className="flex items-start gap-3.5 p-5 pb-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-text-primary">{flow.title}</h3>
                    <span className="rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                      {flow.owner}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
                    <span className="font-semibold text-text-secondary">Quando começa: </span>
                    {flow.trigger}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5">
                <ol className="space-y-3">
                  {flow.steps.map((step, stepIndex) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {stepIndex + 1}
                        {stepIndex < flow.steps.length - 1 && (
                          <span className="absolute left-1/2 top-6 h-3 w-px -translate-x-1/2 bg-border" />
                        )}
                      </span>
                      <span className="text-sm leading-relaxed text-text-secondary">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex items-start gap-2 rounded-lg bg-surface-soft/75 px-3 py-2.5 text-xs leading-relaxed text-text-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span><strong className="font-semibold text-text-secondary">Limite: </strong>{flow.guard}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
