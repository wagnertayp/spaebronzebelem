import { 
  useListInventory, 
  useCreateInventoryItem, 
  useUpdateInventoryItem, 
  useDeleteInventoryItem,
  getListInventoryQueryKey 
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { 
  Plus, Search, Filter, MoreVertical, 
  AlertTriangle, CheckCircle2, Edit2, 
  Trash2, ArrowDownToLine, ArrowUpFromLine, 
  ClipboardList, ShoppingCart, Clock
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

function FilterChip({ active, onClick, label, count, icon }: { active: boolean, onClick: () => void, label: string, count: number, icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold transition-all border",
        active 
          ? "bg-primary text-primary-foreground border-primary shadow-sm" 
          : "bg-surface text-text-secondary border-border hover:border-primary/30 hover:bg-surface-soft"
      )}
    >
      {icon}
      {label}
      <span className={cn(
        "px-1.5 py-0.5 rounded-full text-[11px] min-w-[20px] text-center font-bold ml-0.5",
        active ? "bg-white/20 text-white" : "bg-border text-text-muted"
      )}>
        {count}
      </span>
    </button>
  );
}

export function Estoque() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'replace' | 'buy' | 'expires_soon' | 'expired'>('all');
  
  const { data: rawInventory = [], isLoading } = useListInventory({ search });
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Movement Modal State
  const [movement, setMovement] = useState<{
    item: any;
    type: 'in' | 'out' | 'adjust';
  } | null>(null);
  const [movementAmount, setMovementAmount] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    price: '',
    minimumStock: '',
    stock: '',
    nextExpiration: ''
  });

  // Date Utilities
  const today = new Date();
  today.setHours(0,0,0,0);
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  const parseInventoryDate = (dateStr: string) => {
    if (!dateStr) return null;
    const value = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const parts = value.includes('/') ? value.split('/') : value.split('-');
    if (parts.length !== 3) return null;
    const [year, month, day] = value.includes('/')
      ? [Number(parts[2]), Number(parts[1]), Number(parts[0])]
      : [Number(parts[0]), Number(parts[1]), Number(parts[2])];
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const isExpiresSoon = (dateStr: string) => {
    const d = parseInventoryDate(dateStr);
    if (!d) return false;
    d.setHours(0,0,0,0);
    return d >= today && d <= in30Days;
  };

  const isExpired = (dateStr: string) => {
    const d = parseInventoryDate(dateStr);
    if (!d) return false;
    d.setHours(0,0,0,0);
    return d < today;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = parseInventoryDate(dateStr);
    if (!date) return dateStr;
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const ensureDateFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const date = parseInventoryDate(dateStr);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const toApiDateFormat = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return year && month && day ? `${day}/${month}/${year}` : dateStr;
  };

  // Filter Logic
  const categories = Array.from(new Set(rawInventory.map(item => item.category)));

  const filteredInventory = useMemo(() => {
    return rawInventory.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      
      switch (statusFilter) {
        case 'replace': return item.stock <= item.minimumStock;
        case 'buy': return item.stock < item.minimumStock;
        case 'expired': return isExpired(item.nextExpiration);
        case 'expires_soon': return isExpiresSoon(item.nextExpiration);
        default: return true;
      }
    });
  }, [rawInventory, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      totalItems: rawInventory.length,
      toReplace: rawInventory.filter(i => i.stock <= i.minimumStock).length,
      toBuy: rawInventory.filter(i => i.stock < i.minimumStock).length,
      expired: rawInventory.filter(i => isExpired(i.nextExpiration)).length,
      expiresSoon: rawInventory.filter(i => isExpiresSoon(i.nextExpiration)).length,
      estimatedValue: rawInventory.reduce((acc, i) => acc + (i.price * Math.max(i.stock, 0)), 0)
    };
  }, [rawInventory]);

  // Handlers
  const handleOpenForm = (item?: any) => {
    setFormErrors({});
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        brand: item.brand,
        category: item.category,
        price: item.price.toString(),
        minimumStock: item.minimumStock.toString(),
        stock: item.stock.toString(),
        nextExpiration: ensureDateFormat(item.nextExpiration) || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        brand: '',
        category: '',
        price: '',
        minimumStock: '',
        stock: '',
        nextExpiration: ''
      });
    }
    setIsFormOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Nome é obrigatório';
    if (!formData.brand.trim()) errors.brand = 'Marca é obrigatória';
    if (!formData.category.trim()) errors.category = 'Categoria é obrigatória';
    
    const price = Number(formData.price);
    if (formData.price === '' || isNaN(price) || !isFinite(price) || price < 0) errors.price = 'Preço inválido';
    
    const minStock = Number(formData.minimumStock);
    if (formData.minimumStock === '' || isNaN(minStock) || !isFinite(minStock) || minStock < 0) errors.minimumStock = 'Valor inválido';
    
    const stock = Number(formData.stock);
    if (formData.stock === '' || isNaN(stock) || !isFinite(stock)) errors.stock = 'Estoque inválido';
    
    if (formData.nextExpiration) {
      const date = new Date(formData.nextExpiration);
      if (isNaN(date.getTime())) errors.nextExpiration = 'Data inválida';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload = {
      name: formData.name.trim(),
      brand: formData.brand.trim(),
      category: formData.category.trim(),
      price: Number(formData.price),
      minimumStock: Number(formData.minimumStock),
      stock: Number(formData.stock),
      nextExpiration: toApiDateFormat(formData.nextExpiration)
    };

    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
          setIsFormOpen(false);
          toast.success('Produto atualizado com sucesso');
        },
        onError: () => toast.error('Erro ao atualizar produto')
      });
    } else {
      createItem.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
          setIsFormOpen(false);
          toast.success('Produto/insumo cadastrado com sucesso');
        },
        onError: () => toast.error('Erro ao cadastrar produto')
      });
    }
  };

  const getProjectedStock = () => {
    if (!movement) return 0;
    const current = movement.item.stock;
    const amount = parseInt(movementAmount) || 0;
    if (movement.type === 'in') return current + amount;
    if (movement.type === 'out') return current - amount;
    if (movement.type === 'adjust') return amount;
    return current;
  };

  const handleSaveMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movement) return;
    
    const amount = parseInt(movementAmount);
    if (isNaN(amount)) {
      toast.error('Quantidade inválida');
      return;
    }

    if (movement.type !== 'adjust' && amount <= 0) {
      toast.error('A quantidade deve ser maior que zero');
      return;
    }

    if (movement.type === 'adjust' && amount < 0) {
      toast.error('O saldo não pode ser negativo');
      return;
    }

    if (movement.type === 'out' && amount > movement.item.stock) {
      toast.error('O consumo não pode ser maior que o saldo atual');
      return;
    }

    const newStock = getProjectedStock();

    updateItem.mutate({ id: movement.item.id, data: { ...movement.item, stock: newStock } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        toast.success(`Estoque atualizado. Novo saldo: ${newStock}`);
        setMovement(null);
        setMovementAmount('');
      },
      onError: () => toast.error('Erro ao atualizar estoque')
    });
  };

  const handleDelete = () => {
    if (!editingItem) return;
    deleteItem.mutate({ id: editingItem.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        setIsDeleteOpen(false);
        toast.success('Produto removido com sucesso');
      },
      onError: () => toast.error('Erro ao remover produto')
    });
  };

  const getStatusBadges = (item: any) => {
    const badges = [];
    
    if (item.stock === 0) {
      badges.push(<span key="falta" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#9B5B56] bg-[#F4E5E3] border border-[#B96E68]/20"><AlertTriangle className="w-3 h-3" /> Esgotado</span>);
    } else if (item.stock <= item.minimumStock) {
      badges.push(<span key="baixo" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#8A6B3F] bg-[#C8A982]/10 border border-[#C8A982]/20"><AlertTriangle className="w-3 h-3" /> Baixo</span>);
    } else {
      badges.push(<span key="ok" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#596653] bg-[#E7EEE4] border border-[#7D8B78]/20"><CheckCircle2 className="w-3 h-3" /> Normal</span>);
    }

    if (item.nextExpiration) {
      if (isExpired(item.nextExpiration)) {
        badges.push(<span key="vencido" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#9B5B56] bg-[#F4E5E3] border border-[#B96E68]/20"><AlertTriangle className="w-3 h-3" /> Vencido</span>);
      } else if (isExpiresSoon(item.nextExpiration)) {
        badges.push(<span key="vence_breve" className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[#8A6B3F] bg-[#C8A982]/10 border border-[#C8A982]/20"><Clock className="w-3 h-3" /> Vence em 30d</span>);
      }
    }

    return <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">{badges}</div>;
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Estoque"
        description="Gestão de produtos, insumos e revenda."
        action={
          <Button className="gap-2" onClick={() => handleOpenForm()}>
            <Plus className="w-4 h-4" />
            Novo produto/insumo
          </Button>
        }
      />

      {/* Top Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">Total de Itens</span>
          <span className="text-2xl font-bold text-text-primary">{stats.totalItems}</span>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-[#8A6B3F] font-bold uppercase tracking-wider mb-1">Para Repor (Falta/Baixo)</span>
          <span className={cn("text-2xl font-bold", stats.toReplace > 0 ? "text-[#C49B5B]" : "text-text-primary")}>{stats.toReplace}</span>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-[#9B5B56] font-bold uppercase tracking-wider mb-1">Vencidos ou Próximos</span>
          <span className={cn("text-2xl font-bold", (stats.expired > 0 || stats.expiresSoon > 0) ? "text-[#B96E68]" : "text-text-primary")}>
            {stats.expired + stats.expiresSoon}
          </span>
        </div>
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-col justify-center">
          <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider mb-1">Valor em Estoque</span>
          <span className="text-xl font-bold text-text-primary mt-1">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.estimatedValue)}
          </span>
        </div>
      </div>

      {/* Controls & Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-[320px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input 
              type="text" 
              placeholder="Buscar produtos..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/30 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-surface shadow-sm">
                <Filter className="w-4 h-4 mr-2 text-text-muted" />
                <SelectValue placeholder="Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} label="Todos" count={stats.totalItems} />
          <FilterChip active={statusFilter === 'buy'} onClick={() => setStatusFilter('buy')} label="Lista de Compras" count={stats.toBuy} icon={<ShoppingCart className="w-3.5 h-3.5" />} />
          <FilterChip active={statusFilter === 'replace'} onClick={() => setStatusFilter('replace')} label="Alerta (Baixo)" count={stats.toReplace} />
          <FilterChip active={statusFilter === 'expires_soon'} onClick={() => setStatusFilter('expires_soon')} label="Vencem em 30d" count={stats.expiresSoon} icon={<Clock className="w-3.5 h-3.5" />} />
          <FilterChip active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')} label="Vencidos" count={stats.expired} icon={<AlertTriangle className="w-3.5 h-3.5" />} />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden 2xl:block bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1080px]">
            <thead>
              <tr className="border-b border-border bg-surface-soft/50">
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted">Produto/Insumo</th>
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted text-right">Estoque</th>
                {statusFilter === 'buy' && (
                  <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-[#C49B5B] text-right bg-[#C8A982]/10">Qtd. Compra</th>
                )}
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted text-right">Preço</th>
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted">Validade</th>
                <th className="px-6 py-4 text-[12px] font-bold uppercase tracking-wider text-text-muted text-right w-[310px]">Ações rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-10 w-48 bg-surface-soft animate-pulse rounded-lg"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-24 bg-surface-soft animate-pulse rounded-md"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-6 w-12 bg-surface-soft animate-pulse rounded ml-auto"></div></td>
                    {statusFilter === 'buy' && <td className="px-6 py-4 text-right"><div className="h-6 w-12 bg-[#C8A982]/20 animate-pulse rounded ml-auto"></div></td>}
                    <td className="px-6 py-4 text-right"><div className="h-6 w-16 bg-surface-soft animate-pulse rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-8 w-24 bg-surface-soft animate-pulse rounded-lg ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredInventory.length > 0 ? (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="group hover:bg-surface-soft/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-[14px] text-text-primary mb-0.5">{item.name}</div>
                        <div className="text-[12px] text-text-secondary">{item.brand} • <span className="bg-background px-1.5 py-0.5 rounded border border-border">{item.category}</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadges(item)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "text-[15px] font-bold",
                          item.stock <= item.minimumStock ? (item.stock === 0 ? "text-[#B96E68]" : "text-[#C49B5B]") : "text-text-primary"
                        )}>
                          {item.stock}
                        </span>
                        <span className="text-[11px] text-text-muted font-medium">Min: {item.minimumStock}</span>
                      </div>
                    </td>
                    {statusFilter === 'buy' && (
                      <td className="px-6 py-4 text-right bg-[#C8A982]/5">
                        <span className="text-[16px] font-bold text-[#C49B5B]">
                          +{Math.max(item.minimumStock - item.stock, 0)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <span className="text-[13px] font-semibold text-text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[13px] font-semibold",
                        isExpired(item.nextExpiration) ? "text-[#B96E68]" : 
                        isExpiresSoon(item.nextExpiration) ? "text-[#C49B5B]" : "text-text-secondary"
                      )}>
                        {formatDate(item.nextExpiration)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5 text-success hover:text-success hover:bg-success/10"
                          onClick={() => { setMovement({ item, type: 'in' }); setMovementAmount(''); }}
                          title="Registrar Reposição"
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          Entrada
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5 text-warning hover:text-warning hover:bg-warning/10"
                          onClick={() => { setMovement({ item, type: 'out' }); setMovementAmount(''); }}
                          title="Consumo em Atendimento"
                        >
                          <ArrowUpFromLine className="w-4 h-4" />
                          Consumo
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 px-2.5 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => { setMovement({ item, type: 'adjust' }); setMovementAmount(item.stock.toString()); }}
                          title="Conferência (Ajuste exato)"
                        >
                          <ClipboardList className="w-4 h-4" />
                          Conferir
                        </Button>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-muted hover:text-text-primary rounded-full ml-1">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenForm(item)}>
                              <Edit2 className="w-4 h-4 mr-2" /> Editar Produto/Insumo
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingItem(item); setIsDeleteOpen(true); }} className="text-error focus:text-error">
                              <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={statusFilter === 'buy' ? 7 : 6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <Search className="w-8 h-8 mb-4 opacity-20" />
                      <p className="text-[14px] font-bold text-text-primary">Nenhum produto encontrado</p>
                      <p className="text-[13px] mt-1 font-medium">Tente ajustar seus filtros ou termos de busca.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="grid grid-cols-1 2xl:hidden gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 border border-border shadow-sm animate-pulse h-40"></div>
          ))
        ) : filteredInventory.length > 0 ? (
          filteredInventory.map(item => (
            <div key={item.id} className="bg-surface border border-border rounded-xl p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-[15px] text-text-primary">{item.name}</div>
                  <div className="text-[13px] text-text-secondary">{item.brand} • {item.category}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenForm(item)}>
                      <Edit2 className="w-4 h-4 mr-2" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditingItem(item); setIsDeleteOpen(true); }} className="text-error focus:text-error">
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex flex-wrap gap-2 text-[12px]">
                {getStatusBadges(item)}
              </div>

              <div className="flex items-center justify-between mt-1 p-3 bg-surface-soft rounded-lg border border-border/50">
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Estoque Atual</span>
                  <span className={cn(
                    "text-[18px] font-bold",
                    item.stock <= item.minimumStock ? (item.stock === 0 ? "text-[#B96E68]" : "text-[#C49B5B]") : "text-text-primary"
                  )}>
                    {item.stock} <span className="text-[12px] font-medium text-text-muted">/ min {item.minimumStock}</span>
                  </span>
                </div>
                
                {statusFilter === 'buy' && item.stock < item.minimumStock ? (
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-[#C49B5B] font-bold uppercase tracking-wider">Comprar</span>
                    <span className="text-[18px] font-bold text-[#C49B5B]">
                      +{item.minimumStock - item.stock}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] text-text-muted font-bold uppercase tracking-wider">Validade</span>
                    <span className={cn(
                      "text-[14px] font-bold",
                      isExpired(item.nextExpiration) ? "text-[#B96E68]" : 
                      isExpiresSoon(item.nextExpiration) ? "text-[#C49B5B]" : "text-text-secondary"
                    )}>
                      {formatDate(item.nextExpiration)}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-1">
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-success hover:text-success hover:border-success/30 hover:bg-success/5" onClick={() => { setMovement({ item, type: 'in' }); setMovementAmount(''); }}>
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span className="text-[12px]">Repor</span>
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-warning hover:text-warning hover:border-warning/30 hover:bg-warning/5" onClick={() => { setMovement({ item, type: 'out' }); setMovementAmount(''); }}>
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span className="text-[12px]">Usar</span>
                </Button>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-primary hover:text-primary hover:border-primary/30 hover:bg-primary/5" onClick={() => { setMovement({ item, type: 'adjust' }); setMovementAmount(item.stock.toString()); }}>
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="text-[12px]">Ajustar</span>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-surface rounded-xl p-8 border border-border shadow-sm text-center flex flex-col items-center">
            <Search className="w-8 h-8 mb-4 opacity-20" />
            <p className="text-[14px] font-bold text-text-primary">Nenhum produto encontrado</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveForm}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Produto/Insumo' : 'Novo Produto/Insumo'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={formErrors.name ? 'text-error' : ''}>Nome</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={formErrors.name ? 'border-error' : ''} />
                  {formErrors.name && <span className="text-[11px] text-error font-medium">{formErrors.name}</span>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand" className={formErrors.brand ? 'text-error' : ''}>Marca</Label>
                  <Input id="brand" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className={formErrors.brand ? 'border-error' : ''} />
                  {formErrors.brand && <span className="text-[11px] text-error font-medium">{formErrors.brand}</span>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className={formErrors.category ? 'text-error' : ''}>Categoria</Label>
                <Input id="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={formErrors.category ? 'border-error' : ''} placeholder="Ex: Cabelo, Corporal, Revenda..." />
                {formErrors.category && <span className="text-[11px] text-error font-medium">{formErrors.category}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className={formErrors.price ? 'text-error' : ''}>Preço (R$)</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className={formErrors.price ? 'border-error' : ''} />
                  {formErrors.price && <span className="text-[11px] text-error font-medium">{formErrors.price}</span>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextExpiration" className={formErrors.nextExpiration ? 'text-error' : ''}>Data de Validade</Label>
                  <Input id="nextExpiration" type="date" value={formData.nextExpiration} onChange={e => setFormData({...formData, nextExpiration: e.target.value})} className={formErrors.nextExpiration ? 'border-error' : ''} />
                  {formErrors.nextExpiration && <span className="text-[11px] text-error font-medium">{formErrors.nextExpiration}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock" className={formErrors.stock ? 'text-error' : ''}>Estoque Atual</Label>
                  <Input id="stock" type="number" step="1" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className={formErrors.stock ? 'border-error' : ''} />
                  {formErrors.stock && <span className="text-[11px] text-error font-medium">{formErrors.stock}</span>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumStock" className={formErrors.minimumStock ? 'text-error' : ''}>Estoque Mínimo</Label>
                  <Input id="minimumStock" type="number" step="1" value={formData.minimumStock} onChange={e => setFormData({...formData, minimumStock: e.target.value})} className={formErrors.minimumStock ? 'border-error' : ''} />
                  {formErrors.minimumStock && <span className="text-[11px] text-error font-medium">{formErrors.minimumStock}</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                Salvar Produto
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement Modal */}
      <Dialog open={!!movement} onOpenChange={(open) => !open && setMovement(null)}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSaveMovement}>
            <DialogHeader>
              <DialogTitle>
                {movement?.type === 'in' ? 'Registrar Reposição' : 
                 movement?.type === 'out' ? 'Consumo em Atendimento' : 
                 'Conferência de Estoque'}
              </DialogTitle>
              <DialogDescription>
                {movement?.item?.name}
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4 space-y-5">
              <div className="flex justify-between items-center bg-surface-soft px-4 py-3 rounded-xl border border-border">
                <span className="text-[12px] text-text-secondary font-bold uppercase tracking-wider">Saldo Atual</span>
                <span className="font-bold text-[20px] text-text-primary">{movement?.item?.stock}</span>
              </div>

              <div className="space-y-3">
                <Label htmlFor="amount">
                  {movement?.type === 'adjust' ? 'Novo saldo exato (conferência)' : 'Quantidade (unidades)'}
                </Label>
                <Input 
                  id="amount" 
                  type="number" 
                  step="1"
                  min="0"
                  value={movementAmount} 
                  onChange={e => setMovementAmount(e.target.value)} 
                  className="text-lg font-bold h-12"
                  autoFocus 
                />
                {movement?.type !== 'adjust' && (
                  <div className="flex gap-2 mt-2">
                    {[1, 5, 10].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          const current = parseInt(movementAmount) || 0;
                          setMovementAmount((current + val).toString());
                        }}
                        className="flex-1 py-2 rounded-lg bg-surface-soft text-[13px] font-bold hover:bg-border transition-colors border border-border text-text-secondary hover:text-text-primary"
                      >
                        +{val}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview of the resulting stock */}
              {movementAmount && (
                <div className={cn(
                  "flex justify-between items-center px-4 py-3 rounded-xl border",
                  getProjectedStock() < 0 ? "border-error/30 bg-error/10" : "border-primary/20 bg-primary-soft/10"
                )}>
                  <span className={cn(
                    "text-[12px] font-bold uppercase tracking-wider",
                    getProjectedStock() < 0 ? "text-error" : "text-primary-dark"
                  )}>Saldo Final Previsto</span>
                  <span className={cn(
                    "font-bold text-[20px]",
                    getProjectedStock() < 0 ? "text-error" : "text-primary-dark"
                  )}>
                    {getProjectedStock()}
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMovement(null)}>Cancelar</Button>
              <Button type="submit" disabled={updateItem.isPending}>
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir Produto/Insumo</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{editingItem?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
