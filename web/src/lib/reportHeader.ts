import { api } from "@/lib/api";

export const formatDmyFromYmd = (ymd: string) => {
  // ymd: YYYY-MM-DD
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return ymd || "-";
  return `${m[3]}-${m[2]}-${m[1]}`;
};

export const buildPeriodeText = (fromYmd?: string, toYmd?: string, fallbackYmd?: string) => {
  const safeFrom = fromYmd || fallbackYmd || "";
  const safeTo = toYmd || fallbackYmd || safeFrom || "";
  if (!safeFrom && !safeTo) return "PERIODE : -";
  const fromText = formatDmyFromYmd(safeFrom);
  const toText = formatDmyFromYmd(safeTo || safeFrom);
  return `PERIODE : ${fromText} s/d ${toText}`;
};

export const getActiveBranchName = async (): Promise<string> => {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try {
    const row = origin ? await api.getBranchByDomain(origin) : await api.getPublicBranch();
    return String(row?.nama || "").trim();
  } catch {
    try {
      const row = await api.getPublicBranch();
      return String(row?.nama || "").trim();
    } catch {
      return "";
    }
  }
};

