import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteSupabaseClient } from "@/lib/supabase-route";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

function getRegisterErrorMessage(error: { message?: string; status?: number }) {
  const message = error.message?.toLowerCase() ?? "";

  if (error.status === 429 || message.includes("rate limit")) {
    return "Terlalu banyak percobaan akun dalam waktu singkat. Tunggu beberapa menit, lalu coba lagi.";
  }

  if (message.includes("already registered") || message.includes("already exists")) {
    return "Email ini sudah terdaftar. Masuk dengan akun tersebut atau gunakan lupa kata sandi.";
  }

  return "Registrasi belum berhasil. Periksa email dan kata sandi.";
}

export async function POST(request: NextRequest) {
  const parsed = registerSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Email atau kata sandi belum sesuai." }, { status: 400 });
  }

  let client: ReturnType<typeof createRouteSupabaseClient>;

  try {
    client = createRouteSupabaseClient(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Layanan akun belum siap." },
      { status: 503 }
    );
  }

  const { error } = await client.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return NextResponse.json({ success: false, error: getRegisterErrorMessage(error) }, { status: error.status ?? 400 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
