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

        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 outline-none",
                  isActive 
                    ? "bg-primary/10 text-primary-dark font-semibold dark:bg-primary/20 dark:text-primary-soft shadow-sm"
                    : "text-text-secondary font-medium hover:text-text-primary hover:bg-black/[0.04] dark:hover:bg-white/[0.04] focus-visible:bg-black/5 dark:focus-visible:bg-white/5"
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