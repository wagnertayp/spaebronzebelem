import { 
  useListClients, 
  useCreateClient, 
  useUpdateClient, 
  useDeleteClient, 
  getListClientsQueryKey,
  Client,
  ClientInputStatus
} from '@workspace/api-client-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Search, Filter, MoreHorizontal, MessageCircle, Edit, Trash, Eye, Phone, Mail, Calendar, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const ClientFormContent = ({ defaultValues = {} }: { defaultValues?: Partial<Client> }) => (
  <div className="space-y-4 py-2">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Nome *</label>
        <input required name="name" defaultValue={defaultValues.name} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Telefone</label>
        <input name="phone" defaultValue={defaultValues.phone} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Email</label>
        <input type="email" name="email" defaultValue={defaultValues.email} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Serviço Principal</label>
        <input name="service" defaultValue={defaultValues.service} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Origem</label>
        <input name="source" defaultValue={defaultValues.source} placeholder="Ex: Instagram, Indicação..." className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-text-primary">Status</label>
        <select name="status" defaultValue={defaultValues.status || 'new'} className="w-full h-10 px-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all cursor-pointer">
          <option value="new">Novo</option>
          <option value="active">Ativo</option>
          <option value="at_risk">Em Risco</option>
        </select>
      </div>
    </div>
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-text-primary">Observações</label>
      <textarea name="notes" defaultValue={defaultValues.notes} rows={3} className="w-full p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm transition-all resize-none" />
    </div>
  </div>
);

