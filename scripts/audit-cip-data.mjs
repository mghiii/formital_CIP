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

if (cycleError || equipmentError || checklistError) {
  console.error("Audit impossible:", cycleError?.message ?? equipmentError?.message ?? checklistError?.message);
  process.exit(1);
}

const equipmentById = new Map((equipments ?? []).map((equipment) => [equipment.id, equipment]));
const checklistByCycleId = new Map((checklists ?? []).map((checklist) => [checklist.cycle_id, checklist]));
const runningByEquipment = new Map();
const allowedStatuses = new Set(["draft", "planned", "ready", "running", "in_progress", "completed", "cancelled", "failed"]);
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

  if (equipment.process_id !== cycle.process_id) {
    failures += 1;
    fail("Process cycle/machine incoherent", `${cycle.id}: cycle=${cycle.process_id}, machine=${equipment.process_id}`);
  }

  if (["planned", "ready", "running", "in_progress"].includes(status) && !checklist) {
    failures += 1;
    fail("Checklist manquante", cycle.id);
  }

  if (["running", "in_progress"].includes(status)) {
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
