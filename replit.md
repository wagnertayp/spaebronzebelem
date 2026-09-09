# Spa e Bronze Belém

Sistema operacional do Spa e Bronze Belém para agenda, clientes, vendas, estoque e financeiro.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/spa-bronze-belem` — aplicação React/Vite.
- `artifacts/api-server/src/routes/spa.ts` — API e dados operacionais.
- `lib/api-spec/openapi.yaml` — contrato da API.
- `scripts/import-spa-backup.py` — normalização repetível dos backups XLSX.

## Architecture decisions

- A planilha chamada `Financeiro_SpaeBronze` contém produtos e estoque, não movimentações financeiras.
- Clientes e faturamento do Avec são cruzados por celular normalizado e, como alternativa, por nome normalizado.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- No desktop, usar menu lateral esquerdo.
- O aplicativo deve ocupar toda a tela, sem moldura flutuante externa.
- Usar o logotipo transparente e limpo, sem cápsula, fundo ou container visual.
- A aba anteriormente chamada Serviços deve funcionar como Orçamentos, com criação e exportação de propostas personalizadas em JPEG.
- Nenhum controle visível pode ser apenas decorativo: botões, filtros, menus e ações devem executar fluxos reais com validação e feedback.
- Na interface, apresentar os dados como operação normal do negócio; não usar rótulos técnicos como “importado”, “backup” ou “histórico”.
- Relatórios com registros datados devem permitir consulta e exportação por período sem inventar datas para dados que não as possuem.
- A área “Agente IA” centraliza personalidade, regras, horários, políticas e testes do atendimento automático.
- O Agente IA deve consultar a mesma tabela de serviços e preços usada nos orçamentos, sem inventar valores ou disponibilidade.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
