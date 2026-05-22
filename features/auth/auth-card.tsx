"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Mail, Sparkles, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthCardProps = {
  mode: "login" | "register";
};

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState(
    isSupabaseConfigured
      ? "Gunakan akun Saku untuk membuka ringkasan keuangan."
      : "Saku siap dipakai. Masuk untuk mulai mengatur uang harian."
  );
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        router.replace("/");
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        router.replace("/");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      setMessage("Masuk berhasil. Membuka beranda...");
      router.replace("/");
      setLoading(false);
      return;
    }

    try {
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/`
              }
            });

      if (result.error) {
        setMessage("Autentikasi belum berhasil. Periksa email dan kata sandi.");
      } else if (mode === "login" || result.data.session) {
        setMessage("Masuk berhasil. Membuka beranda...");
        router.replace("/");
      } else {
        setMessage("Registrasi berhasil. Cek email bila verifikasi diminta, lalu login ke Saku.");
      }
    } catch {
      setMessage("Autentikasi belum berhasil. Coba beberapa saat lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function requestPasswordReset() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Reset kata sandi belum tersedia saat ini. Coba lagi nanti.");
      return;
    }

    setResetLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });
    setMessage("Jika email terdaftar, tautan reset akan dikirim. Silakan cek inbox.");
    setResetLoading(false);
  }

  return (
    <Card className="w-full max-w-md overflow-hidden border-zinc-950 bg-card/88 dark:border-white/10">
      <div className="border-b border-zinc-950 bg-zinc-950 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300 dark:border-white/10">
        Akses Saku
      </div>
      <CardHeader>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-lime-300 text-zinc-950 shadow-pop">
          <WalletCards className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">{mode === "login" ? "Masuk ke Saku" : "Buat akun Saku"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Akses ringkasan, budget, dan transaksi harian."
            : "Mulai catat pemasukan dan pengeluaran dengan cepat."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitAuth}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata sandi</Label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>
          <Button className="w-full" disabled={loading}>
            {loading ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <Badge variant={isSupabaseConfigured ? "success" : "warning"}>
            {isSupabaseConfigured ? "Akun siap" : "Saku siap"}
          </Badge>
          <div className="flex items-center gap-3">
            {mode === "login" && (
              <button
                type="button"
                className="font-medium text-muted-foreground hover:text-primary hover:underline"
                onClick={requestPasswordReset}
                disabled={resetLoading}
              >
                {resetLoading ? "Mengirim..." : "Lupa kata sandi"}
              </button>
            )}
            <Link className="font-medium text-primary hover:underline" href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Buat akun" : "Sudah punya akun"}
            </Link>
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-md border bg-muted/80 p-3 text-sm font-semibold text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          {message}
        </p>
      </CardContent>
    </Card>
  );
}
