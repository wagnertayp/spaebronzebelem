import { useListServices } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Clock, Tag } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function Servicos() {
  const { data: services = [], isLoading } = useListServices();

  // Group services by category
  const grouped = services.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, typeof services>);

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      <PageHeader 
        title="Catálogo de Serviços"
        description="Gerencie os procedimentos e valores do Spa."
        action={
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo serviço
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-8">
          <div className="h-6 w-32 bg-surface-soft rounded animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-surface-soft rounded-[18px] animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-[18px] font-semibold text-text-primary mb-4 flex items-center gap-2">
                {category}
                <span className="text-[12px] font-medium text-text-muted bg-surface-soft px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(service => (
                  <Card key={service.id} className="relative overflow-hidden group hover:border-primary/30 cursor-pointer">
                    <div 
                      className="absolute top-0 left-0 w-1 h-full"
                      style={{ backgroundColor: service.accent || 'var(--color-primary)' }}
                    />
                    <div className="p-5 pl-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-[14px] text-text-primary leading-tight max-w-[80%]">
                          {service.name}
                        </h3>
                      </div>
                      
                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                        <div className="flex items-center gap-1.5 text-[12px] text-text-secondary font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {service.duration}
                        </div>
                        <div className="text-[14px] font-semibold text-primary-dark">
                          {service.price}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
