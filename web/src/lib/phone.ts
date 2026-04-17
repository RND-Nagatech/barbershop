export const normalizePhone = (value: string | undefined | null): string | null => {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  if (digits.startsWith("620")) digits = `62${digits.slice(3)}`;
  if (digits.startsWith("8")) digits = `62${digits}`;
  return digits.startsWith("62") ? digits : null;
};

