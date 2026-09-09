import { Router, type IRouter } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateClientBody,
  CreateClientResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  CreateLeadBody,
  CreateLeadResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  CreateServiceBody,
  CreateServiceResponse,
  DeleteAppointmentParams,
  DeleteClientParams,
  DeleteInventoryItemParams,
  DeleteQuoteParams,
  DeleteServiceParams,
  GetDashboardResponse,
  GetFinanceSummaryResponse,
  GetAiAgentConfigResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListClientsQueryParams,
  ListClientsResponse,
  ListInventoryQueryParams,
  ListInventoryResponse,
  ListLeadsResponse,
  ListQuotesResponse,
  ListServicesResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
  UpdateClientBody,
  UpdateClientParams,
  UpdateClientResponse,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
  UpdateQuoteBody,
  UpdateQuoteParams,
  UpdateQuoteResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
  UpdateAiAgentConfigBody,
  UpdateAiAgentConfigResponse,
  TestAiAgentBody,
  TestAiAgentResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import backup from "../data/spa-backup.json";

const router: IRouter = Router();

type AppointmentStatus =
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

type LeadStage =
  | "new"
  | "contacting"
  | "quote"
  | "scheduled"
  | "converted"
  | "lost";

type Appointment = {
  id: number;
  start: string;
  end: string;
  client: string;
  service: string;
  professional: string;
  room: string;
  status: AppointmentStatus;
  avatar: string;
};

type Lead = {
  id: number;
  name: string;
  initials: string;
  phone: string;
  source: string;
  service: string;
  stage: LeadStage;
  lastMessage: string;
  time: string;
  value: string;
};

const appointments: Appointment[] = [
  {
    id: 1,
    start: "09:00",
    end: "10:00",
    client: "Ana Martins",
    service: "Massagem Relaxante",
    professional: "Marina",
    room: "Sala 02",
    status: "in_progress",
    avatar: "AM",
  },
  {
    id: 2,
    start: "10:30",
    end: "11:20",
    client: "Mariana Costa",
    service: "Drenagem Linfática",
    professional: "Paula",
    room: "Sala 01",
    status: "confirmed",
    avatar: "MC",
  },
  {
    id: 3,
    start: "11:30",
    end: "12:45",
    client: "Juliana Alves",
    service: "Ritual Facial",
    professional: "Rosana",
    room: "Sala 03",
    status: "confirmed",
    avatar: "JA",
  },
  {
    id: 4,
    start: "14:00",
    end: "15:00",
    client: "Carlos Almeida",
    service: "Massagem Terapêutica",
    professional: "Wallace",
    room: "Sala 02",
    status: "confirmed",
    avatar: "CA",
  },
  {
    id: 5,
    start: "15:30",
    end: "16:10",
    client: "Beatriz Lima",
    service: "Bronzeamento em máquina",
    professional: "Paula",
    room: "Bronze 01",
    status: "confirmed",
    avatar: "BL",
  },
];

const clients = backup.clients.map((client) => ({
  id: client.id,
  name: client.name,
  initials: client.initials,
  lastVisit: client.lastVisit,
  service: client.service,
  status: client.status as "active" | "at_risk" | "new",
  source: client.source,
  phone: "",
  email: "",
  notes: "",
}));

const leads: Lead[] = [
  {
    id: 1,
    name: "Camila Rocha",
    initials: "CR",
    phone: "(91) 98814-2031",
    source: "Tráfego pago",
    service: "Bronzeamento a sol",
    stage: "new",
    lastMessage: "Queria saber os horários para sábado",
    time: "há 4 min",
    value: "R$ 140",
  },
  {
    id: 2,
    name: "Fernanda Melo",
    initials: "FM",
    phone: "(91) 98152-7720",
    source: "Instagram",
    service: "Estética facial",
    stage: "contacting",
    lastMessage: "Pode me explicar como funciona o protocolo?",
    time: "há 18 min",
    value: "R$ 280",
  },
  {
    id: 3,
    name: "Patrícia Gomes",
    initials: "PG",
    phone: "(91) 99220-4855",
    source: "Indicação",
    service: "Banho de lua",
    stage: "quote",
    lastMessage: "Recebi o orçamento, vou confirmar ainda hoje",
    time: "há 42 min",
    value: "R$ 190",
  },
  {
    id: 4,
    name: "Larissa Dias",
    initials: "LD",
    phone: "(91) 98750-1194",
    source: "Tráfego pago",
    service: "Massagem relaxante",
    stage: "scheduled",
    lastMessage: "Perfeito, estarei aí às 16h",
    time: "há 1 h",
    value: "R$ 180",
  },
  {
    id: 5,
    name: "Débora Nunes",
    initials: "DN",
    phone: "(91) 98009-6741",
    source: "Instagram",
    service: "Drenagem linfática",
    stage: "converted",
    lastMessage: "Pagamento realizado, obrigada!",
    time: "ontem",
    value: "R$ 480",
  },
];

