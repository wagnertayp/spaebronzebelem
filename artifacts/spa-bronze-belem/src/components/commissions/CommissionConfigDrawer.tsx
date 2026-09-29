import { useEffect, useState } from "react";
import { Professional, CommissionConfig, CommissionRule, useListServices, useGetProfessionalCommissionConfig, useUpdateProfessionalCommissionConfig, useListCommissionRules, useCreateCommissionRule, useUpdateCommissionRule, useManageArchivedRecords, getGetProfessionalCommissionConfigQueryKey, getListCommissionRulesQueryKey, getListArchivedRecordsQueryKey } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit2, Plus, X, Check } from "lucide-react";
import { useBulkArchiveSelection } from "@/hooks/use-bulk-archive-selection";
import { BulkArchiveToolbar } from "@/components/archive/bulk-archive-toolbar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professional: Professional | null;
}

export function CommissionConfigDrawer({ open, onOpenChange, professional }: Props) {
  if (!professional) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-full max-w-none sm:!w-[600px] sm:!max-w-[calc(100vw-2rem)] bg-surface border-border overflow-y-auto overflow-x-hidden p-0 sm:p-6">
        <SheetHeader className="mb-6 px-4 pr-12 pt-5 text-left sm:px-0 sm:pr-8 sm:pt-0">
          <SheetTitle className="text-xl">Configuração de comissão</SheetTitle>
          <SheetDescription className="text-text-secondary">
            Defina como a comissão de {professional.name} será calculada.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 px-4 pb-8 sm:px-0 sm:pb-0">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2 uppercase tracking-wide">
              Regra padrão
            </h3>
            <ConfigForm professional={professional} />
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-text-primary border-b border-border pb-2 uppercase tracking-wide">
              Regras por serviço
            </h3>
            <p className="text-xs text-text-secondary">
              Defina percentuais específicos para determinados serviços. A regra específica tem prioridade sobre a comissão padrão.
            </p>
            <RulesList professional={professional} />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConfigForm({ professional }: { professional: Professional }) {
  const { data: config, isLoading } = useGetProfessionalCommissionConfig(professional.id, {
    query: { enabled: !!professional.id, queryKey: getGetProfessionalCommissionConfigQueryKey(professional.id) }
  });
  const updateMutation = useUpdateProfessionalCommissionConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<CommissionConfig>>({
    commissionType: "percent",
    defaultValue: 20,
    calculationBase: "paid",
    discountInCalculation: false,
    cardFeeInCalculation: false,
    cancellationsGenerate: false,
    productsGenerate: false,
    productCommissionPercent: 5,
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    } else {
      // Fallback defaults based on professional commissionRate if no config yet
      setFormData(prev => ({ ...prev, defaultValue: professional.commissionRate }));
    }
  }, [config, professional.commissionRate]);

  const handleChange = (field: keyof CommissionConfig, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(
      { id: professional.id, data: formData as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfessionalCommissionConfigQueryKey(professional.id) });
          toast({ title: "Configuração padrão salva" });
        }
      }
    );
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-surface-soft rounded-lg" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Tipo de comissão</Label>
          <Select 
            value={formData.commissionType} 
            onValueChange={v => handleChange("commissionType", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentual</SelectItem>
              <SelectItem value="fixed">Valor fixo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">
            {formData.commissionType === "percent" ? "Percentual padrão (%)" : "Valor padrão (R$)"}
          </Label>
          <Input 
            type="number" 
            className="h-9"
            value={formData.defaultValue}
            onChange={e => handleChange("defaultValue", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Label className="text-xs font-medium">Base de cálculo:</Label>
        <div className="flex flex-col space-y-2">
          {[
            { value: "gross", label: "Valor bruto do serviço" },
            { value: "net", label: "Valor líquido após desconto" },
            { value: "paid", label: "Valor efetivamente recebido" }
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
              <input 
                type="radio" 
                name="calculationBase" 
                value={opt.value} 
                checked={formData.calculationBase === opt.value}
                onChange={() => handleChange("calculationBase", opt.value)}
                className="accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-text-secondary cursor-pointer" htmlFor="discountInCalculation">Desconto entra no cálculo</Label>
          <Switch id="discountInCalculation" checked={!!formData.discountInCalculation} onCheckedChange={v => handleChange("discountInCalculation", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-text-secondary cursor-pointer" htmlFor="cardFeeInCalculation">Taxa do cartão entra no cálculo</Label>
          <Switch id="cardFeeInCalculation" checked={!!formData.cardFeeInCalculation} onCheckedChange={v => handleChange("cardFeeInCalculation", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-text-secondary cursor-pointer" htmlFor="cancellationsGenerate">Cancelamentos geram comissão</Label>
          <Switch id="cancellationsGenerate" checked={!!formData.cancellationsGenerate} onCheckedChange={v => handleChange("cancellationsGenerate", v)} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal text-text-secondary cursor-pointer" htmlFor="productsGenerate">Produtos vendidos geram comissão</Label>
          <Switch id="productsGenerate" checked={!!formData.productsGenerate} onCheckedChange={v => handleChange("productsGenerate", v)} />
        </div>
        
        {formData.productsGenerate && (
          <div className="bg-surface-soft p-3 rounded-lg flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-sm font-medium">Comissão sobre produtos (%)</Label>
            <Input 
              type="number" 
                className="h-9 w-full bg-surface sm:w-24"
              value={formData.productCommissionPercent}
              onChange={e => handleChange("productCommissionPercent", Number(e.target.value))}
            />
          </div>
        )}
      </div>

      <div className="pt-2">
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full sm:w-auto">
          Salvar Regra Padrão
        </Button>
      </div>
    </div>
  );
}

function RulesList({ professional }: { professional: Professional }) {
  const { data: rules = [], isLoading } = useListCommissionRules(professional.id, {
    query: { enabled: !!professional.id, queryKey: getListCommissionRulesQueryKey(professional.id) }
  });
  const { data: services = [] } = useListServices();
  const [editingRule, setEditingRule] = useState<Partial<CommissionRule> | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateCommissionRule();
  const updateMutation = useUpdateCommissionRule();
  const archiveMutation = useManageArchivedRecords();
  const archiveSelection = useBulkArchiveSelection({
    records: rules.map((rule) => ({ entity: "commissionRule", id: String(rule.id) })),
    action: "archive",
  });

  const handleSaveRule = () => {
    if (!editingRule?.serviceId || editingRule.value == null) return;
    
    const serviceName = services.find(s => s.id === editingRule.serviceId)?.name || "Serviço";
    
    const payload = {
      serviceId: editingRule.serviceId,
      serviceName,
      type: editingRule.type || "percent",
      value: editingRule.value,
      active: editingRule.active ?? true,
    };

    if (editingRule.id) {
      updateMutation.mutate(
        { id: professional.id, ruleId: editingRule.id, data: payload as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCommissionRulesQueryKey(professional.id) });
            toast({ title: "Regra atualizada" });
            setEditingRule(null);
          }
        }
      );
    } else {
      createMutation.mutate(
        { id: professional.id, data: payload as any },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListCommissionRulesQueryKey(professional.id) });
            toast({ title: "Regra criada" });
            setEditingRule(null);
          }
        }
      );
    }
  };

  const handleDelete = (ruleId: number) => {
    if (!window.confirm("Arquivar regra? Ela poderá ser restaurada no Arquivo.")) return;
    archiveMutation.mutate(
      { data: { action: "archive", records: [{ entity: "commissionRule", id: String(ruleId) }] } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCommissionRulesQueryKey(professional.id) });
          queryClient.invalidateQueries({ queryKey: getListArchivedRecordsQueryKey() });
          toast({ title: "Regra arquivada", description: "A regra pode ser restaurada no Arquivo." });
        }
      }
    );
  };

  if (isLoading) return <div className="animate-pulse h-24 bg-surface-soft rounded-lg" />;

  return (
    <div className="space-y-4 pt-2">
      <BulkArchiveToolbar selection={archiveSelection} />
      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={archiveSelection.isSelected({ entity: "commissionRule", id: String(rule.id) })}
                  onChange={() => archiveSelection.toggleRecord({ entity: "commissionRule", id: String(rule.id) })}
                  aria-label={`Selecionar regra de ${rule.serviceName}`}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {rule.serviceName}
                  {!rule.active && <span className="text-[10px] bg-text-muted/10 text-text-muted px-1.5 py-0.5 rounded uppercase">Inativo</span>}
                </div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {rule.type === "percent" ? `${rule.value}%` : `R$ ${rule.value.toFixed(2)}`}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text-primary" onClick={() => setEditingRule(rule)}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-error hover:text-error hover:bg-error/10" onClick={() => handleDelete(rule.id)} title="Arquivar regra" aria-label="Arquivar regra">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-text-muted border border-dashed border-border rounded-lg">
          Nenhuma regra específica cadastrada.
        </div>
      )}

      {editingRule ? (
        <div className="p-4 bg-surface-soft rounded-lg space-y-4 border border-border relative">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-medium">{editingRule.id ? "Editar Regra" : "Nova Regra"}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full -mr-2 -mt-2" onClick={() => setEditingRule(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Serviço</Label>
            <Select 
              value={editingRule.serviceId?.toString()} 
              onValueChange={v => setEditingRule(prev => ({ ...prev, serviceId: Number(v) }))}
            >
              <SelectTrigger className="h-9 bg-surface">
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Tipo</Label>
              <Select 
                value={editingRule.type || "percent"} 
                onValueChange={v => setEditingRule(prev => ({ ...prev, type: v as any }))}
              >
                <SelectTrigger className="h-9 bg-surface">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual</SelectItem>
                  <SelectItem value="fixed">Valor fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor</Label>
              <Input 
                type="number" 
                className="h-9 bg-surface"
                value={editingRule.value || ""}
                onChange={e => setEditingRule(prev => ({ ...prev, value: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs cursor-pointer" htmlFor="rule-active">Regra ativa</Label>
            <Switch id="rule-active" checked={editingRule.active !== false} onCheckedChange={v => setEditingRule(prev => ({ ...prev, active: v }))} />
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSaveRule} disabled={!editingRule.serviceId || editingRule.value == null}>
              <Check className="h-4 w-4 mr-1.5" /> Salvar Regra
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="w-full text-sm border-dashed" onClick={() => setEditingRule({ active: true, type: "percent" })}>
          <Plus className="h-4 w-4 mr-2" /> Adicionar regra
        </Button>
      )}
    </div>
  );
}
