export const STARTABLE_CYCLE_STATUSES = ["draft", "planned", "ready", "pending", "scheduled"] as const;
export const RUNNING_CYCLE_STATUSES = ["in_progress", "running"] as const;
export const LEGACY_RUNNING_STATUS = "in_progress";

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null | undefined;

type WorkflowPayload = {
  ok?: boolean;
  code?: unknown;
  message?: unknown;
  cycle_id?: unknown;
};

export type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: DatabaseError }>;
};

export type ChecklistPayload = {
  valves_open: boolean;
  cleaning_product_available: boolean;
  tank_empty: boolean;
  circuit_selected: boolean;
  safety_conditions_checked: boolean;
};

export type CreateCycleWorkflowPayload = {
  p_equipment_id: string;
  p_operator_id?: string | null;
  p_planned_start_time?: string | null;
  p_planned_duration_minutes?: number;
  p_priority?: string;
  p_instructions?: string | null;
  p_observation?: string | null;
  p_status?: "draft" | "planned" | "ready";
  p_valves_open?: boolean;
  p_cleaning_product_available?: boolean;
  p_tank_empty?: boolean;
  p_circuit_selected?: boolean;
  p_safety_conditions_checked?: boolean;
};

export function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

export function checklistFromFormData(formData: FormData): ChecklistPayload {
  return {
    valves_open: checked(formData, "valves_open"),
    cleaning_product_available: checked(formData, "cleaning_product_available"),
    tank_empty: checked(formData, "tank_empty"),
    circuit_selected: checked(formData, "circuit_selected"),
    safety_conditions_checked: checked(formData, "safety_conditions_checked")
  };
}

export function isChecklistComplete(checklist: ChecklistPayload) {
  return Object.values(checklist).every(Boolean);
}

export function normalizeWorkflowCode(code?: unknown) {
  return String(code ?? "database-error").toLowerCase().replaceAll("_", "-");
}

export function databaseErrorCode(error: DatabaseError, fallback = "database-error") {
  const message = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""} ${error?.hint ?? ""}`.toLowerCase();

  if (!message.trim()) return fallback;
  if (message.includes("row-level security")) return "cycle-permission";
  if (message.includes("pgrst202") || message.includes("could not find the function")) return "rpc-not-available";
  if (message.includes("create_cip_cycle") || message.includes("start_cip_cycle") || message.includes("start_planned_cip_cycle")) {
    return "rpc-not-available";
  }
  if (message.includes("planned_start_time") || message.includes("planned_duration_minutes") || message.includes("started_by")) {
    return "workflow-schema-outdated";
  }
  if (message.includes("invalid input value for enum")) return "workflow-schema-outdated";
  if (message.includes("not-null") && message.includes("operator_id")) return "workflow-schema-outdated";
  if (message.includes("duplicate key") || message.includes("already has a running")) return "equipment-has-active-cycle";
  if (message.includes("checklist")) return "checklist-incomplete";
  if (message.includes("equipment") && message.includes("not available")) return "equipment-unavailable";

  return fallback;
}

export function isRpcNotAvailable(error: DatabaseError) {
  return databaseErrorCode(error) === "rpc-not-available";
}

export function parseWorkflowResult(result: unknown) {
  if (!result || typeof result !== "object") {
    return {
      ok: false,
      code: "database-error",
      message: "La base de donnees n'a pas retourne de resultat de demarrage."
    };
  }

  const payload = result as WorkflowPayload;
  return {
    ok: payload.ok === true,
    code: normalizeWorkflowCode(payload.code),
    message: typeof payload.message === "string" ? payload.message : undefined,
    cycleId: typeof payload.cycle_id === "string" ? payload.cycle_id : undefined
  };
}

export async function createCycleThroughWorkflow({
  supabase,
  payload
}: {
  supabase: RpcClient;
  payload: CreateCycleWorkflowPayload;
}) {
  const result = await supabase.rpc("create_cip_cycle", payload);

  if (result.error) {
    return { ok: false as const, code: databaseErrorCode(result.error, "cycle-create") };
  }

  const parsed = parseWorkflowResult(result.data);
  return parsed.ok
    ? { ok: true as const, code: parsed.code, message: parsed.message, cycleId: parsed.cycleId }
    : { ok: false as const, code: parsed.code, message: parsed.message };
}

export async function startCycleThroughWorkflow({
  supabase,
  cycleId,
  forceStart = false
}: {
  supabase: RpcClient;
  cycleId: string;
  forceStart?: boolean;
}) {
  const preferred = await supabase.rpc("start_cip_cycle", {
    p_cycle_id: cycleId,
    p_force: forceStart
  });

  if (!preferred.error) {
    const parsed = parseWorkflowResult(preferred.data);
    return parsed.ok ? { ok: true as const, code: parsed.code, message: parsed.message } : { ok: false as const, code: parsed.code, message: parsed.message };
  }

  if (!isRpcNotAvailable(preferred.error)) {
    return { ok: false as const, code: databaseErrorCode(preferred.error, "cycle-start") };
  }

  const legacy = await supabase.rpc("start_planned_cip_cycle", {
    p_cycle_id: cycleId,
    p_force: forceStart
  });

  if (legacy.error) {
    return {
      ok: false as const,
      code: isRpcNotAvailable(legacy.error) ? "rpc-not-available" : databaseErrorCode(legacy.error, "cycle-start")
    };
  }

  const parsed = parseWorkflowResult(legacy.data);
  return parsed.ok ? { ok: true as const, code: parsed.code, message: parsed.message } : { ok: false as const, code: parsed.code, message: parsed.message };
}
