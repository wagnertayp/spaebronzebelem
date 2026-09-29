import { type ReactNode, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { AppShell } from '@/components/layout/app-shell';
import { Dashboard } from '@/pages/dashboard';
import { Agenda } from '@/pages/agenda';
import { Clientes } from '@/pages/clientes';
import { Usuarios } from '@/pages/usuarios';
import { WhatsApp } from '@/pages/whatsapp';
import { Servicos } from '@/pages/servicos';
import { OrcamentoDetalhe } from '@/pages/orcamento-detalhe';
import { OrcamentoPublico } from '@/pages/orcamento-publico';
import { Financeiro } from '@/pages/financeiro';
import { Estoque } from '@/pages/estoque';
import { Relatorios } from '@/pages/relatorios';
import { Configuracoes } from '@/pages/configuracoes';
import { Arquivo } from '@/pages/arquivo';
import { Login } from '@/pages/login';
import { ChangePassword } from '@/pages/change-password';
import { AuthGuard, AuthProvider } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { user } = useAuth();
  const [location, navigate] = useLocation();
  const isStaff = user?.role === 'staff';
  const staffHome = user?.canAccessAgenda ? '/agenda' : user?.canAccessCommissions ? '/usuarios' : '/sem-acesso';
  const canAccessStaffPath = Boolean(
    user &&
      ((location === '/agenda' && user.canAccessAgenda) ||
        (location === '/usuarios' && user.canAccessCommissions) ||
        (location === '/sem-acesso' && !user.canAccessAgenda && !user.canAccessCommissions)),
  );

  useEffect(() => {
    if (isStaff && !canAccessStaffPath) navigate(staffHome, { replace: true });
  }, [isStaff, canAccessStaffPath, staffHome, navigate]);

  if (isStaff && !canAccessStaffPath) return null;

  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/">
            {isStaff ? null : <Dashboard />}
          </Route>
          <Route path="/agenda" component={Agenda} />
          <Route path="/clientes" component={Clientes} />
          <Route path="/usuarios" component={Usuarios} />
          <Route path="/whatsapp" component={WhatsApp} />
          
          <Route path="/servicos" component={Servicos} />
          
          <Route path="/orcamentos/:id" component={OrcamentoDetalhe} />
          
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/estoque" component={Estoque} />
          <Route path="/relatorios" component={Relatorios} />
          <Route path="/arquivo" component={Arquivo} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route path="/sem-acesso">
            <main className="mx-auto max-w-xl px-6 py-16 text-center">
              <h1 className="text-2xl font-bold text-text-primary">Nenhum acesso liberado</h1>
              <p className="mt-3 text-sm text-text-secondary">
                Peça ao administrador para habilitar Agenda ou Comissões para sua conta.
              </p>
            </main>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </AppShell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Switch>
          <Route path="/login"><Login /></Route>
          <Route path="/change-password">
            <AuthGuard><ChangePassword /></AuthGuard>
          </Route>
          <Route path="/proposta/:token">
            <RoutedErrorBoundary>
              <OrcamentoPublico />
            </RoutedErrorBoundary>
          </Route>
          <Route>
            <AuthGuard><Router /></AuthGuard>
          </Route>
        </Switch>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default function AuthenticatedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><App /></AuthProvider>
    </QueryClientProvider>
  );
}