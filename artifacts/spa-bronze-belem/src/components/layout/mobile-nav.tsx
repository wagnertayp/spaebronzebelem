import { Menu, X, Settings, LogOut, KeyRound } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { navItems } from './nav-items';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { useAuth } from '@/hooks/use-auth';

export function MobileNav({ isOpen, onOpenChange, className }: { isOpen: boolean, onOpenChange: (open: boolean) => void, className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();
  const { user, logout } = useAuth();
  const visibleNavItems = user?.role === 'staff'
    ? navItems
        .filter((item) =>
          (item.href === '/agenda' && user.canAccessAgenda) ||
          (item.href === '/fila-atendimento' && user.canAccessAgenda) ||
          (item.href === '/usuarios' && user.canAccessCommissions),
        )
        .map((item) => item.href === '/usuarios' ? { ...item, label: 'Comissões' } : item)
    : navItems;
  const homeHref = user?.role === 'staff'
    ? user.canAccessAgenda ? '/agenda' : user.canAccessCommissions ? '/usuarios' : '/sem-acesso'
    : '/';
  const profileName = user?.role === 'staff' ? user.username : administrator;
  const profileInitials = user?.role === 'staff'
    ? user.username.slice(0, 2).toUpperCase()
    : initials;
  const profileHref = user?.role === 'staff' ? '/change-password' : '/configuracoes';

  return (
    <div className={cn("flex items-center justify-between h-[72px] px-4 border-b border-border/50 bg-surface/70 backdrop-blur-2xl shrink-0 sticky top-0 z-30", className)}>
      <div className="flex items-center gap-4">
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <Dialog.Trigger asChild>
            <button className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <Menu className="w-6 h-6" strokeWidth={2} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed top-0 left-0 bottom-0 w-[300px] bg-surface z-50 shadow-2xl flex flex-col focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300 ease-out">
              <div className="px-6 pt-8 pb-6 flex items-center justify-between">
                <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[46px] w-auto object-contain" />
                <Dialog.Close asChild>
                  <button className="p-2 -mr-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-soft transition-colors outline-none">
                    <X className="w-5 h-5" strokeWidth={2} />
                  </button>
                </Dialog.Close>
              </div>
              
              <div className="flex-1 overflow-y-auto px-4 space-y-1">
                {visibleNavItems.map((item) => {
                  const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "group relative flex min-h-[46px] items-center gap-3.5 rounded-lg px-4 py-2.5 text-[15px] outline-none transition-all duration-200 overflow-hidden",
                        isActive 
                          ? "bg-primary-soft/30 text-primary-dark font-semibold"
                          : "text-text-secondary font-medium hover:bg-surface-soft hover:text-text-primary"
                      )}
                    >
                      <Icon 
                        className={cn(
                          "w-[20px] h-[20px] shrink-0 transition-colors", 
                          isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary"
                        )} 
                        strokeWidth={isActive ? 2 : 1.7} 
                      />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
              
              <div className="p-4 mt-auto">
                <Link 
                  href={profileHref} 
                  onClick={() => onOpenChange(false)} 
                  className="flex items-center gap-3 group outline-none p-3 rounded-xl hover:bg-surface-soft transition-colors border border-transparent hover:border-border/40"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-soft text-primary-dark flex items-center justify-center font-bold text-[14px] shadow-sm shrink-0 border border-primary-soft/50">
                    {profileInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary truncate">{profileName}</p>
                    <p className="text-[12px] font-medium text-text-secondary mt-0.5 transition-colors group-hover:text-primary">
                      {user?.role === 'staff' ? 'Alterar senha' : 'Ajustes'}
                    </p>
                  </div>
                  {user?.role === 'staff'
                    ? <KeyRound className="w-4 h-4 text-text-muted shrink-0 opacity-50 group-hover:opacity-100 transition-all duration-300" />
                    : <Settings className="w-4 h-4 text-text-muted shrink-0 opacity-50 group-hover:opacity-100 transition-all duration-300" />}
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void logout();
                    }} 
                    aria-label="Sair" 
                    className="rounded-lg p-2 -mr-2 text-text-muted hover:bg-error/10 hover:text-error transition-colors outline-none focus-visible:ring-2 ring-error/50"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        
        <Link href={homeHref} className="ml-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md">
          <img src="/logo-clean.png" alt="Spa e Bronze" className="h-[36px] w-auto object-contain" />
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <Link 
          href={profileHref} 
          aria-label={user?.role === 'staff' ? 'Alterar senha' : 'Abrir configurações'} 
          className="w-10 h-10 rounded-lg bg-primary-soft text-primary-dark flex items-center justify-center font-bold text-[14px] shadow-sm hover:-translate-y-0.5 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-primary/50 border border-primary-soft/50"
        >
          {profileInitials}
        </Link>
      </div>
    </div>
  );
}
