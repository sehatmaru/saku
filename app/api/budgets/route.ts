import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRouteUser } from "@/lib/supabase-route";

const budgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  period: z.enum(["weekly", "monthly"]).default("monthly")
});

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getRouteUser(request);

  if (!client) {
    return NextResponse.json({ success: false, error: authError }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Silakan login ulang." }, { status: 401 });
  }

  const { data, error } = await client
    .from("budgets")
    .select("*")
    .eq("user_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: "Budget belum bisa dimuat." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getRouteUser(request);

  if (!client) {
    return NextResponse.json({ success: false, error: authError }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Silakan login ulang." }, { status: 401 });
  }

  const parsed = budgetSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Data budget belum lengkap." }, { status: 400 });
  }

  const { data, error } = await client
    .from("budgets")
    .insert({
      user_id: user.id,
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      period: parsed.data.period
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: "Budget belum bisa disimpan." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
