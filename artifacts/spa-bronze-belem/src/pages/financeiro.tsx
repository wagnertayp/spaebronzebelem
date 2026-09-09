import { useGetFinanceSummary } from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Wallet, Users, Receipt, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function Financeiro() {
  const { data: summary, isLoading } = useGetFinanceSummary();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto">
      <PageHeader 
        title="Financeiro"
        description="Acompanhamento de caixa e recorrência de clientes."
        action={
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        }
      />

      {isLoading || !summary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-32 bg-surface-soft rounded-[18px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-[16px] font-semibold text-text-primary mb-4">Fluxo de Caixa</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-surface relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-success" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[13px] font-medium text-text-secondary">Entradas</span>
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-success" />
                    </div>
                  </div>
                  <div className="text-[28px] font-semibold tracking-[-0.04em] text-text-primary">
                    {formatCurrency(summary.inflow)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-surface relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-error" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[13px] font-medium text-text-secondary">Saídas</span>
                    <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4 text-error" />
                    </div>
                  </div>
                  <div className="text-[28px] font-semibold tracking-[-0.04em] text-text-primary">
                    {formatCurrency(summary.outflow)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-dark border-none text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-accent" />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[13px] font-medium text-primary-soft">Saldo Líquido</span>
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-accent" />
                    </div>
                  </div>
                  <div className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                    {formatCurrency(summary.net)}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-primary-soft flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-primary-dark" />
                  </div>
                </div>
                <span className="text-[13px] font-medium text-text-secondary block mb-1">
                  Comandas Abertas
                </span>
                <div className="text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                  {summary.openAccounts}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-[rgba(200,169,130,0.15)] flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-[#8A6B3F]" />
                  </div>
                </div>
                <span className="text-[13px] font-medium text-text-secondary block mb-1">
                  Novos Clientes (Mês)
                </span>
                <div className="text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                  {summary.newClients}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-[12px] bg-[#E7EEE4] flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#596653]" />
                  </div>
                </div>
                <span className="text-[13px] font-medium text-text-secondary block mb-1">
                  Clientes Recorrentes (Mês)
                </span>
                <div className="text-[24px] font-semibold tracking-[-0.03em] text-text-primary">
                  {summary.returningClients}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
