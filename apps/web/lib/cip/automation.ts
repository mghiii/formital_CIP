import { isPrivilegedProfile } from "@/lib/auth/api";
import type { Profile } from "@/types/auth";
import {
  RUNNING_CYCLE_STATUSES,
  STARTABLE_CYCLE_STATUSES,
  databaseErrorCode,
  startCycleThroughWorkflow,
  type ChecklistPayload,
  type RpcClient
} from "@/lib/cip/workflow";

type QueryClient = RpcClient & {
  from: (table: string) => any;
};

type AutomationCycle = {
  id: string;
  operator_id: string | null;
  equipment_id: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  planned_start_time: string | null;
  planned_duration_minutes: number | null;
  result: string | null;
  observation: string | null;
};

type AutomationEquipment = {
  id: string;
  status: string | null;
  is_active: boolean | null;
};

type AutomationChecklist = ChecklistPayload & {
  cycle_id: string;
  all_validated: boolean | null;
};

export type CipAutomationTickResult = {
  started: Array<{ id: string }>;
  completed: Array<{ id: string }>;
  blocked: Array<{ id: string; reason: string }>;
};

function hasCompleteChecklist(checklist?: AutomationChecklist) {
  return (
    checklist?.all_validated === true ||
    (checklist?.valves_open === true &&
      checklist.cleaning_product_available === true &&
      checklist.tank_empty === true &&
      checklist.circuit_selected === true &&
      checklist.safety_conditions_checked === true)
  );
}

function canAutomationTouchCycle(profile: Profile, userId: string, cycle: Pick<AutomationCycle, "operator_id">) {
  return isPrivilegedProfile(profile) || cycle.operator_id === userId || (profile.role === "operator" && !cycle.operator_id);
}

function targetEndTime(cycle: Pick<AutomationCycle, "started_at" | "planned_duration_minutes">) {
  if (!cycle.started_at) return null;
  const startedAt = new Date(cycle.started_at).getTime();
  if (Number.isNaN(startedAt)) return null;
  const minutes = Math.max(cycle.planned_duration_minutes ?? 45, 1);
  return startedAt + minutes * 60_000;
}

async function readChecklists(db: QueryClient, cycleIds: string[]): Promise<Map<string, AutomationChecklist>> {
  if (cycleIds.length === 0) return new Map<string, AutomationChecklist>();

  const { data } = await db
    .from("cip_checklists")
    .select("cycle_id, valves_open, cleaning_product_available, tank_empty, circuit_selected, safety_conditions_checked, all_validated")
    .in("cycle_id", cycleIds);

  return new Map<string, AutomationChecklist>((data ?? []).map((checklist: AutomationChecklist) => [checklist.cycle_id, checklist]));
}

async function readEquipments(db: QueryClient, equipmentIds: string[]): Promise<Map<string, AutomationEquipment>> {
  if (equipmentIds.length === 0) return new Map<string, AutomationEquipment>();

  const { data } = await db.from("equipments").select("id, status, is_active").in("id", equipmentIds);

  return new Map<string, AutomationEquipment>((data ?? []).map((equipment: AutomationEquipment) => [equipment.id, equipment]));
}

export async function runCipAutomationTick({
  supabase,
  admin,
  profile,
  userId,
  now = new Date()
}: {
  supabase: QueryClient;
  admin?: QueryClient | null;
  profile: Profile;
  userId: string;
  now?: Date;
}): Promise<CipAutomationTickResult> {
  const db = admin ?? supabase;
  const result: CipAutomationTickResult = { started: [], completed: [], blocked: [] };
  const nowIso = now.toISOString();

  const { data: dueCycles, error: dueError } = await db
    .from("cip_cycles")
    .select("id, operator_id, equipment_id, status, started_at, ended_at, planned_start_time, planned_duration_minutes, result, observation")
    .in("status", STARTABLE_CYCLE_STATUSES)
    .lte("planned_start_time", nowIso)
    .limit(25);

  if (dueError) {
    result.blocked.push({ id: "planned-cycles", reason: databaseErrorCode(dueError) });
  }

  const plannedCycles = (dueCycles ?? []) as AutomationCycle[];
  const plannedChecklists = await readChecklists(db, plannedCycles.map((cycle) => cycle.id));
  const plannedEquipments = await readEquipments(db, plannedCycles.map((cycle) => cycle.equipment_id));

  for (const cycle of plannedCycles) {
    if (!canAutomationTouchCycle(profile, userId, cycle)) {
      result.blocked.push({ id: cycle.id, reason: "cycle-permission" });
      continue;
    }

    const checklist = plannedChecklists.get(cycle.id);
    if (!hasCompleteChecklist(checklist)) {
      result.blocked.push({ id: cycle.id, reason: "checklist-incomplete" });
      continue;
    }

    const equipment = plannedEquipments.get(cycle.equipment_id);
    if (!equipment?.id || equipment.is_active === false || ["cleaning", "in_cleaning", "out_of_service"].includes(String(equipment.status))) {
      result.blocked.push({ id: cycle.id, reason: "equipment-unavailable" });
      continue;
    }

    const started = await startCycleThroughWorkflow({ supabase, cycleId: cycle.id, forceStart: false });
    if (started.ok) {
      result.started.push({ id: cycle.id });
    } else {
      result.blocked.push({ id: cycle.id, reason: started.code });
    }
  }

  const { data: runningCycles, error: runningError } = await db
    .from("cip_cycles")
    .select("id, operator_id, equipment_id, status, started_at, ended_at, planned_start_time, planned_duration_minutes, result, observation")
    .in("status", RUNNING_CYCLE_STATUSES)
    .is("ended_at", null)
    .limit(50);

  if (runningError) {
    result.blocked.push({ id: "running-cycles", reason: databaseErrorCode(runningError) });
  }

  for (const cycle of ((runningCycles ?? []) as AutomationCycle[])) {
    if (!canAutomationTouchCycle(profile, userId, cycle)) {
      result.blocked.push({ id: cycle.id, reason: "cycle-permission" });
      continue;
    }

    const dueAt = targetEndTime(cycle);
    if (!dueAt || dueAt > now.getTime()) continue;

    const existingObservation = cycle.observation?.trim();
    const automaticObservation = "Cycle cloture automatiquement a la duree cible.";
    const observation = existingObservation ? `${existingObservation}\n${automaticObservation}` : automaticObservation;

    const { data: completedCycle, error: completeError } = await db
      .from("cip_cycles")
      .update({
        status: "completed",
        ended_at: nowIso,
        result: cycle.result === "non_compliant" ? "non_compliant" : "compliant",
        observation,
        updated_at: nowIso
      })
      .eq("id", cycle.id)
      .in("status", RUNNING_CYCLE_STATUSES)
      .is("ended_at", null)
      .select("id")
      .maybeSingle();

    if (completeError || !completedCycle?.id) {
      result.blocked.push({ id: cycle.id, reason: completeError ? databaseErrorCode(completeError, "cycle-complete") : "cycle-already-closed" });
      continue;
    }

    result.completed.push({ id: cycle.id });
  }

  return result;
}