type Quote = {
  id: number;
  number: string;
  createdAt: string;
  clientName: string;
  phone: string;
  validUntil: string;
  discount: number;
  notes: string;
  items: Array<{
    serviceId: number;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  total: number;
};

const quotes: Quote[] = [];

const services = [
  {
    id: 1,
    name: "Massagem Relaxante",
    category: "Massagens",
    duration: "60 min",
    price: "R$ 180",
    accent: "sage",
  },
  {
    id: 2,
    name: "Drenagem Linfática",
    category: "Corporal",
    duration: "50 min",
    price: "R$ 160",
    accent: "champagne",
  },
  {
    id: 3,
    name: "Ritual Facial",
    category: "Estética facial",
    duration: "75 min",
    price: "R$ 240",
    accent: "clay",
  },
  {
    id: 4,
    name: "Bronzeamento em máquina",
    category: "Bronze",
    duration: "40 min",
    price: "R$ 120",
    accent: "bronze",
  },
  {
    id: 5,
    name: "Banho de Lua",
    category: "Bronze",
    duration: "90 min",
    price: "R$ 190",
    accent: "sand",
  },
  {
    id: 6,
    name: "Estética Corporal Avançada",
    category: "Corporal",
    duration: "80 min",
    price: "R$ 320",
    accent: "olive",
  },
];

let aiAgentConfig: ReturnType<typeof GetAiAgentConfigResponse.parse> = {
  active: false,
  name: "Luna",
  tone: "acolhedor",
  greeting: "Olá! Sou a assistente virtual do Spa e Bronze Belém. Como posso ajudar?",
  objective: "Atender clientes, apresentar serviços e preços e orientar sobre agendamentos.",
  instructions: "Responda de forma clara, curta e cordial. Faça uma pergunta por vez.",
  businessHours: "Segunda a sábado, das 8h às 19h.",
  address: "Belém - PA",
  paymentMethods: "Pix, cartão de crédito, cartão de débito e dinheiro.",
  bookingRules: "Confirme serviço, data, horário e nome da cliente antes de encaminhar o agendamento.",
  policies: "Não prometa horários sem confirmação. Não ofereça diagnóstico médico.",
  humanHandoff: "Encaminhe para uma atendente quando houver reclamação, dúvida clínica, negociação especial ou solicitação fora das informações disponíveis.",
};

const inventory = backup.inventory.map((item) => ({ ...item }));

const getInitials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

const getInventoryStatus = (stock: number, minimumStock: number, nextExpiration: string) => {
  const [day, month, year] = nextExpiration.split("/").map(Number);
  const expiration = year && month && day ? new Date(year, month - 1, day) : null;
  if (expiration && expiration < new Date()) return "expired" as const;
  if (stock < 0) return "negative" as const;
  if (stock <= minimumStock) return "low" as const;
  return "ok" as const;
};

router.get("/dashboard", (_req, res) => {
  const data = GetDashboardResponse.parse({
    greeting: "Bom dia, Wagner",
    subtitle: "Acompanhe a operação do seu spa em um só lugar.",
    dateLabel: "Quarta-feira, 09 de setembro",
    metrics: [
      {
        label: "Faturamento total",
        value: backup.meta.totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        change: "Valor registrado",
        trend: "neutral",
      },
      {
        label: "Comandas",
        value: backup.meta.totalOrders.toLocaleString("pt-BR"),
        change: "Atendimentos realizados",
        trend: "neutral",
      },
      {
        label: "Clientes",
        value: backup.meta.clients.toLocaleString("pt-BR"),
        change: "Cadastros disponíveis",
        trend: "neutral",
      },
      {
        label: "Produtos",
        value: backup.meta.inventoryItems.toLocaleString("pt-BR"),
        change: "Itens cadastrados",
        trend: "neutral",
      },
    ],
    revenue: [{ label: "Total", value: backup.meta.totalRevenue }],
    serviceMix: [],
    currentAppointment: appointments.find(
      (appointment) => appointment.status === "in_progress",
    ),
  });
  res.json(data);
});

router.get("/appointments", (req, res) => {
  const { date } = ListAppointmentsQueryParams.parse(req.query);
  const today = new Date().toLocaleDateString("sv-SE");
  const filtered = date
    ? appointments.filter((appointment) => {
        if (/^\d{2}:\d{2}/.test(appointment.start)) return date === today;
        return appointment.start.slice(0, 10) === date;
      })
    : appointments;
  res.json(ListAppointmentsResponse.parse(filtered));
});

router.post("/appointments", (req, res) => {
  const input = CreateAppointmentBody.parse(req.body);
  const appointment: Appointment = {
    id: Math.max(...appointments.map((item) => item.id)) + 1,
    ...input,
    status: "confirmed",
    avatar: input.client
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  };
  appointments.push(appointment);
  res.status(201).json(CreateAppointmentResponse.parse(appointment));
});

router.patch("/appointments/:id", (req, res) => {
  const { id } = UpdateAppointmentParams.parse(req.params);
  const input = UpdateAppointmentBody.parse(req.body);
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) return void res.status(404).json({ error: "Agendamento não encontrado" });
  Object.assign(appointment, input, input.client ? { avatar: getInitials(input.client) } : {});
  res.json(UpdateAppointmentResponse.parse(appointment));
});

