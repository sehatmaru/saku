export const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCompactCurrency(value: number) {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000_000) {
    return `${sign}Rp ${formatShortNumber(absolute / 1_000_000_000)} M`;
  }

  if (absolute >= 1_000_000) {
    return `${sign}Rp ${formatShortNumber(absolute / 1_000_000)} jt`;
  }

  if (absolute >= 1_000) {
    return `${sign}Rp ${formatShortNumber(absolute / 1_000)} rb`;
  }

  return `${sign}Rp ${absolute}`;
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Tanggal tidak valid";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatShortNumber(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(".", ",");
}
