import { 
  useListInventory, 
  useCreateInventoryItem, 
  useUpdateInventoryItem, 
  useDeleteInventoryItem,
  getListInventoryQueryKey 
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, MoreHorizontal, AlertTriangle, CheckCircle2, Edit2, PackagePlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function Estoque() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const { data: rawInventory = [], isLoading } = useListInventory({ search });
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [stockAdjustment, setStockAdjustment] = useState('');
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

  const categories = Array.from(new Set(rawInventory.map(item => item.category)));

  const inventory = rawInventory.filter(item => 
    categoryFilter === 'all' || item.category === categoryFilter
  );

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
        nextExpiration: item.nextExpiration || ''
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
      nextExpiration: formData.nextExpiration || ''
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
          toast.success('Produto criado com sucesso');
        },
        onError: () => toast.error('Erro ao criar produto')
      });
    }
  };

  const handleSaveStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    
    const newStock = Number(stockAdjustment);
    if (stockAdjustment === '' || isNaN(newStock) || !isFinite(newStock)) {
      toast.error('Saldo de estoque inválido');
      return;
    }

    updateItem.mutate({ id: editingItem.id, data: { ...editingItem, stock: newStock } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
        setIsAdjustStockOpen(false);
        toast.success('Estoque ajustado com sucesso');
      },
      onError: () => toast.error('Erro ao ajustar estoque')
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#E7EEE4] text-[#596653] text-[11px] font-medium border border-[#7D8B78]/20"><CheckCircle2 className="w-3 h-3" /> Normal</span>;
      case 'low': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(200,169,130,0.16)] text-[#8A6B3F] text-[11px] font-medium border border-[#C8A982]/20"><AlertTriangle className="w-3 h-3" /> Baixo</span>;
      case 'negative': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F4E5E3] text-[#9B5B56] text-[11px] font-medium border border-[#B96E68]/20"><AlertTriangle className="w-3 h-3" /> Faltando</span>;
      case 'expired': return <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#F4E5E3] text-[#9B5B56] text-[11px] font-medium border border-[#B96E68]/20"><AlertTriangle className="w-3 h-3" /> Vencido</span>;
      default: return <span className="px-2 py-1 rounded-md bg-surface-soft text-text-secondary text-[11px] font-medium border border-border">Indefinido</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Estoque"
        description="Gestão de produtos, insumos e revenda."
        action={
          <Button className="gap-2" onClick={() => handleOpenForm()}>
            <Plus className="w-4 h-4" />
            Novo produto
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative w-full sm:w-[320px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar produtos..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-background border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2 text-text-muted" />
              <SelectValue placeholder="Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-border bg-surface-soft/50">
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Produto</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Categoria</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Status</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted text-right">Estoque</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted text-right">Preço</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Validade</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-10 w-48 bg-surface-soft animate-pulse rounded-lg"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-24 bg-surface-soft animate-pulse rounded-md"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-5 w-12 bg-surface-soft animate-pulse rounded ml-auto"></div></td>
                    <td className="px-6 py-4 text-right"><div className="h-5 w-16 bg-surface-soft animate-pulse rounded ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : inventory.length > 0 ? (
                inventory.map((item) => (
                  <tr key={item.id} className="group hover:bg-surface-soft/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-[14px] text-text-primary mb-0.5">{item.name}</div>
                        <div className="text-[12px] text-text-secondary">{item.brand}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[12px] text-text-secondary bg-background px-2 py-1 rounded-md border border-border">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={cn(
                          "text-[14px] font-semibold",
                          item.stock <= item.minimumStock ? (item.stock === 0 ? "text-[#B96E68]" : "text-[#C49B5B]") : "text-text-primary"
                        )}>
                          {item.stock}
                        </span>
                        <span className="text-[11px] text-text-muted">Min: {item.minimumStock}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-[13px] font-medium text-text-primary">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[13px]",
                        item.status === 'expired' ? "text-[#B96E68] font-medium" : "text-text-secondary"
                      )}>
                        {item.nextExpiration || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenForm(item)}>
                            <Edit2 className="w-4 h-4 mr-2" /> Editar Produto
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingItem(item); setStockAdjustment(item.stock.toString()); setIsAdjustStockOpen(true); }}>
                            <PackagePlus className="w-4 h-4 mr-2" /> Ajustar Estoque
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditingItem(item); setIsDeleteOpen(true); }} className="text-error focus:text-error">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <Search className="w-8 h-8 mb-4 opacity-20" />
                      <p className="text-[14px] font-medium text-text-primary">Nenhum produto encontrado</p>
                      <p className="text-[13px] mt-1">Tente ajustar seus termos de busca.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSaveForm}>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className={formErrors.name ? 'text-error' : ''}>Nome do produto</Label>
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
                <Input id="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={formErrors.category ? 'border-error' : ''} />
                {formErrors.category && <span className="text-[11px] text-error font-medium">{formErrors.category}</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className={formErrors.price ? 'text-error' : ''}>Preço (R$)</Label>
                  <Input id="price" type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className={formErrors.price ? 'border-error' : ''} />
                  {formErrors.price && <span className="text-[11px] text-error font-medium">{formErrors.price}</span>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextExpiration" className={formErrors.nextExpiration ? 'text-error' : ''}>Validade</Label>
                  <Input id="nextExpiration" type="date" value={formData.nextExpiration} onChange={e => setFormData({...formData, nextExpiration: e.target.value})} className={formErrors.nextExpiration ? 'border-error' : ''} />
                  {formErrors.nextExpiration && <span className="text-[11px] text-error font-medium">{formErrors.nextExpiration}</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stock" className={formErrors.stock ? 'text-error' : ''}>Estoque Atual</Label>
                  <Input id="stock" type="number" step="any" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className={formErrors.stock ? 'border-error' : ''} />
                  {formErrors.stock && <span className="text-[11px] text-error font-medium">{formErrors.stock}</span>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumStock" className={formErrors.minimumStock ? 'text-error' : ''}>Estoque Mínimo</Label>
                  <Input id="minimumStock" type="number" step="any" value={formData.minimumStock} onChange={e => setFormData({...formData, minimumStock: e.target.value})} className={formErrors.minimumStock ? 'border-error' : ''} />
                  {formErrors.minimumStock && <span className="text-[11px] text-error font-medium">{formErrors.minimumStock}</span>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createItem.isPending || updateItem.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent className="max-w-xs">
          <form onSubmit={handleSaveStock}>
            <DialogHeader>
              <DialogTitle>Ajustar Estoque</DialogTitle>
              <DialogDescription>
                {editingItem?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adjustStock">Novo Saldo</Label>
                <Input 
                  id="adjustStock" 
                  type="number" 
                  step="any"
                  value={stockAdjustment} 
                  onChange={e => setStockAdjustment(e.target.value)} 
                  autoFocus 
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdjustStockOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateItem.isPending}>
                Atualizar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o produto <strong>{editingItem?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
