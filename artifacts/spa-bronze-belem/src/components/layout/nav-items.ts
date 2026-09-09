import {
  BarChart3,
  Box,
  Calendar,
  LayoutDashboard,
  BrainCircuit,
  PieChart,
  Receipt,
  Users,
  UserCog,
} from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: Calendar },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/whatsapp', label: 'Agente IA', icon: BrainCircuit },
  { href: '/servicos', label: 'Orçamentos', icon: Receipt },
  { href: '/financeiro', label: 'Financeiro', icon: PieChart },
  { href: '/estoque', label: 'Estoque', icon: Box },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
];