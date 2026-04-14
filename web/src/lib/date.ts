export function formatLocalYmd(date: Date | undefined): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

