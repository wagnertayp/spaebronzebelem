import { useListLeads, useUpdateLead, LeadStage } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Plus, MessageCircle, Clock, DollarSign, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getListLeadsQueryKey } from '@workspace/api-client-react';

const STAGES = [
  { id: 'new', label: 'Novos', color: 'bg-primary-soft/50 text-primary-dark border-primary/20' },
  { id: 'contacting', label: 'Em Contato', color: 'bg-accent/10 text-[#8A6B3F] border-accent/20' },
  { id: 'quote', label: 'Orçamento', color: 'bg-surface-soft text-text-primary border-border' },
  { id: 'scheduled', label: 'Agendado', color: 'bg-[#E7EEE4] text-[#596653] border-[#7D8B78]/20' },
  { id: 'converted', label: 'Convertido', color: 'bg-success/10 text-success border-success/20' },
];

export function WhatsApp() {
  const { data: leads = [], isLoading } = useListLeads();
  const updateLead = useUpdateLead();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleStageChange = (id: number, stage: LeadStage) => {
    updateLead.mutate(
      { id, data: { stage } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
          toast({
            title: "Estágio atualizado",
            description: "O lead foi movido com sucesso.",
          });
        }
      }
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader 
        title="WhatsApp Pipeline"
        description="Gestão de leads e conversas comerciais."
        action={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden h-[600px]">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-[300px] flex-shrink-0 bg-surface-soft/30 rounded-[18px] border border-border p-4 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 h-full min-h-[600px] flex-1">
          {STAGES.map(stage => {
            const stageLeads = leads.filter(l => l.stage === stage.id);
            
            return (
              <div key={stage.id} className="w-[320px] flex-shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2.5 py-1 rounded-[8px] text-[11px] font-semibold border", stage.color)}>
                      {stage.label}
                    </span>
                    <span className="text-[12px] font-medium text-text-muted">
                      {stageLeads.length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-[150px] p-1">
                  {stageLeads.map(lead => (
                    <Card key={lead.id} className="p-4 cursor-pointer hover:border-primary/30 relative group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-surface-soft text-text-secondary flex items-center justify-center font-semibold text-[11px] border border-border">
                            {lead.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-[13px] text-text-primary leading-tight">
                              {lead.name}
                            </div>
                            <div className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                              <Smartphone className="w-3 h-3" />
                              {lead.phone}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-surface-soft rounded-[8px] p-2.5 mb-3 border border-border/50">
                        <div className="flex items-start gap-2">
                          <MessageCircle className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                          <p className="text-[11px] text-text-secondary leading-tight line-clamp-2">
                            "{lead.lastMessage}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-text-muted font-medium">
                          <Clock className="w-3 h-3" />
                          {lead.time}
                        </div>
                        {lead.value && (
                          <div className="flex items-center gap-1 text-primary-dark font-medium">
                            <DollarSign className="w-3 h-3" />
                            {lead.value}
                          </div>
                        )}
                      </div>

                      {/* Simple quick move actions on hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface shadow-sm rounded-lg border border-border flex">
                        <select 
                          className="text-[10px] py-1 px-2 rounded-lg bg-transparent focus:outline-none cursor-pointer"
                          value={lead.stage}
                          onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {STAGES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                          <option value="lost">Perdido</option>
                        </select>
                      </div>
                    </Card>
                  ))}
                  
                  {stageLeads.length === 0 && (
                    <div className="h-[100px] rounded-[14px] border border-dashed border-border flex items-center justify-center text-[12px] text-text-muted">
                      Vazio
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
