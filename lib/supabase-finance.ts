import { initialCategories } from "@/lib/mock-data";
import { supabase } from "@/lib/supabase";
import type { Budget, Category, Transaction, TransactionType } from "@/types/finance";

type DbCategory = {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  color: string;
  created_at: string;
};

type DbTransaction = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number | string;
  type: TransactionType;
  notes: string | null;
  transaction_date: string;
  source: Transaction["source"];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbBudget = {
  id: string;
  user_id: string;
  category_id: string;
  amount: number | string;
  period: Budget["period"];
  spent: number | string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceData = {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
};

export type TransactionInput = {
  categoryId: string;
  amount: number;
  type: TransactionType;
  notes: string;
  transactionDate: string;
  source?: Transaction["source"];
};

export type BudgetInput = {
  categoryId: string;
  amount: number;
  period: Budget["period"];
};

function requireSupabase() {
  if (!supabase) {
    throw new Error("Layanan data belum siap.");
  }

  return supabase;
}

export async function loadFinanceData(userId: string): Promise<FinanceData> {
  const client = requireSupabase();

  const [categoriesResult, transactionsResult, budgetsResult] = await Promise.all([
    client.from("categories").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
    client
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false }),
    client
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
  ]);

  if (categoriesResult.error) throw categoriesResult.error;
  if (transactionsResult.error) throw transactionsResult.error;
  if (budgetsResult.error) throw budgetsResult.error;

  let categories = (categoriesResult.data ?? []).map(mapCategory);

  if (categories.length === 0) {
    categories = await seedDefaultCategories(userId);
  }

  return {
    categories,
    transactions: (transactionsResult.data ?? []).map(mapTransaction),
    budgets: (budgetsResult.data ?? []).map(mapBudget)
  };
}

export async function createTransaction(userId: string, input: TransactionInput) {
  const client = requireSupabase();
  const { error } = await client.from("transactions").insert({
    user_id: userId,
    category_id: input.categoryId,
    amount: input.amount,
    type: input.type,
    notes: input.notes,
    transaction_date: input.transactionDate,
    source: input.source ?? "manual"
  });

  if (error) throw error;
}

export async function updateTransaction(userId: string, id: string, input: TransactionInput) {
  const client = requireSupabase();
  const { error } = await client
    .from("transactions")
    .update({
      category_id: input.categoryId,
      amount: input.amount,
      type: input.type,
      notes: input.notes,
      transaction_date: input.transactionDate,
      source: input.source ?? "manual"
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function softDeleteTransaction(userId: string, id: string) {
  const client = requireSupabase();
  const { error } = await client.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);

  if (error) throw error;
}

export async function createBudget(userId: string, input: BudgetInput) {
  const client = requireSupabase();
  const { error } = await client.from("budgets").insert({
    user_id: userId,
    category_id: input.categoryId,
    amount: input.amount,
    period: input.period
  });

  if (error) throw error;
}

export async function updateBudget(userId: string, id: string, input: BudgetInput) {
  const client = requireSupabase();
  const { error } = await client
    .from("budgets")
    .update({
      category_id: input.categoryId,
      amount: input.amount,
      period: input.period
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function archiveBudget(userId: string, id: string) {
  const client = requireSupabase();
  const { error } = await client.from("budgets").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);

  if (error) throw error;
}

export async function upsertRemoteCategory(userId: string, name: string, type: TransactionType) {
  const client = requireSupabase();
  const normalizedName = toCategoryName(name);
  const existing = await client
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type)
    .ilike("name", normalizedName)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return mapCategory(existing.data as DbCategory);

  const { data, error } = await client
    .from("categories")
    .insert({
      user_id: userId,
      name: normalizedName,
      type,
      color: type === "income" ? "#22c55e" : "#10b981"
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retryData, error: retryError } = await client
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type)
        .ilike("name", normalizedName)
        .maybeSingle();

      if (retryError || !retryData) throw error;
      return mapCategory(retryData as DbCategory);
    }

    throw error;
  }
  return mapCategory(data as DbCategory);
}

async function seedDefaultCategories(userId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("categories")
    .insert(
      initialCategories.map((category) => ({
        user_id: userId,
        name: category.name,
        type: category.type,
        color: category.color
      }))
    )
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapCategory);
}

function mapCategory(category: DbCategory): Category {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    color: category.color,
    createdAt: category.created_at
  };
}

function mapTransaction(transaction: DbTransaction): Transaction {
  return {
    id: transaction.id,
    categoryId: transaction.category_id,
    amount: Number(transaction.amount),
    type: transaction.type,
    notes: transaction.notes ?? "Tanpa catatan",
    transactionDate: transaction.transaction_date,
    source: transaction.source,
    createdAt: transaction.created_at,
    updatedAt: transaction.updated_at
  };
}

function mapBudget(budget: DbBudget): Budget {
  return {
    id: budget.id,
    categoryId: budget.category_id,
    amount: Number(budget.amount),
    period: budget.period,
    spent: Number(budget.spent),
    archivedAt: budget.archived_at,
    createdAt: budget.created_at,
    updatedAt: budget.updated_at
  };
}

function toCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}
