import { Menu, X, Settings } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { navItems } from './nav-items';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { useBusinessSettings } from '@/hooks/use-business-settings';

export function MobileNav({ isOpen, onOpenChange, className }: { isOpen: boolean, onOpenChange: (open: boolean) => void, className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();

  return (
    <div className={cn("flex items-center justify-between h-[64px] px-4 border-b border-border bg-surface shrink-0 sticky top-0 z-30", className)}>
      <div className="flex items-center gap-3">
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <Dialog.Trigger asChild>
            <button className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-md transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity" />
            <Dialog.Content className="fixed top-0 left-0 bottom-0 w-[280px] bg-surface z-50 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300 focus:outline-none">
              <div className="p-5 flex items-center justify-between border-b border-border">
                <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-8 w-auto object-contain" />
                <Dialog.Close asChild>
                  <button className="p-2 -mr-2 text-text-secondary hover:text-text-primary rounded-md transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="p-4 flex-1 overflow-y-auto">
                <div className="space-y-1">
                  <div className="px-3 mb-3 mt-2 text-[11px] font-semibold text-text-muted uppercase tracking-widest">
                    Menu Principal
                  </div>
                  {navItems.map((item) => {
                    const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link 
                        key={item.href} 
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-3 rounded-[12px] text-[14px] font-medium transition-colors",
                          isActive 
                            ? "bg-primary-soft text-primary-dark"
                            : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                        )}
                      >
                        <Icon className={cn("w-[18px] h-[18px]", isActive ? "text-primary-dark" : "text-text-muted")} strokeWidth={2} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="p-6 border-t border-border mt-auto">
                <Link href="/configuracoes" onClick={() => onOpenChange(false)} className="flex items-center gap-3 px-3 py-2 rounded-[12px] hover:bg-surface-soft transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary-soft flex items-center justify-center text-primary-dark font-semibold text-[13px] shrink-0">
                     {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[13px] font-semibold text-text-primary truncate">{administrator}</p>
                    <p className="text-[11px] text-text-muted truncate">Administrador</p>
                  </div>
                  <Settings className="w-[18px] h-[18px] text-text-muted shrink-0" />
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        
        <Link href="/">
          <img src="/logo-clean.png" alt="Spa e Bronze" className="h-7 w-auto object-contain" />
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <Link href="/configuracoes" aria-label="Abrir configurações" className="w-8 h-8 rounded-full bg-primary-soft flex items-center justify-center text-primary-dark font-medium text-[12px]">
          {initials}
        </Link>
      </div>
    </div>
  );
}
