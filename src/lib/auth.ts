import { redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

type MaybeUser = {
  id: string;
  email?: string;
} | null;

const getCurrentUser = cache(async (): Promise<MaybeUser> => {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,is_admin,created_at")
      .eq("id", user.id)
      .single();

    if (error) {
      return null;
    }

    return data satisfies Profile;
  } catch {
    return null;
  }
});

export async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.is_admin) {
    redirect("/login");
  }

  return profile;
}
