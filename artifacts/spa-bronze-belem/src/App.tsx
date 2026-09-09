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
import { WhatsApp } from '@/pages/whatsapp';
import { Servicos } from '@/pages/servicos';
import { Financeiro } from '@/pages/financeiro';
import { Estoque } from '@/pages/estoque';
import { Relatorios } from '@/pages/relatorios';

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
          <Route path="/whatsapp" component={WhatsApp} />
          <Route path="/servicos" component={Servicos} />
          <Route path="/financeiro" component={Financeiro} />
          <Route path="/estoque" component={Estoque} />
          <Route path="/relatorios" component={Relatorios} />
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
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
