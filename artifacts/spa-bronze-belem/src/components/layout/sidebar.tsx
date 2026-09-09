import { Link, useLocation } from 'wouter';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { navItems } from './nav-items';

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();

  return (
    <aside className={cn("flex flex-col bg-surface border-r border-border h-[100dvh] sticky top-0 transition-all z-20", className)}>
      <div className="flex flex-col h-full">
        <div className="px-8 pt-10 pb-8 flex items-center justify-between">
          <Link href="/" className="block transition-opacity hover:opacity-80 outline-none focus-visible:ring-2 ring-primary/50 rounded-lg">
            <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[40px] w-auto object-contain" />
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-4 space-y-1 mt-4">
          <div className="px-4 mb-4 text-[11px] font-extrabold uppercase tracking-widest text-text-muted">Menu Principal</div>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "group relative flex min-h-[48px] items-center gap-4 rounded-xl px-4 py-2 text-[14px] outline-none transition-all duration-300",
                  isActive 
                    ? "bg-primary-soft text-primary font-bold shadow-sm"
                    : "text-text-secondary font-semibold hover:bg-surface-soft hover:text-text-primary"
                )}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full" />}
                <Icon 
                  className={cn(
                    "w-[20px] h-[20px] shrink-0 transition-colors", 
                    isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary"
                  )} 
                  strokeWidth={isActive ? 2.5 : 2} 
                />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <Link 
            href="/configuracoes" 
            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-surface-soft transition-all outline-none focus-visible:ring-2 ring-primary/50 group border border-transparent hover:border-border cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[14px] shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-text-primary truncate leading-tight">{administrator}</p>
              <p className="text-[12px] text-text-secondary truncate mt-0.5 font-medium group-hover:text-primary transition-colors uppercase tracking-wide">Ajustes</p>
            </div>
            <Settings className="w-5 h-5 text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
          </Link>
        </div>
      </div>
    </aside>
  );
}