"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const passwordRecoveryStorageKey = "saku-password-recovery";

function hasRecoveryMarker() {
  if (typeof window === "undefined") return false;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);

  return hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery" || searchParams.has("code");
}

function markRecoverySession() {
  window.sessionStorage.setItem(passwordRecoveryStorageKey, "true");
}

function hasMarkedRecoverySession() {
  return window.sessionStorage.getItem(passwordRecoveryStorageKey) === "true";
}

function clearRecoverySessionMark() {
  window.sessionStorage.removeItem(passwordRecoveryStorageKey);
}

export function ResetPasswordCard() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Memeriksa tautan reset kata sandi...");

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Reset kata sandi belum tersedia saat ini. Coba lagi nanti.");
      setCheckingSession(false);
      return;
    }

    let mounted = true;

    async function prepareRecoverySession() {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get("code");
        const openedFromRecoveryLink = hasRecoveryMarker();

        if (code) {
          const { error } = await supabase!.auth.exchangeCodeForSession(code);
          if (error) throw error;
          markRecoverySession();
          window.history.replaceState(null, "", window.location.pathname);
        }

        const { data, error } = await supabase!.auth.getSession();
        if (error) throw error;
        if (!mounted) return;

        if (data.session && (openedFromRecoveryLink || hasMarkedRecoverySession())) {
          setCanReset(true);
          setMessage("Masukkan kata sandi baru untuk akun Saku.");
        } else {
          setCanReset(false);
          setMessage("Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
        }
      } catch {
        if (!mounted) return;
        setCanReset(false);
        setMessage("Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        markRecoverySession();
        setCanReset(true);
        setMessage("Masukkan kata sandi baru untuk akun Saku.");
        setCheckingSession(false);
      } else if (session && hasRecoveryMarker()) {
        markRecoverySession();
        setCanReset(true);
        setMessage("Masukkan kata sandi baru untuk akun Saku.");
        setCheckingSession(false);
      }
    });

    prepareRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function submitNewPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || !canReset) return;

    if (password.length < 8) {
      setMessage("Kata sandi minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Konfirmasi kata sandi belum sama.");
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Reset kata sandi belum tersedia saat ini. Coba lagi nanti.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("Kata sandi belum bisa diperbarui. Minta tautan baru lalu coba lagi.");
        return;
      }

      setMessage("Kata sandi berhasil diperbarui. Silakan login kembali.");
      clearRecoverySessionMark();
      await supabase.auth.signOut();
      setTimeout(() => router.replace("/login"), 900);
    } catch {
      setMessage("Kata sandi belum bisa diperbarui. Minta tautan baru lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden border-zinc-950 bg-card/88 dark:border-white/10">
      <div className="border-b border-zinc-950 bg-zinc-950 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300 dark:border-white/10">
        Keamanan akun
      </div>
      <CardHeader>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-lime-300 text-zinc-950 shadow-pop">
          <WalletCards className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Buat kata sandi baru</CardTitle>
        <CardDescription>Gunakan kata sandi yang berbeda dari sebelumnya.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitNewPassword}>
          <div className="space-y-2">
            <Label htmlFor="password">Kata sandi baru</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-9"
                disabled={!canReset || checkingSession}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Ulangi kata sandi baru</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm-password"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="pl-9"
                disabled={!canReset || checkingSession}
                required
              />
            </div>
          </div>
          <Button className="w-full" disabled={loading || !canReset || checkingSession}>
            {loading ? "Menyimpan..." : checkingSession ? "Memeriksa..." : "Simpan kata sandi"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-4 flex justify-between gap-3 text-sm">
          <Link className="inline-flex items-center gap-2 font-medium text-muted-foreground hover:text-primary hover:underline" href="/forgot-password">
            <ArrowLeft className="h-4 w-4" />
            Minta tautan baru
          </Link>
          <Link className="font-medium text-primary hover:underline" href="/login">
            Login
          </Link>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-md border bg-muted/80 p-3 text-sm font-semibold text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
