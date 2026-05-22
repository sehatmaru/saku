import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getRouteUser } from "@/lib/supabase-route";

const transactionSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  type: z.enum(["income", "expense"]),
  notes: z.string().trim().min(1).default("Tanpa catatan"),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  source: z.enum(["manual", "whatsapp"]).default("manual")
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
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: "Transaksi belum bisa dimuat." }, { status: 500 });
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

  const parsed = transactionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Data transaksi belum lengkap." }, { status: 400 });
  }

  const { error, data } = await client
    .from("transactions")
    .insert({
      user_id: user.id,
      category_id: parsed.data.categoryId,
      amount: parsed.data.amount,
      type: parsed.data.type,
      notes: parsed.data.notes,
      transaction_date: parsed.data.transactionDate,
      source: parsed.data.source
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: "Transaksi belum bisa disimpan." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
