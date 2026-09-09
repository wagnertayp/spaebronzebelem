import { useEffect, useState, type FormEvent } from 'react';
import { Save, Settings } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'spa-bronze-settings';

type SettingsData = {
  businessName: string;
  administrator: string;
  phone: string;
  address: string;
  defaultQuoteValidity: number;
};

const defaults: SettingsData = {
  businessName: 'Spa e Bronze Belém',
  administrator: 'Wagner',
  phone: '',
  address: 'Belém - PA',
  defaultQuoteValidity: 7,
};

export function Configuracoes() {
  const { toast } = useToast();
  const [data, setData] = useState<SettingsData>(defaults);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setData({ ...defaults, ...JSON.parse(saved) });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!data.businessName.trim() || !data.administrator.trim() || data.defaultQuoteValidity < 1) {
      toast({
        variant: 'destructive',
        title: 'Revise as configurações',
        description: 'Nome do negócio, administrador e validade devem ser preenchidos.',
      });
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('spa-settings-updated'));
    toast({
      title: 'Configurações salvas',
      description: 'As preferências deste dispositivo foram atualizadas.',
    });
  };

  return (
    <div className="space-y-6 max-w-[900px] mx-auto pb-10">
      <PageHeader
        title="Configurações"
        description="Dados gerais e preferências operacionais do sistema."
      />
      <Card className="p-6 md:p-8">
        <div className="flex items-center gap-3 pb-5 mb-6 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-dark" />
          </div>
          <div>
            <h2 className="font-semibold text-text-primary">Perfil do estabelecimento</h2>
            <p className="text-[13px] text-text-secondary">Estas preferências ficam salvas neste dispositivo.</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text-primary">Nome do negócio</span>
            <input required value={data.businessName} onChange={(e) => setData({ ...data, businessName: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[14px]" />
          </label>
          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text-primary">Administrador</span>
            <input required value={data.administrator} onChange={(e) => setData({ ...data, administrator: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[14px]" />
          </label>
          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text-primary">Telefone</span>
            <input value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[14px]" placeholder="(91) 99999-9999" />
          </label>
          <label className="space-y-2">
            <span className="text-[13px] font-medium text-text-primary">Validade padrão do orçamento</span>
            <input required min={1} type="number" value={data.defaultQuoteValidity} onChange={(e) => setData({ ...data, defaultQuoteValidity: Number(e.target.value) })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[14px]" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-[13px] font-medium text-text-primary">Endereço</span>
            <input value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-border bg-background text-[14px]" />
          </label>
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button type="submit" className="gap-2">
              <Save className="w-4 h-4" />
              Salvar configurações
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}