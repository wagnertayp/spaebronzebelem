import { useMemo, useState } from "react";
import { Professional, useListProfessionals, useGetCommissionsSummary, useUpdateProfessional, getListProfessionalsQueryKey } from "@workspace/api-client-react";
import { getCurrentMonthPeriod, formatCurrency } from "./utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, User, Edit, Settings2, FileText, Ban, CheckCircle2, TrendingUp, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { BulkArchiveToolbar } from "@/components/archive/bulk-archive-toolbar";
import { useBulkArchiveSelection } from "@/hooks/use-bulk-archive-selection";

interface ProfessionalsTabProps {
  onEdit: (prof: Professional) => void;
  onConfigCommission: (prof: Professional) => void;
  onViewCommissions: (prof: Professional) => void;
}

export function ProfessionalsTab({ onEdit, onConfigCommission, onViewCommissions }: ProfessionalsTabProps) {
  const { data: professionals = [], isLoading: isLoadingProfs } = useListProfessionals();
  const monthPeriod = useMemo(() => getCurrentMonthPeriod(), []);
  
  const { data: summary, isLoading: isLoadingSummary } = useGetCommissionsSummary({
    from: monthPeriod.from,
    to: monthPeriod.to,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateProfessional();
  const archiveSelection = useBulkArchiveSelection({
    action: "archive",
    records: professionals.map((professional) => ({
      entity: "professional" as const,
      id: String(professional.id),
    })),
  });

  const toggleActive = (prof: Professional) => {
    updateMutation.mutate({ id: prof.id, data: { ...prof, active: !prof.active } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProfessionalsQueryKey() });
        toast({ title: prof.active ? "Profissional desativado" : "Profissional ativado" });
      }
    });
  };

  const profStats = useMemo(() => {
    if (!summary?.items) return {};
    const stats: Record<number, { production: number; commission: number }> = {};
    summary.items.forEach(item => {
      const pId = item.professionalId;
      if (!stats[pId]) stats[pId] = { production: 0, commission: 0 };
      stats[pId].production += item.baseAmount || 0;
      stats[pId].commission += item.commissionAmount || 0;
    });
    return stats;
  }, [summary]);

  if (isLoadingProfs) {
    return <div className="h-64 bg-surface-soft animate-pulse rounded-xl" />;
  }

  const activeCount = professionals.filter(p => p.active).length;

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-text-secondary px-1">
        {activeCount} {activeCount === 1 ? "profissional ativo" : "profissionais ativos"}
      </div>
      <BulkArchiveToolbar selection={archiveSelection} />

      {/* Desktop Table */}
      <div className="hidden md:block bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface-soft/50 border-b border-border text-text-secondary">
              <th className="py-3 px-4 font-medium">PROFISSIONAL</th>
              <th className="py-3 px-4 font-medium">ESPECIALIDADE</th>
              <th className="py-3 px-4 font-medium text-right">COMISSÃO PADRÃO</th>
              <th className="py-3 px-4 font-medium text-right">PRODUÇÃO DO MÊS</th>
              <th className="py-3 px-4 font-medium text-right">COMISSÃO GERADA</th>
              <th className="py-3 px-4 font-medium text-center">STATUS</th>
              <th className="py-3 px-4 font-medium text-center w-16">AÇÕES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {professionals.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-text-muted">
                  Nenhum profissional cadastrado.
                </td>
              </tr>
            ) : professionals.map(prof => {
              const stats = profStats[prof.id] || { production: 0, commission: 0 };
              return (
                <tr key={prof.id} className="hover:bg-surface-soft/30 transition-colors group">
                   <td className="py-3 px-4">
                     <input
                       type="checkbox"
                       aria-label={`Selecionar profissional ${prof.name}`}
                       checked={archiveSelection.isSelected({ entity: "professional", id: String(prof.id) })}
                       onChange={() => archiveSelection.toggleRecord({ entity: "professional", id: String(prof.id) })}
                       className="mr-3 h-4 w-4 align-middle accent-primary"
                     />
                    <div className="font-semibold text-text-primary text-[14px]">{prof.name}</div>
                    <div className="text-text-muted text-[12px]">{prof.email || prof.phone}</div>
                  </td>
                  <td className="py-3 px-4 text-text-secondary">{prof.specialty || '-'}</td>
                  <td className="py-3 px-4 text-right font-medium text-text-primary">{prof.commissionRate}%</td>
                  <td className="py-3 px-4 text-right text-text-secondary">
                    {isLoadingSummary ? '...' : formatCurrency(stats.production)}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-primary-dark">
                    {isLoadingSummary ? '...' : formatCurrency(stats.commission)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded-[4px] text-[11px] font-bold uppercase inline-block",
                      prof.active ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"
                    )}>
                      {prof.active ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-surface border-border">
                        <DropdownMenuItem onClick={() => onEdit(prof)} className="gap-2 cursor-pointer">
                          <User className="h-4 w-4" /> Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(prof)} className="gap-2 cursor-pointer">
                          <Edit className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onConfigCommission(prof)} className="gap-2 cursor-pointer">
                          <Settings2 className="h-4 w-4" /> Configurar comissão
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewCommissions(prof)} className="gap-2 cursor-pointer">
                          <TrendingUp className="h-4 w-4" /> Ver produção
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewCommissions(prof)} className="gap-2 cursor-pointer">
                          <FileText className="h-4 w-4" /> Ver comissões
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleActive(prof)} className="gap-2 cursor-pointer">
                          {prof.active ? (
                            <><Ban className="h-4 w-4 text-error" /> <span className="text-error">Desativar</span></>
                          ) : (
                            <><CheckCircle2 className="h-4 w-4 text-success" /> <span className="text-success">Ativar</span></>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {professionals.length === 0 ? (
          <div className="py-12 text-center text-text-muted border border-border rounded-xl">
            Nenhum profissional cadastrado.
          </div>
        ) : professionals.map(prof => {
          const stats = profStats[prof.id] || { production: 0, commission: 0 };
          return (
            <Card key={prof.id} className="p-4 bg-surface border-border shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                 <div>
                   <input
                     type="checkbox"
                     aria-label={`Selecionar profissional ${prof.name}`}
                     checked={archiveSelection.isSelected({ entity: "professional", id: String(prof.id) })}
                     onChange={() => archiveSelection.toggleRecord({ entity: "professional", id: String(prof.id) })}
                     className="mr-2 h-4 w-4 align-middle accent-primary"
                   />
                  <h4 className="font-semibold text-text-primary text-[15px]">{prof.name}</h4>
                  <p className="text-[13px] text-text-secondary">{prof.specialty || 'Sem especialidade'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase",
                    prof.active ? "bg-success/10 text-success" : "bg-text-muted/10 text-text-muted"
                  )}>
                    {prof.active ? 'Ativo' : 'Inativo'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                        <MoreVertical className="h-4 w-4 text-text-muted" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-surface border-border">
                        <DropdownMenuItem onClick={() => onEdit(prof)} className="gap-2 cursor-pointer">
                          <User className="h-4 w-4" /> Ver perfil
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(prof)} className="gap-2 cursor-pointer">
                          <Edit className="h-4 w-4" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onConfigCommission(prof)} className="gap-2 cursor-pointer">
                          <Settings2 className="h-4 w-4" /> Configurar comissão
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onViewCommissions(prof)} className="gap-2 cursor-pointer">
                          <TrendingUp className="h-4 w-4" /> Ver produção
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewCommissions(prof)} className="gap-2 cursor-pointer">
                          <FileText className="h-4 w-4" /> Ver comissões
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleActive(prof)} className="gap-2 cursor-pointer">
                          {prof.active ? (
                            <><Ban className="h-4 w-4 text-error" /> <span className="text-error">Desativar</span></>
                          ) : (
                            <><CheckCircle2 className="h-4 w-4 text-success" /> <span className="text-success">Ativar</span></>
                          )}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-[13px] pt-3 border-t border-border">
                <div>
                  <span className="text-text-muted block text-[11px] mb-0.5">COMISSÃO PADRÃO</span>
                  <span className="font-medium text-text-primary">{prof.commissionRate}%</span>
                </div>
                <div>
                  <span className="text-text-muted block text-[11px] mb-0.5">COMISSÃO GERADA</span>
                  <span className="font-medium text-primary-dark">
                    {isLoadingSummary ? '...' : formatCurrency(stats.commission)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
