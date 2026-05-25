import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseWhatsAppMessage } from "@/features/whatsapp/parse-message";
import { getRouteUser } from "@/lib/supabase-route";

const whatsappSchema = z.object({
  message: z.string().trim().min(1),
  confirm: z.boolean().default(false)
});

export async function POST(request: NextRequest) {
  const parsedBody = whatsappSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json({ success: false, error: "Pesan belum lengkap." }, { status: 400 });
  }

  const parsedMessage = parseWhatsAppMessage(parsedBody.data.message);

  if (!parsedMessage) {
    return NextResponse.json({ success: false, error: "Pesan belum bisa dibaca." }, { status: 422 });
  }

  if (!parsedBody.data.confirm) {
    return NextResponse.json({ success: true, data: parsedMessage });
  }

  const { client, user, error: authError } = await getRouteUser(request);

  if (!client) {
    return NextResponse.json({ success: false, error: authError }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Silakan login ulang." }, { status: 401 });
  }

  let categoryId: string | undefined;

  const existingCategory = await client
    .from("categories")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", parsedMessage.type)
    .ilike("name", parsedMessage.categoryName)
    .maybeSingle();

  if (existingCategory.error) {
    return NextResponse.json({ success: false, error: "Kategori belum bisa dicek." }, { status: 500 });
  }

  categoryId = existingCategory.data?.id;

  if (!categoryId) {
    const { data, error } = await client
      .from("categories")
      .insert({
        user_id: user.id,
        name: parsedMessage.categoryName,
        type: parsedMessage.type,
        color: parsedMessage.type === "income" ? "#22c55e" : "#10b981"
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: retryData, error: retryError } = await client
          .from("categories")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", parsedMessage.type)
          .ilike("name", parsedMessage.categoryName)
          .maybeSingle();

        if (retryError || !retryData) {
          return NextResponse.json({ success: false, error: "Kategori belum bisa disimpan." }, { status: 500 });
        }

        categoryId = retryData.id;
      } else {
        return NextResponse.json({ success: false, error: "Kategori belum bisa disimpan." }, { status: 500 });
      }
    } else {
      categoryId = data.id;
    }
  }

  const { data, error } = await client
    .from("transactions")
    .insert({
      user_id: user.id,
      category_id: categoryId,
      amount: parsedMessage.amount,
      type: parsedMessage.type,
      notes: parsedMessage.notes,
      transaction_date: new Date().toISOString().slice(0, 10),
      source: "whatsapp"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: "Transaksi belum bisa disimpan." }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
