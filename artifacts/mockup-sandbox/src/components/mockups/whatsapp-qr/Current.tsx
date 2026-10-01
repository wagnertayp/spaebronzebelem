import "./_group.css";
import { Bot, Database, Loader2, MessageCircle, XCircle } from "lucide-react";

const cardBase =
  "rounded-2xl border border-border/50 bg-surface text-text-primary shadow-[0_10px_30px_-28px_rgba(44,33,25,0.2)] transition-all duration-300";
const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[14px] font-bold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] hover:-translate-y-[2px]";
const smallButton =
  "h-9 px-4 text-[13px]";

function CurrentCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${cardBase} ${className}`}>{children}</div>;
}

export function Current() {
  return (
    <main className="min-h-screen bg-background p-4 font-sans text-text-primary sm:p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CurrentCard className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-text-muted/10 text-text-muted">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1 text-[13px] font-medium uppercase tracking-wider text-text-muted">Status do Agente</div>
            <div className="text-lg font-semibold text-text-primary">Inativo</div>
          </div>
        </CurrentCard>

        <CurrentCard className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-1 text-[13px] font-medium uppercase tracking-wider text-text-muted">Base de Conhecimento</div>
            <div className="text-lg font-semibold text-text-primary">18 serviços</div>
          </div>
        </CurrentCard>

        <CurrentCard className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[13px] font-medium uppercase tracking-wider text-text-muted">WhatsApp</div>
            <div className="text-lg font-semibold text-text-primary">Não conectado</div>
            <div className="mb-3 truncate text-xs text-text-muted">Gere um QR Code para conectar o WhatsApp</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${buttonBase} ${smallButton} gap-2 bg-primary text-primary-foreground shadow-button hover:bg-primary-dark hover:shadow-lg`}>
                <MessageCircle className="h-4 w-4" />
                Gerar QR Code
              </button>
              <button type="button" className={`${buttonBase} ${smallButton} gap-2 border-2 border-border bg-transparent text-text-muted hover:border-primary/30 hover:bg-primary-soft hover:text-primary`}>
                <XCircle className="h-4 w-4" />
                Liberar instância e trocar número
              </button>
            </div>
          </div>
        </CurrentCard>
      </div>
    </main>
  );
}