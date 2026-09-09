import { Link, useLocation } from 'wouter';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { navItems } from './nav-items';

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();

  return (
    <aside className={cn("flex-col justify-between bg-surface/70 backdrop-blur-2xl h-[100dvh] sticky top-0", className)}>
      <div className="flex flex-col h-full">
        <div className="px-6 pt-8 pb-6">
          <Link href="/" className="block px-1 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-lg">
            <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[40px] w-auto object-contain" />
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 space-y-1.5">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                  isActive 
                    ? "bg-primary text-white font-bold shadow-button"
                    : "text-text-secondary font-medium hover:bg-primary-soft/70 hover:text-primary-dark hover:translate-x-0.5"
                )}
              >
                {isActive && <span className="absolute -left-1 h-6 w-1 rounded-full bg-white/90" aria-hidden="true" />}
                <span className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all",
                  isActive ? "bg-white/16 text-white" : "bg-primary-soft/55 text-text-muted group-hover:bg-surface group-hover:text-primary"
                )}>
                <Icon 
                  className={cn(
                    "w-[17px] h-[17px] transition-colors", 
                    isActive ? "text-white" : "text-current"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <Link 
            href="/configuracoes" 
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50 group"
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary-dark dark:text-primary-soft font-semibold text-[12px] shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-text-primary truncate">{administrator}</p>
              <p className="text-[11px] text-text-secondary truncate mt-0.5 transition-colors group-hover:text-text-primary">Ajustes da Conta</p>
            </div>
            <Settings className="w-[16px] h-[16px] text-text-muted shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </Link>
        </div>
      </div>
    </aside>
  );
}