import type { Budget, Category, Transaction } from "@/types/finance";

export const initialCategories: Category[] = [
  { id: "cat-food", name: "Makan", type: "expense", color: "#10b981" },
  { id: "cat-transport", name: "Transport", type: "expense", color: "#14b8a6" },
  { id: "cat-bills", name: "Tagihan", type: "expense", color: "#f59e0b" },
  { id: "cat-shopping", name: "Belanja", type: "expense", color: "#ef4444" },
  { id: "cat-income", name: "Gaji", type: "income", color: "#22c55e" },
  { id: "cat-freelance", name: "Freelance", type: "income", color: "#06b6d4" }
];

export const initialTransactions: Transaction[] = [
  {
    id: "trx-1",
    categoryId: "cat-income",
    amount: 8500000,
    type: "income",
    notes: "Gaji bulanan",
    transactionDate: "2026-05-01",
    source: "manual"
  },
  {
    id: "trx-2",
    categoryId: "cat-food",
    amount: 68000,
    type: "expense",
    notes: "Makan siang tim",
    transactionDate: "2026-05-18",
    source: "manual"
  },
  {
    id: "trx-3",
    categoryId: "cat-transport",
    amount: 42000,
    type: "expense",
    notes: "Ride ke kantor",
    transactionDate: "2026-05-19",
    source: "whatsapp"
  },
  {
    id: "trx-4",
    categoryId: "cat-shopping",
    amount: 365000,
    type: "expense",
    notes: "Sepatu kerja",
    transactionDate: "2026-05-20",
    source: "manual"
  },
  {
    id: "trx-5",
    categoryId: "cat-freelance",
    amount: 2400000,
    type: "income",
    notes: "Invoice desain",
    transactionDate: "2026-05-21",
    source: "manual"
  },
  {
    id: "trx-6",
    categoryId: "cat-bills",
    amount: 515000,
    type: "expense",
    notes: "Internet dan listrik",
    transactionDate: "2026-05-22",
    source: "manual"
  }
];

export const initialBudgets: Budget[] = [
  { id: "budget-1", categoryId: "cat-food", amount: 1800000, period: "monthly", spent: 1140000 },
  { id: "budget-2", categoryId: "cat-transport", amount: 900000, period: "monthly", spent: 520000 },
  { id: "budget-3", categoryId: "cat-shopping", amount: 1200000, period: "monthly", spent: 880000 },
  { id: "budget-4", categoryId: "cat-bills", amount: 1000000, period: "monthly", spent: 515000 }
];
