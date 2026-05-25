"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail, Send, Sparkles, WalletCards } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Masukkan email akun Saku. Kami akan mengirim tautan untuk membuat kata sandi baru.");

  async function requestPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Reset kata sandi belum tersedia saat ini. Coba lagi nanti.");
      return;
    }

    setLoading(true);

    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      setMessage("Jika email terdaftar, tautan reset akan dikirim. Silakan cek inbox.");
    } catch {
      setMessage("Jika email terdaftar, tautan reset akan dikirim. Silakan cek inbox.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden border-zinc-950 bg-card/88 dark:border-white/10">
      <div className="border-b border-zinc-950 bg-zinc-950 px-5 py-3 text-xs font-extrabold uppercase tracking-[0.24em] text-lime-300 dark:border-white/10">
        Bantuan akun
      </div>
      <CardHeader>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-lime-300 text-zinc-950 shadow-pop">
          <WalletCards className="h-5 w-5" />
        </div>
        <CardTitle className="text-2xl">Lupa kata sandi</CardTitle>
        <CardDescription>Buat kata sandi baru lewat tautan aman yang dikirim ke email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={requestPasswordReset}>
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
          <Button className="w-full" disabled={loading}>
            {loading ? "Mengirim..." : "Kirim tautan reset"}
            <Send className="h-4 w-4" />
          </Button>
        </form>

        <Separator className="my-4" />

        <div className="flex justify-end text-sm">
          <Link className="inline-flex items-center gap-2 font-medium text-primary hover:underline" href="/login">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke login
          </Link>
        </div>

        <Alert className="mt-4 border-border bg-muted/80">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription className="font-semibold text-muted-foreground">{message}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
