import { Link, useLocation } from 'wouter';
import { LogOut, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { navItems } from './nav-items';
import { useAuth } from '@/hooks/use-auth';

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();
  const { logout } = useAuth();

  return (
    <aside className={cn("flex flex-col bg-surface border-r border-border h-[100dvh] sticky top-0 transition-all z-20", className)}>
      <div className="flex flex-col h-full">
        <div className="px-8 pt-10 pb-8 flex items-center justify-between">
          <Link href="/" className="block transition-opacity hover:opacity-80 outline-none focus-visible:ring-2 ring-primary/50 rounded-lg">
            <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[52px] w-auto object-contain" />
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-4 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  "group relative flex min-h-[46px] items-center gap-3.5 rounded-xl border px-4 py-2 text-[14px] outline-none transition-all duration-200",
                  isActive 
                    ? "border-primary/15 bg-primary-soft/55 text-primary-dark font-semibold"
                    : "border-transparent text-text-secondary font-medium hover:bg-surface-soft hover:text-text-primary"
                )}
              >
                <Icon 
                  className={cn(
                    "w-[19px] h-[19px] shrink-0 transition-colors", 
                    isActive ? "text-primary" : "text-text-muted group-hover:text-text-primary"
                  )} 
                  strokeWidth={isActive ? 2 : 1.7} 
                />
                <span className="flex-1">{item.label}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:border-border shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[14px] shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-text-primary truncate leading-tight">{administrator}</p>
              <p className="text-[12px] text-text-secondary truncate mt-0.5 font-medium group-hover:text-primary transition-colors">Ajustes</p>
            </div>
            <Settings className="w-5 h-5 text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300" />
            <button onClick={() => void logout()} aria-label="Sair" className="rounded-lg p-2 text-text-muted hover:bg-surface-soft hover:text-error"><LogOut className="h-5 w-5" /></button>
          </div>
        </div>
      </div>
    </aside>
  );
}