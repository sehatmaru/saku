export type TransactionType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  createdAt?: string;
};

export type Transaction = {
  id: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  notes: string;
  transactionDate: string;
  source: "manual" | "whatsapp";
  createdAt?: string;
  updatedAt?: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  period: "weekly" | "monthly";
  spent: number;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ParsedMessage = {
  amount: number;
  type: TransactionType;
  categoryName: string;
  notes: string;
};
