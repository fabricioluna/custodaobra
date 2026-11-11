import "server-only";

import { listTeam } from "@/features/members/queries";
import { requireUserId } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * O que some junto com a conta: as contas de que a pessoa é dona, com quantas
 * obras têm e quantas outras pessoas perdem o acesso.
 */
export async function getDeletionPreview() {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, projects(count))")
    .eq("user_id", userId);
  if (error) throw error;

  const owned = data.flatMap((row) =>
    row.role === "owner" && row.organizations ? [row.organizations] : [],
  );
  const ownedOrgs = await Promise.all(
    owned.map(async (org) => {
      const team = await listTeam(org.id);
      return {
        id: org.id,
        name: org.name,
        projects: org.projects[0]?.count ?? 0,
        otherPeople: team.filter((member) => member.userId !== userId).length,
      };
    }),
  );
  return {
    ownedOrgs,
    memberOfOthers: data.some((row) => row.role !== "owner"),
  };
}
