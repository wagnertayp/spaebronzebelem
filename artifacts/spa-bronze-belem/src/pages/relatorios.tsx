import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Relatorios() {
  return (
    <div className="space-y-8 max-w-[1200px] mx-auto h-full flex flex-col">
      <PageHeader 
        title="Relatórios"
        description="Análises avançadas e exportações."
      />

      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 bg-surface-soft rounded-full flex items-center justify-center mb-6">
          <BarChart3 className="w-10 h-10 text-text-muted" strokeWidth={1.5} />
        </div>
        
        <h2 className="text-[20px] font-semibold text-text-primary mb-2">
          Central de Relatórios em Breve
        </h2>
        <p className="text-[14px] text-text-secondary text-center max-w-[400px] mb-8">
          Tenha visão total do seu negócio com relatórios detalhados de faturamento, ocupação e conversão.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-[600px]">
          <Card className="bg-surface-soft border-dashed">
            <div className="p-6 flex flex-col items-center text-center">
              <TrendingUp className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-[14px] font-semibold text-text-primary mb-1">Performance Comercial</h3>
              <p className="text-[12px] text-text-secondary">Conversões do WhatsApp e tráfego pago.</p>
            </div>
          </Card>
          
          <Card className="bg-surface-soft border-dashed">
            <div className="p-6 flex flex-col items-center text-center">
              <PieChart className="w-6 h-6 text-primary mb-3" />
              <h3 className="text-[14px] font-semibold text-text-primary mb-1">Curva ABC</h3>
              <p className="text-[12px] text-text-secondary">Serviços e produtos mais rentáveis.</p>
            </div>
          </Card>
        </div>

        <Button variant="outline" className="mt-8">
          Notificar quando lançar
        </Button>
      </div>
    </div>
  );
}
