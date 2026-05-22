import { NextResponse, type NextRequest } from "next/server";
import { getRouteUser } from "@/lib/supabase-route";

export async function GET(request: NextRequest) {
  const { client, user, error: authError } = await getRouteUser(request);

  if (!client) {
    return NextResponse.json({ success: false, error: authError }, { status: 503 });
  }

  if (!user) {
    return NextResponse.json({ success: false, error: "Silakan login ulang." }, { status: 401 });
  }

  const [categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", user.id),
    client.from("transactions").select("*").eq("user_id", user.id).is("deleted_at", null),
    client.from("budgets").select("*").eq("user_id", user.id).is("archived_at", null)
  ]);

  if (categoriesResult.error || transactionsResult.error || budgetsResult.error) {
    return NextResponse.json({ success: false, error: "Data Saku belum bisa dimuat." }, { status: 500 });
  }

  const transactions = transactionsResult.data ?? [];
  const budgets = budgetsResult.data ?? [];
  const income = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const expense = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + Number(transaction.amount), 0);
  const budgetTotal = budgets.reduce((total, budget) => total + Number(budget.amount), 0);

  return NextResponse.json({
    success: true,
    data: {
      categories: categoriesResult.data ?? [],
      transactions,
      budgets,
      summary: {
        income,
        expense,
        saving: income - expense,
        budgetTotal
      }
    }
  });
}
