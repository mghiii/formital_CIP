export type CycleStatus = "Planifie" | "En cours" | "Termine" | "Bloque";
export type CycleResult = "Conforme" | "Non conforme" | "En attente";
export type AlertSeverity = "Critique" | "Warning" | "Info";

export type CipCycle = {
  id: string;
  date: string;
  startedAt?: string;
  endedAt?: string | null;
  plannedAt?: string;
  rawStatus?: string;
  operatorId?: string | null;
  priority?: string;
  instructions?: string;
  equipment: string;
  process: string;
  status: CycleStatus;
  result: CycleResult;
  operator: string;
  duration: number;
  targetDurationMinutes: number;
  temperature: number;
  water: number;
  soda: number;
  acid: number;
  detergent: number;
  visualAspect?: string;
  observation?: string;
};

export type Equipment = {
  id: string;
  processId?: string;
  name: string;
  line: string;
  status: "Disponible" | "En nettoyage" | "Nettoye" | "Non nettoye" | "Hors service";
  lastCycle: string;
  compliance: number;
};

export type Alert = {
  id: string;
  title: string;
  equipment: string;
  severity: AlertSeverity;
  status: "Active" | "Acquittee" | "Resolue";
  createdAt: string;
};

export const cycles: CipCycle[] = [
  {
    id: "CIP-2407-001",
    date: "10/07/2026 08:32",
    equipment: "Ligne Yaourt",
    process: "CIP complet",
    status: "Termine",
    result: "Conforme",
    operator: "Youssef E.",
    duration: 48,
    targetDurationMinutes: 45,
    temperature: 72,
    water: 3.4,
    soda: 3.1,
    acid: 2.1,
    detergent: 5.2
  },
  {
    id: "CIP-2407-002",
    date: "10/07/2026 06:15",
    equipment: "Citerne N02",
    process: "Lavage alcalin",
    status: "Termine",
    result: "Conforme",
    operator: "Karim D.",
    duration: 35,
    targetDurationMinutes: 35,
    temperature: 68,
    water: 2.8,
    soda: 2.4,
    acid: 1.7,
    detergent: 4.1
  },
  {
    id: "CIP-2407-003",
    date: "09/07/2026 22:10",
    equipment: "Citerne maturation",
    process: "Rincage",
    status: "Termine",
    result: "Conforme",
    operator: "Ahmed B.",
    duration: 24,
    targetDurationMinutes: 25,
    temperature: 54,
    water: 2.1,
    soda: 0,
    acid: 0,
    detergent: 0
  },
  {
    id: "CIP-2407-004",
    date: "09/07/2026 18:30",
    equipment: "Refroidisseur",
    process: "Desinfection",
    status: "Bloque",
    result: "Non conforme",
    operator: "Ahmed B.",
    duration: 42,
    targetDurationMinutes: 40,
    temperature: 61,
    water: 3.1,
    soda: 2,
    acid: 1.8,
    detergent: 3.8
  },
  {
    id: "CIP-2407-005",
    date: "09/07/2026 15:20",
    equipment: "Citerne N04",
    process: "CIP complet",
    status: "En cours",
    result: "En attente",
    operator: "Operateur Formital",
    duration: 18,
    targetDurationMinutes: 45,
    temperature: 66,
    water: 1.7,
    soda: 1.4,
    acid: 0.8,
    detergent: 2.2
  }
];

export const equipments: Equipment[] = [
  { id: "EQ-01", name: "Ligne Yaourt", line: "Production lait fermentes", status: "Nettoye", lastCycle: "10/07/2026 08:32", compliance: 96 },
  { id: "EQ-02", name: "Citerne N02", line: "Stockage lait", status: "Disponible", lastCycle: "10/07/2026 06:15", compliance: 94 },
  { id: "EQ-03", name: "Citerne maturation", line: "Maturation", status: "Disponible", lastCycle: "09/07/2026 22:10", compliance: 92 },
  { id: "EQ-04", name: "Refroidisseur", line: "Traitement thermique", status: "Hors service", lastCycle: "09/07/2026 18:30", compliance: 78 },
  { id: "EQ-05", name: "Citerne N04", line: "Stockage lait", status: "En nettoyage", lastCycle: "En cours", compliance: 88 }
];

export const alerts: Alert[] = [
  { id: "AL-104", title: "Temperature sous la limite", equipment: "Refroidisseur", severity: "Critique", status: "Active", createdAt: "09/07/2026 18:34" },
  { id: "AL-103", title: "Conductivite a verifier", equipment: "Citerne N04", severity: "Warning", status: "Active", createdAt: "09/07/2026 15:42" },
  { id: "AL-102", title: "Cycle plus long que prevu", equipment: "Ligne Yaourt", severity: "Info", status: "Acquittee", createdAt: "08/07/2026 11:10" },
  { id: "AL-101", title: "Produit detergent faible", equipment: "Citerne N02", severity: "Warning", status: "Resolue", createdAt: "08/07/2026 07:25" }
];

export const dailyCycles = [5, 7, 6, 8, 4, 6, 9, 6, 7, 5];
export const waterConsumption = [30, 29, 26, 27, 30, 28, 25, 27, 29, 24];
export const detergentConsumption = [18, 22, 17, 16, 19, 22, 20, 21, 23, 18];

export const checklistItems = [
  "Vannes ouvertes et circuit isole",
  "Produit detergent disponible",
  "Cuve vide avant nettoyage",
  "Programme CIP selectionne",
  "Conditions de securite validees"
];

export function getDashboardMetrics() {
  const total = 42;
  const compliant = 39;

  return {
    totalCycles: total,
    compliance: Math.round((compliant / total) * 1000) / 10,
    water: 18.6,
    detergent: 32.4,
    activeAlerts: alerts.filter((alert) => alert.status === "Active").length
  };
}
