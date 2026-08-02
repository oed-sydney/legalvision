"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );
      setLoading(false);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/overview");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--lv-text-secondary)]">
          Email
        </span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-[var(--lv-border)] bg-white px-3.5 py-2.5 text-[var(--lv-text)] outline-none transition focus:border-[var(--lv-primary)] focus:ring-2 focus:ring-[var(--lv-primary-subtle)]"
          placeholder="you@company.com"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-[var(--lv-text-secondary)]">
          Password
        </span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-[var(--lv-border)] bg-white px-3.5 py-2.5 text-[var(--lv-text)] outline-none transition focus:border-[var(--lv-primary)] focus:ring-2 focus:ring-[var(--lv-primary-subtle)]"
          placeholder="••••••••"
        />
      </label>

      {error && (
        <p className="rounded-lg bg-[#fef2f2] px-3.5 py-2.5 text-sm text-[var(--lv-danger)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-1 rounded-lg bg-[var(--lv-primary)] px-4 py-2.5 font-semibold text-white transition hover:bg-[var(--lv-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--lv-canvas)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image
            src="/brand/lv-logo-navy.svg"
            alt="LegalVision"
            width={168}
            height={40}
            priority
          />
          <p className="text-sm text-[var(--lv-text-secondary)]">
            Paid Media Reporting
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--lv-border)] bg-[var(--lv-card)] p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-lg font-semibold text-[var(--lv-text)]">
            Sign in to your dashboard
          </h1>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--lv-muted)]">
          Access is invite-only. Contact your account manager for an invite.
        </p>
      </div>
    </main>
  );
}
