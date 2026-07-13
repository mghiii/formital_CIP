import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Alert, AlertSeverity, CipCycle, CycleResult, CycleStatus, Equipment } from "@/lib/cip/mock-data";
import type { Profile } from "@/types/auth";

export type DashboardMetrics = {
  totalCycles: number;
  compliance: number;
  water: number;
  detergent: number;
  activeAlerts: number;
};

export type ChecklistState = {
  valves_open: boolean;
  cleaning_product_available: boolean;
  tank_empty: boolean;
  circuit_selected: boolean;
  safety_conditions_checked: boolean;
  all_validated: boolean;
};

export type CipUser = {
  id: string;
  email: string;
  name: string;
  role: "operator" | "engineer" | "admin";
  status: "Actif" | "Inactif" | "En attente";
  phone: string;
  matricule: string;
  department: string;
  workshop: string;
  rfidBadgeId: string;
  avatarUrl: string;
  createdAt: string;
  lastSignInAt: string;
};

export type CipDashboardData = {
  cycles: CipCycle[];
  equipments: Equipment[];
  workshops: Array<{
    id: string;
    name: string;
    description: string;
    equipments: Equipment[];
  }>;
  alerts: Alert[];
  instructions: Array<{
    id: string;
    title: string;
    content: string;
    process: string;
    equipment: string;
    version: number;
  }>;
  metrics: DashboardMetrics;
  dailyCycles: number[];
  waterConsumption: number[];
  detergentConsumption: number[];
  users: CipUser[];
  checklists: Record<string, ChecklistState>;
  source: "supabase" | "unavailable";
  notice?: string;
};

type DbRecord = Record<string, unknown>;

type TableReadResult = {
  rows: DbRecord[];
  error?: string;
};

type SupabaseDataClient =
  | ReturnType<typeof createServerSupabaseClient>
  | NonNullable<ReturnType<typeof createAdminSupabaseClient>>;

function createCipReadClient(profile?: Pick<Profile, "role">): SupabaseDataClient {
  const sessionClient = createServerSupabaseClient();

  if (profile?.role === "engineer" || profile?.role === "admin") {
    return createAdminSupabaseClient() ?? sessionClient;
  }

  return sessionClient;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : Number(value ?? fallback) || fallback;
}

function booleanValue(value: unknown) {
  return value === true;
}

