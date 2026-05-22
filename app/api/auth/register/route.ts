import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteSupabaseClient } from "@/lib/supabase-route";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

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
    return NextResponse.json({ success: false, error: "Register failed" }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
