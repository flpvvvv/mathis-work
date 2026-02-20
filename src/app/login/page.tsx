import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentProfile } from "@/lib/auth";

type Props = {
  searchParams: Promise<{
    next?: string;
    forbidden?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const [profile, resolvedParams] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ]);

  const redirectPath =
    resolvedParams.next && resolvedParams.next.startsWith("/")
      ? resolvedParams.next
      : "/admin";

  if (profile?.is_admin) {
    redirect(redirectPath);
  }

  return (
    <LoginForm
      redirectPath={redirectPath}
      showForbiddenMessage={resolvedParams.forbidden === "1"}
    />
  );
}