export function Clientes() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: clients = [], isLoading } = useListClients({ search });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const filteredClients = clients.filter(c => statusFilter === 'all' || c.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <span className="px-2 py-1 rounded-md bg-[#E7EEE4] text-[#596653] text-[11px] font-medium border border-[#7D8B78]/20">Ativo</span>;
      case 'at_risk': return <span className="px-2 py-1 rounded-md bg-[#F4E5E3] text-[#9B5B56] text-[11px] font-medium border border-[#B96E68]/20">Em risco</span>;
      case 'new': return <span className="px-2 py-1 rounded-md bg-[rgba(200,169,130,0.16)] text-[#8A6B3F] text-[11px] font-medium border border-[#C8A982]/20">Novo</span>;
      default: return <span className="px-2 py-1 rounded-md bg-surface-soft text-text-secondary text-[11px] font-medium border border-border">Indefinido</span>;
    }
  };

  const handleOpenWhatsApp = (phone: string, name: string) => {
    if (!phone) {
      toast({ title: 'Aviso', description: 'Cliente sem número de telefone.', variant: 'default' });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const number = cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;
    const text = `Olá ${name}, tudo bem? Aqui é do Spa e Bronze Belém.`;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createClient.mutate(
      {
        data: {
          name: fd.get('name') as string,
          phone: fd.get('phone') as string,
          email: fd.get('email') as string,
          notes: fd.get('notes') as string,
          service: fd.get('service') as string,
          status: fd.get('status') as ClientInputStatus,
          source: fd.get('source') as string,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setIsNewOpen(false);
          toast({ title: 'Sucesso', description: 'Cliente criado com sucesso.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível criar o cliente.', variant: 'destructive' })
      }
    );
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingClient) return;
    const fd = new FormData(e.currentTarget);
    updateClient.mutate(
      {
        id: editingClient.id,
        data: {
          name: fd.get('name') as string,
          phone: fd.get('phone') as string,
          email: fd.get('email') as string,
          notes: fd.get('notes') as string,
          service: fd.get('service') as string,
          status: fd.get('status') as ClientInputStatus,
          source: fd.get('source') as string,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setEditingClient(null);
          toast({ title: 'Sucesso', description: 'Cliente atualizado com sucesso.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Não foi possível atualizar o cliente.', variant: 'destructive' })
      }
    );
  };

  const handleDelete = () => {
    if (!deletingClient) return;
    deleteClient.mutate(
      { id: deletingClient.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setDeletingClient(null);
          toast({ title: 'Sucesso', description: 'Cliente excluído.' });
        },
        onError: () => toast({ title: 'Erro', description: 'Erro ao excluir.', variant: 'destructive' })
      }
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <PageHeader 
        title="Clientes"
        description="Gestão completa de clientes e atendimentos."
        action={
          <Button className="gap-2" onClick={() => setIsNewOpen(true)}>
            <Plus className="w-4 h-4" />
            Novo cliente
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface p-4 rounded-2xl border border-border shadow-sm">
        <div className="relative w-full sm:w-[320px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar clientes..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-background border border-border text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="appearance-none w-full sm:w-auto h-10 pl-9 pr-8 rounded-xl bg-background border border-border text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="new">Novos</option>
              <option value="at_risk">Em risco</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-surface-soft/50">
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Cliente</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Status</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Serviço Principal</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Última Visita</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted">Origem</th>
                <th className="px-6 py-4 text-[12px] font-medium text-text-muted text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-10 w-48 bg-surface-soft animate-pulse rounded-lg"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 bg-surface-soft animate-pulse rounded-md"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-24 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-20 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-5 w-16 bg-surface-soft animate-pulse rounded"></div></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="group hover:bg-surface-soft/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-soft text-primary-dark flex items-center justify-center font-medium text-[13px] shrink-0">
                          {client.initials}
                        </div>
                        <div>
                          <div className="font-medium text-[14px] text-text-primary cursor-pointer hover:underline" onClick={() => setViewingClient(client)}>
                            {client.name}
                          </div>
                          {client.phone && <div className="text-[12px] text-text-muted mt-0.5">{client.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(client.status)}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-secondary">
                      {client.service || '-'}
                    </td>
                    <td className="px-6 py-4 text-[13px] text-text-secondary">
                      {client.lastVisit || 'Não informada'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[12px] text-text-muted bg-background px-2 py-1 rounded-md border border-border">
                        {client.source || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-soft rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setViewingClient(client)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenWhatsApp(client.phone, client.name)}>
                            <MessageCircle className="w-4 h-4 mr-2" />
                            WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditingClient(client)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeletingClient(client)} className="text-red-600 focus:text-red-600">
                            <Trash className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-text-muted">
                      <Search className="w-8 h-8 mb-4 opacity-20" />
                      <p className="text-[14px] font-medium text-text-primary">Nenhum cliente encontrado</p>
                      <p className="text-[13px] mt-1">Tente ajustar seus termos de busca ou filtros.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Client Dialog */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
            <DialogDescription>Adicione um novo cliente ao sistema.</DialogDescription>
          </DialogHeader>
          <form id="new-client-form" onSubmit={handleCreate}>
            <ClientFormContent />
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsNewOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createClient.isPending}>
                {createClient.isPending ? 'Salvando...' : 'Salvar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(o) => !o && setEditingClient(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Atualize os dados de {editingClient?.name}.</DialogDescription>
          </DialogHeader>
          {editingClient && (
            <form id="edit-client-form" onSubmit={handleUpdate}>
              <ClientFormContent defaultValues={editingClient} />
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
                <Button type="submit" disabled={updateClient.isPending}>
                  {updateClient.isPending ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Client Dialog */}
      <Dialog open={!!viewingClient} onOpenChange={(o) => !o && setViewingClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Perfil do Cliente</DialogTitle>
          </DialogHeader>
          {viewingClient && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 border-b border-border pb-5 mt-2">
                <div className="w-16 h-16 rounded-full bg-primary-soft text-primary-dark flex items-center justify-center font-bold text-2xl shrink-0">
                  {viewingClient.initials}
                </div>
                <div>
                  <h3 className="font-semibold text-xl leading-tight">{viewingClient.name}</h3>
                  <div className="mt-2">{getStatusBadge(viewingClient.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-[13px]">
                <div className="space-y-1">
                  <span className="text-text-muted flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> Telefone</span>
                  <p className="font-medium">{viewingClient.phone || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-text-muted flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email</span>
                  <p className="font-medium break-all">{viewingClient.email || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-text-muted flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Última Visita</span>
                  <p className="font-medium">{viewingClient.lastVisit || '-'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-text-muted flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5"/> Serviço Principal</span>
                  <p className="font-medium">{viewingClient.service || '-'}</p>
                </div>
              </div>
              {viewingClient.notes && (
                <div className="space-y-1.5 text-[13px] bg-surface-soft p-3.5 rounded-xl border border-border">
                  <span className="text-text-muted font-medium flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5"/> Observações</span>
                  <p className="leading-relaxed text-text-primary whitespace-pre-wrap">{viewingClient.notes}</p>
                </div>
              )}
              <div className="pt-4 border-t border-border flex justify-end gap-2">
                <Button variant="outline" onClick={() => setViewingClient(null)}>Fechar</Button>
                <Button onClick={() => handleOpenWhatsApp(viewingClient.phone, viewingClient.name)} className="gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white border-transparent">
                  <MessageCircle className="w-4 h-4"/>
                  WhatsApp
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingClient} onOpenChange={(o) => !o && setDeletingClient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">Excluir Cliente</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja excluir <strong>{deletingClient?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletingClient(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteClient.isPending}>
              {deleteClient.isPending ? 'Excluindo...' : 'Excluir Definitivamente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
