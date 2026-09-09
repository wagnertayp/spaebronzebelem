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
            <Dialog.Content className="fixed top-0 left-0 bottom-0 w-[300px] bg-surface z-50 shadow-2xl flex flex-col border-r border-border focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300 ease-out">
              <div className="px-6 pt-10 pb-6 flex items-center justify-between">
                <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[36px] w-auto object-contain" />
                <Dialog.Close asChild>
                  <button className="p-2 -mr-2 text-text-secondary hover:text-text-primary rounded-full hover:bg-surface-soft transition-colors outline-none">
                    <X className="w-6 h-6" strokeWidth={2} />
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
                        "flex items-center gap-3.5 px-4 py-3.5 rounded-xl border text-[15px] transition-all duration-200 outline-none relative",
                        isActive 
                          ? "border-primary/15 bg-primary-soft/55 text-primary-dark font-semibold"
                          : "border-transparent text-text-secondary font-medium hover:text-text-primary hover:bg-surface-soft"
                      )}
                    >
                      <Icon 
                        className={cn(
                          "w-[20px] h-[20px] transition-colors", 
                          isActive ? "text-primary" : "text-text-muted"
                        )} 
                        strokeWidth={isActive ? 2 : 1.7} 
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
              
              <div className="p-4 mt-auto border-t border-border">
                <Link 
                  href="/configuracoes" 
                  onClick={() => onOpenChange(false)} 
                  className="flex items-center gap-3 group outline-none p-2 rounded-xl hover:bg-surface-soft transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[15px] shadow-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-text-primary truncate">{administrator}</p>
                    <p className="text-[12px] font-medium text-text-secondary mt-0.5 transition-colors group-hover:text-primary">Ajustes</p>
                  </div>
                  <Settings className="w-5 h-5 text-text-muted shrink-0 opacity-50 group-hover:opacity-100 transition-all duration-300" />
                </Link>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        
        <Link href="/" className="ml-1 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-md">
          <img src="/logo-clean.png" alt="Spa e Bronze" className="h-[28px] w-auto object-contain" />
        </Link>
      </div>
      
      <div className="flex items-center gap-3">
        <Link 
          href="/configuracoes" 
          aria-label="Abrir configurações" 
          className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[14px] shadow-button hover:-translate-y-0.5 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {initials}
        </Link>
      </div>
    </div>
  );
}