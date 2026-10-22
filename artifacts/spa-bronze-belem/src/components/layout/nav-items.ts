import {
  BarChart3,
  Archive,
  Box,
  Calendar,
  ClipboardList,
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
  { href: '/fila-atendimento', label: 'Fila de atendimento', icon: ClipboardList },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/whatsapp', label: 'Agente IA', icon: BrainCircuit },
  { href: '/servicos', label: 'Orçamentos', icon: Receipt },
  { href: '/financeiro', label: 'Financeiro', icon: PieChart },
  { href: '/estoque', label: 'Estoque', icon: Box },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/arquivo', label: 'Arquivo', icon: Archive },
  { href: '/usuarios', label: 'Usuários', icon: UserCog },
];