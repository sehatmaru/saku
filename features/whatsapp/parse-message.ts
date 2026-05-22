import type { ParsedMessage } from "@/types/finance";

const incomeKeywords = ["gaji", "income", "masuk", "terima", "freelance", "bonus", "invoice"];
const expenseKeywords = ["makan", "beli", "bayar", "ongkir", "transport", "gojek", "grab", "tagihan"];

export function parseWhatsAppMessage(message: string): ParsedMessage | null {
  const trimmed = message.trim();
  const normalized = trimmed.toLowerCase();
  const amountMatch = trimmed.match(/(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)/i);

  if (!amountMatch) {
    return null;
  }

  const amount = Number(amountMatch[1].replace(/[.,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const isIncome = incomeKeywords.some((keyword) => normalized.includes(keyword));
  const isExpense = expenseKeywords.some((keyword) => normalized.includes(keyword));
  const type = isIncome && !isExpense ? "income" : "expense";

  const explicitCategory = trimmed
    .match(/(?:kategori|cat)\s*[:=-]?\s*([a-zA-Z\s]+)/i)?.[1]
    ?.trim();
  const categoryName = explicitCategory ? toTitleCase(explicitCategory) : inferCategory(normalized, type);
  const notes =
    trimmed
      .replace(amountMatch[0], "")
      .replace(/(?:kategori|cat)\s*[:=-]?\s*[a-zA-Z\s]+/i, "")
      .replace(/\s+/g, " ")
      .trim() || "Input WhatsApp";

  return {
    amount,
    type,
    categoryName,
    notes
  };
}

function inferCategory(message: string, type: ParsedMessage["type"]) {
  if (type === "income") {
    if (message.includes("freelance") || message.includes("invoice")) return "Freelance";
    return "Gaji";
  }

  if (message.includes("transport") || message.includes("gojek") || message.includes("grab")) return "Transport";
  if (message.includes("tagihan") || message.includes("listrik") || message.includes("internet")) return "Tagihan";
  if (message.includes("belanja") || message.includes("beli")) return "Belanja";
  return "Makan";
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ");
}
