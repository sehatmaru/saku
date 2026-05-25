"use client";

import { create } from "zustand";
import { initialBudgets, initialCategories, initialTransactions } from "@/lib/mock-data";
import type { Budget, Category, Transaction, TransactionType } from "@/types/finance";

type NewTransaction = Omit<Transaction, "id" | "source"> & {
  source?: Transaction["source"];
};

type FinanceState = {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  activePeriod: "week" | "month" | "year";
  setActivePeriod: (period: FinanceState["activePeriod"]) => void;
  replaceFinanceData: (data: Pick<FinanceState, "categories" | "transactions" | "budgets">) => void;
  addTransaction: (transaction: NewTransaction) => void;
  updateTransaction: (id: string, transaction: NewTransaction) => void;
  deleteTransaction: (id: string) => void;
  addBudget: (budget: Omit<Budget, "id" | "spent">) => void;
  updateBudget: (id: string, budget: Partial<Omit<Budget, "id" | "spent">>) => void;
  archiveBudget: (id: string) => void;
  upsertCategory: (name: string, type: TransactionType) => Category;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useFinanceStore = create<FinanceState>()(
  (set, get) => ({
    categories: initialCategories,
    transactions: initialTransactions,
    budgets: initialBudgets,
    activePeriod: "month",
    setActivePeriod: (activePeriod) => set({ activePeriod }),
    replaceFinanceData: ({ categories, transactions, budgets }) =>
      set({
        categories,
        transactions,
        budgets
      }),
    addTransaction: (transaction) =>
      set((state) => ({
        transactions: [
          {
            ...transaction,
            id: makeId("trx"),
            source: transaction.source ?? "manual"
          },
          ...state.transactions
        ]
      })),
    updateTransaction: (id, transaction) =>
      set((state) => ({
        transactions: state.transactions.map((item) =>
          item.id === id
            ? {
                ...item,
                ...transaction,
                source: transaction.source ?? item.source
              }
            : item
        )
      })),
    deleteTransaction: (id) =>
      set((state) => ({
        transactions: state.transactions.filter((item) => item.id !== id)
      })),
    addBudget: (budget) =>
      set((state) => ({
        budgets: [
          {
            ...budget,
            id: makeId("budget"),
            spent: 0
          },
          ...state.budgets
        ]
      })),
    updateBudget: (id, budget) =>
      set((state) => ({
        budgets: state.budgets.map((item) => (item.id === id ? { ...item, ...budget } : item))
      })),
    archiveBudget: (id) =>
      set((state) => ({
        budgets: state.budgets.map((item) =>
          item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item
        )
      })),
    upsertCategory: (name, type) => {
      const current = get().categories.find(
        (category) => category.name.toLowerCase() === name.toLowerCase() && category.type === type
      );

      if (current) {
        return current;
      }

      const category: Category = {
        id: makeId("cat"),
        name,
        type,
        color: type === "income" ? "#22c55e" : "#10b981"
      };

      set((state) => ({ categories: [...state.categories, category] }));
      return category;
    }
  })
);
