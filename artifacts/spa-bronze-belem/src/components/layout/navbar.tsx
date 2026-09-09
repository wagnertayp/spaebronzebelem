import { Link, useLocation } from 'wouter';
import { Calendar, LayoutDashboard, Users, MessageSquare, Sparkles, PieChart, Box, BarChart3, Bell, Settings, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { href: '/servicos', label: 'Serviços', icon: Sparkles },
  { href: '/financeiro', label: 'Financeiro', icon: PieChart },
  { href: '/estoque', label: 'Estoque', icon: Box },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
];

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="h-[72px] px-6 flex items-center justify-between border-b border-border bg-surface shrink-0">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center">
          <div className="h-8 w-auto px-4 py-1.5 rounded-lg bg-dark flex items-center justify-center">
            <img src="/logo.png" alt="Spa e Bronze Belém" className="h-6 w-auto object-contain" />
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-1 p-1 bg-surface-soft rounded-[16px] border border-border">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== '/' && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 h-[38px] rounded-[12px] text-[13px] font-medium transition-all duration-200",
                  isActive 
                    ? "bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                <Icon className="w-[14px] h-[14px]" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="w-10 h-10 rounded-[14px] flex items-center justify-center text-text-secondary hover:bg-surface-soft hover:text-text-primary transition-colors">
          <Bell className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <button className="w-10 h-10 rounded-[14px] flex items-center justify-center text-text-secondary hover:bg-surface-soft hover:text-text-primary transition-colors">
          <Settings className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <div className="w-[1px] h-6 bg-border mx-2" />
        <button className="h-10 px-3 rounded-[14px] flex items-center gap-2 hover:bg-surface-soft transition-colors border border-transparent hover:border-border">
          <div className="w-7 h-7 rounded-full bg-primary-soft flex items-center justify-center text-primary-dark font-medium text-[11px]">
            W
          </div>
          <span className="text-[13px] font-medium text-text-primary hidden lg:block">
            Wagner
          </span>
        </button>
      </div>
    </nav>
  );
}
