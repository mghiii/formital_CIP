import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !key) {
  console.error("Audit impossible: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function fail(message, details = "") {
  console.log(`FAIL ${message}${details ? ` - ${details}` : ""}`);
}

function ok(message) {
  console.log(`OK   ${message}`);
}

const { data: cycles, error: cycleError } = await supabase.from("cip_cycles").select("*").limit(1000);
const { data: equipments, error: equipmentError } = await supabase.from("equipments").select("*").limit(1000);
const { data: checklists, error: checklistError } = await supabase.from("cip_checklists").select("*").limit(1000);
const { data: profiles, error: profileError } = await supabase.from("profiles").select("*").limit(1000);
const { data: processes, error: processError } = await supabase.from("processes").select("*").limit(1000);

if (cycleError || equipmentError || checklistError || profileError || processError) {
  console.error("Audit impossible:", cycleError?.message ?? equipmentError?.message ?? checklistError?.message ?? profileError?.message ?? processError?.message);
  process.exit(1);
}

const equipmentById = new Map((equipments ?? []).map((equipment) => [equipment.id, equipment]));
const checklistByCycleId = new Map((checklists ?? []).map((checklist) => [checklist.cycle_id, checklist]));
const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
const processById = new Map((processes ?? []).map((process) => [process.id, process]));
const runningByEquipment = new Map();
const allowedStatuses = new Set(["draft", "planned", "ready", "running", "in_progress", "completed", "cancelled", "failed"]);
const startableStatuses = new Set(["draft", "planned", "ready"]);
const runningStatuses = new Set(["running", "in_progress"]);
let failures = 0;

for (const cycle of cycles ?? []) {
  const status = String(cycle.status);
  const equipment = equipmentById.get(cycle.equipment_id);
  const checklist = checklistByCycleId.get(cycle.id);

  if (!allowedStatuses.has(status)) {
    failures += 1;
    fail("Statut cycle inconnu", `${cycle.id}: ${status}`);
  }

  if (!equipment) {
    failures += 1;
    fail("Cycle sans machine valide", cycle.id);
    continue;
  }

  if (!processById.has(cycle.process_id)) {
    failures += 1;
    fail("Cycle sans process valide", `${cycle.id}: process=${cycle.process_id}`);
  }

  if (equipment.process_id !== cycle.process_id) {
    failures += 1;
    fail("Process cycle/machine incoherent", `${cycle.id}: cycle=${cycle.process_id}, machine=${equipment.process_id}`);
  }

  if (["planned", "ready", "running", "in_progress"].includes(status) && !checklist) {
    failures += 1;
    fail("Checklist manquante", cycle.id);
  }

  if (startableStatuses.has(status) && checklist && checklist.all_validated === false) {
    fail("Cycle planifie non lancable", `${cycle.id}: checklist incomplete`);
  }

  if (cycle.operator_id) {
    const operator = profileById.get(cycle.operator_id);
    if (!operator) {
      failures += 1;
      fail("Cycle assigne a un profil introuvable", `${cycle.id}: operator=${cycle.operator_id}`);
    } else if (operator.role !== "operator") {
      failures += 1;
      fail("Cycle assigne a un non-operateur", `${cycle.id}: role=${operator.role}`);
    } else if (operator.is_active === false || operator.status === "inactive") {
      failures += 1;
      fail("Cycle assigne a un operateur inactif", `${cycle.id}: operator=${cycle.operator_id}`);
    }
  }

  if (runningStatuses.has(status) && !cycle.started_at) {
    failures += 1;
    fail("Cycle en cours sans date de demarrage", cycle.id);
  }

  if (runningStatuses.has(status) && ["cleaning", "in_cleaning"].includes(String(equipment.status)) === false) {
    fail("Machine avec cycle en cours sans statut nettoyage", `${equipment.name ?? equipment.id}: status=${equipment.status}`);
  }

  if (runningStatuses.has(status)) {
    if (runningByEquipment.has(cycle.equipment_id)) {
      failures += 1;
      fail("Deux cycles en cours sur la meme machine", `${cycle.equipment_id}: ${runningByEquipment.get(cycle.equipment_id)} et ${cycle.id}`);
    }
    runningByEquipment.set(cycle.equipment_id, cycle.id);
  }
}

if (failures === 0) {
  ok(`Audit CIP sans erreur critique (${cycles?.length ?? 0} cycles, ${equipments?.length ?? 0} machines).`);
} else {
  console.error(`${failures} erreur(s) critique(s) detectee(s).`);
  process.exit(1);
}
