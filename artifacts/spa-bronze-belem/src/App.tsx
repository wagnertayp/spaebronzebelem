import { type ReactNode, lazy, Suspense, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { AppShell } from '@/components/layout/app-shell';
import { AuthGuard, AuthProvider } from '@/hooks/use-auth';
import { useAuth } from '@/hooks/use-auth';

const NotFound = lazy(() => import('@/pages/not-found'));
const Dashboard = lazy(() => import('@/pages/dashboard').then((module) => ({ default: module.Dashboard })));
const Agenda = lazy(() => import('@/pages/agenda').then((module) => ({ default: module.Agenda })));
const AtendimentoFila = lazy(() => import('@/pages/atendimento-fila').then((module) => ({ default: module.AtendimentoFila })));
const Clientes = lazy(() => import('@/pages/clientes').then((module) => ({ default: module.Clientes })));
const Usuarios = lazy(() => import('@/pages/usuarios').then((module) => ({ default: module.Usuarios })));
const WhatsApp = lazy(() => import('@/pages/whatsapp').then((module) => ({ default: module.WhatsApp })));
const Servicos = lazy(() => import('@/pages/servicos').then((module) => ({ default: module.Servicos })));
const OrcamentoDetalhe = lazy(() => import('@/pages/orcamento-detalhe').then((module) => ({ default: module.OrcamentoDetalhe })));
const OrcamentoPublico = lazy(() => import('@/pages/orcamento-publico').then((module) => ({ default: module.OrcamentoPublico })));
const Financeiro = lazy(() => import('@/pages/financeiro').then((module) => ({ default: module.Financeiro })));
const Estoque = lazy(() => import('@/pages/estoque').then((module) => ({ default: module.Estoque })));
const Relatorios = lazy(() => import('@/pages/relatorios').then((module) => ({ default: module.Relatorios })));
const Configuracoes = lazy(() => import('@/pages/configuracoes').then((module) => ({ default: module.Configuracoes })));
const Arquivo = lazy(() => import('@/pages/arquivo').then((module) => ({ default: module.Arquivo })));
const Login = lazy(() => import('@/pages/login').then((module) => ({ default: module.Login })));
const ChangePassword = lazy(() => import('@/pages/change-password').then((module) => ({ default: module.ChangePassword })));

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
        (location === '/fila-atendimento' && user.canAccessAgenda) ||
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
          <Route path="/fila-atendimento" component={AtendimentoFila} />
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
        <Suspense fallback={<PageLoading />}>
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
        </Suspense>
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

function PageLoading() {
  return (
    <main className="flex min-h-[50vh] items-center justify-center gap-3 text-sm font-medium text-text-secondary" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      Carregando página…
    </main>
  );
}

export default function AuthenticatedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider><App /></AuthProvider>
    </QueryClientProvider>
  );
}