function isoDate(value: unknown) {
  const raw = text(value);
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function formatDate(value: unknown) {
  const date = isoDate(value);
  if (!date) return "A planifier";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function minutesBetween(startedAt: unknown, endedAt?: unknown) {
  const start = isoDate(startedAt);
  const end = isoDate(endedAt) ?? new Date();
  if (!start || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 60000);
}

function mapCycleStatus(status: unknown): CycleStatus {
  const value = text(status);
  if (value === "in_progress" || value === "running") return "En cours";
  if (value === "completed") return "Termine";
  if (value === "cancelled" || value === "failed") return "Bloque";
  return "Planifie";
}

function mapCycleResult(result: unknown, status: unknown): CycleResult {
  const value = text(result);
  if (value === "compliant") return "Conforme";
  if (value === "non_compliant") return "Non conforme";
  return mapCycleStatus(status) === "Termine" ? "Conforme" : "En attente";
}

function mapEquipmentStatus(status: unknown): Equipment["status"] {
  const value = text(status);
  if (value === "cleaning" || value === "in_cleaning") return "En nettoyage";
  if (value === "cleaned") return "Nettoye";
  if (value === "not_cleaned") return "Non nettoye";
  if (value === "out_of_service") return "Hors service";
  return "Disponible";
}

function mapAlertSeverity(severity: unknown): AlertSeverity {
  const value = text(severity);
  if (value === "critical") return "Critique";
  if (value === "info") return "Info";
  return "Warning";
}

function mapAlertStatus(status: unknown): Alert["status"] {
  const value = text(status);
  if (value === "acknowledged") return "Acquittee";
  if (value === "resolved") return "Resolue";
  return "Active";
}

function emptyData(notice?: string): CipDashboardData {
  return {
    cycles: [],
    equipments: [],
    workshops: [],
    alerts: [],
    instructions: [],
    metrics: {
      totalCycles: 0,
      compliance: 0,
      water: 0,
      detergent: 0,
      activeAlerts: 0
    },
    dailyCycles: [],
    waterConsumption: [],
    detergentConsumption: [],
    users: [],
    checklists: {},
    source: "unavailable",
    notice
  };
}

function computeMetrics(cycles: CipCycle[], alerts: Alert[]): DashboardMetrics {
  const completedCycles = cycles.filter((cycle) => cycle.status === "Termine");
  const totalCycles = completedCycles.length;
  const compliant = completedCycles.filter((cycle) => cycle.result === "Conforme").length;
  const waterLiters = completedCycles.reduce((sum, cycle) => sum + cycle.water, 0);
  const detergent = completedCycles.reduce((sum, cycle) => sum + cycle.detergent, 0);

  return {
    totalCycles,
    compliance: totalCycles ? Math.round((compliant / totalCycles) * 1000) / 10 : 0,
    water: Math.round((waterLiters / 1000) * 10) / 10,
    detergent: Math.round(detergent * 10) / 10,
    activeAlerts: alerts.filter((alert) => alert.status === "Active").length
  };
}

function lastTenDayCounts(cycles: CipCycle[], rowsById: Map<string, DbRecord>) {
  const today = new Date();
  const days = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (9 - index));
    return date.toISOString().slice(0, 10);
  });
  const counts = new Map(days.map((day) => [day, 0]));

  for (const cycle of cycles.filter((row) => row.status === "Termine")) {
    const row = rowsById.get(cycle.id);
    const day = isoDate(row?.started_at)?.toISOString().slice(0, 10);
    if (day && counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return days.map((day) => counts.get(day) ?? 0);
}

function lastTenDaySums(cycles: CipCycle[], rowsById: Map<string, DbRecord>, field: "water" | "detergent") {
  const today = new Date();
  const days = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (9 - index));
    return date.toISOString().slice(0, 10);
  });
  const sums = new Map(days.map((day) => [day, 0]));

  for (const cycle of cycles.filter((row) => row.status === "Termine")) {
    const row = rowsById.get(cycle.id);
    const day = isoDate(row?.started_at)?.toISOString().slice(0, 10);
    const value = field === "water" ? cycle.water / 1000 : cycle.detergent;
    if (day && sums.has(day)) sums.set(day, Math.round(((sums.get(day) ?? 0) + value) * 10) / 10);
  }

  return days.map((day) => sums.get(day) ?? 0);
}

async function readTable(
  supabase: SupabaseDataClient,
  table: string,
  select = "*",
  order?: { column: string; ascending?: boolean },
  limit = 200
): Promise<TableReadResult> {
  let query = supabase.from(table).select(select).limit(limit);
  if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
  const { data, error } = await query;

  return {
    rows: ((data ?? []) as unknown as DbRecord[]) ?? [],
    error: error?.message
  };
}

