import { Link, useLocation } from 'wouter';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessSettings } from '@/hooks/use-business-settings';
import { navItems } from './nav-items';

export function Sidebar({ className }: { className?: string }) {
  const [location] = useLocation();
  const { administrator, initials } = useBusinessSettings();

  return (
    <aside className={cn("flex-col justify-between bg-surface h-[100dvh] sticky top-0", className)}>
      <div className="p-6">
        <Link href="/" className="block mb-8 px-2 transition-opacity hover:opacity-80">
          <img src="/logo-clean.png" alt="Spa e Bronze Belém" className="h-[46px] w-auto object-contain" />
        </Link>

        <div className="space-y-1">
          <div className="px-3 mb-3 text-[11px] font-semibold text-text-muted uppercase tracking-widest">
            Menu Principal
          </div>
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[13.5px] font-medium transition-all duration-200",
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
        <Link href="/configuracoes" className="flex items-center gap-3 px-3 py-2 rounded-[12px] hover:bg-surface-soft transition-colors">
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
    </aside>
  );
}
