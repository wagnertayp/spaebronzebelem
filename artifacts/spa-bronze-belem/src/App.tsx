import { type ReactNode } from 'react';
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
import { AuthGuard, AuthProvider } from '@/hooks/use-auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <AppShell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Switch>
            <Route path="/login"><Login /></Route>
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
    </QueryClientProvider>
  );
}

export default function AuthenticatedApp() {
  return <AuthProvider><App /></AuthProvider>;
}