export async function getCipDashboardData(profile?: Pick<Profile, "role">): Promise<CipDashboardData> {
  try {
    const supabase = createCipReadClient(profile);
    const [cycleResult, equipmentResult, processResult, profileResult, alertResult, checklistResult, instructionResult] = await Promise.all([
      readTable(supabase, "cip_cycles", "*", { column: "started_at", ascending: false }),
      readTable(supabase, "equipments", "*", { column: "created_at", ascending: true }),
      readTable(supabase, "processes", "*", { column: "created_at", ascending: true }),
      readTable(supabase, "profiles", "*", { column: "created_at", ascending: true }),
      readTable(supabase, "cip_alerts", "*", { column: "created_at", ascending: false }),
      readTable(supabase, "cip_checklists", "*", { column: "created_at", ascending: false }),
      readTable(supabase, "cip_instructions", "*", { column: "created_at", ascending: true })
    ]);

    const readErrors = [cycleResult, equipmentResult, processResult, profileResult, alertResult, checklistResult, instructionResult]
      .map((result) => result.error)
      .filter(Boolean);

    if (readErrors.length > 0) {
      return emptyData(`Lecture de la base de donnees impossible: ${readErrors[0]}`);
    }

    const cycleRows = cycleResult.rows;
    const equipmentRows = equipmentResult.rows;
    const processRows = processResult.rows;
    const profileRows = profileResult.rows;
    const alertRows = alertResult.rows;
    const checklistRows = checklistResult.rows;
    const instructionRows = instructionResult.rows;

    const equipmentsById = new Map(equipmentRows.map((equipment) => [text(equipment.id), equipment]));
    const processesById = new Map(processRows.map((process) => [text(process.id), process]));
    const profilesById = new Map(profileRows.map((profile) => [text(profile.id), profile]));
    const cycleRowsById = new Map(cycleRows.map((cycle) => [text(cycle.id), cycle]));

    const cycles: CipCycle[] = cycleRows.map((cycle, index) => {
      const equipment = equipmentsById.get(text(cycle.equipment_id));
      const process = processesById.get(text(cycle.process_id));
      const operator = profilesById.get(text(cycle.operator_id));
      const rawStatus = text(cycle.status, "draft");
      const isPlanned = ["draft", "planned", "ready"].includes(rawStatus);
      const displayDate = isPlanned ? cycle.planned_start_time ?? cycle.started_at : cycle.started_at;
      const soda = numberValue(cycle.soda_quantity);
      const acid = numberValue(cycle.acid_quantity);
      const storedDuration = numberValue(cycle.duration_minutes);
      const plannedDuration = numberValue(cycle.planned_duration_minutes, 45);
      const liveDuration = isPlanned ? plannedDuration : storedDuration || minutesBetween(cycle.started_at, cycle.ended_at);

      return {
        id: text(cycle.id, `CIP-${index + 1}`),
        date: formatDate(displayDate),
        startedAt: isPlanned ? undefined : text(cycle.started_at) || undefined,
        endedAt: text(cycle.ended_at) || null,
        plannedAt: text(cycle.planned_start_time) || undefined,
        rawStatus,
        operatorId: text(cycle.operator_id) || null,
        equipment: text(equipment?.name, "Equipement non renseigne"),
        process: text(process?.name, "Programme CIP"),
        status: mapCycleStatus(cycle.status),
        result: mapCycleResult(cycle.result, cycle.status),
        operator: text(operator?.full_name, text(operator?.email, "Non assigne")),
        duration: liveDuration,
        targetDurationMinutes: plannedDuration > 0 ? plannedDuration : Math.max(liveDuration, 45),
        temperature: numberValue(cycle.temperature_c),
        water: numberValue(cycle.water_consumed_l),
        soda,
        acid,
        detergent: soda + acid,
        priority: text(cycle.priority, "normal"),
        instructions: text(cycle.instructions, ""),
        visualAspect: text(cycle.visual_aspect, "Non renseigne"),
        observation: text(cycle.observation, "Aucune observation")
      };
    });

    const equipments: Equipment[] = equipmentRows.map((equipment, index) => {
      const name = text(equipment.name, "Equipement");
      const process = processesById.get(text(equipment.process_id));
      const lastCycle = cycles.find((cycle) => cycle.equipment === name);
      const equipmentCycles = cycles.filter((cycle) => cycle.equipment === name && cycle.status === "Termine");
      const conformity =
        equipmentCycles.length === 0
          ? 0
          : Math.round((equipmentCycles.filter((cycle) => cycle.result === "Conforme").length / equipmentCycles.length) * 100);

      return {
        id: text(equipment.id, `EQ-${index + 1}`),
        processId: text(equipment.process_id),
        name,
        line: text(process?.name, "Process CIP"),
        status: mapEquipmentStatus(equipment.status),
        lastCycle: lastCycle?.date ?? "Aucun cycle",
        compliance: conformity
      };
    });

    const workshops = processRows.map((process, index) => {
      const id = text(process.id, `AT-${index + 1}`);
      const name = text(process.name, "Atelier CIP");

      return {
        id,
        name,
        description: text(process.description, "Atelier de production"),
        equipments: equipments.filter((equipment) => equipment.processId === id || equipment.line === name)
      };
    });

    const alerts: Alert[] = alertRows.map((alert, index) => {
      const equipment = equipmentsById.get(text(alert.equipment_id));
      return {
        id: text(alert.id, `AL-${index + 1}`),
        title: text(alert.title, "Alerte CIP"),
        equipment: text(equipment?.name, "Equipement non renseigne"),
        severity: mapAlertSeverity(alert.severity),
        status: mapAlertStatus(alert.status),
        createdAt: formatDate(alert.created_at)
      };
    });

    const users: CipDashboardData["users"] = profileRows.map((profile) => {
      const rawRole = text(profile.role, "operator");
      const rawStatus = text(profile.status);
      const isActive = profile.is_active !== false && rawStatus !== "inactive";

      return {
        id: text(profile.id),
        email: text(profile.email, "email non renseigne"),
        name: text(profile.full_name, text(profile.username, "Utilisateur Formital")),
        role: rawRole === "admin" || rawRole === "engineer" ? rawRole : "operator",
        status: rawStatus === "pending" ? "En attente" : isActive ? "Actif" : "Inactif",
        phone: text(profile.phone),
        matricule: text(profile.matricule),
        department: text(profile.department),
        workshop: text(profile.workshop),
        rfidBadgeId: text(profile.rfid_badge_id, text(profile.badge_rfid)),
        avatarUrl: text(profile.avatar_url),
        createdAt: text(profile.created_at),
        lastSignInAt: text(profile.last_sign_in_at)
      };
    });

    const instructions: CipDashboardData["instructions"] = instructionRows
      .filter((instruction) => instruction.is_active !== false)
      .map((instruction, index) => {
        const process = processesById.get(text(instruction.process_id));
        const equipment = equipmentsById.get(text(instruction.equipment_id));

        return {
          id: text(instruction.id, `INS-${index + 1}`),
          title: text(instruction.title, "Instruction CIP"),
          content: text(instruction.content, "Consigne non renseignee."),
          process: text(process?.name, "Tous ateliers"),
          equipment: text(equipment?.name, "Tous equipements"),
          version: numberValue(instruction.version, 1)
        };
      });

    const checklists: CipDashboardData["checklists"] = Object.fromEntries(
      checklistRows.map((checklist) => [
        text(checklist.cycle_id),
        {
          valves_open: booleanValue(checklist.valves_open),
          cleaning_product_available: booleanValue(checklist.cleaning_product_available),
          tank_empty: booleanValue(checklist.tank_empty),
          circuit_selected: booleanValue(checklist.circuit_selected),
          safety_conditions_checked: booleanValue(checklist.safety_conditions_checked),
          all_validated: booleanValue(checklist.all_validated)
        }
      ])
    );

    return {
      cycles,
      equipments,
      workshops,
      alerts,
      instructions,
      metrics: computeMetrics(cycles, alerts),
      dailyCycles: lastTenDayCounts(cycles, cycleRowsById),
      waterConsumption: lastTenDaySums(cycles, cycleRowsById, "water"),
      detergentConsumption: lastTenDaySums(cycles, cycleRowsById, "detergent"),
      users,
      checklists,
      source: "supabase",
      notice:
        cycles.length === 0
          ? "Base de donnees connectee. Aucun cycle CIP n'est encore enregistre."
          : undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return emptyData(`Connexion base de donnees indisponible: ${message}`);
  }
}
