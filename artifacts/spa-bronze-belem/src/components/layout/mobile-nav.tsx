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
    <div className={cn("flex items-center justify-between h-[60px] px-4 border-b border-border/50 bg-surface/70 backdrop-blur-2xl shrink-0 sticky top-0 z-30", className)}>
      <div className="flex items-center gap-3">
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
          <Dialog.Trigger asChild>
            <button className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <Menu className="w-5 h-5" strokeWidth={2} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content className="fixed top-0 left-0 bottom-0 w-[280px] bg-surface/80 backdrop-blur-3xl z-50 shadow-2xl flex flex-col border-r border-border/50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300 ease-out">
              <div className="px-6 pt-8 pb-6 flex items-center justify-between">
                <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[32px] w-auto object-contain" />
                <Dialog.Close asChild>
                  <button className="p-2 -mr-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors outline-none">
                    <X className="w-5 h-5" strokeWidth={2} />
                  </button>
                </Dialog.Close>
              </div>
              
              <div className="flex-1 overflow-y-auto px-4 space-y-1">
                {navItems.map((item) => {
                  const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link 
                      key={item.href} 
                      href={item.href}
                      onClick={() => onOpenChange(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-lg text-[14px] transition-all duration-200 outline-none",
                        isActive 
                          ? "bg-primary/10 text-primary-dark font-semibold dark:bg-primary/20 dark:text-primary-soft shadow-sm"
                          : "text-text-secondary font-medium hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                      )}
                    >
                      <Icon 
                        className={cn(
                          "w-[18px] h-[18px] transition-colors", 
                          isActive ? "text-primary-dark dark:text-primary-soft" : "text-text-muted"
                        )} 
                        strokeWidth={isActive ? 2.5 : 2} 
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              
              <div className="p-4 mt-auto mb-4 mx-4 rounded-2xl bg-surface/60 border border-border/40 shadow-sm backdrop-blur-xl">
                <Link 
                  href="/configuracoes" 
                  onClick={() => onOpenChange(false)} 
                  className="flex items-center gap-3 group outline-none"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-dark dark:text-primary-soft font-semibold text-[14px] shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-text-primary truncate">{administrator}</p>
                    <p className="text-[12px] text-text-secondary truncate mt-0.5 transition-colors group-hover:text-text-primary">Ajustes da Conta</p>
                  </div>
                  <Settings className="w-[18px] h-[18px] text-text-muted shrink-0 opacity-40 group-hover:opacity-100 group-hover:rotate-90 transition-all duration-300" />
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        
        <Link href="/" className="ml-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md">
          <img src="/logo-clean.png" alt="Spa e Bronze" className="h-[24px] w-auto object-contain" />
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <Link 
          href="/configuracoes" 
          aria-label="Abrir configurações" 
          className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary-dark dark:text-primary-soft font-semibold text-[12px] shadow-sm hover:scale-105 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {initials}
        </Link>
      </div>
    </div>
  );
}