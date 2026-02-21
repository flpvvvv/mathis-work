"use client";

import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  redirectPath: string;
  showForbiddenMessage?: boolean;
};

export function LoginForm({ redirectPath, showForbiddenMessage = false }: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    try {
      sessionStorage.setItem("mathis-gallery:auth-next", redirectPath);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error("Failed to send login link. Please check your email address.");
        return;
      }

      setSent(true);
    } catch {
      toast.error("Connection lost. Please check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md p-6">
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Admin Login</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Sign in with a magic link.
          </p>
        </div>
        {showForbiddenMessage ? (
          <p className="rounded-none border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            You do not have permission to perform this action.
          </p>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            type="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <Button className="w-full" disabled={loading} type="submit">
          {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
          Send Magic Link
        </Button>
        {sent ? (
          <p className="rounded-none border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Check your email for the login link.
          </p>
        ) : null}
      </form>
    </Card>
  );
}
