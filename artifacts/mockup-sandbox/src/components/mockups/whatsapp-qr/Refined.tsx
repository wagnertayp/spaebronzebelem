import "./_group.css";
import { Bot, Check, Database, Loader2, MessageCircle, QrCode, XCircle } from "lucide-react";

type MetricCardProps = {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "primary";
};

function MetricCard({ icon: Icon, label, value, detail, tone }: MetricCardProps) {
  return (
    <article className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-[22px] border border-border/70 bg-surface p-5 shadow-[0_8px_28px_-24px_rgba(44,33,25,0.34)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_18px_40px_-28px_rgba(44,33,25,0.34)]">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/[0.045] blur-2xl transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-text-primary">{value}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset ${tone === "primary" ? "bg-primary/10 text-primary ring-primary/10" : "bg-surface-soft text-text-secondary ring-border/60"}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      </div>
      <div className="relative mt-5 flex items-center gap-2 border-t border-border/70 pt-3.5 text-xs font-medium text-text-muted">
        {tone === "primary" ? <Database className="h-3.5 w-3.5 text-primary" /> : <span className="h-2 w-2 rounded-full bg-text-muted/50" />}
        <span>{detail}</span>
      </div>
    </article>
  );
}

export function Refined() {
  return (
    <main className="min-h-screen bg-background p-4 font-sans text-text-primary sm:p-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          icon={Bot}
          label="Status do agente"
          value="Inativo"
          detail="Respostas automáticas pausadas"
          tone="neutral"
        />
        <MetricCard
          icon={Database}
          label="Base de conhecimento"
          value="18 serviços"
          detail="Conteúdo disponível para o agente"
          tone="primary"
        />

        <article className="relative overflow-hidden rounded-[22px] border border-primary/20 bg-gradient-to-br from-surface via-surface to-primary-soft/25 p-5 shadow-[0_10px_32px_-24px_rgba(44,33,25,0.38)] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_18px_42px_-28px_rgba(44,33,25,0.4)] md:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between xl:flex-col">
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">WhatsApp</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    Não conectado
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
                  Gere um QR Code para conectar o WhatsApp e acompanhar as conversas por aqui.
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[190px] sm:flex-row sm:flex-wrap xl:w-full xl:flex-col">
              <button
                type="button"
                data-testid="button-generate-whatsapp-qr"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_18px_-10px_rgba(74,53,37,0.72)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-[0_12px_22px_-10px_rgba(74,53,37,0.72)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 sm:w-auto sm:flex-1 xl:w-full xl:flex-none"
              >
                <QrCode className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                <span>Gerar QR Code</span>
              </button>
              <button
                type="button"
                data-testid="button-disconnect-whatsapp"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-surface/70 px-3.5 py-2.5 text-center text-xs font-semibold leading-snug text-text-secondary transition-all duration-200 hover:border-primary/35 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto sm:flex-1 xl:w-full xl:flex-none"
              >
                <XCircle className="h-4 w-4 shrink-0" />
                <span>Liberar instância e trocar número</span>
              </button>
            </div>
          </div>
          <div className="relative mt-4 flex items-start gap-2 border-t border-border/65 pt-3.5 text-xs leading-relaxed text-text-muted">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/75" />
            <span>A conexão atual é preservada até você confirmar a troca do número.</span>
          </div>
        </article>
      </section>
    </main>
  );
}