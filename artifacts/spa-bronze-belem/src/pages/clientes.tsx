import { useListClients } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, Calendar } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

export function Clientes() {
  const [search, setSearch] = useState('');
  const { data: clients = [], isLoading } = useListClients({ search });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-0.5 rounded-full bg-[#E7EEE4] text-[#596653] text-[10px] font-medium border border-[#7D8B78]/20">Ativo</span>;
      case 'at_risk':
        return <span className="px-2 py-0.5 rounded-full bg-[#F4E5E3] text-[#9B5B56] text-[10px] font-medium border border-[#B96E68]/20">Em risco</span>;
      case 'new':
        return <span className="px-2 py-0.5 rounded-full bg-[rgba(200,169,130,0.16)] text-[#8A6B3F] text-[10px] font-medium border border-[#C8A982]/20">Novo</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full bg-surface-soft text-text-secondary text-[10px] font-medium border border-border">Indefinido</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <PageHeader 
        title="Clientes"
        description="Gestão unificada de perfis e histórico."
        action={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo cliente
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="relative w-full sm:w-[320px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar por nome, telefone ou CPF..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-[12px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4" />
            Filtros
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Card key={i} className="h-[120px] animate-pulse bg-surface-soft" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <Card key={client.id} className="group hover:border-primary/30 cursor-pointer overflow-hidden relative">
              <div className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary-soft text-primary-dark flex items-center justify-center font-semibold text-[13px] shrink-0 border border-primary/10">
                  {client.initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-[14px] text-text-primary truncate">
                      {client.name}
                    </h3>
                    {getStatusBadge(client.status)}
                  </div>
                  
                  <p className="text-[12px] text-text-secondary truncate mb-3">
                    {client.service}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-medium">
                      <Calendar className="w-3 h-3" />
                      Última visita: {new Date(client.lastVisit).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </div>
                    
                    <span className="text-[10px] text-text-muted bg-surface-soft px-1.5 py-0.5 rounded-[4px]">
                      {client.source}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
          
          {clients.length === 0 && (
            <div className="col-span-full py-12 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-surface-soft flex items-center justify-center mb-3">
                <Search className="w-5 h-5 text-text-muted" />
              </div>
              <h3 className="text-[14px] font-semibold text-text-primary">Nenhum cliente encontrado</h3>
              <p className="text-[13px] text-text-secondary mt-1">Tente ajustar seus termos de busca.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
