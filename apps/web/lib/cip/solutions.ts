type SupabaseQueryError = { code?: string; message?: string } | null;
type CipSolutionRow = {
  id: string;
  name: string;
  unit: string | null;
  solution_type: string | null;
  is_active: boolean | null;
};

function isMissingSolutionSchema(error: SupabaseQueryError) {
  const message = error?.message ?? "";
  return (
    error?.code === "42P01" ||
    /schema cache|could not find|relation .*cip_solutions|cip_solutions|solution_id|p_solution_id/i.test(message)
  );
}

export async function validateActiveCipSolution(supabase: { from: (table: string) => any }, solutionId: string) {
  const id = solutionId.trim();

  if (!id) {
    return { ok: false as const, code: "missing-solution" };
  }

  const { data, error } = (await supabase
    .from("cip_solutions")
    .select("id, name, unit, solution_type, is_active")
    .eq("id", id)
    .maybeSingle()) as { data: CipSolutionRow | null; error: SupabaseQueryError };

  if (error) {
    return {
      ok: false as const,
      code: isMissingSolutionSchema(error) ? "workflow-schema-outdated" : "database-error"
    };
  }

  if (!data?.id) {
    return { ok: false as const, code: "solution-invalid" };
  }

  if (data.is_active === false) {
    return { ok: false as const, code: "solution-inactive" };
  }

  return {
    ok: true as const,
    solution: {
      id: data.id,
      name: data.name,
      unit: data.unit ?? "%",
      solutionType: data.solution_type ?? "other"
    }
  };
}