router.delete("/appointments/:id", (req, res) => {
  const { id } = DeleteAppointmentParams.parse(req.params);
  const index = appointments.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Agendamento não encontrado" });
  appointments.splice(index, 1);
  res.status(204).end();
});

router.get("/clients", (req, res) => {
  const { search } = ListClientsQueryParams.parse(req.query);
  const normalized = search?.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalized
    ? clients.filter((client) =>
        `${client.name} ${client.service} ${client.source}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : clients;
  res.json(ListClientsResponse.parse(filtered.slice(0, 100)));
});

router.post("/clients", (req, res) => {
  const input = CreateClientBody.parse(req.body);
  const id = clients.length ? Math.max(...clients.map((item) => item.id)) + 1 : 1;
  const client = { id, initials: getInitials(input.name), lastVisit: "", ...input };
  clients.unshift(client);
  res.status(201).json(CreateClientResponse.parse(client));
});

router.patch("/clients/:id", (req, res) => {
  const { id } = UpdateClientParams.parse(req.params);
  const input = UpdateClientBody.parse(req.body);
  const client = clients.find((item) => item.id === id);
  if (!client) return void res.status(404).json({ error: "Cliente não encontrado" });
  Object.assign(client, input, { initials: getInitials(input.name) });
  res.json(UpdateClientResponse.parse(client));
});

router.delete("/clients/:id", (req, res) => {
  const { id } = DeleteClientParams.parse(req.params);
  const index = clients.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Cliente não encontrado" });
  clients.splice(index, 1);
  res.status(204).end();
});

router.get("/leads", (_req, res) => {
  res.json(ListLeadsResponse.parse(leads));
});

router.post("/leads", (req, res) => {
  const input = CreateLeadBody.parse(req.body);
  const lead: Lead = {
    id: Math.max(...leads.map((item) => item.id)) + 1,
    ...input,
    initials: input.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
    stage: "new",
    lastMessage: "Novo contato adicionado pela recepção",
    time: "agora",
    value: "A definir",
  };
  leads.unshift(lead);
  res.status(201).json(CreateLeadResponse.parse(lead));
});

router.patch("/leads/:id", (req, res) => {
  const { id } = UpdateLeadParams.parse(req.params);
  const { stage } = UpdateLeadBody.parse(req.body);
  const lead = leads.find((item) => item.id === id);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }
  lead.stage = stage;
  lead.time = "agora";
  res.json(UpdateLeadResponse.parse(lead));
});

router.get("/services", (_req, res) => {
  res.json(ListServicesResponse.parse(services));
});

router.get("/ai-agent/config", (_req, res) => {
  res.json(GetAiAgentConfigResponse.parse(aiAgentConfig));
});

router.put("/ai-agent/config", (req, res) => {
  aiAgentConfig = UpdateAiAgentConfigBody.parse(req.body);
  res.json(UpdateAiAgentConfigResponse.parse(aiAgentConfig));
});

router.post("/ai-agent/test", async (req, res, next) => {
  try {
    const { message } = TestAiAgentBody.parse(req.body);
    const serviceTable = services
      .map((service) => `- ${service.name} | ${service.category} | ${service.duration} | ${service.price}`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `Você é ${aiAgentConfig.name}, agente de atendimento do Spa e Bronze Belém.
Tom: ${aiAgentConfig.tone}.
Objetivo: ${aiAgentConfig.objective}
Saudação: ${aiAgentConfig.greeting}
Instruções: ${aiAgentConfig.instructions}
Horários: ${aiAgentConfig.businessHours}
Endereço: ${aiAgentConfig.address}
Formas de pagamento: ${aiAgentConfig.paymentMethods}
Regras de agendamento: ${aiAgentConfig.bookingRules}
Políticas: ${aiAgentConfig.policies}
Quando chamar uma pessoa: ${aiAgentConfig.humanHandoff}

TABELA ATUAL DE SERVIÇOS E PREÇOS:
${serviceTable}

Regras obrigatórias:
- Responda em português do Brasil.
- Use somente os serviços, preços, durações e informações fornecidas acima.
- Nunca invente preço, promoção, disponibilidade ou política.
- Quando faltar informação, diga que vai encaminhar para uma atendente.
- Seja objetiva e acolhedora, sem textos longos.
- Responda em texto simples, sem Markdown, asteriscos ou títulos.`,
        },
        { role: "user", content: message },
      ],
    });
    const reply = response.choices[0]?.message?.content?.replace(/\*\*/g, "").trim()
      || "Não consegui responder agora. Vou encaminhar para uma atendente.";
    res.json(TestAiAgentResponse.parse({ reply }));
  } catch (error) {
    next(error);
  }
});

router.post("/services", (req, res) => {
  const input = CreateServiceBody.parse(req.body);
  const id = services.length ? Math.max(...services.map((item) => item.id)) + 1 : 1;
  const service = { id, ...input };
  services.push(service);
  res.status(201).json(CreateServiceResponse.parse(service));
});

router.patch("/services/:id", (req, res) => {
  const { id } = UpdateServiceParams.parse(req.params);
  const input = UpdateServiceBody.parse(req.body);
  const service = services.find((item) => item.id === id);
  if (!service) return void res.status(404).json({ error: "Serviço não encontrado" });
  Object.assign(service, input);
  res.json(UpdateServiceResponse.parse(service));
});

router.delete("/services/:id", (req, res) => {
  const { id } = DeleteServiceParams.parse(req.params);
  const index = services.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Serviço não encontrado" });
  services.splice(index, 1);
  res.status(204).end();
});

router.get("/quotes", (_req, res) => {
  res.json(ListQuotesResponse.parse(quotes));
});

router.post("/quotes", (req, res) => {
  const input = CreateQuoteBody.parse(req.body);
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const discount = Math.min(input.discount, subtotal);
  const id = quotes.length > 0 ? Math.max(...quotes.map((quote) => quote.id)) + 1 : 1;
  const quote: Quote = {
    ...input,
    id,
    number: `ORC-${String(id).padStart(4, "0")}`,
    createdAt: new Date().toISOString(),
    discount,
    subtotal,
    total: Math.max(0, subtotal - discount),
  };
  quotes.unshift(quote);
  res.status(201).json(CreateQuoteResponse.parse(quote));
});

router.patch("/quotes/:id", (req, res) => {
  const { id } = UpdateQuoteParams.parse(req.params);
  const input = UpdateQuoteBody.parse(req.body);
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  Object.assign(quote, input, {
    discount: Math.min(input.discount, subtotal),
    subtotal,
    total: Math.max(0, subtotal - input.discount),
  });
  res.json(UpdateQuoteResponse.parse(quote));
});

router.delete("/quotes/:id", (req, res) => {
  const { id } = DeleteQuoteParams.parse(req.params);
  const index = quotes.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Orçamento não encontrado" });
  quotes.splice(index, 1);
  res.status(204).end();
});

router.get("/finance/summary", (_req, res) => {
  res.json(
    GetFinanceSummaryResponse.parse({
      inflow: backup.meta.totalRevenue,
      outflow: 0,
      net: backup.meta.totalRevenue,
      openAccounts: backup.meta.totalOrders,
      newClients: backup.clients.filter((client) => client.orders === 1).length,
      returningClients: backup.clients.filter((client) => client.orders > 1).length,
    }),
  );
});

router.get("/inventory", (req, res) => {
  const { search } = ListInventoryQueryParams.parse(req.query);
  const normalized = search?.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalized
    ? inventory.filter((item) =>
        `${item.name} ${item.brand} ${item.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : inventory;
  res.json(ListInventoryResponse.parse(filtered));
});

router.post("/inventory", (req, res) => {
  const input = CreateInventoryItemBody.parse(req.body);
  const id = inventory.length ? Math.max(...inventory.map((item) => item.id)) + 1 : 1;
  const item = { id, ...input, status: getInventoryStatus(input.stock, input.minimumStock, input.nextExpiration) };
  inventory.unshift(item);
  res.status(201).json(CreateInventoryItemResponse.parse(item));
});

router.patch("/inventory/:id", (req, res) => {
  const { id } = UpdateInventoryItemParams.parse(req.params);
  const input = UpdateInventoryItemBody.parse(req.body);
  const item = inventory.find((entry) => entry.id === id);
  if (!item) return void res.status(404).json({ error: "Produto não encontrado" });
  Object.assign(item, input, { status: getInventoryStatus(input.stock, input.minimumStock, input.nextExpiration) });
  res.json(UpdateInventoryItemResponse.parse(item));
});

router.delete("/inventory/:id", (req, res) => {
  const { id } = DeleteInventoryItemParams.parse(req.params);
  const index = inventory.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Produto não encontrado" });
  inventory.splice(index, 1);
  res.status(204).end();
});

export default router;