import { AuthCard } from "@/features/auth/auth-card";

export default function RegisterPage() {
  return (
    <main className="saku-shell saku-noise flex min-h-screen items-center justify-center bg-background p-4">
      <AuthCard mode="register" />
    </main>
  );
}
