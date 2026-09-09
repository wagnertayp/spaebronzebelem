import { Router, type IRouter } from "express";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateLeadBody,
  CreateLeadResponse,
  GetDashboardResponse,
  GetFinanceSummaryResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListClientsQueryParams,
  ListClientsResponse,
  ListLeadsResponse,
  ListServicesResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
} from "@workspace/api-zod";

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

const today = new Date().toISOString().slice(0, 10);

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

const clients = [
  {
    id: 1,
    name: "Ana Martins",
    initials: "AM",
    lastVisit: "Hoje, 09:00",
    service: "Massagem Relaxante",
    status: "active" as const,
    source: "Instagram",
  },
  {
    id: 2,
    name: "Mariana Costa",
    initials: "MC",
    lastVisit: "Ontem, 16:30",
    service: "Drenagem Linfática",
    status: "active" as const,
    source: "Indicação",
  },
  {
    id: 3,
    name: "Juliana Alves",
    initials: "JA",
    lastVisit: "06 set, 11:30",
    service: "Ritual Facial",
    status: "new" as const,
    source: "Tráfego pago",
  },
  {
    id: 4,
    name: "Carla Souza",
    initials: "CS",
    lastVisit: "03 ago, 14:00",
    service: "Banho de lua",
    status: "at_risk" as const,
    source: "WhatsApp",
  },
  {
    id: 5,
    name: "Renata Ribeiro",
    initials: "RR",
    lastVisit: "12 mar, 10:00",
    service: "Estética corporal",
    status: "at_risk" as const,
    source: "Orgânico",
  },
];

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

router.get("/dashboard", (_req, res) => {
  const data = GetDashboardResponse.parse({
    greeting: "Bom dia, Wagner",
    subtitle: "Acompanhe a operação do seu spa em um só lugar.",
    dateLabel: "Quarta-feira, 09 de setembro",
    metrics: [
      {
        label: "Faturamento",
        value: "R$ 28.450",
        change: "+12,4% este mês",
        trend: "up",
      },
      {
        label: "Agendamentos",
        value: "186",
        change: "+8,2% este mês",
        trend: "up",
      },
      {
        label: "Clientes ativos",
        value: "428",
        change: "+15 novos clientes",
        trend: "up",
      },
      {
        label: "Taxa de ocupação",
        value: "87%",
        change: "+4,5% esta semana",
        trend: "up",
      },
    ],
    revenue: [
      { label: "Seg", value: 3200 },
      { label: "Ter", value: 4100 },
      { label: "Qua", value: 3750 },
      { label: "Qui", value: 5200 },
      { label: "Sex", value: 4850 },
      { label: "Sáb", value: 6100 },
      { label: "Dom", value: 1250 },
    ],
    serviceMix: [
      { service: "Bronze", value: 34, color: "#C88952" },
      { service: "Massagens", value: 28, color: "#7D8B78" },
      { service: "Estética facial", value: 22, color: "#C8A982" },
      { service: "Corporal", value: 16, color: "#596653" },
    ],
    currentAppointment: appointments.find(
      (appointment) => appointment.status === "in_progress",
    ),
  });
  res.json(data);
});

router.get("/appointments", (req, res) => {
  ListAppointmentsQueryParams.parse(req.query);
  res.json(ListAppointmentsResponse.parse(appointments));
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
  res.json(ListClientsResponse.parse(filtered));
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

router.get("/finance/summary", (_req, res) => {
  res.json(
    GetFinanceSummaryResponse.parse({
      inflow: 28450,
      outflow: 9320,
      net: 19130,
      openAccounts: 2,
      newClients: 64,
      returningClients: 122,
    }),
  );
});

export default router;